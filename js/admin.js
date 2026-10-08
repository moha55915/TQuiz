const ADM = {
  token: sessionStorage.getItem('qp_token') || '',
  tab: 'quizzes',
  quizId: '',
  quizzes: [],
  grades: []
};

function admError(e) {
  if (e && e.code === 'unauthorized') {
    ADM.token = '';
    sessionStorage.removeItem('qp_token');
    renderAdmin();
    toast(t('unauthorized'), 'error');
    return;
  }
  toast(e && e.message ? e.message : t('error_generic'), 'error');
}

function quizLink(id) {
  return location.origin + location.pathname + '#/quiz/' + id;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(t('link_copied'), 'success');
}

function quizTitle(quiz) {
  return quiz.titleAR || quiz.titleEN || '';
}

async function renderAdmin() {
  stopTimer();
  if (!ADM.token) {
    renderAdminLogin();
    return;
  }
  renderAdminShell();
}

function renderAdminLogin() {
  document.getElementById('app').innerHTML = `
    <div class="container narrow">
      <div class="card admin-login">
        <div class="welcome-icon">🔐</div>
        <h1 style="font-size:24px">${esc(t('login_title'))}</h1>
        <p class="sub" style="color:var(--muted); font-weight:600; margin:8px 0 22px">${esc(t('login_sub'))}</p>
        <form id="pinForm">
          <div class="field">
            <input class="input pin-input" id="pinInput" type="password" inputmode="numeric" autocomplete="off" placeholder="${esc(t('pin_ph'))}" maxlength="32">
          </div>
          <button class="btn btn-primary btn-lg btn-block" type="submit">${esc(t('login_btn'))} →</button>
        </form>
        <div style="margin-top:18px"><a class="btn btn-ghost btn-sm" href="#/">${esc(t('back_home'))}</a></div>
      </div>
    </div>`;
  document.getElementById('pinInput').focus();
  document.getElementById('pinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const pin = document.getElementById('pinInput').value.trim();
    if (!pin) return;
    btn.disabled = true;
    try {
      const data = await API.adminLogin(pin);
      ADM.token = data.token;
      sessionStorage.setItem('qp_token', data.token);
      ADM.tab = 'quizzes';
      renderAdminShell();
    } catch (err) {
      toast(t('wrong_pin'), 'error');
      const input = document.getElementById('pinInput');
      input.value = '';
      input.focus();
      input.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(9px)' }, { transform: 'translateX(0)' }],
        { duration: 300 }
      );
    } finally {
      btn.disabled = false;
    }
  });
}

function renderAdminShell() {
  const tabs = [
    ['quizzes', 'tab_quizzes'],
    ['questions', 'tab_questions'],
    ['responses', 'tab_responses'],
    ['students', 'tab_students'],
    ['settings', 'tab_settings']
  ];
  document.getElementById('app').innerHTML = `
    <div class="container">
      <div class="admin-head">
        <div>
          <h1>⚙ ${esc(t('admin_title'))}</h1>
          <p>${esc(t('admin_hint'))}</p>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap">
          <a class="btn btn-ghost btn-sm" href="#/">${esc(t('back_home'))}</a>
          <button class="btn btn-danger btn-sm" id="logoutBtn">${esc(t('logout'))}</button>
        </div>
      </div>
      ${API.isLocal() ? `<div class="local-banner">⚠ <span>${esc(t('offline_demo'))} — ${esc(t('setup_needed'))}</span></div>` : ''}
      <div class="tabs">
        ${tabs.map(([id, key]) => `<button class="tab${ADM.tab === id ? ' active' : ''}" data-tab="${id}">${esc(t(key))}</button>`).join('')}
      </div>
      <div id="admBody"><div class="loading-block"><div class="spinner"></div></div></div>
    </div>`;

  els('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      ADM.tab = btn.dataset.tab;
      els('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      renderTab();
    });
  });
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    const ok = await confirmDialog(t('confirm_logout'), t('logout'), t('confirm'));
    if (!ok) return;
    ADM.token = '';
    sessionStorage.removeItem('qp_token');
    renderAdmin();
  });
  renderTab();
}

function renderTab() {
  const body = document.getElementById('admBody');
  if (!body) return;
  body.innerHTML = `<div class="loading-block"><div class="spinner"></div></div>`;
  if (ADM.tab === 'quizzes') renderTabQuizzes();
  else if (ADM.tab === 'questions') renderTabQuestions();
  else if (ADM.tab === 'responses') renderTabResponses();
  else if (ADM.tab === 'students') renderTabStudents();
  else renderTabSettings();
}

/* ---------------- quizzes tab ---------------- */
async function renderTabQuizzes() {
  const body = document.getElementById('admBody');
  if (!body) return;
  try {
    const data = await API.adminOverview(ADM.token);
    if (!body.isConnected) return;
    ADM.quizzes = data.quizzes || [];
    ADM.grades = data.grades || [];
    if (!ADM.quizId && ADM.quizzes.length) ADM.quizId = ADM.quizzes[0].quizId;
    if (!ADM.quizzes.length) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="big">🗂</div>
          <div>${esc(t('no_quizzes_admin'))}</div>
          <button class="btn btn-primary" style="margin-top:16px" id="newQuizBtn2">+ ${esc(t('new_quiz'))}</button>
        </div>`;
      const b2 = document.getElementById('newQuizBtn2');
      if (b2) b2.addEventListener('click', () => openQuizForm(null));
      return;
    }
    body.innerHTML = `
      <div class="toolbar">
        <div class="left"><span class="chip"><strong>${ADM.quizzes.length}</strong> ${esc(t('tab_quizzes'))}</span></div>
        <div class="right"><button class="btn btn-primary" id="newQuizBtn">+ ${esc(t('new_quiz'))}</button></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${esc(t('quiz_title_ar'))}</th>
              <th>${esc(t('questions_col'))}</th>
              <th>${esc(t('attempts_col'))}</th>
              <th>${esc(t('status_col'))}</th>
              <th>${esc(t('actions_col'))}</th>
            </tr>
          </thead>
          <tbody>
            ${ADM.quizzes.map((q) => `
              <tr>
                <td>
                  <div style="font-weight:800">${esc(quizTitle(q))}</div>
                  <div style="font-size:12.5px; color:var(--muted); font-weight:700">${Number(q.durationSec) > 0 ? Math.round(Number(q.durationSec) / 60) + ' ' + esc(t('min_short')) : esc(t('quiz_unlimited'))}${q.grade ? ' · 🎒 ' + esc(q.grade) : ' · ' + esc(t('grade_all'))}</div>
                </td>
                <td><span class="badge badge-indigo">${Number(q.questionCount) || 0}</span></td>
                <td><span class="badge badge-muted">${Number(q.attemptCount) || 0}</span></td>
                <td>${isTruthy(q.active) ? `<span class="badge badge-green">${esc(t('active_yes'))}</span>` : `<span class="badge badge-red">${esc(t('active_no'))}</span>`}</td>
                <td>
                  <div class="cell-actions">
                    <button class="btn btn-ghost btn-sm" data-act="questions" data-id="${esc(q.quizId)}">${esc(t('questions_col'))}</button>
                    <button class="btn btn-ghost btn-sm" data-act="copy" data-id="${esc(q.quizId)}">🔗 ${esc(t('copy_link'))}</button>
                    <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${esc(q.quizId)}">${esc(t('edit'))}</button>
                    <button class="btn btn-danger btn-sm" data-act="del" data-id="${esc(q.quizId)}">${esc(t('delete'))}</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    document.getElementById('newQuizBtn').addEventListener('click', () => openQuizForm(null));
    els('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const quiz = ADM.quizzes.find((q) => q.quizId === id);
        if (btn.dataset.act === 'copy') copyText(quizLink(id));
        else if (btn.dataset.act === 'edit') openQuizForm(quiz);
        else if (btn.dataset.act === 'questions') { ADM.quizId = id; ADM.tab = 'questions'; renderAdminShell(); }
        else if (btn.dataset.act === 'del') {
          const ok = await confirmDialog(t('delete_quiz_confirm'), t('delete'), t('delete'));
          if (!ok) return;
          try {
            await API.adminDeleteQuiz(ADM.token, id);
            toast(t('quiz_deleted'), 'success');
            if (ADM.quizId === id) ADM.quizId = '';
            renderTabQuizzes();
          } catch (e) { admError(e); }
        }
      });
    });
  } catch (e) {
    if (!body.isConnected) return;
    admError(e);
    if (e && e.code !== 'unauthorized') {
      body.innerHTML = `<div class="empty-state"><div class="big">⚠</div>${esc(e.message || t('error_generic'))}<div style="margin-top:14px"><button class="btn btn-ghost" onclick="renderTab()">${esc(t('retry'))}</button></div></div>`;
    }
  }
}

function openQuizForm(quiz) {
  const isNew = !quiz;
  const html = `
    <div class="modal-head">
      <div class="modal-title">${isNew ? '+ ' + esc(t('new_quiz')) : '✏ ' + esc(t('edit'))}</div>
      <button class="btn btn-ghost btn-sm btn-icon" data-close>✕</button>
    </div>
    <form id="quizForm">
      <div class="form-grid">
        <div class="field full">
          <label>${esc(t('quiz_title_ar'))} *</label>
          <input class="input" name="titleAR" required value="${esc(quiz ? quiz.titleAR : '')}">
        </div>
        <div class="field full">
          <label>${esc(t('quiz_desc_ar'))}</label>
          <textarea class="textarea" name="descAR" style="min-height:70px">${esc(quiz ? quiz.descAR : '')}</textarea>
        </div>
        <div class="field">
          <label>${esc(t('duration_label'))}</label>
          <input class="input" name="durationMin" type="number" min="0" max="600" value="${quiz ? Math.round((Number(quiz.durationSec) || 0) / 60) : 0}">
          <span class="hint">${esc(t('duration_hint'))}</span>
        </div>
        <div class="field">
          <label>&nbsp;</label>
          <label class="check-row"><input type="checkbox" name="showScore" ${!quiz || isTruthy(quiz.showScore) ? 'checked' : ''}> ${esc(t('show_score'))}</label>
          <label class="check-row"><input type="checkbox" name="active" ${!quiz || isTruthy(quiz.active) ? 'checked' : ''}> ${esc(t('active_label'))}</label>
        </div>
        <div class="field full">
          <label>${esc(t('grade_label'))}</label>
          ${ADM.grades.length ? `
            <select class="select" name="grade">
              <option value="">${esc(t('grade_all'))}</option>
              ${ADM.grades.map((g) => `<option value="${esc(g)}" ${quiz && String(quiz.grade || '') === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
            </select>` : `
            <input class="input" name="grade" maxlength="60" value="${esc(quiz ? quiz.grade || '' : '')}" placeholder="${esc(t('grade_all'))}">`}
          <span class="hint">${esc(t('quiz_grade_hint'))}</span>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close>${esc(t('cancel'))}</button>
        <button type="submit" class="btn btn-primary">${esc(t('save'))}</button>
      </div>
    </form>`;
  openModal(html, async (rootEl) => {
    rootEl.querySelector('#quizForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const payload = {
        quizId: quiz ? quiz.quizId : '',
        titleAR: f.titleAR.value.trim(),
        titleEN: '',
        descAR: f.descAR.value.trim(),
        descEN: '',
        durationSec: (Number(f.durationMin.value) || 0) * 60,
        showScore: f.showScore.checked,
        active: f.active.checked,
        grade: f.grade ? f.grade.value.trim() : ''
      };
      if (!payload.titleAR) { toast(t('required_field'), 'error'); return; }
      const btn = e.target.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        await API.adminSaveQuiz(ADM.token, payload);
        closeModal();
        toast(t('quiz_saved'), 'success');
        renderTabQuizzes();
      } catch (err) {
        btn.disabled = false;
        admError(err);
      }
    });
  });
}

/* ---------------- questions tab ---------------- */
async function renderTabQuestions() {
  const body = document.getElementById('admBody');
  if (!body) return;
  try {
    if (!ADM.quizzes.length) {
      const data = await API.adminOverview(ADM.token);
    if (!body.isConnected) return;
      ADM.quizzes = data.quizzes || [];
    }
    if (!ADM.quizzes.length) {
      body.innerHTML = `<div class="empty-state"><div class="big">🗂</div>${esc(t('no_quizzes_admin'))}</div>`;
      return;
    }
    if (!ADM.quizId || !ADM.quizzes.some((q) => q.quizId === ADM.quizId)) ADM.quizId = ADM.quizzes[0].quizId;
    const questions = await API.adminQuestions(ADM.token, ADM.quizId);
    if (!body.isConnected) return;
    const quiz = ADM.quizzes.find((q) => q.quizId === ADM.quizId);

    body.innerHTML = `
      <div class="toolbar">
        <div class="left">
          <select class="select" id="quizPick" style="width:auto; min-width:230px">
            ${ADM.quizzes.map((q) => `<option value="${esc(q.quizId)}" ${q.quizId === ADM.quizId ? 'selected' : ''}>${esc(quizTitle(q))}</option>`).join('')}
          </select>
          <span class="chip">📋 <strong>${questions.length}</strong> ${esc(t('questions_col'))}</span>
        </div>
        <div class="right"><button class="btn btn-primary" id="newQBtn">+ ${esc(t('new_question'))}</button></div>
      </div>
      <div id="qList">
        ${questions.length ? questions.map((q, i) => `
          <div class="q-admin-item">
            <div class="q-idx">${i + 1}</div>
            <div class="q-body">
              <div class="txt">${q.imageUrl ? '🖼 ' : ''}${esc(q.textAR || '')}</div>
              <div class="sub">
                ${esc(q.type === 'mcq' ? t('type_mcq') : q.type === 'tf' ? t('type_tf') : t('type_text'))}
                · ${esc(t('points_label'))}: ${Number(q.points) || 0}
                ${q.type === 'text' ? (String(q.correct || '').trim() ? '' : ' · ' + esc(t('pending_badge'))) : ''}
              </div>
            </div>
            <div class="cell-actions">
              <button class="btn btn-ghost btn-sm" data-edit="${esc(q.qId)}">${esc(t('edit'))}</button>
              <button class="btn btn-danger btn-sm" data-del="${esc(q.qId)}">${esc(t('delete'))}</button>
            </div>
          </div>`).join('')
        : `<div class="empty-state"><div class="big">✍</div>${esc(t('no_questions'))}</div>`}
      </div>
      <div class="toolbar" style="margin-top:16px">
        <div class="left"><span class="chip">🔗 ${esc(quiz ? quizTitle(quiz) : '')}</span></div>
        <div class="right"><button class="btn btn-ghost btn-sm" id="copyQ">🔗 ${esc(t('copy_link'))}</button></div>
      </div>`;

    document.getElementById('quizPick').addEventListener('change', (e) => {
      ADM.quizId = e.target.value;
      renderTabQuestions();
    });
    document.getElementById('newQBtn').addEventListener('click', () => openQuestionForm(null));
    const copyQ = document.getElementById('copyQ');
    if (copyQ) copyQ.addEventListener('click', () => copyText(quizLink(ADM.quizId)));
    els('[data-edit]').forEach((btn) => btn.addEventListener('click', () => {
      const q = questions.find((x) => x.qId === btn.dataset.edit);
      openQuestionForm(q);
    }));
    els('[data-del]').forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDialog(t('delete_question_confirm'), t('delete'), t('delete'));
      if (!ok) return;
      try {
        await API.adminDeleteQuestion(ADM.token, ADM.quizId, btn.dataset.del);
        toast(t('question_deleted'), 'success');
        renderTabQuestions();
      } catch (e) { admError(e); }
    }));
  } catch (e) {
    if (!body.isConnected) return;
    admError(e);
    if (e && e.code !== 'unauthorized') {
      body.innerHTML = `<div class="empty-state"><div class="big">⚠</div>${esc(e.message || t('error_generic'))}</div>`;
    }
  }
}

let qFormType = 'mcq';
let qFormOpts = [];
let qFormCorrect = 0;
let qFormImage = '';

function openQuestionForm(question) {
  const isNew = !question;
  qFormType = question ? question.type : 'mcq';
  qFormOpts = question && question.optionsAR && question.optionsAR.length
    ? question.optionsAR.map((s) => String(s))
    : ['', ''];
  if (question && question.type === 'tf') qFormOpts = ['', ''];
  qFormCorrect = question && question.type === 'mcq' ? (Number(question.correct) || 0) : 0;
  qFormImage = question ? String(question.imageUrl || '') : '';

  const html = `
    <div class="modal-head">
      <div class="modal-title">${isNew ? '+ ' + esc(t('new_question')) : '✏ ' + esc(t('edit'))}</div>
      <button class="btn btn-ghost btn-sm btn-icon" data-close>✕</button>
    </div>
    <form id="qForm">
      <div class="field">
        <label>${esc(t('type_label'))}</label>
        <select class="select" name="type" id="qType">
          <option value="mcq" ${qFormType === 'mcq' ? 'selected' : ''}>${esc(t('type_mcq'))}</option>
          <option value="tf" ${qFormType === 'tf' ? 'selected' : ''}>${esc(t('type_tf'))}</option>
          <option value="text" ${qFormType === 'text' ? 'selected' : ''}>${esc(t('type_text'))}</option>
        </select>
      </div>
      <div class="field">
        <label>${esc(t('q_text_ar'))} *</label>
        <textarea class="textarea" name="textAR" style="min-height:74px" required>${esc(question ? question.textAR : '')}</textarea>
      </div>
      <div id="typeArea"></div>
      <div class="field">
        <label>${esc(t('question_image'))}</label>
        <div class="qimg-row">
          <img id="qImgPreview" class="q-img-preview" alt="" ${qFormImage ? '' : 'hidden'}>
          <label class="btn btn-ghost btn-sm">
            📷 ${esc(t('add_question_image'))}
            <input type="file" id="qImgInput" accept="image/*" hidden>
          </label>
          <button type="button" class="btn btn-danger btn-sm" id="qImgRm" ${qFormImage ? '' : 'hidden'}>${esc(t('remove_image'))}</button>
        </div>
        <span class="hint">${esc(t('question_image_hint'))}</span>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>${esc(t('points_label'))} *</label>
          <input class="input" name="points" type="number" min="0" max="1000" required value="${question ? (Number(question.points) || 1) : 1}">
        </div>
        <div class="field">
          <label>${esc(t('order_label'))}</label>
          <input class="input" name="order" type="number" min="1" max="999" value="${question ? (Number(question.order) || 1) : ''}" placeholder="auto">
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close>${esc(t('cancel'))}</button>
        <button type="submit" class="btn btn-primary">${esc(t('save'))}</button>
      </div>
    </form>`;

  openModal(html, (rootEl) => {
    const renderTypeArea = () => {
      const area = rootEl.querySelector('#typeArea');
      if (qFormType === 'mcq') {
        area.innerHTML = `
          <div class="field">
            <label>${esc(t('options_label'))}</label>
            <div id="optRows"></div>
            <button type="button" class="btn btn-ghost btn-sm" id="addOpt">+ ${esc(t('add_option'))}</button>
          </div>`;
        const rows = rootEl.querySelector('#optRows');
        const paint = () => {
          rows.innerHTML = qFormOpts.map((o, i) => `
            <div class="option-edit-row">
              <label class="opt-pick"><input type="radio" name="correctOpt" value="${i}" ${qFormCorrect === i ? 'checked' : ''}> ${esc(t('correct_answer'))}</label>
              <input class="input" data-opt="${i}" placeholder="${esc(t('option_ar'))} ${i + 1}" value="${esc(o)}">
              ${qFormOpts.length > 2 ? `<button type="button" class="btn btn-danger btn-sm rm" data-rm="${i}">✕</button>` : ''}
            </div>`).join('');
          rows.querySelectorAll('[data-opt]').forEach((inp) => {
            inp.addEventListener('input', () => {
              qFormOpts[Number(inp.dataset.opt)] = inp.value;
            });
          });
          rows.querySelectorAll('[name="correctOpt"]').forEach((r) => {
            r.addEventListener('change', () => { qFormCorrect = Number(r.value); });
          });
          rows.querySelectorAll('[data-rm]').forEach((b) => {
            b.addEventListener('click', () => {
              const idx = Number(b.dataset.rm);
              qFormOpts.splice(idx, 1);
              if (qFormCorrect >= qFormOpts.length) qFormCorrect = 0;
              paint();
            });
          });
        };
        paint();
        rootEl.querySelector('#addOpt').addEventListener('click', () => {
          qFormOpts.push('');
          paint();
        });
      } else if (qFormType === 'tf') {
        const current = question && question.type === 'tf' ? String(question.correct) : 'true';
        area.innerHTML = `
          <div class="field">
            <label>${esc(t('correct_answer'))}</label>
            <select class="select" id="tfCorrect">
              <option value="true" ${current === 'true' ? 'selected' : ''}>✓ ${esc(t('tf_true'))}</option>
              <option value="false" ${current === 'false' ? 'selected' : ''}>✗ ${esc(t('tf_false'))}</option>
            </select>
          </div>`;
      } else {
        area.innerHTML = `
          <div class="field">
            <label>${esc(t('correct_answer'))} — ${esc(t('type_text'))}</label>
            <input class="input" id="textCorrect" value="${esc(question ? question.correct : '')}" placeholder="اكتب الإجابة النموذجية">
            <span class="hint">💡 ${esc(t('manual_grade_hint'))}</span>
          </div>`;
      }
    };
    renderTypeArea();

    const imgInput = rootEl.querySelector('#qImgInput');
    const imgPreview = rootEl.querySelector('#qImgPreview');
    const imgRm = rootEl.querySelector('#qImgRm');
    const setQImage = (url) => {
      qFormImage = url || '';
      if (qFormImage) {
        imgPreview.src = qFormImage;
        imgPreview.hidden = false;
        imgRm.hidden = false;
      } else {
        imgPreview.removeAttribute('src');
        imgPreview.hidden = true;
        imgRm.hidden = true;
      }
    };
    setQImage(qFormImage);
    imgInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) { toast(t('image_failed'), 'error'); return; }
      if (file.size > 12 * 1024 * 1024) { toast(t('image_failed'), 'error'); return; }
      toast(t('image_uploading'));
      try {
        const dataUrl = await compressImage(file);
        const up = await API.adminUploadQuestionImage(ADM.token, dataUrl);
        setQImage(up.url);
        toast(t('image_uploaded'), 'success');
      } catch (err) {
        toast(err.message || t('image_failed'), 'error');
      }
    });
    imgRm.addEventListener('click', () => setQImage(''));

    rootEl.querySelector('#qType').addEventListener('change', (e) => {
      qFormType = e.target.value;
      if (qFormType === 'tf') qFormOpts = ['', ''];
      renderTypeArea();
    });

    rootEl.querySelector('#qForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const payload = {
        qId: question ? question.qId : '',
        quizId: ADM.quizId,
        type: qFormType,
        textAR: f.textAR.value.trim(),
        points: Number(f.points.value) || 0,
        order: f.order.value ? Number(f.order.value) : 999,
        optionsAR: [],
        correct: '',
        imageUrl: qFormImage
      };
      if (!payload.textAR) { toast(t('required_field'), 'error'); return; }
      if (qFormType === 'mcq') {
        const filled = qFormOpts.filter((o) => o.trim());
        const correctOpt = qFormOpts[qFormCorrect];
        if (filled.length < 2 || !correctOpt || !correctOpt.trim()) {
          toast(t('options_min'), 'error');
          return;
        }
        payload.optionsAR = qFormOpts.slice();
        payload.correct = String(qFormCorrect);
      } else if (qFormType === 'tf') {
        payload.correct = rootEl.querySelector('#tfCorrect').value;
        payload.optionsAR = ['صح', 'خطأ'];
      } else {
        payload.correct = rootEl.querySelector('#textCorrect').value.trim();
      }
      const btn = f.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        await API.adminSaveQuestion(ADM.token, payload);
        closeModal();
        toast(t('question_saved'), 'success');
        renderTabQuestions();
      } catch (err) {
        btn.disabled = false;
        admError(err);
      }
    });
  });
}

/* ---------------- responses tab ---------------- */
async function renderTabResponses() {
  const body = document.getElementById('admBody');
  if (!body) return;
  try {
    if (!ADM.quizzes.length) {
      const data = await API.adminOverview(ADM.token);
    if (!body.isConnected) return;
      ADM.quizzes = data.quizzes || [];
    }
    if (!ADM.quizzes.length) {
      body.innerHTML = `<div class="empty-state"><div class="big">🗂</div>${esc(t('no_quizzes_admin'))}</div>`;
      return;
    }
    if (!ADM.quizId || !ADM.quizzes.some((q) => q.quizId === ADM.quizId)) ADM.quizId = ADM.quizzes[0].quizId;
    const quiz = ADM.quizzes.find((q) => q.quizId === ADM.quizId);
    const attempts = await API.adminAttempts(ADM.token, ADM.quizId);
    if (!body.isConnected) return;

    const scores = attempts.map((a) => {
      const max = Number(a.maxScore) || 0;
      return max > 0 ? (Number(a.totalScore) || 0) / max : 0;
    });
    const avg = scores.length ? Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 100) : 0;
    const highest = scores.length ? Math.round(Math.max(...scores) * 100) : 0;
    const lowest = scores.length ? Math.round(Math.min(...scores) * 100) : 0;

    body.innerHTML = `
      <div class="toolbar">
        <div class="left">
          <select class="select" id="quizPickR" style="width:auto; min-width:230px">
            ${ADM.quizzes.map((q) => `<option value="${esc(q.quizId)}" ${q.quizId === ADM.quizId ? 'selected' : ''}>${esc(quizTitle(q))}</option>`).join('')}
          </select>
        </div>
        <div class="right">
          <button class="btn btn-ghost btn-sm" id="csvBtn">${esc(t('export_csv'))}</button>
          <button class="btn btn-primary btn-sm" id="xlsBtn">⬇ ${esc(t('export_excel'))}</button>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="num">${attempts.length}</div><div class="lbl">${esc(t('stat_attempts'))}</div></div>
        <div class="stat-card"><div class="num">${avg}%</div><div class="lbl">${esc(t('stat_avg'))}</div></div>
        <div class="stat-card"><div class="num">${highest}%</div><div class="lbl">${esc(t('stat_highest'))}</div></div>
        <div class="stat-card"><div class="num">${lowest}%</div><div class="lbl">${esc(t('stat_lowest'))}</div></div>
      </div>
      ${attempts.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>${esc(t('student_col'))}</th>
                <th>${esc(t('status_col'))}</th>
                <th>${esc(t('score_col'))}</th>
                <th>${esc(t('time_col'))}</th>
                <th>${esc(t('date_col'))}</th>
                <th>${esc(t('actions_col'))}</th>
              </tr>
            </thead>
            <tbody>
              ${attempts.map((a, i) => {
                const max = Number(a.maxScore) || 0;
                const pct = max > 0 ? Math.round(((Number(a.totalScore) || 0) / max) * 100) : 0;
                const inProgress = a.status === 'in_progress';
                const statusBadge = inProgress
                  ? `<span class="badge badge-indigo">${esc(t('status_in_progress'))}</span>`
                  : a.reviewOpen
                    ? `<span class="badge badge-green">${esc(t('status_published'))}</span>`
                    : `<span class="badge badge-amber">${esc(t('status_submitted'))}</span>`;
                return `
                <tr${inProgress ? ' class="row-muted"' : ''}>
                  <td>${i + 1}</td>
                  <td style="font-weight:800">${esc(a.studentName)}</td>
                  <td>${statusBadge}</td>
                  <td>${inProgress ? '<span class="badge badge-muted">—</span>' : `<span class="score-pill"><b>${Number(a.totalScore) || 0}</b> / ${max} · ${pct}%</span>`}</td>
                  <td>${esc(fmtDur(a.timeTakenSec))}</td>
                  <td>${esc(fmtDate(a.submittedAt || a.startedAt))}</td>
                  <td>
                    <div class="cell-actions">
                      <button class="btn btn-ghost btn-sm" data-view="${esc(a.attemptId)}">👁 ${esc(t('view_col'))}</button>
                      ${!inProgress ? `<button class="btn btn-ghost btn-sm" data-pub="${esc(a.attemptId)}" data-open="${a.reviewOpen ? '0' : '1'}">${a.reviewOpen ? '🙈 ' + esc(t('unpublish_review')) : '📢 ' + esc(t('publish_review'))}</button>` : ''}
                      <button class="btn btn-ghost btn-sm" data-reopen="${esc(a.attemptId)}">🔄 ${esc(t('reopen_attempt'))}</button>
                      <button class="btn btn-danger btn-sm" data-delatt="${esc(a.attemptId)}">${esc(t('delete'))}</button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`
      : `<div class="empty-state"><div class="big">📭</div>${esc(t('no_attempts'))}</div>`}`;

    document.getElementById('quizPickR').addEventListener('change', (e) => {
      ADM.quizId = e.target.value;
      renderTabResponses();
    });
    document.getElementById('xlsBtn').addEventListener('click', () => exportQuizData(quiz, attempts, 'xlsx'));
    document.getElementById('csvBtn').addEventListener('click', () => exportQuizData(quiz, attempts, 'csv'));
    els('[data-view]').forEach((btn) => btn.addEventListener('click', () => openAttemptDetail(btn.dataset.view)));
    els('[data-pub]').forEach((btn) => btn.addEventListener('click', async () => {
      const open = btn.dataset.open === '1';
      btn.disabled = true;
      try {
        await API.adminToggleReview(ADM.token, btn.dataset.pub, open);
        toast(open ? t('published_toast') : t('unpublished_toast'), 'success');
        renderTabResponses();
      } catch (e) {
        btn.disabled = false;
        admError(e);
      }
    }));
    els('[data-reopen]').forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDialog(t('reopen_confirm'), t('reopen_attempt'), t('reopen_attempt'));
      if (!ok) return;
      try {
        await API.adminReopenAttempt(ADM.token, btn.dataset.reopen);
        toast(t('reopen_done'), 'success');
        renderTabResponses();
      } catch (e) { admError(e); }
    }));
    els('[data-delatt]').forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDialog(t('delete_attempt_confirm'), t('delete'), t('delete'));
      if (!ok) return;
      try {
        await API.adminDeleteAttempt(ADM.token, btn.dataset.delatt);
        toast(t('attempt_deleted'), 'success');
        renderTabResponses();
      } catch (e) { admError(e); }
    }));
  } catch (e) {
    if (!body.isConnected) return;
    admError(e);
    if (e && e.code !== 'unauthorized') {
      body.innerHTML = `<div class="empty-state"><div class="big">⚠</div>${esc(e.message || t('error_generic'))}</div>`;
    }
  }
}

function answerTextFor(r) {
  if (r.type === 'tf') {
    if (r.answer === 'true') return t('tf_true');
    if (r.answer === 'false') return t('tf_false');
    return '';
  }
  if (r.type === 'mcq') {
    const idx = Number(r.answer);
    const opts = r.optionsAR && r.optionsAR.length ? r.optionsAR : [];
    if (!isNaN(idx) && opts && opts[idx] !== undefined) return opts[idx];
    return r.answer;
  }
  return r.answer;
}

function correctTextFor(r) {
  if (r.type === 'tf') return r.correct === 'true' ? t('tf_true') : t('tf_false');
  if (r.type === 'mcq') {
    const idx = Number(r.correct);
    const opts = r.optionsAR && r.optionsAR.length ? r.optionsAR : [];
    if (!isNaN(idx) && opts && opts[idx] !== undefined) return opts[idx];
    return r.correct;
  }
  return String(r.correct || '').trim() || '—';
}

async function openAttemptDetail(attemptId) {
  let detail;
  try {
    detail = await API.adminAttemptDetail(ADM.token, attemptId);
  } catch (e) {
    admError(e);
    return;
  }
  const { attempt, responses } = detail;
  const inProgress = attempt.status === 'in_progress';
  const html = `
    <div class="modal-head">
      <div class="modal-title">👁 ${esc(t('detail_title'))} — ${esc(attempt.studentName)}</div>
      <button class="btn btn-ghost btn-sm btn-icon" data-close>✕</button>
    </div>
    <div class="meta-row" style="justify-content:flex-start; margin-block:0 16px">
      ${inProgress
        ? `<span class="badge badge-indigo">${esc(t('status_in_progress'))}</span><span class="chip">${esc(t('attempt_note_open'))}</span>`
        : `<span class="badge ${attempt.reviewOpen ? 'badge-green' : 'badge-amber'}">${esc(attempt.reviewOpen ? t('status_published') : t('status_submitted'))}</span>`}
      <span class="chip">${esc(t('score_col'))}: <strong>${Number(attempt.totalScore) || 0} / ${Number(attempt.maxScore) || 0}</strong></span>
      <span class="chip">${esc(t('time_col'))}: <strong>${esc(fmtDur(attempt.timeTakenSec))}</strong></span>
      <span class="chip">${esc(t('date_col'))}: <strong>${esc(fmtDate(attempt.submittedAt || attempt.startedAt))}</strong></span>
    </div>
    <div id="answerBlocks">
      ${responses.map((r, i) => `
        <div class="answer-block" data-rid="${esc(r.rId)}">
          <div class="ab-q">${i + 1}. ${esc(qTextFor(r))}</div>
          ${r.imageUrl ? driveImgHtml(r.imageUrl) : ''}
          <div class="ab-line"><span class="k">${esc(t('your_answer'))}</span><span class="v">${esc(answerTextFor(r) || t('not_answered'))}</span></div>
          ${r.images && r.images.length ? `
            <div class="review-imgs">${r.images.map((im) => `<a href="${esc(im.url)}" target="_blank" rel="noopener">${driveImgHtml(im.url, 'review-img')}</a>`).join('')}
              <div class="hint">📷 ${esc(t('images_label'))}</div>
            </div>` : ''}
          <div class="ab-line"><span class="k">${esc(t('correct_is'))}</span><span class="v">${esc(correctTextFor(r))}</span></div>
          <div class="ab-line"><span class="k">${esc(t('grade_points'))}</span><span class="v">
            <span class="score-pill"><b class="pts-label">${Number(r.points) || 0}</b> / ${Number(r.maxPoints) || 0}</span>
            ${r.gradedBy === 'auto' ? `<span class="badge badge-green">${esc(t('graded_auto'))}</span>` : r.gradedBy === 'teacher' ? `<span class="badge badge-indigo">${esc(t('graded_teacher'))}</span>` : `<span class="badge badge-amber">${esc(t('pending_badge'))}</span>`}
          </span></div>
          <div class="grade-row">
            <label class="hint" style="font-weight:700">${esc(t('grade_points'))}</label>
            <input class="input grade-input" type="number" min="0" max="${Number(r.maxPoints) || 0}" step="0.5" value="${Number(r.points) || 0}">
            <button class="btn btn-primary btn-sm save-grade">${esc(t('save_grade'))}</button>
          </div>
        </div>`).join('')}
    </div>
    <div class="modal-actions">
      ${!inProgress ? `<button class="btn btn-ghost" id="modalPub">${attempt.reviewOpen ? '🙈 ' + esc(t('unpublish_review')) : '📢 ' + esc(t('publish_review'))}</button>` : ''}
      <button class="btn btn-ghost" id="modalReopen">🔄 ${esc(t('reopen_attempt'))}</button>
      <button class="btn btn-primary" data-close>${esc(t('close'))}</button>
    </div>`;

  openModal(html, (rootEl) => {
    const pubBtn = rootEl.querySelector('#modalPub');
    if (pubBtn) pubBtn.addEventListener('click', async () => {
      const open = !attempt.reviewOpen;
      pubBtn.disabled = true;
      try {
        await API.adminToggleReview(ADM.token, attempt.attemptId, open);
        toast(open ? t('published_toast') : t('unpublished_toast'), 'success');
        closeModal();
        openAttemptDetail(attemptId);
        renderTabResponsesBehind();
      } catch (e) {
        pubBtn.disabled = false;
        admError(e);
      }
    });
    rootEl.querySelector('#modalReopen').addEventListener('click', async () => {
      const ok = await confirmDialog(t('reopen_confirm'), t('reopen_attempt'), t('reopen_attempt'));
      if (!ok) return;
      try {
        await API.adminReopenAttempt(ADM.token, attempt.attemptId);
        toast(t('reopen_done'), 'success');
        closeModal();
        renderTabResponsesBehind();
      } catch (e) { admError(e); }
    });
    rootEl.querySelectorAll('.save-grade').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const block = btn.closest('.answer-block');
        const rId = block.dataset.rid;
        const points = Number(block.querySelector('.grade-input').value) || 0;
        btn.disabled = true;
        try {
          await API.adminGrade(ADM.token, rId, points);
          toast(t('grade_saved'), 'success');
          closeModal();
          openAttemptDetail(attemptId);
          renderTabResponsesBehind();
        } catch (e) {
          btn.disabled = false;
          admError(e);
        }
      });
    });
  });
}

function renderTabResponsesBehind() {
  if (ADM.tab === 'responses') {
    const body = document.getElementById('admBody');
    if (body) renderTabResponses();
  }
}

function qTextFor(r) {
  return r.textAR || '';
}

/* ---------------- export ---------------- */
function csvDownload(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => {
    const s = String(cell == null ? '' : cell);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportQuizData(quiz, attempts, format) {
  if (!attempts.length) { toast(t('no_attempts'), 'error'); return; }
  const summary = attempts.map((a, i) => {
    const max = Number(a.maxScore) || 0;
    return {
      '#': i + 1,
      'الطالب': a.studentName,
      'الحالة': a.status === 'in_progress' ? 'جارٍ الحل' : (a.reviewOpen ? 'منشورة' : 'مسلَّمة'),
      'الدرجة': Number(a.totalScore) || 0,
      'الدرجة القصوى': max,
      'النسبة': max > 0 ? Math.round(((Number(a.totalScore) || 0) / max) * 100) + '%' : '',
      'المدة': fmtDur(a.timeTakenSec),
      'تاريخ التسليم': fmtDate(a.submittedAt),
      'رقم المحاولة': a.attemptId
    };
  });
  const answers = [];
  for (const a of attempts) {
    try {
      const d = await API.adminAttemptDetail(ADM.token, a.attemptId);
      d.responses.forEach((r, i) => {
        answers.push({
          'الطالب': a.studentName,
          'سؤال #': i + 1,
          'السؤال': r.textAR || '',
          'إجابة الطالب': answerTextFor(r) || '',
          'الإجابة النموذجية': correctTextFor(r),
          'النقاط': Number(r.points) || 0,
          'النقاط القصوى': Number(r.maxPoints) || 0,
          'التصحيح': r.gradedBy === 'teacher' ? 'يدوي' : (r.gradedBy === 'auto' ? 'تلقائي' : 'تحت التصحيح')
        });
      });
    } catch (e) { }
  }
  const safeName = String(quizTitle(quiz) || 'quiz').replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim().replace(/\s+/g, '_') || 'quiz';

  if (format === 'csv' || typeof XLSX === 'undefined') {
    csvDownload(safeName + '_attempts.csv', [
      Object.keys(summary[0]),
      ...summary.map((r) => Object.values(r))
    ]);
    if (typeof XLSX === 'undefined') toast(t('xlsx_fallback'), 'error');
    else toast(t('export_done'), 'success');
    return;
  }

  try {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'المحاولات');
    if (answers.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(answers), 'الإجابات');
    XLSX.writeFile(wb, safeName + '.xlsx');
    toast(t('export_done'), 'success');
  } catch (e) {
    csvDownload(safeName + '_attempts.csv', [
      Object.keys(summary[0]),
      ...summary.map((r) => Object.values(r))
    ]);
    toast(t('xlsx_fallback'), 'error');
  }
}

/* ---------------- students tab ---------------- */
async function renderTabStudents() {
  const body = document.getElementById('admBody');
  if (!body) return;
  try {
    const data = await API.adminStudents(ADM.token);
    if (!body.isConnected) return;
    const students = data.students || [];
    const code = String(data.registrationCode || '');
    ADM.grades = data.grades || [];
    body.innerHTML = `
      <div class="card" style="margin-block-end:18px">
        <div class="modal-title" style="margin-block-end:6px">🎒 ${esc(t('grades_label'))}</div>
        <p class="hint" style="margin-block-end:12px">${esc(t('grades_hint'))}</p>
        <div class="code-row">
          <textarea class="textarea" id="gradesInput" style="min-height:80px; flex:1" placeholder="${esc(t('grade_ph'))}">${esc(ADM.grades.join('\n'))}</textarea>
          <button class="btn btn-primary btn-sm" id="saveGrades">${esc(t('save'))}</button>
        </div>
      </div>
      <div class="card" style="margin-block-end:18px">
        <div class="modal-title" style="margin-block-end:6px">🔑 ${esc(t('reg_code_label'))}</div>
        <p class="hint" style="margin-block-end:12px">${esc(t('reg_code_hint2'))}</p>
        <div class="code-row">
          <input class="input" id="regCodeInput" maxlength="32" value="${esc(code)}" placeholder="${esc(t('reg_code_hint'))}" style="max-width:260px">
          <button class="btn btn-primary btn-sm" id="saveRegCode">${esc(t('save'))}</button>
          ${code ? `<button class="btn btn-ghost btn-sm" id="copyRegCode">📋 ${esc(t('copy_reg_code'))}</button>` : ''}
        </div>
      </div>
      <div class="toolbar">
        <div class="left"><span class="chip">👥 <strong>${students.length}</strong> ${esc(t('tab_students'))}</span></div>
      </div>
      ${students.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>${esc(t('username_col'))}</th>
                <th>${esc(t('student_col'))}</th>
                <th>${esc(t('grade_col'))}</th>
                <th>${esc(t('attempts_col'))}</th>
                <th>${esc(t('created_col'))}</th>
                <th>${esc(t('actions_col'))}</th>
              </tr>
            </thead>
            <tbody>
              ${students.map((s) => `
                <tr>
                  <td><span class="badge badge-indigo">${esc(s.username)}</span></td>
                  <td style="font-weight:800">${esc(s.displayName)}</td>
                  <td>${s.grade ? `<span class="chip">🎒 ${esc(s.grade)}</span>` : '<span class="badge badge-muted">—</span>'}</td>
                  <td><span class="badge badge-muted">${Number(s.attemptCount) || 0}</span></td>
                  <td>${esc(fmtDate(s.createdAt))}</td>
                  <td>
                    <div class="cell-actions">
                      <button class="btn btn-danger btn-sm" data-delstu="${esc(s.studentId)}">${esc(t('delete'))}</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`
      : `<div class="empty-state"><div class="big">👥</div>${esc(t('no_students'))}</div>`}`;

    document.getElementById('saveGrades').addEventListener('click', async () => {
      const value = document.getElementById('gradesInput').value;
      const list = value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      try {
        const saved = await API.adminSetGrades(ADM.token, list);
        ADM.grades = Array.isArray(saved) ? saved : list;
        toast(t('grades_saved'), 'success');
        renderTabStudents();
      } catch (e) { admError(e); }
    });
    document.getElementById('saveRegCode').addEventListener('click', async () => {
      const value = document.getElementById('regCodeInput').value.trim();
      try {
        await API.adminSetRegistrationCode(ADM.token, value);
        toast(t('reg_code_saved'), 'success');
        renderTabStudents();
      } catch (e) { admError(e); }
    });
    const copyCode = document.getElementById('copyRegCode');
    if (copyCode) copyCode.addEventListener('click', () => copyText(code));
    els('[data-delstu]').forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDialog(t('delete_student_confirm'), t('delete'), t('delete'));
      if (!ok) return;
      try {
        await API.adminDeleteStudent(ADM.token, btn.dataset.delstu);
        toast(t('student_deleted'), 'success');
        renderTabStudents();
      } catch (e) { admError(e); }
    }));
  } catch (e) {
    if (!body.isConnected) return;
    admError(e);
    if (e && e.code !== 'unauthorized') {
      body.innerHTML = `<div class="empty-state"><div class="big">⚠</div>${esc(e.message || t('error_generic'))}</div>`;
    }
  }
}

/* ---------------- settings tab ---------------- */
function renderTabSettings() {
  const body = document.getElementById('admBody');
  body.innerHTML = `
    <div class="card" style="max-width:560px">
      <div class="modal-title" style="margin-block-end:16px">🔑 ${esc(t('change_pin_title'))}</div>
      <form id="pinChangeForm">
        <div class="field">
          <label>${esc(t('current_pin'))}</label>
          <input class="input" name="oldPin" type="password" inputmode="numeric" required autocomplete="off">
        </div>
        <div class="field">
          <label>${esc(t('new_pin'))}</label>
          <input class="input" name="newPin" type="password" inputmode="numeric" required autocomplete="off">
        </div>
        <div class="field">
          <label>${esc(t('confirm_pin'))}</label>
          <input class="input" name="confirmPin" type="password" inputmode="numeric" required autocomplete="off">
        </div>
        <button class="btn btn-primary" type="submit">${esc(t('save'))}</button>
      </form>
    </div>
    ${API.isLocal() ? `
      <div class="card" style="max-width:560px; margin-top:18px">
        <div class="modal-title" style="margin-block-end:10px">🧪 وضع تجريبي</div>
        <p style="color:var(--muted); font-weight:600; font-size:14.5px; margin-block-end:14px">${esc(t('setup_needed'))}</p>
        <button class="btn btn-danger btn-sm" id="resetDemo">${esc(t('demo_reset'))}</button>
      </div>` : ''}`;

  document.getElementById('pinChangeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const oldPin = f.oldPin.value.trim();
    const newPin = f.newPin.value.trim();
    const confirmPin = f.confirmPin.value.trim();
    if (newPin.length < 4) { toast(t('pin_short'), 'error'); return; }
    if (newPin !== confirmPin) { toast(t('pin_mismatch'), 'error'); return; }
    const btn = f.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await API.adminChangePin(ADM.token, oldPin, newPin);
      toast(t('pin_changed'), 'success');
      f.reset();
    } catch (err) {
      admError(err);
    } finally {
      btn.disabled = false;
    }
  });

  const reset = document.getElementById('resetDemo');
  if (reset) {
    reset.addEventListener('click', async () => {
      try {
        await API.adminResetLocal(ADM.token);
        toast(t('demo_reset_done'), 'success');
        ADM.quizId = '';
        ADM.quizzes = [];
      } catch (e) { admError(e); }
    });
  }
}
