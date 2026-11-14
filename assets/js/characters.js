/* RASYANCUT — 캐릭터 창: 선택 화면 ↔ 일러스트 배치 화면 */
(function () {
  'use strict';
  var D = window.RSC_DATA.characters, RSC = window.RSC, esc = RSC.esc;
  var addEventListener = function (t, f, o) { RSC.on(window, t, f, o); };   /* 페이지를 떠나면 자동 해제 */
  var $ = function (s) { return document.querySelector(s); };
  var list = $('[data-view="list"]'), view = $('[data-view="detail"]');
  var EMBLEM = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3l17 17-17 17L3 20z"/><path d="M20 12l8 8-8 8-8-8z"/></svg>';
  var TABS = { profile: ['Profile', 'profile'], ability: ['Ability', 'ability'], record: ['Record', 'record'] };
  var cur = -1, tab = 'profile';

  var F = window.RSC_DATA.factions || [];
  var GLYPH = ['M20 4l4 26h-8z M8 34h24 M12 34l2-8 M28 34l-2-8',
    'M20 13a7 7 0 110 14 7 7 0 010-14z M4 20c0-4 7-7 16-7s16 3 16 7-7 7-16 7S4 24 4 20z',
    'M20 3l9 17-9 17-9-17z M11 20h18 M20 3v34',
    'M6 30a14 14 0 0128 0z M3 30h34 M10 30v4 M30 30v4 M20 16v-6'];
  function facIcon(g) { return '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="' + GLYPH[g % 4] + '"/></svg>'; }
  function facOf(ch) { for (var k = 0; k < F.length; k++) if (F[k].id === ch.faction) return F[k]; return null; }

  $('[data-count]').textContent = String(D.length).padStart(2, '0');
  $('[data-c-total]').textContent = String(D.length).padStart(2, '0');
  $('[data-c-prev]').innerHTML = RSC.chev(-1); $('[data-c-next]').innerHTML = RSC.chev(1);
  $('[data-ring-prev]').innerHTML = RSC.chev(-1); $('[data-ring-next]').innerHTML = RSC.chev(1);

  /* 소속 아이콘 (전체 + 소속별) */
  var facBox = $('[data-fac]'), facSel = 'ALL';
  facBox.innerHTML = '<button data-f="ALL" aria-pressed="true"><span class="cfac__all mono">ALL</span><span class="cfac__name">전체</span><span class="mono cfac__n">' + D.length + '</span></button>' +
    F.map(function (f) {
      var n = D.filter(function (c) { return c.faction === f.id; }).length;
      return '<button data-f="' + f.id + '" aria-pressed="false">' + facIcon(f.glyph) + '<span class="cfac__name">' + esc(f.name) + '</span><span class="mono cfac__n">' + n + '</span></button>';
    }).join('');

  /* 회전 목록: 가운데 카드 기준으로 좌우 카드가 원통 위에 놓인 것처럼 배치. 끝과 처음이 이어진다 */
  var ring = $('[data-ring]'), track = $('[data-strips]'), items = [], pos = 0, goal = 0, raf = 0, drag = null;
  function strip(ch) {
    var f = facOf(ch);
    return '<a class="strip" href="#c=' + ch.id + '" aria-label="캐릭터 ' + ch.id + ' ' + esc(ch.name) + '" draggable="false">' +
      (ch.thumb ? '<img class="strip__img" src="' + esc(ch.thumb) + '" alt="" draggable="false">' : '<span class="strip__empty mono">NO IMAGE</span>') +
      '<span class="strip__no mono">' + ch.id + '</span>' + (f ? '<span class="strip__fac">' + facIcon(f.glyph) + '</span>' : '') +
      '<span class="strip__base">' + EMBLEM + '<span class="mono">' + ch.code + '</span><strong>' + esc(ch.name) + '</strong></span></a>';
  }
  function setFaction(id) {
    facSel = id;
    facBox.querySelectorAll('[data-f]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.f === id); });
    var list = D.filter(function (c) { return id === 'ALL' || c.faction === id; });
    track.innerHTML = list.map(function (ch) { return '<li data-cid="' + ch.id + '">' + strip(ch) + '</li>'; }).join('');
    items = [].slice.call(track.children);
    pos = goal = 0;
    $('[data-ring-total]').textContent = String(items.length).padStart(2, '0');
    var f = F.filter(function (x) { return x.id === id; })[0];
    $('[data-ring-fac]').textContent = f ? f.name : '전체';
    track.classList.remove('is-in'); void track.offsetWidth; track.classList.add('is-in');
    layout();
  }
  function wrap(d, n) { d = ((d % n) + n) % n; return d > n / 2 ? d - n : d; }
  function layout() {
    var n = items.length; if (!n) return;
    var w = ring.clientWidth, small = w < 700, gap = small ? w * .36 : Math.min(230, w * .14), vis = small ? 2 : 4;
    items.forEach(function (li, k) {
      var d = wrap(k - pos, n), a = Math.abs(d);
      if (a > vis + .5) { li.style.visibility = 'hidden'; li.style.opacity = 0; return; }
      var x = Math.sign(d) * (a <= 1 ? a * gap : gap + (a - 1) * gap * .82);
      var z = -Math.pow(a, 1.15) * (small ? 110 : 150), ry = -d * (small ? 22 : 16), sc = 1 - Math.min(a, 4) * .04;
      li.style.visibility = 'visible';
      li.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,' + z.toFixed(1) + 'px) rotateY(' + ry.toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';
      li.style.opacity = (1 - Math.max(0, a - .2) * .2).toFixed(3);
      li.style.zIndex = 100 - Math.round(a * 10);
      li.classList.toggle('is-front', a < .5);
      var link = li.firstChild; link.tabIndex = a < .5 ? 0 : -1;
    });
    var front = ((Math.round(pos) % n) + n) % n;
    $('[data-ring-no]').textContent = String(front + 1).padStart(2, '0');
  }
  function animate() {
    cancelAnimationFrame(raf);
    (function step() {
      var diff = goal - pos;
      pos += diff * .14; if (Math.abs(diff) < .002) pos = goal;
      layout();
      if (pos !== goal) raf = requestAnimationFrame(step);
    })();
  }
  function go(dlt) { goal = Math.round(goal) + dlt; animate(); }

  facBox.addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b && b.dataset.f !== facSel) setFaction(b.dataset.f); });
  $('[data-ring-prev]').addEventListener('click', function () { go(-1); });
  $('[data-ring-next]').addEventListener('click', function () { go(1); });
  /* 휠: 한 칸에 한 장 (연속 입력은 0.25초 간격) */
  var wheelT = 0;
  ring.addEventListener('wheel', function (e) {
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (!d) return;
    e.preventDefault(); var now = performance.now(); if (now - wheelT < 250) return; wheelT = now; go(d > 0 ? 1 : -1);
  }, { passive: false });
  /* 키보드 */
  addEventListener('keydown', function (e) {
    if (list.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  });
  /* 끌기·밀기 */
  ring.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.cring__btn')) return;
    drag = { x: e.clientX, p: pos, moved: false, id: e.pointerId }; cancelAnimationFrame(raf);
  });
  addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x; if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved) { var gapPx = ring.clientWidth < 700 ? ring.clientWidth * .36 : Math.min(230, ring.clientWidth * .14); pos = goal = drag.p - dx / gapPx; layout(); }
  });
  addEventListener('pointerup', function () { if (!drag) return; var moved = drag.moved; drag = null; if (moved) { goal = Math.round(pos); animate(); ring.dataset.dragged = '1'; setTimeout(function () { delete ring.dataset.dragged; }, 50); } });
  /* 옆 카드를 누르면 그 카드로 돌리고, 가운데 카드를 누르면 상세로 */
  track.addEventListener('click', function (e) {
    var li = e.target.closest('li'); if (!li) return;
    if (ring.dataset.dragged) { e.preventDefault(); return; }
    if (!li.classList.contains('is-front')) { e.preventDefault(); var k = items.indexOf(li); go(wrap(k - Math.round(pos), items.length)); }
  });
  RSC.on(window, 'resize', layout);
  setFaction('ALL');

  function body(anim) {
    var ch = D[cur], box = $('[data-c-body]'), rows = ch[TABS[tab][1]] || [];
    box.innerHTML = '<h2>' + TABS[tab][0] + '</h2>' + (rows.length
      ? rows.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('')
      : '<p class="is-empty">아직 등록된 기록이 없습니다.</p>');
    document.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === tab); });
    if (anim) { box.classList.remove('is-swap'); void box.offsetWidth; box.classList.add('is-swap'); }
  }
  function fill(i) {
    cur = i; tab = 'profile';
    var ch = D[i], art = $('[data-c-art]');
    $('[data-c-idx]').textContent = ch.id;
    $('[data-c-artno]').textContent = ch.id;
    RSC.scramble($('[data-c-code]'), ch.code, 900);
    $('[data-c-name]').textContent = ch.name;
    /* 가장 긴 단어가 4글자를 넘으면 글자를 줄여 칸 밖으로 삐져나가지 않게 */
    $('[data-c-name]').classList.toggle('is-long', Math.max.apply(null, ch.name.split(/\s+/).map(function (w) { return w.length; })) > 4);
    $('[data-c-title]').textContent = ch.quote || ch.title || '';
    $('[data-c-en]').textContent = ch.nameEn;
    $('[data-c-specs]').innerHTML = ch.specs.map(function (s) { return '<dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd>'; }).join('');
    art.classList.toggle('has-img', !!ch.image);
    art.innerHTML = ch.image ? '<img src="' + esc(ch.image) + '" alt="' + esc(ch.name) + ' 일러스트">' : '<span>ILLUSTRATION<br>EMPTY</span>';
    body(false);
    document.title = ch.name + ' — 캐릭터 — RASYANCUT';
  }
  function find(hash) {
    var m = /c=(\w+)/.exec(hash || '');
    if (!m) return -1;
    for (var i = 0; i < D.length; i++) if (D[i].id === m[1]) return i;
    return -1;
  }
  function render() {
    var i = find(location.hash);
    list.hidden = i >= 0; view.hidden = i < 0;
    if (i >= 0) { fill(i); view.classList.remove('is-in', 'is-swap'); void view.offsetWidth; view.classList.add('is-in'); }
    else { cur = -1; document.title = '캐릭터 — RASYANCUT'; }
    scrollTo(0, 0);
  }
  function step(d) {
    var n = (cur + d + D.length) % D.length;
    history.replaceState(null, '', '#c=' + D[n].id);
    fill(n);
    view.classList.remove('is-in', 'is-swap'); void view.offsetWidth; view.classList.add('is-swap');
  }

  addEventListener('hashchange', function () {
    var i = find(location.hash);
    if ((i >= 0) === (cur >= 0) && i === cur) return;
    RSC.wipe(render);                                   /* 선택 화면 ↔ 배치 화면은 사선 와이프로 */
  });
  $('[data-c-prev]').addEventListener('click', function () { step(-1); });
  $('[data-c-next]').addEventListener('click', function () { step(1); });
  document.querySelector('.cview__tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]'); if (!b || b.dataset.tab === tab) return;
    tab = b.dataset.tab; body(true);
  });
  addEventListener('keydown', function (e) {
    if (cur < 0) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'Escape') location.hash = '';
  });
  render();
})();
