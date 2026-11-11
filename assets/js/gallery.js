/* RASYANCUT — 갤러리 창 */
(function () {
  'use strict';
  var D = window.RSC_DATA.gallery, RSC = window.RSC, esc = RSC.esc;
  var $ = function (s) { return document.querySelector(s); };
  var lb = $('[data-lb]'), cur = -1, last = null;

  $('[data-count]').textContent = String(D.length).padStart(2, '0');
  $('[data-lb-prev]').innerHTML = RSC.chev(-1); $('[data-lb-next]').innerHTML = RSC.chev(1);
  $('[data-frames]').innerHTML = D.map(function (a, i) {
    return '<li style="--i:' + i + '"><button data-open="' + i + '" aria-label="작품 ' + a.id + ' 크게 보기">' +
      '<div class="slot" style="aspect-ratio:' + a.ratio + '">' + (a.image ? '<img src="' + esc(a.image) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '<span>' + a.code + '<br>EMPTY</span>') + '</div>' +
      '<div class="cap"><span class="mono gold">' + a.code + '</span><strong>' + esc(a.title || '제목 미등록') + '</strong></div></button></li>';
  }).join('');

  function show(i, swap) {
    cur = (i + D.length) % D.length;
    var a = D[cur], slot = $('[data-lb-slot]');
    var r = a.ratio.split('/'), ratio = r[0] / r[1];
    var maxW = slot.parentNode.clientWidth, maxH = innerHeight * (innerWidth <= 900 ? .58 : .7), w = Math.min(maxW, maxH * ratio);
    slot.style.width = Math.round(w) + 'px'; slot.style.height = Math.round(w / ratio) + 'px';
    slot.innerHTML = a.image ? '<img src="' + esc(a.image) + '" alt="' + esc(a.title) + '">' : '<span>' + a.code + '<br>EMPTY</span>';
    RSC.scramble($('[data-lb-code]'), a.code, 800);
    $('[data-lb-title]').textContent = a.title || '제목 미등록';
    $('[data-lb-count]').textContent = a.id + ' / ' + String(D.length).padStart(2, '0');
    history.replaceState(null, '', '#a=' + a.id);
    if (swap) { lb.classList.remove('is-swap'); void lb.offsetWidth; lb.classList.add('is-swap'); }
  }
  function open(i) { last = document.activeElement; lb.hidden = false; document.body.style.overflow = 'hidden'; show(i); $('[data-lb-close]').focus(); }
  function close() { lb.hidden = true; document.body.style.overflow = ''; cur = -1; history.replaceState(null, '', location.pathname); if (last) last.focus(); }

  $('[data-frames]').addEventListener('click', function (e) { var b = e.target.closest('[data-open]'); if (b) open(+b.dataset.open); });
  $('[data-lb-close]').addEventListener('click', close);
  $('[data-lb-prev]').addEventListener('click', function () { show(cur - 1, true); });
  $('[data-lb-next]').addEventListener('click', function () { show(cur + 1, true); });
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  addEventListener('keydown', function (e) {
    if (cur < 0) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(cur - 1, true);
    if (e.key === 'ArrowRight') show(cur + 1, true);
  });

  addEventListener('resize', function () { if (cur >= 0) show(cur); });
  var m = /a=(\w+)/.exec(location.hash);
  if (m) for (var i = 0; i < D.length; i++) if (D[i].id === m[1]) { open(i); break; }
})();
