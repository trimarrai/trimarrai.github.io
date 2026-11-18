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
