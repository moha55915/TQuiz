const SQ = { quiz: null, questions: [], state: null, timerId: null };
const AUTH = { mode: 'login', codeRequired: false, grades: [] };

function sqRead() {
  try {
    return JSON.parse(sessionStorage.getItem('qp_student') || 'null');
  } catch (e) {
    return null;
  }
}

function sqWrite(state) {
  sessionStorage.setItem('qp_student', JSON.stringify(state));
}

function sqRemoveMarker() {
  sessionStorage.removeItem('qp_student');
}

function sqClear() {
  sessionStorage.removeItem('qp_student');
  SQ.state = null;
}

function isStudent() {
  return Boolean(API.sToken());
}

function meCache() {
  try {
    return JSON.parse(localStorage.getItem('qp_me') || 'null');
  } catch (e) {
    return null;
  }
}

function setMe(s) {
  if (s) localStorage.setItem('qp_me', JSON.stringify(s));
  else localStorage.removeItem('qp_me');
}

function myName() {
  const me = meCache();
  return me && me.displayName ? me.displayName : '';
}

function myGrade() {
  const me = meCache();
  return me && me.grade ? String(me.grade) : '';
}

function sqAuth(e) {
  if (e && e.code === 'unauthorized') {
    API.setSToken('');
    setMe(null);
    sqClear();
    toast(t('unauthorized'), 'error');
    location.hash = '#/';
    return true;
  }
  return false;
}

function driveImgHtml(url, cls) {
  const c = cls || 'q-image';
  return '<img class="' + esc(c) + '" src="' + esc(url) + '" alt="" loading="lazy" onerror="window.driveImgError(this)">';
}

function driveImgError(el) {
  if (!el) return;
  try {
    const m = /[?&]id=([a-zA-Z0-9_-]+)/.exec(el.src || '');
    if (!m) {
      const dm = /\/d\/([a-zA-Z0-9_-]+)/.exec(el.src || '');
      if (dm) {
        el.onerror = null;
        try { el.remove(); } catch (e) { }
        return;
      }
    } else {
      const id = m[1];
      const isUc = (el.src || '').indexOf('uc?export=view') !== -1;
      const alt = isUc
        ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1400'
        : 'https://drive.google.com/uc?export=view&id=' + id;
      if (alt !== el.src) {
        el.onerror = null;
        el.src = alt;
        el.addEventListener('error', () => { try { el.remove(); } catch (e) { } }, { once: true });
        return;
      }
    }
  } catch (e) { }
  try { el.remove(); } catch (e) { }
}
window.driveImgError = driveImgError;

function qText(q) {
  return q.textAR || '';
}

function qOptions(q) {
  if (q.type === 'tf') {
    return ['صح', 'خطأ'];
  }
  return Array.isArray(q.optionsAR) ? q.optionsAR : [];
}

function qOptionValues(q) {
  if (q.type === 'tf') return ['true', 'false'];
  return qOptions(q).map((_, i) => String(i));
}

function answerDisplay(q, ans) {
  const a = String(ans == null ? '' : ans);
  if (q.type === 'tf') return a === 'true' ? t('tf_true') : a === 'false' ? t('tf_false') : '';
  if (q.type === 'mcq') {
    const opts = qOptions(q);
    const i = Number(a);
    if (a !== '' && !isNaN(i) && opts[i] !== undefined) return opts[i];
    return a;
  }
  return a;
}

function correctDisplay(q) {
  if (q.type === 'tf') return q.correct === 'true' ? t('tf_true') : t('tf_false');
  if (q.type === 'mcq') {
    const opts = qOptions(q);
    const i = Number(q.correct);
    if (!isNaN(i) && opts[i] !== undefined) return opts[i];
    return q.correct;
  }
  return String(q.correct || '').trim() || '—';
}

function infoScreen(icon, title, sub, buttonsHtml) {
  document.getElementById('app').innerHTML = `
    <div class="container narrow">
      <div class="card empty-state">
        <div class="big">${icon}</div>
        <div style="font-weight:800; font-size:18px">${esc(title)}</div>
        ${sub ? `<div class="sub" style="color:var(--muted); font-weight:600; margin-top:8px">${esc(sub)}</div>` : ''}
        <div style="margin-top:18px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap">${buttonsHtml}</div>
      </div>
    </div>`;
}

/* ---------------- home / dashboard ---------------- */
async function renderHome() {
  const app = document.getElementById('app');
  const banner = API.isLocal()
    ? `<div class="container" style="margin-bottom:18px"><div class="local-banner">⚠ <span>${esc(t('offline_demo'))}</span></div></div>`
    : '';
  const hero = `
    <div class="hero">
      <span class="hero-kicker">✦ ${esc(t('tagline'))}</span>
      <h1>${esc(t('home_title'))}</h1>
      <p>${esc(t('home_sub'))}</p>
    </div>`;
  if (!isStudent()) {
    app.innerHTML = `
      ${banner}
      <div class="container">
        ${hero}
        <div class="auth-cta card">
          <div>
            <strong>${esc(t('quiz_requires_login'))}</strong>
          </div>
          <a class="btn btn-primary" href="#/auth">${esc(t('go_login'))} →</a>
        </div>
        <div id="homeList"><div class="loading-block"><div class="spinner"></div></div></div>
      </div>`;
    await renderPublicList();
    return;
  }
  app.innerHTML = `
    ${banner}
    <div class="container">
      ${hero}
      <div class="dash-head">
        <div>
          <div class="dash-hello">${esc(t('solving_as'))}: <b>${esc(myName())}</b>${myGrade() ? ` <span class="chip">🎒 ${esc(t('grade_label'))}: <strong>${esc(myGrade())}</strong></span>` : ''}</div>
          <p class="dash-sub">${esc(t('dashboard_sub'))}</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" id="accountBtn">👤 ${esc(t('edit_name'))}</button>
          <button class="btn btn-danger btn-sm" id="outBtn">${esc(t('student_logout'))}</button>
        </div>
      </div>
      <h2 class="section-title">${esc(t('my_quizzes'))}</h2>
      <div id="homeList"><div class="loading-block"><div class="spinner"></div></div></div>
    </div>`;

  document.getElementById('accountBtn').addEventListener('click', openAccountModal);
  document.getElementById('outBtn').addEventListener('click', async () => {
    const ok = await confirmDialog(t('confirm_logout'), t('student_logout'), t('confirm'));
    if (!ok) return;
    try { await API.logout(); } catch (e) { }
    API.setSToken('');
    setMe(null);
    sqClear();
    toast(t('logged_out'), 'success');
    refreshHeader();
    renderHome();
  });

  try {
    const home = await API.studentHome();
    setMe(home.student);
    refreshHeader();
    const list = document.getElementById('homeList');
    if (!home.quizzes.length) {
      list.innerHTML = `<div class="empty-state"><div class="big">🗂</div>${esc(t(myGrade() ? 'no_quizzes_grade' : 'no_quizzes'))}</div>`;
      return;
    }
    list.innerHTML = `<div class="quiz-grid">${home.quizzes.map((entry) => dashboardCard(entry)).join('')}</div>`;
  } catch (e) {
    if (sqAuth(e)) return;
    const list = document.getElementById('homeList');
    if (list) list.innerHTML = `
      <div class="empty-state">
        <div class="big">⚠</div>
        <div>${esc(e.message || t('error_generic'))}</div>
        <button class="btn btn-ghost" style="margin-top:14px" onclick="renderHome()">${esc(t('retry'))}</button>
      </div>`;
  }
}

function dashboardCard(entry) {
  const quiz = entry.quiz;
  const title = quiz.titleAR || quiz.titleEN || '';
  const desc = quiz.descAR || quiz.descEN || '';
  const att = entry.attempt;
  const showScore = isTruthy(quiz.showScore);
  const scorePill = showScore && att && att.status === 'submitted'
    ? `<span class="score-pill"><b>${Number(att.totalScore) || 0}</b> / ${Number(att.maxScore) || 0}</span>` : '';
  let action = '';
  if (!att) {
    action = `<a class="btn btn-primary btn-block" href="#/quiz/${esc(quiz.quizId)}">${esc(t('start_now'))} →</a>`;
  } else if (att.status === 'in_progress') {
    action = `<a class="btn btn-primary btn-block" href="#/quiz/${esc(quiz.quizId)}">▶ ${esc(t('status_continue'))}</a>`;
  } else if (att.reviewOpen) {
    action = `<a class="btn btn-primary btn-block" href="#/review/${esc(quiz.quizId)}">👁 ${esc(t('status_review'))}</a>`;
  } else {
    action = `<div class="status-waiting">⏳ ${esc(t('status_waiting'))}</div>`;
  }
  return `
    <article class="quiz-card">
      <div class="quiz-card-top">
        <h3>${esc(title)}</h3>
        ${scorePill}
      </div>
      <p>${esc(desc)}</p>
      <div class="quiz-card-meta">
        <span class="chip">⏱ <strong>${Number(quiz.durationSec) > 0 ? Math.round(Number(quiz.durationSec) / 60) + ' ' + esc(t('min_short')) : esc(t('quiz_unlimited'))}</strong></span>
        <span class="chip">📋 <strong>${entry.questionCount}</strong></span>
        <span class="chip badge-muted">🎯 ${esc(t('quiz_one_attempt'))}</span>
      </div>
      ${action}
    </article>`;
}

async function renderPublicList() {
  const list = document.getElementById('homeList');
  if (!list) return;
  try {
    const quizzes = await API.getQuizzes();
    if (!quizzes.length) {
      list.innerHTML = `<div class="empty-state"><div class="big">🗂</div>${esc(t('no_quizzes'))}</div>`;
      return;
    }
    list.innerHTML = `<div class="quiz-grid">${quizzes.map((quiz) => `
      <article class="quiz-card">
        <h3>${esc(quiz.titleAR || quiz.titleEN || '')}</h3>
        <p>${esc(quiz.descAR || quiz.descEN || '')}</p>
        <div class="quiz-card-meta">
          <span class="chip">⏱ <strong>${Number(quiz.durationSec) > 0 ? Math.round(Number(quiz.durationSec) / 60) + ' ' + esc(t('min_short')) : esc(t('quiz_unlimited'))}</strong></span>
          <span class="chip badge-muted">🎯 ${esc(t('quiz_one_attempt'))}</span>
        </div>
        <a class="btn btn-primary btn-block" href="#/quiz/${esc(quiz.quizId)}">${esc(t('start'))} →</a>
      </article>`).join('')}</div>`;
  } catch (e) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="big">⚠</div>
        <div>${esc(e.message || t('error_generic'))}</div>
        <button class="btn btn-ghost" style="margin-top:14px" onclick="renderHome()">${esc(t('retry'))}</button>
      </div>`;
  }
}

/* ---------------- auth ---------------- */
async function renderAuth() {
  if (isStudent()) {
    location.hash = '#/';
    return;
  }
  stopTimer();
  try {
    const info = await API.authInfo();
    AUTH.codeRequired = Boolean(info.codeRequired);
    AUTH.grades = Array.isArray(info.grades) ? info.grades : [];
  } catch (e) {
    AUTH.codeRequired = false;
    AUTH.grades = [];
  }
  paintAuth();
}

function paintAuth() {
  const login = AUTH.mode === 'login';
  document.getElementById('app').innerHTML = `
    <div class="container narrow">
      <div class="card auth-card">
        <div class="welcome-icon">🎓</div>
        <span class="hero-kicker">✦ ${esc(t('tagline'))}</span>
        <h1 style="font-size:26px">${esc(login ? t('auth_title_login') : t('auth_title_register'))}</h1>
        <p class="sub" style="color:var(--muted); font-weight:600; margin:8px 0 18px">${esc(t('auth_sub'))}</p>
        <div class="auth-tabs">
          <button class="tab${login ? ' active' : ''}" id="tabLogin">${esc(t('auth_login_tab'))}</button>
          <button class="tab${login ? '' : ' active'}" id="tabReg">${esc(t('auth_register_tab'))}</button>
        </div>
        <form id="authForm">
          <div class="field">
            <label for="auUser">${esc(t('username'))}</label>
            <input class="input" id="auUser" type="text" autocomplete="username" maxlength="20" placeholder="${esc(t('username_ph'))}" required>
          </div>
          <div class="field">
            <label for="auPass">${esc(t('password'))}</label>
            <input class="input" id="auPass" type="password" autocomplete="${login ? 'current-password' : 'new-password'}" minlength="4" maxlength="64" placeholder="${esc(t('password_ph'))}" required>
          </div>
          ${login ? '' : `
            <div class="field">
              <label for="auName">${esc(t('display_name'))}</label>
              <input class="input" id="auName" type="text" autocomplete="name" maxlength="60" placeholder="${esc(t('display_name_ph'))}" required>
            </div>
            <div class="field">
              <label for="auGrade">${esc(t('grade_label'))}</label>
              ${AUTH.grades.length ? `
                <select class="select" id="auGrade" required>
                  <option value="">${esc(t('grade_select_ph'))}</option>
                  ${AUTH.grades.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}
                </select>` : `
                <input class="input" id="auGrade" type="text" maxlength="60" placeholder="${esc(t('grade_ph'))}" required>`}
            </div>
            ${AUTH.codeRequired ? `
              <div class="field">
                <label for="auCode">${esc(t('reg_code'))}</label>
                <input class="input" id="auCode" type="text" maxlength="32" placeholder="${esc(t('reg_code_hint'))}" required>
              </div>` : ''}`}
          <button class="btn btn-primary btn-lg btn-block" type="submit">${login ? esc(t('login_btn')) : esc(t('register_btn'))} →</button>
        </form>
        <p class="auth-switch">${login ? esc(t('no_account_q')) : esc(t('have_account_q'))} <a href="#" id="switchAuth">${login ? esc(t('auth_register_tab')) : esc(t('auth_login_tab'))}</a></p>
        ${API.isLocal() ? `<div class="hint" style="text-align:center; margin-top:10px">🧪 ${esc(t('demo_account_hint'))}</div>` : ''}
        <div style="margin-top:16px"><a class="btn btn-ghost btn-sm" href="#/">${esc(t('back_home'))}</a></div>
      </div>
    </div>`;

  document.getElementById('tabLogin').addEventListener('click', () => { AUTH.mode = 'login'; paintAuth(); });
  document.getElementById('tabReg').addEventListener('click', () => { AUTH.mode = 'register'; paintAuth(); });
  document.getElementById('switchAuth').addEventListener('click', (e) => {
    e.preventDefault();
    AUTH.mode = login ? 'register' : 'login';
    paintAuth();
  });
  document.getElementById('auUser').focus();
  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('[type="submit"]');
    const username = document.getElementById('auUser').value.trim();
    const password = document.getElementById('auPass').value;
    btn.disabled = true;
    try {
      let res;
      if (login) {
        res = await API.login({ username, password });
      } else {
        const grade = document.getElementById('auGrade').value.trim();
        if (!grade) { toast(t('grade_required'), 'error'); btn.disabled = false; return; }
        res = await API.register({
          username, password,
          displayName: document.getElementById('auName').value.trim(),
          grade,
          code: AUTH.codeRequired ? document.getElementById('auCode').value.trim() : ''
        });
      }
      API.setSToken(res.token);
      setMe(res.student);
      toast(login ? t('welcome_welcome') : t('account_created'), 'success');
      refreshHeader();
      location.hash = '#/';
    } catch (err) {
      toast(err.message || t('error_generic'), 'error');
      const input = document.getElementById('auUser');
      input.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(9px)' }, { transform: 'translateX(0)' }],
        { duration: 300 }
      );
      btn.disabled = false;
    }
  });
}

function openAccountModal() {
  const me = meCache() || {};
  openModal(`
    <div class="modal-head">
      <div class="modal-title">👤 ${esc(t('signed_in_as'))}</div>
      <button class="btn btn-ghost btn-sm btn-icon" data-close>✕</button>
    </div>
    <form id="accForm">
      <div class="field">
        <label>${esc(t('display_name'))}</label>
        <input class="input" name="dn" value="${esc(me.displayName || '')}" maxlength="60" required>
        <span class="hint">${esc(t('username'))}: <b>${esc(me.username || '')}</b></span>
      </div>
      <div class="modal-actions" style="justify-content:space-between">
        <button type="button" class="btn btn-danger" id="accOut">${esc(t('student_logout'))}</button>
        <div style="display:flex; gap:8px">
          <button type="button" class="btn btn-ghost" data-close>${esc(t('cancel'))}</button>
          <button type="submit" class="btn btn-primary">${esc(t('save'))}</button>
        </div>
      </div>
    </form>`, (modal) => {
    modal.querySelector('#accForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const dn = e.target.dn.value.trim();
      if (dn.length < 2) { toast(t('name_short'), 'error'); return; }
      try {
        const res = await API.studentUpdateProfile(dn);
        const updated = Object.assign({}, meCache() || {}, { displayName: res.displayName });
        setMe(updated);
        toast(t('name_saved'), 'success');
        closeModal();
        if (location.hash === '#/' || location.hash === '') renderHome();
      } catch (err) {
        if (!sqAuth(err)) toast(err.message || t('error_generic'), 'error');
      }
    });
    modal.querySelector('#accOut').addEventListener('click', async () => {
      closeModal();
      const ok = await confirmDialog(t('confirm_logout'), t('student_logout'), t('confirm'));
      if (!ok) return;
      try { await API.logout(); } catch (e) { }
      API.setSToken('');
      setMe(null);
      sqClear();
      refreshHeader();
      location.hash = '#/';
      renderHome();
    });
  });
}

/* ---------------- quiz route ---------------- */
function loginGateScreen(quizId) {
  infoScreen('🔑', t('quiz_requires_login'), '',
    `<a class="btn btn-primary" href="#/auth">${esc(t('go_login'))}</a>
     <a class="btn btn-ghost" href="#/">${esc(t('back_home'))}</a>`);
}

async function renderQuizRoute(quizId) {
  const app = document.getElementById('app');
  stopTimer();
  app.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;

  let meta;
  try {
    meta = await API.getQuiz(quizId);
  } catch (e) {
    infoScreen('⚠', t('quiz_not_found'), e.message === 'quiz_not_found' ? '' : (e.message || ''),
      `<a class="btn btn-primary" href="#/">${esc(t('back_home'))}</a>`);
    return;
  }
  SQ.quiz = meta.quiz;
  SQ.questions = [];

  if (!isTruthy(meta.quiz.active)) {
    infoScreen('⏸', t('quiz_inactive'), '',
      `<a class="btn btn-primary" href="#/">${esc(t('back_home'))}</a>`);
    return;
  }
  if (!isStudent()) {
    loginGateScreen(quizId);
    return;
  }

  const marker = sqRead();
  if (marker && marker.quizId === quizId && marker.attemptId) {
    try {
      const begin = await API.beginAttempt(quizId);
      if (begin.status === 'submitted') {
        sqRemoveMarker();
        SQ.state = null;
        renderSubmittedScreen(begin);
        return;
      }
      if (begin.status === 'in_progress' || begin.status === 'created') {
        SQ.quiz = begin.quiz || SQ.quiz;
        SQ.questions = begin.questions || [];
        const dur = Number(begin.durationSec) || 0;
        const st = Object.assign({}, marker, {
          quizId,
          attemptId: begin.attemptId,
          phase: 'playing',
          result: null,
          deadline: dur > 0 ? Date.now() + Math.max(0, Number(begin.remainingSec) || 0) * 1000 : null
        });
        SQ.state = st;
        sqWrite(st);
        renderQuestion();
        return;
      }
    } catch (e) {
      if (sqAuth(e)) return;
      toast(e.message || t('error_generic'), 'error');
    }
  }

  try {
    const home = await API.studentHome();
    const entry = (home.quizzes || []).find((x) => x.quiz.quizId === quizId);
    const att = entry && entry.attempt;
    if (!att) {
      renderWelcome();
      return;
    }
    if (att.status === 'in_progress') {
      renderLocked(quizId);
      return;
    }
    renderSubmittedScreen(att);
  } catch (e) {
    if (sqAuth(e)) return;
    infoScreen('⚠', t('error_generic'), e.message || '',
      `<button class="btn btn-primary" onclick="renderQuizRoute('${esc(quizId)}')">${esc(t('retry'))}</button>
       <a class="btn btn-ghost" href="#/">${esc(t('back_home'))}</a>`);
  }
}

function renderLocked(quizId) {
  infoScreen('🔒', t('locked_title'), t('locked_body'),
    `<button class="btn btn-primary" id="recheckBtn">${esc(t('retry'))}</button>
     <a class="btn btn-ghost" href="#/">${esc(t('back_home'))}</a>`);
  const btn = document.getElementById('recheckBtn');
  if (btn) btn.addEventListener('click', () => renderQuizRoute(quizId));
}

function renderSubmittedScreen(att) {
  const showScore = isTruthy(SQ.quiz ? SQ.quiz.showScore : att.showScore);
  const hasScore = showScore && att.totalScore !== undefined;
  const pct = hasScore && Number(att.maxScore) > 0 ? Math.round((Number(att.totalScore) / Number(att.maxScore)) * 100) : null;
  if (att.reviewOpen) {
    infoScreen('✅', hasScore ? `${t('score_label')}: ${Number(att.totalScore) || 0} / ${Number(att.maxScore) || 0}${pct !== null ? ' · ' + pct + '%' : ''}` : t('result_title'), t('result_saved'),
      `<a class="btn btn-primary" href="#/review/${esc(att.quizId || SQ.quiz.quizId)}">${esc(t('status_review'))}</a>
       <a class="btn btn-ghost" href="#/">${esc(t('back_home'))}</a>`);
    return;
  }
  infoScreen('⏳', t('status_waiting'), t('review_waiting_sub'),
    `<a class="btn btn-primary" href="#/">${esc(t('back_home'))}</a>`);
}

function renderWelcome() {
  const quiz = SQ.quiz;
  const title = quiz.titleAR || quiz.titleEN || '';
  const desc = quiz.descAR || quiz.descEN || '';
  const dur = Number(quiz.durationSec) || 0;
  document.getElementById('app').innerHTML = `
    <div class="container narrow">
      <div class="card welcome-card">
        <div class="welcome-icon">🎓</div>
        <span class="hero-kicker">${esc(t('welcome_welcome'))}</span>
        <h1>${esc(title)}</h1>
        <p class="sub">${esc(desc)}</p>
        <div class="meta-row">
          <span class="chip">📋 <strong>${esc(String(SQ.questions.length || ''))}</strong> ${esc(t('quiz_questions_count'))}</span>
          <span class="chip">⏱ <strong>${dur > 0 ? Math.round(dur / 60) + ' ' + esc(t('min_short')) : esc(t('quiz_unlimited'))}</strong></span>
          <span class="chip badge-muted">🎯 ${esc(t('quiz_one_attempt'))}</span>
        </div>
        <div class="rules">
          <li>${esc(t('rule_1'))}</li>
          <li>${esc(t('rule_2'))}</li>
          <li>${esc(t('rule_3'))}</li>
          <li>${esc(t('rule_4'))}</li>
        </div>
        <div class="solve-as">
          <span>${esc(t('solving_as'))}: <b>${esc(myName())}</b></span>
          <button class="btn btn-ghost btn-sm" id="editNameBtn">${esc(t('edit_name'))}</button>
        </div>
        <form class="welcome-form" id="startForm">
          <span class="hint" style="display:block; text-align:center; margin-block-end:12px">${esc(t('quiz_one_attempt'))} — ${esc(t('rule_3'))}</span>
          <button class="btn btn-primary btn-lg btn-block" type="submit" id="startQuizBtn">${esc(t('start'))} →</button>
        </form>
      </div>
    </div>`;
  document.getElementById('editNameBtn').addEventListener('click', openAccountModal);
  document.getElementById('startForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('startQuizBtn');
    btn.disabled = true;
    try {
      const begin = await API.beginAttempt(quiz.quizId);
      if (begin.status === 'submitted') {
        sqRemoveMarker();
        renderSubmittedScreen(begin);
        return;
      }
      SQ.quiz = begin.quiz || SQ.quiz;
      SQ.questions = begin.questions || SQ.questions;
      const dur = Number(begin.durationSec) || 0;
      SQ.state = {
        quizId: quiz.quizId,
        attemptId: begin.attemptId,
        phase: 'playing',
        startedAt: begin.startedAt || new Date().toISOString(),
        deadline: dur > 0 ? Date.now() + Math.max(0, Number(begin.remainingSec) || 0) * 1000 : null,
        index: 0,
        answers: {},
        images: {},
        result: null
      };
      sqWrite(SQ.state);
      renderQuestion();
      startTimer();
    } catch (err) {
      btn.disabled = false;
      if (sqAuth(err)) return;
      toast(err.message || t('error_generic'), 'error');
    }
  });
}

/* ---------------- playing ---------------- */
function answeredCount() {
  if (!SQ.state) return 0;
  return SQ.questions.filter((q) => {
    const v = SQ.state.answers[q.qId];
    return v !== undefined && String(v).trim() !== '';
  }).length;
}

function renderImgStrip(qId) {
  const strip = document.getElementById('imgStrip');
  if (!strip) return;
  const st = SQ.state;
  const imgs = (st.images && st.images[qId]) || [];
  strip.innerHTML = imgs.map((img, i) => `
    <span class="img-thumb">
      ${driveImgHtml(img.url, '')}
      <button type="button" class="img-rm" data-i="${i}" title="${esc(t('delete'))}">✕</button>
    </span>`).join('');
  strip.querySelectorAll('.img-rm').forEach((b) => {
    b.addEventListener('click', async () => {
      const i = Number(b.dataset.i);
      const item = (SQ.state.images[qId] || [])[i];
      if (!item) return;
      try { await API.deleteUpload(item.uploadId); } catch (e) { if (sqAuth(e)) return; }
      SQ.state.images[qId].splice(i, 1);
      sqWrite(SQ.state);
      renderImgStrip(qId);
    });
  });
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t('image_failed')));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(t('image_failed')));
      img.onload = () => {
        const maxDim = 1400;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const scale = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleImagePick(file, qId) {
  if (!file) return;
  const st = SQ.state;
  if (!/^image\/(jpeg|jpg|png|webp|gif|webp)$/.test(file.type)) { toast(t('image_failed'), 'error'); return; }
  if (file.size > 12 * 1024 * 1024) { toast(t('image_failed'), 'error'); return; }
  st.images = st.images || {};
  const current = st.images[qId] || [];
  if (current.length >= 4) { toast(t('image_max'), 'error'); return; }
  toast(t('image_uploading'));
  try {
    const dataUrl = await compressImage(file);
    const up = await API.uploadImage({ attemptId: st.attemptId, qId, dataUrl });
    if (!SQ.state || SQ.state.phase !== 'playing') return;
    SQ.state.images = SQ.state.images || {};
    if (!SQ.state.images[qId]) SQ.state.images[qId] = [];
    SQ.state.images[qId].push({ uploadId: up.uploadId, url: up.url });
    sqWrite(SQ.state);
    renderImgStrip(qId);
    toast(t('image_uploaded'), 'success');
  } catch (e) {
    if (sqAuth(e)) return;
    toast(e.message || t('image_failed'), 'error');
  }
}

function renderQuestion() {
  stopTimer();
  const st = SQ.state;
  const idx = Math.max(0, Math.min(Number(st.index) || 0, SQ.questions.length - 1));
  st.index = idx;
  sqWrite(st);
  const q = SQ.questions[idx];
  const total = SQ.questions.length;
  const dur = SQ.state && SQ.state.deadline ? 1 : 0;

  let body = '';
  if (q.type === 'text') {
    const val = st.answers[q.qId] || '';
    body = `
      <textarea class="textarea" id="textAnswer" placeholder="اكتب إجابتك هنا…" maxlength="2000">${esc(val)}</textarea>
      <div class="img-area">
        <div class="img-hint">📎 <strong>${esc(t('attach_image'))}</strong> — ${esc(t('attach_hint'))}</div>
        <div class="img-strip" id="imgStrip"></div>
        <label class="btn btn-ghost btn-sm img-pick">
          📷 ${esc(t('add_image'))}
          <input type="file" id="imgInput" accept="image/*" hidden>
        </label>
      </div>`;
  } else {
    const opts = qOptions(q);
    const values = qOptionValues(q);
    const selected = st.answers[q.qId];
    body = `<div class="options" id="optList">
      ${opts.map((opt, i) => `
        <button type="button" class="option${selected === values[i] ? ' selected' : ''}" data-val="${esc(values[i])}">
          <span class="opt-key">${q.type === 'tf' ? (values[i] === 'true' ? '✓' : '✗') : String.fromCharCode(65 + i)}</span>
          <span>${esc(opt)}</span>
        </button>`).join('')}
    </div>`;
  }

  const timerHtml = st.deadline
    ? `<span class="timer-pill">⏳ <span id="timerVal">00:00</span></span>`
    : `<span class="chip">✔ <strong id="doneCount">${answeredCount()}</strong>/${total}</span>`;

  document.getElementById('app').innerHTML = `
    <div class="container quiz-shell">
      <div class="quiz-topbar">
        <div class="progress-wrap" title="${esc(t('question_n'))} ${idx + 1} ${esc(t('of_word'))} ${total}">
          <div class="progress-bar" style="width:${Math.max(4, ((idx + 1) / total) * 100)}%"></div>
        </div>
        <span class="chip solving-chip">${esc(myName())}</span>
        ${timerHtml}
      </div>

      <div class="card question-card">
        <div class="q-head">
          <span class="q-number">${esc(t('question_n'))} ${idx + 1} ${esc(t('of_word'))} ${total}</span>
          <span class="badge badge-indigo">${esc(q.type === 'mcq' ? t('type_mcq') : q.type === 'tf' ? t('type_tf') : t('type_text'))}</span>
          <span class="chip">⭐ <strong>${Number(q.points) || 0}</strong></span>
        </div>
        <div class="q-text">${esc(qText(q))}</div>
        ${q.imageUrl ? driveImgHtml(q.imageUrl) : ''}
        ${body}
        <div class="q-nav">
          <button class="btn btn-ghost" id="prevBtn" ${idx === 0 ? 'disabled' : ''}>← ${esc(t('prev'))}</button>
          ${idx === total - 1
            ? `<button class="btn btn-primary" id="submitBtn">${esc(t('submit'))} ✓</button>`
            : `<button class="btn btn-primary" id="nextBtn">${esc(t('next'))} →</button>`}
        </div>
        <div class="q-dots">
          ${SQ.questions.map((qq, i) => {
            const done = st.answers[qq.qId] !== undefined && String(st.answers[qq.qId]).trim() !== '';
            return `<button type="button" class="q-dot${i === idx ? ' current' : done ? ' done' : ''}" data-i="${i}">${i + 1}</button>`;
          }).join('')}
        </div>
      </div>
    </div>`;

  if (q.type === 'text') {
    const ta = document.getElementById('textAnswer');
    ta.addEventListener('input', () => {
      SQ.state.answers[q.qId] = ta.value;
      sqWrite(SQ.state);
      const dc = document.getElementById('doneCount');
      if (dc) dc.textContent = answeredCount();
    });
    ta.focus();
    renderImgStrip(q.qId);
    document.getElementById('imgInput').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      handleImagePick(file, q.qId);
    });
  } else {
    els('#optList .option').forEach((btn) => {
      btn.addEventListener('click', () => {
        SQ.state.answers[q.qId] = btn.dataset.val;
        sqWrite(SQ.state);
        els('#optList .option').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        const dc = document.getElementById('doneCount');
        if (dc) dc.textContent = answeredCount();
      });
    });
  }

  const prevBtn = document.getElementById('prevBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => { if (st.index > 0) { SQ.state.index = st.index - 1; renderQuestion(); } });
  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) nextBtn.addEventListener('click', () => { SQ.state.index = st.index + 1; renderQuestion(); });
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.addEventListener('click', confirmSubmit);
  els('.q-dot').forEach((dot) => {
    dot.addEventListener('click', () => { SQ.state.index = Number(dot.dataset.i); renderQuestion(); });
  });

  startTimer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startTimer() {
  stopTimer();
  const st = SQ.state;
  if (!st || st.phase !== 'playing' || !st.deadline) return;
  const tick = () => {
    const remain = Math.max(0, Math.round((st.deadline - Date.now()) / 1000));
    const pill = document.getElementById('timerVal');
    if (pill) {
      pill.textContent = fmtDur(remain);
      pill.parentElement.classList.toggle('low', remain <= 30);
    }
    if (remain <= 0) {
      stopTimer();
      toast('خلص الوقت — تم تسليم إجاباتك تلقائياً');
      doSubmit(true);
    }
  };
  tick();
  SQ.timerId = setInterval(tick, 500);
}

function stopTimer() {
  if (SQ.timerId) {
    clearInterval(SQ.timerId);
    SQ.timerId = null;
  }
}

function confirmSubmit() {
  const unanswered = SQ.questions.length - answeredCount();
  if (unanswered > 0) {
    confirmDialog(t('unanswered_body'), t('unanswered_title'), t('submit_anyway')).then((ok) => {
      if (ok) doSubmit(false);
    });
    return;
  }
  doSubmit(false);
}

async function doSubmit(auto) {
  if (!SQ.state || SQ.state.phase === 'done') return;
  const st = SQ.state;
  stopTimer();
  const overlay = document.createElement('div');
  overlay.className = 'page-loading';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'color-mix(in srgb, var(--bg) 78%, transparent)';
  overlay.style.zIndex = '70';
  overlay.innerHTML = `<div style="text-align:center"><div class="spinner"></div><div style="margin-top:14px; font-weight:800; color:var(--muted)">${esc(t('submitting'))}</div></div>`;
  document.body.appendChild(overlay);

  try {
    const startedAt = new Date(st.startedAt || Date.now()).getTime();
    const payload = {
      attemptId: st.attemptId,
      timeTakenSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      answers: SQ.questions.map((q) => ({ qId: q.qId, answer: st.answers[q.qId] !== undefined ? String(st.answers[q.qId]) : '' }))
    };
    const result = await API.submitAttempt(payload);
    sqRemoveMarker();
    SQ.state = Object.assign({}, st, { phase: 'done', result });
    renderResult();
  } catch (e) {
    if (sqAuth(e)) return;
    toast(e.message || t('error_generic'), 'error');
    if (auto) toast('جرّب زرار التسليم يدوياً', 'error');
    else startTimer();
  } finally {
    overlay.remove();
  }
}

function renderResult() {
  stopTimer();
  const st = SQ.state;
  const res = (st && st.result) || {};
  const showScore = res.showScore !== undefined ? isTruthy(res.showScore) : isTruthy(SQ.quiz.showScore);
  const total = Number(res.maxScore) || 0;
  const score = Number(res.totalScore) || 0;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const pending = Number(res.pending) || 0;
  const offset = 490 - (490 * pct) / 100;
  const backBtn = `<a class="btn btn-primary" href="#/">${esc(t('back_home'))}</a>`;

  if (!showScore) {
    document.getElementById('app').innerHTML = `
      <div class="container narrow">
        <div class="card result-card">
          <div class="welcome-icon" style="background:linear-gradient(135deg,#10b981,#059669)">✓</div>
          <h1>${esc(t('result_title'))}</h1>
          <p class="sub">${esc(t('result_saved'))}</p>
          <div class="note-box">⏳ ${esc(t('status_waiting'))} — ${esc(t('review_waiting_sub'))}</div>
          <div class="result-actions">${backBtn}</div>
        </div>
      </div>`;
    return;
  }

  document.getElementById('app').innerHTML = `
    <div class="container narrow">
      <div class="card result-card">
        <span class="hero-kicker">🎉 ${esc(t('result_title'))}</span>
        <div class="ring-wrap">
          <svg class="ring" viewBox="0 0 170 170">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#6366f1"/>
                <stop offset="100%" stop-color="#8b5cf6"/>
              </linearGradient>
            </defs>
            <circle class="ring-bg" cx="85" cy="85" r="78"/>
            <circle class="ring-fg" cx="85" cy="85" r="78" style="stroke-dasharray:490; stroke-dashoffset:490" id="ringFg"/>
          </svg>
          <div class="ring-label">
            <div>
              <div class="pct">${pct}%</div>
              <div class="of">${esc(t('result_score'))}: ${score} / ${total}</div>
            </div>
          </div>
        </div>
        <div class="result-stats">
          <div class="result-stat ok"><div class="num">${Number(res.correct) || 0}</div><div class="lbl">${esc(t('result_correct'))}</div></div>
          <div class="result-stat bad"><div class="num">${Number(res.wrong) || 0}</div><div class="lbl">${esc(t('result_wrong'))}</div></div>
          <div class="result-stat wait"><div class="num">${pending}</div><div class="lbl">${esc(t('result_pending'))}</div></div>
        </div>
        ${pending > 0 ? `<div class="note-box">⏳ ${esc(t('result_pending_note'))}</div>` : ''}
        <div class="note-box">⏳ ${esc(t('status_waiting'))} — ${esc(t('review_waiting_sub'))}</div>
        <div class="result-actions">${backBtn}</div>
      </div>
    </div>`;

  requestAnimationFrame(() => {
    setTimeout(() => {
      const ring = document.getElementById('ringFg');
      if (ring) ring.style.strokeDashoffset = String(offset);
    }, 120);
  });
}

/* ---------------- review ---------------- */
async function renderReview(quizId) {
  const app = document.getElementById('app');
  stopTimer();
  if (!isStudent()) {
    loginGateScreen(quizId);
    return;
  }
  app.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  let data;
  try {
    data = await API.studentReview(quizId);
  } catch (e) {
    if (sqAuth(e)) return;
    infoScreen('⚠', t('error_generic'), e.message || '',
      `<a class="btn btn-primary" href="#/">${esc(t('back_home'))}</a>`);
    return;
  }
  if (data.status === 'none') {
    infoScreen('📝', t('review_none'), '',
      `<a class="btn btn-primary" href="#/quiz/${esc(quizId)}">${esc(t('start_now'))}</a>
       <a class="btn btn-ghost" href="#/">${esc(t('back_home'))}</a>`);
    return;
  }
  if (data.status === 'in_progress') {
    infoScreen('▶', t('status_continue'), '',
      `<a class="btn btn-primary" href="#/quiz/${esc(quizId)}">${esc(t('status_continue'))}</a>
       <a class="btn btn-ghost" href="#/">${esc(t('back_home'))}</a>`);
    return;
  }
  if (!data.reviewOpen) {
    infoScreen('⏳', t('review_waiting'), t('review_waiting_sub'),
      `<a class="btn btn-primary" href="#/">${esc(t('back_home'))}</a>`);
    return;
  }

  const quiz = data.quiz || {};
  const title = quiz.titleAR || quiz.titleEN || '';
  const showScore = isTruthy(data.showScore);
  const total = Number(data.maxScore) || 0;
  const score = Number(data.totalScore) || 0;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const questions = data.questions || [];

  app.innerHTML = `
    <div class="container narrow">
      <div class="review-head card">
        <span class="hero-kicker">📖 ${esc(t('review_title'))}</span>
        <h1>${esc(title)}</h1>
        ${showScore ? `
          <div class="review-score">
            <span class="ring-mini">${pct}%</span>
            <span class="score-pill big"><b>${score}</b> / ${total} ${esc(t('points_word'))}</span>
          </div>` : ''}
        <div class="meta-row">
          <span class="chip">📅 <strong>${esc(fmtDate(data.submittedAt))}</strong></span>
          <span class="chip">⏱ <strong>${esc(fmtDur(data.timeTakenSec))}</strong></span>
        </div>
        <div class="result-actions">
          <a class="btn btn-primary" href="#/">${esc(t('back_home'))}</a>
        </div>
      </div>
      ${questions.map((q, i) => {
        const hasImages = q.images && q.images.length;
        const answerHtml = hasImages
          ? `<div class="review-imgs">${q.images.map((im) => `<a href="${esc(im.url)}" target="_blank" rel="noopener">${driveImgHtml(im.url, 'review-img')}</a>`).join('')}</div>`
          : '';
        const text = answerDisplay(q, q.answer);
        const gradeBadge = q.gradedBy === 'auto' ? `<span class="badge badge-green">${esc(t('graded_auto'))}</span>`
          : q.gradedBy === 'teacher' ? `<span class="badge badge-indigo">${esc(t('graded_teacher'))}</span>`
          : `<span class="badge badge-amber">${esc(t('pending_badge'))}</span>`;
        return `
        <div class="card answer-block review-q ${q.isCorrect === '1' ? 'ok' : q.isCorrect === '0' ? 'bad' : ''}">
          <div class="ab-q">${i + 1}. ${esc(qText(q))}</div>
${q.imageUrl ? driveImgHtml(q.imageUrl) : ''}
          <div class="ab-line"><span class="k">${esc(t('your_answer'))}</span><span class="v">${esc(text || (hasImages ? '' : t('not_answered')))}</span></div>
          ${answerHtml}
          <div class="ab-line"><span class="k">${esc(t('correct_answer'))}</span><span class="v">${esc(correctDisplay(q))}</span></div>
          <div class="ab-line"><span class="k">${esc(t('grade_points'))}</span><span class="v">
            <span class="score-pill"><b>${Number(q.points) || 0}</b> / ${Number(q.maxPoints) || 0}</span> ${gradeBadge}
          </span></div>
        </div>`;
      }).join('')}
      <div class="result-actions" style="margin-block:18px">
        <a class="btn btn-primary" href="#/">${esc(t('back_home'))}</a>
      </div>
    </div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('beforeunload', (e) => {
  if (SQ.state && SQ.state.phase === 'playing') {
    e.preventDefault();
    e.returnValue = '';
  }
});
