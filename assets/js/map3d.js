/* RASYANCUT — 3D 측량 지도
   지도 그림의 등고선(고도)과 국경(영토)을 육각 기둥으로 세운다.
   흑요석 기둥 + 금박 테두리, 선택한 나라만 그 나라 색으로 솟아오른다.
   home.js 가 필요할 때(3D 스위치를 처음 켰을 때)만 불러온다. */
import * as THREE from './vendor/three.module.min.js';
import DATA from './map3d-data.js?v=2.13.0';

var U = 1 / 40;                                  /* 지도 1px → 3D 단위 */
var BASE = -0.4;                                 /* 바다 면 높이 */

function hexHeight(lv) { return lv > 0 ? 0.25 + lv * 0.46 : (lv === -1 ? 0.16 : 0.09); }

export function create(host, opt) {
  opt = opt || {};
  var reduce = !!opt.reduce;
  var names = DATA.names, R = DATA.R, w = Math.sqrt(3) * R, dy = 1.5 * R, C0 = DATA.c0 || 0, R0 = DATA.r0 || 0;
  var cx0 = DATA.w / 2, cz0 = DATA.h / 2;

  /* ── 렌더러 ── */
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  var pr = Math.min(devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x050505, 1);
  renderer.domElement.className = 'm3d__cv';
  host.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);

  /* ── 타일 데이터 → 인스턴스 ── */
  var t = DATA.t, n = t.length / 4;
  var geo = new THREE.CylinderGeometry(R * U * 0.93, R * U * 0.93, 1, 6, 1);
  geo.translate(0, 0.5, 0);                      /* 바닥이 0, 윗면이 1 */
  var aData = new Float32Array(n * 4);
  var m4 = new THREE.Matrix4(), owners = [], maxD = 1;
  for (var i0 = 0; i0 < n; i0++) { var c1 = t[i0 * 4], r1 = t[i0 * 4 + 1]; maxD = Math.max(maxD, Math.hypot((c1 - C0) * w + (r1 % 2) * w / 2 - cx0, (r1 - R0) * dy - cz0)); }
  var cent = names.map(function () { return { x: 0, z: 0, y: 0, k: 0, x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }; });
  var mesh = new THREE.InstancedMesh(geo, null, n);
  for (var i = 0; i < n; i++) {
    var c = t[i * 4], r = t[i * 4 + 1], lv = t[i * 4 + 2], ow = t[i * 4 + 3];
    var px = (c - C0) * w + (r % 2) * w / 2, pz = (r - R0) * dy;
    var x = (px - cx0) * U, z = (pz - cz0) * U, h = hexHeight(lv);
    var base = lv > 0 ? BASE : BASE - 0.02 + (lv === -1 ? 0 : -0.04);
    m4.makeScale(1, h, 1).setPosition(x, base, z);
    mesh.setMatrixAt(i, m4);
    aData[i * 4] = lv; aData[i * 4 + 1] = ow;
    aData[i * 4 + 2] = Math.hypot(px - cx0, pz - cz0) / maxD;   /* 등장 순서: 가운데부터 */
    aData[i * 4 + 3] = (c * 7 + r * 13) % 17 / 17;               /* 기둥마다 미세한 차이 */
    owners.push(ow);
    if (ow >= 0) { var q = cent[ow]; q.x += x; q.z += z; q.y = Math.max(q.y, base + h); q.k++; q.x0 = Math.min(q.x0, x); q.x1 = Math.max(q.x1, x); q.z0 = Math.min(q.z0, z); q.z1 = Math.max(q.z1, z); }
  }
  cent.forEach(function (q) { if (q.k) { q.x /= q.k; q.z /= q.k; } });
  geo.setAttribute('aData', new THREE.InstancedBufferAttribute(aData, 4));

  var uni = {
    uTime: { value: 0 }, uIntro: { value: reduce ? 1 : 0 },
    uSel: { value: -1 }, uHover: { value: -1 }, uRise: { value: 0 },
    uSelColor: { value: new THREE.Color('#f2d27a') },
    uPing: { value: new THREE.Vector3(0, 0, -1) },          /* x, z, 시작 시각 */
    uFogNear: { value: 40 }, uFogFar: { value: 120 }
  };
  var tileMat = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: [
      'attribute vec4 aData;',
      'uniform float uIntro, uSel, uRise;',
      'varying vec3 vLocal; varying vec3 vNormal2; varying vec4 vData; varying vec3 vWorld; varying float vSel;',
      'void main(){',
      '  vData = aData; vLocal = position; vNormal2 = normal;',
      '  float sel = (uSel > -0.5 && abs(aData.y - uSel) < 0.5) ? 1.0 : 0.0; vSel = sel;',
      '  float k = clamp((uIntro * 1.6 - aData.z) / 0.6, 0.0, 1.0); k = 1.0 - pow(1.0 - k, 3.0);',
      '  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);',
      '  float h = instanceMatrix[1][1];',
      '  wp.y = mix(wp.y - h - 0.6, wp.y, k) + sel * uRise * 0.32;',
      '  vWorld = wp.xyz;',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime, uSel, uHover, uFogNear, uFogFar, uRise;',
      'uniform vec3 uSelColor, uPing;',
      'varying vec3 vLocal; varying vec3 vNormal2; varying vec4 vData; varying vec3 vWorld; varying float vSel;',
      'const vec3 OBS = vec3(0.055, 0.047, 0.035);',
      'const vec3 GOLD = vec3(0.949, 0.824, 0.478);',
      'const vec3 GOLD_D = vec3(0.561, 0.416, 0.110);',
      'vec3 lvColor(float lv){',
      '  if (lv < 0.5) return vec3(0.022, 0.022, 0.024);',
      '  vec3 a = vec3(0.15, 0.122, 0.082), b = vec3(0.43, 0.32, 0.135), c = vec3(0.93, 0.75, 0.32);',
      '  float t = (lv - 1.0) / 4.0;',
      '  return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);',
      '}',
      'void main(){',
      '  float lv = vData.x, own = vData.y;',
      '  bool top = vNormal2.y > 0.5;',
      '  vec2 p = vLocal.xz / ' + (R * U * 0.93).toFixed(5) + ';',
      '  float e = 0.866 - max(abs(p.x), max(abs(dot(p, vec2(0.5, 0.866))), abs(dot(p, vec2(-0.5, 0.866)))));',
      '  float hov = (uHover > -0.5 && abs(own - uHover) < 0.5) ? 1.0 : 0.0;',
      '  vec3 col;',
      '  vec3 L = normalize(vec3(-0.45, 1.0, 0.35));',
      '  if (top) {',
      '    if (own < -1.5) {',
      '      float scan = step(0.82, fract(vWorld.z * 2.6 + uTime * 0.18));',
      '      vec3 c2 = vec3(0.03, 0.026, 0.02) + GOLD * (0.05 * scan + 0.025 * lv);',
      '      float r2 = smoothstep(0.07, 0.0, e) * (0.3 + 0.12 * sin(uTime * 1.3 + vData.w * 6.2832));',
      '      gl_FragColor = vec4(mix(c2, GOLD * 0.8, r2), 1.0);',
      '      float d2 = length(vWorld - cameraPosition);',
      '      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.02, 0.018, 0.014), smoothstep(uFogNear, uFogFar, d2));',
      '      return;',
      '    }',
      '    col = lvColor(lv) * (0.93 + vData.w * 0.14);',
      '    if (own < -0.5 && lv > 0.5) col *= 0.62;',
      '    col += hov * 0.06 * GOLD;',
      '    col = mix(col, uSelColor * (0.42 + 0.1 * lv) * (0.93 + vData.w * 0.14), vSel * 0.62 * uRise);',
      '    float rim = smoothstep(0.05, 0.0, e);',
      '    float rimA = lv > 0.5 ? 0.1 + lv * 0.07 : 0.07;',
      '    rimA += hov * 0.25 + vSel * 0.45 * uRise;',
      /* 측량 스윕: 금빛 띠가 지도를 천천히 훑고 지나간다 */
      '    float sweep = fract(uTime * 0.07) * 90.0 - 45.0;',
      '    float band = smoothstep(2.2, 0.0, abs(vWorld.x + vWorld.z * 0.35 - sweep));',
      '    rimA += band * (lv > 0.5 ? 0.9 : 0.35);',
      '    col += band * 0.05 * GOLD * step(0.5, lv);',
      /* 선택 파동: 고른 나라에서 퍼지는 고리 */
      '    if (uPing.z >= 0.0) {',
      '      float age = uTime - uPing.z, rr = age * 9.0;',
      '      float ring = smoothstep(1.2, 0.0, abs(distance(vWorld.xz, uPing.xy) - rr)) * smoothstep(5.0, 0.0, age);',
      '      rimA += ring * 1.2; col += ring * 0.08 * uSelColor;',
      '    }',
      '    col = mix(col, mix(GOLD, uSelColor, vSel * uRise * 0.7), rim * clamp(rimA, 0.0, 1.0));',
      '  } else {',
      '    float yy = clamp(vLocal.y, 0.0, 1.0);',
      '    if (own < -1.5) { col = vec3(0.012) + GOLD_D * smoothstep(0.88, 1.0, yy) * 0.3; float d3 = length(vWorld - cameraPosition); gl_FragColor = vec4(mix(col, vec3(0.02, 0.018, 0.014), smoothstep(uFogNear, uFogFar, d3)), 1.0); return; }',
      '    float diff = max(dot(normalize(vNormal2), L), 0.0);',
      '    col = (OBS + lvColor(max(lv, 1.0)) * 0.18) * (0.35 + 0.9 * diff) * (0.4 + 0.6 * yy);',
      '    col += GOLD_D * smoothstep(0.9, 1.0, yy) * (lv > 0.5 ? 0.35 : 0.08);',   /* 윗모서리 금박 */
      '    col = mix(col, uSelColor * 0.22 * (0.4 + yy), vSel * uRise);',
      '  }',
      '  float d = length(vWorld - cameraPosition);',
      '  col = mix(col, vec3(0.02, 0.018, 0.014), smoothstep(uFogNear, uFogFar, d));',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  });
  mesh.material = tileMat;
  mesh.frustumCulled = false;
  scene.add(mesh);

  /* ── 바다: 검은 수면 + 희미한 육각 격자 + 회전하는 측량 원 ── */
  var seaMat = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: [
      'uniform float uTime, uFogNear, uFogFar; uniform vec3 uPing, uSelColor;',
      'const float FW = ' + (DATA.w / 2 * U).toFixed(3) + ', FH = ' + (DATA.h / 2 * U).toFixed(3) + ';',
      'varying vec3 vW;',
      'const vec3 GOLD = vec3(0.949, 0.824, 0.478);',
      'float hexLine(vec2 p, float s){',
      '  p /= s; vec2 r = vec2(1.0, 1.732); vec2 h = r * 0.5;',
      '  vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;',
      '  vec2 g = dot(a, a) < dot(b, b) ? a : b; g = abs(g);',
      '  float d = max(dot(g, normalize(r)), g.x);',
      '  return smoothstep(0.47, 0.5, d);',
      '}',
      'void main(){',
      '  vec2 p = vW.xz; float r = length(p);',
      '  vec3 col = vec3(0.012, 0.011, 0.01);',
      '  col += GOLD * hexLine(p, 1.6) * 0.035 * smoothstep(40.0, 8.0, r);',
      /* 측량 원: 두 겹 고리 + 돌아가는 눈금 */
      '  float a = atan(p.y, p.x);',
      '  float ring1 = smoothstep(0.06, 0.0, abs(r - 40.0));',
      '  float ring2 = smoothstep(0.04, 0.0, abs(r - 41.4));',
      '  float fd = max(abs(p.x) - FW, abs(p.y) - FH);',
      '  float frame = smoothstep(0.07, 0.0, abs(fd)) * step(0.45, fract((p.x + p.y) * 0.9));',
      '  float corner = smoothstep(0.09, 0.0, abs(fd)) * step(FW - 2.2, abs(p.x)) * step(FH - 2.2, abs(p.y));',
      '  col += GOLD * (frame * 0.32 + corner * 0.7);',
      '  float ticks = smoothstep(0.03, 0.0, abs(fract((a + uTime * 0.02) * 72.0 / 6.2832) - 0.5) - 0.47) * step(abs(r - 40.7), 0.5);',
      '  float big = smoothstep(0.01, 0.0, abs(fract((a - uTime * 0.012) * 12.0 / 6.2832) - 0.5) - 0.495) * step(abs(r - 42.4), 1.1);',
      '  col += GOLD * (ring1 * 0.3 + ring2 * 0.15 + ticks * 0.05);',
      '  if (uPing.z >= 0.0) {',
      '    float age = uTime - uPing.z;',
      '    float ring = smoothstep(0.35, 0.0, abs(distance(p, uPing.xy) - age * 9.0)) * smoothstep(5.0, 0.0, age);',
      '    col += uSelColor * ring * 0.25;',
      '  }',
      '  float d = length(vW - cameraPosition);',
      '  col = mix(col, vec3(0.02, 0.018, 0.014), smoothstep(uFogNear, uFogFar, d) * 0.8);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  });
  var sea = new THREE.Mesh(new THREE.PlaneGeometry(150, 110).rotateX(-Math.PI / 2), seaMat);
  sea.position.y = BASE - 0.06;
  scene.add(sea);

  /* ── 떠오르는 금빛 먼지 ── */
  var NP = reduce ? 0 : 320, pp = new Float32Array(NP * 3);
  for (var j = 0; j < NP; j++) { pp[j * 3] = (Math.random() - .5) * 72; pp[j * 3 + 1] = Math.random() * 6; pp[j * 3 + 2] = (Math.random() - .5) * 46; }
  var pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  var pmat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'uniform float uTime; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y + uTime * 0.12, 6.0) - 0.3; vA = sin(p.y / 6.0 * 3.1416); vec4 mv = modelViewMatrix * vec4(p,1.0); gl_PointSize = 70.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.95, 0.82, 0.48, smoothstep(0.5, 0.0, d) * vA * 0.5); }'
  });
  if (NP) scene.add(new THREE.Points(pgeo, pmat));

  /* ── 범례 · 나침반 ── */
  var hud = document.createElement('div'); hud.className = 'm3d__hud';
  hud.innerHTML = '<div class="m3d__compass" aria-hidden="true"><i></i><b class="mono">N</b></div>' +
    '<div class="m3d__legend"><p class="mono">Elevation</p><ol>' + [1, 2, 3, 4, 5].map(function (k) { return '<li style="--k:' + k + '"></li>'; }).join('') + '</ol>' +
    '<p class="mono m3d__scale"><span>01</span><span>05</span></p><p class="m3d__unk"><i aria-hidden="true"></i><span>미측량 지역 · 추정 지형</span></p>' +
    '<p class="m3d__unk m3d__unk--line"><i aria-hidden="true"></i><span>측량 한계선 (원본 지도)</span></p></div>';
  host.appendChild(hud);
  var needle = hud.querySelector('.m3d__compass');

  /* ── 이름표 (HTML) ── */
  var labWrap = document.createElement('div'); labWrap.className = 'm3d__labs'; host.appendChild(labWrap);
  var labs = names.map(function (nm, k) {
    if (!cent[k].k) return null;
    var info = opt.info ? opt.info(k) : {};
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'm3lab' + (info.kind && info.kind !== 'nation' ? ' is-dim' : '') + (info.dos ? ' has-dos' : '');
    b.innerHTML = '<span class="mono">' + (info.code || '') + '</span><b></b>';
    b.querySelector('b').textContent = nm;
    b.addEventListener('click', function (ev) { ev.stopPropagation(); if (opt.onPick) opt.onPick(k); });
    labWrap.appendChild(b);
    return b;
  });

  /* 이름표 우선순위: 선택 > 기록 있음 > 나라 > 그 밖 */
  var labW = [], order = [];
  labs.forEach(function (b, k) { if (b) order.push(k); });
  function rank(k) { var b = labs[k]; return (k === uni.uSel.value ? 0 : 10) + (b.classList.contains('has-dos') ? 0 : 3) + (b.classList.contains('is-dim') ? 2 : 0); }
  function measure() { labs.forEach(function (b, k) { if (b) labW[k] = b.offsetWidth || 120; }); }
  requestAnimationFrame(measure);

  /* ── 카메라 조작 (직접 구현: 끌어서 회전, 오른쪽/Shift 끌기 이동, Ctrl+휠·핀치 확대) ── */
  var cam = { tx: 0, tz: 1, dist: 66, az: 0, el: 0.95 }, goal = null, W = 1, H = 1;
  var HOME = { tx: 0, tz: 1, dist: 66, az: 0, el: 0.95 };
  var DMIN = 12, DMAX = 90;
  function place() {
    var ce = Math.cos(cam.el), se = Math.sin(cam.el);
    camera.position.set(cam.tx + Math.sin(cam.az) * ce * cam.dist, BASE + se * cam.dist, cam.tz + Math.cos(cam.az) * ce * cam.dist);
    camera.lookAt(cam.tx, BASE + 0.4, cam.tz);
  }
  function clampCam() {
    cam.dist = Math.max(DMIN, Math.min(DMAX, cam.dist));
    cam.el = Math.max(0.42, Math.min(1.45, cam.el));
    cam.tx = Math.max(-34, Math.min(34, cam.tx)); cam.tz = Math.max(-22, Math.min(22, cam.tz));
  }
  function flyTo(g, dur) { goal = { from: Object.assign({}, cam), to: g, t0: performance.now(), dur: reduce ? 1 : (dur || 1300) }; }

  var ptr = new Map(), drag = null, moved = 0, pinch = 0;
  var el = renderer.domElement;
  el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  el.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0; goal = null;
    drag = { pan: e.button === 2 || e.shiftKey };
    if (ptr.size === 2) { var a = Array.from(ptr.values()); pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
    host.classList.add('is-drag');
  });
  el.addEventListener('pointermove', function (e) {
    var p = ptr.get(e.pointerId);
    if (!p) { hoverAt(e.clientX, e.clientY); return; }
    var dx = e.clientX - p.x, dy2 = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy2);
    p.x = e.clientX; p.y = e.clientY;
    if (ptr.size === 2) {
      var a = Array.from(ptr.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      if (pinch) cam.dist *= pinch / d;
      pinch = d;
      /* 두 손가락을 함께 움직이면 이동 */
      panBy(dx / 2, dy2 / 2);
    } else if (drag && drag.pan) panBy(dx, dy2);
    else { cam.az -= dx * 0.005; cam.el += dy2 * 0.004; }
    clampCam();
  });
  function panBy(dx, dy3) {
    var s = 2 * cam.dist * Math.tan(16 * Math.PI / 180) / H, ca = Math.cos(cam.az), sa = Math.sin(cam.az);
    cam.tx -= (dx * ca + dy3 * sa / Math.max(.4, Math.sin(cam.el))) * s;
    cam.tz -= (-dx * sa + dy3 * ca / Math.max(.4, Math.sin(cam.el))) * s;
  }
  function up(e) {
    var wasClick = ptr.size === 1 && moved < 6;
    ptr.delete(e.pointerId); pinch = 0;
    if (!ptr.size) { host.classList.remove('is-drag'); drag = null; }
    if (wasClick && e.type === 'pointerup') { var o = pick(e.clientX, e.clientY); if (o >= 0 && opt.onPick) opt.onPick(o); }
  }
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', function () { if (!ptr.size) setHover(-1); });
  el.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;          /* 화면 넘김(휠)은 그대로 둔다 */
    e.preventDefault(); goal = null;
    cam.dist *= Math.exp(e.deltaY * 0.0022); clampCam();
  }, { passive: false });

  host.addEventListener('keydown', function (e) {
    var k = { ArrowLeft: [-.18, 0], ArrowRight: [.18, 0], ArrowUp: [0, .08], ArrowDown: [0, -.08] }[e.key];
    if (k) { e.preventDefault(); goal = null; cam.az += k[0]; cam.el += k[1]; clampCam(); return; }
    if (e.key === '+' || e.key === '=') zoom(1);
    if (e.key === '-') zoom(-1);
  });
  el.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); if (opt.onLost) opt.onLost(); });

  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(x, y) {
    var r = el.getBoundingClientRect();
    ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hit = ray.intersectObject(mesh, false)[0];
    return hit && hit.instanceId != null ? owners[hit.instanceId] : -1;
  }
  var hoverQ = null;
  function hoverAt(x, y) { hoverQ = [x, y]; }
  function setHover(o) {
    if (uni.uHover.value === o) return;
    uni.uHover.value = o; host.classList.toggle('is-point', o >= 0);
    labs.forEach(function (b, k) { if (b) b.classList.toggle('is-hover', k === o); });
  }

  /* ── 선택 ── */
  var selT0 = 0, selFrom = 0;
  function select(k, color) {
    if (k == null) k = -1;
    labs.forEach(function (b, i) { if (b) b.classList.toggle('is-on', i === k); });
    if (k < 0 || !cent[k] || !cent[k].k) { uni.uSel.value = -1; uni.uRise.value = 0; return false; }
    uni.uSel.value = k; uni.uRise.value = reduce ? 1 : 0; uni.uSelColor.value.set(color || '#f3f1ec');
    selFrom = 0; selT0 = performance.now();
    uni.uPing.value.set(cent[k].x, cent[k].z, uni.uTime.value);
    return true;
  }
  function focus(k, offsetPx) {
    if (k == null || k < 0 || !cent[k] || !cent[k].k) return;
    /* 오른쪽 기록 창만큼 화면 가운데를 왼쪽으로 비킨다 */
    /* 영토 크기에 맞춰 거리를 잡는다 (보이는 폭의 약 60%를 차지하게) */
    var q = cent[k], span = Math.max(q.x1 - q.x0, (q.z1 - q.z0) * 1.4, 4);
    var visW = Math.max(.3, (W - 2 * (offsetPx || 0)) / W);
    var fit = span / (2 * Math.tan(16 * Math.PI / 180) * camera.aspect * visW) / 0.6;
    var g = { tx: q.x, tz: q.z, dist: Math.max(DMIN, Math.min(HOME.dist, fit)), az: cam.az, el: 0.82 };
    if (offsetPx) {
      var s = offsetPx * 2 * g.dist * Math.tan(16 * Math.PI / 180) / H;
      g.tx += Math.cos(g.az) * s; g.tz -= Math.sin(g.az) * s;
    }
    flyTo(g);
  }
  function clear() { select(null); hideTitle(); }
  function reset() { clear(); flyTo(Object.assign({}, HOME)); }
  function zoom(d) { goal = null; flyTo(Object.assign({}, cam, { dist: Math.max(DMIN, Math.min(DMAX, cam.dist * (d > 0 ? 1 / 1.5 : 1.5))) }), 600); }

  /* ── 3D 현판: 고른 나라의 이름이 금빛 광선 위로 아래에서부터 스캔되며 떠오른다 ── */
  var PW = 6.6, PH = PW * 400 / 1024;
  var plaqueMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: null }, uReveal: { value: 0 }, uTime: uni.uTime, uColor: { value: new THREE.Color('#f2d27a') } },
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D uMap; uniform float uReveal, uTime; uniform vec3 uColor; varying vec2 vUv;',
      'void main(){',
      '  vec4 c = texture2D(uMap, vUv);',
      '  float edge = uReveal * 1.1 - 0.05;',
      '  float shown = step(vUv.y, edge);',
      '  float line = smoothstep(0.025, 0.0, abs(vUv.y - edge)) * (1.0 - step(0.999, uReveal));',
      '  float flick = 0.94 + 0.06 * sin(uTime * 6.0 + vUv.y * 60.0);',
      '  vec3 col = c.rgb * flick + vec3(1.0, 0.88, 0.55) * line;',
      '  gl_FragColor = vec4(col, max(c.a * shown, line * 0.95));',
      '}'
    ].join('\n')
  });
  var plaque = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), plaqueMat);
  plaque.renderOrder = 20; plaque.visible = false; scene.add(plaque);
  var beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uni.uTime, uA: { value: 0 }, uColor: plaqueMat.uniforms.uColor },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uTime, uA; uniform vec3 uColor; varying vec2 vUv; void main(){ float x = abs(vUv.x - 0.5) * 2.0; float core = pow(1.0 - x, 3.0); float breathe = 0.85 + 0.15 * sin(uTime * 1.6); vec3 c = vec3(0.95, 0.82, 0.48); gl_FragColor = vec4(c * core * breathe * uA * (0.35 + 0.65 * vUv.y), 1.0); }'
  });
  var beam = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1), beamMat);
  beam.renderOrder = 19; beam.visible = false; scene.add(beam);
  var cta = document.createElement('button');
  cta.type = 'button'; cta.className = 'm3d__cta'; cta.hidden = true;
  cta.innerHTML = '<span class="mono" data-cta-k></span><b>세부정보 보기</b><i aria-hidden="true"></i>';
  host.appendChild(cta);
  var plq = { k: -1, t0: 0, out: false, outT0: 0, lift: 0, liftTo: 0, info: null };
  cta.addEventListener('click', function (e) { e.stopPropagation(); if (plq.k >= 0 && opt.onDetail) opt.onDetail(plq.k); });
  cta.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

  var MONO = '"Barlow Condensed", ui-monospace, monospace', SERIF = '"Noto Serif KR", serif';
  function drawPlaque(info) {
    var cv = document.createElement('canvas'), w2 = 1024, h2 = 400; cv.width = w2; cv.height = h2;
    var g = cv.getContext('2d');
    var bg = g.createLinearGradient(0, 0, 0, h2); bg.addColorStop(0, 'rgba(23,20,15,.94)'); bg.addColorStop(1, 'rgba(5,5,5,.9)');
    g.fillStyle = bg; g.fillRect(0, 0, w2, h2);
    g.strokeStyle = 'rgba(212,167,58,.5)'; g.lineWidth = 2; g.strokeRect(16, 16, w2 - 32, h2 - 32);
    g.strokeStyle = '#f2d27a'; g.lineWidth = 5;                       /* 모서리 꺾쇠 */
    [[16, 16, 1, 1], [w2 - 16, 16, -1, 1], [16, h2 - 16, 1, -1], [w2 - 16, h2 - 16, -1, -1]].forEach(function (c) {
      g.beginPath(); g.moveTo(c[0] + c[2] * 46, c[1]); g.lineTo(c[0], c[1]); g.lineTo(c[0], c[1] + c[3] * 46); g.stroke();
    });
    g.fillStyle = info.color || '#f2d27a'; g.fillRect(16, 16, 10, h2 - 32);  /* 국가색 띠 */
    g.textBaseline = 'alphabetic';
    g.font = '600 32px ' + MONO; g.fillStyle = '#d4a73a';
    if ('letterSpacing' in g) g.letterSpacing = '6px';
    g.fillText((info.code || '') + '   /   ' + (info.status || ''), 62, 84);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    var size = 156; g.font = '900 ' + size + 'px ' + SERIF;
    while (g.measureText(info.name).width > w2 - 124 && size > 64) { size -= 6; g.font = '900 ' + size + 'px ' + SERIF; }
    var gy = 112 + size * .86, gr = g.createLinearGradient(0, gy - size, 0, gy);
    gr.addColorStop(0, '#fff3c4'); gr.addColorStop(1, '#e2b85a');
    g.fillStyle = gr; g.fillText(info.name, 58, gy);
    g.fillStyle = info.color || '#f2d27a'; g.fillRect(62, gy + 30, 96, 6);
    g.font = '500 34px ' + MONO; g.fillStyle = '#c2b69a';
    if ('letterSpacing' in g) g.letterSpacing = '12px';
    g.fillText(info.en || 'UNREGISTERED', 182, gy + 40);
    var tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    return tex;
  }
  function setPlaqueTex(info) {
    var old = plaqueMat.uniforms.uMap.value;
    plaqueMat.uniforms.uMap.value = drawPlaque(info);
    if (old) old.dispose();
  }
  function title(k, info) {
    if (k == null || k < 0 || !cent[k] || !cent[k].k || !info) { hideTitle(); return; }
    var same = plq.k === k && !plq.out;
    plq.k = k; plq.info = info; plq.out = false;
    plaqueMat.uniforms.uColor.value.set(info.color || '#f2d27a');
    setPlaqueTex(info);
    if (!same) { plq.t0 = performance.now(); plaqueMat.uniforms.uReveal.value = reduce ? 1 : 0; cta.classList.remove('is-in'); }
    plaque.visible = beam.visible = true; cta.hidden = false;
    cta.querySelector('[data-cta-k]').textContent = (info.code || '') + ' · ' + (info.status || '');
    labs.forEach(function (b, i) { if (b) b.classList.toggle('is-titled', i === k); });
    labWrap.classList.add('is-focus');
    /* 글꼴이 늦게 오면 한 번 더 그린다 */
    if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('900 120px "Noto Serif KR"'), document.fonts.load('600 32px "Barlow Condensed"')]).then(function () { if (plq.k === k && !plq.out) setPlaqueTex(info); }, function () {});
  }
  function hideTitle() {
    if (plq.k < 0 || plq.out) return;
    plq.out = true; plq.outT0 = performance.now(); plq.liftTo = 0; cta.classList.remove('is-in');
    labs.forEach(function (b) { if (b) b.classList.remove('is-titled'); });
    labWrap.classList.remove('is-focus');
  }
  function lift(on) { plq.liftTo = on ? 1 : 0; cta.classList.toggle('is-gone', !!on); }
  function framePlaque(now) {
    if (plq.k < 0) return;
    var q = cent[plq.k];
    if (plq.out) {
      var po = Math.min(1, (now - plq.outT0) / 380);
      plaqueMat.uniforms.uReveal.value = Math.min(plaqueMat.uniforms.uReveal.value, 1 - po); beamMat.uniforms.uA.value = 1 - po;
      if (po >= 1) { plaque.visible = beam.visible = false; cta.hidden = true; plq.k = -1; return; }
    } else if (!reduce) {
      var pb = Math.min(1, (now - plq.t0) / 450), pr2 = Math.min(1, Math.max(0, (now - plq.t0 - 250) / 750));
      beamMat.uniforms.uA.value = ease(pb); plaqueMat.uniforms.uReveal.value = ease(pr2);
      if (pr2 >= 1 && !cta.classList.contains('is-in')) cta.classList.add('is-in');
    } else { beamMat.uniforms.uA.value = 1; cta.classList.add('is-in'); }
    plq.lift += (plq.liftTo - plq.lift) * (reduce ? 1 : .08);
    var sc = Math.max(.75, Math.min(1.7, cam.dist / 30));
    var ground = q.y + (plq.k === uni.uSel.value ? uni.uRise.value * 0.32 : 0);
    var bottom = ground + 1.6 * sc + plq.lift * 1.6 * sc;
    plaque.scale.set(sc, sc, 1);
    plaque.position.set(q.x, bottom + PH * sc / 2, q.z);
    plaque.rotation.set(0, cam.az, 0);
    beam.position.set(q.x, (ground + bottom) / 2, q.z); beam.scale.set(sc, bottom - ground, 1); beam.rotation.set(0, cam.az, 0);
    /* 버튼은 현판 바로 아래 */
    v3.set(q.x, bottom, q.z).project(camera);
    var vis = v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
    cta.style.transform = 'translate(' + ((v3.x + 1) / 2 * W).toFixed(1) + 'px,' + ((1 - v3.y) / 2 * H).toFixed(1) + 'px)';
    cta.style.visibility = vis ? '' : 'hidden';
  }

  /* ── 크기 ── */
  function resize() {
    W = host.clientWidth || 1; H = host.clientHeight || 1;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    /* 좁은 화면은 더 멀리서 (지도 전체가 들어오게) */
    /* 지도 폭(약 52)이 가로로 다 들어오는 거리. 세로로 긴 화면은 너무 멀어지지 않게 자른다 */
    HOME.dist = Math.max(56, Math.min(84, 30 / (Math.tan(16 * Math.PI / 180) * camera.aspect)));
    uni.uFogNear.value = HOME.dist * 0.75; uni.uFogFar.value = HOME.dist * 2.1;
    DMAX = HOME.dist * 1.6;
    camera.updateProjectionMatrix();
  }
  place(); try { renderer.compile(scene, camera); } catch (_) {}   /* 셰이더를 미리 만들어 첫 화면 전환이 끊기지 않게 */
  var ro = new ResizeObserver(function () { var fresh = cam.dist === HOME.dist; resize(); if (fresh && !goal) cam.dist = HOME.dist; }); ro.observe(host); resize();
  cam.dist = HOME.dist; clampCam();

  /* ── 그리기 ── */
  var raf = 0, running = false, t0 = performance.now(), introT0 = t0, fps = { n: 0, t: t0, v: 0 }, v3 = new THREE.Vector3();
  function ease(p) { return 1 - Math.pow(1 - p, 4); }
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    uni.uTime.value = (now - t0) / 1000;
    if (!reduce && uni.uIntro.value < 1) uni.uIntro.value = Math.min(1, (now - introT0) / 2600);
    if (uni.uSel.value >= 0 && uni.uRise.value < 1) uni.uRise.value = reduce ? 1 : ease(Math.min(1, (now - selT0) / 900));
    if (goal) {
      var p = Math.min(1, (now - goal.t0) / goal.dur), e = ease(p);
      ['tx', 'tz', 'dist', 'el'].forEach(function (k) { cam[k] = goal.from[k] + (goal.to[k] - goal.from[k]) * e; });
      var da = Math.atan2(Math.sin(goal.to.az - goal.from.az), Math.cos(goal.to.az - goal.from.az));
      cam.az = goal.from.az + da * e;
      if (p >= 1) goal = null;
    }
    if (hoverQ && !ptr.size) { setHover(pick(hoverQ[0], hoverQ[1])); hoverQ = null; }
    place();
    uni.uFogNear.value = cam.dist * 0.75; uni.uFogFar.value = cam.dist * 2.1;   /* 안개는 지금 카메라 거리 기준 */
    framePlaque(now);
    renderer.render(scene, camera);
    /* 이름표 위치 */
    var showLab = uni.uIntro.value > 0.85;
    labWrap.classList.toggle('is-in', showLab);
    var placed = [];
    for (var o = 0; o < order.length; o++) {
      var k = order[o], b = labs[k];
      var rise = k === uni.uSel.value ? uni.uRise.value * 0.32 : 0;
      v3.set(cent[k].x, cent[k].y + 0.2 + rise, cent[k].z).project(camera);
      var vis = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
      var sx = (v3.x + 1) / 2 * W, sy = (1 - v3.y) / 2 * H;
      b.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
      b.style.visibility = vis ? '' : 'hidden';
      var lw = labW[k] || 120, box = [sx - 4, sy - 40, sx + lw, sy - 14], hit = false;
      var keep = k === uni.uSel.value || k === uni.uHover.value;
      if (!keep) for (var pI = 0; pI < placed.length; pI++) { var q = placed[pI]; if (box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]) { hit = true; break; } }
      if (vis && !hit) placed.push(box);
      if (b.classList.contains('is-pin') !== hit) b.classList.toggle('is-pin', hit);
    }
    order.sort(function (a, b) { return rank(a) - rank(b); });
    if (opt.onCam) opt.onCam(cam, HOME.dist);
    needle.style.setProperty('--a', (cam.az * 180 / Math.PI).toFixed(1) + 'deg');
    fps.n++;
    if (now - fps.t > 1000) {
      fps.v = fps.n * 1000 / (now - fps.t); fps.n = 0; fps.t = now;
      /* 초당 30장 아래로 떨어지면 해상도를 한 단계씩 낮춘다 (최저 0.75배) */
      if (fps.v < 30 && pr > 0.75 && now - introT0 > 3000) { pr = Math.max(0.75, pr - 0.25); renderer.setPixelRatio(pr); renderer.setSize(W, H, false); }
    }
  }
  function start() { if (running) return; running = true; fps.t = performance.now(); fps.n = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function replayIntro() { if (reduce) return; uni.uIntro.value = 0; introT0 = performance.now(); }

  function dispose() {
    stop(); ro.disconnect();
    geo.dispose(); tileMat.dispose(); seaMat.dispose(); sea.geometry.dispose(); pgeo.dispose(); pmat.dispose();
    renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
    plaque.geometry.dispose(); plaqueMat.dispose(); beam.geometry.dispose(); beamMat.dispose();
    if (plaqueMat.uniforms.uMap.value) plaqueMat.uniforms.uMap.value.dispose();
    el.remove(); labWrap.remove(); hud.remove(); cta.remove();
  }

  var api = {
    start: start, stop: stop, select: select, focus: focus, clear: clear, reset: reset, zoom: zoom,
    title: title, hideTitle: hideTitle, lift: lift,
    replayIntro: replayIntro, resize: resize, dispose: dispose,
    fps: function () { return fps.v; }, has: function (k) { return !!(cent[k] && cent[k].k); }
  };
  return api;
}
