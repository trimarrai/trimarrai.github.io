// 릴스 애니메이션: seek(t)로 t초 시점의 모습을 그린다 (프레임 단위 캡처용)
var E = {
  clamp: function (x) { return x < 0 ? 0 : x > 1 ? 1 : x },
  p: function (t, a, b) { return E.clamp((t - a) / (b - a)) },                 // a~b초 구간 진행도 0→1
  out: function (x) { return 1 - Math.pow(1 - x, 3) },
  back: function (x) { var c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }
}
function $(s) { return document.querySelectorAll(s) }
function set(sel, st) { $(sel).forEach(function (el) { for (var k in st) el.style[k] = st[k] }) }
function pop(sel, t, a, d) { var x = E.p(t, a, a + (d || .45)); set(sel, { opacity: x > 0 ? 1 : 0, scale: String(E.back(x)) }) }
function rise(sel, t, a, d) { var x = E.out(E.p(t, a, a + (d || .5))); set(sel, { opacity: x, translate: '0 ' + (1 - x) * 60 + 'px' }) }
function common(t) {
  // 반짝이: 각자 다른 박자로 깜빡 · 릴멜: 둥실둥실
  $('svg.s').forEach(function (el, i) { if (el.getAttribute('width') == 1080) return; var k = .75 + .25 * Math.sin(t * 4 + i * 1.7); el.style.scale = k; el.style.rotate = Math.sin(t * 2 + i) * 12 + 'deg' })
  set('.octo', { translate: '0 ' + Math.sin(t * 3.2) * 14 + 'px', rotate: Math.sin(t * 1.6) * 3 + 'deg' })
}
window.seek = function (t) { common(t); window.ANIM && window.ANIM(t) }
// 노래방 자막: 줄 전체가 흐리게 먼저 보이고, 글자가 왼쪽부터 일정한 속도로 진하게 채워진다
function prepType(el) {
  if (el._chars) return
  var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), ns = [], n
  while ((n = w.nextNode())) ns.push(n)
  el._chars = []
  ns.forEach(function (tn) {
    var frag = document.createDocumentFragment()
    Array.from(tn.nodeValue).forEach(function (c) {
      if (!c.trim()) { frag.appendChild(document.createTextNode(c)); return }
      var s = document.createElement('span'); s.textContent = c; frag.appendChild(s); el._chars.push(s)
    })
    tn.parentNode.replaceChild(frag, tn)
  })
  el._marks = Array.from(el.querySelectorAll('.mk')).map(function (m) { return [m, getComputedStyle(m).backgroundColor] })
}
var DIM = .22, SOFT = .18   // 채우기 전 흐린 정도, 한 글자가 진해지는 데 걸리는 시간
// sel을 a초부터 초당 cps 글자로 채운다. 줄은 a-0.3초에 흐리게 먼저 나타난다. 끝나는 시각을 돌려준다
function type(sel, t, a, cps) {
  cps = cps || 9; var end = a
  $(sel).forEach(function (el) {
    prepType(el)
    el.style.opacity = E.out(E.p(t, a - .3, a))
    var lit = function (i) { return E.p(t, a + i / cps, a + i / cps + SOFT) }
    el._chars.forEach(function (s, i) { s.style.opacity = DIM + (1 - DIM) * lit(i) })
    el._marks.forEach(function (mc) {
      var m = mc[0], idx = el._chars.filter(function (s) { return m.contains(s) }).map(function (s) { return el._chars.indexOf(s) })
      var f = idx.length ? lit(idx[idx.length - 1]) * .5 + lit(idx[0]) * .5 : 1
      m.style.backgroundColor = 'color-mix(in srgb, ' + mc[1] + ' ' + Math.round(f * 100) + '%, transparent)'
    })
    end = Math.max(end, a + el._chars.length / cps + SOFT)
  })
  return end
}
