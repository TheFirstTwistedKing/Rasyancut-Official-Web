/* RASYANCUT — 라디오
   노래 파일은 서버로 보내지 않고 이 브라우저(IndexedDB)에만 저장한다. */
(function () {
  'use strict';
  var RSC = window.RSC, esc = RSC.esc;
  var SHOW_MS = 5000;
  var tracks = [], cur = -1, url = '', hideTimer = 0, db = null;
  var audio = new Audio(); audio.preload = 'metadata';

  /* ── 화면 요소 ── */
  var tab = document.createElement('div');
  tab.className = 'radio';
  tab.innerHTML = '<div class="radio__title" aria-live="polite"><span><span class="mono">Now Playing</span><strong data-r-title></strong></span></div>' +
    '<button class="radio__btn" aria-haspopup="dialog" aria-label="라디오 플레이리스트 열기"><span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="mono">Radio</span></button>';

  var ICON = { play: 'M4 2l10 6-10 6z', pause: 'M3 2h4v12H3zM9 2h4v12H9z', prev: 'M3 2h2v12H3zM14 2v12L6 8z', next: 'M11 2h2v12h-2zM2 2l8 6-8 6z' };
  function ico(n) { return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="' + ICON[n] + '"/></svg>'; }

  var panel = document.createElement('div');
  panel.className = 'rpanel';
  panel.innerHTML = '<div class="rpanel__veil" data-r-close></div>' +
    '<section class="rpanel__box" role="dialog" aria-modal="true" aria-label="라디오 플레이리스트">' +
      '<header class="rpanel__head"><div><p class="stitle__en">RADIO</p><h2>플레이리스트</h2></div><button class="rpanel__close mono" data-r-close>Close ×</button></header>' +
      '<label class="rdrop"><input type="file" accept="audio/*" multiple data-r-file><strong>노래 올리기</strong><span class="mono">Click or drop audio files</span></label>' +
      '<ol class="rlist" data-r-list></ol>' +
      '<div class="rctl">' +
        '<p class="rctl__now"><span class="mono gold" data-r-state>Standby</span><strong data-r-now>재생 중인 노래가 없습니다</strong></p>' +
        '<div class="rctl__bar"><span class="mono" data-r-cur>0:00</span><input type="range" min="0" max="1000" value="0" aria-label="재생 위치" data-r-seek><span class="mono" data-r-dur>0:00</span></div>' +
        '<div class="rctl__row"><button class="rbtn" data-r-prev aria-label="이전 곡">' + ico('prev') + '</button>' +
          '<button class="rbtn rbtn--main" data-r-toggle aria-label="재생">' + ico('play') + '</button>' +
          '<button class="rbtn" data-r-next aria-label="다음 곡">' + ico('next') + '</button>' +
          '<label class="rctl__vol"><span class="mono">Vol</span><input type="range" min="0" max="100" value="80" aria-label="음량" data-r-vol></label></div>' +
      '</div></section>';
  document.body.append(tab, panel);

  var $ = function (s) { return document.querySelector(s); };
  var listEl = $('[data-r-list]'), seek = $('[data-r-seek]'), vol = $('[data-r-vol]'), opener = tab.querySelector('.radio__btn');

  /* ── 저장소 ── */
  function openDb() {
    return new Promise(function (res) {
      try {
        var rq = indexedDB.open('rsc-radio', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true }); };
        rq.onsuccess = function () { db = rq.result; res(); };
        rq.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function dbAll() {
    return new Promise(function (res) {
      if (!db) return res([]);
      var rq = db.transaction('tracks').objectStore('tracks').getAll();
      rq.onsuccess = function () { res(rq.result || []); }; rq.onerror = function () { res([]); };
    });
  }
  function dbAdd(t) {
    return new Promise(function (res) {
      if (!db) { t.id = Date.now() + Math.random(); return res(t); }
      var rq = db.transaction('tracks', 'readwrite').objectStore('tracks').add({ name: t.name, blob: t.blob });
      rq.onsuccess = function () { t.id = rq.result; res(t); };
      rq.onerror = function () { t.id = Date.now() + Math.random(); res(t); };   /* 저장 실패해도 이번 방문 동안은 재생 */
    });
  }
  function dbDel(id) { if (db) try { db.transaction('tracks', 'readwrite').objectStore('tracks').delete(id); } catch (e) {} }

  /* ── 표시 ── */
  function fmt(s) { if (!isFinite(s)) return '0:00'; s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function fill(el, p) { el.style.setProperty('--p', p + '%'); }
  function render() {
    listEl.innerHTML = tracks.length ? tracks.map(function (t, i) {
      return '<li' + (i === cur ? ' class="is-on"' : '') + '><button class="rlist__play" data-r-play="' + i + '"><b>' + String(i + 1).padStart(2, '0') + '</b><strong>' + esc(t.name) + '</strong></button>' +
        '<button class="rlist__del" data-r-del="' + i + '" aria-label="' + esc(t.name) + ' 삭제">×</button></li>';
    }).join('') : '<li class="rlist__empty">올린 노래가 없습니다. 위에서 노래를 올리면 바로 재생됩니다.</li>';
    $('[data-r-now]').textContent = cur >= 0 ? tracks[cur].name : '재생 중인 노래가 없습니다';
  }
  function state() {
    var on = cur >= 0 && !audio.paused;
    tab.classList.toggle('is-playing', on);
    $('[data-r-state]').textContent = cur < 0 ? 'Standby' : on ? 'On Air' : 'Paused';
    var b = $('[data-r-toggle]'); b.innerHTML = ico(on ? 'pause' : 'play'); b.setAttribute('aria-label', on ? '일시정지' : '재생');
  }
  /* 곡 이름이 5초 동안 튀어나왔다가 들어간다 */
  function announce(name) {
    $('[data-r-title]').textContent = name;
    tab.classList.add('is-show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { tab.classList.remove('is-show'); }, SHOW_MS);
  }

  /* ── 재생 ── */
  function play(i) {
    if (!tracks.length) return;
    cur = (i + tracks.length) % tracks.length;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(tracks[cur].blob);
    audio.src = url;
    audio.play().then(function () { announce(tracks[cur].name); }).catch(function () { $('[data-r-state]').textContent = 'Cannot play'; });
    render(); state();
  }
  function stop() { audio.pause(); audio.removeAttribute('src'); audio.load(); cur = -1; seek.value = 0; fill(seek, 0); $('[data-r-cur]').textContent = $('[data-r-dur]').textContent = '0:00'; render(); state(); }
  function add(files) {
    var list = [].filter.call(files, function (f) { return /^audio\//.test(f.type) || /\.(mp3|wav|ogg|m4a|flac|aac|opus)$/i.test(f.name); });
    if (!list.length) return;
    var first = tracks.length;
    Promise.all(list.map(function (f) { return dbAdd({ name: f.name.replace(/\.[^.]+$/, ''), blob: f }); }))
      .then(function (added) { tracks = tracks.concat(added); play(first); });   /* 올린 노래를 바로 재생 */
  }

  audio.addEventListener('play', state); audio.addEventListener('pause', state);
  audio.addEventListener('ended', function () { play(cur + 1); });
  audio.addEventListener('timeupdate', function () {
    if (!audio.duration) return;
    var p = audio.currentTime / audio.duration * 1000; seek.value = p; fill(seek, p / 10);
    $('[data-r-cur]').textContent = fmt(audio.currentTime); $('[data-r-dur]').textContent = fmt(audio.duration);
  });
  seek.addEventListener('input', function () { if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration; fill(seek, seek.value / 10); });
  vol.addEventListener('input', function () { audio.volume = vol.value / 100; fill(vol, vol.value); try { localStorage.setItem('rsc-radio-vol', vol.value); } catch (e) {} });

  /* ── 창 열고 닫기 ── */
  function setOpen(o) {
    panel.classList.toggle('is-open', o);
    document.body.style.overflow = o ? 'hidden' : '';
    if (o) panel.querySelector('.rpanel__close').focus(); else opener.focus();
  }
  opener.addEventListener('click', function () { setOpen(true); });
  panel.addEventListener('click', function (e) {
    if (e.target.closest('[data-r-close]')) return setOpen(false);
    var p = e.target.closest('[data-r-play]'); if (p) return play(+p.dataset.rPlay);
    var d = e.target.closest('[data-r-del]');
    if (d) {
      var i = +d.dataset.rDel; dbDel(tracks[i].id); tracks.splice(i, 1);
      if (i === cur) stop(); else { if (i < cur) cur--; render(); }
    }
  });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false); });
  $('[data-r-toggle]').addEventListener('click', function () {
    if (cur < 0) return play(0);
    if (audio.paused) audio.play().then(function () { announce(tracks[cur].name); }); else audio.pause();
  });
  $('[data-r-prev]').addEventListener('click', function () { play(cur - 1); });
  $('[data-r-next]').addEventListener('click', function () { play(cur + 1); });

  var fileIn = $('[data-r-file]'), drop = panel.querySelector('.rdrop');
  fileIn.addEventListener('change', function () { add(fileIn.files); fileIn.value = ''; });
  ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
  drop.addEventListener('drop', function (e) { add(e.dataTransfer.files); });

  /* ── 시작 ── */
  try { var v = localStorage.getItem('rsc-radio-vol'); if (v !== null) vol.value = v; } catch (e) {}
  audio.volume = vol.value / 100; fill(vol, vol.value);
  render(); state();
  openDb().then(dbAll).then(function (saved) { tracks = saved.concat(tracks); if (cur >= 0) cur += saved.length; render(); });
})();
