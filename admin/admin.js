// 릴멜의 타로카드 관리자 페이지 (https://trimarrai.github.io/admin/)
// 앱과 같은 Firebase 프로젝트(leelmell-1a2ab)를 씁니다. 실제로 막아 주는 것은 Firestore 규칙(관리자 계정만 읽기·쓰기)입니다.
// 주소 끝에 ?demo 를 붙이면 Firebase 없이 예시 데이터로 화면만 봅니다.

// Firebase 13.3.0 (앱과 같은 버전) 파일을 fb/ 에 함께 둡니다
const CONFIG = {
  apiKey: 'AIzaSyCpAGVQkmkG1UDRN2xMO4-Z0YeTnwObfo8',
  authDomain: 'leelmell-1a2ab.firebaseapp.com',
  projectId: 'leelmell-1a2ab',
  storageBucket: 'leelmell-1a2ab.firebasestorage.app',
  messagingSenderId: '980497145661',
  appId: '1:980497145661:web:e36c665d2b35523fe86f54',
}
const CARD_NAMES = ['바보', '마법사', '여사제', '여황제', '황제', '교황', '연인', '전차', '힘', '은둔자', '운명의 수레바퀴',
  '정의', '매달린 사람', '죽음', '절제', '악마', '탑', '별', '달', '태양', '심판', '세계']
const DEMO = new URLSearchParams(location.search).has('demo')

const $ = (s, el = document) => el.querySelector(s)
const root = $('#root')
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const num = (v) => Math.trunc(Number(v) || 0)
const pad = (n) => String(n).padStart(2, '0')
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const md = (d) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const fmt = (d) => (d ? `${md(d)} ${hm(d)}` : '-')
const won = (n) => n.toLocaleString('ko-KR')
const mask = (e) => {
  const [id, dom] = String(e || '').split('@')
  if (!dom) return e || '(이메일 없음)'
  return id.slice(0, Math.min(4, Math.max(1, id.length - 2))) + '***@' + dom
}
const ago = (d) => {
  if (!d) return '-'
  const m = Math.floor((Date.now() - d.getTime()) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return m + '분 전'
  if (m < 1440) return Math.floor(m / 60) + '시간 전'
  return Math.floor(m / 1440) + '일 전'
}
const plat = (p) => (p === 'app' ? '<span class="pill app">앱</span>' : p === 'web' ? '<span class="pill web">웹</span>' : '')

// ---------- 데이터 ----------
// 관리자 페이지는 하루 합계(daily)와 최근 목록 몇 개만 읽습니다. 사용자 목록은 볼 때만 불러옵니다
let fb = null // Firebase 함수 모음
const data = { daily: {}, visits: {}, hits: [], hitsEnd: false, purchases: [], coupons: [], total: null, retention: null, users: {}, list: [] }
let tab = 'stats'
const range = { visit: 14, join: 14, sales: 14 }
let listMode = 'new' // 사용자 목록: new 새로 가입 · recent 최근 접속 · rich 크리스탈 많은
let listN = 20
let picked = null // 사용자 탭에서 보고 있는 사용자
let rich = null // 매출 탭의 잔고 확인용 (크리스탈 많은 사용자)

const PRODUCT = { pro01: { name: '크리스탈 4개', crystals: 4 }, pro02: { name: '크리스탈 20개', crystals: 20 }, pro03: { name: '천연석 100개', crystals: 0 } }

async function loadFirebase() {
  const [app, auth, fs] = await Promise.all([
    import('./fb/firebase-app.js'),
    import('./fb/firebase-auth.js'),
    import('./fb/firebase-firestore-lite.js'),
  ])
  const a = app.initializeApp(CONFIG)
  return { auth: auth.getAuth(a), db: fs.getFirestore(a), A: auth, F: fs }
}

const userOf = (d) => {
  const v = d.data()
  const u = { uid: d.id, email: v.email || '', g: v.g || {}, platform: v.platform || '', updatedAt: v.updatedAt?.toDate?.() || null, createdAt: v.createdAt?.toDate?.() || null }
  data.users[u.uid] = u
  return u
}

async function loadData() {
  const { db, F } = fb
  const col = (n) => F.collection(db, n)
  const safe = (p) => p.catch((e) => { console.warn(e); return null })
  const since = F.Timestamp.fromDate(addDays(new Date(), -90))
  const [daily, visits, hits, buys, coupons, total] = await Promise.all([
    safe(F.getDocs(col('daily'))),
    safe(F.getDocs(col('visits'))),
    safe(F.getDocs(F.query(col('hits'), F.orderBy('at', 'desc'), F.limit(30)))),
    safe(F.getDocs(F.query(col('purchases'), F.where('at', '>=', since), F.orderBy('at', 'desc'), F.limit(2000)))),
    safe(F.getDocs(col('coupons'))),
    safe(F.getCount(col('users'))),
  ])
  data.dailyOk = !!daily
  if (daily) for (const d of daily.docs) data.daily[d.id] = d.data()
  if (visits) for (const d of visits.docs) data.visits[d.id] = { app: num(d.data().app), web: num(d.data().web) }
  data.hitsOk = !!hits
  if (hits) { data.hits = hits.docs.map(hitOf); data.hitsLast = hits.docs[hits.docs.length - 1]; data.hitsEnd = hits.docs.length < 30 }
  data.buysOk = !!buys
  if (buys) data.purchases = buys.docs.map((d) => ({ ...d.data(), at: d.data().at?.toDate?.() || null })).filter((p) => p.at)
  if (coupons) data.coupons = coupons.docs.map((d) => ({ code: d.id, ...d.data() })).sort((x, y) => x.code.localeCompare(y.code))
  data.total = total ? total.data().count : null
  await loadHitUsers(data.hits)
}
const hitOf = (d) => ({ ...d.data(), at: d.data().at?.toDate?.() || null })
// 로그인한 방문에는 uid 가 붙습니다. 그 계정의 이메일을 보여 주려고 users 문서를 한 번씩만 읽습니다
async function loadHitUsers(hits) {
  if (DEMO) return
  const { db, F } = fb
  const uids = [...new Set(hits.map((h) => h.uid).filter((u) => u && !data.users[u]))]
  await Promise.all(uids.map((u) => F.getDoc(F.doc(db, 'users', u)).then((d) => { if (d.exists()) userOf(d) }).catch(() => {})))
}

async function moreHits() {
  if (DEMO) { data.hitsEnd = true; return }
  const { db, F } = fb
  const snap = await F.getDocs(F.query(F.collection(db, 'hits'), F.orderBy('at', 'desc'), F.startAfter(data.hitsLast), F.limit(30)))
  const more = snap.docs.map(hitOf)
  await loadHitUsers(more)
  data.hits.push(...more)
  data.hitsLast = snap.docs[snap.docs.length - 1] || data.hitsLast
  data.hitsEnd = snap.docs.length < 30
}

// 사용자 목록 (볼 때만 불러옴)
async function loadList() {
  if (DEMO) {
    const all = Object.values(data.users)
    const by = { new: (a, b) => (b.createdAt || 0) - (a.createdAt || 0), recent: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0), rich: (a, b) => num(b.g.crystals) - num(a.g.crystals) }[listMode]
    data.list = all.filter((u) => listMode !== 'new' || u.createdAt).sort(by).slice(0, listN)
    return
  }
  const { db, F } = fb
  const field = { new: 'createdAt', recent: 'updatedAt', rich: 'g.crystals' }[listMode]
  const snap = await F.getDocs(F.query(F.collection(db, 'users'), F.orderBy(field, 'desc'), F.limit(listN)))
  data.list = snap.docs.map(userOf)
}
async function loadRetention() {
  if (data.retention !== null) return
  const now = Date.now()
  let cohort
  if (DEMO) cohort = Object.values(data.users).filter((u) => u.createdAt && now - u.createdAt >= 7 * 864e5 && now - u.createdAt < 14 * 864e5)
  else {
    const { db, F } = fb
    const ts = (d) => F.Timestamp.fromMillis(now - d * 864e5)
    const snap = await F.getDocs(F.query(F.collection(db, 'users'), F.where('createdAt', '>', ts(14)), F.where('createdAt', '<=', ts(7))))
    cohort = snap.docs.map(userOf)
  }
  const back = cohort.filter((u) => u.updatedAt && u.updatedAt - u.createdAt >= 7 * 864e5).length
  data.retention = cohort.length ? Math.round((back / cohort.length) * 100) + '%' : '-'
}
async function findUsers(q) {
  if (DEMO) return Object.values(data.users).filter((u) => u.email.startsWith(q)).slice(0, 20)
  const { db, F } = fb
  const snap = await F.getDocs(F.query(F.collection(db, 'users'), F.where('email', '>=', q), F.where('email', '<=', q + ''), F.limit(20)))
  return snap.docs.map(userOf)
}
async function loadRich() {
  if (rich) return
  if (DEMO) { rich = Object.values(data.users).sort((a, b) => num(b.g.crystals) - num(a.g.crystals)).slice(0, 20); return }
  const { db, F } = fb
  const snap = await F.getDocs(F.query(F.collection(db, 'users'), F.orderBy('g.crystals', 'desc'), F.limit(20)))
  rich = snap.docs.map(userOf)
}

// ---------- 계산 ----------
const D = (k) => data.daily[k] || {}
const visitOf = (k) => {
  const d = D(k)
  const app = 'v_app' in d || 'v_web' in d ? num(d.v_app) : num(data.visits[k]?.app)
  const web = 'v_app' in d || 'v_web' in d ? num(d.v_web) : num(data.visits[k]?.web)
  return { app, web, all: app + web }
}
function series(n, valueOf) {
  const today = new Date()
  return [...Array(n).keys()].map((i) => { const d = addDays(today, i - n + 1); return { d, k: dayKey(d), v: valueOf(dayKey(d)) } })
}
const lastDays = (n) => series(n, () => 0).map((r) => r.k)
// 최근 n일 동안 'prefix_' 로 시작하는 칸들을 더함 → [[이름, 합], ...]
function sumPrefix(prefix, n = 30) {
  const m = new Map()
  for (const k of lastDays(n)) for (const [f, v] of Object.entries(D(k))) if (f.startsWith(prefix)) m.set(f.slice(prefix.length), (m.get(f.slice(prefix.length)) || 0) + num(v))
  return [...m].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
}
const sumField = (f, n = 30) => lastDays(n).reduce((a, k) => a + num(D(k)[f]), 0)
const krw = (list) => list.filter((p) => p.currency === 'KRW').reduce((a, p) => a + Number(p.price || 0), 0)
const money = (p) => (p.currency === 'KRW' || !p.currency ? '₩' + won(Number(p.price || 0)) : `${Number(p.price || 0)} ${esc(p.currency)}`)

// ---------- 그리기 ----------
function chartHtml(id, rows, unit) {
  const max = Math.max(1, ...rows.map((r) => r.v))
  const step = niceStep(max)
  const top = Math.max(step * Math.ceil(max / step), step)
  const H = 136
  const grid = [1, 2, 3, 4].map((i) => i * step).filter((v) => v <= top).map((v) => `<div class="g" style="bottom:${22 + (v / top) * H}px"><i>${won(v)}</i></div>`).join('')
  const every = rows.length <= 14 ? 4 : rows.length <= 30 ? 7 : 30
  const bars = rows.map((r, i) => {
    const last = i === rows.length - 1
    const lbl = last ? '오늘' : (rows.length - 1 - i) % every === 0 ? `${r.d.getMonth() + 1}/${r.d.getDate()}` : ''
    return `<div class="c${last ? ' today' : ''}" data-chart="${id}" data-i="${i}" title="${r.k} · ${unit === '원' ? '₩' + won(r.v) : won(r.v) + unit}"><b style="height:${(r.v / top) * H}px"></b><em>${lbl}</em></div>`
  }).join('')
  return `<div class="chart" id="chart-${id}">${grid}${bars}</div>`
}
function niceStep(max) {
  const raw = max / 3
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  for (const m of [1, 2, 5, 10]) if (raw <= m * p) return m * p
  return 10 * p
}
const seg = (key) => `<div class="seg">${[14, 30, 90].map((n) => `<button type="button" data-range="${key}" data-n="${n}" class="${range[key] === n ? 'on' : ''}">${n}일</button>`).join('')}</div>`
const card = (title, body) => `<div class="card"><h2>${title}</h2>${body}</div>`
const kpis = (xs) => `<div class="kpi">${xs.map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('')}</div>`
const sub = (t, s = '') => `<p class="sub">${t}${s ? ` <span>${s}</span>` : ''}</p>`
function barList(rows, label = (x) => x) {
  if (!rows.length) return '<p class="dim">기록이 없습니다.</p>'
  rows = rows.slice(0, 8)
  const total = rows.reduce((a, r) => a + r[1], 0)
  const max = rows[0][1] || 1
  return `<ul class="bars">${rows.map(([n, v]) => `<li><div class="lbl"><i style="width:${(v / max) * 100}%"></i><span>${esc(label(n))}</span></div><b>${won(v)}</b><em>${Math.round((v / total) * 100)}%</em></li>`).join('')}</ul>`
}
const dailyNote = () => (data.dailyOk ? '' : '<p class="dim">하루 합계를 읽지 못했습니다. firestore.rules 를 최신으로 게시했는지 확인해 주세요.</p>')

// 이름 붙이기
const CH = { app: '안드로이드 앱', direct: '직접 방문', search: '검색', sns: 'SNS', site: '다른 사이트' }
const PAGE = { home: '홈', chambre: '릴멜의 방', cards: '릴멜의 카드', love: '율리움의 방', lovecards: '율리움의 카드', shop: '상점', depot: '창고',
  lab: '실험실', prayroom: '기도실', parking: '뒷마당', locker: '사물함', intro: '소개', admin: '관리자' }
const COUNTRY = { KR: '대한민국', JP: '일본', US: '미국', CN: '중국', TW: '대만', HK: '홍콩', SG: '싱가포르', TH: '태국', VN: '베트남', PH: '필리핀', ID: '인도네시아',
  MY: '말레이시아', IN: '인도', AE: '아랍에미리트', AU: '호주', NZ: '뉴질랜드', GB: '영국', FR: '프랑스', DE: '독일', ES: '스페인', IT: '이탈리아', NL: '네덜란드',
  RU: '러시아', CA: '캐나다', BR: '브라질', MX: '멕시코' }
const DEVICE = { phone: '폰', tablet: '태블릿', pc: 'PC' }
const DV = { app: '안드로이드 앱', phone: '폰 웹', tablet: '태블릿 웹', pc: 'PC 웹' }
const LANG = { ko: '한국어', ja: '日本語', en: 'English', zh: '中文' }
const pageName = (k) => PAGE[k] || k || '-'
const countryName = (c) => (c && c !== 'xx' ? `${COUNTRY[c] || c} (${c})` : '알 수 없음')
const langName = (l) => LANG[String(l).slice(0, 2)] || (l && l !== 'xx' ? l : '알 수 없음')
const srcName = (k) => { const i = k.indexOf('_'); return `${CH[k.slice(0, i)] || k.slice(0, i)} · ${k.slice(i + 1)}` }
const when = (d) => `${md(d)} ${d.getHours() < 12 ? '오전' : '오후'} ${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())}`

// ---------- 통계 탭: 오늘 · 접속 · 유입 · 이용 ----------
function statsTab() {
  const today = dayKey()
  const t = visitOf(today)
  const y = visitOf(dayKey(addDays(new Date(), -1)))
  const diff = y.all ? Math.round(((t.all - y.all) / y.all) * 100) : null
  const rows = series(range.visit, (k) => visitOf(k).all)
  const app = rows.reduce((a, r) => a + visitOf(r.k).app, 0)
  const all = rows.reduce((a, r) => a + r.v, 0)
  const todaySales = krw(data.purchases.filter((p) => dayKey(p.at) === today))
  return card('오늘', kpis([
    [`${won(t.all)}${diff === null ? '' : `<small>${diff >= 0 ? '+' : ''}${diff}%</small>`}`, '접속 (기기)'],
    [won(num(D(today).signup)), '신규 가입'],
    [won(num(D(today).tarot)), '3장 타로'],
    ['₩' + won(todaySales), '매출'],
  ])) +
  card('하루 접속', `${seg('visit')}${chartHtml('visit', rows, '대')}<div class="legendline">${all ? `앱 ${Math.round((app / all) * 100)}% · 웹 ${100 - Math.round((app / all) * 100)}% (최근 ${range.visit}일)` : '아직 기록이 없습니다'}</div>
<p class="dim">기기 수는 로그인하지 않은 사람까지 하루 한 번씩 셉니다.</p>`) +
  card('유입 <small>최근 30일 · 방문 기준</small>',
    sub('채널') + barList(sumPrefix('ch_'), (k) => CH[k] || k) +
    sub('출처') + barList(sumPrefix('src_'), srcName) +
    sub('국가(추정)') + barList(sumPrefix('c_'), countryName) +
    sub('언어') + barList(sumPrefix('l_'), langName) +
    sub('기기 · 웹/앱') + barList(sumPrefix('dv_'), (k) => DV[k] || k) +
    sub('첫 화면') + barList(sumPrefix('p_'), pageName)) +
  card('이용 <small>최근 30일</small>', kpis([
    [won(sumField('tarot')), '3장 타로'],
    [won(sumField('love')), '연애 타로'],
    [won(sumField('pray')), '기도'],
    [won(sumField('signup')), '신규 가입'],
  ])) +
  // 앱 라이브 업데이트 결과 (최근 7일): 단계별 횟수와 앱에서 실행 중인 화면 버전
  card('앱 업데이트 <small>최근 7일</small>',
    sub('결과') + barList(sumPrefix('upd_', 7).filter(([k]) => !k.startsWith('run_')), (k) => UPD[k] || k) +
    sub('실행 중인 화면 버전') + barList(sumPrefix('upd_run_', 7), (k) => k.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})_/, '$2/$3 $4:$5 · '))) + dailyNote()
}
const UPD = { latest: '최신 버전', dl: '새 버전 받음', set: '새 버전 적용 (다음에 열 때)', set_now: '새 버전 바로 적용', old_build: '빌드가 낮아 건너뜀', err_rolled_back: '적용 실패 → 되돌림', err_load: '업데이트 기능 로드 실패' }

// ---------- 최근 탭: 방문 기록 ----------
// 로그인한 방문이면 Gmail 계정을 보여 주고, 누르면 사용자 탭에서 그 계정을 엽니다
function hitWho(h) {
  if (!h.uid) return ''
  const u = data.users[h.uid]
  return u?.email ? `<p class="who" data-pick="${esc(h.uid)}">${esc(u.email)}</p>` : '<p class="who dim2">로그인 사용자 (계정 정보 없음)</p>'
}
function recentTab() {
  return card('최근 방문', `${data.hits.map((h) => `<div class="hit"><div class="top"><span>${h.at ? when(h.at) : '-'}</span><span>${num(h.views) || 1}화면</span></div>
<p class="ch">${esc((CH[h.ch] || h.ch) + (h.src ? ' · ' + h.src : ''))}</p>${hitWho(h)}<p class="lp">첫 화면 ${esc(pageName(h.landing))}</p>
<p class="env">${esc([h.country || '?', h.lang, DEVICE[h.device], h.os, h.browser === 'app' ? '앱' : h.browser, h.first ? '첫 방문' : '다시 방문'].filter(Boolean).join(' · '))}</p></div>`).join('') || '<p class="dim">아직 기록이 없습니다.</p>'}
${data.hitsEnd ? '' : '<button type="button" class="btn ghost full" data-act="moreHits">더 보기</button>'}
${data.hitsOk ? '' : '<p class="dim">방문 기록을 읽지 못했습니다. firestore.rules 를 최신으로 게시했는지 확인해 주세요.</p>'}`)
}

// ---------- 사용자 탭: 가입 · 목록 · 찾기 · 지급 ----------
function userTab() {
  const now = new Date()
  const month = dayKey().slice(0, 7)
  const monthN = Object.entries(data.daily).filter(([k]) => k.startsWith(month)).reduce((a, [, d]) => a + num(d.signup), 0)
  const rows = series(range.join, (k) => num(D(k).signup))
  const modes = [['new', '새로 가입'], ['recent', '최근 접속'], ['rich', '크리스탈 많은']]
  const line = (u) => {
    const right = listMode === 'rich' ? `크리스탈 ${won(num(u.g.crystals))}` : listMode === 'recent' ? ago(u.updatedAt) : `타로 ${Object.keys(u.g.readings || {}).length}회`
    const small = listMode === 'new' ? `가입 ${fmt(u.createdAt)} · 크리스탈 ${num(u.g.crystals)}` : `마지막 접속 ${fmt(u.updatedAt)} · 천연석 ${won(num(u.g.stones))}`
    return `<li class="tap" data-pick="${esc(u.uid)}"><div class="m"><p>${esc(mask(u.email))}${plat(u.platform)}</p><small>${small}</small></div><div class="r">${right}</div></li>`
  }
  return card('가입', kpis([
    [won(num(D(dayKey()).signup)), '오늘 가입'],
    [won(monthN), `${now.getMonth() + 1}월 가입`],
    [data.total === null ? '-' : won(data.total), '전체 가입자'],
    [data.retention ?? '…', '가입 7일 뒤에도 접속'],
  ]) + sub('하루 가입') + seg('join') + chartHtml('join', rows, '명')) +
  card('사용자', `<div class="row"><input id="q" type="search" placeholder="이메일 앞부분 (예: minji)" autocomplete="off" autocapitalize="none"><button class="btn" type="button" data-act="find">찾기</button></div>
<div id="found"></div><div id="detail"></div>
<div class="seg" style="margin-top:14px">${modes.map(([k, n]) => `<button type="button" data-mode="${k}" class="${listMode === k ? 'on' : ''}">${n}</button>`).join('')}</div>
<ul class="list" id="ulist">${data.list.map(line).join('') || '<li class="empty">불러오는 중…</li>'}</ul>
${data.list.length >= listN ? '<button type="button" class="btn ghost full" data-act="moreUsers">더 보기</button>' : ''}`)
}

// ---------- 매출 탭 ----------
function salesTab() {
  const today = dayKey()
  const month = today.slice(0, 7)
  const ps = data.purchases
  const mon = ps.filter((p) => dayKey(p.at).startsWith(month))
  const monKrw = krw(mon)
  const byDay = {}
  for (const p of ps) if (p.currency === 'KRW') byDay[dayKey(p.at)] = (byDay[dayKey(p.at)] || 0) + Number(p.price || 0)
  const rows = series(range.sales, (k) => byDay[k] || 0)
  const prod = new Map()
  for (const p of mon) prod.set(p.product, (prod.get(p.product) || 0) + 1)
  // 잔고 확인: 최근 90일 구매로 받은 크리스탈보다 30개 넘게 많이 가진 계정
  const bought = {}
  for (const p of ps) bought[p.uid] = (bought[p.uid] || 0) + (PRODUCT[p.product]?.crystals || 0)
  const odd = (rich || []).filter((u) => num(u.g.crystals) > (bought[u.uid] || 0) + 30)
  const other = mon.filter((p) => p.currency && p.currency !== 'KRW').length
  return card('매출', kpis([
    ['₩' + won(krw(ps.filter((p) => dayKey(p.at) === today))), '오늘'],
    ['₩' + won(monKrw), `${new Date().getMonth() + 1}월`],
    [won(mon.length) + '건', `${new Date().getMonth() + 1}월 결제`],
    [mon.length ? '₩' + won(Math.round(monKrw / Math.max(1, mon.length - other))) : '-', '건당 평균'],
  ]) + sub('하루 매출') + seg('sales') + chartHtml('sales', rows, '원') +
    sub('상품별', `${new Date().getMonth() + 1}월`) + barList([...prod].sort((a, b) => b[1] - a[1]), (k) => PRODUCT[k]?.name || k) +
    (other ? `<p class="dim">원화가 아닌 결제 ${other}건은 금액 합계에서 빠지고, 결제 내역에서 볼 수 있습니다.</p>` : '')) +
  card('결제 내역', `<ul class="list">${ps.slice(0, data.buysShown || 20).map((p) => `<li class="tap" data-pick="${esc(p.uid)}"><div class="m"><p>${esc(mask(p.email))}</p><small>${fmt(p.at)} · ${esc(PRODUCT[p.product]?.name || p.product)}</small></div><div class="r">${money(p)}</div></li>`).join('') || '<li class="empty">결제 기록이 없습니다</li>'}</ul>
${ps.length > (data.buysShown || 20) ? '<button type="button" class="btn ghost full" data-act="moreBuys">더 보기</button>' : ''}
<p class="dim">금액은 결제 때 Play 가 알려 준 가격(수수료·세금 전)입니다. 환불은 Play Console 에서 확인합니다. ${data.buysOk ? '' : '결제 기록을 읽지 못했습니다. firestore.rules 를 최신으로 게시했는지 확인해 주세요.'}</p>`) +
  card('잔고 확인 <small>최근 구매보다 크리스탈이 30개 넘게 많은 계정</small>', rich
    ? `<ul class="list">${odd.map((u) => `<li class="tap" data-pick="${esc(u.uid)}"><div class="m"><p>${esc(mask(u.email))}</p><small>크리스탈 ${won(num(u.g.crystals))} · 90일 구매 ${won(bought[u.uid] || 0)}</small></div><div class="r">보기</div></li>`).join('') || '<li class="empty">이상한 계정이 없습니다</li>'}</ul><p class="dim">쿠폰·무료 보상·관리자 지급으로 받은 크리스탈도 있으니 참고만 하세요.</p>`
    : '<p class="dim">불러오는 중…</p>')
}

function couponTab() {
  return `<div class="card"><h2>쿠폰</h2>
<ul class="list">${data.coupons.map((c) => `<li><div class="m"><p><code>${esc(c.code)}</code></p><small>크리스탈 ${num(c.crystals)} · 천연석 ${num(c.stones)} · 사용 ${num(c.uses)} / ${num(c.maxUses)} · ${c.active ? '사용 중' : '멈춤'}</small></div><button class="btn ghost small" type="button" data-act="toggle" data-code="${esc(c.code)}" data-on="${c.active ? 0 : 1}">${c.active ? '멈추기' : '다시 켜기'}</button></li>`).join('') || '<li class="empty">쿠폰이 없습니다</li>'}</ul>
<p class="sub">새 쿠폰</p>
<label>코드<input id="cpCode" placeholder="예: WELCOME2026" autocomplete="off" autocapitalize="characters"></label>
<div class="two"><label>크리스탈<input id="cpCt" type="number" inputmode="numeric" min="0" value="3"></label><label>천연석<input id="cpRk" type="number" inputmode="numeric" min="0" value="0"></label></div>
<label>최대 사용 수<input id="cpMax" type="number" inputmode="numeric" min="1" value="100"></label>
<button class="btn full" type="button" data-act="coupon">쿠폰 만들기</button>
<p id="cpMsg" class="msg"></p>
<p class="dim">코드는 대문자·숫자 3~30자, 한 사람당 한 번씩 쓸 수 있습니다. 사용자는 앱의 사물함에서 코드를 넣습니다.</p></div>`
}

const ICON = {
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  recent: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-6"/>',
  sales: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M6 15h4"/>',
  coupon: '<path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z"/><path d="M14 7v12" stroke-dasharray="2 2"/>',
}
function draw() {
  const tabs = [['stats', '통계'], ['recent', '최근'], ['user', '사용자'], ['sales', '매출'], ['coupon', '쿠폰']]
  root.innerHTML = `<nav class="tabs" style="grid-template-columns:repeat(5,1fr)">${tabs.map(([k, n]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg><span>${n}</span></button>`).join('')}</nav>` +
    ({ stats: statsTab, recent: recentTab, user: userTab, sales: salesTab, coupon: couponTab })[tab]()
  if (tab === 'user' && picked) showUser(picked)
}
// 탭을 열 때 필요한 것만 불러옵니다
async function openTab(name) {
  tab = name
  draw()
  window.scrollTo(0, 0)
  try {
    if (name === 'user') { await Promise.all([data.list.length ? null : loadList(), loadRetention()]); if (tab === 'user') draw() }
    if (name === 'sales' && !rich) { await loadRich(); if (tab === 'sales') draw() }
  } catch (e) { console.warn(e) }
}

async function showUser(uid) {
  let u = data.users[uid]
  if (!u && !DEMO) {
    try { const d = await fb.F.getDoc(fb.F.doc(fb.db, 'users', uid)); if (d.exists()) u = userOf(d) } catch { /* 없음 */ }
  }
  const box = $('#detail')
  if (!u || !box) return
  picked = uid
  const g = u.g || {}
  const days = Object.keys(g.readings || {}).sort()
  const buys = data.purchases.filter((p) => p.uid === uid)
  box.innerHTML = `<div class="box">
<p><b>${esc(u.email || '(이메일 없음)')}</b>${plat(u.platform)}<br><code>${esc(u.uid)}</code></p>
<p>크리스탈 <b>${num(g.crystals)}</b> · 천연석 <b>${num(g.stones)}</b></p>
<p class="dim" style="margin:0 0 6px">가입 ${fmt(u.createdAt)} · 마지막 접속 ${fmt(u.updatedAt)}<br>3장 타로 ${days.length}번 (마지막 ${days[days.length - 1] || '-'}) · 연애 타로 ${Object.keys(g.love || {}).length}번${buys.length ? `<br>최근 90일 결제 ${buys.length}건 · ${buys.map((p) => PRODUCT[p.product]?.name || p.product).join(', ')}` : ''}</p>
<div class="two"><label>크리스탈<input id="gfCt" type="number" inputmode="numeric" value="0"></label><label>천연석<input id="gfRk" type="number" inputmode="numeric" value="0"></label></div>
<label>메모 (사용자에게는 보이지 않음)<input id="gfNote" placeholder="예: 결제 오류 보상"></label>
<button class="btn full" type="button" data-act="gift" data-uid="${esc(u.uid)}">보내기</button>
<p id="gfMsg" class="msg"></p>
<p class="dim">빼려면 음수(-3). 사용자가 다음에 앱을 열 때 받아 갑니다.</p>
<div id="gifts"></div></div>`
  if (DEMO || !fb) return
  try {
    const { db, F } = fb
    const snap = await F.getDocs(F.query(F.collection(db, 'gifts'), F.where('uid', '==', uid)))
    const gifts = snap.docs.map((d) => ({ ...d.data(), at: d.data().at?.toDate?.() || null })).sort((a, b) => (b.at || 0) - (a.at || 0))
    if (gifts.length && $('#gifts')) $('#gifts').innerHTML = `<p class="sub">보낸 기록</p><ul class="list">${gifts.map((x) => `<li><div class="m"><p>크리스탈 ${num(x.crystals)} · 천연석 ${num(x.stones)}</p><small>${fmt(x.at)}${x.note ? ' · ' + esc(x.note) : ''}</small></div><div class="r">${x.claimed ? '받음' : '대기'}</div></li>`).join('')}</ul>`
  } catch { /* 규칙 게시 전 */ }
}

// ---------- 동작 ----------
root.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-tab],[data-range],[data-mode],[data-pick],[data-chart],[data-act]')
  if (!t) return
  if (t.dataset.tab) return openTab(t.dataset.tab)
  if (t.dataset.range) { range[t.dataset.range] = +t.dataset.n; draw(); return }
  if (t.dataset.mode) { listMode = t.dataset.mode; listN = 20; data.list = []; draw(); await loadList().catch(console.warn); draw(); return }
  if (t.dataset.pick) {
    if (tab !== 'user') { tab = 'user'; draw(); if (!data.list.length) loadList().then(() => tab === 'user' && draw()).catch(() => {}) }
    $('#found') && ($('#found').innerHTML = '')
    await showUser(t.dataset.pick)
    $('#detail')?.scrollIntoView({ block: 'start' })
    return
  }
  if (t.dataset.chart) {
    const ch = t.closest('.chart')
    ch.querySelectorAll('.c.sel').forEach((x) => x.classList.remove('sel'))
    ch.querySelector('.tip')?.remove()
    t.classList.add('sel')
    ch.insertAdjacentHTML('beforeend', `<span class="tip">${esc(t.title)}</span>`)
    return
  }
  const act = t.dataset.act
  if (act === 'moreHits') { t.disabled = true; await moreHits().catch(console.warn); draw(); return }
  if (act === 'moreUsers') { listN += 20; await loadList().catch(console.warn); draw(); return }
  if (act === 'moreBuys') { data.buysShown = (data.buysShown || 20) + 30; draw(); return }
  if (act === 'find') {
    const q = $('#q').value.trim().toLowerCase()
    $('#detail').innerHTML = ''
    picked = null
    if (!q) return
    let found = []
    try { found = await findUsers(q) } catch (err) { $('#found').innerHTML = `<p class="dim">찾지 못했습니다: ${esc(err.code || err.message)}</p>`; return }
    if (!found.length) { $('#found').innerHTML = '<p class="dim">찾는 사용자가 없습니다. 이메일 앞부분으로 찾습니다.</p>'; return }
    if (found.length === 1) { $('#found').innerHTML = ''; return showUser(found[0].uid) }
    $('#found').innerHTML = `<ul class="list" style="margin-top:10px">${found.map((u) => `<li class="tap" data-pick="${esc(u.uid)}"><div class="m"><p>${esc(u.email)}${plat(u.platform)}</p><small>마지막 접속 ${fmt(u.updatedAt)}</small></div></li>`).join('')}</ul>`
    return
  }
  if (act === 'gift') {
    const ct = num($('#gfCt').value)
    const rk = num($('#gfRk').value)
    const msg = $('#gfMsg')
    if (!ct && !rk) { msg.textContent = '보낼 양을 넣어 주세요.'; return }
    if (DEMO) { msg.textContent = '예시 화면이라 보내지 않았습니다.'; return }
    t.disabled = true
    try {
      const { db, F, auth } = fb
      await F.addDoc(F.collection(db, 'gifts'), { uid: t.dataset.uid, stones: rk, crystals: ct, note: $('#gfNote').value.trim().slice(0, 100), claimed: false, at: F.serverTimestamp(), by: auth.currentUser.uid })
      await showUser(t.dataset.uid)
      $('#gfMsg').textContent = `보냈습니다: 크리스탈 ${ct} · 천연석 ${rk}`
    } catch (err) { msg.textContent = '보내지 못했습니다: ' + (err.code || err.message) } finally { t.disabled = false }
    return
  }
  if (act === 'coupon') {
    const code = $('#cpCode').value.trim().toUpperCase()
    const msg = $('#cpMsg')
    if (!/^[A-Z0-9]{3,30}$/.test(code)) { msg.textContent = '코드는 대문자·숫자 3~30자로 넣어 주세요.'; return }
    const v = { crystals: Math.max(0, num($('#cpCt').value)), stones: Math.max(0, num($('#cpRk').value)), maxUses: Math.max(1, num($('#cpMax').value)), uses: 0, active: true }
    if (!v.crystals && !v.stones) { msg.textContent = '크리스탈이나 천연석을 넣어 주세요.'; return }
    if (data.coupons.some((c) => c.code === code)) { msg.textContent = '이미 있는 코드입니다.'; return }
    if (DEMO) { msg.textContent = '예시 화면이라 만들지 않았습니다.'; return }
    try {
      const { db, F } = fb
      await F.setDoc(F.doc(db, 'coupons', code), v)
      data.coupons.push({ code, ...v }); data.coupons.sort((x, y) => x.code.localeCompare(y.code))
      draw(); $('#cpMsg').textContent = `쿠폰 ${code} 를 만들었습니다.`
    } catch (err) { msg.textContent = '만들지 못했습니다: ' + (err.code || err.message) }
    return
  }
  if (act === 'toggle') {
    const on = t.dataset.on === '1'
    if (!DEMO) {
      try { const { db, F } = fb; await F.updateDoc(F.doc(db, 'coupons', t.dataset.code), { active: on }) } catch (err) { alert('바꾸지 못했습니다: ' + (err.code || err.message)); return }
    }
    const c = data.coupons.find((x) => x.code === t.dataset.code)
    if (c) c.active = on
    draw()
  }
})
root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'q') $('[data-act=find]').click() })

// ---------- 로그인 ----------
function loginCard(note = '') {
  root.innerHTML = `<div class="card center"><p>관리자 계정으로 로그인해 주세요.</p>${note}<button id="in" class="btn full" type="button">Google 계정으로 로그인</button></div>`
  $('#in').onclick = async () => {
    const { auth, A } = fb
    const p = new A.GoogleAuthProvider()
    try { await A.signInWithPopup(auth, p) } catch (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') return A.signInWithRedirect(auth, p)
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') loginCard(`<p class="msg">로그인하지 못했습니다: ${esc(err.code || err.message)}</p>`)
    }
  }
}

function notAdmin(user) {
  root.innerHTML = `<div class="card"><p>이 계정에는 관리자 권한이 없습니다.</p>
<div class="box"><p><b>관리자로 등록하는 방법</b> (Firebase 콘솔에서 한 번만)</p>
<p>Firestore Database → 데이터 → 컬렉션 <code>admins</code> → 문서 ID에 아래 계정 ID → 필드 <code>role</code> (string) = <code>owner</code> → 저장. 그다음 이 화면을 새로고침하세요.</p>
<p>${esc(user.email)}<br><code>${esc(user.uid)}</code></p></div></div>`
}

async function start() {
  if (DEMO) return demo()
  try { fb = await loadFirebase() } catch (e) {
    root.innerHTML = `<div class="card center">Firebase 를 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.<p class="dim">${esc(e.message)}</p></div>`
    return
  }
  const { auth, A, db, F } = fb
  $('#out').onclick = () => A.signOut(auth)
  A.onAuthStateChanged(auth, async (user) => {
    $('#who').textContent = user ? user.email : '로그인이 필요합니다'
    $('#out').classList.toggle('hide', !user)
    if (!user) return loginCard()
    root.innerHTML = '<div class="card center">불러오는 중…</div>'
    let ok = false
    try { ok = (await F.getDoc(F.doc(db, 'admins', user.uid))).exists() } catch { ok = false }
    if (!ok) return notAdmin(user)
    try { await loadData() } catch (e) {
      root.innerHTML = `<div class="card">데이터를 불러오지 못했습니다. firestore.rules 를 최신으로 게시했는지 확인해 주세요.<p class="dim">${esc(e.code || e.message)}</p></div>`
      return
    }
    draw()
  })
}

// ?demo: 예시 데이터로 화면 확인
function demo() {
  $('#who').textContent = '예시 화면 (데이터는 가짜입니다)'
  const now = Date.now()
  const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
  const pick = (a) => a[r(0, a.length - 1)]
  for (let i = 0; i < 95; i++) {
    const all = r(130, 250)
    const d = { v_app: Math.round(all * 0.6), v_web: all - Math.round(all * 0.6), h: all + r(10, 60), signup: r(1, 12), tarot: r(60, 160), love: r(10, 40), pray: r(20, 60),
      ch_app: r(80, 140), ch_direct: r(30, 70), ch_search: r(5, 25), ch_sns: r(2, 12), src_search_Google: r(4, 15), src_search_Naver: r(1, 8), src_sns_Instagram: r(1, 8),
      c_KR: r(120, 200), c_JP: r(5, 20), c_US: r(2, 12), l_ko: r(120, 200), l_ja: r(5, 20), l_en: r(3, 15), dv_app: r(80, 140), dv_phone: r(40, 90), dv_pc: r(5, 20),
      p_home: r(120, 200), p_chambre: r(10, 40), p_love: r(5, 20), p_shop: r(5, 20),
      upd_latest: r(20, 60), upd_dl: r(0, 5), upd_set: r(0, 5), upd_err_rolled_back: r(0, 1), upd_run_202611202018_f84f84a: r(10, 40), upd_run_202611180950_0206a98: r(0, 10) }
    data.daily[dayKey(addDays(new Date(), -i))] = d
  }
  data.dailyOk = true
  const names = ['minji', 'sora', 'jh.park', 'yuna', 'kz.tanaka', 'haru', 'luna', 'momo', 'dae', 'seoyeon', 'ann', 'kim.h']
  const doms = ['gmail.com', 'naver.com', 'icloud.com']
  for (let i = 0; i < 60; i++) {
    const readings = {}
    for (let k = 0; k < r(0, 6); k++) readings[dayKey(addDays(new Date(), -r(0, 30)))] = [{ id: r(0, 21) }]
    const u = { uid: 'demo' + i, email: names[i % names.length] + (i > 11 ? i : '') + '@' + doms[i % 3], platform: i % 5 < 3 ? 'app' : 'web',
      createdAt: new Date(now - r(0, 40 * 24) * 3600000), updatedAt: new Date(now - r(0, 72) * 3600000), g: { crystals: i === 7 ? 480 : r(0, 30), stones: r(0, 300), readings, love: {} } }
    data.users[u.uid] = u
  }
  data.total = 1204
  const us = Object.values(data.users)
  for (let i = 0; i < 70; i++) {
    const product = pick(['pro02', 'pro02', 'pro01', 'pro01', 'pro03'])
    const u = pick(us)
    data.purchases.push({ uid: u.uid, email: u.email, product, price: { pro01: 3300, pro02: 9900, pro03: 1100 }[product], currency: 'KRW', at: new Date(now - r(0, 40 * 24) * 3600000) })
  }
  data.purchases.sort((a, b) => b.at - a.at)
  data.buysOk = true
  for (let i = 0; i < 30; i++) {
    const ch = pick(['app', 'app', 'direct', 'search', 'sns'])
    data.hits.push({ at: new Date(now - i * r(5, 40) * 60000), ch, src: ch === 'search' ? 'Google' : ch === 'sns' ? 'Instagram' : '', landing: pick(['home', 'home', 'chambre', 'love']),
      uid: i % 5 < 3 ? 'demo' + (i % 12) : '', country: 'KR', lang: 'ko-KR', device: 'phone', os: ch === 'app' ? 'Android' : pick(['Android', 'iOS']), browser: ch === 'app' ? 'app' : 'Chrome', first: i % 3 === 0, views: r(1, 9) })
  }
  data.hitsOk = true
  data.coupons = [{ code: 'WELCOME2026', crystals: 3, stones: 0, uses: 41, maxUses: 100, active: true }, { code: 'LEELMELL1117', crystals: 3, stones: 0, uses: 100, maxUses: 100, active: false }]
  draw()
}

start()
