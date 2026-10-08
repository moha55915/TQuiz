const API = (() => {
  const LOCAL = () => !CONFIG.apiUrl || !/^https?:\/\//.test(CONFIG.apiUrl);
  const STOKEN_KEY = 'qp_stoken';

  const SERVER_ERR = {
    username_taken: 'err_username_taken',
    username_invalid: 'err_username_invalid',
    password_short: 'err_password_short',
    name_short: 'err_name_short',
    wrong_credentials: 'err_wrong_credentials',
    code_wrong: 'err_code_wrong',
    account_disabled: 'err_account_disabled',
    'already submitted': 'already_submitted',
    'attempt_note_open': 'attempt_note_open',
    'image max': 'image_max',
    'image too large': 'image_failed',
    'bad image': 'image_failed',
    'quiz not found': 'quiz_not_found',
    'grade_required': 'grade_required',
    'not_your_grade': 'err_not_your_grade',
    'unknown action': 'error_generic'
  };

  function translate(e) {
    if (!e) return e;
    if (e.code === 'unauthorized') return e;
    if (e.message === 'unauthorized') {
      const err = new Error(t('unauthorized'));
      err.code = 'unauthorized';
      return err;
    }
    const mapped = SERVER_ERR[e.message];
    if (mapped) {
      const err = new Error(t(mapped));
      err.code = e.message;
      return err;
    }
    return e;
  }

  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem('qp_' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function lsSet(key, value) {
    localStorage.setItem('qp_' + key, JSON.stringify(value));
  }

  function uid() {
    if (self.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function sToken() {
    return localStorage.getItem(STOKEN_KEY) || '';
  }

  function setSToken(token) {
    if (token) localStorage.setItem(STOKEN_KEY, token);
    else localStorage.removeItem(STOKEN_KEY);
  }

  function normalizeAnswer(s) {
    return String(s == null ? '' : s)
      .trim()
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ');
  }

  function seedLocal() {
    if (Number(lsGet('seedVersion', 0)) >= 4) return;
    const quizId = 'demo-quiz-1';
    lsSet('quizzes', [{
      quizId,
      titleAR: 'اختبار تجريبي — معلومات عامة',
      titleEN: 'Demo Quiz — General Knowledge',
      descAR: 'كويز صغير يوضّح شكل الصفحة عند الطالب. جرّبه دلوقتي!',
      descEN: 'A small quiz that shows what students will see. Try it now!',
      durationSec: 300,
      showScore: '1',
      active: '1',
      createdAt: nowIso()
    }]);
    const qs = [
      {
        qId: uid(), quizId, type: 'mcq', order: 1, points: 2,
        textAR: 'ما عاصمة فرنسا؟',
        optionsAR: ['لندن', 'باريس', 'برلين', 'روما'],
        correct: '1'
      },
      {
        qId: uid(), quizId, type: 'tf', order: 2, points: 1,
        textAR: 'الأرض تدور حول الشمس.',
        optionsAR: ['صح', 'خطأ'],
        correct: 'true'
      },
      {
        qId: uid(), quizId, type: 'text', order: 3, points: 2,
        textAR: 'ما أكبر محيط في العالم؟',
        optionsAR: [],
        correct: 'المحيط الهادئ'
      },
      {
        qId: uid(), quizId, type: 'text', order: 4, points: 5,
        textAR: 'اشرح بإيجاز الفرق بين HTML و CSS.',
        optionsAR: [],
        correct: ''
      }
    ];
    lsSet('questions', qs);
    const mk = (name, answers) => {
      const attemptId = uid();
      let total = 0, max = 0;
      const responses = qs.map((q, i) => {
        const pts = Number(q.points) || 0;
        max += pts;
        const given = answers[i];
        let isCorrect = '', awarded = 0, gradedBy = 'auto';
        if (q.type === 'text') {
          if (String(q.correct || '').trim()) {
            isCorrect = normalizeAnswer(given) === normalizeAnswer(q.correct) ? '1' : '0';
            awarded = isCorrect === '1' ? pts : 0;
          } else {
            gradedBy = 'pending';
          }
        } else {
          isCorrect = String(given) === String(q.correct) ? '1' : '0';
          awarded = isCorrect === '1' ? pts : 0;
        }
        total += awarded;
        return {
          rId: uid(), attemptId, quizId, studentName: name, qId: q.qId,
          questionText: q.textAR, answer: given || '', isCorrect,
          points: awarded, maxPoints: pts, gradedBy
        };
      });
      return {
        attempt: {
          attemptId, quizId, studentName: name, totalScore: total, maxScore: max,
          startedAt: nowIso(), submittedAt: nowIso(), timeTakenSec: 60 + Math.floor(Math.random() * 120),
          studentId: '', status: 'submitted', reviewOpen: '1', gradedAt: nowIso()
        },
        responses
      };
    };
    const a1 = mk('أحمد محمد', ['باريس', 'true', 'المحيط الهادئ', 'HTML هي بنية الصفحة و CSS هي شكلها']);
    const a2 = mk('Sara Ali', ['لندن', 'true', 'المحيط الهادئ', '']);
    const a3 = mk('مريم خالد', ['باريس', 'false', '', '']);
    a3.attempt.reviewOpen = '0';
    lsSet('attempts', [a1.attempt, a2.attempt, a3.attempt]);
    lsSet('responses', [...a1.responses, ...a2.responses, ...a3.responses]);
    lsSet('students', [{
      studentId: 'demo-student', username: 'demo', usernameKey: 'demo',
      displayName: 'طالب تجريبي', grade: 'الصف الأول الإعدادي', password: 'demo1234', createdAt: nowIso(), active: '1'
    }]);
    lsSet('sessions', []);
    lsSet('uploads', []);
    lsSet('settings', {
      pin: '1234',
      registrationCode: '',
      grades: 'الصف الثاني الابتدائي,الصف الثالث الابتدائي,الصف الرابع الابتدائي,الصف الخامس الابتدائي,الصف السادس الابتدائي,الصف الأول الإعدادي,الصف الثاني الإعدادي,الصف الثالث الإعدادي'
    });
    lsSet('seedVersion', 4);
  }

  function localTokenOk(payload) {
    return payload && payload.token === 'local-admin';
  }

  function localStudent(payload) {
    const token = payload && payload.token;
    if (!token) throw new Error('unauthorized');
    const sessions = lsGet('sessions', []);
    const session = sessions.find((s) => s.token === token);
    if (!session) throw new Error('unauthorized');
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      lsSet('sessions', sessions.filter((s) => s.token !== token));
      throw new Error('unauthorized');
    }
    const student = lsGet('students', []).find((s) => s.studentId === session.studentId);
    if (!student) throw new Error('unauthorized');
    if (String(student.active) !== '1') throw new Error('account_disabled');
    return student;
  }

  function localPublicStudent(s) {
    return { studentId: s.studentId, username: s.username, displayName: s.displayName, grade: String(s.grade || '').trim(), createdAt: s.createdAt };
  }

  function localAttemptStatus(a) {
    if (a.status === 'in_progress' || a.status === 'submitted') return a.status;
    return a.submittedAt ? 'submitted' : 'in_progress';
  }

  function localRemaining(attempt, durationSec) {
    if (!durationSec) return -1;
    const started = new Date(attempt.startedAt).getTime();
    if (isNaN(started)) return -1;
    return Math.max(0, Math.round(durationSec - (Date.now() - started) / 1000));
  }

  function localPublicQuestions(quizId) {
    return lsGet('questions', [])
      .filter((q) => q.quizId === quizId)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map(({ correct, ...rest }) => rest);
  }

  function localUploadsFor(attemptId, qId) {
    return lsGet('uploads', [])
      .filter((u) => u.attemptId === attemptId && (!qId || u.qId === qId))
      .map((u) => ({ uploadId: u.uploadId, url: u.dataUrl, fileName: u.fileName }));
  }

  async function localRequest(action, payload) {
    seedLocal();
    await new Promise((r) => setTimeout(r, 90));
    const quizzes = () => lsGet('quizzes', []);
    const questions = () => lsGet('questions', []);
    const attempts = () => lsGet('attempts', []);
    const responses = () => lsGet('responses', []);
    const students = () => lsGet('students', []);
    const auth = () => {
      if (!localTokenOk(payload)) throw new Error('unauthorized');
    };
    const settings = () => lsGet('settings', { pin: '1234', registrationCode: '', grades: '' });
    const DEFAULT_GRADES = ['الصف الثاني الابتدائي', 'الصف الثالث الابتدائي', 'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي', 'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'];
    const gradesList = () => {
      const list = String(settings().grades || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      return list.length ? list : DEFAULT_GRADES.slice();
    };
    const quizVisibleToGrade = (q, myGrade) => {
      const g = String(q.grade || '').trim();
      if (!g) return true;
      return Boolean(myGrade) && g === myGrade;
    };

    switch (action) {
      case 'getQuizzes':
        return quizzes().filter((q) => String(q.active) === '1' && !String(q.grade || '').trim()).map((q) => ({ ...q }));
      case 'getQuiz': {
        const quiz = quizzes().find((q) => q.quizId === payload.id);
        if (!quiz) throw new Error('quiz not found');
        return {
          quiz: { ...quiz },
          questionCount: questions().filter((q) => q.quizId === payload.id).length
        };
      }
      case 'authInfo':
        return { codeRequired: Boolean(String(settings().registrationCode || '').trim()), grades: gradesList() };
      case 'register': {
        const username = String(payload.username || '').trim();
        const password = String(payload.password || '');
        const displayName = String(payload.displayName || '').trim();
        const code = String(payload.code || '').trim();
        const grade = String(payload.grade || '').trim().slice(0, 60);
        if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username)) throw new Error('username_invalid');
        if (password.length < 4) throw new Error('password_short');
        if (displayName.length < 2) throw new Error('name_short');
        if (!grade) throw new Error('grade_required');
        const regCode = String(settings().registrationCode || '').trim();
        if (regCode && code !== regCode) throw new Error('code_wrong');
        const key = username.toLowerCase();
        if (students().some((s) => s.usernameKey === key)) throw new Error('username_taken');
        const student = {
          studentId: uid(), username, usernameKey: key, displayName: displayName.slice(0, 60), grade,
          password, createdAt: nowIso(), active: '1'
        };
        lsSet('students', [...students(), student]);
        const token = uid();
        lsSet('sessions', [...lsGet('sessions', []), { token, studentId: student.studentId, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }]);
        return { token, student: localPublicStudent(student) };
      }
      case 'login': {
        const key = String(payload.username || '').trim().toLowerCase();
        const student = students().find((s) => s.usernameKey === key);
        if (!student) throw new Error('wrong_credentials');
        if (String(student.active) !== '1') throw new Error('account_disabled');
        if (String(student.password) !== String(payload.password || '')) throw new Error('wrong_credentials');
        const token = uid();
        lsSet('sessions', [...lsGet('sessions', []), { token, studentId: student.studentId, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }]);
        return { token, student: localPublicStudent(student) };
      }
      case 'logout': {
        lsSet('sessions', lsGet('sessions', []).filter((s) => s.token !== payload.token));
        return true;
      }
      case 'studentMe':
        return { student: localPublicStudent(localStudent(payload)) };
      case 'studentUpdateProfile': {
        const student = localStudent(payload);
        const displayName = String(payload.displayName || '').trim();
        if (displayName.length < 2) throw new Error('name_short');
        lsSet('students', students().map((s) => s.studentId === student.studentId ? { ...s, displayName: displayName.slice(0, 60) } : s));
        return { displayName: displayName.slice(0, 60) };
      }
      case 'studentHome': {
        const student = localStudent(payload);
        const mine = attempts().filter((a) => a.studentId === student.studentId);
        const myGrade = String(student.grade || '').trim();
        return {
          student: localPublicStudent(student),
          quizzes: quizzes().filter((q) => String(q.active) === '1' && quizVisibleToGrade(q, myGrade)).map((q) => {
            const attempt = mine.find((a) => a.quizId === q.quizId);
            return {
              quiz: { ...q },
              questionCount: questions().filter((x) => x.quizId === q.quizId).length,
              attempt: attempt ? {
                attemptId: attempt.attemptId,
                status: localAttemptStatus(attempt),
                reviewOpen: String(attempt.reviewOpen) === '1',
                totalScore: Number(attempt.totalScore) || 0,
                maxScore: Number(attempt.maxScore) || 0,
                submittedAt: attempt.submittedAt || ''
              } : null
            };
          })
        };
      }
      case 'beginAttempt': {
        const student = localStudent(payload);
        const quiz = quizzes().find((q) => q.quizId === payload.quizId);
        if (!quiz || String(quiz.active) !== '1') throw new Error('quiz not found');
        if (!quizVisibleToGrade(quiz, String(student.grade || '').trim())) throw new Error('not_your_grade');
        const existing = attempts().find((a) => a.quizId === quiz.quizId && a.studentId === student.studentId);
        const durationSec = Number(quiz.durationSec) || 0;
        if (existing) {
          const status = localAttemptStatus(existing);
          if (status === 'submitted') {
            return {
              status: 'submitted', attemptId: existing.attemptId,
              reviewOpen: String(existing.reviewOpen) === '1',
              totalScore: Number(existing.totalScore) || 0, maxScore: Number(existing.maxScore) || 0,
              showScore: quiz.showScore
            };
          }
          return {
            status: 'in_progress', attemptId: existing.attemptId, startedAt: existing.startedAt,
            remainingSec: localRemaining(existing, durationSec), durationSec,
            questions: localPublicQuestions(quiz.quizId), quiz: { ...quiz }
          };
        }
        const attempt = {
          attemptId: uid(), quizId: quiz.quizId, studentName: student.displayName,
          totalScore: 0, maxScore: 0, startedAt: nowIso(), submittedAt: '', timeTakenSec: 0,
          studentId: student.studentId, status: 'in_progress', reviewOpen: '0', gradedAt: ''
        };
        lsSet('attempts', [...attempts(), attempt]);
        return {
          status: 'created', attemptId: attempt.attemptId, startedAt: attempt.startedAt,
          remainingSec: durationSec > 0 ? durationSec : -1, durationSec,
          questions: localPublicQuestions(quiz.quizId), quiz: { ...quiz }
        };
      }
      case 'submitAttempt': {
        const student = localStudent(payload);
        const attempt = attempts().find((a) => a.attemptId === payload.attemptId);
        if (!attempt || attempt.studentId !== student.studentId) throw new Error('not found');
        if (localAttemptStatus(attempt) === 'submitted') throw new Error('already submitted');
        const quiz = quizzes().find((q) => q.quizId === attempt.quizId);
        if (!quiz) throw new Error('quiz not found');
        const qs = questions().filter((q) => q.quizId === attempt.quizId);
        const given = Array.isArray(payload.answers) ? payload.answers : [];
        let total = 0, max = 0, correct = 0, wrong = 0, pending = 0;
        const rows = qs.map((q) => {
          const pts = Number(q.points) || 0;
          max += pts;
          const match = given.find((a) => a.qId === q.qId);
          const ans = match ? String(match.answer || '') : '';
          let isCorrect = '', awarded = 0, gradedBy = 'auto';
          if (q.type === 'text') {
            if (String(q.correct || '').trim()) {
              isCorrect = normalizeAnswer(ans) === normalizeAnswer(q.correct) ? '1' : '0';
              awarded = isCorrect === '1' ? pts : 0;
              isCorrect === '1' ? correct++ : wrong++;
            } else {
              gradedBy = 'pending';
              pending++;
            }
          } else {
            isCorrect = ans !== '' && ans === String(q.correct) ? '1' : '0';
            awarded = isCorrect === '1' ? pts : 0;
            isCorrect === '1' ? correct++ : wrong++;
          }
          total += awarded;
          return {
            rId: uid(), attemptId: attempt.attemptId, quizId: quiz.quizId, studentName: attempt.studentName,
            qId: q.qId, questionText: q.textAR, answer: ans, isCorrect,
            points: awarded, maxPoints: pts, gradedBy
          };
        });
        lsSet('attempts', attempts().map((a) => a.attemptId === attempt.attemptId ? {
          ...a, status: 'submitted', totalScore: total, maxScore: max,
          submittedAt: nowIso(), timeTakenSec: Number(payload.timeTakenSec) || 0
        } : a));
        lsSet('responses', [...responses(), ...rows]);
        return {
          attemptId: attempt.attemptId, totalScore: total, maxScore: max,
          correct, wrong, pending, showScore: quiz.showScore
        };
      }
      case 'studentReview': {
        const student = localStudent(payload);
        const quiz = quizzes().find((q) => q.quizId === payload.quizId);
        if (!quiz) throw new Error('quiz not found');
        const attempt = attempts().find((a) => a.quizId === quiz.quizId && a.studentId === student.studentId);
        if (!attempt) return { status: 'none' };
        const status = localAttemptStatus(attempt);
        if (status === 'in_progress') return { status: 'in_progress', attemptId: attempt.attemptId };
        const base = {
          status: 'submitted', attemptId: attempt.attemptId,
          reviewOpen: String(attempt.reviewOpen) === '1',
          totalScore: Number(attempt.totalScore) || 0, maxScore: Number(attempt.maxScore) || 0,
          submittedAt: attempt.submittedAt || '', timeTakenSec: Number(attempt.timeTakenSec) || 0,
          showScore: quiz.showScore, quiz: { ...quiz }
        };
        if (!base.reviewOpen) return base;
        const rs = responses().filter((r) => r.attemptId === attempt.attemptId);
        base.questions = questions()
          .filter((q) => q.quizId === quiz.quizId)
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
          .map((q) => {
            const r = rs.find((x) => x.qId === q.qId);
            return {
              qId: q.qId, type: q.type, textAR: q.textAR,
              optionsAR: q.optionsAR || [],
              correct: q.correct == null ? '' : String(q.correct),
              maxPoints: Number(q.points) || 0,
              imageUrl: q.imageUrl || '',
              answer: r ? String(r.answer || '') : '',
              isCorrect: r ? String(r.isCorrect || '') : '',
              points: r ? Number(r.points) || 0 : 0,
              gradedBy: r ? r.gradedBy : 'pending',
              images: localUploadsFor(attempt.attemptId, q.qId)
            };
          });
        return base;
      }
      case 'uploadImage': {
        const student = localStudent(payload);
        const attempt = attempts().find((a) => a.attemptId === payload.attemptId);
        if (!attempt || attempt.studentId !== student.studentId) throw new Error('not found');
        if (localAttemptStatus(attempt) !== 'in_progress') throw new Error('already submitted');
        const q = questions().find((x) => x.qId === payload.qId && x.quizId === attempt.quizId);
        if (!q || q.type !== 'text') throw new Error('not found');
        const dataUrl = String(payload.dataUrl || '');
        if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(dataUrl)) throw new Error('bad image');
        const same = lsGet('uploads', []).filter((u) => u.attemptId === attempt.attemptId && u.qId === payload.qId);
        if (same.length >= 4) throw new Error('image max');
        const upload = {
          uploadId: uid(), attemptId: attempt.attemptId, quizId: attempt.quizId,
          studentId: student.studentId, qId: payload.qId, dataUrl,
          fileName: 'photo_' + (same.length + 1) + '.jpg', sizeBytes: Math.round(dataUrl.length * 0.75),
          uploadedAt: nowIso()
        };
        lsSet('uploads', [...lsGet('uploads', []), upload]);
        return { uploadId: upload.uploadId, url: dataUrl, fileName: upload.fileName };
      }
      case 'deleteUpload': {
        const student = localStudent(payload);
        const uploads = lsGet('uploads', []);
        const upload = uploads.find((u) => u.uploadId === payload.uploadId);
        if (!upload || upload.studentId !== student.studentId) throw new Error('not found');
        const attempt = attempts().find((a) => a.attemptId === upload.attemptId);
        if (attempt && localAttemptStatus(attempt) !== 'in_progress') throw new Error('already submitted');
        lsSet('uploads', uploads.filter((u) => u.uploadId !== payload.uploadId));
        return true;
      }
      case 'adminLogin': {
        if (String(payload.pin || '') !== String(settings().pin || '')) throw new Error('wrong pin');
        return { token: 'local-admin' };
      }
      case 'adminOverview': {
        auth();
        return {
          studentCount: students().length,
          registrationCode: String(settings().registrationCode || '').trim(),
          grades: gradesList(),
          quizzes: quizzes().map((q) => ({
            ...q,
            questionCount: questions().filter((x) => x.quizId === q.quizId).length,
            attemptCount: attempts().filter((x) => x.quizId === q.quizId).length
          }))
        };
      }
      case 'adminSaveQuiz': {
        auth();
        const list = quizzes();
        const p = payload.quiz || {};
        if (p.quizId && list.some((q) => q.quizId === p.quizId)) {
          const merged = list.map((q) => (q.quizId === p.quizId ? { ...q, ...p } : q));
          lsSet('quizzes', merged);
          return merged.find((q) => q.quizId === p.quizId);
        }
        const quiz = {
          quizId: uid(), titleAR: p.titleAR || '', titleEN: p.titleEN || '',
          descAR: p.descAR || '', descEN: p.descEN || '',
          durationSec: Number(p.durationSec) || 0,
          showScore: p.showScore ? '1' : '0', active: p.active ? '1' : '0',
          grade: String(p.grade || '').trim(),
          createdAt: nowIso()
        };
        lsSet('quizzes', [...list, quiz]);
        return quiz;
      }
      case 'adminDeleteQuiz': {
        auth();
        lsSet('quizzes', quizzes().filter((q) => q.quizId !== payload.id));
        lsSet('questions', questions().filter((q) => q.quizId !== payload.id));
        const deadAttempts = attempts().filter((a) => a.quizId === payload.id).map((a) => a.attemptId);
        lsSet('attempts', attempts().filter((a) => a.quizId !== payload.id));
        lsSet('responses', responses().filter((r) => !deadAttempts.includes(r.attemptId)));
        lsSet('uploads', lsGet('uploads', []).filter((u) => !deadAttempts.includes(u.attemptId)));
        return true;
      }
      case 'adminQuestions': {
        auth();
        return questions()
          .filter((q) => q.quizId === payload.quizId)
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      }
      case 'adminSaveQuestion': {
        auth();
        const list = questions();
        const p = payload.question || {};
        const record = {
          qId: p.qId || uid(), quizId: p.quizId, type: p.type,
          textAR: p.textAR || '',
          optionsAR: p.optionsAR || [],
          correct: p.correct == null ? '' : String(p.correct),
          points: Number(p.points) || 0, order: Number(p.order) || list.length + 1,
          imageUrl: String(p.imageUrl || '')
        };
        if (p.qId && list.some((q) => q.qId === p.qId)) {
          const merged = list.map((q) => (q.qId === p.qId ? { ...q, ...record } : q));
          lsSet('questions', merged);
          return record;
        }
        lsSet('questions', [...list, record]);
        return record;
      }
      case 'adminDeleteQuestion': {
        auth();
        lsSet('questions', questions().filter((q) => q.qId !== payload.qId));
        const affected = responses().filter((r) => r.qId === payload.qId);
        lsSet('responses', responses().filter((r) => r.qId !== payload.qId));
        const touched = new Set(affected.map((r) => r.attemptId));
        lsSet('attempts', attempts().map((a) => {
          if (!touched.has(a.attemptId)) return a;
          const rs = responses().filter((r) => r.attemptId === a.attemptId && r.qId !== payload.qId);
          return { ...a, totalScore: rs.reduce((s, r) => s + (Number(r.points) || 0), 0) };
        }));
        return true;
      }
      case 'adminAttempts': {
        auth();
        return attempts()
          .filter((a) => a.quizId === payload.quizId)
          .map((a) => ({
            ...a,
            status: localAttemptStatus(a),
            reviewOpen: String(a.reviewOpen) === '1'
          }))
          .sort((a, b) => String(b.submittedAt || b.startedAt).localeCompare(String(a.submittedAt || a.startedAt)));
      }
      case 'adminAttemptDetail': {
        auth();
        const attempt = attempts().find((a) => a.attemptId === payload.attemptId);
        if (!attempt) throw new Error('not found');
        const qs = questions().filter((q) => q.quizId === attempt.quizId);
        const rs = responses().filter((r) => r.attemptId === payload.attemptId);
        const detail = qs.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)).map((q) => {
          const r = rs.find((x) => x.qId === q.qId);
          return {
            qId: q.qId, type: q.type, textAR: q.textAR,
            optionsAR: q.optionsAR || [],
            correct: q.correct == null ? '' : String(q.correct),
            maxPoints: Number(q.points) || 0,
            imageUrl: q.imageUrl || '',
            rId: r ? r.rId : '', answer: r ? r.answer : '',
            isCorrect: r ? r.isCorrect : '', points: r ? Number(r.points) || 0 : 0,
            gradedBy: r ? r.gradedBy : 'pending',
            images: localUploadsFor(attempt.attemptId, q.qId)
          };
        });
        return {
          attempt: {
            ...attempt,
            status: localAttemptStatus(attempt),
            reviewOpen: String(attempt.reviewOpen) === '1'
          },
          responses: detail
        };
      }
      case 'adminGrade': {
        auth();
        const rs = responses().map((r) => {
          if (r.rId !== payload.rId) return r;
          const pts = Math.max(0, Math.min(Number(payload.points) || 0, Number(r.maxPoints) || 0));
          const isCorrect = pts >= Number(r.maxPoints) ? '1' : (pts > 0 ? '' : '0');
          return { ...r, points: pts, isCorrect, gradedBy: 'teacher' };
        });
        lsSet('responses', rs);
        const target = rs.find((r) => r.rId === payload.rId);
        if (target) {
          lsSet('attempts', attempts().map((a) => a.attemptId === target.attemptId
            ? { ...a, totalScore: rs.filter((r) => r.attemptId === a.attemptId).reduce((s, r) => s + (Number(r.points) || 0), 0) }
            : a));
        }
        return true;
      }
      case 'adminDeleteAttempt': {
        auth();
        lsSet('attempts', attempts().filter((a) => a.attemptId !== payload.attemptId));
        lsSet('responses', responses().filter((r) => r.attemptId !== payload.attemptId));
        lsSet('uploads', lsGet('uploads', []).filter((u) => u.attemptId !== payload.attemptId));
        return true;
      }
      case 'adminToggleReview': {
        auth();
        const attempt = attempts().find((a) => a.attemptId === payload.attemptId);
        if (!attempt) throw new Error('not found');
        if (localAttemptStatus(attempt) !== 'submitted') throw new Error('attempt_note_open');
        const open = payload.open === true || payload.open === '1' || payload.open === 1;
        lsSet('attempts', attempts().map((a) => a.attemptId === attempt.attemptId
          ? { ...a, reviewOpen: open ? '1' : '0', gradedAt: open ? nowIso() : '' }
          : a));
        return true;
      }
      case 'adminReopenAttempt': {
        auth();
        const attempt = attempts().find((a) => a.attemptId === payload.attemptId);
        if (!attempt) throw new Error('not found');
        lsSet('attempts', attempts().filter((a) => a.attemptId !== attempt.attemptId));
        lsSet('responses', responses().filter((r) => r.attemptId !== attempt.attemptId));
        lsSet('uploads', lsGet('uploads', []).filter((u) => u.attemptId !== attempt.attemptId));
        return true;
      }
      case 'adminStudents': {
        auth();
        return {
          registrationCode: String(settings().registrationCode || '').trim(),
          grades: gradesList(),
          students: students().map((s) => ({
            studentId: s.studentId, username: s.username, displayName: s.displayName,
            grade: String(s.grade || '').trim(),
            createdAt: s.createdAt || '', active: String(s.active) === '1',
            attemptCount: attempts().filter((a) => a.studentId === s.studentId).length
          }))
        };
      }
      case 'adminDeleteStudent': {
        auth();
        const deadAttempts = attempts().filter((a) => a.studentId === payload.studentId).map((a) => a.attemptId);
        lsSet('students', students().filter((s) => s.studentId !== payload.studentId));
        lsSet('sessions', lsGet('sessions', []).filter((s) => s.studentId !== payload.studentId));
        lsSet('attempts', attempts().filter((a) => a.studentId !== payload.studentId));
        lsSet('responses', responses().filter((r) => !deadAttempts.includes(r.attemptId)));
        lsSet('uploads', lsGet('uploads', []).filter((u) => !deadAttempts.includes(u.attemptId)));
        return true;
      }
      case 'adminChangePin': {
        auth();
        if (String(payload.oldPin || '') !== String(settings().pin || '')) throw new Error('wrong pin');
        if (String(payload.newPin || '').length < 4) throw new Error('pin too short');
        lsSet('settings', { ...settings(), pin: String(payload.newPin) });
        return true;
      }
      case 'adminSetRegistrationCode': {
        auth();
        lsSet('settings', { ...settings(), registrationCode: String(payload.code || '').trim().slice(0, 32) });
        return true;
      }
      case 'adminSetGrades': {
        auth();
        const raw = Array.isArray(payload.grades) ? payload.grades : String(payload.grades || '').split(/[,\n]/);
        const list = raw.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 40).map((s) => s.slice(0, 60));
        lsSet('settings', { ...settings(), grades: list.join(',') });
        return list;
      }
      case 'adminUploadQuestionImage': {
        auth();
        const dataUrl = String(payload.dataUrl || '');
        if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(dataUrl)) throw new Error('bad image');
        return { url: dataUrl };
      }
      case 'adminResetLocal': {
        auth();
        ['quizzes', 'questions', 'attempts', 'responses', 'students', 'sessions', 'uploads', 'seedVersion'].forEach((k) => localStorage.removeItem('qp_' + k));
        localStorage.removeItem('qp_seeded');
        localStorage.removeItem(STOKEN_KEY);
        return true;
      }
      default:
        throw new Error('unknown action');
    }
  }

  async function remoteRequest(action, payload, method) {
    const base = CONFIG.apiUrl.trim();
    let res;
    if (method === 'POST') {
      res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload })
      });
    } else {
      const params = new URLSearchParams({ action, ...payload });
      res = await fetch(base + '?' + params.toString());
    }
    const json = await res.json().catch(() => null);
    if (!json) throw new Error('bad response');
    if (!json.ok) throw new Error(json.error || 'server error');
    return json.data;
  }

  async function call(action, payload = {}, method = 'GET') {
    let result;
    if (LOCAL()) {
      try {
        result = await localRequest(action, payload);
      } catch (e) {
        throw translate(e);
      }
      return result;
    }
    try {
      result = await remoteRequest(action, payload, method);
    } catch (e) {
      throw translate(e);
    }
    return result;
  }

  const st = () => ({ token: sToken() });

  return {
    isLocal: LOCAL,
    sToken,
    setSToken,
    getQuizzes: () => call('getQuizzes'),
    getQuiz: (id) => call('getQuiz', { id }),
    authInfo: () => call('authInfo'),
    register: (payload) => call('register', payload, 'POST'),
    login: (payload) => call('login', payload, 'POST'),
    logout: () => call('logout', Object.assign(st()), 'POST'),
    studentMe: () => call('studentMe', st()),
    studentUpdateProfile: (displayName) => call('studentUpdateProfile', Object.assign(st(), { displayName }), 'POST'),
    studentHome: () => call('studentHome', st()),
    beginAttempt: (quizId) => call('beginAttempt', Object.assign(st(), { quizId }), 'POST'),
    submitAttempt: (payload) => call('submitAttempt', Object.assign(st(), payload), 'POST'),
    studentReview: (quizId) => call('studentReview', Object.assign(st(), { quizId })),
    uploadImage: (payload) => call('uploadImage', Object.assign(st(), payload), 'POST'),
    deleteUpload: (uploadId) => call('deleteUpload', Object.assign(st(), { uploadId }), 'POST'),
    adminLogin: (pin) => call('adminLogin', { pin }, 'POST'),
    adminOverview: (token) => call('adminOverview', { token }),
    adminSaveQuiz: (token, quiz) => call('adminSaveQuiz', { token, quiz }, 'POST'),
    adminDeleteQuiz: (token, id) => call('adminDeleteQuiz', { token, id }, 'POST'),
    adminQuestions: (token, quizId) => call('adminQuestions', { token, quizId }),
    adminSaveQuestion: (token, question) => call('adminSaveQuestion', { token, question }, 'POST'),
    adminUploadQuestionImage: (token, dataUrl) => call('adminUploadQuestionImage', { token, dataUrl }, 'POST'),
    adminDeleteQuestion: (token, quizId, qId) => call('adminDeleteQuestion', { token, quizId, qId }, 'POST'),
    adminAttempts: (token, quizId) => call('adminAttempts', { token, quizId }),
    adminAttemptDetail: (token, attemptId) => call('adminAttemptDetail', { token, attemptId }),
    adminGrade: (token, rId, points) => call('adminGrade', { token, rId, points }, 'POST'),
    adminDeleteAttempt: (token, attemptId) => call('adminDeleteAttempt', { token, attemptId }, 'POST'),
    adminToggleReview: (token, attemptId, open) => call('adminToggleReview', { token, attemptId, open: open ? '1' : '0' }, 'POST'),
    adminReopenAttempt: (token, attemptId) => call('adminReopenAttempt', { token, attemptId }, 'POST'),
    adminStudents: (token) => call('adminStudents', { token }),
    adminDeleteStudent: (token, studentId) => call('adminDeleteStudent', { token, studentId }, 'POST'),
    adminChangePin: (token, oldPin, newPin) => call('adminChangePin', { token, oldPin, newPin }, 'POST'),
    adminSetRegistrationCode: (token, code) => call('adminSetRegistrationCode', { token, code }, 'POST'),
    adminSetGrades: (token, grades) => call('adminSetGrades', { token, grades }, 'POST'),
    adminResetLocal: (token) => call('adminResetLocal', { token }, 'POST')
  };
})();
