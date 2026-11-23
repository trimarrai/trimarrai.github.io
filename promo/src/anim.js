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
// 타자 효과: 글자를 한 글자씩 보여 준다 (자리는 미리 잡아 두어 줄이 흔들리지 않음)
function prepType(el) {
  if (el._chars) return
  var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), ns = [], n
  while ((n = w.nextNode())) ns.push(n)
  el._chars = []
  ns.forEach(function (tn) {
    var frag = document.createDocumentFragment()
    Array.from(tn.nodeValue).forEach(function (c) {
      var s = document.createElement('span'); s.textContent = c; s.style.visibility = 'hidden'
      frag.appendChild(s); if (c.trim()) el._chars.push(s)
    })
    tn.parentNode.replaceChild(frag, tn)
  })
  el._marks = Array.from(el.querySelectorAll('.mk'))
}
// sel의 글자를 a초부터 초당 cps 글자로 보여 준다. 끝나는 시각을 돌려준다
function type(sel, t, a, cps) {
  cps = cps || 12; var end = a
  $(sel).forEach(function (el) {
    prepType(el); el.style.opacity = 1
    var all = el.querySelectorAll('span'), k = Math.max(0, Math.floor((t - a) * cps))
    el._chars.forEach(function (s, i) { s.style.visibility = i < k ? 'visible' : 'hidden' })
    all.forEach(function (s) { if (!s.textContent.trim() && !s.children.length) s.style.visibility = 'visible' })
    // 노란 강조: 안의 글자가 나온 만큼 왼쪽부터 칠해짐
    el._marks.forEach(function (m) {
      var cs = el._chars.filter(function (s) { return m.contains(s) }), v = cs.filter(function (s) { return s.style.visibility == 'visible' }).length
      m.style.clipPath = 'inset(0 ' + (cs.length ? 100 - 100 * v / cs.length : 0) + '% 0 0)'
    })
    end = Math.max(end, a + el._chars.length / cps)
  })
  return end
}
