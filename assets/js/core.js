/* RASYANCUT — core: 공통 크롬 삽입, 화면 전환, 스크롤 등장, 메뉴 */
(function () {
  'use strict';
  var RSC = window.RSC = window.RSC || {};
  var reduce = RSC.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var onHome = /(^|\/)(index\.html)?$/.test(location.pathname);

  var NAV = [
    ['home', '홈', 'HOME', 'M12 2l10 10-10 10L2 12z M12 7l5 5-5 5-5-5z'],
    ['character', '캐릭터', 'CHARACTER', 'M12 3a4 4 0 110 8 4 4 0 010-8z M4 21c1-5 4-7 8-7s7 2 8 7'],
    ['nation', '국가 소개', 'NATION', 'M3 21h18 M5 21V10l7-6 7 6v11 M10 21v-6h4v6'],
    ['map', '지도', 'MAP', 'M12 21s-6-6-6-11a6 6 0 1112 0c0 5-6 11-6 11z M12 7.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z'],
    ['game', '게임', 'GAME', 'M4 8h16l1 10h-4l-2-3H9l-2 3H3z M8 10.5v3 M6.5 12h3 M16 12h.01'],
    ['clue', '떡밥', 'CLUE', 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 110 6 3 3 0 010-6z'],
    ['novel', '소설', 'NOVEL', 'M4 4h6a2 2 0 012 2v14a2 2 0 00-2-2H4z M20 4h-6a2 2 0 00-2 2v14a2 2 0 012-2h6z'],
    ['notice', '공지', 'NOTICE', 'M4 5h16v11H9l-5 4z M8 9h8 M8 12h5'],
    ['gallery', '갤러리', 'GALLERY', 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6']
  ];
  var MARK = '<svg viewBox="0 0 40 40" fill="none" stroke="#f2d27a" stroke-width="1.2" aria-hidden="true">' +
    '<path d="M20 2l18 18-18 18L2 20z"/><path d="M20 10l10 10-10 10-10-10z" stroke="#8f6a1c"/>' +
    '<path d="M20 2v36M2 20h36" stroke="#8f6a1c" stroke-width=".6"/><circle cx="20" cy="20" r="3" fill="#f2d27a" stroke="none"/></svg>';

  function href(id) { return (onHome ? '' : 'index.html') + '#' + id; }

  /* 크롬 삽입 */
  var rail = document.createElement('aside');
  rail.className = 'rail';
  rail.innerHTML = '<a class="rail__mark" href="' + href('home') + '" aria-label="라시안컷 홈">' + MARK + '</a>' +
    '<nav class="rail__nav" aria-label="구역">' + NAV.map(function (n) {
      return '<a href="' + href(n[0]) + '" data-nav="' + n[0] + '" aria-label="' + n[1] + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + n[3] + '"/></svg><span>' + n[1] + '</span></a>';
    }).join('') + '</nav><div class="rail__foot">RASYANCUT</div>';

  var bar = document.createElement('header');
  bar.className = 'bar';
  bar.innerHTML = '<a class="bar__mark" href="' + href('home') + '">' + MARK + 'RASYANCUT</a>' +
    '<button class="bar__btn" aria-label="메뉴 열기" aria-expanded="false"><i></i></button>';

  var menu = document.createElement('nav');
  menu.className = 'menu';
  menu.setAttribute('aria-label', '전체 메뉴');
  menu.innerHTML = NAV.map(function (n, i) {
    return '<a href="' + href(n[0]) + '" data-nav="' + n[0] + '" style="--i:' + i + '"><b>' +
      String(i + 1).padStart(2, '0') + '</b>' + n[1] + '</a>';
  }).join('');

  var wipe = document.createElement('div');
  wipe.className = 'wipe is-hold';
  wipe.setAttribute('aria-hidden', 'true');
  wipe.innerHTML = '<i></i><i></i><i></i>';

  document.body.prepend(rail, bar, menu);
  document.body.append(wipe);

  /* 모바일 메뉴 */
  var btn = bar.querySelector('.bar__btn');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', open);
    btn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  }
  btn.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });

  /* 화면 전환 */
  var COVER = 1300, OPEN = 1400;
  function open() {
    wipe.className = 'wipe is-hold';
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      wipe.className = 'wipe is-open';
      setTimeout(function () { wipe.className = 'wipe'; }, OPEN);
    }); });
  }
  function cover(done) {
    wipe.className = 'wipe';
    void wipe.offsetWidth;
    wipe.className = 'wipe is-cover';
    setTimeout(done, COVER);
  }
  /* 같은 페이지 안에서 화면을 바꿀 때: 덮고 → 바꾸고 → 연다 */
  RSC.wipe = function (swap) { cover(function () { swap(); open(); }); };

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname) return;       // 같은 페이지 해시 이동은 기본 동작
    e.preventDefault();
    cover(function () { location.href = a.href; });
  });
  window.addEventListener('pageshow', open);

  /* 스크롤 등장 */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { threshold: .12 });
  RSC.observe = function (root) { (root || document).querySelectorAll('.rv').forEach(function (el) { io.observe(el); }); };
  RSC.observe();

  /* 현재 구역 표시 */
  RSC.setNav = function (id) {
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('is-on', a.dataset.nav === id); });
  };
  if (document.body.dataset.nav) RSC.setNav(document.body.dataset.nav);

  /* 글자 해독 효과 */
  RSC.scramble = function (el, text, ms) {
    var chars = '▚▞▙▟░▒#/\\<>01', start = performance.now(); ms = ms || 1200;
    (function tick(now) {
      var p = Math.min(1, (now - start) / ms), out = '';
      for (var i = 0; i < text.length; i++) {
        out += (i / text.length < p || text[i] === ' ') ? text[i] : chars[(Math.random() * chars.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  };

  RSC.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  RSC.chev = function (dir) {
    return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="' + (dir < 0 ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5') + '"/></svg>';
  };
})();
