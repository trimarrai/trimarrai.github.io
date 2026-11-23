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
// 한 줄씩 등장: 줄(<br> 기준)이 통째로 스르륵 나타나고, 앞줄을 읽을 시간만큼 뒤에 다음 줄이 나온다
function prepType(el) {
  if (el._chars) return
  var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), ns = [], n
  while ((n = w.nextNode())) ns.push(n)
  el._chars = []; el._len = [0]; var li = 0
  ns.forEach(function (nd) {
    if (nd.nodeType === 1) { if (nd.tagName === 'BR') { li++; el._len[li] = 0 } return }
    var frag = document.createDocumentFragment()
    Array.from(nd.nodeValue).forEach(function (c) {
      var s = document.createElement('span'); s.textContent = c; s._l = li; frag.appendChild(s); el._chars.push(s)
      if (c.trim()) el._len[li]++
    })
    nd.parentNode.replaceChild(frag, nd)
  })
  el._marks = Array.from(el.querySelectorAll('.mk')).map(function (m) { return [m, getComputedStyle(m).backgroundColor] })
}
var LFADE = .45   // 한 줄이 나타나는 데 걸리는 시간
// sel의 줄을 a초부터 차례로 보여 준다. 다음 줄은 앞줄 글자 수 ÷ cps초 뒤. 끝나는 시각(마지막 줄까지 읽은 시각)을 돌려준다
function type(sel, t, a, cps) {
  cps = cps || 10; var end = a
  $(sel).forEach(function (el) {
    prepType(el)
    var st = [], acc = a
    el._len.forEach(function (n, i) { st[i] = acc; acc += Math.max(.6, n / cps) })
    var al = function (l) { return E.out(E.p(t, st[l], st[l] + LFADE)) }
    el.style.opacity = al(0)
    el._chars.forEach(function (s) { s.style.opacity = al(s._l) })
    el._marks.forEach(function (mc) {
      var c = el._chars.filter(function (s) { return mc[0].contains(s) })[0], f = c ? al(c._l) : 1
      mc[0].style.backgroundColor = 'color-mix(in srgb, ' + mc[1] + ' ' + Math.round(f * 100) + '%, transparent)'
    })
    end = Math.max(end, acc)
  })
  return end
}
