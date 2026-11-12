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

  $('[data-count]').textContent = String(D.length).padStart(2, '0');
  $('[data-c-total]').textContent = String(D.length).padStart(2, '0');
  $('[data-c-prev]').innerHTML = RSC.chev(-1); $('[data-c-next]').innerHTML = RSC.chev(1);
  $('[data-strips]').innerHTML = D.map(function (ch, i) {
    return '<li style="--i:' + i + '"><a class="strip" href="#c=' + ch.id + '" aria-label="캐릭터 ' + ch.id + ' ' + esc(ch.name) + '">' +
      (ch.thumb ? '<img class="strip__img" src="' + esc(ch.thumb) + '" alt="">' : '<span class="strip__empty mono">NO IMAGE</span>') +
      '<span class="strip__no mono">' + ch.id + '</span>' +
      '<span class="strip__base">' + EMBLEM + '<span class="mono">' + ch.code + '</span><strong>' + esc(ch.name) + '</strong></span></a></li>';
  }).join('');

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
