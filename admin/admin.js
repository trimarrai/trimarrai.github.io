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
let fb = null // Firebase 함수 모음
let data = { users: [], visits: {}, coupons: [], hits: [] }
let tab = 'visit'
const range = { visit: 14, join: 14 }
const shown = { visit: 10, join: 10, recent: 20 }
let picked = null // 사용자 탭에서 보고 있는 사용자

async function loadFirebase() {
  const [app, auth, fs] = await Promise.all([
    import('./fb/firebase-app.js'),
    import('./fb/firebase-auth.js'),
    import('./fb/firebase-firestore-lite.js'),
  ])
  const a = app.initializeApp(CONFIG)
  return { auth: auth.getAuth(a), db: fs.getFirestore(a), A: auth, F: fs }
}

async function loadData() {
  const { db, F } = fb
  const [us, vs] = await Promise.all([F.getDocs(F.collection(db, 'users')), F.getDocs(F.collection(db, 'visits')).catch(() => null)])
  data.users = us.docs.map((d) => {
    const v = d.data()
    return { uid: d.id, email: v.email || '', g: v.g || {}, platform: v.platform || '', updatedAt: v.updatedAt?.toDate?.() || null, createdAt: v.createdAt?.toDate?.() || null }
  })
  data.visits = {}
  if (vs) for (const d of vs.docs) data.visits[d.id] = { app: num(d.data().app), web: num(d.data().web) }
  data.visitsOk = !!vs
  try {
    const since = F.Timestamp.fromDate(addDays(new Date(), -30))
    const hs = await F.getDocs(F.query(F.collection(db, 'hits'), F.where('at', '>=', since), F.orderBy('at', 'desc'), F.limit(3000)))
    data.hits = hs.docs.map((d) => ({ ...d.data(), at: d.data().at?.toDate?.() || null })).filter((h) => h.at)
    data.hitsOk = true
  } catch { data.hits = []; data.hitsOk = false }
  try {
    const cs = await F.getDocs(F.collection(db, 'coupons'))
    data.coupons = cs.docs.map((d) => ({ code: d.id, ...d.data() })).sort((x, y) => x.code.localeCompare(y.code))
  } catch { data.coupons = [] }
}

// ---------- 계산 ----------
const firstDay = (g) => Object.keys({ ...(g.readings || {}), ...(g.love || {}) }).sort()[0] || null
const joinedAt = (u) => (u.createdAt ? { d: u.createdAt, est: false } : firstDay(u.g) ? { d: new Date(firstDay(u.g) + 'T12:00:00'), est: true } : null)
const visitOf = (k) => { const v = data.visits[k] || { app: 0, web: 0 }; return { ...v, all: v.app + v.web } }
function todayDid(u, today) {
  const g = u.g || {}
  const start = new Date(today + 'T00:00:00').getTime()
  const out = []
  if (g.readings?.[today]) out.push('3장 타로')
  if (g.love?.[today]) out.push('연애 타로')
  if ((g.prayers || []).some((p) => p.at >= start)) out.push('기도')
  return out.join(' · ')
}
function series(n, valueOf) {
  const today = new Date()
  return [...Array(n).keys()].map((i) => { const d = addDays(today, i - n + 1); return { d, k: dayKey(d), v: valueOf(dayKey(d)) } })
}

// ---------- 그리기 ----------
function chartHtml(id, rows, unit) {
  const max = Math.max(1, ...rows.map((r) => r.v))
  const step = niceStep(max)
  const top = Math.max(step * Math.ceil(max / step), step)
  const H = 136
  const grid = [1, 2, 3, 4].map((i) => i * step).filter((v) => v <= top).map((v) => `<div class="g" style="bottom:${22 + (v / top) * H}px"><i>${v}</i></div>`).join('')
  const every = rows.length <= 14 ? 4 : rows.length <= 30 ? 7 : 30
  const bars = rows.map((r, i) => {
    const last = i === rows.length - 1
    const lbl = last ? '오늘' : (rows.length - 1 - i) % every === 0 ? `${r.d.getMonth() + 1}/${r.d.getDate()}` : ''
    return `<div class="c${last ? ' today' : ''}" data-chart="${id}" data-i="${i}" title="${r.k} · ${r.v}${unit}"><b style="height:${(r.v / top) * H}px"></b><em>${lbl}</em></div>`
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

function visitTab() {
  const today = dayKey()
  const t = visitOf(today)
  const y = visitOf(dayKey(addDays(new Date(), -1)))
  const diff = y.all ? Math.round(((t.all - y.all) / y.all) * 100) : null
  const week = series(7, (k) => visitOf(k).all).reduce((a, r) => a + r.v, 0)
  const loggedToday = data.users.filter((u) => u.updatedAt && dayKey(u.updatedAt) === today)
  const appPct = t.all ? Math.round((t.app / t.all) * 100) : 0
  const rows = series(range.visit, (k) => visitOf(k).all)
  const recent = data.users.filter((u) => u.updatedAt).sort((a, b) => b.updatedAt - a.updatedAt)
  return `<div class="card"><h2>접속 기록</h2>
<div class="kpi">
  <div><b>${won(t.all)}${diff === null ? '' : `<small>${diff >= 0 ? '+' : ''}${diff}%</small>`}</b><span>오늘 접속 (기기)</span></div>
  <div><b>${won(week)}</b><span>최근 7일 접속</span></div>
  <div><b>${won(loggedToday.length)}</b><span>오늘 로그인 사용자</span></div>
  <div><b>${t.all ? appPct + '%' : '-'}</b><span>${t.all ? `오늘 앱 · ${100 - appPct}% 웹` : '오늘 앱 · 웹 비율'}</span></div>
</div>
<p class="sub">하루 접속 <span>막대를 누르면 숫자</span></p>
${seg('visit')}${chartHtml('visit', rows, '대')}
<p class="sub">최근 접속한 사용자 <span>로그인한 사용자</span></p>
<ul class="list">${recent.slice(0, shown.visit).map((u) => `<li class="tap" data-user="${esc(u.uid)}"><div class="m"><p>${esc(mask(u.email))}${plat(u.platform)}</p><small>${esc(todayDid(u, dayKey(u.updatedAt)) || '둘러보기')}</small></div><div class="r">${ago(u.updatedAt)}</div></li>`).join('') || '<li class="empty">아직 없습니다</li>'}</ul>
${recent.length > shown.visit ? '<button type="button" class="btn ghost full" data-more="visit">더 보기</button>' : ''}
<p class="dim">${data.visitsOk ? '기기 수는 로그인하지 않은 사람까지 하루 한 번씩 셉니다. 기록은 이 기능을 넣은 날부터 쌓입니다.' : '접속 수를 읽지 못했습니다. firestore.rules 를 최신으로 게시했는지 확인해 주세요.'}</p></div>`
}

function joinTab() {
  const now = new Date()
  const today = dayKey()
  const month = today.slice(0, 7)
  const exact = data.users.filter((u) => u.createdAt)
  const todayN = exact.filter((u) => dayKey(u.createdAt) === today).length
  const monthN = exact.filter((u) => dayKey(u.createdAt).startsWith(month)).length
  // 가입하고 7~14일 지난 사람 중, 가입 7일 뒤에도 들어온 비율
  const cohort = exact.filter((u) => { const a = (now - u.createdAt) / 86400000; return a >= 7 && a < 14 })
  const back = cohort.filter((u) => u.updatedAt && u.updatedAt - u.createdAt >= 7 * 86400000).length
  const perDay = {}
  for (const u of exact) { const k = dayKey(u.createdAt); perDay[k] = (perDay[k] || 0) + 1 }
  const rows = series(range.join, (k) => perDay[k] || 0)
  const list = data.users.map((u) => ({ u, j: joinedAt(u) })).filter((x) => x.j).sort((a, b) => b.j.d - a.j.d)
  return `<div class="card"><h2>신규 가입</h2>
<div class="kpi">
  <div><b>${won(todayN)}</b><span>오늘 가입</span></div>
  <div><b>${won(monthN)}</b><span>${now.getMonth() + 1}월 가입</span></div>
  <div><b>${won(data.users.length)}</b><span>전체 가입자</span></div>
  <div><b>${cohort.length ? Math.round((back / cohort.length) * 100) + '%' : '-'}</b><span>가입 7일 뒤에도 접속</span></div>
</div>
<p class="sub">하루 가입 <span>막대를 누르면 숫자</span></p>
${seg('join')}${chartHtml('join', rows, '명')}
<p class="sub">새로 가입한 사용자</p>
<ul class="list">${list.slice(0, shown.join).map(({ u, j }) => `<li class="tap" data-user="${esc(u.uid)}"><div class="m"><p>${esc(mask(u.email))}${plat(u.platform)}${j.est ? '<span class="pill est">추정</span>' : ''}</p><small>가입 ${j.est ? md(j.d) : fmt(j.d)} · 크리스탈 ${num(u.g.crystals)}</small></div><div class="r">타로 ${Object.keys(u.g.readings || {}).length}회</div></li>`).join('') || '<li class="empty">아직 없습니다</li>'}</ul>
${list.length > shown.join ? '<button type="button" class="btn ghost full" data-more="join">더 보기</button>' : ''}
<p class="dim">이전에 가입한 사용자는 가입 날짜가 저장돼 있지 않아, 처음 타로를 본 날로 대신 표시합니다(추정). 오늘·이번 달 가입과 그래프는 정확한 가입 시간이 있는 사용자만 셉니다.</p></div>`
}

// ---------- 방문 기록 (hits) ----------
const CH = { app: '안드로이드 앱', direct: '직접 방문', search: '검색', sns: 'SNS', site: '다른 사이트' }
const PAGE = { home: '홈', chambre: '릴멜의 방', cards: '릴멜의 카드', love: '율리움의 방', lovecards: '율리움의 카드', shop: '상점', depot: '창고',
  lab: '실험실', prayroom: '기도실', parking: '뒷마당', locker: '사물함', intro: '소개', admin: '관리자' }
const COUNTRY = { KR: '대한민국', JP: '일본', US: '미국', CN: '중국', TW: '대만', HK: '홍콩', SG: '싱가포르', TH: '태국', VN: '베트남', PH: '필리핀', ID: '인도네시아',
  MY: '말레이시아', IN: '인도', AE: '아랍에미리트', AU: '호주', NZ: '뉴질랜드', GB: '영국', FR: '프랑스', DE: '독일', ES: '스페인', IT: '이탈리아', NL: '네덜란드',
  RU: '러시아', CA: '캐나다', BR: '브라질', MX: '멕시코' }
const DEVICE = { phone: '폰', tablet: '태블릿', pc: 'PC' }
const LANG = { ko: '한국어', ja: '日本語', en: 'English', zh: '中文' }
const chName = (h) => CH[h.ch] + (h.src ? ' · ' + h.src : '')
const pageName = (k) => PAGE[k] || k || '-'
const countryName = (c) => (c ? `${COUNTRY[c] || c} (${c})` : '알 수 없음')
const langName = (l) => LANG[String(l).slice(0, 2)] || l || '알 수 없음'
const when = (d) => `${md(d)} ${d.getHours() < 12 ? '오전' : '오후'} ${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())}`
const hitsNote = () => (data.hitsOk ? '' : '<p class="dim">방문 기록을 읽지 못했습니다. firestore.rules 를 최신으로 게시했는지 확인해 주세요.</p>')

function recentTab() {
  const list = data.hits.slice(0, shown.recent)
  return `<div class="card"><h2>최근 방문</h2>
${list.map((h) => `<div class="hit"><div class="top"><span>${when(h.at)}</span><span>${num(h.views) || 1}화면</span></div>
<p class="ch">${esc(chName(h))}</p><p class="lp">첫 화면 ${esc(pageName(h.landing))}</p>
<p class="env">${esc([h.country || '?', h.lang, DEVICE[h.device], h.os, h.browser === 'app' ? '앱' : h.browser, h.first ? '첫 방문' : '다시 방문'].filter(Boolean).join(' · '))}</p></div>`).join('') || '<p class="dim">아직 기록이 없습니다. 기록은 이 기능을 넣은 날부터 쌓입니다.</p>'}
${data.hits.length > shown.recent ? '<button type="button" class="btn ghost full" data-more="recent">더 보기</button>' : ''}${hitsNote()}</div>`
}

function bars(title, keyOf) {
  const cnt = new Map()
  for (const h of data.hits) { const k = keyOf(h); if (k) cnt.set(k, (cnt.get(k) || 0) + 1) }
  const rows = [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const total = rows.reduce((a, r) => a + r[1], 0)
  const max = rows[0]?.[1] || 1
  return `<div class="card"><h2>${title}</h2>${rows.length ? `<ul class="bars">${rows.map(([n, v]) => `<li><div class="lbl"><i style="width:${(v / max) * 100}%"></i><span>${esc(n)}</span></div><b>${won(v)}</b><em>${Math.round((v / total) * 100)}%</em></li>`).join('')}</ul>` : '<p class="dim">기록이 없습니다.</p>'}<p class="unit">단위: 방문 · 최근 30일</p></div>`
}

function inflowTab() {
  return bars('유입 채널', (h) => CH[h.ch]) +
    bars('유입 출처', (h) => (h.src ? `${CH[h.ch]} · ${h.src}` : '')) +
    bars('첫 화면', (h) => pageName(h.landing)) +
    bars('국가(추정)', (h) => countryName(h.country)) +
    bars('언어', (h) => langName(h.lang)) +
    bars('기기 · 웹/앱', (h) => (h.ch === 'app' ? '안드로이드 앱' : `${DEVICE[h.device] || ''} 웹`)) +
    hitsNote()
}

function stats() {
  const today = dayKey()
  const cutoff = dayKey(addDays(new Date(), -29))
  const weekAgo = Date.now() - 7 * 86400000
  const start = new Date(today + 'T00:00:00').getTime()
  const cnt = new Array(22).fill(0)
  const s = { active7: 0, tarotToday: 0, loveToday: 0, prayToday: 0, tarot30: 0, crystals: 0, stones: 0 }
  for (const u of data.users) {
    const g = u.g || {}
    s.crystals += num(g.crystals); s.stones += num(g.stones)
    if (u.updatedAt && u.updatedAt.getTime() > weekAgo) s.active7++
    if (g.readings?.[today]) s.tarotToday++
    if (g.love?.[today]) s.loveToday++
    s.prayToday += (g.prayers || []).filter((p) => p.at >= start).length
    for (const [d, cards] of Object.entries(g.readings || {})) {
      if (d < cutoff) continue
      s.tarot30++
      for (const c of cards || []) if (c && c.id >= 0 && c.id < 22) cnt[c.id]++
    }
  }
  s.top = cnt.map((n, id) => ({ id, n })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 5)
  return s
}

function userTab() {
  const s = stats()
  return `<div class="card"><h2>이용 통계 <small>로그인한 사용자 기준</small></h2>
<div class="kpi">
  <div><b>${won(s.tarotToday)}</b><span>오늘 3장 타로</span></div>
  <div><b>${won(s.loveToday)}</b><span>오늘 연애 타로</span></div>
  <div><b>${won(s.prayToday)}</b><span>오늘 기도 수</span></div>
  <div><b>${won(s.active7)}</b><span>최근 7일 접속</span></div>
</div>
<p class="dim">30일 3장 타로 ${won(s.tarot30)}번 · 많이 나온 카드: ${s.top.map((c) => `${CARD_NAMES[c.id]} ${c.n}`).join(' · ') || '없음'}</p>
<p class="dim">가입자 전체 잔고: 크리스탈 ${won(s.crystals)} · 천연석 ${won(s.stones)}</p></div>
<div class="card"><h2>사용자 찾기 · 재화 지급</h2>
<div class="row"><input id="q" type="search" placeholder="이메일 (일부만 넣어도 찾습니다)" autocomplete="off"><button class="btn" type="button" data-act="find">찾기</button></div>
<div id="found"></div><div id="detail"></div></div>`
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
  visit: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  join: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6"/>',
  recent: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  inflow: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  user: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-6"/>',
  coupon: '<path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z"/><path d="M14 7v12" stroke-dasharray="2 2"/>',
}
function draw() {
  const tabs = [['visit', '접속'], ['join', '가입'], ['recent', '최근'], ['inflow', '유입'], ['user', '사용자'], ['coupon', '쿠폰']]
  root.innerHTML = `<nav class="tabs">${tabs.map(([k, n]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg><span>${n}</span></button>`).join('')}</nav>` +
    ({ visit: visitTab, join: joinTab, recent: recentTab, inflow: inflowTab, user: userTab, coupon: couponTab })[tab]()
  if (tab === 'user' && picked) showUser(picked)
}

async function showUser(uid) {
  const u = data.users.find((x) => x.uid === uid)
  const box = $('#detail')
  if (!u || !box) return
  picked = uid
  const g = u.g || {}
  const days = Object.keys(g.readings || {}).sort()
  const j = joinedAt(u)
  box.innerHTML = `<div class="box">
<p><b>${esc(u.email || '(이메일 없음)')}</b>${plat(u.platform)}<br><code>${esc(u.uid)}</code></p>
<p>크리스탈 <b>${num(g.crystals)}</b> · 천연석 <b>${num(g.stones)}</b></p>
<p class="dim" style="margin:0 0 6px">가입 ${j ? (j.est ? md(j.d) + ' (추정)' : fmt(j.d)) : '-'} · 마지막 접속 ${fmt(u.updatedAt)}<br>3장 타로 ${days.length}번 (마지막 ${days[days.length - 1] || '-'}) · 연애 타로 ${Object.keys(g.love || {}).length}번</p>
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
  const t = e.target.closest('[data-tab],[data-range],[data-more],[data-user],[data-chart],[data-act]')
  if (!t) return
  if (t.dataset.tab) { tab = t.dataset.tab; draw(); window.scrollTo(0, 0); return }
  if (t.dataset.range) { range[t.dataset.range] = +t.dataset.n; draw(); return }
  if (t.dataset.more) { shown[t.dataset.more] += 20; draw(); return }
  if (t.dataset.user) { tab = 'user'; picked = t.dataset.user; draw(); $('#detail')?.scrollIntoView({ block: 'start' }); return }
  if (t.dataset.chart) {
    const ch = t.closest('.chart')
    ch.querySelectorAll('.c.sel').forEach((x) => x.classList.remove('sel'))
    ch.querySelector('.tip')?.remove()
    t.classList.add('sel')
    ch.insertAdjacentHTML('beforeend', `<span class="tip">${esc(t.title)}</span>`)
    return
  }
  const act = t.dataset.act
  if (act === 'find') {
    const q = $('#q').value.trim().toLowerCase()
    const found = data.users.filter((u) => q && u.email.toLowerCase().includes(q))
    $('#detail').innerHTML = ''
    picked = null
    if (!found.length) { $('#found').innerHTML = '<p class="dim">찾는 사용자가 없습니다. 로그인한 적이 있는 사용자만 보입니다.</p>'; return }
    if (found.length === 1) { $('#found').innerHTML = ''; return showUser(found[0].uid) }
    $('#found').innerHTML = `<ul class="list" style="margin-top:10px">${found.slice(0, 30).map((u) => `<li class="tap" data-pick="${esc(u.uid)}"><div class="m"><p>${esc(u.email)}${plat(u.platform)}</p><small>마지막 접속 ${fmt(u.updatedAt)}</small></div></li>`).join('')}</ul>`
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
root.addEventListener('click', (e) => { const p = e.target.closest('[data-pick]'); if (p) { $('#found').innerHTML = ''; showUser(p.dataset.pick) } })
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
  for (let i = 0; i < 95; i++) { const d = dayKey(addDays(new Date(), -i)); const all = r(130, 250); const app = Math.round(all * 0.6); data.visits[d] = { app, web: all - app } }
  data.visitsOk = true
  const names = ['minji', 'sora', 'jh.park', 'yuna', 'kz.tanaka', 'haru', 'luna', 'momo', 'dae', 'seoyeon', 'ann', 'kim.h']
  const doms = ['gmail.com', 'naver.com', 'icloud.com']
  for (let i = 0; i < 60; i++) {
    const created = i < 45 ? new Date(now - r(0, 40 * 24) * 3600000) : null
    const upd = new Date(now - r(0, 72) * 3600000)
    const readings = {}
    for (let k = 0; k < r(0, 6); k++) readings[dayKey(addDays(new Date(), -r(0, 30)))] = [{ id: r(0, 21) }, { id: r(0, 21) }, { id: r(0, 21) }]
    if (i % 3 === 0) readings[dayKey()] = [{ id: r(0, 21) }, { id: r(0, 21) }, { id: r(0, 21) }]
    data.users.push({ uid: 'demo' + i, email: names[i % names.length] + (i > 11 ? i : '') + '@' + doms[i % 3], platform: i % 5 < 3 ? 'app' : 'web', createdAt: created, updatedAt: upd, g: { crystals: r(0, 12), stones: r(0, 300), readings, love: i % 4 === 0 ? { [dayKey()]: {} } : {}, prayers: [] } })
  }
  const pick = (a) => a[r(0, a.length - 1)]
  for (let i = 0; i < 400; i++) {
    const ch = pick(['app', 'app', 'app', 'direct', 'direct', 'search', 'sns', 'site'])
    const src = ch === 'search' ? pick(['Google', 'Google', 'Naver', 'Daum']) : ch === 'sns' ? pick(['Instagram', 'X', 'Kakao']) : ch === 'site' ? 'blog.example.com' : ''
    const c = pick(['KR', 'KR', 'KR', 'KR', 'JP', 'US', 'TW'])
    data.hits.push({ at: new Date(now - i * r(20, 90) * 60000), ch, src, landing: pick(['home', 'home', 'home', 'chambre', 'love', 'shop']), country: c,
      lang: { KR: 'ko-KR', JP: 'ja-JP', US: 'en-US', TW: 'zh-TW' }[c], device: ch === 'app' ? 'phone' : pick(['phone', 'phone', 'pc']), os: ch === 'app' ? 'Android' : pick(['Android', 'iOS', 'Windows']),
      browser: ch === 'app' ? 'app' : pick(['Chrome', 'Safari', 'Samsung']), first: i % 3 === 0, views: r(1, 9) })
  }
  data.hits.sort((a, b) => b.at - a.at)
  data.hitsOk = true
  data.coupons = [{ code: 'WELCOME2026', crystals: 3, stones: 0, uses: 41, maxUses: 100, active: true }, { code: 'LEELMELL1117', crystals: 3, stones: 0, uses: 100, maxUses: 100, active: false }]
  draw()
}

start()
