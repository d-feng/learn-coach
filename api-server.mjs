import express from 'express';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

try { process.loadEnvFile(); } catch { /* .env not present, environment variables used as-is */ }

const app = express();
const PORT = Number(process.env.CORRECTION_HELPER_API_PORT || 3001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const storePath = path.join(dataDir, 'store.json');
const uploadsDir = path.join(__dirname, 'uploads');
const sessionCookieName = 'correction_helper_session';
const sessionTtlMs = 1000 * 60 * 60 * 12;
const sessions = new Map();

app.use(express.json());

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash || !String(passwordHash).includes(':')) {
    return false;
  }

  const [salt, storedKeyHex] = String(passwordHash).split(':');
  const derivedKey = scryptSync(password, salt, 64);
  const storedKey = Buffer.from(storedKeyHex, 'hex');
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

function sanitizeUser(user) {
  const { password, passwordHash, ...safeUser } = user;
  return safeUser;
}

function parseCookies(cookieHeader = '') {
  return String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function appendSetCookie(res, cookieValue) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }

  res.setHeader('Set-Cookie', Array.isArray(current) ? [...current, cookieValue] : [current, cookieValue]);
}

function setSessionCookie(res, token) {
  appendSetCookie(
    res,
    `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(sessionTtlMs / 1000)}`
  );
}

function clearSessionCookie(res) {
  appendSetCookie(res, `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function createSession(userId) {
  const token = randomBytes(24).toString('hex');
  sessions.set(token, {
    userId,
    expiresAt: Date.now() + sessionTtlMs
  });
  return token;
}

function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[sessionCookieName];
  if (!token) {
    return null;
  }

  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  session.expiresAt = Date.now() + sessionTtlMs;
  const user = store.users.find((entry) => entry.id === session.userId);
  if (!user) {
    sessions.delete(token);
    return null;
  }

  return user;
}

function requireSession(req, res, next) {
  const user = getSessionUser(req);
  if (!user) {
    clearSessionCookie(res);
    res.status(401).send('Authentication required.');
    return;
  }

  req.authUser = user;
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.authUser ?? getSessionUser(req);
    if (!user) {
      clearSessionCookie(res);
      res.status(401).send('Authentication required.');
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).send('You do not have permission to access this resource.');
      return;
    }

    req.authUser = user;
    next();
  };
}

function getTeacherClasses(user) {
  const teacher = store.teachers.find((entry) => entry.id === user.linkedTeacherId);
  if (!teacher) {
    return [];
  }

  return store.classes.filter(
    (schoolClass) =>
      schoolClass.homeroomTeacherId === teacher.id || teacher.assignedClassIds.includes(schoolClass.id)
  );
}

function getStudentRecord(user) {
  return store.students.find((entry) => entry.id === user.linkedStudentId) ?? null;
}

function getClassRecord(classId) {
  return store.classes.find((entry) => entry.id === classId) ?? null;
}

function canAccessClassName(user, className) {
  if (user.role === 'Admin') {
    return true;
  }

  if (user.role === 'Teacher') {
    return getTeacherClasses(user).some((entry) => entry.name === className);
  }

  return false;
}

function canAccessScanTask(user, task) {
  return canAccessClassName(user, task.className);
}

function canAccessCompositionSubmission(user, submission) {
  if (user.role === 'Admin') {
    return true;
  }

  if (user.role === 'Teacher') {
    return getTeacherClasses(user).some((entry) => entry.id === submission.classId || entry.name === submission.className);
  }

  return submission.studentId === user.linkedStudentId;
}

const seedStore = {
  users: [
    { id: 'U-01', role: 'Admin', name: 'System Admin', username: 'admin', passwordHash: hashPassword('admin123') },
    { id: 'U-02', role: 'Teacher', name: 'Ms. Lin', username: 'mlin', passwordHash: hashPassword('teacher123'), linkedTeacherId: 'T-01' },
    { id: 'U-03', role: 'Student', name: 'Alicia Tan', username: 'g7-001', passwordHash: hashPassword('student123'), linkedStudentId: 'S-01' }
  ],
  teachers: [
    { id: 'T-01', name: 'Ms. Lin', phone: '555-1201', role: 'Homeroom Teacher', assignedClassIds: ['C-01'] },
    { id: 'T-02', name: 'Mr. Wong', phone: '555-1202', role: 'Teacher', assignedClassIds: ['C-01', 'C-02'] },
    { id: 'T-03', name: 'Ms. Nur', phone: '555-1203', role: 'Teacher', assignedClassIds: ['C-03'] }
  ],
  classes: [
    { id: 'C-01', name: 'Grade 7 Jade', grade: 'Grade 7', homeroomTeacherId: 'T-01', studentCount: 42 },
    { id: 'C-02', name: 'Grade 8 Harbor', grade: 'Grade 8', homeroomTeacherId: 'T-02', studentCount: 39 },
    { id: 'C-03', name: 'Grade 9 Cedar', grade: 'Grade 9', homeroomTeacherId: 'T-03', studentCount: 36 }
  ],
  students: [
    { id: 'S-01', name: 'Alicia Tan', classId: 'C-01', studentNo: 'G7-001', accuracy: 0.84, weakTags: ['Fractions', 'Word Problems'] },
    { id: 'S-02', name: 'Jun Wei', classId: 'C-01', studentNo: 'G7-002', accuracy: 0.72, weakTags: ['Composition', 'Grammar'] },
    { id: 'S-03', name: 'Nur Aisyah', classId: 'C-03', studentNo: 'G9-015', accuracy: 0.9, weakTags: ['Geometry'] }
  ],
  compositionSubmissions: [
    {
      id: 'COMP-01',
      studentId: 'S-01',
      studentName: 'Alicia Tan',
      classId: 'C-01',
      className: 'Grade 7 Jade',
      testCode: 'ENG-COMP-01',
      promptTitle: 'The Day I Almost Gave Up',
      promptText: 'Write a short reflection on a difficult school moment and explain how you moved forward.',
      shortAnswer: 'I first felt embarrassed after doing badly on a timed practice.',
      essayText: 'At first I wanted to avoid the next test, but my teacher asked me to write down one small step I could still take. I reviewed my mistakes, asked for help, and slowly became less afraid of trying again. The turning point was not a miracle score. It was realizing that steady effort changed my confidence before it changed my marks.',
      status: 'Teacher Reviewing',
      submittedAt: '2026-04-28T13:10:00.000Z',
      updatedAt: '2026-04-28T16:45:00.000Z',
      teacherSummary: 'Good emotional arc and clear reflection. Add one sharper scene at the beginning for stronger engagement.',
      aiSuggestion: 'Strengthen the opening image and add one sentence about how the review plan worked day by day.',
      overallBand: 'Developing'
    }
  ],
  scanTasks: [
    {
      id: 'ST-210',
      type: 'Teacher Paper',
      printer: 'Printer-07',
      className: 'Grade 7 Jade',
      subject: 'Mathematics',
      paperName: 'Midterm A',
      status: 'Answer Completed'
    },
    {
      id: 'ST-214',
      type: 'Student Paper',
      printer: 'Printer-07',
      className: 'Grade 7 Jade',
      subject: 'Mathematics',
      paperName: 'Midterm A',
      status: 'In Grading',
      linkedAnswerPaper: 'Midterm A'
    },
    {
      id: 'ST-219',
      type: 'Teacher Paper',
      printer: 'Printer-03',
      className: 'Grade 9 Cedar',
      subject: 'Composition',
      paperName: 'Malay Essay 3',
      status: 'Pending Segmentation'
    }
  ],
  answerBanks: [
    {
      id: 'AB-01',
      paperName: 'Midterm A',
      subject: 'Mathematics',
      questionStem: 'Q2 Solve the fraction comparison problem and show working.',
      score: 4,
      rubric: 'Award process marks for simplification, comparison logic, and final conclusion.',
      status: 'Ready for Grading'
    },
    {
      id: 'AB-02',
      paperName: 'Chinese Composition 5',
      subject: 'Composition',
      questionStem: 'Discuss a memorable person and explain why the memory remains vivid.',
      score: 30,
      rubric: 'Content, organization, language control, relevance, and expression.',
      status: 'Teacher Review'
    }
  ],
  results: [
    {
      id: 'R-01',
      studentName: 'Alicia Tan',
      className: 'Grade 7 Jade',
      paperName: 'Midterm A',
      score: 84,
      total: 100,
      reviewState: 'Ready',
      errorReason: 'Lost points on fraction justification in Q2.'
    },
    {
      id: 'R-02',
      studentName: 'Jun Wei',
      className: 'Grade 7 Jade',
      paperName: 'Midterm A',
      score: 71,
      total: 100,
      reviewState: 'Needs Review',
      errorReason: 'Essay segmentation confidence is low on second page.'
    },
    {
      id: 'R-03',
      studentName: 'Nur Aisyah',
      className: 'Grade 9 Cedar',
      paperName: 'Malay Essay 3',
      score: 25,
      total: 30,
      reviewState: 'Adjusted',
      errorReason: 'Teacher raised content score after reviewing context.'
    }
  ]
};

let store = structuredClone(seedStore);

const clone = (value) => JSON.parse(JSON.stringify(value));
const nextId = (prefix, length) => `${prefix}-${String(length + 1).padStart(2, '0')}`;
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error, uploadsDir);
    }
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    cb(isPdf ? null : new Error('Only PDF uploads are supported.'), isPdf);
  }
});

async function ensureStoreFile() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(storePath, JSON.stringify(seedStore, null, 2));
  }
}

async function loadStore() {
  await ensureStoreFile();
  const raw = await fs.readFile(storePath, 'utf8');
  store = JSON.parse(raw);
  let changed = false;
  if (!Array.isArray(store.users)) {
    store.users = clone(seedStore.users);
    changed = true;
  } else {
    store.users = store.users.map((user) => {
      if (user.passwordHash) {
        return user;
      }

      if (user.password) {
        changed = true;
        return {
          ...user,
          passwordHash: hashPassword(String(user.password)),
          password: undefined
        };
      }

      changed = true;
      return {
        ...user,
        passwordHash: hashPassword('changeme123')
      };
    }).map((user) => {
      const { password, ...safeUserRecord } = user;
      return safeUserRecord;
    });
  }

  if (Array.isArray(store.scanTasks)) {
    store.scanTasks = store.scanTasks.map((task) => {
      if (!task.fileUrl) {
        return task;
      }

      if (String(task.fileUrl).startsWith('/uploads/')) {
        changed = true;
        return {
          ...task,
          fileUrl: String(task.fileUrl).replace('/uploads/', '/api/uploads/')
        };
      }

      return task;
    });
  }

  if (!Array.isArray(store.compositionSubmissions)) {
    store.compositionSubmissions = clone(seedStore.compositionSubmissions);
    changed = true;
  }

  if (changed) {
    await saveStore();
  }
}

async function saveStore() {
  await fs.writeFile(storePath, JSON.stringify(store, null, 2));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, persisted: true });
});

app.get('/api/public/classes', (_req, res) => {
  res.json(clone(store.classes.map(({ id, name, grade }) => ({ id, name, grade }))));
});

app.get('/api/uploads/:filename', requireRole('Admin', 'Teacher'), async (req, res) => {
  const { filename } = req.params;
  const task = store.scanTasks.find(
    (entry) =>
      entry.fileUrl === `/api/uploads/${filename}` ||
      entry.fileName === filename ||
      String(entry.fileUrl ?? '').endsWith(`/${filename}`)
  );

  if (!task) {
    res.status(404).send('Uploaded file not found.');
    return;
  }

  if (!canAccessScanTask(req.authUser, task)) {
    res.status(403).send('You do not have permission to access this uploaded file.');
    return;
  }

  const filePath = path.join(uploadsDir, filename);
  try {
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.status(404).send('Uploaded file is missing on disk.');
  }
});

app.get('/api/auth/session', (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).send('No active session.');
    return;
  }

  res.json(clone({ user: sanitizeUser(user) }));
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).send('Missing login fields.');
    return;
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  const user = store.users.find((entry) => entry.username.toLowerCase() === normalizedUsername);

  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    res.status(401).send('Invalid username or password.');
    return;
  }

  const token = createSession(user.id);
  setSessionCookie(res, token);
  res.json(clone({ user: sanitizeUser(user) }));
});

app.post('/api/auth/register', async (req, res) => {
  const { role, name, username, password, phone, teacherRole, classId, studentNo } = req.body ?? {};
  if (!role || !name || !username || !password) {
    res.status(400).send('Missing registration fields.');
    return;
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  if (store.users.some((entry) => entry.username.toLowerCase() === normalizedUsername)) {
    res.status(409).send('Username already exists.');
    return;
  }

  const user = {
    id: nextId('U', store.users.length),
    role,
    name,
    username: normalizedUsername,
    passwordHash: hashPassword(String(password))
  };

  if (role === 'Teacher') {
    if (!phone) {
      res.status(400).send('Teacher registration requires a phone number.');
      return;
    }

    const teacher = {
      id: nextId('T', store.teachers.length),
      name,
      phone,
      role: teacherRole || 'Teacher',
      assignedClassIds: []
    };
    store.teachers.unshift(teacher);
    user.linkedTeacherId = teacher.id;
  } else if (role === 'Student') {
    if (!classId || !studentNo) {
      res.status(400).send('Student registration requires class and student number.');
      return;
    }

    const student = {
      id: nextId('S', store.students.length),
      name,
      classId,
      studentNo,
      accuracy: 0,
      weakTags: ['Pending diagnosis']
    };
    store.students.unshift(student);
    user.linkedStudentId = student.id;

    const targetClass = store.classes.find((item) => item.id === classId);
    if (targetClass) {
      targetClass.studentCount += 1;
    }
  } else if (role !== 'Admin') {
    res.status(400).send('Unsupported role.');
    return;
  }

  store.users.unshift(user);
  await saveStore();
  const token = createSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json(clone({ user: sanitizeUser(user) }));
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[sessionCookieName];
  if (token) {
    sessions.delete(token);
  }

  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/teachers', requireRole('Admin', 'Teacher'), (req, res) => {
  const user = req.authUser;
  if (user.role === 'Teacher') {
    const teacher = store.teachers.find((entry) => entry.id === user.linkedTeacherId);
    res.json(clone(teacher ? [teacher] : []));
    return;
  }

  res.json(clone(store.teachers));
});

app.post('/api/teachers', requireRole('Admin'), async (req, res) => {
  const { name, phone, role } = req.body ?? {};
  if (!name || !phone || !role) {
    res.status(400).send('Missing teacher fields.');
    return;
  }

  const teacher = {
    id: nextId('T', store.teachers.length),
    name,
    phone,
    role,
    assignedClassIds: []
  };
  store.teachers.unshift(teacher);
  await saveStore();
  res.status(201).json(clone(teacher));
});

app.get('/api/classes', requireSession, (req, res) => {
  const user = req.authUser;
  if (user.role === 'Admin') {
    res.json(clone(store.classes));
    return;
  }

  if (user.role === 'Teacher') {
    res.json(clone(getTeacherClasses(user)));
    return;
  }

  const student = getStudentRecord(user);
  const classes = student ? store.classes.filter((entry) => entry.id === student.classId) : [];
  res.json(clone(classes));
});

app.post('/api/classes', requireRole('Admin', 'Teacher'), async (req, res) => {
  const { name, grade, homeroomTeacherId } = req.body ?? {};
  if (!name || !grade || !homeroomTeacherId) {
    res.status(400).send('Missing class fields.');
    return;
  }

  const schoolClass = {
    id: nextId('C', store.classes.length),
    name,
    grade,
    homeroomTeacherId,
    studentCount: 0
  };
  store.classes.unshift(schoolClass);
  const teacher = store.teachers.find((item) => item.id === homeroomTeacherId);
  if (teacher && !teacher.assignedClassIds.includes(schoolClass.id)) {
    teacher.assignedClassIds.push(schoolClass.id);
  }
  await saveStore();
  res.status(201).json(clone(schoolClass));
});

app.get('/api/students', requireSession, (req, res) => {
  const user = req.authUser;
  if (user.role === 'Admin') {
    res.json(clone(store.students));
    return;
  }

  if (user.role === 'Teacher') {
    const classIds = new Set(getTeacherClasses(user).map((entry) => entry.id));
    res.json(clone(store.students.filter((entry) => classIds.has(entry.classId))));
    return;
  }

  const student = getStudentRecord(user);
  res.json(clone(student ? [student] : []));
});

app.post('/api/students/import', requireRole('Admin', 'Teacher'), async (req, res) => {
  const { classId, csvText } = req.body ?? {};
  if (!classId || !csvText) {
    res.status(400).send('Missing import fields.');
    return;
  }

  if (req.authUser.role === 'Teacher') {
    const allowedClassIds = new Set(getTeacherClasses(req.authUser).map((entry) => entry.id));
    if (!allowedClassIds.has(classId)) {
      res.status(403).send('Teachers can only import students into their own classes.');
      return;
    }
  }

  const rows = String(csvText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const imported = rows.map((row, index) => {
    const [name, studentNo] = row.split(',').map((part) => part.trim());
    return {
      id: nextId('S', store.students.length + index),
      name: name || `Student ${store.students.length + index + 1}`,
      classId,
      studentNo: studentNo || `AUTO-${store.students.length + index + 1}`,
      accuracy: 0.7,
      weakTags: ['Pending diagnosis']
    };
  });

  store.students.unshift(...imported);
  const targetClass = store.classes.find((item) => item.id === classId);
  if (targetClass) {
    targetClass.studentCount += imported.length;
  }
  await saveStore();
  res.status(201).json(clone(imported));
});

app.get('/api/composition-submissions', requireSession, (req, res) => {
  const visible = store.compositionSubmissions
    .filter((entry) => canAccessCompositionSubmission(req.authUser, entry))
    .sort((left, right) => String(right.submittedAt).localeCompare(String(left.submittedAt)));
  res.json(clone(visible));
});

app.post('/api/composition-submissions', requireRole('Student'), async (req, res) => {
  const { testCode, promptTitle, promptText, shortAnswer, essayText } = req.body ?? {};
  if (!testCode || !promptTitle || !promptText || !shortAnswer || !essayText) {
    res.status(400).send('Missing composition submission fields.');
    return;
  }

  const student = getStudentRecord(req.authUser);
  if (!student) {
    res.status(400).send('Student profile not found.');
    return;
  }

  const schoolClass = getClassRecord(student.classId);
  if (!schoolClass) {
    res.status(400).send('Student class not found.');
    return;
  }

  const timestamp = new Date().toISOString();
  const submission = {
    id: nextId('COMP', store.compositionSubmissions.length),
    studentId: student.id,
    studentName: student.name,
    classId: student.classId,
    className: schoolClass.name,
    testCode,
    promptTitle,
    promptText,
    shortAnswer,
    essayText,
    status: 'Received',
    submittedAt: timestamp,
    updatedAt: timestamp,
    teacherSummary: '',
    aiSuggestion: 'Submission received. AI review suggestions will appear here after processing.',
    overallBand: 'Pending'
  };

  store.compositionSubmissions.unshift(submission);
  await saveStore();
  res.status(201).json(clone(submission));
});

app.put('/api/composition-submissions/:id', requireRole('Admin', 'Teacher'), async (req, res) => {
  const { id } = req.params;
  const { status, teacherSummary, aiSuggestion, overallBand } = req.body ?? {};
  const submission = store.compositionSubmissions.find((entry) => entry.id === id);

  if (!submission) {
    res.status(404).send('Composition submission not found.');
    return;
  }

  if (!canAccessCompositionSubmission(req.authUser, submission)) {
    res.status(403).send('You do not have permission to update this composition submission.');
    return;
  }

  if (!status) {
    res.status(400).send('Missing composition status.');
    return;
  }

  submission.status = status;
  submission.teacherSummary = teacherSummary ?? submission.teacherSummary ?? '';
  submission.aiSuggestion = aiSuggestion ?? submission.aiSuggestion ?? '';
  submission.overallBand = overallBand ?? submission.overallBand ?? 'Pending';
  submission.updatedAt = new Date().toISOString();

  await saveStore();
  res.json(clone(submission));
});

const EVAL_DIMENSIONS = [
  { id: 'D1', name: 'Narrative Logic', desc: 'Structure, turning-point setup, and story pacing' },
  { id: 'D2', name: 'Idea Depth', desc: 'Reasoning depth, reflection quality, and insight' },
  { id: 'D3', name: 'Paragraph Shape', desc: 'Paragraph control, layering, and contrast between sections' },
  { id: 'D4', name: 'Personal Voice', desc: 'Originality, personal perspective, and authentic stance' },
  { id: 'D5', name: 'Prompt Alignment', desc: 'Prompt fit, relevance, and material selection' },
  { id: 'D6', name: 'Genre Control', desc: 'Writing mode control and form appropriateness' },
  { id: 'D7', name: 'Values & Reflection', desc: 'Ethical framing, values clarity, and earned takeaway' },
  { id: 'D8', name: 'Review Stability', desc: 'Evidence clarity and consistency for grading' },
  { id: 'D9', name: 'Cultural Fit', desc: 'Theme connection and contextual awareness' },
  { id: 'D10', name: 'Growth Trajectory', desc: 'Writing maturity and developmental level shown' },
  { id: 'D11', name: 'Final Recommendation', desc: 'Overall judgment, band suggestion, and next-step advice' }
];

function generateMockEvaluation(submission) {
  const wordCount = (submission.essayText || '').trim().split(/\s+/).filter(Boolean).length;
  const base = Math.min(4.2, Math.max(1.5, 2.2 + (wordCount / 160)));
  const snap = (v) => Math.round(Math.min(5, Math.max(1, v)) * 2) / 2;
  const mockComments = [
    'The essay demonstrates clear effort in this area and would benefit from further development.',
    'This dimension shows developing competence; the student handles it with reasonable confidence.',
    'Solid work here. Minor refinements would push this into the next band.',
    'A strength of the essay. The student handles this with natural ease.',
    'Needs more intentional effort. The writing is present but not yet controlled here.'
  ];
  const dims = EVAL_DIMENSIONS.map((d, i) => ({
    id: d.id,
    score: snap(base + (((i * 7 + 3) % 5) - 2) * 0.3),
    comment: mockComments[i % mockComments.length]
  }));
  const avg = dims.reduce((s, d) => s + d.score, 0) / dims.length;
  const overallScore = Math.round((avg / 5) * 100);
  const overallBand = overallScore >= 78 ? 'Advanced' : overallScore >= 56 ? 'Secure' : 'Developing';
  return {
    dimensions: dims,
    overallScore,
    overallBand,
    overallComment: `This composition demonstrates ${overallBand.toLowerCase()} writing skills. The student engages personally with the prompt and shows a developing sense of structure. Continued practice in deepening reflection and controlling paragraph purpose will strengthen future submissions.`,
    strengths: ['Clear personal engagement with the prompt topic', 'Logical progression from experience to reflection'],
    improvements: ['Deepen insight beyond surface-level event description', 'Strengthen paragraph transitions and structural contrast'],
    evaluatedAt: new Date().toISOString()
  };
}

async function evaluateEssay(submission) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return generateMockEvaluation(submission);

  const dimList = EVAL_DIMENSIONS.map(d => `- ${d.id}: ${d.name} — ${d.desc}`).join('\n');
  const userMsg = `You are an experienced writing teacher. Evaluate the student composition below on 11 dimensions (score 1.0–5.0 in 0.5 steps) and return ONLY a JSON object.

Prompt: "${submission.promptTitle}"
${submission.promptText}

Student short answer: ${submission.shortAnswer}

Essay:
${submission.essayText}

Dimensions to score:
${dimList}

Return exactly this JSON shape (no markdown, no extra text):
{
  "dimensions": [
    {"id":"D1","score":3.5,"comment":"one sentence"},
    {"id":"D2","score":4.0,"comment":"one sentence"},
    {"id":"D3","score":3.0,"comment":"one sentence"},
    {"id":"D4","score":3.5,"comment":"one sentence"},
    {"id":"D5","score":4.0,"comment":"one sentence"},
    {"id":"D6","score":3.5,"comment":"one sentence"},
    {"id":"D7","score":4.0,"comment":"one sentence"},
    {"id":"D8","score":3.0,"comment":"one sentence"},
    {"id":"D9","score":3.5,"comment":"one sentence"},
    {"id":"D10","score":3.0,"comment":"one sentence"},
    {"id":"D11","score":3.5,"comment":"one sentence"}
  ],
  "overallScore": 72,
  "overallBand": "Secure",
  "overallComment": "2-3 sentences about the essay",
  "strengths": ["specific strength 1", "specific strength 2"],
  "improvements": ["specific improvement 1", "specific improvement 2"]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    if (!response.ok) throw new Error(`Anthropic ${response.status}`);
    const data = await response.json();
    const text = data.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    const result = JSON.parse(match[0]);
    result.evaluatedAt = new Date().toISOString();
    return result;
  } catch (err) {
    console.error('LLM evaluation failed, using mock:', err.message);
    return generateMockEvaluation(submission);
  }
}

app.post('/api/composition-submissions/:id/evaluate', requireRole('Admin', 'Teacher'), async (req, res) => {
  const { id } = req.params;
  const submission = store.compositionSubmissions.find((e) => e.id === id);
  if (!submission) {
    res.status(404).send('Submission not found.');
    return;
  }
  if (!canAccessCompositionSubmission(req.authUser, submission)) {
    res.status(403).send('You do not have permission to evaluate this submission.');
    return;
  }
  try {
    const evaluation = await evaluateEssay(submission);
    submission.evaluation = evaluation;
    await saveStore();
    res.json(clone(submission));
  } catch (err) {
    res.status(500).send(`Evaluation failed: ${err.message}`);
  }
});

app.get('/api/scan-tasks', requireRole('Admin', 'Teacher'), (req, res) => {
  const user = req.authUser;
  if (user.role === 'Admin') {
    res.json(clone(store.scanTasks));
    return;
  }

  const classNames = new Set(getTeacherClasses(user).map((entry) => entry.name));
  res.json(clone(store.scanTasks.filter((entry) => classNames.has(entry.className))));
});

app.post('/api/scan-tasks', requireRole('Admin', 'Teacher'), async (req, res) => {
  const { type, printer, className, subject, paperName, linkedAnswerPaper } = req.body ?? {};
  if (!type || !printer || !className || !subject || !paperName) {
    res.status(400).send('Missing scan task fields.');
    return;
  }

  if (req.authUser.role === 'Teacher') {
    const allowedClassNames = new Set(getTeacherClasses(req.authUser).map((entry) => entry.name));
    if (!allowedClassNames.has(className)) {
      res.status(403).send('Teachers can only create scan tasks for their own classes.');
      return;
    }
  }

  const scanTask = {
    id: nextId('ST', store.scanTasks.length),
    type,
    printer,
    className,
    subject,
    paperName,
    status: type === 'Teacher Paper' ? 'Pending Segmentation' : 'In Grading',
    ...(linkedAnswerPaper ? { linkedAnswerPaper } : {})
  };

  store.scanTasks.unshift(scanTask);
  await saveStore();
  res.status(201).json(clone(scanTask));
});

app.post('/api/scan-tasks/:id/upload', requireRole('Admin', 'Teacher'), upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const task = store.scanTasks.find((entry) => entry.id === id);

  if (!task) {
    res.status(404).send('Scan task not found.');
    return;
  }

  if (req.authUser.role === 'Teacher') {
    const allowedClassNames = new Set(getTeacherClasses(req.authUser).map((entry) => entry.name));
    if (!allowedClassNames.has(task.className)) {
      res.status(403).send('Teachers can only upload files for their own classes.');
      return;
    }
  }

  if (!req.file) {
    res.status(400).send('Missing PDF file.');
    return;
  }

  task.fileName = req.file.originalname;
  task.fileUrl = `/api/uploads/${req.file.filename}`;
  task.uploadedAt = new Date().toISOString();
  task.status = task.type === 'Teacher Paper' ? 'Pending Segmentation' : 'In Grading';

  await saveStore();
  res.json(clone(task));
});

app.get('/api/answer-banks', requireRole('Admin', 'Teacher'), (req, res) => {
  const user = req.authUser;
  if (user.role === 'Admin') {
    res.json(clone(store.answerBanks.filter((entry) => !entry.archivedAt)));
    return;
  }

  const teacherClasses = getTeacherClasses(user);
  const allowedPaperNames = new Set(
    store.scanTasks
      .filter((entry) => teacherClasses.some((schoolClass) => schoolClass.name === entry.className))
      .map((entry) => entry.paperName)
  );
  res.json(
    clone(
      store.answerBanks.filter(
        (entry) => !entry.archivedAt && (allowedPaperNames.has(entry.paperName) || entry.createdByUserId === user.id)
      )
    )
  );
});

app.get('/api/answer-banks/archived', requireRole('Admin', 'Teacher'), (req, res) => {
  const user = req.authUser;
  if (user.role === 'Admin') {
    res.json(clone(store.answerBanks.filter((entry) => entry.archivedAt)));
    return;
  }

  res.json(clone(store.answerBanks.filter((entry) => entry.archivedAt && entry.createdByUserId === user.id)));
});

app.post('/api/answer-banks', requireRole('Admin', 'Teacher'), async (req, res) => {
  const { paperName, subject, grade, topic, difficulty, questionStem, score, rubric, status } = req.body ?? {};
  if (!paperName || !subject || !questionStem || typeof score !== 'number' || !rubric || !status) {
    res.status(400).send('Missing answer bank fields.');
    return;
  }

  const item = {
    id: nextId('AB', store.answerBanks.length),
    paperName,
    subject,
    grade: grade || '',
    topic: topic || '',
    difficulty: difficulty || 'Standard',
    questionStem,
    score,
    rubric,
    status,
    createdByUserId: req.authUser.id,
    createdByName: req.authUser.name
  };

  store.answerBanks.unshift(item);
  await saveStore();
  res.status(201).json(clone(item));
});

app.put('/api/answer-banks/:id', requireRole('Admin', 'Teacher'), async (req, res) => {
  const { id } = req.params;
  const { grade, topic, difficulty, questionStem, score, rubric, status } = req.body ?? {};
  const item = store.answerBanks.find((entry) => entry.id === id);

  if (!item) {
    res.status(404).send('Answer bank item not found.');
    return;
  }

  if (req.authUser.role === 'Teacher') {
    const allowedPaperNames = new Set(
      store.scanTasks
        .filter((entry) => getTeacherClasses(req.authUser).some((schoolClass) => schoolClass.name === entry.className))
        .map((entry) => entry.paperName)
    );
    if (!allowedPaperNames.has(item.paperName)) {
      res.status(403).send('Teachers can only edit answer banks for their own classes.');
      return;
    }
  }

  if (!questionStem || typeof score !== 'number' || !rubric || !status) {
    res.status(400).send('Missing answer bank fields.');
    return;
  }

  item.questionStem = questionStem;
  item.grade = grade || '';
  item.topic = topic || '';
  item.difficulty = difficulty || 'Standard';
  item.score = score;
  item.rubric = rubric;
  item.status = status;

  await saveStore();
  res.json(clone(item));
});

app.post('/api/answer-banks/:id/archive', requireRole('Admin', 'Teacher'), async (req, res) => {
  const { id } = req.params;
  const item = store.answerBanks.find((entry) => entry.id === id);

  if (!item) {
    res.status(404).send('Answer bank item not found.');
    return;
  }

  if (req.authUser.role === 'Teacher' && item.createdByUserId !== req.authUser.id) {
    res.status(403).send('Teachers can only archive question bank items they created.');
    return;
  }

  item.archivedAt = new Date().toISOString();
  item.archivedByUserId = req.authUser.id;

  await saveStore();
  res.json({ ok: true, id });
});

app.post('/api/answer-banks/:id/restore', requireRole('Admin', 'Teacher'), async (req, res) => {
  const { id } = req.params;
  const item = store.answerBanks.find((entry) => entry.id === id);

  if (!item) {
    res.status(404).send('Answer bank item not found.');
    return;
  }

  if (!item.archivedAt) {
    res.status(400).send('Answer bank item is not archived.');
    return;
  }

  if (req.authUser.role === 'Teacher' && item.createdByUserId !== req.authUser.id) {
    res.status(403).send('Teachers can only restore question bank items they created.');
    return;
  }

  delete item.archivedAt;
  delete item.archivedByUserId;

  await saveStore();
  res.json({ ok: true, id });
});

app.get('/api/results', requireSession, (req, res) => {
  const user = req.authUser;
  if (user.role === 'Admin') {
    res.json(clone(store.results));
    return;
  }

  if (user.role === 'Teacher') {
    const allowedClassNames = new Set(getTeacherClasses(user).map((entry) => entry.name));
    res.json(clone(store.results.filter((entry) => allowedClassNames.has(entry.className))));
    return;
  }

  const student = getStudentRecord(user);
  res.json(clone(student ? store.results.filter((entry) => entry.studentName === student.name) : []));
});

app.put('/api/results/:id', requireRole('Admin', 'Teacher'), async (req, res) => {
  const { id } = req.params;
  const { score, reviewState, errorReason } = req.body ?? {};
  const item = store.results.find((entry) => entry.id === id);

  if (!item) {
    res.status(404).send('Result item not found.');
    return;
  }

  if (req.authUser.role === 'Teacher') {
    const allowedClassNames = new Set(getTeacherClasses(req.authUser).map((entry) => entry.name));
    if (!allowedClassNames.has(item.className)) {
      res.status(403).send('Teachers can only update results for their own classes.');
      return;
    }
  }

  if (typeof score !== 'number' || !reviewState || !errorReason) {
    res.status(400).send('Missing result fields.');
    return;
  }

  item.score = score;
  item.reviewState = reviewState;
  item.errorReason = errorReason;

  await saveStore();
  res.json(clone(item));
});

await loadStore();

app.listen(PORT, '127.0.0.1', () => {
  console.log(`LearnCoach AI 学习教练 API running on http://127.0.0.1:${PORT}`);
  console.log(`Persisted data file: ${storePath}`);
});
