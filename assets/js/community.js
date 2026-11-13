/* RASYANCUT — 커뮤니티 (Firebase Firestore)
   로그인한 사람만 보고 쓸 수 있다. 화면: 목록(#) · 글 읽기(#p=ID) · 글쓰기(#write) · 수정(#edit=ID)
   데이터: posts/{id} (+ comments, likes, files 하위 컬렉션), admins/{uid}(관리자 표시, 콘솔에서 직접 만든다) */
(function () {
  'use strict';
  var RSC = window.RSC, esc = RSC.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = $('[data-c-view]'), catsEl = $('[data-c-cats]'), writeBtn = $('[data-c-write]'), side = $('[data-c-side]'), meEl = $('[data-c-me]');
  var CATS = [['all', '전체'], ['notice', '공지'], ['free', '자유'], ['theory', '떡밥 토론'], ['fanart', '팬아트'], ['qna', '질문']];
  var CAT = {}; CATS.forEach(function (c) { CAT[c[0]] = c[1]; });
  var PAGE = 60, MAXIMG = 4, IMGBYTES = 300000;
  var F = null, db = null, user = null, admin = false, cat = 'all', posts = [], lastDoc = null, more = false, booted = false;

  /* ── 공통 ── */
  function when(ts) {
    var d = ts && ts.toDate ? ts.toDate() : null; if (!d) return '방금';
    var diff = (Date.now() - d) / 1000;
    if (diff < 60) return '방금'; if (diff < 3600) return Math.floor(diff / 60) + '분 전'; if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }
  function text(s) { return esc(s || '').replace(/\n/g, '<br>'); }
  function avatar(p) { return p ? '<img class="cav" src="' + esc(p) + '" alt="" referrerpolicy="no-referrer">' : '<span class="cav cav--none"></span>'; }
  function show(html) { view.innerHTML = html; view.classList.remove('is-swap'); void view.offsetWidth; view.classList.add('is-swap'); }
  function pad(n, k) { return String(n).padStart(k || 2, '0'); }
  function serial(id) { return 'REC-' + String(id || '').slice(0, 6).toUpperCase(); }
  function firstLine(b) { var t = String(b || '').split('\n').filter(Boolean)[0] || ''; return t.length > 90 ? t.slice(0, 90) + '…' : t; }
  function fail(err) {
    var c = err && err.code || '';
    var m = c === 'permission-denied' ? '권한이 없습니다. (데이터베이스 규칙을 확인해 주세요)'
      : c === 'not-configured' ? '로그인 서비스가 아직 설정되지 않았습니다.'
      : c === 'unavailable' ? '네트워크 연결을 확인해 주세요.'
      : /firestore|not.*(enabled|found)|NOT_FOUND/i.test(String(err && err.message)) ? '커뮤니티 데이터베이스가 아직 준비되지 않았습니다.'
      : '문제가 생겼습니다 (' + (c || (err && err.message) || '알 수 없음') + ')';
    show('<div class="cempty"><p class="mono gold">Error / Access Fault</p><p>' + esc(m) + '</p><a class="btn btn--ghost" href="#">목록으로</a></div>');
  }
  function busy(msg) { show('<div class="cempty cempty--busy"><i class="cbusy" aria-hidden="true"></i><p class="mono gold">Loading</p><p>' + esc(msg || '불러오는 중…') + '</p></div>'); }

  /* ── 로그인 확인 ── */
  function gate() {
    side.hidden = true; writeBtn.hidden = true;
    show('<div class="cgate"><div class="cgate__txt">' +
      '<p class="stitle__en">RESTRICTED ARCHIVE</p><h2>봉인된<br>기록 보관소</h2>' +
      '<p>커뮤니티는 로그인한 기록자만 열람하고 기록을 남길 수 있습니다.</p>' +
      '<button class="btn" data-c-login>로그인하고 봉인 풀기</button>' +
      '<dl class="cgate__spec mono"><div><dt>Access</dt><dd>Recorder Only</dd></div><div><dt>Auth</dt><dd>Google</dd></div><div><dt>Status</dt><dd class="gold">Sealed</dd></div></dl></div>' +
      '<div class="cgate__seal" aria-hidden="true"><i class="s1"></i><i class="s2"></i><i class="s3"></i><i class="s4"></i><b></b></div></div>');
  }
  function start() {
    user = RSC.auth && RSC.auth.user && RSC.auth.user();
    if (!user) { admin = false; return gate(); }
    side.hidden = false; writeBtn.hidden = false;
    busy('기록 보관소에 접속하는 중…');
    RSC.auth.firebase().then(function (f) {
      if (F) return F;
      return import(f.SDK + 'firebase-firestore.js').then(function (m) { F = m; db = m.getFirestore(f.app); return F; });
    }).then(function () {
      return F.getDoc(F.doc(db, 'admins', user.uid)).then(function (d) { admin = d.exists(); }, function () { admin = false; });
    }).then(function () { booted = true; route(); }).catch(fail);
  }

  /* ── 분류 탭 ── */
  catsEl.innerHTML = CATS.map(function (c, i) { return '<button data-cat="' + c[0] + '" aria-pressed="' + (c[0] === cat) + '"><span class="mono">' + pad(i) + '</span><b>' + c[1] + '</b><em class="mono" data-cnt="' + c[0] + '">—</em></button>'; }).join('');
  function counts() {
    CATS.forEach(function (c) {
      var n = c[0] === 'all' ? posts.length : posts.filter(function (p) { return p.cat === c[0]; }).length;
      var e = catsEl.querySelector('[data-cnt="' + c[0] + '"]'); if (e) e.textContent = pad(n) + (c[0] === 'all' && more ? '+' : '');
    });
    if (!user) return;
    var mine = posts.filter(function (p) { return p.uid === user.uid; });
    meEl.innerHTML = '<p class="mono cside__k">Recorder</p><div class="cme__id">' + avatar(user.photoURL) + '<div><strong>' + esc(user.displayName || '기록자') + '</strong><span class="mono">' + (admin ? 'Archivist · 관리자' : 'Recorder') + '</span></div></div>' +
      '<dl class="mono"><div><dt>Records</dt><dd>' + pad(mine.length) + '</dd></div><div><dt>Likes</dt><dd>' + pad(mine.reduce(function (a, p) { return a + (p.likeCount || 0); }, 0)) + '</dd></div></dl>';
  }
  catsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]'); if (!b) return;
    cat = b.dataset.cat; catsEl.querySelectorAll('[data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    if (location.hash && location.hash !== '#') location.hash = ''; else renderList();
  });

  /* ── 목록 ── */
  function loadPosts(next) {
    var q = [F.collection(db, 'posts'), F.orderBy('createdAt', 'desc'), F.limit(PAGE)];
    if (next && lastDoc) q.push(F.startAfter(lastDoc));
    return F.getDocs(F.query.apply(null, q)).then(function (snap) {
      var got = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; });
      posts = next ? posts.concat(got) : got; lastDoc = snap.docs[snap.docs.length - 1] || lastDoc; more = snap.docs.length === PAGE;
    });
  }
  function renderList() {
    var list = posts.filter(function (p) { return cat === 'all' || p.cat === cat; });
    list.sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });   /* 고정 글이 위로 (나머지는 최신순 유지) */
    counts();
    /* 장부 번호: 오래된 글부터 001 */
    var order = posts.slice().reverse(), no = {}; order.forEach(function (p, i) { no[p.id] = i + 1; });
    var head = '<header class="cledger__head"><p class="mono">Ledger / <b class="gold">' + esc(CAT[cat]) + '</b></p><p class="mono"><b class="gold">' + pad(list.length) + '</b> Records</p></header>';
    show(list.length
      ? '<section class="cledger">' + head + '<ol class="clist2">' + list.map(function (p, i) {
          return '<li' + (p.pinned ? ' class="is-pin"' : '') + ' style="--i:' + Math.min(i, 12) + '"><a href="#p=' + p.id + '">' +
            '<span class="cno mono">' + pad(no[p.id] || 0, 3) + '</span>' +
            '<span class="cmain"><span class="ctag mono">' + (p.pinned ? '<b>Pinned</b>' : '') + esc(CAT[p.cat] || p.cat) + '</span>' +
              '<strong>' + esc(p.title) + (p.imageCount ? '<i class="cimg-ic" title="이미지 ' + p.imageCount + '장"></i>' : '') + '</strong>' +
              '<span class="cex">' + esc(firstLine(p.body)) + '</span></span>' +
            '<span class="cby">' + avatar(p.photo) + '<span><b>' + esc(p.name || '기록자') + '</b><span class="mono">' + when(p.createdAt) + '</span></span></span>' +
            '<span class="cstat mono"><span title="댓글">C <b>' + pad(p.commentCount || 0) + '</b></span><span title="좋아요">♥ <b>' + pad(p.likeCount || 0) + '</b></span></span></a></li>';
        }).join('') + '</ol></section>' + (more ? '<button class="btn btn--ghost cmore" data-c-more>더 보기</button>' : '')
      : '<section class="cledger">' + head + '<div class="cempty"><p class="mono gold">Empty Ledger</p><p>아직 이 분류에 남은 기록이 없습니다. 첫 기록을 남겨 보세요.</p><button class="btn" data-c-new>새 기록 쓰기</button></div></section>');
  }

  /* ── 글 읽기 ── */
  function renderPost(id) {
    busy();
    var ref = F.doc(db, 'posts', id);
    Promise.all([
      F.getDoc(ref),
      F.getDocs(F.query(F.collection(db, 'posts', id, 'files'), F.orderBy('n'))),
      F.getDocs(F.query(F.collection(db, 'posts', id, 'comments'), F.orderBy('createdAt'))),
      F.getDoc(F.doc(db, 'posts', id, 'likes', user.uid))
    ]).then(function (r) {
      if (!r[0].exists()) return show('<div class="cempty"><p>삭제되었거나 없는 글입니다.</p><a class="btn btn--ghost" href="#">목록으로</a></div>');
      var p = r[0].data(); p.id = id;
      var mine = p.uid === user.uid, liked = r[3].exists();
      var imgs = r[1].docs.map(function (d) { return '<img src="' + esc(d.data().data) + '" alt="첨부 이미지" loading="lazy">'; }).join('');
      var cms = r[2].docs.map(function (d) {
        var c = d.data();
        return '<li>' + avatar(c.photo) + '<div><p class="cmeta"><strong>' + esc(c.name || '기록자') + '</strong><span class="mono">' + when(c.createdAt) + '</span>' +
          ((c.uid === user.uid || admin) ? '<button class="cdel mono" data-c-cdel="' + d.id + '">삭제</button>' : '') + '</p><p>' + text(c.body) + '</p></div></li>';
      }).join('');
      show('<article class="cpost">' +
        '<a class="cback mono" href="#">← Ledger</a>' +
        '<p class="cserial mono"><span>' + serial(id) + '</span><span class="ctag">' + (p.pinned ? '<b>Pinned</b>' : '') + esc(CAT[p.cat] || p.cat) + '</span></p><h2>' + esc(p.title) + '</h2>' +
        '<p class="cmeta">' + avatar(p.photo) + '<strong>' + esc(p.name || '기록자') + '</strong><span class="mono">' + when(p.createdAt) + (p.updatedAt ? ' · 수정됨' : '') + '</span></p>' +
        '<div class="cbody">' + text(p.body) + '</div>' + (imgs ? '<div class="cimgs">' + imgs + '</div>' : '') +
        '<div class="cact"><button class="clikebtn' + (liked ? ' is-on' : '') + '" data-c-like aria-pressed="' + liked + '">♥ <span>' + (p.likeCount || 0) + '</span></button>' +
          (mine ? '<a class="btn btn--ghost" href="#edit=' + id + '">수정</a>' : '') +
          ((mine || admin) ? '<button class="btn btn--ghost" data-c-del>삭제</button>' : '') +
          (admin ? '<button class="btn btn--ghost" data-c-pin>' + (p.pinned ? '고정 해제' : '위에 고정') + '</button>' : '') +
          (mine && RSC.notify ? '<button class="btn btn--ghost cnotif" data-c-mute>' + (RSC.notify.muted(id) ? '이 글 알림 켜기' : '이 글 알림 끄기') + '</button>' : '') + '</div>' +
        '<section class="ccom"><h3 class="mono">Comments <b class="gold">' + pad(r[2].size) + '</b></h3>' + (cms ? '<ol>' + cms + '</ol>' : '<p class="ccom__none">아직 댓글이 없습니다.</p>') +
          '<form data-c-cform><textarea name="body" maxlength="1000" rows="3" placeholder="댓글을 남겨 주세요" required></textarea><button class="btn">댓글 등록</button></form></section>' +
        '</article>');
      view.dataset.pid = id; view.dataset.liked = liked ? '1' : ''; view.dataset.owner = p.uid; view.dataset.title = p.title;
    }).catch(fail);
  }

  /* ── 글쓰기 / 수정 ── */
  var pending = [];
  function renderForm(id) {
    pending = [];
    var go = function (p) {
      var cats = CATS.filter(function (c) { return c[0] !== 'all' && (c[0] !== 'notice' || admin); });
      show('<form class="cform" data-c-form' + (id ? ' data-id="' + id + '"' : '') + '>' +
        '<a class="cback mono" href="' + (id ? '#p=' + id : '#') + '">← 돌아가기</a><header class="cform__head"><p class="mono gold">' + (id ? 'Amend Record / ' + serial(id) : 'New Record') + '</p><h2>' + (id ? '기록 수정' : '새 기록') + '</h2></header>' +
        '<fieldset class="ccats"><legend class="mono">Category</legend>' + cats.map(function (c) { var on = p && p.cat === c[0] || (!p && c[0] === (cat !== 'all' && cat !== 'notice' ? cat : 'free')); return '<label><input type="radio" name="cat" value="' + c[0] + '"' + (on ? ' checked' : '') + '><span>' + c[1] + '</span></label>'; }).join('') + '</fieldset>' +
        '<label><span class="mono">Title</span><input name="title" maxlength="100" required value="' + esc(p ? p.title : '') + '"></label>' +
        '<label><span class="mono">Body</span><textarea name="body" maxlength="5000" rows="12" required>' + esc(p ? p.body : '') + '</textarea></label>' +
        (id ? '' : '<div class="cfiles"><label class="btn btn--ghost cfile"><input type="file" accept="image/*" multiple data-c-files>이미지 첨부 (최대 ' + MAXIMG + '장)</label><ul data-c-thumbs></ul></div>') +
        '<p class="mono cmsg" data-c-msg></p><button class="btn">' + (id ? '수정 완료' : '등록') + '</button></form>');
    };
    if (!id) return go(null);
    busy(); F.getDoc(F.doc(db, 'posts', id)).then(function (d) {
      if (!d.exists() || d.data().uid !== user.uid) return fail({ code: 'permission-denied' });
      go(d.data());
    }).catch(fail);
  }
  /* 이미지: 브라우저에서 줄이고 압축해 데이터로 저장 (가로·세로 최대 1280px, 300KB 이하) */
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1280 / Math.max(img.width, img.height)), w = Math.round(img.width * s), h = Math.round(img.height * s);
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
        var q = .85, out;
        do { out = cv.toDataURL('image/webp', q); if (out.indexOf('data:image/webp') !== 0) out = cv.toDataURL('image/jpeg', q); q -= .1; } while (out.length > IMGBYTES && q > .3);
        if (out.length > IMGBYTES) { var c2 = document.createElement('canvas'); c2.width = Math.round(w * .7); c2.height = Math.round(h * .7); c2.getContext('2d').drawImage(cv, 0, 0, c2.width, c2.height); out = c2.toDataURL('image/jpeg', .7); }
        res(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('이미지를 읽을 수 없습니다')); };
      img.src = url;
    });
  }
  function thumbs() {
    var ul = $('[data-c-thumbs]'); if (!ul) return;
    ul.innerHTML = pending.map(function (d, i) { return '<li><img src="' + d + '" alt=""><button type="button" data-c-unfile="' + i + '" aria-label="첨부 취소">×</button></li>'; }).join('');
  }
  function submitPost(form) {
    var msg = $('[data-c-msg]'), b = form.querySelector('button:not([type=button])'), id = form.dataset.id;
    var cat2 = form.cat.value, title = form.title.value.trim(), body = form.body.value.trim();
    if (!title || !body) { msg.textContent = '제목과 내용을 입력해 주세요'; return; }
    b.disabled = true; msg.textContent = '저장 중…';
    var run;
    if (id) run = F.updateDoc(F.doc(db, 'posts', id), { cat: cat2, title: title, body: body, updatedAt: F.serverTimestamp() }).then(function () { return id; });
    else {
      var ref = F.doc(F.collection(db, 'posts')), batch = F.writeBatch(db);
      batch.set(ref, { cat: cat2, title: title, body: body, uid: user.uid, name: user.displayName || '기록자', photo: user.photoURL || '',
        createdAt: F.serverTimestamp(), likeCount: 0, commentCount: 0, pinned: false, imageCount: pending.length });
      pending.forEach(function (d, i) { batch.set(F.doc(db, 'posts', ref.id, 'files', String(i)), { n: i, data: d }); });
      if (cat2 === 'notice' && admin) batch.set(F.doc(db, 'announcements', ref.id), { pid: ref.id, title: title, createdAt: F.serverTimestamp() });   /* 공지 알림 */
      run = batch.commit().then(function () { return ref.id; });
    }
    run.then(function (pid) { posts = []; lastDoc = null; location.hash = 'p=' + pid; }).catch(function (err) { b.disabled = false; msg.textContent = '저장하지 못했습니다 (' + (err.code || err.message) + ')'; });
  }

  /* ── 동작 ── */
  view.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-c-login]')) return RSC.auth && RSC.auth.open();
    if (t.closest('[data-c-new]')) { location.hash = 'write'; return; }
    if (t.closest('[data-c-more]')) { busy(); return loadPosts(true).then(renderList).catch(fail); }
    var unf = t.closest('[data-c-unfile]'); if (unf) { pending.splice(+unf.dataset.cUnfile, 1); return thumbs(); }
    var pid = view.dataset.pid;
    if (t.closest('[data-c-like]')) {
      var btn = t.closest('[data-c-like]'), on = !!view.dataset.liked, batch = F.writeBatch(db), lref = F.doc(db, 'posts', pid, 'likes', user.uid);
      btn.disabled = true;
      if (on) batch.delete(lref); else batch.set(lref, { at: F.serverTimestamp() });
      batch.update(F.doc(db, 'posts', pid), { likeCount: F.increment(on ? -1 : 1) });
      return batch.commit().then(function () {
        view.dataset.liked = on ? '' : '1'; btn.classList.toggle('is-on', !on); btn.setAttribute('aria-pressed', !on);
        var n = btn.querySelector('span'); n.textContent = +n.textContent + (on ? -1 : 1); btn.disabled = false;
        posts.forEach(function (p) { if (p.id === pid) p.likeCount = (p.likeCount || 0) + (on ? -1 : 1); });
      }).catch(function (err) { btn.disabled = false; alert('좋아요를 저장하지 못했습니다 (' + (err.code || err.message) + ')'); });
    }
    var mb = t.closest('[data-c-mute]');
    if (mb) { mb.disabled = true; return RSC.notify.toggle(pid).then(function (on) { mb.disabled = false; mb.textContent = on ? '이 글 알림 켜기' : '이 글 알림 끄기'; }); }
    if (t.closest('[data-c-del]')) {
      if (!confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return;
      return F.deleteDoc(F.doc(db, 'posts', pid)).then(function () { posts = posts.filter(function (p) { return p.id !== pid; }); location.hash = ''; }).catch(fail);
    }
    if (t.closest('[data-c-pin]')) {
      var cur = posts.filter(function (p) { return p.id === pid; })[0];
      return F.getDoc(F.doc(db, 'posts', pid)).then(function (d) { return F.updateDoc(F.doc(db, 'posts', pid), { pinned: !d.data().pinned }); })
        .then(function () { posts = []; lastDoc = null; renderPost(pid); }).catch(fail);
    }
    var cd = t.closest('[data-c-cdel]');
    if (cd) {
      if (!confirm('댓글을 삭제할까요?')) return;
      var b2 = F.writeBatch(db); b2.delete(F.doc(db, 'posts', pid, 'comments', cd.dataset.cCdel)); b2.update(F.doc(db, 'posts', pid), { commentCount: F.increment(-1) });
      return b2.commit().then(function () { posts = []; lastDoc = null; renderPost(pid); }).catch(fail);
    }
  });
  view.addEventListener('change', function (e) {
    var inp = e.target.closest('[data-c-files]'); if (!inp) return;
    var files = [].slice.call(inp.files).filter(function (f) { return /^image\//.test(f.type); }).slice(0, MAXIMG - pending.length);
    var msg = $('[data-c-msg]'); msg.textContent = files.length ? '이미지 준비 중…' : '';
    Promise.all(files.map(shrink)).then(function (out) { pending = pending.concat(out).slice(0, MAXIMG); thumbs(); msg.textContent = ''; }, function (err) { msg.textContent = err.message; });
    inp.value = '';
  });
  view.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.matches('[data-c-form]')) return submitPost(f);
    if (f.matches('[data-c-cform]')) {
      var body = f.body.value.trim(), b = f.querySelector('button'), pid = view.dataset.pid; if (!body) return;
      b.disabled = true;
      var batch = F.writeBatch(db), ref = F.doc(F.collection(db, 'posts', pid, 'comments'));
      batch.set(ref, { body: body, uid: user.uid, name: user.displayName || '기록자', photo: user.photoURL || '', createdAt: F.serverTimestamp() });
      batch.update(F.doc(db, 'posts', pid), { commentCount: F.increment(1) });
      var owner = view.dataset.owner;
      if (owner && owner !== user.uid)               /* 글쓴이 알림함에 넣는다 (끄기 설정은 받는 쪽에서 거른다) */
        batch.set(F.doc(F.collection(db, 'users', owner, 'notifs')), { type: 'comment', pid: pid, title: (view.dataset.title || '').slice(0, 100),
          from: user.uid, name: user.displayName || '기록자', photo: user.photoURL || '', body: body.slice(0, 80), createdAt: F.serverTimestamp(), read: false });
      batch.commit().then(function () { posts = []; lastDoc = null; renderPost(pid); }).catch(function (err) { b.disabled = false; alert('댓글을 저장하지 못했습니다 (' + (err.code || err.message) + ')'); });
    }
  });
  writeBtn.addEventListener('click', function () { location.hash = 'write'; });

  /* ── 화면 전환 (주소 해시) ── */
  function route() {
    if (!user) return gate();
    if (!booted) return;
    var h = location.hash, m;
    /* 글·쓰기 화면에서도 왼쪽 색인 숫자가 맞게 (목록을 뒤에서 한 번 불러둔다) */
    if (h && h !== '#' && !posts.length) loadPosts(false).then(counts, function () {});
    if ((m = /^#p=(.+)$/.exec(h))) return renderPost(m[1]);
    if (h === '#write') return renderForm(null);
    if ((m = /^#edit=(.+)$/.exec(h))) return renderForm(m[1]);
    delete view.dataset.pid;
    if (posts.length) return renderList();
    busy(); loadPosts(false).then(renderList).catch(fail);
  }
  RSC.on(window, 'hashchange', route);
  RSC.on(document, 'rsc:auth', function () {
    var u = RSC.auth.user(), changed = (u && u.uid) !== (user && user.uid);
    user = u;                                            /* 프로필(이름·사진)을 바꾸면 다음 글·댓글부터 새 값으로 */
    if (changed) { booted = false; posts = []; lastDoc = null; start(); }
  });
  /* 로그인 상태가 확정될 때까지 잠깐 기다린다 (설정이 없으면 바로 안내) */
  if (RSC.auth && RSC.auth.user()) start();
  else { gate(); }
})();
