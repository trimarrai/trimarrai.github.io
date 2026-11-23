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
// 타자 효과: 한 단어씩 보여 준다 (자리는 미리 잡아 두어 줄이 흔들리지 않음)
function prepType(el) {
  if (el._words) return
  var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), ns = [], n
  while ((n = w.nextNode())) ns.push(n)
  el._words = []; el._spans = []; var wi = 0, gap = true
  ns.forEach(function (nd) {
    if (nd.nodeType === 1) { if (nd.tagName === 'BR') gap = true; return }
    var frag = document.createDocumentFragment()
    Array.from(nd.nodeValue).forEach(function (c) {
      var s = document.createElement('span'); s.textContent = c
      if (!c.trim()) { gap = true; s._w = -1 }
      else { if (gap) { wi++; gap = false } s._w = wi; s.style.visibility = 'hidden'; el._spans.push(s) }
      frag.appendChild(s)
    })
    nd.parentNode.replaceChild(frag, nd)
  })
  el._n = wi
  el._marks = Array.from(el.querySelectorAll('.mk'))
}
// sel의 단어를 a초부터 초당 wps 단어로 보여 준다. 끝나는 시각을 돌려준다
function type(sel, t, a, wps) {
  wps = wps || 3.5; var end = a
  $(sel).forEach(function (el) {
    prepType(el); el.style.opacity = 1
    var k = Math.max(0, Math.floor((t - a) * wps))
    el._spans.forEach(function (s) { s.style.visibility = s._w <= k ? 'visible' : 'hidden' })
    // 노란 강조: 안의 단어가 나온 만큼 왼쪽부터 칠해짐
    el._marks.forEach(function (m) {
      var cs = el._spans.filter(function (s) { return m.contains(s) }), v = cs.filter(function (s) { return s._w <= k }).length
      m.style.clipPath = 'inset(0 ' + (cs.length ? 100 - 100 * v / cs.length : 0) + '% 0 0)'
    })
    end = Math.max(end, a + el._n / wps)
  })
  return end
}
