/* RASYANCUT — 메인 화면 동작 */
(function () {
  'use strict';
  var D = window.RSC_DATA, RSC = window.RSC, esc = RSC.esc, reduce = RSC.reduce;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var small = matchMedia('(max-width: 900px)');
  var EMBLEM = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3l17 17-17 17L3 20z"/><path d="M20 12l8 8-8 8-8-8z"/></svg>';

  /* 화면에 보일 때만 그리는 루프 */
  function loop(el, draw) {
    var on = false, raf = 0;
    function tick(t) { if (!on) return; draw(t); raf = requestAnimationFrame(tick); }
    new IntersectionObserver(function (es) {
      on = es[0].isIntersecting && !document.hidden;
      cancelAnimationFrame(raf);
      if (on) raf = requestAnimationFrame(tick);
    }).observe(el);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { on = false; cancelAnimationFrame(raf); } });
  }
  function fit(cv) {
    var dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c: c, w: r.width, h: r.height };
  }

  /* ── 01 HOME ── */
  var SECS = [['character', '캐릭터'], ['nation', '국가 소개'], ['map', '지도'], ['game', '게임'], ['clue', '떡밥'], ['novel', '소설'], ['notice', '공지'], ['gallery', '갤러리']];
  $('[data-quick]').innerHTML = SECS.map(function (s, i) {
    return '<li><a href="#' + s[0] + '"><b>' + String(i + 2).padStart(2, '0') + '</b>' + s[1] + '</a></li>';
  }).join('');

  var clock = $('[data-clock]');
  function tickClock() { clock.textContent = new Date().toTimeString().slice(0, 8); }
  tickClock(); setInterval(tickClock, 1000);

  (function homeFx() {
    var cv = $('.home__fx'), g = fit(cv), dust = [], mx = 0, my = 0;
    function seed() {
      g = fit(cv); dust = [];
      var n = small.matches ? 36 : 80;
      for (var i = 0; i < n; i++) dust.push({ x: Math.random(), y: Math.random(), s: .4 + Math.random() * 1.6, v: .008 + Math.random() * .03, p: Math.random() * 6.28 });
    }
    seed(); addEventListener('resize', seed);
    addEventListener('pointermove', function (e) { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
    function ring(c, r, a) { c.globalAlpha = a; c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.stroke(); }
    function draw(t) {
      var c = g.c, w = g.w, h = g.h, s = t / 1000;
      c.clearRect(0, 0, w, h);
      var cx = (small.matches ? .5 : .7) * w + mx * -18, cy = (small.matches ? .34 : .44) * h + my * -18;
      var R = Math.min(w, h) * (small.matches ? .4 : .42);
      c.save(); c.translate(cx, cy); c.strokeStyle = '#d4a73a'; c.lineWidth = 1;
      ring(c, R, .5); ring(c, R * .93, .18); ring(c, R * .62, .35); ring(c, R * .2, .6);
      c.save(); c.rotate(s * .03);                       /* 12분할 방사선과 눈금 */
      for (var i = 0; i < 72; i++) {
        var major = i % 6 === 0;
        c.globalAlpha = major ? .55 : .22; c.beginPath();
        c.moveTo(0, -R * (major ? .62 : .96)); c.lineTo(0, -R * (major ? 1.06 : 1)); c.stroke(); c.rotate(6.2832 / 72);
      }
      c.restore();
      for (var k = 0; k < 2; k++) {                      /* 맞물려 도는 두 마름모 */
        c.save(); c.rotate((k ? -1 : 1) * s * .05 + k * .7854); c.globalAlpha = k ? .28 : .6;
        var q = R * (k ? .62 : .8); c.strokeRect(-q / 1.4142, -q / 1.4142, q * 1.4142, q * 1.4142); c.restore();
      }
      c.save(); c.rotate(-s * .12); c.globalAlpha = .9; c.strokeStyle = '#f2d27a'; c.lineWidth = 3;   /* 떠도는 호 */
      c.beginPath(); c.arc(0, 0, R * 1.12, 0, .9); c.stroke(); c.beginPath(); c.arc(0, 0, R * 1.12, 3.14, 3.6); c.stroke(); c.restore();
      c.restore();
      c.globalCompositeOperation = 'lighter';            /* 금가루 */
      for (var j = 0; j < dust.length; j++) {
        var d = dust[j]; d.y -= d.v * .016; if (d.y < -.02) { d.y = 1.02; d.x = Math.random(); }
        var x = (d.x + Math.sin(s * .4 + d.p) * .012) * w, y = d.y * h;
        c.globalAlpha = .25 + .55 * Math.abs(Math.sin(s * .8 + d.p)); c.fillStyle = d.s > 1.5 ? '#fff3c4' : '#d4a73a';
        c.fillRect(x, y, d.s, d.s);
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
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
    var cur = new Float32Array(N * 3), tgt = new Float32Array(N * 3), idx = 0, rotY = .6, rotX = -.28, vel = .004, drag = null;
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
    addEventListener('resize', function () { g = fit(cv); });

    cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      rotY += dx * .008; rotX = Math.max(-1.1, Math.min(1.1, rotX + dy * .006)); vel = dx * .0012;
    });
    function up() { drag = null; }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

    function draw() {
      var c = g.c, w = g.w, h = g.h;
      c.clearRect(0, 0, w, h);
      if (!drag) { rotY += vel; vel += (.004 - vel) * .02; }
      var cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
      var S = Math.min(w, h) * .36, ox = w / 2, oy = h / 2;
      c.globalCompositeOperation = 'lighter';
      for (var i = 0; i < N; i++) {
        var j = i * 3;
        cur[j] += (tgt[j] - cur[j]) * .028; cur[j + 1] += (tgt[j + 1] - cur[j + 1]) * .028; cur[j + 2] += (tgt[j + 2] - cur[j + 2]) * .028;
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
    if (reduce) { cur.set(tgt); draw(); } else loop(cv, draw);

    var panel = $('.npanel'), ticks = $('[data-n-ticks]');
    ticks.innerHTML = D.nations.map(function () { return '<li></li>'; }).join('');
    $('[data-n-prev]').innerHTML = RSC.chev(-1); $('[data-n-next]').innerHTML = RSC.chev(1);
    function show(i, quiet) {
      idx = (i + D.nations.length) % D.nations.length;
      var n = D.nations[idx];
      shape(n.shape); if (reduce) { cur.set(tgt); draw(); }
      RSC.scramble($('[data-n-code]'), n.code, 800);
      $('[data-n-en]').textContent = n.nameEn;
      $('[data-n-name]').textContent = n.name;
      $('[data-n-count]').textContent = (idx + 1) + ' / ' + D.nations.length;
      $('[data-n-desc]').textContent = n.desc || '이 국가의 기록은 아직 등록되지 않았습니다.';
      [].forEach.call(ticks.children, function (li, k) { li.classList.toggle('is-on', k === idx); });
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
      var b = { x: r.width / 2 - wx * z, y: r.height / 2 - wy * z, z: z }, t0 = performance.now(), dur = reduce ? 1 : 1600;
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

  /* ── 05 GAME ── */
  (function () {
    var list = $('[data-glist]');
    list.innerHTML = D.games.map(function (gm, i) {
      return '<li><button data-game="' + i + '"><b>' + gm.id + '</b><strong>' + esc(gm.name) + '</strong><span class="mono">' + esc(gm.genre) + '</span><span class="mono">' + esc(gm.platform) + '</span><em>' + esc(gm.status) + '</em></button></li>';
    }).join('');
    function show(i) {
      var gm = D.games[i], dl = $('[data-g-dl]');
      list.querySelectorAll('button').forEach(function (b, k) { b.classList.toggle('is-on', k === i); });
      RSC.scramble($('[data-g-code]'), gm.code, 800);
      RSC.scramble($('[data-g-name]'), gm.name, 900);
      $('[data-g-meta]').textContent = '장르 ' + gm.genre + ' · 플랫폼 ' + gm.platform;
      if (gm.url) { dl.href = gm.url; dl.classList.remove('is-off'); dl.removeAttribute('aria-disabled'); dl.textContent = '다운로드'; }
      else { dl.removeAttribute('href'); dl.classList.add('is-off'); dl.setAttribute('aria-disabled', 'true'); dl.textContent = '다운로드 준비 중'; }
    }
    list.addEventListener('click', function (e) { var b = e.target.closest('[data-game]'); if (b) show(+b.dataset.game); });
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

  /* ── 08 NOTICE ── */
  (function () {
    var box = $('[data-notices]');
    box.innerHTML = D.notices.map(function (n, i) {
      return '<li' + (i ? '' : ' class="is-open"') + '><button aria-expanded="' + !i + '"><span class="mono">// ' + esc(n.tag) + '</span><span class="mono gold">' + n.date + '</span><strong>' + esc(n.title) + '</strong><i></i></button>' +
        '<div class="nbody"><ul>' + n.body.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div></li>';
    }).join('');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      b.setAttribute('aria-expanded', b.parentNode.classList.toggle('is-open'));
    });
  })();

  /* ── 09 GALLERY ── */
  $('[data-galrow]').innerHTML = D.gallery.map(function (a) {
    return '<li style="aspect-ratio:' + a.ratio + '"><a href="gallery.html#a=' + a.id + '" aria-label="작품 ' + a.id + '"><div class="slot"><span>' + a.code + '<br>EMPTY</span></div></a></li>';
  }).join('');

  RSC.observe();

  /* 현재 구역 추적: 레일 표시 + 주소 해시 */
  var spy = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting) return;
      RSC.setNav(en.target.id);
      if (location.hash !== '#' + en.target.id) history.replaceState(null, '', '#' + en.target.id);
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  setTimeout(function () { document.querySelectorAll('.sec[id]').forEach(function (s) { spy.observe(s); }); }, 600);
})();
