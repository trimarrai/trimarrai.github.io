// 4각 별 반짝이 [x, y, 크기, 색] · 점 [x, y, 반지름, 색]
function sparkles(list, dots){
  var f=document.getElementById('frame'), P='M5 0Q5.6 4.4 10 5Q5.6 5.6 5 10Q4.4 5.6 0 5Q4.4 4.4 5 0z', h=''
  list.forEach(function(s){h+='<svg class="s" style="left:'+s[0]+'px;top:'+s[1]+'px" width="'+s[2]+'" height="'+s[2]+'" viewBox="0 0 10 10"><path d="'+P+'" fill="'+s[3]+'"/></svg>'})
  h+='<svg class="s" style="left:0;top:0" width="1080" height="1920">'
  ;(dots||[]).forEach(function(d){h+='<circle cx="'+d[0]+'" cy="'+d[1]+'" r="'+d[2]+'" fill="'+d[3]+'"/>'})
  f.insertAdjacentHTML('afterbegin',h+'</svg>')
}
