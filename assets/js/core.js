/* RASYANCUT — core: 공통 크롬 삽입, 화면 전환, 스크롤 등장, 메뉴 */
(function () {
  'use strict';
  var RSC = window.RSC = window.RSC || {};
  var reduce = RSC.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* 페이지별 스크립트가 거는 전역 이벤트는 페이지를 떠날 때 한꺼번에 해제한다 */
  var ctl = new AbortController();
  RSC.on = function (target, type, fn, opt) {
    var o = typeof opt === 'object' && opt ? Object.assign({}, opt) : {}; o.signal = ctl.signal;
    target.addEventListener(type, fn, o);
  };
  RSC.onLeave = function (fn) { ctl.signal.addEventListener('abort', fn); };

  var NAV = [
    ['home', '홈', 'HOME', 'M12 2l10 10-10 10L2 12z M12 7l5 5-5 5-5-5z'],
    ['character', '캐릭터', 'CHARACTER', 'M12 3a4 4 0 110 8 4 4 0 010-8z M4 21c1-5 4-7 8-7s7 2 8 7'],
    ['nation', '국가 소개', 'NATION', 'M3 21h18 M5 21V10l7-6 7 6v11 M10 21v-6h4v6'],
    ['map', '지도', 'MAP', 'M12 21s-6-6-6-11a6 6 0 1112 0c0 5-6 11-6 11z M12 7.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z'],
    ['game', '게임', 'GAME', 'M4 8h16l1 10h-4l-2-3H9l-2 3H3z M8 10.5v3 M6.5 12h3 M16 12h.01'],
    ['world', '세계관', 'WORLD', 'M12 3a9 9 0 110 18 9 9 0 010-18z M12 1v4 M12 19v4 M4.5 9.5c4.5 2 10.5 2 15 0 M4.5 14.5c4.5-2 10.5-2 15 0'],
    ['novel', '소설', 'NOVEL', 'M4 4h6a2 2 0 012 2v14a2 2 0 00-2-2H4z M20 4h-6a2 2 0 00-2 2v14a2 2 0 012-2h6z'],
    ['notice', '공지', 'NOTICE', 'M4 5h16v11H9l-5 4z M8 9h8 M8 12h5'],
    ['gallery', '갤러리', 'GALLERY', 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6']
  ,
    ['community', '커뮤니티', 'COMMUNITY', 'M4 5h11v8H8l-4 3z M9 16v2h7l4 3V10h-3']];
  var MARK = '<svg viewBox="0 0 40 40" fill="none" stroke="#f2d27a" stroke-width="1.2" aria-hidden="true">' +
    '<path d="M20 2l18 18-18 18L2 20z"/><path d="M20 10l10 10-10 10-10-10z" stroke="#8f6a1c"/>' +
    '<path d="M20 2v36M2 20h36" stroke="#8f6a1c" stroke-width=".6"/><circle cx="20" cy="20" r="3" fill="#f2d27a" stroke="none"/></svg>';

  var PAGE_LINK = { community: 'community.html' };   /* 메인 화면 구역이 아닌 별도 페이지 */
  function href(id) { return PAGE_LINK[id] || 'index.html#' + id; }

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

  /* 상단 페이지 메뉴: 왼쪽 레일은 메인 화면의 구역, 위 메뉴는 사이트의 페이지 */
  var PAGES = [['index.html', '메인', ''], ['characters.html', '캐릭터', 'characters'], ['gallery.html', '갤러리', 'gallery'], ['novels.html', '소설', 'novels'], ['community.html', '커뮤니티', 'community']];
  var top = document.createElement('nav');
  top.className = 'topnav';
  top.setAttribute('aria-label', '페이지');
  top.innerHTML = '<ul>' + PAGES.map(function (p) { return '<li><a href="' + p[0] + '" data-page-link="' + p[2] + '">' + p[1] + '</a></li>'; }).join('') + '</ul>' +
    '<svg class="topnav__wave" viewBox="0 0 240 40" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="M0 34 H66 C86 34 92 8 120 8 C148 8 154 34 174 34 H240"/><path class="w2" d="M18 37 H70 C90 37 96 13 120 13 C144 13 150 37 170 37 H222"/></svg>';
  function pageKey() { var m = location.pathname.match(/([\w-]+)\.html$/); return m && m[1] !== 'index' ? m[1] : ''; }
  RSC.setPage = function () {
    var key = pageKey(), on = top.querySelector('[data-page-link="' + key + '"]'), wave = top.querySelector('.topnav__wave');
    top.querySelectorAll('a').forEach(function (a) { a.classList.toggle('is-on', a === on); if (a === on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (!on) return;
    var r = on.getBoundingClientRect(), base = top.getBoundingClientRect();
    if (!r.width) return;
    wave.style.width = (r.width + 120) + 'px';
    wave.style.transform = 'translateX(' + (r.left - base.left + r.width / 2 - (r.width + 120) / 2) + 'px)';
  };

  var wipe = document.createElement('div');
  wipe.className = 'wipe is-hold';
  wipe.setAttribute('aria-hidden', 'true');
  wipe.innerHTML = '<i></i><i></i><i></i>';

  [rail, bar, menu, top, wipe].forEach(function (el) { el.setAttribute('data-keep', ''); });
  document.body.prepend(rail, top, bar, menu);
  requestAnimationFrame(RSC.setPage);
  window.addEventListener('resize', function () { RSC.setPage(); });
  if (document.fonts) document.fonts.ready.then(function () { RSC.setPage(); });
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

  /* ── 페이지 이동: 문서를 통째로 바꾸지 않고 본문만 갈아 끼운다 ──
     문서가 유지되므로 라디오가 끊기지 않는다. 실패하면 일반 이동으로 돌아간다. */
  function norm(path) { return path.replace(/index\.html$/, ''); }
  function bare(src) { return new URL(src, location.href).pathname; }
  var loaded = {}, current = norm(location.pathname), busy = false;
  document.querySelectorAll('script[src]').forEach(function (sc) { loaded[bare(sc.src)] = true; });

  function addScript(src) {
    return new Promise(function (res) {
      var sc = document.createElement('script'); sc.src = src; sc.onload = sc.onerror = res; document.body.appendChild(sc);
    });
  }
  function swap(url, push) {
    return fetch(url.pathname + url.search, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      if (!doc.querySelector('main.page')) throw new Error('not a site page');

      /* 새 페이지에 필요한 스타일을 먼저 받아 둔다 */
      var have = {};
      document.querySelectorAll('link[rel=stylesheet]').forEach(function (l) { have[bare(l.href)] = true; });
      var css = [].filter.call(doc.querySelectorAll('link[rel=stylesheet]'), function (l) {
        return !have[bare(new URL(l.getAttribute('href'), url).href)];
      }).map(function (l) {
        return new Promise(function (res) {
          var n = document.createElement('link'); n.rel = 'stylesheet'; n.href = new URL(l.getAttribute('href'), url).href;
          n.onload = n.onerror = res; document.head.appendChild(n);
        });
      });

      return Promise.all(css).then(function () {
        ctl.abort(); ctl = new AbortController();          /* 이전 페이지의 전역 이벤트·타이머 해제 */
        setMenu(false);
        [].slice.call(document.body.children).forEach(function (el) {
          if (!el.hasAttribute('data-keep') && el.tagName !== 'SCRIPT') el.remove();
        });
        document.querySelectorAll('script[data-page]').forEach(function (sc) { sc.remove(); });
        var before = document.querySelector('.wipe');
        [].slice.call(doc.body.children).forEach(function (el) {
          if (el.tagName !== 'SCRIPT' && el.tagName !== 'NOSCRIPT' && !el.hasAttribute('data-boot')) document.body.insertBefore(document.adoptNode(el), before);
        });
        document.title = doc.title;
        if (doc.body.dataset.nav) document.body.dataset.nav = doc.body.dataset.nav; else delete document.body.dataset.nav;
        if (push) history.pushState(null, '', url.href);
        current = norm(url.pathname);
        RSC.setNav(document.body.dataset.nav || 'home');
        RSC.setPage();
        scrollTo(0, 0);

        /* 스크립트: 공통은 한 번만, 페이지 전용(data-page)은 올 때마다 다시 실행 */
        var chain = Promise.resolve();
        doc.querySelectorAll('script[src]').forEach(function (sc) {
          var src = new URL(sc.getAttribute('src'), url).href, key = bare(src), page = sc.hasAttribute('data-page');
          if (!page && loaded[key]) return;
          chain = chain.then(function () {
            loaded[key] = true;
            return addScript(src).then(function () { if (page) document.body.lastElementChild.setAttribute('data-page', ''); });
          });
        });
        return chain.then(function () {
          RSC.observe();
          if (url.hash) {
            var t = document.getElementById(url.hash.slice(1));
            if (t) { var sb = document.documentElement.style.scrollBehavior; document.documentElement.style.scrollBehavior = 'auto'; t.scrollIntoView(); document.documentElement.style.scrollBehavior = sb; }
          }
        });
      });
    });
  }
  function go(url, push) {
    if (busy) return; busy = true;
    cover(function () {
      swap(url, push).then(function () { busy = false; open(); }, function () { location.href = url.href; });
    });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (norm(url.pathname) === current) {                 // 같은 페이지: 해시 이동만
      if (url.pathname !== location.pathname) { e.preventDefault(); location.hash = url.hash; }
      return;
    }
    e.preventDefault();
    go(url, true);
  });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('popstate', function () {       // 뒤로·앞으로 가기
    if (norm(location.pathname) === current) return;
    ctl.abort(); ctl = new AbortController();           /* 주소가 이미 바뀌었으므로 이전 페이지의 동작을 즉시 멈춘다 */
    go(new URL(location.href), false);
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
