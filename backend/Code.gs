const HEADERS = {
  Quizzes: ['quizId', 'titleAR', 'titleEN', 'descAR', 'descEN', 'durationSec', 'showScore', 'active', 'createdAt', 'grade'],
  Questions: ['qId', 'quizId', 'type', 'textAR', 'optionsAR', 'correct', 'points', 'order', 'imageUrl'],
  Students: ['studentId', 'username', 'usernameKey', 'displayName', 'passwordHash', 'salt', 'createdAt', 'active', 'grade'],
  Sessions: ['token', 'studentId', 'expiresAt'],
  Attempts: ['attemptId', 'quizId', 'studentName', 'totalScore', 'maxScore', 'startedAt', 'submittedAt', 'timeTakenSec', 'studentId', 'status', 'reviewOpen', 'gradedAt'],
  Responses: ['rId', 'attemptId', 'quizId', 'studentName', 'qId', 'questionText', 'answer', 'isCorrect', 'points', 'maxPoints', 'gradedBy'],
  Uploads: ['uploadId', 'attemptId', 'quizId', 'studentId', 'qId', 'driveFileId', 'fileName', 'sizeBytes', 'uploadedAt'],
  Settings: ['key', 'value']
};

const SESSION_DAYS = 7;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES_PER_QUESTION = 4;
const DEFAULT_GRADES_ = [
  'الصف الثاني الابتدائي',
  'الصف الثالث الابتدائي',
  'الصف الرابع الابتدائي',
  'الصف الخامس الابتدائي',
  'الصف السادس الابتدائي',
  'الصف الأول الإعدادي',
  'الصف الثاني الإعدادي',
  'الصف الثالث الإعدادي'
];

function doGet(e) {
  return handle_(Object.assign({}, e && e.parameter));
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    body = {};
  }
  return handle_(body);
}

function handle_(p) {
  try {
    ensureSchema_();
    const action = p.action || '';
    let data;
    switch (action) {
      case 'getQuizzes': data = getQuizzes_(); break;
      case 'getQuiz': data = getQuizMeta_(p); break;
      case 'authInfo': data = authInfo_(); break;
      case 'register': data = register_(p); break;
      case 'login': data = login_(p); break;
      case 'studentMe': data = studentMe_(p); break;
      case 'studentUpdateProfile': data = studentUpdateProfile_(p); break;
      case 'logout': data = logout_(p); break;
      case 'studentHome': data = studentHome_(p); break;
      case 'beginAttempt': data = beginAttempt_(p); break;
      case 'submitAttempt': data = submitAttempt_(p); break;
      case 'studentReview': data = studentReview_(p); break;
      case 'uploadImage': data = uploadImage_(p); break;
      case 'deleteUpload': data = deleteUpload_(p); break;
      case 'adminLogin': data = adminLogin_(p); break;
      case 'adminOverview': requireAuth_(p); data = adminOverview_(); break;
      case 'adminSaveQuiz': requireAuth_(p); data = adminSaveQuiz_(p); break;
      case 'adminDeleteQuiz': requireAuth_(p); data = adminDeleteQuiz_(p); break;
      case 'adminQuestions': requireAuth_(p); data = adminQuestions_(p); break;
      case 'adminSaveQuestion': requireAuth_(p); data = adminSaveQuestion_(p); break;
      case 'adminUploadQuestionImage': requireAuth_(p); data = adminUploadQuestionImage_(p); break;
      case 'adminDeleteQuestion': requireAuth_(p); data = adminDeleteQuestion_(p); break;
      case 'adminAttempts': requireAuth_(p); data = adminAttempts_(p); break;
      case 'adminAttemptDetail': requireAuth_(p); data = adminAttemptDetail_(p); break;
      case 'adminGrade': requireAuth_(p); data = adminGrade_(p); break;
      case 'adminDeleteAttempt': requireAuth_(p); data = adminDeleteAttempt_(p); break;
      case 'adminToggleReview': requireAuth_(p); data = adminToggleReview_(p); break;
      case 'adminReopenAttempt': requireAuth_(p); data = adminReopenAttempt_(p); break;
      case 'adminStudents': requireAuth_(p); data = adminStudents_(); break;
      case 'adminDeleteStudent': requireAuth_(p); data = adminDeleteStudent_(p); break;
      case 'adminChangePin': requireAuth_(p); data = adminChangePin_(p); break;
      case 'adminSetRegistrationCode': requireAuth_(p); data = adminSetRegistrationCode_(p); break;
      case 'adminSetGrades': requireAuth_(p); data = adminSetGrades_(p); break;
      default: throw new Error('unknown action');
    }
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ensureSchema_() {
  migrateQuestions_();
  Object.keys(HEADERS).forEach((name) => sheet_(name));
}

function migrateQuestions_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Questions');
  if (!sh) return;
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return;
  const current = sh.getRange(1, 1, 1, lastCol).getValues()[0].map((h) => String(h));
  const drop = [];
  const iTextEN = current.indexOf('textEN');
  const iOptionsEN = current.indexOf('optionsEN');
  if (iTextEN >= 0) drop.push(iTextEN);
  if (iOptionsEN >= 0) drop.push(iOptionsEN);
  if (!drop.length) return;
  const headers = HEADERS.Questions;
  const lastRow = sh.getLastRow();
  if (lastRow >= 1) {
    const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    sh.getRange(1, 1, lastRow, lastCol).clearContent();
    const clean = values.map((row) => {
      const out = [];
      row.forEach((v, i) => { if (drop.indexOf(i) === -1) out.push(v); });
      while (out.length < headers.length) out.push('');
      return out;
    });
    sh.getRange(1, 1, clean.length, headers.length).setValues(clean);
  }
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  const headers = HEADERS[name];
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.setTabColor('6366f1');
    return sh;
  }
  const lastCol = sh.getLastColumn();
  if (lastCol === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }
  const current = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const mismatch = current.length !== headers.length || current.some((h, i) => String(h) !== headers[i]);
  if (mismatch) {
    const row = headers.map((h) => h);
    sh.getRange(1, 1, 1, headers.length).setValues([row]);
  }
  return sh;
}

function rows_(name) {
  const sh = sheet_(name);
  const headers = HEADERS[name];
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  return values.map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function cellValue_(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    return JSON.stringify(value);
  }
  return value;
}

function appendRow_(name, obj) {
  const headers = HEADERS[name];
  sheet_(name).appendRow(headers.map((h) => cellValue_(obj[h])));
}

function updateRow_(name, keyField, keyValue, patch) {
  const sh = sheet_(name);
  const headers = HEADERS[name];
  const rows = rows_(name);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][keyField]) === String(keyValue)) {
      const merged = Object.assign({}, rows[i], patch);
      sh.getRange(i + 2, 1, 1, headers.length).setValues([headers.map((h) => cellValue_(merged[h]))]);
      return true;
    }
  }
  return false;
}

function deleteRowsWhere_(name, predicate) {
  const sh = sheet_(name);
  const rows = rows_(name);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (predicate(rows[i])) sh.deleteRow(i + 2);
  }
}

function num(v) {
  if (v instanceof Date) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function str(v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function truthy_(v) {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'TRUE';
}

function parseJson_(v, fallback) {
  if (Array.isArray(v)) return v;
  if (!v) return fallback;
  try {
    const parsed = JSON.parse(String(v));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function uuid_() {
  return Utilities.getUuid();
}

function nowIso_() {
  return new Date().toISOString();
}

function normalize_(s) {
  return str(s)
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

function byOrder_(a, b) {
  return num(a.order) - num(b.order);
}

function parseGrades_() {
  const list = str(getSetting_('grades'))
    .split(/[,\n]/)
    .map((s) => str(s).trim())
    .filter(Boolean)
    .slice(0, 40);
  return list.length ? list : DEFAULT_GRADES_.slice();
}

function quizVisibleToGrade_(quiz, myGrade) {
  const g = str(quiz.grade).trim();
  if (!g) return true;
  return Boolean(myGrade) && g === myGrade;
}

function driveFileIdFromUrl_(url) {
  const m = /[?&]id=([a-zA-Z0-9_-]+)/.exec(str(url));
  return m ? m[1] : '';
}

function hashPin_(value, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + String(value), Utilities.Charset.UTF_8);
  return bytes.map((b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

function settingsMap_() {
  const map = {};
  rows_('Settings').forEach((row) => { map[str(row.key)] = row.value; });
  return map;
}

function getSetting_(key) {
  return settingsMap_()[key];
}

function setSetting_(key, value) {
  const sh = sheet_('Settings');
  const rows = rows_('Settings');
  for (let i = 0; i < rows.length; i++) {
    if (str(rows[i].key) === key) {
      sh.getRange(i + 2, 2).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value]);
}

function attemptStatus_(a) {
  const explicit = str(a.status);
  if (explicit === 'in_progress' || explicit === 'submitted') return explicit;
  return str(a.submittedAt) ? 'submitted' : 'in_progress';
}

function attemptRow_(attemptId) {
  return rows_('Attempts').find((a) => str(a.attemptId) === str(attemptId));
}

function findAttempt_(quizId, studentId) {
  const rows = rows_('Attempts').filter((a) => str(a.quizId) === str(quizId) && str(a.studentId) === str(studentId));
  return rows.length ? rows[rows.length - 1] : null;
}

function quizRow_(quizId) {
  return rows_('Quizzes').find((q) => str(q.quizId) === str(quizId));
}

function quizMetaOf_(quiz) {
  return {
    quizId: str(quiz.quizId),
    titleAR: str(quiz.titleAR),
    titleEN: str(quiz.titleEN),
    descAR: str(quiz.descAR),
    descEN: str(quiz.descEN),
    durationSec: num(quiz.durationSec),
    showScore: str(quiz.showScore),
    active: str(quiz.active),
    grade: str(quiz.grade).trim()
  };
}

function publicQuestions_(quizId) {
  return rows_('Questions')
    .filter((q) => str(q.quizId) === str(quizId))
    .sort(byOrder_)
    .map((q) => ({
      qId: str(q.qId),
      type: str(q.type),
      textAR: str(q.textAR),
      points: num(q.points),
      order: num(q.order),
      imageUrl: str(q.imageUrl)
    }));
}

function remainingSeconds_(attempt, durationSec) {
  if (!durationSec) return -1;
  const started = new Date(str(attempt.startedAt)).getTime();
  if (isNaN(started)) return -1;
  return Math.max(0, Math.round(durationSec - (Date.now() - started) / 1000));
}

function requireAuth_(p) {
  const token = p && p.token;
  if (!token) throw new Error('unauthorized');
  const ok = CacheService.getScriptCache().get('qp_' + String(token));
  if (ok !== '1') throw new Error('unauthorized');
  return true;
}

function studentAuth_(p) {
  const token = p && p.token;
  if (!token) throw new Error('unauthorized');
  const rows = rows_('Sessions');
  const session = rows.find((s) => str(s.token) === str(token));
  if (!session) throw new Error('unauthorized');
  const expires = new Date(str(session.expiresAt)).getTime();
  if (!expires || expires < Date.now()) {
    deleteRowsWhere_('Sessions', (s) => str(s.token) === str(token));
    throw new Error('unauthorized');
  }
  const student = rows_('Students').find((s) => str(s.studentId) === str(session.studentId));
  if (!student) throw new Error('unauthorized');
  if (!truthy_(student.active)) throw new Error('account_disabled');
  return { student: student, token: str(token) };
}

function createSession_(studentId) {
  const token = uuid_();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  appendRow_('Sessions', { token: token, studentId: studentId, expiresAt: expiresAt });
  return token;
}

function studentPublic_(student) {
  return {
    studentId: str(student.studentId),
    username: str(student.username),
    displayName: str(student.displayName),
    grade: str(student.grade).trim(),
    createdAt: str(student.createdAt)
  };
}

function authInfo_() {
  const code = str(getSetting_('registrationCode')).trim();
  return { codeRequired: code.length > 0, grades: parseGrades_() };
}

function register_(p) {
  const username = str(p.username).trim();
  const password = str(p.password);
  const displayName = str(p.displayName).trim();
  const code = str(p.code).trim();
  const grade = str(p.grade).trim().slice(0, 60);
  if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username)) throw new Error('username_invalid');
  if (password.length < 4) throw new Error('password_short');
  if (displayName.length < 2) throw new Error('name_short');
  if (!grade) throw new Error('grade_required');
  const regCode = str(getSetting_('registrationCode')).trim();
  if (regCode && code !== regCode) throw new Error('code_wrong');
  const usernameKey = username.toLowerCase();
  const existing = rows_('Students').find((s) => str(s.usernameKey) === usernameKey);
  if (existing) throw new Error('username_taken');
  const student = {
    studentId: uuid_(),
    username: username,
    usernameKey: usernameKey,
    displayName: displayName.slice(0, 60),
    grade: grade,
    salt: uuid_(),
    passwordHash: '',
    createdAt: nowIso_(),
    active: '1'
  };
  student.passwordHash = hashPin_(password, student.salt);
  appendRow_('Students', student);
  const token = createSession_(student.studentId);
  return { token: token, student: studentPublic_(student) };
}

function login_(p) {
  const usernameKey = str(p.username).trim().toLowerCase();
  const password = str(p.password);
  const student = rows_('Students').find((s) => str(s.usernameKey) === usernameKey);
  if (!student) throw new Error('wrong_credentials');
  if (!truthy_(student.active)) throw new Error('account_disabled');
  if (hashPin_(password, str(student.salt)) !== str(student.passwordHash)) throw new Error('wrong_credentials');
  const token = createSession_(str(student.studentId));
  return { token: token, student: studentPublic_(student) };
}

function logout_(p) {
  const token = str(p.token);
  deleteRowsWhere_('Sessions', (s) => str(s.token) === token);
  return true;
}

function studentMe_(p) {
  const auth = studentAuth_(p);
  return { student: studentPublic_(auth.student) };
}

function studentUpdateProfile_(p) {
  const auth = studentAuth_(p);
  const displayName = str(p.displayName).trim();
  if (displayName.length < 2) throw new Error('name_short');
  updateRow_('Students', 'studentId', str(auth.student.studentId), { displayName: displayName.slice(0, 60) });
  return { displayName: displayName.slice(0, 60) };
}

function getQuizzes_() {
  return rows_('Quizzes')
    .filter((q) => truthy_(q.active) && !str(q.grade).trim())
    .map(quizMetaOf_);
}

function getQuizMeta_(p) {
  const quiz = quizRow_(p.id);
  if (!quiz) throw new Error('quiz not found');
  const questionCount = rows_('Questions').filter((q) => str(q.quizId) === str(p.id)).length;
  return { quiz: quizMetaOf_(quiz), questionCount: questionCount };
}

function studentHome_(p) {
  const auth = studentAuth_(p);
  const studentId = str(auth.student.studentId);
  const myGrade = str(auth.student.grade).trim();
  const quizzes = rows_('Quizzes').filter((q) => truthy_(q.active) && quizVisibleToGrade_(q, myGrade));
  const attempts = rows_('Attempts').filter((a) => str(a.studentId) === studentId);
  return {
    student: studentPublic_(auth.student),
    quizzes: quizzes.map((q) => {
      const attempt = attempts.find((a) => str(a.quizId) === str(q.quizId));
      const meta = quizMetaOf_(q);
      return {
        quiz: meta,
        questionCount: rows_('Questions').filter((x) => str(x.quizId) === str(q.quizId)).length,
        attempt: attempt ? {
          attemptId: str(attempt.attemptId),
          status: attemptStatus_(attempt),
          reviewOpen: truthy_(attempt.reviewOpen),
          totalScore: num(attempt.totalScore),
          maxScore: num(attempt.maxScore),
          submittedAt: str(attempt.submittedAt)
        } : null
      };
    })
  };
}

function beginAttempt_(p) {
  const auth = studentAuth_(p);
  const studentId = str(auth.student.studentId);
  const quiz = quizRow_(p.quizId);
  if (!quiz || !truthy_(quiz.active)) throw new Error('quiz not found');
  if (!quizVisibleToGrade_(quiz, str(auth.student.grade).trim())) throw new Error('not_your_grade');
  const existing = findAttempt_(str(quiz.quizId), studentId);
  const durationSec = num(quiz.durationSec);
  if (existing) {
    const status = attemptStatus_(existing);
    if (status === 'submitted') {
      return {
        status: 'submitted',
        attemptId: str(existing.attemptId),
        reviewOpen: truthy_(existing.reviewOpen),
        totalScore: num(existing.totalScore),
        maxScore: num(existing.maxScore),
        showScore: str(quiz.showScore)
      };
    }
    return {
      status: 'in_progress',
      attemptId: str(existing.attemptId),
      startedAt: str(existing.startedAt),
      remainingSec: remainingSeconds_(existing, durationSec),
      durationSec: durationSec,
      questions: publicQuestions_(str(quiz.quizId)),
      quiz: quizMetaOf_(quiz)
    };
  }
  const attempt = {
    attemptId: uuid_(),
    quizId: str(quiz.quizId),
    studentName: str(auth.student.displayName),
    totalScore: 0,
    maxScore: 0,
    startedAt: nowIso_(),
    submittedAt: '',
    timeTakenSec: 0,
    studentId: studentId,
    status: 'in_progress',
    reviewOpen: '0',
    gradedAt: ''
  };
  appendRow_('Attempts', attempt);
  return {
    status: 'created',
    attemptId: attempt.attemptId,
    startedAt: attempt.startedAt,
    remainingSec: durationSec > 0 ? durationSec : -1,
    durationSec: durationSec,
    questions: publicQuestions_(str(quiz.quizId)),
    quiz: quizMetaOf_(quiz)
  };
}

function gradeAnswers_(quiz, attemptId, studentName, answers) {
  const questions = rows_('Questions')
    .filter((q) => str(q.quizId) === str(quiz.quizId))
    .sort(byOrder_);
  let total = 0;
  let max = 0;
  let correct = 0;
  let wrong = 0;
  let pending = 0;
  const rows = questions.map((q) => {
    const pts = num(q.points);
    max += pts;
    const match = answers.find((a) => str(a.qId) === str(q.qId));
    const answer = match ? str(match.answer).slice(0, 4000) : '';
    let isCorrect = '';
    let awarded = 0;
    let gradedBy = 'auto';
    if (str(q.type) === 'text') {
      const model = str(q.correct).trim();
      if (model) {
        isCorrect = normalize_(answer) === normalize_(model) ? '1' : '0';
        awarded = isCorrect === '1' ? pts : 0;
        if (isCorrect === '1') correct++; else wrong++;
      } else {
        gradedBy = 'pending';
        pending++;
      }
    } else {
      isCorrect = answer !== '' && answer === str(q.correct) ? '1' : '0';
      awarded = isCorrect === '1' ? pts : 0;
      if (isCorrect === '1') correct++; else wrong++;
    }
    total += awarded;
    return {
      rId: uuid_(),
      attemptId: attemptId,
      quizId: str(quiz.quizId),
      studentName: studentName,
      qId: str(q.qId),
      questionText: str(q.textAR).slice(0, 500),
      answer: answer,
      isCorrect: isCorrect,
      points: awarded,
      maxPoints: pts,
      gradedBy: gradedBy
    };
  });
  return { rows: rows, total: total, max: max, correct: correct, wrong: wrong, pending: pending };
}

function submitAttempt_(p) {
  const auth = studentAuth_(p);
  const attempt = attemptRow_(p.attemptId);
  if (!attempt || str(attempt.studentId) !== str(auth.student.studentId)) throw new Error('not_found');
  if (attemptStatus_(attempt) === 'submitted') throw new Error('already submitted');
  const quiz = quizRow_(str(attempt.quizId));
  if (!quiz) throw new Error('quiz not found');
  const answers = Array.isArray(p.answers) ? p.answers : [];
  const graded = gradeAnswers_(quiz, str(attempt.attemptId), str(auth.student.displayName), answers);
  graded.rows.forEach((row) => appendRow_('Responses', row));
  updateRow_('Attempts', 'attemptId', str(attempt.attemptId), {
    status: 'submitted',
    totalScore: graded.total,
    maxScore: graded.max,
    submittedAt: nowIso_(),
    timeTakenSec: num(p.timeTakenSec)
  });
  return {
    attemptId: str(attempt.attemptId),
    totalScore: graded.total,
    maxScore: graded.max,
    correct: graded.correct,
    wrong: graded.wrong,
    pending: graded.pending,
    showScore: str(quiz.showScore)
  };
}

function imagesByQuestion_(attemptId) {
  const map = {};
  rows_('Uploads')
    .filter((u) => str(u.attemptId) === str(attemptId))
    .forEach((u) => {
      const qId = str(u.qId);
      if (!map[qId]) map[qId] = [];
      map[qId].push({
        uploadId: str(u.uploadId),
        url: driveUrl_(str(u.driveFileId)),
        fileName: str(u.fileName)
      });
    });
  return map;
}

function studentReview_(p) {
  const auth = studentAuth_(p);
  const studentId = str(auth.student.studentId);
  const quiz = quizRow_(p.quizId);
  if (!quiz) throw new Error('quiz not found');
  const attempt = findAttempt_(str(quiz.quizId), studentId);
  if (!attempt) return { status: 'none' };
  const status = attemptStatus_(attempt);
  if (status === 'in_progress') return { status: 'in_progress', attemptId: str(attempt.attemptId) };
  const base = {
    status: 'submitted',
    attemptId: str(attempt.attemptId),
    reviewOpen: truthy_(attempt.reviewOpen),
    totalScore: num(attempt.totalScore),
    maxScore: num(attempt.maxScore),
    submittedAt: str(attempt.submittedAt),
    timeTakenSec: num(attempt.timeTakenSec),
    showScore: str(quiz.showScore),
    quiz: quizMetaOf_(quiz)
  };
  if (!base.reviewOpen) return base;
  const questions = rows_('Questions')
    .filter((q) => str(q.quizId) === str(quiz.quizId))
    .sort(byOrder_);
  const responses = rows_('Responses').filter((r) => str(r.attemptId) === str(attempt.attemptId));
  const images = imagesByQuestion_(str(attempt.attemptId));
  base.questions = questions.map((q) => {
    const r = responses.find((x) => str(x.qId) === str(q.qId));
    return {
      qId: str(q.qId),
      type: str(q.type),
      textAR: str(q.textAR),
      optionsAR: parseJson_(q.optionsAR, []),
      correct: str(q.correct),
      maxPoints: num(q.points),
      imageUrl: str(q.imageUrl),
      answer: r ? str(r.answer) : '',
      isCorrect: r ? str(r.isCorrect) : '',
      points: r ? num(r.points) : 0,
      gradedBy: r ? str(r.gradedBy) : 'pending',
      images: images[str(q.qId)] || []
    };
  });
  return base;
}

function uploadsRootFolder_() {
  const it = DriveApp.getFoldersByName('QuizPro Uploads');
  if (it.hasNext()) return it.next();
  const folder = DriveApp.createFolder('QuizPro Uploads');
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function childFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function driveUrl_(fileId) {
  return 'https://drive.google.com/uc?export=view&id=' + fileId;
}

function uploadImage_(p) {
  const auth = studentAuth_(p);
  const attempt = attemptRow_(p.attemptId);
  if (!attempt || str(attempt.studentId) !== str(auth.student.studentId)) throw new Error('not_found');
  if (attemptStatus_(attempt) !== 'in_progress') throw new Error('already submitted');
  const qId = str(p.qId);
  const question = rows_('Questions').find((q) => str(q.qId) === qId && str(q.quizId) === str(attempt.quizId));
  if (!question) throw new Error('not_found');
  if (str(question.type) !== 'text') throw new Error('not_found');
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(str(p.dataUrl));
  if (!match) throw new Error('bad image');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('image too large');
  const existing = rows_('Uploads').filter((u) => str(u.attemptId) === str(attempt.attemptId) && str(u.qId) === qId);
  if (existing.length >= MAX_IMAGES_PER_QUESTION) throw new Error('image max');
  const ext = match[1] === 'png' ? 'png' : match[1] === 'webp' ? 'webp' : 'jpg';
  const fileName = 'attempt_' + String(attempt.attemptId).slice(0, 8) + '_q_' + qId.slice(0, 8) + '_' + (existing.length + 1) + '.' + ext;
  const root = uploadsRootFolder_();
  const quizFolder = childFolder_(root, str(attempt.quizId));
  const attemptFolder = childFolder_(quizFolder, str(attempt.attemptId));
  const mime = 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
  const file = attemptFolder.createFile(Utilities.newBlob(bytes, mime, fileName));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const upload = {
    uploadId: uuid_(),
    attemptId: str(attempt.attemptId),
    quizId: str(attempt.quizId),
    studentId: str(auth.student.studentId),
    qId: qId,
    driveFileId: file.getId(),
    fileName: fileName,
    sizeBytes: bytes.length,
    uploadedAt: nowIso_()
  };
  appendRow_('Uploads', upload);
  return { uploadId: upload.uploadId, url: driveUrl_(upload.driveFileId), fileName: fileName };
}

function deleteUpload_(p) {
  const auth = studentAuth_(p);
  const upload = rows_('Uploads').find((u) => str(u.uploadId) === str(p.uploadId));
  if (!upload || str(upload.studentId) !== str(auth.student.studentId)) throw new Error('not_found');
  const attempt = attemptRow_(str(upload.attemptId));
  if (attempt && attemptStatus_(attempt) !== 'in_progress') throw new Error('already submitted');
  try {
    DriveApp.getFileById(str(upload.driveFileId)).setTrashed(true);
  } catch (e) { }
  deleteRowsWhere_('Uploads', (u) => str(u.uploadId) === str(p.uploadId));
  return true;
}

function adminLogin_(p) {
  let salt = getSetting_('salt');
  if (!salt) {
    salt = uuid_();
    setSetting_('salt', salt);
  }
  let pinHash = getSetting_('pinHash');
  if (!pinHash) {
    pinHash = hashPin_('1234', salt);
    setSetting_('pinHash', pinHash);
  }
  if (hashPin_(str(p.pin), salt) !== pinHash) throw new Error('wrong pin');
  const token = uuid_();
  CacheService.getScriptCache().put('qp_' + token, '1', 21600);
  return { token: token };
}

function adminChangePin_(p) {
  const salt = getSetting_('salt');
  const pinHash = getSetting_('pinHash');
  if (!salt || !pinHash) throw new Error('wrong pin');
  if (hashPin_(str(p.oldPin), salt) !== pinHash) throw new Error('wrong pin');
  const newPin = str(p.newPin);
  if (newPin.length < 4) throw new Error('pin too short');
  setSetting_('pinHash', hashPin_(newPin, salt));
  return true;
}

function adminSetRegistrationCode_(p) {
  setSetting_('registrationCode', str(p.code).trim().slice(0, 32));
  return true;
}

function adminOverview_() {
  const questions = rows_('Questions');
  const attempts = rows_('Attempts');
  return {
    studentCount: rows_('Students').length,
    registrationCode: str(getSetting_('registrationCode')).trim(),
    grades: parseGrades_(),
    quizzes: rows_('Quizzes').map((q) => ({
      quizId: str(q.quizId),
      titleAR: str(q.titleAR),
      titleEN: str(q.titleEN),
      descAR: str(q.descAR),
      descEN: str(q.descEN),
      durationSec: num(q.durationSec),
      showScore: str(q.showScore),
      active: str(q.active),
      grade: str(q.grade).trim(),
      createdAt: str(q.createdAt),
      questionCount: questions.filter((x) => str(x.quizId) === str(q.quizId)).length,
      attemptCount: attempts.filter((x) => str(x.quizId) === str(q.quizId)).length
    }))
  };
}

function adminSaveQuiz_(p) {
  const q = p.quiz || {};
  const record = {
    quizId: str(q.quizId) || uuid_(),
    titleAR: str(q.titleAR).slice(0, 300),
    titleEN: str(q.titleEN).slice(0, 300),
    descAR: str(q.descAR).slice(0, 2000),
    descEN: str(q.descEN).slice(0, 2000),
    durationSec: num(q.durationSec),
    showScore: truthy_(q.showScore) ? '1' : '0',
    active: truthy_(q.active) ? '1' : '0',
    grade: str(q.grade).trim().slice(0, 60),
    createdAt: str(q.createdAt)
  };
  const existing = rows_('Quizzes').find((x) => str(x.quizId) === record.quizId);
  if (existing) {
    updateRow_('Quizzes', 'quizId', record.quizId, record);
  } else {
    record.createdAt = nowIso_();
    appendRow_('Quizzes', record);
  }
  return record;
}

function adminDeleteQuiz_(p) {
  const id = str(p.id);
  const attemptIds = rows_('Attempts').filter((a) => str(a.quizId) === id).map((a) => str(a.attemptId));
  deleteRowsWhere_('Responses', (r) => attemptIds.indexOf(str(r.attemptId)) !== -1);
  deleteRowsWhere_('Uploads', (u) => attemptIds.indexOf(str(u.attemptId)) !== -1);
  deleteRowsWhere_('Attempts', (a) => str(a.quizId) === id);
  deleteRowsWhere_('Questions', (q) => str(q.quizId) === id);
  deleteRowsWhere_('Quizzes', (q) => str(q.quizId) === id);
  return true;
}

function adminQuestions_(p) {
  return rows_('Questions')
    .filter((q) => str(q.quizId) === str(p.quizId))
    .sort(byOrder_)
    .map((q) => ({
      qId: str(q.qId),
      quizId: str(q.quizId),
      type: str(q.type),
      textAR: str(q.textAR),
      optionsAR: parseJson_(q.optionsAR, []),
      correct: str(q.correct),
      points: num(q.points),
      order: num(q.order),
      imageUrl: str(q.imageUrl)
    }));
}

function adminSaveQuestion_(p) {
  const q = p.question || {};
  const siblings = rows_('Questions').filter((x) => str(x.quizId) === str(q.quizId));
  const record = {
    qId: str(q.qId) || uuid_(),
    quizId: str(q.quizId),
    type: ['mcq', 'tf', 'text'].indexOf(str(q.type)) !== -1 ? str(q.type) : 'mcq',
    textAR: str(q.textAR).slice(0, 2000),
    optionsAR: JSON.stringify(Array.isArray(q.optionsAR) ? q.optionsAR : []),
    correct: str(q.correct),
    points: num(q.points),
    order: num(q.order) || (siblings.length + 1),
    imageUrl: str(q.imageUrl).slice(0, 500)
  };
  const existing = rows_('Questions').find((x) => str(x.qId) === record.qId);
  if (existing) {
    updateRow_('Questions', 'qId', record.qId, record);
  } else {
    appendRow_('Questions', record);
  }
  return record;
}

function adminUploadQuestionImage_(p) {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(str(p.dataUrl));
  if (!match) throw new Error('bad image');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('image too large');
  const ext = match[1] === 'png' ? 'png' : match[1] === 'webp' ? 'webp' : 'jpg';
  const root = uploadsRootFolder_();
  const folder = childFolder_(root, 'questions');
  const fileName = 'question_' + uuid_().slice(0, 8) + '.' + ext;
  const mime = 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
  const file = folder.createFile(Utilities.newBlob(bytes, mime, fileName));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: driveUrl_(file.getId()), driveFileId: file.getId() };
}

function adminDeleteQuestion_(p) {
  const qId = str(p.qId);
  const question = rows_('Questions').find((q) => str(q.qId) === qId);
  const oldFileId = question ? driveFileIdFromUrl_(question.imageUrl) : '';
  if (oldFileId) {
    try {
      DriveApp.getFileById(oldFileId).setTrashed(true);
    } catch (e) { }
  }
  const affectedAttempts = rows_('Responses')
    .filter((r) => str(r.qId) === qId)
    .map((r) => str(r.attemptId));
  deleteRowsWhere_('Responses', (r) => str(r.qId) === qId);
  deleteRowsWhere_('Questions', (q) => str(q.qId) === qId);
  const unique = affectedAttempts.filter((v, i, arr) => arr.indexOf(v) === i);
  const remaining = rows_('Responses');
  unique.forEach((attemptId) => {
    const total = remaining
      .filter((r) => str(r.attemptId) === attemptId)
      .reduce((sum, r) => sum + num(r.points), 0);
    updateRow_('Attempts', 'attemptId', attemptId, { totalScore: total });
  });
  return true;
}

function adminAttempts_(p) {
  return rows_('Attempts')
    .filter((a) => str(a.quizId) === str(p.quizId))
    .map((a) => ({
      attemptId: str(a.attemptId),
      quizId: str(a.quizId),
      studentId: str(a.studentId),
      studentName: str(a.studentName),
      status: attemptStatus_(a),
      reviewOpen: truthy_(a.reviewOpen),
      totalScore: num(a.totalScore),
      maxScore: num(a.maxScore),
      startedAt: str(a.startedAt),
      submittedAt: str(a.submittedAt),
      timeTakenSec: num(a.timeTakenSec)
    }))
    .sort((a, b) => String(b.submittedAt || b.startedAt).localeCompare(String(a.submittedAt || a.startedAt)));
}

function adminAttemptDetail_(p) {
  const attempt = attemptRow_(p.attemptId);
  if (!attempt) throw new Error('not found');
  const questions = rows_('Questions')
    .filter((q) => str(q.quizId) === str(attempt.quizId))
    .sort(byOrder_);
  const responseRows = rows_('Responses').filter((r) => str(r.attemptId) === str(attempt.attemptId));
  const images = imagesByQuestion_(str(attempt.attemptId));
  const responses = questions.map((q) => {
    const r = responseRows.find((x) => str(x.qId) === str(q.qId));
    return {
      qId: str(q.qId),
      type: str(q.type),
      textAR: str(q.textAR),
      optionsAR: parseJson_(q.optionsAR, []),
      correct: str(q.correct),
      maxPoints: num(q.points),
      imageUrl: str(q.imageUrl),
      rId: r ? str(r.rId) : '',
      answer: r ? str(r.answer) : '',
      isCorrect: r ? str(r.isCorrect) : '',
      points: r ? num(r.points) : 0,
      gradedBy: r ? str(r.gradedBy) : 'pending',
      images: images[str(q.qId)] || []
    };
  });
  return {
    attempt: {
      attemptId: str(attempt.attemptId),
      quizId: str(attempt.quizId),
      studentId: str(attempt.studentId),
      studentName: str(attempt.studentName),
      status: attemptStatus_(attempt),
      reviewOpen: truthy_(attempt.reviewOpen),
      totalScore: num(attempt.totalScore),
      maxScore: num(attempt.maxScore),
      startedAt: str(attempt.startedAt),
      submittedAt: str(attempt.submittedAt),
      timeTakenSec: num(attempt.timeTakenSec)
    },
    responses: responses
  };
}

function adminGrade_(p) {
  const responseRows = rows_('Responses');
  const row = responseRows.find((r) => str(r.rId) === str(p.rId));
  if (!row) throw new Error('not found');
  const maxPoints = num(row.maxPoints);
  const points = Math.max(0, Math.min(num(p.points), maxPoints));
  const isCorrect = maxPoints > 0 && points >= maxPoints ? '1' : (points > 0 ? '' : '0');
  updateRow_('Responses', 'rId', row.rId, { points: points, isCorrect: isCorrect, gradedBy: 'teacher' });
  const total = rows_('Responses')
    .filter((r) => str(r.attemptId) === str(row.attemptId))
    .reduce((sum, r) => sum + num(r.points), 0);
  updateRow_('Attempts', 'attemptId', row.attemptId, { totalScore: total });
  return true;
}

function adminDeleteAttempt_(p) {
  const attemptId = str(p.attemptId);
  deleteUploadsForAttempt_(attemptId);
  deleteRowsWhere_('Responses', (r) => str(r.attemptId) === attemptId);
  deleteRowsWhere_('Attempts', (a) => str(a.attemptId) === attemptId);
  return true;
}

function adminToggleReview_(p) {
  const attempt = attemptRow_(p.attemptId);
  if (!attempt) throw new Error('not found');
  if (attemptStatus_(attempt) !== 'submitted') throw new Error('attempt_note_open');
  const open = truthy_(p.open);
  updateRow_('Attempts', 'attemptId', str(attempt.attemptId), {
    reviewOpen: open ? '1' : '0',
    gradedAt: open ? nowIso_() : ''
  });
  return true;
}

function adminReopenAttempt_(p) {
  const attempt = attemptRow_(p.attemptId);
  if (!attempt) throw new Error('not found');
  const attemptId = str(attempt.attemptId);
  deleteUploadsForAttempt_(attemptId);
  deleteRowsWhere_('Responses', (r) => str(r.attemptId) === attemptId);
  deleteRowsWhere_('Attempts', (a) => str(a.attemptId) === attemptId);
  return true;
}

function deleteUploadsForAttempt_(attemptId) {
  const uploads = rows_('Uploads').filter((u) => str(u.attemptId) === attemptId);
  uploads.forEach((u) => {
    try {
      DriveApp.getFileById(str(u.driveFileId)).setTrashed(true);
    } catch (e) { }
  });
  deleteRowsWhere_('Uploads', (u) => str(u.attemptId) === attemptId);
}

function adminStudents_() {
  const students = rows_('Students');
  const attempts = rows_('Attempts');
  return {
    registrationCode: str(getSetting_('registrationCode')).trim(),
    grades: parseGrades_(),
    students: students.map((s) => ({
      studentId: str(s.studentId),
      username: str(s.username),
      displayName: str(s.displayName),
      grade: str(s.grade).trim(),
      createdAt: str(s.createdAt),
      active: truthy_(s.active),
      attemptCount: attempts.filter((a) => str(a.studentId) === str(s.studentId)).length
    }))
  };
}

function adminSetGrades_(p) {
  const raw = Array.isArray(p.grades) ? p.grades : String(p.grades || '').split(/[,\n]/);
  const list = raw
    .map((s) => str(s).trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((s) => s.slice(0, 60));
  setSetting_('grades', list.join(','));
  return list;
}

function adminDeleteStudent_(p) {
  const studentId = str(p.studentId);
  const attemptIds = rows_('Attempts')
    .filter((a) => str(a.studentId) === studentId)
    .map((a) => str(a.attemptId));
  attemptIds.forEach((attemptId) => deleteUploadsForAttempt_(attemptId));
  deleteRowsWhere_('Responses', (r) => attemptIds.indexOf(str(r.attemptId)) !== -1);
  deleteRowsWhere_('Attempts', (a) => str(a.studentId) === studentId);
  deleteRowsWhere_('Sessions', (s) => str(s.studentId) === studentId);
  deleteRowsWhere_('Students', (s) => str(s.studentId) === studentId);
  return true;
}
