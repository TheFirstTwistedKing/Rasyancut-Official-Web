/* RASYANCUT — 메인 화면 동작 */
(function () {
  'use strict';
  var D = window.RSC_DATA, RSC = window.RSC, esc = RSC.esc, reduce = RSC.reduce;
  var addEventListener = function (t, f, o) { RSC.on(window, t, f, o); };   /* 페이지를 떠나면 자동 해제 */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var small = matchMedia('(max-width: 900px)');
  var EMBLEM = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3l17 17-17 17L3 20z"/><path d="M20 12l8 8-8 8-8-8z"/></svg>';

  /* 화면에 보일 때만 그리는 루프 */
  function loop(el, draw) {
    /* 화면에 보이고(교차) 탭이 보일 때만 그린다. 두 조건을 따로 기억해서, 다른 탭에 다녀와도 다시 그리기 시작한다 */
    var inView = false, raf = 0, running = false, dead = false;
    var sec = el.closest('.sec'), root = document.documentElement;
    function shown() { return !root.classList.contains('is-deck') || !sec || sec.classList.contains('is-cur') || sec.classList.contains('is-out'); }
    /* 한 화면 모드에서 보이지 않는 화면의 캔버스는 그리지 않는다 */
    function tick(t) { if (!running) return; if (shown()) draw(t); raf = requestAnimationFrame(tick); }
    function sync() {
      var want = inView && !document.hidden && !dead;
      if (want === running) return;
      running = want; cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(tick);
    }
    var io = new IntersectionObserver(function (es) { inView = es[es.length - 1].isIntersecting; sync(); });
    io.observe(el);
    RSC.on(document, 'visibilitychange', sync);
    RSC.onLeave(function () { dead = true; io.disconnect(); sync(); });
  }
  function fit(cv) {
    /* 변형(scale)의 영향을 받지 않는 실제 표시 크기로 맞춘다 */
    var dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c: c, w: w, h: h };
  }
  /* 캔버스의 표시 크기가 바뀌면(창 크기, 한 화면 모드 전환 등) 다시 맞춘다. 늘어난 그림이 찌그러지지 않게 */
  function watch(cv, onSize) {
    var last = '', ro = new ResizeObserver(function () {
      var k = cv.clientWidth + 'x' + cv.clientHeight; if (k === last || !cv.clientWidth) return; last = k; onSize();
    });
    ro.observe(cv); RSC.onLeave(function () { ro.disconnect(); });
  }

  /* ── 01 HOME ── */
  var SECS = [['character', '캐릭터'], ['nation', '국가 소개'], ['map', '지도'], ['game', '게임'], ['world', '세계관'], ['novel', '소설'], ['notice', '공지'], ['gallery', '갤러리']];
  $('[data-quick]').innerHTML = SECS.map(function (s, i) {
    return '<li><a href="#' + s[0] + '"><b>' + String(i + 2).padStart(2, '0') + '</b>' + s[1] + '</a></li>';
  }).join('') + '<li class="home__quick-wide"><a href="community.html"><b>↗</b>커뮤니티 <span class="mono">Forum</span></a></li>';

  var clock = $('[data-clock]') || document.createElement('span');
  function tickClock() { clock.textContent = new Date().toTimeString().slice(0, 8); }
  tickClock(); var clockTimer = setInterval(tickClock, 1000); RSC.onLeave(function () { clearInterval(clockTimer); });

  (function homeFx() {
    if (!$('.home__fx')) return;   /* 홈 배경 마법진은 일러스트 슬라이드로 대체됨 */
    /* 마법진 HUD — 참고 이미지(743×341)의 배치를 같은 비율 좌표로 옮겼다.
       성능: 움직이지 않는 층은 별도 캔버스에 한 번만 그리고(진짜 빛 번짐 포함), 깊이감은 그 캔버스를 통째로 옮긴다(GPU 합성).
             회전하는 고리는 매 프레임 선으로 그린다 — 칠하는 면적이 작아 회전 그림 붙이기보다 훨씬 가볍다.
       품질: 굵고 옅은 선을 겹쳐 빛 번짐, 고리를 따라 흐르는 빛, 궤도 불꽃, 레이더 스윕, 등장 연출, 층별 깊이감.
       느린 기기: 40프레임마다 평균 프레임 시간을 재서 33ms(30fps)를 넘으면 품질을 한 단계씩 낮춘다. */
    var reduce = false;   /* 사용자 요청: 홈 마법진은 기기의 '애니메이션 줄이기' 설정과 관계없이 회전한다 */
    var cv = $('.home__fx'), g = fit(cv), dust = [], mx = 0, my = 0, px = 0, py = 0, lastT = 0, born = 0;
    var TAU = Math.PI * 2, SIL = '214, 220, 226', GOLD = '242, 210, 122', RW = 743, RH = 341;
    var c, U = 1, sc = 1, ox = 0, oy = 0, dpr = 1, hasFilter = 'filter' in document.createElement('canvas').getContext('2d');
    var quality = 2, acc = 0, cnt = 0, bad = 0, odd = false;              /* 2: 최고, 1: 효과 줄임, 0: 해상도 1배 */
    var fx = {}, BLOOM = false;
    var bg = document.createElement('canvas'); bg.className = 'home__fx home__fx--bg'; bg.setAttribute('aria-hidden', 'true'); cv.parentNode.insertBefore(bg, cv);

    /* ── 그리기 도구 (참고 이미지 좌표 단위) ── */
    function st(rgb, a, w) { if (BLOOM) { a *= .16; w = (w || 1) * 4.5; } c.strokeStyle = c.fillStyle = 'rgba(' + rgb + ',' + a + ')'; c.lineWidth = (w || 1) * U; }
    function ring(x, y, r, rgb, a, w, dash) { st(rgb, a, w); c.setLineDash(dash ? dash.map(function (d) { return d * U; }) : []); c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); c.setLineDash([]); }
    function arc(x, y, r, a0, a1, rgb, a, w) { st(rgb, a, w); c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); }
    function dotRing(x, y, r, n, size, rgb, a, a0, a1) {
      st(rgb, a); a0 = a0 || 0; a1 = a1 === undefined ? TAU : a1; c.beginPath(); if (!quality && n > 12) n = Math.ceil(n / 2);
      for (var i = 0; i < n; i++) { var t = a0 + (a1 - a0) * i / n, dx = x + Math.cos(t) * r, dy = y + Math.sin(t) * r; c.moveTo(dx + size, dy); c.arc(dx, dy, size, 0, TAU); }
      c.fill();
    }
    function ticks(x, y, r, n, len, rgb, a, every, longLen) {
      st(rgb, a); c.beginPath(); if (!quality && n > 24 && !every) n = Math.ceil(n / 2);
      for (var i = 0; i < n; i++) { var t = i / n * TAU, l = every && i % every === 0 ? longLen : len, ca = Math.cos(t), sa = Math.sin(t); c.moveTo(x + ca * r, y + sa * r); c.lineTo(x + ca * (r + l), y + sa * (r + l)); }
      c.stroke();
    }
    function line(x1, y1, x2, y2, rgb, a, w) { st(rgb, a, w); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
    function poly(x, y, r, n, rot, rgb, a) { st(rgb, a); c.beginPath(); for (var i = 0; i <= n; i++) { var t = rot + i / n * TAU; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(t) * r, y + Math.sin(t) * r); } c.stroke(); }
    function star(x, y, s, a, rgb) {
      st(rgb || GOLD, a);
      c.beginPath(); c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s * .28, y); c.quadraticCurveTo(x, y, x, y + s); c.quadraticCurveTo(x, y, x - s * .28, y); c.quadraticCurveTo(x, y, x, y - s); c.fill();
      c.beginPath(); c.moveTo(x - s * 1.1, y); c.quadraticCurveTo(x, y, x, y - s * .2); c.quadraticCurveTo(x, y, x + s * 1.1, y); c.quadraticCurveTo(x, y, x, y + s * .2); c.quadraticCurveTo(x, y, x - s * 1.1, y); c.fill();
    }
    function leaf(x, y, dir, len, a) { c.save(); c.translate(x, y); c.rotate(dir + Math.PI / 2); st(SIL, a); c.beginPath(); c.ellipse(0, -len / 2, len * .25, len / 2, 0, 0, TAU); c.fill(); c.restore(); }
    function wreath(x, y, r, side, a) {
      var a0 = Math.PI / 2 - side * .87, a1 = Math.PI / 2 - side * 2.01;   /* 왼쪽 기준 140°→205° (참고 이미지 측정값) */
      arc(x, y, r, Math.min(a0, a1), Math.max(a0, a1), SIL, a * .7, 1.1);
      for (var i = 0; i < 13; i++) {
        var t = a0 + (a1 - a0) * i / 12, lx = x + Math.cos(t) * r, ly = y + Math.sin(t) * r, len = 10 - i * .3, grow = t - side * Math.PI / 2;
        leaf(lx, ly, grow + side * .85, len, a); leaf(lx, ly, grow - side * .75, len * .8, a * .8);
      }
    }
    function diamond(x, y, a) { st(SIL, a); c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x, y - 3); c.lineTo(x + 4, y); c.lineTo(x, y + 3); c.fill(); }

    /* ── 구성 요소: 정지층(뒤·빛남) + 회전층 — 참고 이미지와 요소별로 대조해 맞춘 값 ── */
    var X = 358, Y = 125;
    function sparkle(x, y, s, a) { st(SIL, a); c.beginPath(); c.moveTo(x - s, y); c.lineTo(x, y - s * .25); c.lineTo(x + s, y); c.lineTo(x, y + s * .25); c.fill(); c.beginPath(); c.moveTo(x, y - s * .7); c.lineTo(x + s * .2, y); c.lineTo(x, y + s * .7); c.lineTo(x - s * .2, y); c.fill(); }
    function rune(pts, w, a) { st(SIL, a, w); c.lineCap = 'round'; c.beginPath(); pts.forEach(function (p, i) { c[i ? 'lineTo' : 'moveTo'](p[0], p[1]); }); c.stroke(); c.lineCap = 'butt'; }
    function staticBack() {
      /* 가운데 고리 뒤 넓은 반투명 띠 (88~104) + 옅은 원판 */
      var halo = c.createRadialGradient(X, Y, 70, X, Y, 112);
      halo.addColorStop(0, 'rgba(' + SIL + ',0)'); halo.addColorStop(.4, 'rgba(' + SIL + ',.09)'); halo.addColorStop(.8, 'rgba(' + SIL + ',.06)'); halo.addColorStop(1, 'rgba(' + SIL + ',0)');
      c.fillStyle = halo; c.beginPath(); c.arc(X, Y, 112, 0, TAU); c.fill();
      ring(X, Y, 96, SIL, .06, 16); ring(X, Y, 88, SIL, .3); ring(X, Y, 104, SIL, .32); ring(X, Y, 107, SIL, .14);
      /* 얽힌 큰 원·긴 선 */
      [[-14, 4, 112, .14], [-26, 10, 104, .1], [6, -4, 124, .1], [-40, 30, 120, .07], [30, 24, 116, .07], [-8, -20, 98, .08]].forEach(function (r) { ring(X + r[0], Y + r[1], r[2], SIL, r[3]); });
      arc(X + 6, Y, 126, 2.55, 3.75, SIL, .32, 3); arc(X - 6, Y, 126, -.6, .55, SIL, .22, 2.4);
      line(285, 0, 430, 300, SIL, .09); line(430, 0, 290, 300, SIL, .09); line(250, 40, 250, 230, SIL, .1); line(468, 40, 468, 230, SIL, .1);
      line(100, 30, 335, 278, SIL, .16); line(232, 82, 118, 170, SIL, .2); line(160, 20, 300, 35, SIL, .06);
      line(615, 30, 382, 278, SIL, .16); line(498, 88, 600, 180, SIL, .2);
      line(250, 300, 470, 300, SIL, .1); line(250, 300, 250, 290, SIL, .1);
      [[175, 222], [300, 230], [400, 248], [455, 240], [212, 245], [440, 285], [180, 120], [533, 120]].forEach(function (d) { st(SIL, .55); c.beginPath(); c.arc(d[0], d[1], 1.3, 0, TAU); c.fill(); });
      ring(X, Y, 31, SIL, .14); ring(X, Y, 59, SIL, .1);
      /* 왼쪽 가운데 (160,170): 가는 원 + 점선 */
      ring(160, 170, 50, SIL, .28); ring(160, 170, 40, SIL, .1); ring(175, 82, 5, SIL, .5);
      /* 왼쪽 아래 (92,277): 가는 점선 원 + 오른쪽 꺾쇠 기둥 */
      ring(92, 277, 46, SIL, .14);
      for (var cy = 252; cy <= 302; cy += 8) { st(SIL, .35); c.beginPath(); c.moveTo(140, cy - 3); c.lineTo(144, cy); c.lineTo(140, cy + 3); c.stroke(); }
      /* 가운데 아래 (357,270): 역삼각형, 가로 점선 */
      ring(357, 270, 44, SIL, .35); ring(357, 270, 60, SIL, .12, 1, [2, 4]);
      line(305, 236, 410, 236, SIL, .28); line(305, 236, 357, 302, SIL, .25); line(410, 236, 357, 302, SIL, .25);
      for (var hx = 318; hx <= 398; hx += 6) { st(SIL, .45); c.beginPath(); c.arc(hx, 270, .7, 0, TAU); c.fill(); }
      /* 오른쪽 위 (645,75): 동심원 + 바깥 호 */
      ring(645, 75, 24, SIL, .3); ring(645, 75, 33, SIL, .18); arc(645, 75, 46, 2.5, 4.3, SIL, .35); arc(645, 75, 52, -.2, 1.1, SIL, .3);
      [[621, 48], [668, 48], [621, 102], [668, 102]].forEach(function (d) { st(SIL, .55); c.fillRect(d[0] - 1.2, d[1] - 1.2, 2.4, 2.4); });
      for (var k2 = 0; k2 < 7; k2++) line(676 + k2 * 3, 52 + k2 * 4, 688 + k2 * 3, 46 + k2 * 4, SIL, .28);   /* 오른쪽 사선 빗금 */
      /* 열쇠 고리 (533,125) */
      ring(533, 125, 28, SIL, .32); ring(505, 108, 2.4, SIL, .55); ring(503, 142, 2.4, SIL, .55); st(SIL, .8); c.beginPath(); c.arc(556, 100, 1.4, 0, TAU); c.fill();
      /* 구슬 표식 고리 (612,190) */
      ring(612, 190, 47, SIL, .3); ring(612, 190, 40, SIL, .1);
      [[566, 163], [659, 163], [566, 218], [659, 218]].forEach(function (d) { st(SIL, .45); c.save(); c.translate(d[0], d[1]); c.rotate(Math.PI / 4); c.strokeRect(-2.5, -2.5, 5, 5); c.restore(); });
      [[612, 140], [612, 240]].forEach(function (d) { st(SIL, .6); c.beginPath(); c.arc(d[0], d[1], 1.1, 0, TAU); c.fill(); });
      /* 갈고리 고리 (515,258) */
      ring(515, 258, 46, SIL, .14, 1, [1, 3]);
      /* 구석 계기 (683,345, 막대와 같은 축): 바깥 점 부채 + 호 */
      for (var r = 84; r <= 112; r += 4) dotRing(683, 345, r, 50 + r / 2, .55, SIL, .4, Math.PI * 1.02, Math.PI * 1.98);
      arc(683, 345, 62, Math.PI, TAU, SIL, .4); arc(683, 345, 45, Math.PI, TAU, SIL, .3);
      dotRing(683, 345, 66, 40, .5, SIL, .4, Math.PI * 1.05, Math.PI * 1.95);
      st(SIL, .5); c.beginPath(); c.moveTo(656, 290); c.lineTo(656, 256); c.lineTo(666, 249); c.lineTo(672, 249);   /* 받침 기둥: x=683 기준 좌우 대칭 */
      c.moveTo(710, 290); c.lineTo(710, 256); c.lineTo(700, 249); c.lineTo(694, 249); c.stroke();
      ring(622, 306, 4, SIL, .6);
      var beam = c.createLinearGradient(0, 284, 0, 330); beam.addColorStop(0, 'rgba(' + SIL + ',.22)'); beam.addColorStop(1, 'rgba(' + SIL + ',0)');
      c.fillStyle = beam; c.beginPath(); c.moveTo(680, 287); c.lineTo(686, 287); c.lineTo(692, 322); c.lineTo(674, 322); c.fill();
    }
    function staticGlow() {                         /* 빛 번짐을 입힐 밝은 요소 */
      ring(X, Y, 72, SIL, .92, 1.6);                  /* 안쪽 흰 원 */
      wreath(X, Y, 83, -1, .92); wreath(X, Y, 83, 1, .92);
      /* 위쪽 작은 삼각 표식 */
      [[285, 91, 4], [300, 87, 2.4], [431, 91, 4], [416, 87, 2.4]].forEach(function (t) { st(SIL, .85); c.beginPath(); c.moveTo(t[0] - t[2], t[1] - t[2] * .8); c.lineTo(t[0] + t[2], t[1] - t[2] * .8); c.lineTo(t[0], t[1] + t[2] * .8); c.fill(); });
      /* 아래 날개 장식 (302,167)→(332,190) 대칭 */
      [-1, 1].forEach(function (d) {
        st(SIL, .95); c.beginPath(); c.moveTo(X + d * 57, Y + 41); c.quadraticCurveTo(X + d * 46, Y + 60, X + d * 24, Y + 66);
        c.quadraticCurveTo(X + d * 45, Y + 59, X + d * 55, Y + 40); c.closePath(); c.fill();
        st(SIL, .7, 1.1); c.beginPath(); c.moveTo(X + d * 62, Y + 30); c.quadraticCurveTo(X + d * 60, Y + 50, X + d * 50, Y + 58); c.stroke();
      });
      arc(X, Y, 62, Math.PI * .3, Math.PI * .7, SIL, .55, 1); [.3, .7].forEach(function (f) { st(SIL, .8); c.beginPath(); c.arc(X + Math.cos(Math.PI * f) * 62, Y + Math.sin(Math.PI * f) * 62, 1.3, 0, TAU); c.fill(); });
      st(SIL, .98, 1.8); c.beginPath(); c.moveTo(X - 4, Y + 58); c.lineTo(X - 4, Y + 70); c.moveTo(X + 4, Y + 58); c.lineTo(X + 4, Y + 70); c.moveTo(X, Y + 56); c.lineTo(X, Y + 77); c.stroke();
      /* 왼쪽 위 굵은 점: 오른쪽 아래·왼쪽·위 세 구간 */
      for (var q2 = 0; q2 < 8; q2++) { var ta = .95 - q2 * .085, rr = 26 + q2 * 2.8; st(SIL, .55 + q2 * .05); c.beginPath(); c.arc(85 + Math.cos(ta) * rr, 72 + Math.sin(ta) * rr, .8 + q2 * .12, 0, TAU); c.fill(); }   /* 안쪽으로 감기는 점 */
      dotRing(85, 72, 41, 7, 1.2, SIL, .75, 2.5, 3.45); dotRing(85, 72, 46, 5, 1, SIL, .6, -2.0, -1.2);
      /* 왼쪽 가운데: 룬 표식 3개 + 밝은 점 */
      rune([[134, 143], [140, 139], [144, 142]], 2.2, .32); rune([[204, 175], [205, 184], [200, 188]], 2.2, .32); rune([[135, 202], [137, 211], [145, 212]], 2.2, .3);
      [[3.25, 1.5], [4.2, 1.2], [.4, 1.3], [2.1, 1.5]].forEach(function (a) { st(SIL, .85); c.beginPath(); c.arc(160 + Math.cos(a[0]) * 52, 170 + Math.sin(a[0]) * 52, a[1], 0, TAU); c.fill(); });
      /* 왼쪽 아래 마름모 */
      [[45, 277, 1], [132, 277, 1], [152, 277, .7]].forEach(function (d) { st(SIL, .9); c.beginPath(); c.moveTo(d[0] - 4.5 * d[2], d[1]); c.lineTo(d[0], d[1] - 3 * d[2]); c.lineTo(d[0] + 4.5 * d[2], d[1]); c.lineTo(d[0], d[1] + 3 * d[2]); c.fill(); });
      /* 가운데 아래 문자 + 양옆 반짝임 */
      st(SIL, .97, 4.2); c.lineCap = 'round'; c.beginPath(); c.moveTo(364, 259); c.quadraticCurveTo(353, 258, 354, 268); c.quadraticCurveTo(356, 276, 353, 284); c.stroke();
      st(SIL, .97); c.beginPath(); c.arc(364, 260, 2.4, 0, TAU); c.fill();
      st(SIL, .9, 2.2); c.beginPath(); c.moveTo(357, 270); c.quadraticCurveTo(362, 266, 366, 268); c.stroke(); c.lineCap = 'butt';
      ring(312, 226, 4, SIL, .6, 1.2); [[337, 228, 1.8], [349, 237, 1.4]].forEach(function (d) { st(SIL, .9); c.beginPath(); c.arc(d[0], d[1], d[2], 0, TAU); c.fill(); });
      sparkle(300, 272, 6, .9); sparkle(415, 272, 6, .9);
      /* 열쇠 표식 */
      ring(549, 153, 4.5, SIL, .9, 1.5); line(552, 157, 563, 171, SIL, .85, 1.5); line(557, 164, 561, 161, SIL, .85, 1.2);
      /* 구슬 표식: 속이 찬 점 + 바깥 괄호 */
      [[566, 190, -1], [659, 190, 1]].forEach(function (b) { st(SIL, .95); c.beginPath(); c.arc(b[0], b[1], 2.6, 0, TAU); c.fill(); arc(b[0], b[1], 5.5, b[2] > 0 ? -1.2 : Math.PI - 1.2, b[2] > 0 ? 1.2 : Math.PI + 1.2, SIL, .9, 1.4); });
      /* 갈고리 문양 (해마 모양) */
      st(SIL, .85, 1.8); c.lineCap = 'round'; c.beginPath();
      c.moveTo(478, 268); c.quadraticCurveTo(471, 256, 474, 246); c.quadraticCurveTo(478, 240, 482, 245); c.moveTo(474, 246); c.lineTo(470, 241);
      c.moveTo(550, 250); c.quadraticCurveTo(557, 262, 552, 274); c.quadraticCurveTo(547, 279, 543, 274); c.moveTo(552, 274); c.lineTo(556, 279); c.stroke(); c.lineCap = 'butt';
      /* 구석 계기: 막대 + 밝은 호 + 빛 점 */
      st(SIL, .92, 1.8); c.beginPath(); [678, 683, 688].forEach(function (x, i) { c.moveTo(x, 289); c.lineTo(x, i === 1 ? 236 : 247); }); c.stroke();
      arc(683, 345, 80, Math.PI * 1.04, Math.PI * 1.96, SIL, .7, 1.6);
      st(SIL, .95); c.beginPath(); c.arc(683, 284, 3, 0, TAU); c.fill(); ring(683, 284, 6, SIL, .6, 1.1);
    }
    /* 회전층: [중심 x, y, 감싸는 반지름, 회전 속도(rad/s), 시작 각, 빛 번짐, 그리기] */
    var PARTS = [
      [X, Y, 136, .06, 0, 0, function () { poly(X, Y, 134, 7, -Math.PI / 2, SIL, .16); }],
      [X, Y, 120, -.1, 0, 0, function () { dotRing(X, Y, 118, 90, .7, SIL, .35); }],
      [X, Y, 79, .16, 0, 1, function () { dotRing(X, Y, 77, 110, .6, SIL, .8); }],
      [X, Y, 101, -.09, 0, 0, function () { dotRing(X, Y, 100, 160, .45, SIL, .4); ticks(X, Y, 90, 72, 2, SIL, .25); }],
      [X, Y, 82, .05, 0, 0, function () { for (var p = 0; p < 8; p++) { var t = p / 8 * TAU; arc(X + Math.cos(t) * 78, Y + Math.sin(t) * 78, 50, t + Math.PI - .78, t + Math.PI + .78, SIL, .09); } }],
      [X, Y, 116, .13, 0, 0, function () { arc(X, Y, 113, 0, .55, SIL, .4, 1.6); arc(X, Y, 113, 3.3, 3.7, SIL, .4, 1.6); }],
      /* 왼쪽 위: 겹친 불규칙 다각형 */
      [85, 72, 50, .16, 0, 0, function () { poly(85, 72, 44, 6, 0, SIL, .38); st(SIL, .3); c.beginPath(); c.ellipse(85, 72, 41, 33, .4, 0, TAU); c.stroke(); }],
      [85, 72, 50, -.22, .8, 0, function () { poly(85, 72, 42, 7, .3, SIL, .34); }],
      [85, 72, 50, .28, 1.6, 0, function () { poly(85, 72, 40, 5, .1, SIL, .3); st(SIL, .26); c.beginPath(); c.ellipse(85, 72, 38, 30, -.5, 0, TAU); c.stroke(); }],
      [85, 72, 50, -.12, 2.4, 0, function () { poly(85, 72, 46, 6, .5, SIL, .22); }],
      /* 왼쪽 가운데 */
      [160, 170, 64, .22, 0, 0, function () { arc(160, 170, 58, -2.6, -1.75, SIL, .45, 2.6); arc(160, 170, 58, 1.9, 2.5, SIL, .4, 2.6); }],
      [160, 170, 46, -.14, 0, 0, function () { dotRing(160, 170, 45, 90, .45, SIL, .45); }],
      /* 왼쪽 아래: 굵은 점 두 구간 + 가는 점선 */
      [92, 277, 54, -.18, 0, 1, function () { dotRing(92, 277, 50, 8, 1.5, SIL, .85, 3.55, 4.35); dotRing(92, 277, 50, 8, 1.2, SIL, .7, 5.2, 6.0); }],
      [92, 277, 56, .08, 0, 0, function () { dotRing(92, 277, 54, 120, .45, SIL, .4); }],
      /* 가운데 아래: 오른쪽 굵은 호 + 점선 */
      [357, 270, 52, -.2, 0, 0, function () { arc(357, 270, 48, -1.1, 1.4, SIL, .45, 3); }],
      [357, 270, 54, .11, 0, 0, function () { dotRing(357, 270, 52, 70, .5, SIL, .4); }],
      /* 오른쪽 위: 기울어진 타원 모양 블록 점선 */
      [645, 75, 36, .26, 0, 1, function () { c.save(); c.translate(645, 75); c.rotate(-.45); for (var i = 0; i < 12; i++) { var t = i / 12 * TAU; st(SIL, .8 - (i % 3) * .12, 3); c.beginPath(); c.ellipse(0, 0, 20, 9, 0, t, t + .28); c.stroke(); } c.restore(); }],
      [645, 75, 34, -.12, 0, 0, function () { ticks(645, 75, 28, 24, 2.5, SIL, .25); }],
      /* 열쇠 고리: 촘촘한 점 테두리 */
      [533, 125, 36, -.15, 0, 0, function () { dotRing(533, 125, 33, 60, .6, SIL, .55); }],
      /* 구슬 표식 고리: 점선 테 + 짧은 호 */
      [612, 190, 56, .16, 0, 0, function () { dotRing(612, 190, 52, 80, .5, SIL, .45); arc(612, 190, 52, .5, 1.1, SIL, .4, 1.4); arc(612, 190, 52, 3.6, 4.2, SIL, .4, 1.4); }],
      /* 갈고리 고리: 가는 연속 원(위쪽만 조금 끊김) */
      [515, 258, 44, -.12, 0, 0, function () { arc(515, 258, 40, -1.0, 4.4, SIL, .55, 1.3); }],
      [683, 345, 80, .07, 0, 0, function () { ticks(683, 345, 73, 70, 3, SIL, .3); }]
    ];

    /* ── 정지층: 별도 캔버스에 한 번만 (빛 번짐은 흐린 사본을 밝게 겹쳐서) ── */
    function glowify(cnv) {
      if (!hasFilter) return;
      var tmp = document.createElement('canvas'); tmp.width = cnv.width; tmp.height = cnv.height; tmp.getContext('2d').drawImage(cnv, 0, 0);
      var x = cnv.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'lighter';
      x.filter = 'blur(' + (2.5 * dpr) + 'px)'; x.globalAlpha = .5; x.drawImage(tmp, 0, 0);
      x.filter = 'blur(' + (8 * dpr) + 'px)'; x.globalAlpha = .3; x.drawImage(tmp, 0, 0); x.restore();
    }
    function build() {
      g = fit(cv); dpr = quality ? Math.min(devicePixelRatio || 1, 2) : 1;
      if (!quality) { cv.width = Math.round(g.w); cv.height = Math.round(g.h); g.c.setTransform(1, 0, 0, 1, 0, 0); }
      var w = g.w, h = g.h, mob = small.matches;
      if (mob) { sc = w / 380; ox = w / 2 - X * sc; oy = h * .27 - Y * sc; }
      else { sc = Math.min(w / RW, h / RH); ox = (w - RW * sc) / 2; oy = (h - RH * sc) / 2 - h * .04; }
      U = 1 / sc * (mob ? 1 : 1.15);
      /* 정지층: 가장자리 깊이감 이동을 위해 사방 24px 여유를 두고 그린다 */
      var PAD = 24; bg.width = Math.ceil((w + PAD * 2) * dpr); bg.height = Math.ceil((h + PAD * 2) * dpr);
      bg.style.cssText = 'inset:auto;left:' + -PAD + 'px;top:' + -PAD + 'px;width:' + (w + PAD * 2) + 'px;height:' + (h + PAD * 2) + 'px;';
      c = bg.getContext('2d'); c.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ox + PAD), dpr * (oy + PAD)); staticBack();
      var gl = document.createElement('canvas'); gl.width = bg.width; gl.height = bg.height;
      c = gl.getContext('2d'); c.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ox + PAD), dpr * (oy + PAD)); staticGlow(); glowify(gl);
      var bgc = bg.getContext('2d'); bgc.setTransform(1, 0, 0, 1, 0, 0); bgc.drawImage(gl, 0, 0);
      /* 일식: 코로나 빛살 두 겹 + 다이아몬드 링 섬광 (한 번 그려 두고 매 프레임 돌려 붙인다) */
      fx.corona = [0, 1].map(function (layer) {
        var R = 132, size = Math.ceil(R * 2 * sc * dpr), cnv = document.createElement('canvas'); cnv.width = cnv.height = size;
        c = cnv.getContext('2d'); c.setTransform(dpr * sc, 0, 0, dpr * sc, size / 2, size / 2); U = 1 / sc * 1.1;
        if (!layer) {                                  /* 안쪽 코로나 빛무리 */
          var gr = c.createRadialGradient(0, 0, 56, 0, 0, R);
          gr.addColorStop(0, 'rgba(255,248,230,.95)'); gr.addColorStop(.05, 'rgba(255,236,190,.7)'); gr.addColorStop(.16, 'rgba(242,210,122,.32)');
          gr.addColorStop(.42, 'rgba(212,167,58,.1)'); gr.addColorStop(1, 'rgba(212,167,58,0)');
          c.fillStyle = gr; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
        }
        var seed = layer ? 97 : 31, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        c.lineCap = 'round';
        for (var i = 0; i < (layer ? 90 : 150); i++) {   /* 코로나 빛살 (방향마다 길이가 다른 섬유) */
          var a = rnd() * TAU, len = (layer ? 20 : 8) + Math.pow(rnd(), 2.2) * (layer ? 62 : 40), w = .4 + rnd() * (layer ? 1 : 1.8);
          var lg = c.createLinearGradient(Math.cos(a) * 57, Math.sin(a) * 57, Math.cos(a) * (57 + len), Math.sin(a) * (57 + len));
          var col = rnd() < .45 ? '242,210,122' : '236,240,244';
          lg.addColorStop(0, 'rgba(' + col + ',' + (.35 + rnd() * .4) + ')'); lg.addColorStop(1, 'rgba(' + col + ',0)');
          c.strokeStyle = lg; c.lineWidth = w * U; c.beginPath(); c.moveTo(Math.cos(a) * 57, Math.sin(a) * 57);
          var bend = (rnd() - .5) * .18; c.quadraticCurveTo(Math.cos(a + bend) * (57 + len * .5), Math.sin(a + bend) * (57 + len * .5), Math.cos(a + bend * 1.6) * (57 + len), Math.sin(a + bend * 1.6) * (57 + len)); c.stroke();
        }
        glowify(cnv);
        return { img: cnv, half: R * sc };
      });
      var fs = Math.ceil(80 * dpr), fl = document.createElement('canvas'); fl.width = fl.height = fs;
      c = fl.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, fs / 2, fs / 2);
      var fg = c.createRadialGradient(0, 0, 0, 0, 0, 40); fg.addColorStop(0, 'rgba(255,255,250,1)'); fg.addColorStop(.12, 'rgba(255,240,200,.85)'); fg.addColorStop(.4, 'rgba(242,210,122,.18)'); fg.addColorStop(1, 'rgba(242,210,122,0)');
      c.fillStyle = fg; c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,250,235,.9)'; c.beginPath(); c.moveTo(-40, 0); c.lineTo(0, -1.2); c.lineTo(40, 0); c.lineTo(0, 1.2); c.fill(); c.beginPath(); c.moveTo(0, -26); c.lineTo(1, 0); c.lineTo(0, 26); c.lineTo(-1, 0); c.fill();
      fx.flare = fl;
      /* 달 원반 + 가장자리 빛 테: 회전하지 않으므로 한 장으로 */
      var ms = Math.ceil(124 * sc * dpr), mc = document.createElement('canvas'); mc.width = mc.height = ms;
      c = mc.getContext('2d'); c.setTransform(dpr * sc, 0, 0, dpr * sc, ms / 2, ms / 2);
      var mg = c.createRadialGradient(-8, -10, 4, 0, 0, 57); mg.addColorStop(0, '#0d0a06'); mg.addColorStop(.85, '#040302'); mg.addColorStop(1, '#000');
      c.fillStyle = mg; c.beginPath(); c.arc(0, 0, 57, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,246,220,.75)'; c.lineWidth = .9; c.beginPath(); c.arc(0, 0, 57.4, 0, TAU); c.stroke();
      fx.moon = { img: mc, half: 62 * sc };
      /* 반짝이는 별 그림 (작아서 붙이기 부담이 없다) */
      var sz = Math.ceil(64 * dpr), sc2 = document.createElement('canvas'); sc2.width = sc2.height = sz;
      c = sc2.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, sz / 2, sz / 2); U = 1; star(0, 0, 26, .9); glowify(sc2); c.setTransform(dpr, 0, 0, dpr, sz / 2, sz / 2); star(0, 0, 17, 1, '255, 250, 240'); fx.star = sc2;   /* 금빛 번짐 + 흰 중심 */
      U = 1 / sc * (mob ? 1 : 1.15);
      c = g.c;
      dust = []; var n = quality > 1 ? (mob ? 28 : 60) : quality ? 20 : 0;
      for (var i = 0; i < n; i++) dust.push({ x: Math.random(), y: Math.random(), s: .4 + Math.random() * 1.4, v: .006 + Math.random() * .024, p: Math.random() * 6.28 });
    }
    build();
    watch(cv, function () { build(); if (reduce) draw(0); });
    addEventListener('pointermove', function (e) { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });

    function P(x, y) { return [ox + x * sc, oy + y * sc]; }
    function draw(t) {
      var w = g.w, h = g.h, s = reduce ? 0 : t / 1000, dt = lastT ? t - lastT : 16.7, k = Math.min(3, dt / 16.667); lastT = t;
      if (!born) born = t;
      /* 40프레임 평균이 33ms(30fps)를 넘으면 품질을 한 단계 낮춘다 (처음 1초 등장 연출 동안은 재지 않는다) */
      /* 등장 직후 1.5초는 재지 않고, 20프레임 묶음이 두 번 연속 33ms를 넘거나 한 번이라도 60ms를 넘으면 품질을 한 단계 낮춘다 */
      if (t - born > 1500 && dt < 1000) { acc += dt; if (++cnt >= 20) { bad = acc / cnt > 33 ? bad + 1 : 0; if ((bad >= 2 || acc / cnt > 60) && quality > 0) { quality--; bad = 0; build(); } acc = 0; cnt = 0; } }
      /* 최저 품질: 그림은 초당 30번만 새로 그리고(남는 프레임은 건너뜀) 배경층 이동도 멈춘다 */
      if (!quality && !reduce) { odd = !odd; if (odd) return; }
      var dd = quality ? dpr : 1;
      c = g.c; c.setTransform(dd, 0, 0, dd, 0, 0); c.clearRect(0, 0, w, h);
      px += (mx - px) * (1 - Math.pow(.96, k)); py += (my - py) * (1 - Math.pow(.96, k));
      var intro = reduce ? 1 : Math.min(1, (t - born) / 1800), ease = 1 - Math.pow(1 - intro, 3);
      var bx = px * -8, by = py * -8, fxp = px * -18, fyp = py * -18;      /* 뒤 층은 조금, 가운데 고리는 많이 움직여 깊이감 */
      if (quality) bg.style.transform = 'translate(' + bx.toFixed(2) + 'px,' + by.toFixed(2) + 'px)';
      if (bg.style.opacity !== String(ease)) bg.style.opacity = ease;
      c.globalAlpha = ease;
      /* 회전층: 선으로 직접 그린다. 빛 번짐 대상은 굵고 옅은 선을 먼저 한 번 더 */
      PARTS.forEach(function (p) {
        var back = p[0] !== X || p[1] !== Y, q = P(p[0], p[1]), grow = back ? 1 : .94 + .06 * ease;
        c.save(); c.translate(q[0] + (back ? bx : fxp), q[1] + (back ? by : fyp)); c.rotate(p[4] + s * p[3]); c.scale(sc * grow, sc * grow); c.translate(-p[0], -p[1]);
        if (p[5] && quality > 1) { BLOOM = true; c.globalCompositeOperation = 'lighter'; p[6](); BLOOM = false; c.globalCompositeOperation = 'source-over'; }
        p[6](); c.restore();
      });

      var m = P(X, Y); m[0] += fxp; m[1] += fyp;
      /* ── 일식 ── 코로나(밝게 더하기) → 검은 달 원반 → 가장자리 빛 테 → 다이아몬드 링 섬광 */
      var breath = .86 + .14 * Math.sin(s * .9);
      c.globalCompositeOperation = 'lighter';
      fx.corona.forEach(function (co, i) {
        if (i && quality < 2) return;
        c.save(); c.translate(m[0], m[1]); c.rotate(i ? -s * .045 : s * .03); c.globalAlpha = ease * (i ? .75 + .25 * Math.sin(s * 1.3) : breath);
        c.drawImage(co.img, -co.half, -co.half, co.half * 2, co.half * 2); c.restore();
      });
      c.globalAlpha = ease; c.globalCompositeOperation = 'source-over';
      c.drawImage(fx.moon.img, m[0] - fx.moon.half, m[1] - fx.moon.half, fx.moon.half * 2, fx.moon.half * 2);
      c.globalCompositeOperation = 'lighter';
      if (quality) for (var bb = 0; bb < 7; bb++) {      /* 베일리 구슬: 가장자리에서 깜빡이는 빛 알갱이 */
        var ba = bb * .9 + s * .03, bl = Math.max(0, Math.sin(s * 2.1 + bb * 1.7));
        c.fillStyle = 'rgba(255,244,210,' + (bl * .8 * ease) + ')'; c.beginPath(); c.arc(m[0] + Math.cos(ba) * 57.5 * sc, m[1] + Math.sin(ba) * 57.5 * sc, (.8 + bl) * sc * .6, 0, TAU); c.fill();
      }
      var fa = -2.3 + s * .08, fsz = 34 * sc * (.75 + .25 * Math.sin(s * 1.7)) * ease;   /* 다이아몬드 링 */
      c.globalAlpha = ease; c.drawImage(fx.flare, m[0] + Math.cos(fa) * 57.5 * sc - fsz / 2, m[1] + Math.sin(fa) * 57.5 * sc - fsz / 2, fsz, fsz);
      c.globalCompositeOperation = 'source-over';
      c.globalCompositeOperation = 'lighter';
      /* 가운데 띠를 따라 흐르는 빛줄기 */
      if (!reduce && quality) for (var j = 0; j < 14; j++) {
        var a0 = s * .7 - j * .035; c.strokeStyle = 'rgba(' + GOLD + ',' + (.55 * (1 - j / 14) * ease) + ')'; c.lineWidth = (3.2 - j * .15) * sc * .6;
        c.beginPath(); c.arc(m[0], m[1], 72 * sc, a0, a0 + .05); c.stroke();
        c.beginPath(); c.arc(m[0], m[1], 72 * sc, a0 + Math.PI, a0 + Math.PI + .05); c.stroke();
      }
      /* 궤도를 도는 불꽃 + 꼬리 */
      if (!reduce) [[X, Y, 118, .22, 0], [X, Y, 96, -.3, 2], [160, 170, 58, .35, 1], [612, 190, 52, -.28, 3], [357, 270, 53, .4, 4], [92, 277, 50, -.3, 5]].forEach(function (o) {
        var q = P(o[0], o[1]), back = o[0] !== X; q[0] += back ? bx : fxp; q[1] += back ? by : fyp;
        var tail = quality > 1 ? 8 : quality ? 3 : 1;
        for (var i = 0; i < tail; i++) {
          var ang = o[4] + s * o[3] - i * .03 * Math.sign(o[3]), rr = o[2] * sc;
          c.fillStyle = 'rgba(' + (i ? SIL : GOLD) + ',' + ((1 - i / tail) * .85 * ease) + ')';
          c.beginPath(); c.arc(q[0] + Math.cos(ang) * rr, q[1] + Math.sin(ang) * rr, Math.max(.8, (2.2 - i * .2) * sc * .55), 0, TAU); c.fill();
        }
      });
      /* 구석 계기 레이더 스윕 */
      var gq = P(683, 345); gq[0] += bx; gq[1] += by;
      if (c.createConicGradient && !reduce && quality > 1) {
        var sw = (s * .9) % TAU, cg = c.createConicGradient(sw - .6, gq[0], gq[1]);
        cg.addColorStop(0, 'rgba(' + SIL + ',0)'); cg.addColorStop(.095, 'rgba(' + SIL + ',.22)'); cg.addColorStop(.1, 'rgba(' + SIL + ',0)'); cg.addColorStop(1, 'rgba(' + SIL + ',0)');
        c.fillStyle = cg; c.beginPath(); c.moveTo(gq[0], gq[1]); c.arc(gq[0], gq[1], 94 * sc, Math.PI, TAU); c.closePath(); c.fill();
      }
      /* 좌우 별: 반짝임 */
      [[256, 121, 0], [459, 121, 1.7]].forEach(function (st2) {
        var q = P(st2[0], st2[1]), tw = .82 + .18 * Math.sin(s * 1.6 + st2[2]), sz = 14 * sc * tw * ease;
        c.globalAlpha = .9 * ease; c.drawImage(fx.star, q[0] + fxp - sz, q[1] + fyp - sz, sz * 2, sz * 2);
      });
      c.globalAlpha = 1;
      /* 금가루 */
      for (var d2 = 0; d2 < dust.length; d2++) {
        var d = dust[d2]; if (!reduce) { d.y -= d.v * .016 * k; if (d.y < -.02) { d.y = 1.02; d.x = Math.random(); } }
        var x = (d.x + Math.sin(s * .4 + d.p) * .012) * w, y = d.y * h;
        c.globalAlpha = (.2 + .45 * Math.abs(Math.sin(s * .8 + d.p))) * ease; c.fillStyle = d.s > 1.4 ? '#fff3c4' : (d2 % 3 ? '#d4a73a' : '#d6dce2');
        c.fillRect(x, y, d.s, d.s);
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
    RSC.homeFxQuality = function () { return quality; };
    RSC.on(document, 'rsc:ready', function () { born = 0; });   /* 로딩 화면이 걷히는 순간 마법진 등장 연출을 다시 시작 */   /* 점검용 */
    if (reduce) draw(0); else loop(cv, draw);
  })();

  /* ── 01 HOME: 임시 일러스트를 3초마다 순서대로 ── */
  (function () {
    var box = $('[data-show]'); if (!box) return;
    var imgs = [].slice.call(box.querySelectorAll('img')), k = 0;
    function next() {
      imgs[k].classList.remove('is-on'); k = (k + 1) % imgs.length; imgs[k].classList.add('is-on');
    }
    var timer = setInterval(function () { if (!document.hidden) next(); }, 3000);
    RSC.onLeave(function () { clearInterval(timer); });
  })();

  /* ── 02 CHARACTER ── */
  $('[data-strips]').innerHTML = D.characters.slice(0, 5).map(function (ch, i) {
    return '<li class="rv" style="--d:' + (i + 1) + '"><a class="strip" href="characters.html#c=' + ch.id + '" aria-label="캐릭터 ' + ch.id + ' ' + esc(ch.name) + '">' +
      (ch.thumb ? '<img class="strip__img" src="' + esc(ch.thumb) + '" alt="">' : '<span class="strip__empty mono">NO IMAGE</span>') +
      '<span class="strip__no mono">' + ch.id + '</span>' +
      '<span class="strip__base">' + EMBLEM + '<span class="mono">' + ch.code + '</span><strong>' + esc(ch.name) + '</strong></span></a></li>';
  }).join('');

  /* ── 03 NATION: 점 입자 3D 모델 ── */
  var nation = (function () {
    var cv = $('.hud__model'), g = fit(cv), N = small.matches ? 1500 : 3200;
    var SPIN = .004;                                  /* 사용자 요청: 애니메이션 줄이기 설정과 관계없이 천천히 돈다 */                    /* 기준 회전 속도(60fps 한 프레임당) */
    var cur = new Float32Array(N * 3), tgt = new Float32Array(N * 3), idx = 0, rotY = .6, rotX = -.28, vel = SPIN, drag = null, last = 0;
    var rnd = Math.random, PI2 = 6.2832;
    var SHAPES = [
      function () {                                     /* 첨탑 도시 */
        var u = rnd();
        if (u < .5) { var y = rnd(), r = .22 * Math.pow(1 - y, 1.6) + .015, a = rnd() * PI2; return [r * Math.cos(a), -.78 + y * 1.85, r * Math.sin(a)]; }
        if (u < .75) { var a2 = rnd() * PI2, r2 = .55 + rnd() * .35; return [r2 * Math.cos(a2), -.78 + (rnd() - .5) * .03, r2 * Math.sin(a2)]; }
        var k = (rnd() * 6 | 0) / 6 * PI2, h = rnd(), rr = .05 * (1 - h); var a3 = rnd() * PI2;
        return [.72 * Math.cos(k) + rr * Math.cos(a3), -.78 + h * .7, .72 * Math.sin(k) + rr * Math.sin(a3)];
      },
      function () {                                     /* 고리 세계 */
        var u = rnd();
        if (u < .6) { var a = rnd() * PI2, b = rnd() * PI2, R = .82, r = .07; return [(R + r * Math.cos(b)) * Math.cos(a), r * Math.sin(b) * 1.4, (R + r * Math.cos(b)) * Math.sin(a)]; }
        var t = Math.acos(2 * rnd() - 1), p = rnd() * PI2, s = .36; return [s * Math.sin(t) * Math.cos(p), s * Math.cos(t), s * Math.sin(t) * Math.sin(p)];
      },
      function () {                                     /* 결정 */
        var u = rnd();
        if (u < .8) { var a = rnd(), b = rnd() * (1 - a), cc = 1 - a - b, sx = rnd() < .5 ? -1 : 1, sy = rnd() < .5 ? -1 : 1, sz = rnd() < .5 ? -1 : 1; return [sx * a * .5, sy * b * 1.15, sz * cc * .5]; }
        var a2 = rnd() * PI2, r2 = .78 + rnd() * .2; return [r2 * Math.cos(a2), (rnd() - .5) * .9 * Math.sin(a2 * 3), r2 * Math.sin(a2)];
      },
      function () {                                     /* 돔 성소 */
        var u = rnd();
        if (u < .45) { var t = Math.acos(rnd()), p = rnd() * PI2, s = .62; return [s * Math.sin(t) * Math.cos(p), s * Math.cos(t) - .25, s * Math.sin(t) * Math.sin(p)]; }
        if (u < .75) { var k = (rnd() * 12 | 0) / 12 * PI2; return [.88 * Math.cos(k) + (rnd() - .5) * .03, -.75 + rnd() * .75, .88 * Math.sin(k) + (rnd() - .5) * .03]; }
        var a = rnd() * PI2, r = Math.sqrt(rnd()) * 1; return [r * Math.cos(a), -.76, r * Math.sin(a)];
      }
    ];
    function shape(i) { var f = SHAPES[i % SHAPES.length]; for (var k = 0; k < N; k++) { var p = f(); tgt[k * 3] = p[0]; tgt[k * 3 + 1] = p[1]; tgt[k * 3 + 2] = p[2]; } }
    shape(0);
    for (var k = 0; k < N * 3; k++) cur[k] = (rnd() - .5) * 3;      /* 흩어진 상태에서 모여든다 */
    watch(cv, function () { g = fit(cv); if (reduce) draw(performance.now()); });

    cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      rotY += dx * .008; rotX = Math.max(-1.1, Math.min(1.1, rotX + dy * .006)); vel = dx * .0012;
    });
    function up() { drag = null; }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

    function draw(t) {
      var c = g.c, w = g.w, h = g.h;
      var k = last ? Math.min(3, (t - last) / 16.667) : 1; last = t;   /* 모니터 주사율과 상관없이 같은 속도 */
      c.clearRect(0, 0, w, h);
      if (!drag) { rotY += vel * k; vel += (SPIN - vel) * (1 - Math.pow(.98, k)); }
      var cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
      var S = Math.min(w, h) * .36, ox = w / 2, oy = h / 2;
      var ease = 1 - Math.pow(1 - .028, k);
      c.globalCompositeOperation = 'lighter';
      for (var i = 0; i < N; i++) {
        var j = i * 3;
        cur[j] += (tgt[j] - cur[j]) * ease; cur[j + 1] += (tgt[j + 1] - cur[j + 1]) * ease; cur[j + 2] += (tgt[j + 2] - cur[j + 2]) * ease;
        var x = cur[j], y = cur[j + 1], z = cur[j + 2];
        var x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
        var y1 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
        var f = 1 / (1 + z2 * .32), px = ox + x1 * S * f, py = oy - y1 * S * f;
        var a = .22 + (1 - (z2 + 1.2) / 2.4) * .7;
        c.globalAlpha = a < .08 ? .08 : a > 1 ? 1 : a;
        /* 금빛 배경 위에서도 보이도록: 밝은 상아·은색 입자 + 앞쪽일수록 밝게 */
        var hi = i % 9 === 0;
        c.fillStyle = hi ? '#fffaf0' : (i % 3 ? '#f6dc96' : '#e3e8ec');
        var sz = f * (hi ? 2.2 : 1.6);
        c.fillRect(px, py, sz, sz);
        if (hi) { c.globalAlpha *= .22; c.fillRect(px - sz, py - sz, sz * 3, sz * 3); }
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
    loop(cv, draw);

    var panel = $('.npanel'), ticks = $('[data-n-ticks]'), emb = $('[data-n-emb]');
    ticks.innerHTML = D.nations.map(function () { return '<li></li>'; }).join('');
    var GLYPH = [   /* 첨탑 · 고리 · 결정 · 돔 (3D 모델 형태와 짝) */
      'M20 4l4 26h-8z M8 34h24 M12 34l2-8 M28 34l-2-8',
      'M20 13a7 7 0 110 14 7 7 0 010-14z M4 20c0-4 7-7 16-7s16 3 16 7-7 7-16 7S4 24 4 20z',
      'M20 3l9 17-9 17-9-17z M11 20h18 M20 3v34',
      'M6 30a14 14 0 0128 0z M3 30h34 M10 30v4 M30 30v4 M20 16v-6'
    ];
    emb.innerHTML = D.nations.map(function (n, i) {
      return '<li><button data-n-pick="' + i + '" aria-label="' + esc(n.name) + ' ' + n.id + '"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="' + GLYPH[n.shape % 4] + '"/></svg><span class="mono">' + n.id + '</span></button></li>';
    }).join('');
    emb.addEventListener('click', function (e) { var b = e.target.closest('[data-n-pick]'); if (b && +b.dataset.nPick !== idx) show(+b.dataset.nPick); });
    $('[data-n-prev]').innerHTML = RSC.chev(-1); $('[data-n-next]').innerHTML = RSC.chev(1);
    function show(i, quiet) {
      idx = (i + D.nations.length) % D.nations.length;
      var n = D.nations[idx];
      shape(n.shape);
      RSC.scramble($('[data-n-code]'), n.code, 800);
      $('[data-n-en]').textContent = n.nameEn;
      $('[data-n-name]').textContent = n.name;
      $('[data-n-count]').textContent = (idx + 1) + ' / ' + D.nations.length;
      $('[data-n-desc]').textContent = n.desc || '이 국가의 기록은 아직 등록되지 않았습니다.';
      [].forEach.call(ticks.children, function (li, k) { li.classList.toggle('is-on', k === idx); });
      [].forEach.call(emb.children, function (li, k) { li.classList.toggle('is-on', k === idx); });
      if (!quiet) { panel.classList.remove('is-swap'); void panel.offsetWidth; panel.classList.add('is-swap'); }
    }
    $('[data-n-prev]').addEventListener('click', function () { show(idx - 1); });
    $('[data-n-next]').addEventListener('click', function () { show(idx + 1); });
    show(0, true);
    return { current: function () { return idx; } };
  })();

  /* ── 04 MAP: 세계 지도 (원본 2000×1125를 4배로). 끌어서 이동, 확대·축소, 미니맵 ── */
  var map = (function () {
    var view = $('[data-map]'), world = $('[data-world]'), K = 4, W = 2000 * K, H = 1125 * K;
    var st = { x: 0, y: 0, z: .3 }, zmin = .1, zmax = 1.4, ptr = new Map(), pinch = 0, anim = 0, sel = -1;
    var L = D.mapLabels || [], DOS = D.dossiers || {}, box = view.closest('.mapbox'), SRC = 'assets/img/map/world.svg?v=1';
    var mini = $('[data-mini]'), miniBox = $('[data-mini-box]'), miniImg = $('[data-mini-img]');

    world.style.width = W + 'px'; world.style.height = H + 'px';
    world.innerHTML = '<img class="mapart" alt="" draggable="false" data-art width="' + W + '" height="' + H + '" decoding="async">' +
      L.map(function (l, i) {
        var t = esc(l.name).replace(/\\n|\n/g, '<br>');
        return '<button class="mlab mlab--' + l.kind + (l.vert ? ' is-vert' : '') + '" data-lab="' + i + '" style="left:' + l.x * K + 'px;top:' + l.y * K + 'px;' +
          (l.color ? '--c:' + l.color + ';' : '') + (l.rot ? '--r:' + l.rot + 'deg;' : '') + (l.size ? '--s:' + l.size * K + 'px;' : '') + '">' + t + '</button>';
      }).join('');
    /* 큰 지도 그림은 지도 화면에 가까워졌을 때 불러온다 */
    var art = world.querySelector('[data-art]');
    new IntersectionObserver(function (es, ob) { if (es[0].isIntersecting || es[0].target.closest('.sec.is-cur')) { art.src = SRC; miniImg.src = SRC; ob.disconnect(); } }, { rootMargin: '600px' }).observe(view);
    setTimeout(function () { if (!art.src) { art.src = SRC; miniImg.src = SRC; } }, 4000);

    var named = L.map(function (l, i) { return [l, i]; }).filter(function (p) { return p[0].kind === 'nation'; });
    $('[data-maplist]').innerHTML = named.map(function (p, k) {
      var d = DOS[p[0].name], st = !d ? 'No Data' : Object.keys(d).length ? 'Dossier' : 'Pending';
      return '<li><button data-loc="' + p[1] + '"' + (d ? ' class="has-dos"' : '') + '><span class="mono gold">' + String(k + 1).padStart(2, '0') + '</span><strong>' + esc(p[0].name.replace(/\\n|\n/g, ' ')) + '</strong><span class="mono">' + st + '</span></button></li>';
    }).join('');

    function size() { return view.getBoundingClientRect(); }
    function apply() {
      var r = size(); if (!r.width) return;
      zmin = Math.max(r.width / W, r.height / H);            /* 가장 멀리서도 화면을 꽉 채운다 (전체가 한눈에 들어오지는 않음) */
      st.z = Math.max(zmin, Math.min(zmax, st.z));
      st.x = Math.min(0, Math.max(r.width - W * st.z, st.x));
      st.y = Math.min(0, Math.max(r.height - H * st.z, st.y));
      world.style.transform = 'translate(' + st.x.toFixed(1) + 'px,' + st.y.toFixed(1) + 'px) scale(' + st.z.toFixed(4) + ')';
      world.style.setProperty('--z', st.z);
      $('[data-mz]').textContent = (st.z / zmin).toFixed(1) + 'x';
      /* 미니맵의 현재 영역 */
      var mw = mini.clientWidth, mh = mini.clientHeight;
      miniBox.style.left = (-st.x / st.z / W * mw) + 'px'; miniBox.style.top = (-st.y / st.z / H * mh) + 'px';
      miniBox.style.width = (r.width / st.z / W * mw) + 'px'; miniBox.style.height = (r.height / st.z / H * mh) + 'px';
    }
    function zoomAt(cx, cy, z) {
      z = Math.max(zmin, Math.min(zmax, z));
      st.x = cx - (cx - st.x) * (z / st.z); st.y = cy - (cy - st.y) * (z / st.z); st.z = z; apply();
    }
    function fly(wx, wy, z, ox) {
      cancelAnimationFrame(anim);
      var r = size(), a = { x: st.x, y: st.y, z: st.z };
      z = Math.max(zmin, Math.min(zmax, z));
      var b = { x: r.width / 2 + (ox || 0) - wx * z, y: r.height / 2 - wy * z, z: z }, t0 = performance.now(), dur = 1400;
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        st.z = a.z + (b.z - a.z) * e; st.x = a.x + (b.x - a.x) * e; st.y = a.y + (b.y - a.y) * e; apply();
        if (p < 1) anim = requestAnimationFrame(step);
      })(t0);
    }
    /* 처음에는 바다 한가운데를 가깝게: 주변 나라는 직접 끌어서 찾아본다 */
    function reset() { var r = size(); if (!r.width) return; st.z = zmin * 2.4; st.x = r.width / 2 - 1000 * K * st.z; st.y = r.height / 2 - 600 * K * st.z; apply(); }
    /* 3D에서는 두 단계: 나라를 고르면 3D 현판 + [세부정보 보기], 그 버튼을 누르면(detail) 기록 창이 열린다.
       2D에서는 바로 기록 창. */
    function select(i, move, detail) {
      sel = i;
      world.querySelectorAll('[data-lab]').forEach(function (p) { p.classList.toggle('is-on', +p.dataset.lab === i); });
      document.querySelectorAll('[data-loc]').forEach(function (p) { p.classList.toggle('is-on', +p.dataset.loc === i); });
      var land = !!L[i] && L[i].kind !== 'sea', staged = mode === '3d' && !!m3d;
      dos.show(land && (!staged || detail) ? L[i] : null);
      /* 기록 창이 지도 오른쪽을 가리면, 남은 왼쪽 영역의 가운데로 옮긴다 */
      var pw = dos.width(), vw = size().width, ox = pw && pw < vw * .7 ? -pw / 2 : 0;
      if (move && L[i] && mode === '2d') fly(L[i].x * K, L[i].y * K, Math.max(zmin * 3, .45), ox);
      if (m3d) {
        var k = TI[i] == null ? -1 : TI[i];
        m3d.select(k, L[i] && L[i].color);
        if (staged) {
          if (k >= 0) { m3d.title(k, plaqueInfo(i)); m3d.lift(!!detail); } else m3d.hideTitle();
          if (move && k >= 0) m3d.focus(k, -ox);
        } else m3d.hideTitle();
      }
      box.classList.toggle('has-dos', dos.width() > 0);
    }
    /* 기록 창 닫기: 3D에서는 현판 단계로 돌아가고, 2D에서는 선택을 푼다 */
    function closeDos() { if (mode === '3d' && m3d && sel >= 0) select(sel, false); else select(-1); }
    function plaqueInfo(i) {
      var l = L[i], d = DOS[nm2(l)];
      return { name: nm2(l), en: d && d.en, color: l.color, code: info(TI[i]).code,
        status: d ? (d.basics ? 'Dossier Open' : 'Record Pending') : 'Sealed · No Data' };
    }
    function nm2(l) { return (l.name || '').replace(/\\n|\n/g, ' '); }

    /* ── 국가 기록 창 ── */
    var dos = (function () {
      var box = $('[data-dos]'), body = $('[data-dos-body]'), cur = null, timer = 0, io = null, spy = null;
      var RAIL = [['basic', '01', '개요'], ['faith', '02', '종교'], ['food', '03', '식량'], ['lang', '04', '언어'], ['admin', '05', '행정 구역']];
      function nm(l) { return l.name.replace(/\\n|\n/g, ' '); }
      function pad(n) { return String(n).padStart(2, '0'); }

      /* ── 해독 (떡밥 연출): 가림막 → 뒤섞인 기호 → 진짜 글자 ──
         진짜 글자(.dc-t)는 늘 자리를 잡고 있고 기호(.dc-x)만 그 위에 겹친다 → 줄이 흔들리지 않고 화면 낭독기는 진짜 글자를 읽는다.
         rAF 하나가 전부 돌리고, 스크롤 영역에 들어온 것만 해독하며, 동시에 10개까지. 무거우면 남은 것을 한 번에 끝낸다. */
      var GLY = '▚▞▙▟░▒#/\\<>01';
      function D(t, cls) { var s = esc(t); return '<span class="dc' + (reduce ? '' : ' is-mask') + (cls ? ' ' + cls : '') + '"><span class="dc-t">' + s + '</span><span class="dc-x" aria-hidden="true"></span></span>'; }
      var Dec = {
        q: [], act: [], raf: 0, last: 0, heavy: 0, tick: 0,
        add: function (els, base) { var now = performance.now(), self = this; els.forEach(function (e, i) { if (e._q || !e.classList.contains('is-mask')) return; e._q = 1; e._s = now + (base || 0) + Math.min(i, 14) * 45; self.q.push(e); }); this.run(); },
        run: function () { var self = this; if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(function (t) { self.frame(t); }); } },
        frame: function (now) {
          var self = this; this.raf = 0;
          this.heavy = now - this.last > 70 ? this.heavy + 1 : 0; this.last = now;
          if (this.heavy >= 3) return this.flush();
          this.q.sort(function (a, b) { return a._s - b._s; });
          while (this.act.length < 10 && this.q.length && this.q[0]._s <= now) { var e = this.q.shift(); if (!e.isConnected) continue; e._t0 = now; e._txt = e.firstChild.textContent; e._dur = Math.min(720, 260 + e._txt.length * 22); this.act.push(e); }
          var draw = (this.tick++ & 1) === 0;
          this.act = this.act.filter(function (e) {
            if (!e.isConnected) return false;
            var t = now - e._t0; if (t < 140) return true;
            if (e.classList.contains('is-mask')) { e.classList.remove('is-mask'); e.classList.add('is-scr'); }
            var p = (t - 140) / e._dur;
            if (p >= 1) { self.done(e); return false; }
            if (draw && e.classList.contains('is-scr')) { var s = e._txt, k = Math.floor(p * s.length), out = s.slice(0, k); for (var i = k; i < s.length; i++) out += s[i] === ' ' ? ' ' : GLY[(Math.random() * GLY.length) | 0]; e.lastChild.textContent = out; }
            return true;
          });
          if (this.act.length || this.q.length) this.raf = requestAnimationFrame(function (t) { self.frame(t); });
        },
        done: function (e) { e.classList.remove('is-mask', 'is-scr'); e.lastChild.textContent = ''; },
        flush: function () { var self = this; box.querySelectorAll('.dc.is-mask, .dc.is-scr').forEach(function (e) { self.done(e); }); this.q = []; this.act = []; cancelAnimationFrame(this.raf); this.raf = 0; },
        reset: function () { this.q = []; this.act = []; cancelAnimationFrame(this.raf); this.raf = 0; }
      };
      RSC.on(document, 'visibilitychange', function () { if (document.hidden) Dec.flush(); });

      /* ── 성도(星圖): 네 권역을 나침반 사분면에(북 위·동 오른쪽·남 아래·서 왼쪽), 구는 원 위의 별 ── */
      var QUAD = { NORTH: -90, EAST: 0, SOUTH: 90, WEST: 180 }, DSTEP = 9, DR = 118, DRL = 139, DC = 160, dialAll = [];
      function dpt(rad, deg) { var t = deg * Math.PI / 180; return [DC + rad * Math.cos(t), DC + rad * Math.sin(t)]; }
      function dialSVG(d) {
        dialAll = [];
        d.regions.forEach(function (r, ri) {
          var n = r.districts.length, c = QUAD[r.en] != null ? QUAD[r.en] : -90 + ri * 360 / d.regions.length;
          r.districts.forEach(function (x, i) { dialAll.push({ x: x, r: r, a: c - DSTEP * (n - 1) / 2 + DSTEP * i }); });
        });
        var marks = dialAll.map(function (o) {
          var p = dpt(DR, o.a), l = dpt(DRL, o.a), x = o.x, sh;
          if (x.tag === '수도') sh = '<rect class="mk" x="' + (p[0] - 6) + '" y="' + (p[1] - 6) + '" width="12" height="12" transform="rotate(45 ' + p[0] + ' ' + p[1] + ')"/>';
          else if (x.tag) sh = '<rect class="mk" x="' + (p[0] - 6) + '" y="' + (p[1] - 6) + '" width="12" height="12"/>';
          else sh = '<circle class="mk" cx="' + p[0] + '" cy="' + p[1] + '" r="5"/>';
          return '<g class="nd' + (x.tag === '수도' ? ' is-cap' : x.tag ? ' is-hq' : '') + '" data-dial="' + x.no + '" tabindex="0" role="button" aria-label="' + x.no + '구 ' + esc(x.name) + (x.tag ? ' (' + esc(x.tag) + ')' : '') + '">' +
            '<circle class="hit" cx="' + p[0] + '" cy="' + p[1] + '" r="13"/>' + sh + '<text x="' + l[0] + '" y="' + l[1] + '">' + pad(x.no) + '</text></g>';
        }).join('');
        var arcs = d.regions.map(function (r, ri) {
          var n = r.districts.length, c = QUAD[r.en] != null ? QUAD[r.en] : -90 + ri * 360 / d.regions.length, half = DSTEP * (n - 1) / 2 + 5;
          var a1 = dpt(DR, c - half), a2 = dpt(DR, c + half), q = dpt(78, c);
          return '<path d="M' + a1[0] + ' ' + a1[1] + ' A' + DR + ' ' + DR + ' 0 0 1 ' + a2[0] + ' ' + a2[1] + '" class="arc"/><text class="q" x="' + q[0] + '" y="' + q[1] + '">' + esc(r.name) + '</text>';
        }).join('');
        var ticks = ''; for (var i = 0; i < 72; i++) { var t1 = dpt(100, i * 5), t2 = dpt(i % 18 === 0 ? 92 : 96, i * 5); ticks += '<line x1="' + t1[0] + '" y1="' + t1[1] + '" x2="' + t2[0] + '" y2="' + t2[1] + '"/>'; }
        return '<div class="mdos__dial"><svg viewBox="0 0 320 320" role="group" aria-label="행정 구역 성도: ' + d.regions.length + '권역 ' + dialAll.length + '개 구">' +
          '<circle cx="160" cy="160" r="' + DR + '" class="orbit"/><g class="ticks">' + ticks + '</g><circle cx="160" cy="160" r="56" class="inner"/>' +
          '<g class="ptr" data-dial-ptr><line x1="160" y1="160" x2="260" y2="160"/><circle cx="260" cy="160" r="2.5"/></g>' + arcs +
          '<circle cx="160" cy="160" r="40" class="core"/><text class="cnum" x="160" y="154" data-dial-num>01</text><text class="csub" x="160" y="184">DISTRICT</text>' + marks + '</svg></div>' +
          '<p class="mono mdos__dlegend"><span class="c"><i></i>수도</span><span class="h"><i></i>본부</span><span>별을 누르면 판독</span></p>' +
          '<div class="mdos__read" data-dial-read aria-live="polite"></div>';
      }
      function readout(o) {
        var x = o.x, r = o.r;
        return '<p class="mono mdos__readk">제 ' + pad(x.no) + ' 구 · ' + esc(r.name) + ' ' + esc(r.en) + '</p><h5>' + D(x.name) + (x.tag ? '<span class="mono mdos__badge' + (x.tag === '수도' ? ' is-cap' : '') + '">' + esc(x.tag) + '</span>' : '') + '</h5>' +
          (x.loc || x.geo || x.buildings
            ? (x.loc ? '<div class="mdos__kv"><span class="mono">위치</span>' + D(x.loc) + '</div>' : '') + (x.geo ? '<div class="mdos__kv"><span class="mono">지리</span>' + D(x.geo) + '</div>' : '') +
              (x.buildings ? '<p class="mono mdos__subh">주요 건물 · ' + pad(x.buildings.length) + '</p><ol class="mdos__blds">' + x.buildings.map(function (b, i) { return '<li><span class="mono">B-' + pad(i + 1) + '</span>' + D(b) + '</li>'; }).join('') + '</ol>' : '')
            : '<p class="mdos__nodata">' + D('이 구역은 명칭만 기록되어 있습니다. 세부 관측 기록 없음.') + '</p>');
      }
      function dial(no) {
        var o = dialAll.filter(function (q) { return q.x.no === no; })[0]; if (!o) return;
        body.querySelectorAll('[data-dial]').forEach(function (g) { g.classList.toggle('is-on', +g.dataset.dial === no); });
        var ptr = body.querySelector('[data-dial-ptr]'); if (ptr) ptr.style.transform = 'rotate(' + o.a + 'deg)';
        var num = body.querySelector('[data-dial-num]'); if (num) num.textContent = pad(no);
        var ro = body.querySelector('[data-dial-read]'); if (!ro) return;
        ro.innerHTML = readout(o);
        if (!reduce) Dec.add([].slice.call(ro.querySelectorAll('.dc.is-mask')), 0);
      }
      function full(d) {
        var all = []; d.regions.forEach(function (r) { r.districts.forEach(function (x) { all.push(x); }); });
        var key = all.filter(function (x) { return x.tag; }).sort(function (a, b) { return a.tag === '수도' ? -1 : b.tag === '수도' ? 1 : 0; });
        var regs = d.regions.map(function (r) {
          return '<div class="mdos__reg"><div class="mdos__regh"><b>' + esc(r.name) + '</b><span class="mono">' + esc(r.en) + '</span><em class="mono">' + r.districts[0].no + '–' + r.districts[r.districts.length - 1].no + '구 · ' + r.districts.length + '</em></div>' +
            r.districts.map(function (x) {
              var more = x.loc || x.geo || x.buildings;
              return '<div class="mdos__dist" data-dist="' + x.no + '"><button type="button" aria-expanded="false" data-dist-tg="' + x.no + '">' +
                '<span class="mono mdos__no">' + pad(x.no) + '</span>' + D(x.name, 'mdos__dn') + (x.tag ? '<span class="mono mdos__badge' + (x.tag === '수도' ? ' is-cap' : '') + '">' + esc(x.tag) + '</span>' : '') + '<i aria-hidden="true"></i></button>' +
                '<div class="mdos__dd" hidden>' + (more
                  ? (x.loc ? '<div class="mdos__kv"><span class="mono">위치</span>' + D(x.loc) + '</div>' : '') + (x.geo ? '<div class="mdos__kv"><span class="mono">지리</span>' + D(x.geo) + '</div>' : '') +
                    (x.buildings ? '<div class="mdos__kv"><span class="mono">건물</span><span>' + x.buildings.length + '개 시설</span></div><ol class="mdos__blds">' + x.buildings.map(function (b, i) { return '<li><span class="mono">B-' + pad(i + 1) + '</span>' + D(b) + '</li>'; }).join('') + '</ol>' : '')
                  : '<p class="mdos__nodata">' + esc(r.name) + ' · ' + esc(r.en) + (x.tag ? ' · ' + esc(x.tag) : '') + ' — 세부 기록은 아직 해독되지 않았습니다.</p>') + '</div></div>';
            }).join('') + '</div>';
        }).join('');
        function sec(id, n, ko, en, inner) { return '<section class="mdos__sec" data-sec="' + id + '"><div class="mdos__sech"><span class="mono">' + n + '</span><h4>' + ko + '</h4><em class="mono">' + en + '</em></div>' + inner + '</section>'; }
        function list(a, pre) { return '<ul class="mdos__lst">' + a.map(function (x, i) { return '<li><span class="mono">' + pre + (i + 1) + '</span>' + D(x) + '</li>'; }).join('') + '</ul>'; }
        return '<nav class="mdos__rail" aria-label="기록 목차">' + RAIL.map(function (r) { return '<button type="button" data-go="' + r[0] + '" title="' + r[2] + '" aria-label="' + r[2] + '"><span class="mono">' + r[1] + '</span></button>'; }).join('') + '</nav>' +
          '<div class="mdos__scroll" data-scroll tabindex="0">' +
          sec('basic', '01', '개요', 'Overview · ' + d.basics.length, '<dl class="mdos__facts">' + d.basics.map(function (b) { return '<div><dt class="mono">' + esc(b[0]) + '</dt><dd>' + D(b[1]) + '</dd></div>'; }).join('') + '</dl>' +
            (key.length ? '<p class="mono mdos__subh">핵심 거점 · Key Sites</p><div class="mdos__keys">' + key.map(function (x) { return '<button type="button" data-dist-go="' + x.no + '"><b class="mono">' + pad(x.no) + '</b><span><em class="mono">' + esc(x.tag) + '</em>' + D(x.name) + '</span><i aria-hidden="true"></i></button>'; }).join('') + '</div>' : '')) +
          sec('faith', '02', '종교', 'Faith · ' + d.religions.length, list(d.religions, '0')) +
          sec('food', '03', '식량', 'Provisions · ' + (d.foods.raw.length + d.foods.cooked.length), '<p class="mono mdos__subh">생식품 · Raw ' + d.foods.raw.length + '</p>' + list(d.foods.raw, 'R') + '<p class="mono mdos__subh">조리된 식품 · Cooked ' + d.foods.cooked.length + '</p>' + list(d.foods.cooked, 'C')) +
          sec('lang', '04', '언어', 'Language · ' + d.languages.length, '<ul class="mdos__lst mdos__lang">' + d.languages.map(function (b) { return '<li><span>' + esc(b[0]) + '</span>' + D(b[1]) + '</li>'; }).join('') + '</ul>') +
          sec('admin', '05', '행정 구역', 'Star Chart · ' + all.length, dialSVG(d) + '<p class="mono mdos__subh">구역 목록</p>' + regs) +
          '</div>';
      }
      function empty(d) {
        return '<div class="mdos__scroll" data-scroll tabindex="0"><div class="mdos__empty"><i></i><i class="m"></i><i class="s"></i><i class="m"></i>' +
          '<strong>' + D(d ? '기록 준비 중' : '정보 없음') + '</strong><p>' + D(d ? '이 지역의 설정 기록은 편찬 중입니다. 공개될 때까지 열람이 봉인됩니다.' : '이 지역에 대해 확인된 기록이 없습니다.') + '</p>' +
          '<span class="mono mdos__stamp">' + (d ? 'Sealed · In Preparation' : 'No Record') + '</span></div></div>';
      }
      function draw() {
        var d = cur && DOS[nm(cur)], isFull = !!(d && d.basics);
        if (io) io.disconnect(); if (spy) spy.disconnect(); Dec.reset();
        body.classList.toggle('is-full', isFull);
        body.innerHTML = isFull ? full(d) : empty(d);
        if (isFull) dial(dialAll.length ? dialAll[0].x.no : 1);
        var sc = body.querySelector('.mdos__scroll');
        if (reduce) return;
        if (!isFull) { Dec.add([].slice.call(sc.querySelectorAll('.dc')), 420); return; }
        /* 창 안에 들어온 글자만 해독 */
        io = new IntersectionObserver(function (es) {
          var vis = []; es.forEach(function (e) { if (e.isIntersecting) { vis.push(e.target); io.unobserve(e.target); } });
          if (vis.length) Dec.add(vis, 0);
        }, { root: sc, rootMargin: '0px 0px 40px 0px' });
        setTimeout(function () { if (sc.isConnected) sc.querySelectorAll('.dc.is-mask').forEach(function (e) { io.observe(e); }); }, 420);
        /* 목차: 지금 읽는 장 표시 + 관측 고리 바늘 */
        var rail = body.querySelectorAll('[data-go]');
        function mark(id) {
          rail.forEach(function (b) { b.setAttribute('aria-current', b.dataset.go === id ? 'true' : 'false'); });
          var k = RAIL.findIndex(function (r) { return r[0] === id; });
          box.style.setProperty('--ring', (k * 72) + 'deg');
          $('[data-dos-sec]').textContent = RAIL[k][1] + ' · ' + RAIL[k][2];
        }
        mark('basic');
        spy = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) mark(e.target.dataset.sec); }); }, { root: sc, rootMargin: '0px 0px -70% 0px' });
        sc.querySelectorAll('.mdos__sec').forEach(function (s) { spy.observe(s); });
      }
      function scrollTo(el) {
        var sc = body.querySelector('.mdos__scroll'); if (!sc || !el) return;
        sc.scrollTo({ top: sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12, behavior: reduce ? 'auto' : 'smooth' });
      }
      function pick(no, jump) {
        body.querySelectorAll('.mdos__dist').forEach(function (d) {
          var on = d.dataset.dist === String(no) && (jump || !d.classList.contains('is-sel'));
          d.classList.toggle('is-sel', on); d.querySelector('.mdos__dd').hidden = !on;
          d.querySelector('[data-dist-tg]').setAttribute('aria-expanded', on);
        });
        body.querySelectorAll('.mdos__idx [data-dist-go]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.distGo === String(no) && !!body.querySelector('.mdos__dist.is-sel[data-dist="' + no + '"]')); });
        if (jump) scrollTo(body.querySelector('.mdos__dist[data-dist="' + no + '"]'));
      }
      body.addEventListener('click', function (e) {
        var g = e.target.closest('[data-go]'); if (g) return scrollTo(body.querySelector('[data-sec="' + g.dataset.go + '"]'));
        var dl = e.target.closest('[data-dial]'); if (dl) return dial(+dl.dataset.dial);
        var j = e.target.closest('[data-dist-go]'); if (j) { dial(+j.dataset.distGo); return scrollTo(body.querySelector('[data-sec="admin"]')); }
        var t = e.target.closest('[data-dist-tg]'); if (t) { dial(+t.dataset.distTg); return pick(+t.dataset.distTg, false); }
      });
      body.addEventListener('keydown', function (e) {
        var g = e.target.closest && e.target.closest('[data-dial]');
        if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); dial(+g.dataset.dial); }
      });
      function show(l) {
        clearTimeout(timer);
        if (!l) { Dec.reset(); if (io) io.disconnect(); if (spy) spy.disconnect(); if (!box.hidden) { box.classList.remove('is-open'); timer = setTimeout(function () { box.hidden = true; }, reduce ? 0 : 420); } cur = null; return; }
        var first = box.hidden || !box.classList.contains('is-open');
        cur = l;
        var d = DOS[nm(l)];
        $('[data-dos-code]').textContent = 'Dossier / ' + (d ? (d.basics ? 'Open' : 'Pending') : 'Sealed');
        $('[data-dos-name]').textContent = nm(l);
        $('[data-dos-en]').textContent = d && d.en ? d.en : '— —';
        $('[data-dos-sec]').textContent = d && d.basics ? '01 · 개요' : (d ? '열람 봉인' : '기록 없음');
        box.classList.toggle('is-full', !!(d && d.basics));
        box.style.setProperty('--c', l.color || 'var(--gold-300)');
        box.style.setProperty('--ring', '0deg');
        box.hidden = false; void box.offsetWidth; box.classList.add('is-open');
        if (!reduce) { box.classList.remove('is-unfold'); void box.offsetWidth; box.classList.add('is-unfold'); }
        if (!reduce) RSC.scramble($('[data-dos-name]'), nm(l), 700);
        draw();
        if (!first) { box.classList.remove('is-scan'); void box.offsetWidth; box.classList.add('is-scan'); }
      }
      $('[data-dos-close]').addEventListener('click', closeDos);
      box.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeDos(); } });
      return { show: show, width: function () { return box.hidden || !box.classList.contains('is-open') ? 0 : box.offsetWidth; } };
    })();

    view.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.mlab')) return;
      if (e.pointerType === 'mouse') e.preventDefault();   /* 끌 때 주변 글자가 선택되지 않게 */
      cancelAnimationFrame(anim);
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { view.setPointerCapture(e.pointerId); } catch (_) {} view.classList.add('is-drag');
      if (ptr.size === 2) { var p = Array.from(ptr.values()); pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
    });
    view.addEventListener('pointermove', function (e) {
      var r = size();
      $('[data-mx]').textContent = String(Math.round((e.clientX - r.left - st.x) / st.z / K)).padStart(4, '0');
      $('[data-my]').textContent = String(Math.round((e.clientY - r.top - st.y) / st.z / K)).padStart(4, '0');
      var p = ptr.get(e.pointerId); if (!p) return;
      if (ptr.size === 1) { st.x += e.clientX - p.x; st.y += e.clientY - p.y; apply(); }
      p.x = e.clientX; p.y = e.clientY;
      if (ptr.size === 2) {
        var a = Array.from(ptr.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (pinch) zoomAt((a[0].x + a[1].x) / 2 - r.left, (a[0].y + a[1].y) / 2 - r.top, st.z * d / pinch);
        pinch = d;
      }
    });
    function end(e) { ptr.delete(e.pointerId); pinch = 0; if (!ptr.size) view.classList.remove('is-drag'); }
    view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
    view.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;           /* 페이지(화면 넘김)를 가로채지 않는다 */
      e.preventDefault(); var r = size();
      zoomAt(e.clientX - r.left, e.clientY - r.top, st.z * Math.exp(-e.deltaY * .0022));
    }, { passive: false });
    view.addEventListener('keydown', function (e) {
      var k = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] }[e.key];
      if (k) { e.preventDefault(); st.x += k[0]; st.y += k[1]; apply(); }
      if (e.key === '+' || e.key === '=') { var r = size(); zoomAt(r.width / 2, r.height / 2, st.z * 1.3); }
      if (e.key === '-') { var r2 = size(); zoomAt(r2.width / 2, r2.height / 2, st.z / 1.3); }
      if (e.key === 'Escape' && sel >= 0) select(-1);
    });
    document.querySelectorAll('[data-zoom]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = +b.dataset.zoom, r = size();
        if (mode === '3d' && m3d) { if (!d) { select(-1); m3d.reset(); } else m3d.zoom(d); return; }
        if (!d) { reset(); select(-1); return; }
        var cxw = (r.width / 2 - st.x) / st.z, cyw = (r.height / 2 - st.y) / st.z;
        fly(cxw, cyw, st.z * (d > 0 ? 1.5 : 1 / 1.5));
      });
    });
    world.addEventListener('click', function (e) { var p = e.target.closest('[data-lab]'); if (p) select(+p.dataset.lab, true); });
    $('[data-maplist]').addEventListener('click', function (e) { var p = e.target.closest('[data-loc]'); if (p) select(+p.dataset.loc, true); });
    mini.addEventListener('click', function (e) {
      var r = mini.getBoundingClientRect();
      fly((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H, st.z);
    });
    watch(view, function () { if (st.z === .3) reset(); else apply(); });
    reset();

    /* ── 2D / 3D 전환 ── */
    var mode = '2d', m3d = null, loading = null, host = $('[data-m3d]'), stateEl = $('[data-m3d-state]');
    var hint = $('[data-map-hint]'), sec = box.closest('.sec'), vis3 = false, KEY = 'rsc.mapmode';
    /* 지도 이름표 번호 → 3D 영토 번호 (바다 이름은 영토가 아니다) */
    var TI = [], TL = [];
    L.forEach(function (l, i) { if (l.kind !== 'sea') { TI[i] = TL.length; TL.push(i); } });
    var NUM = {}; named.forEach(function (p, k) { NUM[p[1]] = String(k + 1).padStart(2, '0'); });
    function info(k) {
      var i = TL[k], l = L[i] || {};
      return { kind: l.kind, dos: !!DOS[(l.name || '').replace(/\\n|\n/g, ' ')], code: l.kind === 'nation' ? 'N-' + NUM[i] : l.kind === 'region' ? 'REG' : 'UNK' };
    }
    function shown() { return !document.documentElement.classList.contains('is-deck') || !sec || sec.classList.contains('is-cur'); }
    function sync3() { if (!m3d) return; if (mode === '3d' && vis3 && !document.hidden && shown()) m3d.start(); else m3d.stop(); }
    new IntersectionObserver(function (es) { vis3 = es[es.length - 1].isIntersecting; sync3(); }).observe(box);
    if (sec) { var mo = new MutationObserver(sync3); mo.observe(sec, { attributes: true, attributeFilter: ['class'] }); RSC.onLeave(function () { mo.disconnect(); }); }
    RSC.on(document, 'visibilitychange', sync3);
    function load3d() {
      if (loading) return loading;
      host.classList.add('is-loading');
      var base = new URL('assets/js/', document.baseURI).href;
      loading = import(base + 'map3d.js?v=2.15.0').then(function (mod) {
        m3d = mod.create(host, {
          reduce: reduce, info: info,
          onLost: function () {
            host.classList.add('is-fail'); stateEl.querySelector('span').textContent = '그래픽 장치가 초기화되어 2D 지도로 돌아갑니다';
            setTimeout(function () { setMode('2d'); }, 1800);
          },
          onPick: function (k) { select(TL[k], true); },
          onDetail: function (k) { select(TL[k], true, true); },
          onCam: function (c, home) {
            $('[data-mx]').textContent = String(Math.round(((c.az * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, '0') + '°';
            $('[data-my]').textContent = String(Math.round(c.el * 180 / Math.PI)).padStart(2, '0') + '°';
            $('[data-mz]').textContent = (home / c.dist).toFixed(1) + 'x';
          }
        });
        if (!m3d) throw new Error('webgl');
        host.classList.remove('is-loading');
        if (sel >= 0) select(sel, true);
        sync3();
      }).catch(function () {
        host.classList.remove('is-loading'); host.classList.add('is-fail');
        stateEl.querySelector('span').textContent = 'WebGL을 쓸 수 없어 2D 지도만 볼 수 있습니다';
        loading = null; setTimeout(function () { setMode('2d'); }, 1800);
      });
      return loading;
    }
    function setMode(m, quiet) {
      if (m === mode) return;
      mode = m;
      try { localStorage.setItem(KEY, m); } catch (_) {}
      box.classList.toggle('is-3d', m === '3d');
      document.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
      document.querySelectorAll('[data-rk]').forEach(function (e) { e.textContent = e.dataset.rk.split('|')[m === '3d' ? 1 : 0]; });
      hint.textContent = m === '3d' ? 'Drag : Rotate · Shift / R-Drag : Pan · Ctrl + Wheel : Zoom' : 'Ctrl + Wheel : Zoom';
      if (!quiet && !reduce) { box.classList.remove('is-wipe'); void box.offsetWidth; box.classList.add('is-wipe'); }
      host.hidden = m !== '3d';
      if (m === '3d') { load3d(); if (m3d) { m3d.replayIntro(); if (sel >= 0) select(sel, true); } }
      else { apply(); if (sel >= 0) select(sel, true); }
      sync3();
    }
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
    host.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sel >= 0) select(-1); });
    RSC.onLeave(function () { if (m3d) m3d.dispose(); m3d = null; });
    var saved = ''; try { saved = localStorage.getItem(KEY) || ''; } catch (_) {}
    if (saved === '3d') setMode('3d', true);

    return { select: select };
  })();
  $('[data-n-map]').addEventListener('click', function () { setTimeout(function () { map.select(-1, false); }, 900); });

  /* ── 05 GAME: 큰 화면 + 다음 항목이 오른쪽에 살짝 보인다 ── */
  (function () {
    var track = $('[data-g-track]'), gi = 0, N = D.games.length;
    $('[data-g-prev]').innerHTML = RSC.chev(-1); $('[data-g-next]').innerHTML = RSC.chev(1);
    track.innerHTML = D.games.map(function (gm, i) {
      return '<li><button class="gcar__item slot" data-g-pick="' + i + '" aria-label="' + esc(gm.name) + ' ' + gm.id + '">' +
        (gm.image ? '<img src="' + esc(gm.image) + '" alt="">' : '<span>' + gm.code + '<br>SCREENSHOT EMPTY</span>') + '</button></li>';
    }).join('');
    function show(i) {
      gi = (i + N) % N;
      var gm = D.games[gi], dl = $('[data-g-dl]');
      track.style.setProperty('--gi', gi);
      [].forEach.call(track.children, function (li, k) { li.classList.toggle('is-on', k === gi); li.firstChild.tabIndex = k === gi ? -1 : 0; });
      RSC.scramble($('[data-g-code]'), gm.code, 800);
      RSC.scramble($('[data-g-name]'), gm.name, 900);
      $('[data-g-meta]').textContent = '장르 ' + gm.genre + ' · 플랫폼 ' + gm.platform + ' · ' + gm.status;
      $('[data-g-count]').textContent = String(gi + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
      if (gm.url) { dl.href = gm.url; dl.classList.remove('is-off'); dl.removeAttribute('aria-disabled'); dl.textContent = '다운로드'; }
      else { dl.removeAttribute('href'); dl.classList.add('is-off'); dl.setAttribute('aria-disabled', 'true'); dl.textContent = '다운로드 준비 중'; }
    }
    $('[data-g-prev]').addEventListener('click', function () { show(gi - 1); });
    $('[data-g-next]').addEventListener('click', function () { show(gi + 1); });
    track.addEventListener('click', function (e) { var b = e.target.closest('[data-g-pick]'); if (b && +b.dataset.gPick !== gi) show(+b.dataset.gPick); });
    show(0);
  })();

  /* ── 06 WORLD: 세계관 기록 (명조 LORE 배치 — 왼쪽 문장·제목·설명, 오른쪽 세로 카드 띠) ── */
  (function () {
    var W = D.world || [], deck = $('[data-l-deck]'), track = $('[data-l-track]'); if (!W.length || !deck) return;
    var cur = 0, prev = -1, busy = 0;
    /* 결정적인 난수 (별 위치가 매번 같게) */
    function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
    function stars(n, seed, x0, y0, w, h, rmax) {
      var r = rng(seed), out = '';
      for (var i = 0; i < n; i++) out += '<circle cx="' + (x0 + r() * w).toFixed(1) + '" cy="' + (y0 + r() * h).toFixed(1) + '" r="' + (.4 + r() * rmax).toFixed(2) + '" opacity="' + (.25 + r() * .75).toFixed(2) + '"/>';
      return out;
    }
    var G = '#f2d27a', G5 = '#d4a73a', G7 = '#8f6a1c';
    /* 카드 그림: 320×560, 금선 위주 */
    var ART = {
      sphere: function () {
        var lat = ''; [-70, -35, 0, 35, 70].forEach(function (d) { var ry = 18 + Math.abs(d) * .05, y = 280 + d; lat += '<ellipse cx="160" cy="' + y + '" rx="' + Math.sqrt(110 * 110 - d * d).toFixed(1) + '" ry="' + ry + '" />'; });
        return '<defs><radialGradient id="lA" cx=".5" cy="0" r="1"><stop offset="0" stop-color="' + G + '" stop-opacity=".9"/><stop offset=".5" stop-color="' + G5 + '" stop-opacity=".15"/><stop offset="1" stop-opacity="0"/></radialGradient>' +
          '<linearGradient id="lB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000"/></linearGradient></defs>' +
          '<path d="M150 0 L170 0 L166 170 L154 170 Z" fill="url(#lA)"/>' +
          '<path d="M154 390 L166 390 L176 560 L144 560 Z" fill="#000" opacity=".9"/><path d="M156 390 L164 390 L170 560 L150 560 Z" fill="none" stroke="' + G7 + '" stroke-dasharray="2 5"/>' +
          '<circle cx="160" cy="280" r="110" fill="#0d0b08" stroke="' + G5 + '" stroke-width="1.4"/>' +
          '<g fill="none" stroke="' + G7 + '" stroke-width=".8">' + lat + '<ellipse cx="160" cy="280" rx="44" ry="110"/><ellipse cx="160" cy="280" rx="86" ry="110"/></g>' +
          '<line x1="160" y1="150" x2="160" y2="410" stroke="' + G + '" stroke-width=".8" stroke-dasharray="1 4"/>' +
          '<rect x="153" y="162" width="14" height="14" fill="' + G + '"/><rect x="153" y="384" width="14" height="14" fill="#000" stroke="' + G5 + '"/>' +
          '<g fill="' + G + '">' + stars(46, 7, 10, 10, 300, 540, 1.1) + '</g>';
      },
      sanctum: function () {
        var vil = [[160, 140], [62, 380], [258, 380]], s = '';
        vil.forEach(function (p) { s += '<line x1="160" y1="290" x2="' + p[0] + '" y2="' + p[1] + '" stroke="' + G7 + '" stroke-dasharray="3 5"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="26" fill="#0d0b08" stroke="' + G5 + '"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="5" fill="' + G5 + '"/>'; });
        var lum = ''; for (var i = 0; i < 7; i++) { var a = (-150 + i * 20) * Math.PI / 180; lum += '<circle cx="' + (160 + Math.cos(a) * 128).toFixed(1) + '" cy="' + (290 + Math.sin(a) * 128).toFixed(1) + '" r="3.2" fill="' + G + '"/>'; }
        return '<circle cx="160" cy="290" r="128" fill="none" stroke="' + G7 + '" stroke-dasharray="2 6"/><circle cx="160" cy="290" r="150" fill="none" stroke="' + G7 + '" opacity=".5"/>' + s +
          '<circle cx="160" cy="290" r="58" fill="#120f0a" stroke="' + G + '" stroke-width="1.4"/>' +
          '<path d="M160 248 L178 270 L178 318 L142 318 L142 270 Z" fill="none" stroke="' + G + '"/><path d="M160 248 V232 M150 238 H170" stroke="' + G + '"/><rect x="154" y="296" width="12" height="22" fill="' + G5 + '"/>' + lum +
          '<g fill="' + G5 + '">' + stars(22, 11, 10, 20, 300, 520, .9) + '</g>';
      },
      rift: function () {
        var pts = [[160, 0], [150, 70], [172, 130], [146, 200], [168, 260], [140, 330], [176, 400], [150, 470], [164, 560]];
        var right = pts.map(function (p, i) { return (p[0] + 10 + (i % 2 ? 14 : 4)) + ' ' + p[1]; }).reverse();
        var poly = pts.map(function (p) { return p[0] + ' ' + p[1]; }).concat(right).join(' L');
        return '<defs><linearGradient id="rG" x1="0" x2="1"><stop offset="0" stop-color="' + G + '"/><stop offset=".5" stop-color="#fff3c4"/><stop offset="1" stop-color="' + G + '"/></linearGradient></defs>' +
          '<path d="M' + poly + ' Z" fill="url(#rG)" opacity=".9"/><path d="M' + poly + ' Z" fill="none" stroke="' + G + '" stroke-width="6" opacity=".12"/>' +
          '<rect x="128" y="250" width="70" height="96" fill="#050505" stroke="' + G + '"/><path d="M140 262 h46 v72 h-46z" fill="none" stroke="' + G7 + '"/><circle cx="163" cy="298" r="8" fill="none" stroke="' + G + '"/>' +
          '<g fill="' + G + '">' + stars(30, 23, 10, 10, 120, 540, .9) + stars(30, 31, 200, 10, 110, 540, .9) + '</g>';
      },
      gauge: function () {
        var bands = [[0, 10, '빛'], [10, 90, '에테로스'], [90, 100, '어둠']], g = '';
        bands.forEach(function (b) { var y1 = 70 + b[0] * 4.2, y2 = 70 + b[1] * 4.2; g += '<line x1="262" y1="' + y1 + '" x2="292" y2="' + y1 + '" stroke="' + G5 + '"/><text x="296" y="' + (y1 + 4) + '" class="t">' + b[0] + '</text>'; });
        g += '<line x1="262" y1="490" x2="292" y2="490" stroke="' + G5 + '"/><text x="296" y="494" class="t">100</text>';
        return '<defs><linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".1" stop-color="' + G + '"/><stop offset=".5" stop-color="' + G7 + '" stop-opacity=".55"/><stop offset=".9" stop-color="#140f08"/><stop offset="1" stop-color="#000"/></linearGradient></defs>' +
          '<rect x="60" y="70" width="180" height="420" fill="url(#gG)"/><rect x="60" y="70" width="180" height="420" fill="none" stroke="' + G5 + '"/>' +
          '<line x1="60" y1="112" x2="240" y2="112" stroke="#050505" stroke-dasharray="4 4"/><line x1="60" y1="448" x2="240" y2="448" stroke="' + G7 + '" stroke-dasharray="4 4"/>' +
          '<path d="M150 0 V70 M170 0 V70" stroke="' + G + '" opacity=".8"/><path d="M150 490 V560 M170 490 V560" stroke="' + G7 + '"/>' +
          '<line x1="262" y1="70" x2="262" y2="490" stroke="' + G7 + '"/>' + g;
      },
      vault: function () {
        var pil = '';
        [[48, 300], [98, 250], [222, 250], [272, 300]].forEach(function (p) { pil += '<rect x="' + (p[0] - 9) + '" y="' + p[1] + '" width="18" height="' + (500 - p[1]) + '" fill="#0d0b08" stroke="' + G5 + '"/><path d="M' + p[0] + ' ' + (p[1] - 26) + ' l12 26 h-24z" fill="' + G + '" opacity=".85"/>'; });
        return '<g fill="' + G + '">' + stars(90, 41, 6, 6, 308, 260, 1.2) + '</g>' +
          '<path d="M0 120 C 90 60, 230 180, 320 110" fill="none" stroke="' + G7 + '" stroke-width="22" opacity=".18"/>' +
          '<circle cx="160" cy="170" r="34" fill="#000" stroke="' + G + '"/><ellipse cx="160" cy="170" rx="62" ry="12" fill="none" stroke="' + G5 + '" transform="rotate(-14 160 170)"/>' + pil +
          '<path d="M124 500 V420 a36 36 0 0 1 72 0 V500 Z" fill="#120f0a" stroke="' + G + '" stroke-width="1.4"/><path d="M136 500 V424 a24 24 0 0 1 48 0 V500" fill="none" stroke="' + G7 + '"/>' +
          '<line x1="0" y1="500" x2="320" y2="500" stroke="' + G7 + '"/>';
      },
      threads: function () {
        var t = '';
        for (var i = 0; i < 13; i++) {
          var x = 28 + i * 22;
          if (i === 6) {
            t += '<path d="M' + x + ' 0 V210 C ' + (x + 30) + ' 240, ' + (x - 40) + ' 260, ' + (x + 10) + ' 288" fill="none" stroke="' + G + '" stroke-width="1.6"/>' +
              '<path d="M' + (x + 4) + ' 320 C ' + (x - 30) + ' 350, ' + (x + 36) + ' 380, ' + x + ' 410 V560" fill="none" stroke="' + G + '" stroke-width="1.6"/>' +
              '<g fill="' + G + '"><circle cx="' + (x + 10) + '" cy="288" r="3"/><circle cx="' + (x + 4) + '" cy="320" r="3"/><rect x="' + (x + 14) + '" y="298" width="3" height="3"/><rect x="' + (x - 8) + '" y="306" width="2.5" height="2.5"/></g>';
          } else t += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="560" stroke="' + (i % 3 ? G7 : G5) + '" stroke-width=".8" opacity="' + (i % 3 ? .6 : .9) + '"/>';
        }
        return t + '<g fill="' + G5 + '">' + stars(26, 53, 10, 10, 300, 540, .8) + '</g>';
      }
    };
    /* 왼쪽 문장(시길): 같은 그림을 작게, 선만 */
    function sigil(w) { return '<svg viewBox="0 0 320 560" aria-hidden="true"><g class="wld__sig">' + ART[w.art]() + '</g></svg>'; }

    /* ── 고른 카드의 움직이는 일러스트 (캔버스 한 장을 고른 카드로 옮겨 가며 쓴다) ──
       320×560 좌표로 그린다.
       - 빛 번짐은 미리 그려 둔 스프라이트를 찍는다(매 프레임 그라디언트를 만들지 않아 가볍다)
       - 입자는 잔상 레이어에 그려 꼬리가 남는다
       - 마지막에 비네트와 필름 입자를 얹는다
       프레임이 떨어지면 해상도·입자 수를 4단계로 낮춘다(목표: 초당 20장 아래로 떨어지지 않게). */
    var FX = (function () {
      var GOLD = '242,210,122', G5 = '212,167,58', G7 = '143,106,28', IV = '255,243,196';
      var TAU = Math.PI * 2, LITE = false;   /* 최저 단계: 번짐 겹·반짝임 선·성운을 생략한다 */
      function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
      function off(w, h) { var o = document.createElement('canvas'); o.width = w; o.height = h; return o; }
      /* 빛 스프라이트 */
      var SPR = {};
      function sprite(col) {
        if (SPR[col]) return SPR[col];
        var o = off(64, 64), g = o.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        rg.addColorStop(0, 'rgba(' + col + ',1)'); rg.addColorStop(.25, 'rgba(' + col + ',.45)'); rg.addColorStop(.6, 'rgba(' + col + ',.1)'); rg.addColorStop(1, 'rgba(' + col + ',0)');
        g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return (SPR[col] = o);
      }
      function glow(c, x, y, r, col, a) { if (a <= .003 || r <= 0) return; c.globalAlpha = Math.min(1, a); c.drawImage(sprite(col), x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; }
      /* 십자 반짝임 */
      function flare(c, x, y, r, a) {
        glow(c, x, y, r * .9, IV, a); if (LITE) return;
        c.strokeStyle = 'rgba(' + IV + ',' + (a * .8).toFixed(3) + ')'; c.lineWidth = .7;
        c.beginPath(); c.moveTo(x - r * 1.6, y); c.lineTo(x + r * 1.6, y); c.moveTo(x, y - r * 1.6); c.lineTo(x, y + r * 1.6); c.stroke(); c.lineWidth = 1;
      }
      function mkStars(r, n, x0, y0, w, h) { var s = []; for (var i = 0; i < n; i++) s.push({ x: x0 + r() * w, y: y0 + r() * h, s: .5 + r() * 1.3, p: r() * TAU, v: .6 + r() * 2, f: r() < .06 }); return s; }
      function drawStars(c, st, t, col, k) {
        for (var i = 0; i < st.length; i++) {
          var o = st[i], a = (.3 + .7 * (.5 + .5 * Math.sin(t * o.v + o.p))) * (k || 1);
          if (o.f) { flare(c, o.x, o.y, 3.5, a * .8); continue; }
          c.fillStyle = 'rgba(' + (col || GOLD) + ',' + a.toFixed(3) + ')'; c.fillRect(o.x, o.y, o.s, o.s);
        }
      }
      function bg(c, top, bot) { var g = c.createLinearGradient(0, 0, 0, 560); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, 320, 560); }
      function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
      /* 두 겹 선(번짐 + 심): 금박이 빛나는 느낌 */
      function gstroke(c, col, a, w) { if (LITE) { c.lineWidth = w || 1; c.strokeStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')'; c.stroke(); c.lineWidth = 1; return; } c.lineWidth = (w || 1) * 5; c.strokeStyle = 'rgba(' + col + ',' + (a * .12).toFixed(3) + ')'; c.stroke(); c.lineWidth = w || 1; c.strokeStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')'; c.stroke(); c.lineWidth = 1; }
      /* 부드러운 성운 덩어리를 미리 그려 둔다 */
      function nebula(r, n, cols) {
        var o = off(320, 300), g = o.getContext('2d');
        for (var i = 0; i < n; i++) {
          var x = r() * 320, y = 40 + r() * 220, rad = 40 + r() * 90, col = cols[i % cols.length];
          var rg = g.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, 'rgba(' + col + ',' + (.08 + r() * .1).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(' + col + ',0)');
          g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        return o;
      }

      var ART = {
        /* 라시안컷: 점 구름이 박힌 채 도는 구체, 기울어진 궤도 고리, 위로 솟는 빛·아래로 흘러내리는 어둠 */
        sphere: {
          init: function (r, q) {
            var up = [], dn = [], pts = [];
            for (var i = 0; i < 70 * q; i++) up.push({ x: (r() - .5) * 18, y: r() * 170, v: 50 + r() * 80, s: .6 + r() * 1.4 });
            for (var j = 0; j < 46 * q; j++) dn.push({ x: (r() - .5) * 24, y: 390 + r() * 170, v: 14 + r() * 26, s: 4 + r() * 10 });
            for (var la = -75; la <= 75; la += 15 / Math.max(.5, q)) for (var lo = 0; lo < 360; lo += 12 / Math.max(.5, q)) pts.push([la * Math.PI / 180, lo * Math.PI / 180]);
            return { st: mkStars(r, 70 * q, 0, 0, 320, 560), up: up, dn: dn, pts: pts };
          },
          draw: function (c, S, t, dt, tc) {
            bg(c, '#0b0906', '#030303');
            drawStars(c, S.st, t);
            c.globalCompositeOperation = 'lighter';
            var beam = c.createLinearGradient(0, 0, 0, 176); beam.addColorStop(0, 'rgba(' + IV + ',0)'); beam.addColorStop(.6, 'rgba(' + GOLD + ',.3)'); beam.addColorStop(1, 'rgba(' + IV + ',.85)');
            c.fillStyle = beam; c.fillRect(150, 0, 20, 176);
            glow(c, 160, 170, 70 + 8 * Math.sin(t * 2.2), GOLD, .5);
            tc.globalCompositeOperation = 'lighter';
            S.up.forEach(function (p) {
              p.y -= p.v * dt; if (p.y < -4) p.y = 170;
              var a = Math.min(1, p.y / 120); tc.fillStyle = 'rgba(' + IV + ',' + (.3 + .7 * a).toFixed(3) + ')'; tc.fillRect(160 + p.x * (p.y / 170), p.y, p.s, p.s * 1.6);
            });
            var mist = c.createLinearGradient(0, 390, 0, 560); mist.addColorStop(0, 'rgba(' + G7 + ',.3)'); mist.addColorStop(1, 'rgba(' + G7 + ',0)');
            c.fillStyle = mist; c.beginPath(); c.moveTo(150, 390); c.lineTo(170, 390); c.lineTo(216, 560); c.lineTo(104, 560); c.closePath(); c.fill();
            c.globalCompositeOperation = 'source-over';
            S.dn.forEach(function (p) {
              p.y += p.v * dt; p.x += Math.sin(t + p.y * .05) * .08; if (p.y > 566) { p.y = 392; p.x = 0; }
              var k = (p.y - 390) / 170; c.fillStyle = 'rgba(0,0,0,' + (.75 * (1 - k)).toFixed(3) + ')'; c.beginPath(); c.arc(160 + p.x * (1 + k * 2), p.y, p.s * (1 + k), 0, TAU); c.fill();
            });
            /* 구체 본체 */
            var body = c.createRadialGradient(128, 240, 10, 160, 280, 112); body.addColorStop(0, '#1c160c'); body.addColorStop(1, '#060504');
            c.fillStyle = body; c.beginPath(); c.arc(160, 280, 110, 0, TAU); c.fill();
            var a0 = t * .3, tilt = -.35, ct = Math.cos(tilt), stl = Math.sin(tilt);
            /* 경선: 앞쪽은 밝게, 뒤쪽은 흐리게 */
            for (var k = 0; k < 8; k++) {
              var lon = a0 + k * Math.PI / 8, cs = Math.cos(lon), front = Math.sin(lon) > 0;
              c.beginPath(); c.ellipse(160, 280, Math.abs(cs) * 110 + .1, 110, 0, 0, TAU);
              if (front) gstroke(c, GOLD, .5, .9); else { c.strokeStyle = 'rgba(' + G7 + ',.22)'; c.stroke(); }
            }
            [-75, -40, 0, 40, 75].forEach(function (d) { var rx = Math.sqrt(110 * 110 - d * d); c.strokeStyle = 'rgba(' + G5 + ',.38)'; c.beginPath(); c.ellipse(160, 280 + d, rx, rx * .16, 0, 0, TAU); c.stroke(); });
            /* 표면 점 구름 (돌면서 앞쪽만 빛난다) */
            c.globalCompositeOperation = 'lighter';
            for (var i = 0; i < S.pts.length; i++) {
              var la = S.pts[i][0], lo = S.pts[i][1] + a0, x = Math.cos(la) * Math.sin(lo), z = Math.cos(la) * Math.cos(lo), y = Math.sin(la);
              if (z < 0) continue;
              c.fillStyle = 'rgba(' + IV + ',' + (z * .75).toFixed(3) + ')'; c.fillRect(160 + x * 110 - .7, 280 - y * 110 - .7, 1.4, 1.4);
            }
            c.globalCompositeOperation = 'source-over';
            c.beginPath(); c.arc(160, 280, 110, 0, TAU); gstroke(c, GOLD, .95, 1.4);
            /* 기울어진 궤도 고리 + 도는 구슬 */
            c.save(); c.translate(160, 280); c.rotate(tilt);
            c.beginPath(); c.ellipse(0, 0, 146, 30, 0, Math.PI, TAU); c.strokeStyle = 'rgba(' + G7 + ',.5)'; c.stroke();
            c.beginPath(); c.ellipse(0, 0, 146, 30, 0, 0, Math.PI); gstroke(c, GOLD, .7, .9);
            var ba = t * .9; c.globalCompositeOperation = 'lighter'; glow(c, Math.cos(ba) * 146, Math.sin(ba) * 30, Math.sin(ba) > 0 ? 14 : 8, IV, Math.sin(ba) > 0 ? .9 : .35); c.globalCompositeOperation = 'source-over';
            c.restore();
            c.setLineDash([1, 5]); c.lineDashOffset = t * 12; c.strokeStyle = 'rgba(' + IV + ',.55)'; line(c, 160, 168, 160, 392); c.setLineDash([]);
            var pu = .7 + .3 * Math.sin(t * 2.2);
            c.globalCompositeOperation = 'lighter'; glow(c, 160, 169, 30, IV, .8 * pu); c.globalCompositeOperation = 'source-over';
            c.fillStyle = 'rgba(' + GOLD + ',1)'; c.fillRect(153, 162, 14, 14);
            c.fillStyle = '#000'; c.fillRect(153, 384, 14, 14); c.strokeStyle = 'rgba(' + G5 + ',.9)'; c.strokeRect(153.5, 384.5, 13, 13);
          }
        },
        /* 성역의 경계: 사그라드는 빛살, 도는 문자 고리, 세 마을로 흐르는 빛, 일곱 빛, 피어오르는 빛 먼지 */
        sanctum: {
          init: function (r, q) { var m = []; for (var i = 0; i < 50 * q; i++) m.push({ x: 40 + r() * 240, y: r() * 560, v: 8 + r() * 18, p: r() * TAU }); return { st: mkStars(r, 40 * q, 0, 0, 320, 560), m: m }; },
          draw: function (c, S, t, dt, tc) {
            bg(c, '#0c0a07', '#040403');
            drawStars(c, S.st, t, G5, .8);
            var cx = 160, cy = 290;
            c.globalCompositeOperation = 'lighter';
            var rg = c.createRadialGradient(cx, cy, 40, cx, cy, 180); rg.addColorStop(0, 'rgba(' + IV + ',.24)'); rg.addColorStop(1, 'rgba(' + GOLD + ',0)'); c.fillStyle = rg;
            for (var i = 0; i < 18; i++) { var a = t * .1 + i * TAU / 18, wd = .014 + .012 * (.5 + .5 * Math.sin(t * 1.3 + i * 1.7)); c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 180, a - wd, a + wd); c.closePath(); c.fill(); }
            glow(c, cx, cy, 120, GOLD, .4);
            tc.globalCompositeOperation = 'lighter';
            S.m.forEach(function (o) { o.y -= o.v * dt; if (o.y < -2) o.y = 562; tc.fillStyle = 'rgba(' + GOLD + ',' + (.25 + .35 * Math.sin(t * 2 + o.p)).toFixed(3) + ')'; tc.fillRect(o.x + Math.sin(t + o.p) * 6, o.y, 1.2, 1.2); });
            c.globalCompositeOperation = 'source-over';
            c.setLineDash([2, 7]); c.lineDashOffset = -t * 16; c.beginPath(); c.arc(cx, cy, 128, 0, TAU); gstroke(c, G5, .7, 1); c.setLineDash([]);
            /* 문자 고리: 짧은 호와 눈금이 번갈아 도는 바깥 띠 */
            c.save(); c.translate(cx, cy); c.rotate(-t * .07);
            for (var k = 0; k < 48; k++) {
              var aa = k * TAU / 48;
              c.strokeStyle = 'rgba(' + (k % 4 ? G7 : G5) + ',.85)';
              if (k % 3 === 0) { c.beginPath(); c.arc(0, 0, 150, aa, aa + .07); c.stroke(); }
              else line(c, Math.cos(aa) * 146, Math.sin(aa) * 146, Math.cos(aa) * (k % 4 ? 152 : 158), Math.sin(aa) * (k % 4 ? 152 : 158));
            }
            c.beginPath(); c.arc(0, 0, 162, 0, TAU); c.strokeStyle = 'rgba(' + G7 + ',.35)'; c.stroke();
            c.restore();
            [[160, 140], [62, 380], [258, 380]].forEach(function (p, i) {
              c.strokeStyle = 'rgba(' + G7 + ',.8)'; c.setLineDash([3, 5]); line(c, cx, cy, p[0], p[1]); c.setLineDash([]);
              var f = (t * .35 + i / 3) % 1, x = cx + (p[0] - cx) * f, y = cy + (p[1] - cy) * f;
              c.globalCompositeOperation = 'lighter'; glow(c, x, y, 16, IV, .9 * Math.sin(f * Math.PI)); c.globalCompositeOperation = 'source-over';
              c.fillStyle = '#0d0b08'; c.beginPath(); c.arc(p[0], p[1], 26, 0, TAU); c.fill(); gstroke(c, G5, .9, 1);
              var pu = (t * .5 + i * .33) % 1;
              c.strokeStyle = 'rgba(' + GOLD + ',' + (.6 * (1 - pu)).toFixed(3) + ')'; c.beginPath(); c.arc(p[0], p[1], 26 + pu * 22, 0, TAU); c.stroke();
              c.globalCompositeOperation = 'lighter'; glow(c, p[0], p[1], 14, GOLD, .6); c.globalCompositeOperation = 'source-over';
              c.fillStyle = 'rgba(' + IV + ',.95)'; c.beginPath(); c.arc(p[0], p[1], 3.5, 0, TAU); c.fill();
            });
            c.globalCompositeOperation = 'lighter';
            for (var j = 0; j < 7; j++) { var la = (-150 + j * 20) * Math.PI / 180 + Math.sin(t * .4) * .05; flare(c, cx + Math.cos(la) * 128, cy + Math.sin(la) * 128, 5, .55 + .35 * Math.sin(t * 2.4 + j)); }
            c.globalCompositeOperation = 'source-over';
            var core = c.createRadialGradient(cx, cy - 20, 4, cx, cy, 58); core.addColorStop(0, '#2a2112'); core.addColorStop(1, '#0e0b07');
            c.fillStyle = core; c.beginPath(); c.arc(cx, cy, 58, 0, TAU); c.fill(); gstroke(c, GOLD, .95, 1.4);
            c.beginPath(); c.moveTo(160, 248); c.lineTo(178, 270); c.lineTo(178, 318); c.lineTo(142, 318); c.lineTo(142, 270); c.closePath(); gstroke(c, GOLD, .95, 1);
            c.beginPath(); c.moveTo(160, 248); c.lineTo(160, 232); c.moveTo(150, 238); c.lineTo(170, 238); gstroke(c, GOLD, .95, 1);
            c.globalCompositeOperation = 'lighter'; glow(c, 160, 307, 18, GOLD, .5 + .3 * Math.sin(t * 3)); c.globalCompositeOperation = 'source-over';
            c.fillStyle = 'rgba(' + GOLD + ',' + (.75 + .25 * Math.sin(t * 3)).toFixed(3) + ')'; c.fillRect(154, 296, 12, 22);
          }
        },
        /* 차원의 틈: 숨 쉬는 균열, 갈라지며 빛나는 방전, 틈으로 감겨 드는 소용돌이 입자, 관문 */
        rift: {
          init: function (r, q) { var p = []; for (var i = 0; i < 110 * q; i++) p.push({ a: r() * TAU, d: 40 + r() * 200, y: r() * 560, v: .25 + r() * .6, s: .6 + r() * 1.3 }); return { st: mkStars(r, 50 * q, 0, 0, 320, 560), p: p, r: r, arcs: [] }; },
          draw: function (c, S, t, dt, tc) {
            bg(c, '#070607', '#020202');
            drawStars(c, S.st, t, GOLD, .55);
            var base = [[160, 0], [150, 70], [172, 130], [146, 200], [168, 260], [140, 330], [176, 400], [150, 470], [164, 560]];
            var L = base.map(function (p, i) { return [p[0] + Math.sin(t * 1.3 + i * 1.7) * 3, p[1]]; });
            var Rr = L.map(function (p, i) { return [p[0] + 10 + (i % 2 ? 14 : 4) + Math.sin(t * 2.1 + i) * 2 + 3 * Math.sin(t * .9), p[1]]; });
            function path() { c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (var i = 1; i < L.length; i++) c.lineTo(L[i][0], L[i][1]); for (var j = Rr.length - 1; j >= 0; j--) c.lineTo(Rr[j][0], Rr[j][1]); c.closePath(); }
            c.globalCompositeOperation = 'lighter';
            for (var g2 = 0; g2 < base.length; g2 += 2) glow(c, (L[g2][0] + Rr[g2][0]) / 2, base[g2][1], 60, GOLD, .22 + .08 * Math.sin(t * 2 + g2));
            path(); c.lineWidth = 22; c.strokeStyle = 'rgba(' + GOLD + ',.07)'; c.stroke(); c.lineWidth = 8; c.strokeStyle = 'rgba(' + GOLD + ',.16)'; c.stroke(); c.lineWidth = 1;
            var g = c.createLinearGradient(140, 0, 200, 0); g.addColorStop(0, 'rgba(' + GOLD + ',.85)'); g.addColorStop(.5, 'rgba(255,252,236,1)'); g.addColorStop(1, 'rgba(' + GOLD + ',.85)');
            path(); c.fillStyle = g; c.fill();
            /* 소용돌이: 바깥에서 돌며 틈으로 감겨 든다 (잔상 레이어) */
            tc.globalCompositeOperation = 'lighter';
            S.p.forEach(function (o) {
              o.d -= o.d * o.v * dt; o.a += dt * (1.4 + 60 / o.d) * .3; if (o.d < 8) { o.d = 140 + S.r() * 100; o.y = S.r() * 560; }
              var x = 162 + Math.cos(o.a) * o.d, y = o.y + Math.sin(o.a) * o.d * .12, k = 1 - o.d / 240;
              tc.fillStyle = 'rgba(' + IV + ',' + (.15 + .85 * k).toFixed(3) + ')'; tc.fillRect(x, y, o.s, o.s);
            });
            /* 방전: 가지를 치며 갈라진다 */
            if (S.r() < .07) S.arcs.push({ y: 40 + S.r() * 480, side: S.r() < .5 ? -1 : 1, life: 1, seed: (S.r() * 1e6) | 0 });
            S.arcs = S.arcs.filter(function (a) {
              a.life -= dt * 3.5; if (a.life <= 0) return false;
              var rr = rnd(a.seed + 1), pts = [[160 + a.side * 10, a.y]];
              for (var k = 0; k < 6; k++) { var lp = pts[pts.length - 1]; pts.push([lp[0] + a.side * (6 + rr() * 12), lp[1] + (rr() - .5) * 22]); }
              c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var m = 1; m < pts.length; m++) c.lineTo(pts[m][0], pts[m][1]);
              var b = pts[3]; c.moveTo(b[0], b[1]); c.lineTo(b[0] + a.side * 14, b[1] + (rr() - .5) * 30);
              gstroke(c, IV, a.life, 1.1); glow(c, pts[6][0], pts[6][1], 10, IV, a.life * .6);
              return true;
            });
            c.globalCompositeOperation = 'source-over';
            var pu = .5 + .5 * Math.sin(t * 1.8);
            c.fillStyle = '#050505'; c.fillRect(128, 250, 70, 96);
            c.beginPath(); c.rect(128.5, 250.5, 69, 95); gstroke(c, GOLD, .6 + .4 * pu, 1);
            c.strokeStyle = 'rgba(' + G7 + ',.9)'; c.strokeRect(140.5, 262.5, 45, 71);
            c.globalCompositeOperation = 'lighter'; glow(c, 163, 298, 26 + pu * 8, GOLD, .55); c.globalCompositeOperation = 'source-over';
            c.beginPath(); c.arc(163, 298, 8, 0, TAU); gstroke(c, IV, .9, 1);
          }
        },
        /* 빛과 어둠: 쏟아지는 빛줄기가 내려갈수록 오염되고, 바닥에서 어둠의 덩굴이 기어오르며, 정화의 불씨가 다시 솟는다 */
        gauge: {
          init: function (r, q) {
            var f = [], e = [], v = [];
            for (var i = 0; i < 120 * q; i++) f.push({ x: 64 + r() * 172, y: 70 + r() * 420, v: 40 + r() * 70, s: .7 + r() * 1.3 });
            for (var j = 0; j < 30 * q; j++) e.push({ x: 250 + r() * 6, y: r() * 560, v: 30 + r() * 50 });
            for (var k = 0; k < 7; k++) v.push({ x: 72 + k * 26 + r() * 10, h: 60 + r() * 90, p: r() * TAU });
            return { f: f, e: e, v: v, r: r };
          },
          draw: function (c, S, t, dt, tc) {
            bg(c, '#0b0906', '#020202');
            var g = c.createLinearGradient(0, 70, 0, 490);
            g.addColorStop(0, 'rgba(' + IV + ',.95)'); g.addColorStop(.1, 'rgba(' + GOLD + ',.75)'); g.addColorStop(.5, 'rgba(' + G7 + ',.4)'); g.addColorStop(.9, 'rgba(20,15,8,.9)'); g.addColorStop(1, 'rgba(0,0,0,1)');
            c.fillStyle = g; c.fillRect(60, 70, 180, 420);
            c.globalCompositeOperation = 'lighter';
            var beam = c.createLinearGradient(0, 0, 0, 70); beam.addColorStop(0, 'rgba(' + IV + ',0)'); beam.addColorStop(1, 'rgba(' + IV + ',.65)'); c.fillStyle = beam; c.fillRect(144, 0, 32, 70);
            glow(c, 160, 74, 80, IV, .45);
            tc.globalCompositeOperation = 'lighter';
            S.f.forEach(function (p) {
              p.y += p.v * dt; if (p.y > 490) { p.y = 70; p.x = 64 + S.r() * 172; }
              var k = (p.y - 70) / 420; if (k < .88) { tc.fillStyle = 'rgba(' + IV + ',' + ((1 - k) * .9).toFixed(3) + ')'; tc.fillRect(p.x, p.y, p.s, p.s * 2); }
            });
            c.globalCompositeOperation = 'source-over';
            /* 어둠의 덩굴: 바닥에서 위로 일렁이며 기어오른다 */
            S.v.forEach(function (o) {
              var h = o.h * (.75 + .25 * Math.sin(t * .6 + o.p));
              c.beginPath(); c.moveTo(o.x, 490);
              for (var y = 0; y <= h; y += 6) c.lineTo(o.x + Math.sin(y * .08 + t * 1.2 + o.p) * (4 + y * .05), 490 - y);
              c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.55)'; c.stroke(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(' + G7 + ',.35)'; c.stroke(); c.lineWidth = 1;
            });
            S.f.forEach(function (p) { var k = (p.y - 70) / 420; if (k > .6) { c.fillStyle = 'rgba(0,0,0,' + ((k - .6) * 1.6).toFixed(3) + ')'; c.beginPath(); c.arc(p.x, p.y, p.s * 2.4, 0, TAU); c.fill(); } });
            c.beginPath(); c.rect(60.5, 70.5, 179, 419); gstroke(c, G5, .9, 1);
            c.setLineDash([4, 4]); c.strokeStyle = 'rgba(5,5,5,.9)'; line(c, 60, 112, 240, 112); c.strokeStyle = 'rgba(' + G7 + ',.9)'; line(c, 60, 448, 240, 448); c.setLineDash([]);
            tc.globalCompositeOperation = 'lighter';
            S.e.forEach(function (p) { p.y -= p.v * dt; if (p.y < 0) p.y = 560; var k = p.y / 560; tc.fillStyle = 'rgba(' + (k > .5 ? G5 : IV) + ',' + (.3 + .6 * (1 - k)).toFixed(3) + ')'; tc.fillRect(p.x, p.y, 1.3, 2.5); });
            c.strokeStyle = 'rgba(' + G7 + ',.9)'; line(c, 262, 70, 262, 490);
            c.font = '11px "Barlow Condensed", monospace'; c.fillStyle = 'rgba(' + G5 + ',1)';
            var m = (Math.sin(t * .5) * .5 + .5), my = 70 + m * 420;
            /* 바늘 표시와 겹치는 눈금 숫자는 잠깐 숨긴다 */
            [[0, '0'], [10, '10'], [90, '90'], [100, '100']].forEach(function (b) { var y = 70 + b[0] * 4.2; line(c, 262, y, 292, y); if (Math.abs(y - (my - 11)) > 13) c.fillText(b[1], 296, y + 4); });
            for (var tk = 0; tk <= 100; tk += 5) { var ty = 70 + tk * 4.2; line(c, 262, ty, 268, ty); }
            c.globalCompositeOperation = 'lighter'; glow(c, 254, my, 12, GOLD, .7); c.globalCompositeOperation = 'source-over';
            c.fillStyle = 'rgba(' + GOLD + ',1)'; c.beginPath(); c.moveTo(258, my); c.lineTo(250, my - 5); c.lineTo(250, my + 5); c.closePath(); c.fill();
            c.fillText((m < .1 ? '빛 ' : m < .9 ? '에테로스 ' : '어둠 ') + Math.round(m * 100) + '%', 268, my - 7);
          }
        },
        /* 대차원: 성운과 금빛 은하수, 앞쪽이 더 밝은 강착 원반의 블랙홀, 빛이 타고 오르는 보석 기둥, 숨 쉬는 문 */
        vault: {
          init: function (r, q) {
            var dust = []; for (var i = 0; i < 180 * q; i++) dust.push({ u: r(), o: (r() - .5) * 28, s: .5 + r() * 1.1, v: .01 + r() * .02 });
            return { st: mkStars(r, 120 * q, 0, 0, 320, 300), dust: dust, neb: nebula(r, 10, [G7, '120,70,40', G5, '90,60,90']) };
          },
          draw: function (c, S, t, dt, tc) {
            bg(c, '#09070a', '#030303');
            c.globalCompositeOperation = 'lighter';
            if (!LITE) c.drawImage(S.neb, Math.sin(t * .05) * 12, 0);
            c.globalCompositeOperation = 'source-over';
            drawStars(c, S.st, t);
            c.globalCompositeOperation = 'lighter';
            S.dust.forEach(function (d) { d.u = (d.u + d.v * dt) % 1; var x = d.u * 340 - 10, y = 120 + Math.sin(d.u * 5 + 1) * 34 + d.o; c.fillStyle = 'rgba(' + GOLD + ',' + (.25 + .5 * (1 - Math.abs(d.o) / 14)).toFixed(3) + ')'; c.fillRect(x, y, d.s, d.s); });
            glow(c, 160, 170, 110, G5, .3);
            c.globalCompositeOperation = 'source-over';
            /* 강착 원반: 뒤쪽 반 → 구멍 → 앞쪽 반(더 밝게) */
            function disk(front) {
              c.save(); c.translate(160, 170); c.rotate(-.22);
              for (var k = 0; k < 4; k++) {
                c.beginPath(); c.ellipse(0, 0, 50 + k * 8, 10 + k * 2, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
                c.setLineDash([12 + k * 5, 5]); c.lineDashOffset = -t * (40 + k * 14);
                if (front) gstroke(c, k ? GOLD : IV, .85 - k * .16, 1.2); else { c.strokeStyle = 'rgba(' + G5 + ',' + (.45 - k * .1) + ')'; c.stroke(); }
              }
              c.setLineDash([]); c.restore();
            }
            disk(false);
            c.fillStyle = '#000'; c.beginPath(); c.arc(160, 170, 30, 0, TAU); c.fill();
            c.beginPath(); c.arc(160, 170, 31, 0, TAU); gstroke(c, IV, .85, 1.2);
            disk(true);
            [[48, 300], [98, 250], [222, 250], [272, 300]].forEach(function (p, i) {
              var pg = c.createLinearGradient(p[0] - 9, 0, p[0] + 9, 0); pg.addColorStop(0, '#0b0906'); pg.addColorStop(.5, '#1a140b'); pg.addColorStop(1, '#0b0906');
              c.fillStyle = pg; c.fillRect(p[0] - 9, p[1], 18, 500 - p[1]); c.beginPath(); c.rect(p[0] - 8.5, p[1] + .5, 17, 499 - p[1]); gstroke(c, G5, .85, 1);
              var sy = 500 - ((t * 60 + i * 90) % (500 - p[1] + 40));
              var sg = c.createLinearGradient(0, sy - 34, 0, sy + 34); sg.addColorStop(0, 'rgba(' + GOLD + ',0)'); sg.addColorStop(.5, 'rgba(' + IV + ',.6)'); sg.addColorStop(1, 'rgba(' + GOLD + ',0)');
              c.fillStyle = sg; c.fillRect(p[0] - 8, Math.max(p[1], sy - 34), 16, 68);
              c.globalCompositeOperation = 'lighter'; glow(c, p[0], p[1] - 12, 30, GOLD, .5 + .3 * Math.sin(t * 2 + i)); c.globalCompositeOperation = 'source-over';
              c.fillStyle = 'rgba(' + GOLD + ',.95)'; c.beginPath(); c.moveTo(p[0], p[1] - 26); c.lineTo(p[0] + 12, p[1]); c.lineTo(p[0], p[1] + 6); c.lineTo(p[0] - 12, p[1]); c.closePath(); c.fill();
              c.fillStyle = 'rgba(' + IV + ',.8)'; c.beginPath(); c.moveTo(p[0], p[1] - 26); c.lineTo(p[0] + 4, p[1]); c.lineTo(p[0], p[1] + 6); c.closePath(); c.fill();
            });
            var br = .6 + .4 * Math.sin(t * 1.4);
            c.globalCompositeOperation = 'lighter'; glow(c, 160, 450, 90, GOLD, .3 * br); c.globalCompositeOperation = 'source-over';
            c.fillStyle = '#120f0a'; c.beginPath(); c.moveTo(124, 500); c.lineTo(124, 420); c.arc(160, 420, 36, Math.PI, 0); c.lineTo(196, 500); c.closePath(); c.fill(); gstroke(c, GOLD, .6 + .4 * br, 1.4);
            var dg = c.createLinearGradient(0, 400, 0, 500); dg.addColorStop(0, 'rgba(' + IV + ',' + (.5 * br).toFixed(3) + ')'); dg.addColorStop(1, 'rgba(' + GOLD + ',0)');
            c.fillStyle = dg; c.fillRect(156, 400, 8, 100);
            c.strokeStyle = 'rgba(' + G7 + ',.9)'; line(c, 0, 500, 320, 500);
            var fl = c.createLinearGradient(0, 500, 0, 560); fl.addColorStop(0, 'rgba(' + G7 + ',.25)'); fl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = fl; c.fillRect(0, 500, 320, 60);
          }
        },
        /* 운명선: 흔들리는 실들, 그중 하나가 비틀리다 끊어지며 충격파가 퍼지고 다시 이어진다 */
        threads: {
          init: function (r, q) { var n = []; for (var i = 0; i < 30 * q; i++) n.push({ i: (r() * 13) | 0, y: r() * 560, v: 20 + r() * 40 }); return { st: mkStars(r, 30 * q, 0, 0, 320, 560), n: n, r: r, sp: [], ring: -1 }; },
          draw: function (c, S, t, dt, tc) {
            bg(c, '#0a0806', '#030303');
            drawStars(c, S.st, t, G5, .7);
            var cyc = (t % 7) / 7, twist = Math.min(1, cyc / .45), snap = cyc > .45 && cyc < .85, gap = snap ? Math.sin((cyc - .45) / .4 * Math.PI) * 34 : 0;
            if (cyc > .45 && cyc < .47 && S.sp.length < 20) { for (var s = 0; s < 24; s++) S.sp.push({ x: 160, y: 304, vx: (S.r() - .5) * 140, vy: (S.r() - .5) * 140, l: 1 }); S.ring = 0; }
            c.globalCompositeOperation = 'lighter'; glow(c, 160, 304, 70 + twist * 30, GOLD, .12 + twist * .18); c.globalCompositeOperation = 'source-over';
            for (var i = 0; i < 13; i++) {
              var x0 = 28 + i * 22;
              if (i === 6) {
                c.beginPath(); c.moveTo(x0, 0);
                for (var y = 0; y <= 304 - gap; y += 6) { var tw = Math.exp(-Math.pow((y - 304) / 90, 2)) * twist * 26; c.lineTo(x0 + Math.sin(y * .09 + t * 3) * tw, y); }
                gstroke(c, GOLD, .95, 1.5);
                c.beginPath(); c.moveTo(x0 + Math.sin((304 + gap) * .09 + t * 3) * twist * 26, 304 + gap);
                for (var y2 = 304 + gap; y2 <= 560; y2 += 6) { var tw2 = Math.exp(-Math.pow((y2 - 304) / 90, 2)) * twist * 26; c.lineTo(x0 + Math.sin(y2 * .09 + t * 3) * tw2, y2); }
                gstroke(c, GOLD, .95, 1.5);
                if (snap) { c.globalCompositeOperation = 'lighter'; glow(c, x0, 304 - gap, 16, IV, .9); glow(c, x0, 304 + gap, 16, IV, .9); c.globalCompositeOperation = 'source-over'; }
              } else {
                c.beginPath(); c.moveTo(x0, 0);
                for (var y3 = 0; y3 <= 560; y3 += 14) c.lineTo(x0 + Math.sin(y3 * .012 + t * .7 + i) * 2.2 + (snap ? Math.sin(y3 * .05) * gap * .04 * (1 - Math.abs(i - 6) / 6) : 0), y3);
                c.strokeStyle = 'rgba(' + (i % 3 ? G7 : G5) + ',' + (i % 3 ? .55 : .85) + ')'; c.lineWidth = .8; c.stroke(); c.lineWidth = 1;
              }
            }
            /* 충격파 */
            if (S.ring >= 0) { S.ring += dt; var rr = S.ring * 160, ra = 1 - S.ring / 1.2; if (ra <= 0) S.ring = -1; else { c.beginPath(); c.ellipse(160, 304, rr, rr * .35, 0, 0, TAU); gstroke(c, IV, ra * .7, 1); } }
            tc.globalCompositeOperation = 'lighter';
            S.n.forEach(function (o) { o.y += o.v * dt; if (o.y > 560) o.y = 0; if (o.i === 6 && Math.abs(o.y - 304) < gap + 4) return; var x = 28 + o.i * 22 + Math.sin(o.y * .012 + t * .7 + o.i) * 2.2; glow(tc, x, o.y, 6, GOLD, .75); });
            S.sp = S.sp.filter(function (p) { p.l -= dt * 1.1; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; if (p.l <= 0) return false; tc.fillStyle = 'rgba(' + IV + ',' + p.l.toFixed(3) + ')'; tc.fillRect(p.x, p.y, 2, 2); return true; });
          }
        }
      };

      /* 실행기: 본 캔버스 + 잔상 레이어, 비네트·필름 입자, 품질 자동 조절 */
      var cv = document.createElement('canvas'); cv.className = 'wld__fx'; cv.setAttribute('aria-hidden', 'true');
      var c = cv.getContext('2d'), tcv = off(1, 1), tc = tcv.getContext('2d');
      /* 필름 입자는 CSS 레이어로 (캔버스 그리기 비용에서 뺀다) — 한 번만 만들어 카드 덮개 배경으로 쓴다 */
      (function () { var o = off(128, 128), g = o.getContext('2d'), d = g.createImageData(128, 128), r = rnd(99); for (var i = 0; i < d.data.length; i += 4) { var v = (r() * 255) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0);
        document.documentElement.style.setProperty('--wld-grain', 'url(' + o.toDataURL('image/png') + ')'); })();
      /* 고해상도 휴대폰·코어가 적은 기기는 한 단계 낮춰서 시작한다 */
      var kind = null, S = null, last = 0, T = 0, Q = [1, .7, .45, .3], lvl = ((devicePixelRatio || 1) > 2.4 || (navigator.hardwareConcurrency || 8) <= 4) ? 1 : 0, acc = 0, frames = 0, slow = 0, fast = 0, warm = 0;
      var DPR = [Math.min(devicePixelRatio || 1, 2), Math.min(devicePixelRatio || 1, 1.5), 1, .75];
      function size() {
        var w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
        var d = DPR[lvl]; cv.width = Math.round(w * d); cv.height = Math.round(h * d);
        c.setTransform(d * w / 320, 0, 0, d * h / 560, 0, 0);
        /* 잔상 레이어는 절반 해상도 (꼬리가 부드럽게 번진다) */
        tcv.width = Math.max(1, cv.width >> 1); tcv.height = Math.max(1, cv.height >> 1);
        tc.setTransform(tcv.width / 320, 0, 0, tcv.height / 560, 0, 0);
      }
      function set(k, host) {
        kind = k; host.appendChild(cv); S = ART[k].init(rnd(7 + k.length * 13), Q[lvl]); warm = 0; acc = 0; frames = 0;
        tc.clearRect(0, 0, 320, 560);
        cv.classList.remove('is-in'); void cv.offsetWidth; cv.classList.add('is-in');
        requestAnimationFrame(size);
      }
      function draw(now) {
        if (!kind || !cv.isConnected || !cv.clientWidth) return;
        var dt = last ? Math.min(.1, (now - last) / 1000) : .016; last = now; T += dt;
        /* 1초마다 평균 프레임을 보고, 초당 30장 아래면 바로 한 단계 낮추고, 3초 연속 55장 넘으면 한 단계 올린다
           (4단계: 해상도 2→1.5→1→0.75배, 입자 100→30%, 2단계부터 잔상 끔) */
        acc += dt; frames++; warm += dt;
        if (acc > 1) { var fps = frames / acc; acc = 0; frames = 0;
          if (warm > 1.5) {                                   /* 카드가 바뀐 직후·페이지를 막 불러온 때는 재지 않는다 */
            slow = fps < 30 ? slow + 1 : 0; fast = fps > 55 ? fast + 1 : 0;
            if (slow >= 1 && lvl < 3) { lvl++; slow = fast = 0; S = ART[kind].init(rnd(7 + kind.length * 13), Q[lvl]); size(); }
            else if (fast >= 3 && lvl > 0) { lvl--; slow = fast = 0; S = ART[kind].init(rnd(7 + kind.length * 13), Q[lvl]); size(); }   /* 넉넉하면 다시 올린다 */
          }
          cv.dataset.fps = Math.round(fps); cv.dataset.lvl = lvl; }
        if (cv.width !== Math.round(cv.clientWidth * DPR[lvl])) size();
        /* 잔상 레이어: 이전 프레임을 조금씩 지운다. 버거운 단계(2 이상)에서는 끄고 본 캔버스에 바로 그린다 */
        var trails = lvl < 2; LITE = lvl >= 3;
        if (trails) { tc.globalCompositeOperation = 'destination-out'; tc.fillStyle = 'rgba(0,0,0,.28)'; tc.fillRect(0, 0, 320, 560); tc.globalCompositeOperation = 'source-over'; }
        c.save(); ART[kind].draw(c, S, T, dt, trails ? tc : c); c.restore();
        if (trails) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'lighter'; c.drawImage(tcv, 0, 0, cv.width, cv.height); c.restore(); }
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      }
      return { cv: cv, set: set, draw: draw, has: function (k) { return !!ART[k]; } };
    })();

    track.innerHTML = W.map(function (w, i) {
      return '<li class="wld__card" data-l="' + i + '"><button type="button" aria-label="' + esc(w.name) + ' 기록 보기">' +
        '<svg class="wld__art" viewBox="0 0 320 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + ART[w.art]() + '</svg>' +
        '<span class="mono wld__cno">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="wld__cap"><b>' + esc(w.name) + '</b><span class="mono">' + esc(w.en) + '</span></span></button></li>';
    }).join('');
    $('[data-l-total]').textContent = String(W.length).padStart(2, '0');
    var cards = track.children;

    function fill(i, first) {
      var w = W[i];
      $('[data-l-no]').textContent = String(i + 1).padStart(2, '0');
      $('[data-l-en]').textContent = w.en;
      var nm = $('[data-l-name]'), ds = $('[data-l-desc]'), fx = $('[data-l-facts]'), sg = $('[data-l-sigil]');
      sg.innerHTML = sigil(w);
      fx.innerHTML = w.facts.map(function (f, k) {
        return '<div style="--k:' + k + '"><dt class="mono">' + esc(f[0]) + (f[2] === 'legacy' ? '<em class="wld__leg" title="레거시 문서 기준">Legacy</em>' : '') + '</dt><dd>' + esc(f[1]) + '</dd></div>';
      }).join('');
      if (first || reduce) { nm.textContent = w.name; ds.textContent = w.desc; return; }
      var info = nm.closest('.wld__info'); info.classList.remove('is-swap'); void info.offsetWidth; info.classList.add('is-swap');
      RSC.scramble(nm, w.name, 520); ds.textContent = w.desc;
    }
    function layout() {
      /* 고른 카드부터 오른쪽으로 늘어선다. 앞의 카드들은 왼쪽 밖으로 밀려난다 */
      var x = 0;
      for (var k = 0; k < cards.length; k++) {
        cards[k].classList.toggle('is-on', k === cur);
        cards[k].classList.toggle('is-past', k < cur);
        cards[k].querySelector('button').setAttribute('aria-current', k === cur ? 'true' : 'false');
      }
      /* 폭이 바뀌는 중인 카드(지금·직전 선택)를 피해, 변하지 않는 카드의 폭으로 계산한다 */
      var ref = null;
      for (var q = 0; q < cards.length; q++) if (q !== cur && q !== prev) { ref = cards[q]; break; }
      var small = ref ? ref.offsetWidth : cards[0].offsetWidth;
      x = cur * (small + 10);
      track.style.transform = 'translateX(' + (-x) + 'px)';
    }
    function go(i) {
      i = (i + W.length) % W.length; if (i === cur) return;
      prev = cur; cur = i; fill(cur); layout(); anim();
      clearTimeout(busy); busy = setTimeout(function () { prev = -1; layout(); }, 700);
    }
    $('[data-l-prev]').addEventListener('click', function () { go(cur - 1); });
    $('[data-l-next]').addEventListener('click', function () { go(cur + 1); });
    track.addEventListener('click', function (e) { var c = e.target.closest('[data-l]'); if (c) go(+c.dataset.l); });
    deck.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: -1, ArrowRight: 1 }[e.key]; if (!d) return;
      e.preventDefault(); e.stopPropagation(); go(cur + d);
    });
    /* 휴대폰: 옆으로 밀어서 넘김 */
    var sx = null;
    deck.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') sx = e.clientX; });
    deck.addEventListener('pointerup', function (e) { if (sx === null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1)); });
    function anim() { if (!reduce && FX.has(W[cur].art)) FX.set(W[cur].art, cards[cur].querySelector('button')); }
    if (!reduce) loop(deck, FX.draw);
    watch(deck, layout);
    fill(0, true); layout(); anim();
  })();

  /* ── 08 NOTICE: 왼쪽 목록을 고르면 오른쪽 카드가 바뀐다 ── */
  (function () {
    var box = $('[data-notices]'), card = $('[data-news-card]'), ni = -1;
    var list = D.notices.slice(0, 6);
    box.innerHTML = list.map(function (n, i) {
      return '<li><button data-news="' + i + '"><span class="news__tag mono">' + esc(n.tag) + '</span><strong>' + esc(n.title) + '</strong><span class="mono">' + n.date + '</span></button></li>';
    }).join('');
    function show(i) {
      if (i === ni) return; ni = i;
      var n = list[i];
      [].forEach.call(box.children, function (li, k) { li.classList.toggle('is-on', k === i); li.firstChild.setAttribute('aria-pressed', k === i); });
      card.innerHTML = '<p class="mono"><span class="gold">// ' + esc(n.tag) + '</span> · ' + n.date + '</p><h3>' + esc(n.title) + '</h3>' +
        '<ul>' + n.body.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
        '<ol class="news__dots" aria-hidden="true">' + list.map(function (_, k) { return '<li' + (k === i ? ' class="is-on"' : '') + '></li>'; }).join('') + '</ol>';
      card.classList.remove('is-swap'); void card.offsetWidth; card.classList.add('is-swap');
    }
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-news]'); if (b) show(+b.dataset.news); });
    show(0);
  })();

  /* ── 09 GALLERY ── */
  $('[data-galrow]').innerHTML = D.gallery.map(function (a) {
    return '<li style="aspect-ratio:' + a.ratio + '"><a href="gallery.html#a=' + a.id + '" aria-label="작품 ' + a.id + '"><div class="slot"><span>' + a.code + '<br>EMPTY</span></div></a></li>';
  }).join('');

  (function () {
    var row = $('[data-galrow]');
    $('[data-gal-prev]').innerHTML = RSC.chev(-1); $('[data-gal-next]').innerHTML = RSC.chev(1);
    function step(d) { row.scrollBy({ left: d * row.clientWidth * .8, behavior: reduce ? 'auto' : 'smooth' }); }
    $('[data-gal-prev]').addEventListener('click', function () { step(-1); });
    $('[data-gal-next]').addEventListener('click', function () { step(1); });
  })();

  RSC.observe();

  /* ── 명조식 한 화면씩 넘기기 (PC, 화면이 충분히 클 때) ──
     휠·키보드·레일·해시로 구역을 바꾼다. 구역 안이 화면보다 길면 먼저 안에서 스크롤한다. */
  var secs = [].slice.call(document.querySelectorAll('.page > .sec[id]'));
  var deckMQ = matchMedia('(min-width: 901px) and (min-height: 620px)');
  var deck = false, cur = 0, busy = false, root = document.documentElement;
  var EN = { home: 'Home', character: 'Character', nation: 'Nation', map: 'Map', game: 'Game', world: 'World', novel: 'Novel', notice: 'Notice', gallery: 'Gallery', end: 'End' };

  var hud = document.createElement('div');
  hud.className = 'deckhud';
  hud.innerHTML = '<p class="mono deckhud__count"><b class="gold" data-d-no>01</b> / ' + String(secs.length).padStart(2, '0') + '<span data-d-name>Home</span></p>' +
    '<button class="deckhud__next mono" data-d-next>Scroll</button><i class="deckline" aria-hidden="true"></i>';
  document.body.appendChild(hud);
  var cam = document.createElement('div');      /* 밀리터리 카메라 오버레이 (한 화면 모드) */
  cam.className = 'camhud'; cam.setAttribute('aria-hidden', 'true');
  cam.innerHTML = '<p class="camhud__tl">RSC // ARCHIVE FEED · TC <span data-clock2>00:00:00</span></p><p class="camhud__tr">SIG <i></i></p>';
  hud.appendChild(cam);
  var cl2 = cam.querySelector('[data-clock2]');
  var camTimer = setInterval(function () { cl2.textContent = new Date().toTimeString().slice(0, 8); }, 1000);
  RSC.onLeave(function () { clearInterval(camTimer); });
  RSC.onLeave(function () { root.classList.remove('is-deck'); delete root.dataset.slide; });

  var queued = -1;
  function indexOf(id) { for (var k = 0; k < secs.length; k++) if (secs[k].id === id) return k; return -1; }
  function replay(sec) {               /* 들어오는 화면의 등장 연출을 다시 재생 */
    var rv = sec.querySelectorAll('.rv');
    sec.classList.add('rv-reset'); rv.forEach(function (el) { el.classList.remove('is-in'); });
    void sec.offsetWidth; sec.classList.remove('rv-reset');
    requestAnimationFrame(function () { rv.forEach(function (el) { el.classList.add('is-in'); }); });
  }
  function mark() {
    var id = secs[cur].id;
    root.dataset.slide = id;
    RSC.setNav(id === 'end' ? '' : id);
    $('[data-d-no]').textContent = String(cur + 1).padStart(2, '0');
    $('[data-d-name]').textContent = EN[id] || id;
    $('[data-d-next]').textContent = cur === secs.length - 1 ? 'Top' : 'Scroll';
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  }
  function goTo(i, instant) {
    i = Math.max(0, Math.min(secs.length - 1, i));
    if (!deck) return;
    if (busy && !instant) { queued = i; return; }      /* 넘어가는 중에 누른 곳은 기억했다가 끝나면 간다 */
    if (i === cur && !instant) return;
    var prev = secs[cur], next = secs[i];
    secs.forEach(function (s) { s.classList.remove('is-cur', 'is-out'); s.setAttribute('aria-hidden', 'true'); s.inert = true; });
    if (!instant && prev !== next) { prev.classList.add('is-out'); setTimeout(function () { prev.classList.remove('is-out'); }, 1400); }
    next.classList.add('is-cur'); next.removeAttribute('aria-hidden'); next.inert = false; next.scrollTop = 0;
    root.style.setProperty('--dir', i >= cur ? 1 : -1);
    cur = i; replay(next); mark();
    if (!instant) {
      var line = hud.querySelector('.deckline'); line.classList.remove('is-run'); void line.offsetWidth; line.classList.add('is-run');
      busy = true; queued = -1;
      setTimeout(function () { busy = false; if (queued >= 0 && queued !== cur) { var q = queued; queued = -1; goTo(q); } }, 1200);
    }
  }
  function setDeck(on) {
    if (on === deck) return;
    deck = on; root.classList.toggle('is-deck', on);
    if (on) { var k = indexOf(location.hash.slice(1)); goTo(k < 0 ? 0 : k, true); }
    else {
      secs.forEach(function (s) { s.classList.remove('is-cur', 'is-out'); s.removeAttribute('aria-hidden'); s.inert = false; });
      var t = secs[cur]; if (t) t.scrollIntoView();
    }
  }
  function canScrollInside(dy) {
    /* 넘치는 양이 48px 미만이면 '읽을 내용이 더 있다'고 보지 않고 바로 다음 화면으로 넘긴다
       (여백·장식 몇 픽셀 때문에 휠을 두 번 굴려야 하는 일이 없게) */
    var s = secs[cur], extra = s.scrollHeight - s.clientHeight;
    if (extra < 48) return false;
    return dy > 0 ? s.scrollTop + s.clientHeight < s.scrollHeight - 2 : s.scrollTop > 2;
  }
  function innerScroll(t, dy) {                      /* 기록 창처럼 안쪽에서 따로 스크롤되는 영역 */
    var el = t && t.closest && t.closest('[data-scroll]');
    return !!el && el.scrollHeight - el.clientHeight >= 4;   /* 끝까지 읽어도 화면이 넘어가지 않게 */
  }
  function overlayOpen() { return !!document.querySelector('.rpanel.is-open'); }

  addEventListener('wheel', function (e) {
    if (!deck || e.ctrlKey || overlayOpen() || Math.abs(e.deltaX) > Math.abs(e.deltaY) || !e.deltaY) return;
    if (canScrollInside(e.deltaY) || innerScroll(e.target, e.deltaY)) return;            /* 구역 안 스크롤이 먼저 */
    e.preventDefault();
    if (!busy) goTo(cur + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });
  addEventListener('keydown', function (e) {
    if (!deck || overlayOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable], .mapview, .m3d, [data-scroll]')) return;
    var d = { PageDown: 1, ArrowDown: 1, ' ': 1, PageUp: -1, ArrowUp: -1 }[e.key];
    if (e.key === ' ' && t.closest && t.closest('button, a')) return;
    if (e.key === 'Home') { e.preventDefault(); return goTo(0); }
    if (e.key === 'End') { e.preventDefault(); return goTo(secs.length - 1); }
    if (!d || canScrollInside(d)) return;
    e.preventDefault(); goTo(cur + d);
  });
  RSC.on(document, 'click', function (e) {          /* 레일·바로가기·#링크 → 해당 화면으로 */
    if (!deck || e.defaultPrevented) return;
    var a = e.target.closest('a[href*="#"]'); if (!a) return;
    var url = new URL(a.href, location.href), k = indexOf(url.hash.slice(1));
    if (k < 0 || url.pathname.replace(/index\.html$/, '') !== location.pathname.replace(/index\.html$/, '')) return;
    e.preventDefault(); goTo(k);
  });
  addEventListener('hashchange', function () { var k = indexOf(location.hash.slice(1)); if (deck && k >= 0) goTo(k); });
  $('[data-d-next]').addEventListener('click', function () { goTo(cur === secs.length - 1 ? 0 : cur + 1); });
  /* '지도에서 보기'는 지도 화면으로 넘긴 뒤 위치를 옮긴다 */
  $('[data-n-map]').addEventListener('click', function (e) { if (deck) { e.preventDefault(); goTo(indexOf('map')); } });
  function onMQ(e) { setDeck(e.matches); }
  deckMQ.addEventListener('change', onMQ);
  RSC.onLeave(function () { deckMQ.removeEventListener('change', onMQ); });
  setDeck(deckMQ.matches);

  /* 현재 구역 추적: 레일 표시 + 주소 해시 */
  var spy = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting || deck) return;
      RSC.setNav(en.target.id);
      if (location.hash !== '#' + en.target.id) history.replaceState(null, '', '#' + en.target.id);
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  var spyTimer = setTimeout(function () { document.querySelectorAll('.sec[id]').forEach(function (s) { spy.observe(s); }); }, 600);
  RSC.onLeave(function () { clearTimeout(spyTimer); spy.disconnect(); });
})();
