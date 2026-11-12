/* RASYANCUT — 구글 로그인 (Firebase Authentication)
   처음 로그인하면 자동으로 회원가입된다. 페이지를 옮겨도 로그인 상태가 유지된다. */
(function () {
  'use strict';
  var RSC = window.RSC, esc = RSC.esc;
  if (RSC.auth) return; RSC.auth = {};
  var CFG = window.RSC_FIREBASE || {}, ready = !!(CFG.apiKey && CFG.authDomain);
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var fb = null, user = null, raw = null, prof = null, FS = null, db = null, last = null;

  var PERSON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a4 4 0 110 8 4 4 0 010-8z M4 21c1-5 4-7 8-7s7 2 8 7"/></svg>';
  var GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>';

  /* ── 화면 요소 ── */
  var btn = document.createElement('button');
  btn.className = 'acct'; btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-label', '로그인');
  btn.innerHTML = PERSON;
  var panel = document.createElement('div');
  panel.className = 'apanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', '계정');
  panel.innerHTML = '<div class="apanel__veil" data-a-close></div><section class="apanel__box"><button class="apanel__close mono" data-a-close>Close ×</button><div data-a-body></div></section>';
  [btn, panel].forEach(function (el) { el.setAttribute('data-keep', ''); });
  document.body.append(btn, panel);
  var body = panel.querySelector('[data-a-body]');

  function render(msg) {
    if (user) {
      btn.innerHTML = user.photoURL ? '<img src="' + esc(user.photoURL) + '" alt="" referrerpolicy="no-referrer">' : PERSON;
      btn.classList.add('is-in'); btn.setAttribute('aria-label', '계정: ' + (user.displayName || user.email || ''));
      body.innerHTML = '<p class="stitle__en">ACCOUNT</p><h2>계정 설정</h2>' +
        '<div class="apanel__me">' + (user.photoURL ? '<img src="' + esc(user.photoURL) + '" alt="" referrerpolicy="no-referrer">' : '<span class="apanel__ph">' + PERSON + '</span>') +
        '<p><strong>' + esc(user.displayName || '이름 없음') + '</strong><span class="mono">' + esc(user.email || '') + '</span></p></div>' +
        '<form class="aprof" data-a-prof><p class="mono">Profile</p>' +
          '<label class="aprof__pic"><input type="file" accept="image/*" data-a-pic>' + (user.photoURL ? '<img src="' + esc(user.photoURL) + '" alt="" referrerpolicy="no-referrer" data-a-preview>' : '<span class="apanel__ph" data-a-preview>' + PERSON + '</span>') + '<span class="mono">사진 바꾸기</span></label>' +
          '<label class="aprof__name"><span class="mono">Display name</span><input name="name" maxlength="20" required value="' + esc(user.displayName || '') + '"></label>' +
          '<p class="apanel__msg mono" data-a-msg>' + esc(msg || '') + '</p>' +
          '<div class="aprof__row"><button class="btn">저장</button><button type="button" class="btn btn--ghost" data-a-out>로그아웃</button></div></form>';
    } else {
      btn.innerHTML = PERSON; btn.classList.remove('is-in'); btn.setAttribute('aria-label', '로그인');
      body.innerHTML = '<p class="stitle__en">ACCESS</p><h2>기록 접속</h2>' +
        '<p class="apanel__lead">구글 계정으로 접속합니다. 처음 접속하면 자동으로 가입됩니다.</p>' +
        '<button class="agoogle" data-a-google' + (ready ? '' : ' disabled') + '>' + GOOGLE + '<span>Google 계정으로 계속하기</span></button>' +
        '<p class="apanel__msg mono" data-a-msg>' + esc(msg || (ready ? '' : '로그인 기능 준비 중입니다')) + '</p>';
    }
  }
  function setOpen(o) {
    panel.classList.toggle('is-open', o);
    if (o) { last = document.activeElement; panel.querySelector('.apanel__close').focus({ preventScroll: true }); }
    else if (last) last.focus({ preventScroll: true });
  }
  btn.addEventListener('click', function () { setOpen(true); });
  panel.addEventListener('click', function (e) {
    if (e.target.closest('[data-a-close]')) return setOpen(false);
    if (e.target.closest('[data-a-google]')) return signIn();
    if (e.target.closest('[data-a-out]')) return signOut();
  });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false); });
  var newPic = null;
  function square(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var S = 160, m = Math.min(img.width, img.height), cv = document.createElement('canvas'); cv.width = cv.height = S;
        cv.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S); URL.revokeObjectURL(url);
        var out = cv.toDataURL('image/webp', .82); if (out.indexOf('data:image/webp') !== 0) out = cv.toDataURL('image/jpeg', .82);
        res(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('이미지를 읽을 수 없습니다')); };
      img.src = url;
    });
  }
  panel.addEventListener('change', function (e) {
    var inp = e.target.closest('[data-a-pic]'); if (!inp || !inp.files[0]) return;
    square(inp.files[0]).then(function (d) {
      newPic = d; var pv = panel.querySelector('[data-a-preview]');
      var img = document.createElement('img'); img.src = d; img.alt = ''; img.setAttribute('data-a-preview', ''); pv.replaceWith(img);
    }, function (err) { var m = panel.querySelector('[data-a-msg]'); if (m) m.textContent = err.message; });
  });
  panel.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-a-prof]'); if (!f) return;
    e.preventDefault();
    var name = f.name.value.trim(), msg = panel.querySelector('[data-a-msg]'), b = f.querySelector('button:not([type=button])');
    if (!name) { msg.textContent = '이름을 입력해 주세요'; return; }
    b.disabled = true; msg.textContent = '저장 중…';
    var data = { name: name, photo: newPic || (prof && prof.photo) || raw.photoURL || '', updatedAt: FS.serverTimestamp() };
    FS.setDoc(FS.doc(db, 'users', raw.uid), data).then(function () {
      prof = data; newPic = null; user = merge(); render('저장했습니다'); document.dispatchEvent(new CustomEvent('rsc:auth', { detail: user }));
    }).catch(function (err) { b.disabled = false; msg.textContent = '저장하지 못했습니다 (' + (err.code || err.message) + ')'; });
  });

  /* ── Firebase (설정값이 있을 때만 불러온다) ── */
  function load() {
    if (fb) return fb;
    fb = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js')]).then(function (m) {
      var app = m[0].initializeApp(CFG), A = m[1], auth = A.getAuth(app);
      auth.languageCode = 'ko';
      A.onAuthStateChanged(auth, function (u) {
        raw = u; prof = null;
        var done = function () { user = merge(); render(); document.dispatchEvent(new CustomEvent('rsc:auth', { detail: user })); };
        if (!u) return done();
        loadProfile(app).then(done, done);
      });
      A.getRedirectResult(auth).catch(function (err) { render(errText(err)); });
      return { A: A, auth: auth, app: app, SDK: SDK };
    });
    return fb;
  }
  /* 표시 이름·프로필 사진: Firestore users/{uid} 에 저장 (없으면 구글 계정 정보) */
  function firestore(app) {
    if (FS) return Promise.resolve(FS);
    return import(SDK + 'firebase-firestore.js').then(function (m) { FS = m; db = m.getFirestore(app); return FS; });
  }
  function loadProfile(app) {
    return firestore(app).then(function () { return FS.getDoc(FS.doc(db, 'users', raw.uid)); }).then(function (d) { prof = d.exists() ? d.data() : null; });
  }
  function merge() {
    if (!raw) return null;
    return { uid: raw.uid, email: raw.email, displayName: (prof && prof.name) || raw.displayName || '기록자', photoURL: (prof && prof.photo) || raw.photoURL || '' };
  }
  function errText(err) {
    var c = err && err.code || '';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '로그인 창이 닫혔습니다';
    if (c === 'auth/unauthorized-domain') return '이 주소는 아직 로그인이 허용되지 않았습니다';
    if (c === 'auth/network-request-failed') return '네트워크 연결을 확인해 주세요';
    return '로그인에 실패했습니다 (' + (c || '알 수 없는 오류') + ')';
  }
  function signIn() {
    if (!ready) return;
    var msg = panel.querySelector('[data-a-msg]'); if (msg) msg.textContent = '접속 중…';
    load().then(function (f) {
      var p = new f.A.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
      return f.A.signInWithPopup(f.auth, p).then(function () { setOpen(false); }).catch(function (err) {
        /* 팝업이 막힌 브라우저(일부 모바일)에서는 페이지 이동 방식으로 */
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') return f.A.signInWithRedirect(f.auth, p);
        throw err;
      });
    }).catch(function (err) { render(errText(err)); });
  }
  function signOut() { load().then(function (f) { return f.A.signOut(f.auth); }).then(function () { setOpen(false); }); }

  RSC.auth.user = function () { return user; };
  RSC.auth.open = function () { setOpen(true); };
  /* 다른 기능(커뮤니티 등)이 같은 Firebase 앱을 쓰도록 넘겨준다 */
  RSC.auth.firebase = function () { return ready ? load() : Promise.reject(Object.assign(new Error('not-configured'), { code: 'not-configured' })); };
  render();
  if (ready) load().catch(function () { render('로그인 서비스를 불러오지 못했습니다'); });
})();
