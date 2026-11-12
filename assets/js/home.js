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
    var on = false, raf = 0;
    var sec = el.closest('.sec'), root = document.documentElement;
    function shown() { return !root.classList.contains('is-deck') || !sec || sec.classList.contains('is-cur') || sec.classList.contains('is-out'); }
    /* 한 화면 모드에서 보이지 않는 화면의 캔버스는 그리지 않는다 */
    function tick(t) { if (!on) return; if (shown()) draw(t); raf = requestAnimationFrame(tick); }
    new IntersectionObserver(function (es) {
      on = es[0].isIntersecting && !document.hidden;
      cancelAnimationFrame(raf);
      if (on) raf = requestAnimationFrame(tick);
    }).observe(el);
    RSC.on(document, 'visibilitychange', function () { if (document.hidden) { on = false; cancelAnimationFrame(raf); } });
    RSC.onLeave(function () { on = false; cancelAnimationFrame(raf); });
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
  var SECS = [['character', '캐릭터'], ['nation', '국가 소개'], ['map', '지도'], ['game', '게임'], ['clue', '떡밥'], ['novel', '소설'], ['notice', '공지'], ['gallery', '갤러리']];
  $('[data-quick]').innerHTML = SECS.map(function (s, i) {
    return '<li><a href="#' + s[0] + '"><b>' + String(i + 2).padStart(2, '0') + '</b>' + s[1] + '</a></li>';
  }).join('');

  var clock = $('[data-clock]');
  function tickClock() { clock.textContent = new Date().toTimeString().slice(0, 8); }
  tickClock(); var clockTimer = setInterval(tickClock, 1000); RSC.onLeave(function () { clearInterval(clockTimer); });

  (function homeFx() {
    /* 마법진 HUD — 참고 이미지(743×341)의 배치를 같은 비율 좌표로 옮겼다.
       성능: 움직이지 않는 층은 별도 캔버스에 한 번만 그리고(진짜 빛 번짐 포함), 깊이감은 그 캔버스를 통째로 옮긴다(GPU 합성).
             회전하는 고리는 매 프레임 선으로 그린다 — 칠하는 면적이 작아 회전 그림 붙이기보다 훨씬 가볍다.
       품질: 굵고 옅은 선을 겹쳐 빛 번짐, 고리를 따라 흐르는 빛, 궤도 불꽃, 레이더 스윕, 등장 연출, 층별 깊이감.
       느린 기기: 40프레임마다 평균 프레임 시간을 재서 33ms(30fps)를 넘으면 품질을 한 단계씩 낮춘다. */
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
      [X, Y, 136, .012, 0, 0, function () { poly(X, Y, 134, 7, -Math.PI / 2, SIL, .16); }],
      [X, Y, 120, -.02, 0, 0, function () { dotRing(X, Y, 118, 90, .7, SIL, .35); }],
      [X, Y, 79, .03, 0, 1, function () { dotRing(X, Y, 77, 110, .6, SIL, .8); }],
      [X, Y, 101, -.025, 0, 0, function () { dotRing(X, Y, 100, 160, .45, SIL, .4); ticks(X, Y, 90, 72, 2, SIL, .25); }],
      [X, Y, 82, -.02, 0, 0, function () { for (var p = 0; p < 8; p++) { var t = p / 8 * TAU; arc(X + Math.cos(t) * 78, Y + Math.sin(t) * 78, 50, t + Math.PI - .78, t + Math.PI + .78, SIL, .09); } }],
      [X, Y, 116, -.05, 0, 0, function () { arc(X, Y, 113, 0, .55, SIL, .4, 1.6); arc(X, Y, 113, 3.3, 3.7, SIL, .4, 1.6); }],
      /* 왼쪽 위: 겹친 불규칙 다각형 */
      [85, 72, 50, .05, 0, 0, function () { poly(85, 72, 44, 6, 0, SIL, .38); st(SIL, .3); c.beginPath(); c.ellipse(85, 72, 41, 33, .4, 0, TAU); c.stroke(); }],
      [85, 72, 50, -.07, .8, 0, function () { poly(85, 72, 42, 7, .3, SIL, .34); }],
      [85, 72, 50, .09, 1.6, 0, function () { poly(85, 72, 40, 5, .1, SIL, .3); st(SIL, .26); c.beginPath(); c.ellipse(85, 72, 38, 30, -.5, 0, TAU); c.stroke(); }],
      [85, 72, 50, -.11, 2.4, 0, function () { poly(85, 72, 46, 6, .5, SIL, .22); }],
      /* 왼쪽 가운데 */
      [160, 170, 64, .06, 0, 0, function () { arc(160, 170, 58, -2.6, -1.75, SIL, .45, 2.6); arc(160, 170, 58, 1.9, 2.5, SIL, .4, 2.6); }],
      [160, 170, 46, -.04, 0, 0, function () { dotRing(160, 170, 45, 90, .45, SIL, .45); }],
      /* 왼쪽 아래: 굵은 점 두 구간 + 가는 점선 */
      [92, 277, 54, -.04, 0, 1, function () { dotRing(92, 277, 50, 8, 1.5, SIL, .85, 3.55, 4.35); dotRing(92, 277, 50, 8, 1.2, SIL, .7, 5.2, 6.0); }],
      [92, 277, 56, .02, 0, 0, function () { dotRing(92, 277, 54, 120, .45, SIL, .4); }],
      /* 가운데 아래: 오른쪽 굵은 호 + 점선 */
      [357, 270, 52, .05, 0, 0, function () { arc(357, 270, 48, -1.1, 1.4, SIL, .45, 3); }],
      [357, 270, 54, -.03, 0, 0, function () { dotRing(357, 270, 52, 70, .5, SIL, .4); }],
      /* 오른쪽 위: 기울어진 타원 모양 블록 점선 */
      [645, 75, 36, .07, 0, 1, function () { c.save(); c.translate(645, 75); c.rotate(-.45); for (var i = 0; i < 12; i++) { var t = i / 12 * TAU; st(SIL, .8 - (i % 3) * .12, 3); c.beginPath(); c.ellipse(0, 0, 20, 9, 0, t, t + .28); c.stroke(); } c.restore(); }],
      [645, 75, 34, -.03, 0, 0, function () { ticks(645, 75, 28, 24, 2.5, SIL, .25); }],
      /* 열쇠 고리: 촘촘한 점 테두리 */
      [533, 125, 36, .04, 0, 0, function () { dotRing(533, 125, 33, 60, .6, SIL, .55); }],
      /* 구슬 표식 고리: 점선 테 + 짧은 호 */
      [612, 190, 56, -.05, 0, 0, function () { dotRing(612, 190, 52, 80, .5, SIL, .45); arc(612, 190, 52, .5, 1.1, SIL, .4, 1.4); arc(612, 190, 52, 3.6, 4.2, SIL, .4, 1.4); }],
      /* 갈고리 고리: 가는 연속 원(위쪽만 조금 끊김) */
      [515, 258, 44, .03, 0, 0, function () { arc(515, 258, 40, -1.0, 4.4, SIL, .55, 1.3); }],
      [683, 345, 80, .03, 0, 0, function () { ticks(683, 345, 73, 70, 3, SIL, .3); }]
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
      /* 등장 직후 2.5초는 재지 않고, 40프레임 묶음이 두 번 연속 느릴 때만 낮춘다 (잠깐 끊긴 것으로 낮추지 않게) */
      if (!reduce && t - born > 2500 && dt < 250) { acc += dt; if (++cnt >= 40) { bad = acc / cnt > 33 ? bad + 1 : 0; if (bad >= 2 && quality > 0) { quality--; bad = 0; build(); } acc = 0; cnt = 0; } }
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
    RSC.homeFxQuality = function () { return quality; };   /* 점검용 */
    if (reduce) draw(0); else loop(cv, draw);
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
    var SPIN = reduce ? 0 : .004;                    /* 기준 회전 속도(60fps 한 프레임당) */
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
        c.fillStyle = i % 9 === 0 ? '#fff3c4' : '#d4a73a';
        var sz = f * (i % 9 === 0 ? 1.9 : 1.3);
        c.fillRect(px, py, sz, sz);
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

  /* ── 04 MAP: 끌어서 이동, 확대·축소 ── */
  var map = (function () {
    var view = $('[data-map]'), world = $('[data-world]'), W = 2400, H = 1600;
    var st = { x: 0, y: 0, z: 1 }, zmin = .3, zmax = 3, ptr = new Map(), pinch = 0, anim = 0, sel = -1;

    var svg = '<svg viewBox="0 0 2400 1600" stroke="#8f6a1c" stroke-width="1" aria-hidden="true">' +
      [180, 360, 540, 720].map(function (r) { return '<circle cx="1200" cy="800" r="' + r + '" opacity=".' + (r > 400 ? 25 : 45) + '" stroke-dasharray="' + (r % 360 ? '2 10' : 'none') + '"/>'; }).join('') +
      '<path d="M0 1600L2400 0M1200 0v1600M0 800h2400" opacity=".3"/>' +
      '<path d="M1200 770l30 30-30 30-30-30z" stroke="#f2d27a"/>' +
      '<rect x="120" y="120" width="2160" height="1360" stroke-dasharray="14 10" opacity=".5"/></svg>';
    var labels = '';
    for (var gx = 0; gx < 6; gx++) for (var gy = 0; gy < 4; gy++) labels += '<span class="grid-no" style="left:' + (gx * 400 + 8) + 'px;top:' + (gy * 400 + 6) + 'px">' + 'ABCDEF'[gx] + (gy + 1) + '</span>';
    world.innerHTML = svg + labels + D.nations.map(function (n, i) {
      return '<button class="pin" data-pin="' + i + '" style="left:' + n.map[0] + 'px;top:' + n.map[1] + 'px" aria-label="' + esc(n.name) + ' ' + n.id + '"><span>' + n.code + '</span></button>';
    }).join('');
    $('[data-maplist]').innerHTML = D.nations.map(function (n, i) {
      return '<li><button data-loc="' + i + '"><span class="mono gold">' + n.id + '</span><strong>' + esc(n.name) + '</strong><span class="mono">X ' + n.map[0] + ' · Y ' + n.map[1] + '</span></button></li>';
    }).join('');

    function size() { return view.getBoundingClientRect(); }
    function apply() {
      var r = size();
      zmin = Math.max(r.width / W, r.height / H);
      st.z = Math.max(zmin, Math.min(zmax, st.z));
      st.x = Math.min(0, Math.max(r.width - W * st.z, st.x));
      st.y = Math.min(0, Math.max(r.height - H * st.z, st.y));
      world.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px) scale(' + st.z + ')';
      world.style.setProperty('--z', st.z);
      $('[data-mz]').textContent = st.z.toFixed(2);
    }
    function zoomAt(cx, cy, z) {
      z = Math.max(zmin, Math.min(zmax, z));
      st.x = cx - (cx - st.x) * (z / st.z); st.y = cy - (cy - st.y) * (z / st.z); st.z = z; apply();
    }
    function fly(wx, wy, z) {
      cancelAnimationFrame(anim);
      var r = size(), a = { x: st.x, y: st.y, z: st.z };
      z = Math.max(zmin, Math.min(zmax, z));
      var b = { x: r.width / 2 - wx * z, y: r.height / 2 - wy * z, z: z }, t0 = performance.now(), dur = 1600;
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        st.z = a.z + (b.z - a.z) * e; st.x = a.x + (b.x - a.x) * e; st.y = a.y + (b.y - a.y) * e; apply();
        if (p < 1) anim = requestAnimationFrame(step);
      })(t0);
    }
    function reset() { var r = size(); st.z = Math.max(r.width / W, r.height / H); st.x = (r.width - W * st.z) / 2; st.y = (r.height - H * st.z) / 2; apply(); }
    function select(i, move) {
      sel = i;
      document.querySelectorAll('[data-pin]').forEach(function (p) { p.classList.toggle('is-on', +p.dataset.pin === i); });
      document.querySelectorAll('[data-loc]').forEach(function (p) { p.classList.toggle('is-on', +p.dataset.loc === i); });
      if (move) { var n = D.nations[i]; fly(n.map[0], n.map[1], Math.max(1.4, zmin)); }
    }

    view.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.pin')) return;
      cancelAnimationFrame(anim);
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); view.setPointerCapture(e.pointerId); view.classList.add('is-drag');
      if (ptr.size === 2) { var p = Array.from(ptr.values()); pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
    });
    view.addEventListener('pointermove', function (e) {
      var r = size();
      $('[data-mx]').textContent = String(Math.round((e.clientX - r.left - st.x) / st.z)).padStart(4, '0');
      $('[data-my]').textContent = String(Math.round((e.clientY - r.top - st.y) / st.z)).padStart(4, '0');
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
      if (!e.ctrlKey && !e.metaKey) return;           /* 페이지 스크롤을 가로채지 않는다 */
      e.preventDefault(); var r = size();
      zoomAt(e.clientX - r.left, e.clientY - r.top, st.z * Math.exp(-e.deltaY * .0022));
    }, { passive: false });
    view.addEventListener('keydown', function (e) {
      var k = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[e.key];
      if (k) { e.preventDefault(); st.x += k[0]; st.y += k[1]; apply(); }
      if (e.key === '+' || e.key === '=') { var r = size(); zoomAt(r.width / 2, r.height / 2, st.z * 1.3); }
      if (e.key === '-') { var r2 = size(); zoomAt(r2.width / 2, r2.height / 2, st.z / 1.3); }
    });
    document.querySelectorAll('[data-zoom]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = +b.dataset.zoom, r = size();
        if (!d) { reset(); select(-1); return; }
        var cxw = (r.width / 2 - st.x) / st.z, cyw = (r.height / 2 - st.y) / st.z;
        fly(cxw, cyw, st.z * (d > 0 ? 1.5 : 1 / 1.5));
      });
    });
    world.addEventListener('click', function (e) { var p = e.target.closest('[data-pin]'); if (p) select(+p.dataset.pin, true); });
    $('[data-maplist]').addEventListener('click', function (e) { var p = e.target.closest('[data-loc]'); if (p) select(+p.dataset.loc, true); });
    addEventListener('resize', apply);
    reset();
    return { select: select };
  })();
  $('[data-n-map]').addEventListener('click', function () { setTimeout(function () { map.select(nation.current(), true); }, 900); });

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

  /* ── 06 CLUE ── */
  (function () {
    var box = $('[data-clues]');
    box.innerHTML = D.clues.map(function (cl, i) {
      var w = [[92, 64], [78, 88], [96, 52], [70, 81], [88, 60]][i % 5];
      return '<li class="rv" style="--d:' + i + '"><button aria-expanded="false"><span class="mono gold">' + cl.code + '</span>' +
        '<span class="redact"><i style="--w:' + w[0] + '%"></i><i style="--w:' + w[1] + '%"></i></span><span class="body"></span>' +
        '<span class="state">봉인</span></button></li>';
    }).join('');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var li = b.parentNode, i = [].indexOf.call(box.children, li), open = li.classList.toggle('is-open');
      b.setAttribute('aria-expanded', open);
      b.querySelector('.state').textContent = open ? '해독' : '봉인';
      if (open) RSC.scramble(b.querySelector('.body'), D.clues[i].text || '기록 없음 — 해독할 내용이 아직 등록되지 않았습니다.', 1600);
    });
    RSC.observe(box);
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
  var EN = { home: 'Home', character: 'Character', nation: 'Nation', map: 'Map', game: 'Game', clue: 'Clue', novel: 'Novel', notice: 'Notice', gallery: 'Gallery', end: 'End' };

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
    if (!deck || i === cur && !instant || busy && !instant) return;
    var prev = secs[cur], next = secs[i];
    secs.forEach(function (s) { s.classList.remove('is-cur', 'is-out'); s.setAttribute('aria-hidden', 'true'); s.inert = true; });
    if (!instant && prev !== next) { prev.classList.add('is-out'); setTimeout(function () { prev.classList.remove('is-out'); }, 1400); }
    next.classList.add('is-cur'); next.removeAttribute('aria-hidden'); next.inert = false; next.scrollTop = 0;
    root.style.setProperty('--dir', i >= cur ? 1 : -1);
    cur = i; replay(next); mark();
    if (!instant) {
      var line = hud.querySelector('.deckline'); line.classList.remove('is-run'); void line.offsetWidth; line.classList.add('is-run');
      busy = true; setTimeout(function () { busy = false; }, 1200);
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
    var s = secs[cur];
    return dy > 0 ? s.scrollTop + s.clientHeight < s.scrollHeight - 2 : s.scrollTop > 2;
  }
  function overlayOpen() { return !!document.querySelector('.rpanel.is-open'); }

  addEventListener('wheel', function (e) {
    if (!deck || e.ctrlKey || overlayOpen() || Math.abs(e.deltaX) > Math.abs(e.deltaY) || !e.deltaY) return;
    if (canScrollInside(e.deltaY)) return;            /* 구역 안 스크롤이 먼저 */
    e.preventDefault();
    if (!busy) goTo(cur + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });
  addEventListener('keydown', function (e) {
    if (!deck || overlayOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable], .mapview')) return;
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
