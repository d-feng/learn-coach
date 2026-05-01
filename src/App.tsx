import { Component, useEffect, useMemo, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import lcLogo from './LC-logo.png';
import { HashRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileCheck2,
  FileSearch,
  FolderKanban,
  GraduationCap,
  LibraryBig,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Music,
  PenLine,
  Printer,
  ScanLine,
  School,
  Sparkles,
  Upload,
  UserCog,
  UsersRound
} from 'lucide-react';
import {
  mockApi,
  type AnswerBankItem,
  type AuthUser,
  type CompositionSubmission,
  type CompositionSubmissionStatus,
  type CreateCompositionSubmissionInput,
  type CreateAnswerBankInput,
  type CreateScanTaskInput,
  type EssayEvaluation,
  type QuestionDifficulty,
  type RegisterInput,
  type Role,
  type ScanTask,
  type SchoolClass,
  type Student,
  type StudentResult,
  type Teacher,
  type TeacherRole,
  type UpdateCompositionSubmissionInput,
  type UpdateStudentResultInput,
  type UpdateAnswerBankInput
} from './mockApi';

type ViewKey =
  | 'overview'
  | 'teacher-registration'
  | 'class-management'
  | 'test-grading'
  | 'paper-grading'
  | 'question-bank'
  | 'analytics'
  | 'composition-test'
  | 'wrong-questions'
  | 'practice'
  | 'score-history'
  | 'audio-tools';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: typeof School;
}

const roleSummary: Record<Role, { title: string; cn: string; subtitle: string }> = {
  Admin: {
    title: 'School Administrator',
    cn: 'Admin',
    subtitle: 'Teacher registration, class operations, school analytics, and shared question assets.'
  },
  Teacher: {
    title: 'Teacher',
    cn: 'Teacher',
    subtitle: 'Teacher paper upload, segmentation, answer bank review, grading, and result exports.'
  },
  Student: {
    title: 'Student',
    cn: 'Student',
    subtitle: 'Wrong-question review, targeted practice, score tracking, and personal feedback.'
  }
};

const navByRole: Record<Role, NavItem[]> = {
  Admin: [
    { key: 'overview', label: 'Overview', icon: School },
    { key: 'teacher-registration', label: 'Teacher Registration', icon: UserCog },
    { key: 'class-management', label: 'Class Management', icon: UsersRound },
    { key: 'question-bank', label: 'Question Bank', icon: LibraryBig },
    { key: 'analytics', label: 'Learning Analytics', icon: BarChart3 },
    { key: 'audio-tools', label: 'Audio Tools', icon: Music }
  ],
  Teacher: [
    { key: 'overview', label: 'Overview', icon: GraduationCap },
    { key: 'test-grading', label: 'Test Grading', icon: ClipboardList },
    { key: 'paper-grading', label: 'Paper Grading', icon: FileSearch },
    { key: 'question-bank', label: 'Answer Bank', icon: FolderKanban },
    { key: 'analytics', label: 'Class Analytics', icon: BarChart3 },
    { key: 'class-management', label: 'Student Import', icon: UsersRound },
    { key: 'audio-tools', label: 'Audio Tools', icon: Music }
  ],
  Student: [
    { key: 'overview', label: 'Overview', icon: BookOpenCheck },
    { key: 'composition-test', label: 'Composition Test', icon: PenLine },
    { key: 'wrong-questions', label: 'Wrong Questions', icon: FileCheck2 },
    { key: 'practice', label: 'Practice Queue', icon: PenLine },
    { key: 'score-history', label: 'Score History', icon: BarChart3 }
  ]
};

const workflow = [
  {
    title: 'Upload Teacher Paper',
    cn: 'Teacher answer paper upload',
    icon: Upload,
    status: 'Completed',
    detail: 'Printer scan task records printer number, class, subject, and teacher answer PDF.'
  },
  {
    title: 'Segment Questions',
    cn: 'Question segmentation',
    icon: ScanLine,
    status: 'Pending review',
    detail: 'Identity box first, then major question blocks or composition prompt and body ranges.'
  },
  {
    title: 'Generate Answer Bank',
    cn: 'AI answer generation',
    icon: Sparkles,
    status: 'Answer completed',
    detail: 'The teacher can fix stems, scores, answers, and AI scoring rubrics before release.'
  },
  {
    title: 'Upload Student Papers',
    cn: 'Student paper upload',
    icon: Printer,
    status: 'Ready',
    detail: 'Student scans are linked to the chosen teacher paper before grading starts.'
  },
  {
    title: 'Correction and Trace',
    cn: 'Correction output',
    icon: FileCheck2,
    status: 'In grading',
    detail: 'Preview, score, error reason, original trace, printable trace, and Excel export all live here.'
  }
];

const subjectRules = [
  ['Chinese', 'Composition prompts and bodies must be separated during segmentation.'],
  ['Mathematics', 'Multiple choice is cut by question; calculation and solution tasks by major section.'],
  ['English', 'Segment by major question for answer extraction and grading.'],
  ['Composition', 'Identity fields and writing body are isolated; V1.1 uses fixed-page templates.']
] as const;

const grades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];

function safeDate(value: string | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function scoreColor(score: number): string {
  if (score >= 4.0) return '#22c55e';
  if (score >= 3.0) return '#eab308';
  if (score >= 2.0) return '#f97316';
  return '#ef4444';
}

type AdvancedTab = 'sample' | 'history' | 'class';
const subjects: Array<CreateScanTaskInput['subject']> = ['Chinese', 'Mathematics', 'English', 'Composition'];
const questionDifficulties: QuestionDifficulty[] = ['Foundation', 'Standard', 'Advanced'];
const scanTaskTypes: Array<CreateScanTaskInput['type']> = ['Teacher Paper', 'Student Paper'];
const answerStatuses: Array<AnswerBankItem['status']> = ['Teacher Review', 'Ready for Grading'];
const resultStatuses: Array<StudentResult['reviewState']> = ['Ready', 'Needs Review', 'Adjusted'];
const compositionStatuses: CompositionSubmissionStatus[] = ['Received', 'AI Reviewing', 'Teacher Reviewing', 'Completed'];
const compositionBands = ['Pending', 'Developing', 'Secure', 'Advanced'];

const compositionClusterExamples = [
  { title: 'Writing Quality', essayA: 2.5, essayB: 3.6, detail: 'Structure, logic, and voice from D1-D4.' },
  { title: 'Evidence Use', essayA: 3.1, essayB: 4.1, detail: 'Prompt alignment, material use, and reflective depth from D5-D8.' },
  { title: 'Overall Evaluation', essayA: 3.0, essayB: 4.2, detail: 'Growth trajectory, culture fit, and final recommendation from D9-D11.' }
] as const;

const compositionDimensionExamples = [
  { id: 'D1', title: 'Narrative Logic', cluster: 'Writing Quality', sub: 'Structure and turning-point setup', essayA: 2.5, essayB: 3.5, essayAText: 'Essay A has a complete beginning-middle-end arc, but the setback arrives too suddenly and needs stronger foreshadowing.', essayBText: 'Essay B transitions more naturally into conflict and keeps the reader oriented through each turn.', teacherView: 'Use this dimension to coach students on pacing, setup, and whether the emotional shift feels earned.' },
  { id: 'D2', title: 'Idea Depth', cluster: 'Writing Quality', sub: 'Reasoning and reflection depth', essayA: 3.0, essayB: 3.0, essayAText: 'Essay A clearly states the lesson learned, but it still summarizes growth more than it analyzes it.', essayBText: 'Essay B also stays fairly direct, though it begins to connect action with thought more deliberately.', teacherView: 'A live AI suggestion here could prompt students to explain why the turning point mattered, not just what happened.' },
  { id: 'D3', title: 'Paragraph Shape', cluster: 'Writing Quality', sub: 'Layering and paragraph control', essayA: 2.0, essayB: 3.5, essayAText: 'Essay A reads in one steady line, with limited contrast between setup, tension, and reflection paragraphs.', essayBText: 'Essay B creates clearer paragraph roles, so the reading experience feels more guided and mature.', teacherView: 'Teachers can use this dimension to explain when an essay needs stronger segmentation and paragraph purpose.' },
  { id: 'D4', title: 'Personal Voice', cluster: 'Writing Quality', sub: 'Originality and personal stance', essayA: 2.0, essayB: 4.5, essayAText: 'Essay A feels sincere, but its language and perspective are fairly common for this prompt type.', essayBText: 'Essay B shows stronger taste, perspective, and an individual way of interpreting the prompt.', teacherView: 'This is a strong AI coaching dimension for surfacing whether the student sounds generic or personally invested.' },
  { id: 'D5', title: 'Prompt Alignment', cluster: 'Evidence Use', sub: 'Prompt fit and material selection', essayA: 3.0, essayB: 4.0, essayAText: 'Essay A stays on prompt, but its supporting details remain close to the surface of the topic.', essayBText: 'Essay B selects references and examples more strategically to reinforce the core claim.', teacherView: 'This dimension is useful for teacher comments about relevance, evidence fit, and missing support.' },
  { id: 'D6', title: 'Genre Control', cluster: 'Evidence Use', sub: 'Writing mode and form control', essayA: 3.0, essayB: 4.0, essayAText: 'Essay A meets reflective-writing expectations, but the form still feels basic.', essayBText: 'Essay B begins to move beyond simple reflection toward a more controlled discussion style.', teacherView: 'The system can suggest when a student is still narrating events instead of shaping them into a proper essay form.' },
  { id: 'D7', title: 'Values and Reflection', cluster: 'Evidence Use', sub: 'Ethical frame and takeaway', essayA: 3.5, essayB: 4.0, essayAText: 'Essay A lands on a positive lesson about persistence and responsibility.', essayBText: 'Essay B frames imperfection with more nuance and maturity, which makes the reflection feel deeper.', teacherView: 'This gives teachers a place to comment on emotional maturity and whether the reflection feels earned.' },
  { id: 'D8', title: 'Review Stability', cluster: 'Evidence Use', sub: 'Evidence transparency for grading', essayA: 3.0, essayB: 3.0, essayAText: 'Essay A contains enough concrete evidence to grade consistently, though some reasoning remains implicit.', essayBText: 'Essay B is similarly stable for review, but both essays still need sharper proof chains to support higher marks.', teacherView: 'We can later plug live AI confidence and grading consistency indicators into this dimension.' },
  { id: 'D9', title: 'Cultural Fit', cluster: 'Overall Evaluation', sub: 'Theme and context connection', essayA: 3.0, essayB: 4.0, essayAText: 'Essay A matches familiar school values and the expected educational tone.', essayBText: 'Essay B connects personal insight to broader literary and cultural frames much more effectively.', teacherView: 'This dimension helps frame whether the student can place a personal response inside a larger context.' },
  { id: 'D10', title: 'Growth Trajectory', cluster: 'Overall Evaluation', sub: 'Development across attempts', essayA: 2.5, essayB: 4.5, essayAText: 'Essay A still sits in a more straightforward event-reporting mode.', essayBText: 'Essay B shows a clear move toward idea-shaping, synthesis, and stronger essay maturity.', teacherView: 'A live dashboard can surface this as a growth signal across drafts or across multiple composition tests.' },
  { id: 'D11', title: 'Final Recommendation', cluster: 'Overall Evaluation', sub: 'Overall judgment and next step', essayA: 3.0, essayB: 4.0, essayAText: 'Essay A is serviceable and clear, but would benefit most from stronger opening and deeper reflection.', essayBText: 'Essay B shows stronger promise, with the next step being tighter evidence chains and cleaner argument support.', teacherView: 'This is the teacher-facing takeaway dimension for banding, next-step advice, and summary comments.' }
] as const;

const availableTests = [
  {
    code: 'ENG-COMP-01',
    title: 'The Day I Almost Gave Up',
    subject: 'English Composition',
    prompt: 'Write a short reflection on a difficult school moment and explain how you moved forward. Use specific details to bring the experience to life.'
  },
  {
    code: 'ENG-COMP-02',
    title: 'A Person Who Changed My Perspective',
    subject: 'English Composition',
    prompt: 'Describe someone — a teacher, a family member, or a person you met briefly — who changed the way you see the world. Explain what they did and why it still stays with you.'
  },
  {
    code: 'ZH-COMP-01',
    title: '我最难忘的一次经历',
    subject: 'Chinese Composition',
    prompt: '请描述一次让你印象深刻、难以忘怀的经历，并说明它对你产生了怎样的影响。要求结构完整，语言生动，情感真实。'
  },
  {
    code: 'ZH-COMP-02',
    title: '残缺之美',
    subject: 'Chinese Composition',
    prompt: '有人说，残缺也是一种美。请你结合生活中的具体事例，谈谈你对"残缺之美"的理解与感悟。要求有观点，有论据，论证清晰。'
  }
] as const;

type AvailableTest = typeof availableTests[number];

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', background: '#fff0f0', border: '2px solid #f00', borderRadius: 8, margin: '1rem' }}>
          <strong style={{ color: '#c00', display: 'block', marginBottom: 8 }}>Render error (debug mode)</strong>
          <pre style={{ color: '#900', whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error.message}</pre>
          <pre style={{ color: '#666', whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 8 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const { user } = await mockApi.getSession();
        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin(input: { username: string; password: string }) {
    const { user } = await mockApi.login(input);
    setCurrentUser(user);
  }

  async function handleRegister(input: RegisterInput) {
    const { user } = await mockApi.register(input);
    setCurrentUser(user);
  }

  async function handleLogout() {
    await mockApi.logout();
    setCurrentUser(null);
  }

  if (authLoading) {
    return (
      <main className="authShell">
        <section className="authHero">
          <p className="eyebrow">LearnCoach AI 学习教练 Access</p>
          <h1>Restoring your session...</h1>
          <p>We are checking whether the server already has an active login for this browser.</p>
        </section>
        <section className="authPanel">
          <div className="loadingState">
            <LoaderCircle className="spin" size={18} />
            <span>Checking session</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to={currentUser ? canonicalPath(currentUser.role, 'overview') : '/auth'} replace />} />
        <Route
          path="/auth"
          element={currentUser ? <Navigate to={canonicalPath(currentUser.role, 'overview')} replace /> : <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />}
        />
        <Route
          path="/:roleSlug/:viewSlug?"
          element={currentUser ? <ErrorBoundary><RoutedApp currentUser={currentUser} onLogout={handleLogout} /></ErrorBoundary> : <Navigate to="/auth" replace />}
        />
        <Route path="*" element={<Navigate to={currentUser ? canonicalPath(currentUser.role, 'overview') : '/auth'} replace />} />
      </Routes>
    </HashRouter>
  );
}

function RoutedApp(props: { currentUser: AuthUser; onLogout: () => void }) {
  const navigate = useNavigate();
  const { roleSlug, viewSlug } = useParams();
  const { currentUser, onLogout } = props;
  const activeRole = currentUser.role;
  const requestedView = viewFromSlug(viewSlug);
  const activeView = requestedView && isViewForRole(activeRole, requestedView)
    ? requestedView
    : navByRole[activeRole][0].key;

  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scanTasks, setScanTasks] = useState<ScanTask[]>([]);
  const [answerBanks, setAnswerBanks] = useState<AnswerBankItem[]>([]);
  const [archivedAnswerBanks, setArchivedAnswerBanks] = useState<AnswerBankItem[]>([]);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [compositionSubmissions, setCompositionSubmissions] = useState<CompositionSubmission[]>([]);
  const [message, setMessage] = useState('');
  const [expandedDimensionId, setExpandedDimensionId] = useState('D1');
  const [editingAnswerBankId, setEditingAnswerBankId] = useState('');
  const [editingResultId, setEditingResultId] = useState('');
  const [selectedScanTaskId, setSelectedScanTaskId] = useState('');
  const [selectedCompositionId, setSelectedCompositionId] = useState('');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [aiStatusIndex, setAiStatusIndex] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<AdvancedTab>('sample');

  const [teacherForm, setTeacherForm] = useState({ name: '', phone: '', role: 'Teacher' as TeacherRole });
  const [classForm, setClassForm] = useState({ name: '', grade: grades[0], homeroomTeacherId: '' });
  const [scanTaskForm, setScanTaskForm] = useState<CreateScanTaskInput>({
    type: 'Teacher Paper',
    printer: 'Printer-01',
    className: '',
    subject: 'Mathematics',
    paperName: '',
    linkedAnswerPaper: ''
  });
  const [importForm, setImportForm] = useState({
    classId: '',
    csvText: 'Emma Khoo,G7-120\nFaris Lim,G7-121\nMina Ong,G7-122'
  });
  const [answerBankForm, setAnswerBankForm] = useState<UpdateAnswerBankInput>({
    grade: grades[0],
    topic: '',
    difficulty: 'Standard',
    questionStem: '',
    score: 1,
    rubric: '',
    status: 'Teacher Review'
  });
  const [newAnswerBankForm, setNewAnswerBankForm] = useState<CreateAnswerBankInput>({
    paperName: '',
    subject: 'Mathematics',
    grade: grades[0],
    topic: '',
    difficulty: 'Standard',
    questionStem: '',
    score: 1,
    rubric: '',
    status: 'Teacher Review'
  });
  const [resultForm, setResultForm] = useState<UpdateStudentResultInput>({
    score: 0,
    reviewState: 'Ready',
    errorReason: ''
  });
  const [compositionForm, setCompositionForm] = useState<CreateCompositionSubmissionInput>({
    testCode: 'ENG-COMP-01',
    promptTitle: 'The Day I Almost Gave Up',
    promptText: 'Write a short reflection on a difficult school moment and explain how you moved forward.',
    shortAnswer: '',
    essayText: ''
  });
  const [compositionReviewForm, setCompositionReviewForm] = useState<UpdateCompositionSubmissionInput>({
    status: 'Received',
    teacherSummary: '',
    aiSuggestion: '',
    overallBand: 'Pending'
  });
  const [questionBankFilters, setQuestionBankFilters] = useState<{
    search: string;
    subject: string;
    status: string;
    grade: string;
    difficulty: string;
  }>({
    search: '',
    subject: 'All',
    status: 'All',
    grade: 'All',
    difficulty: 'All'
  });

  const navItems = navByRole[activeRole];
  const aiStatusMessages = activeRole === 'Student'
    ? [
        'AI coach warming up personalized retry suggestions.',
        'Scanning weak tags to queue the next best practice set.',
        'Drafting encouragement notes and short study nudges.',
        'Preparing live hints from your latest wrong-question review.'
      ]
    : [
        'AI is watching scan flow and grading readiness.',
        'Drafting rubric suggestions for pending review items.',
        'Checking answer-bank links before student grading starts.',
        'Preparing live intervention flags for unusual score shifts.'
      ];

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [teacherList, classList, studentList, taskList, bankList, archivedBankList, resultList, compositionList] = await Promise.all([
          activeRole === 'Student' ? Promise.resolve([] as Teacher[]) : mockApi.listTeachers(),
          mockApi.listClasses(),
          mockApi.listStudents(),
          activeRole === 'Student' ? Promise.resolve([] as ScanTask[]) : mockApi.listScanTasks(),
          activeRole === 'Student' ? Promise.resolve([] as AnswerBankItem[]) : mockApi.listAnswerBanks(),
          activeRole === 'Student' ? Promise.resolve([] as AnswerBankItem[]) : mockApi.listArchivedAnswerBanks(),
          mockApi.listResults(),
          mockApi.listCompositionSubmissions()
        ]);
        setTeachers(teacherList);
        setClasses(classList);
        setStudents(studentList);
        setScanTasks(taskList);
        setAnswerBanks(bankList);
        setArchivedAnswerBanks(archivedBankList);
        setResults(resultList);
        setCompositionSubmissions(compositionList);
        setClassForm((current) => ({
          ...current,
          homeroomTeacherId: teacherList.find((teacher) => teacher.role === 'Homeroom Teacher')?.id ?? teacherList[0]?.id ?? ''
        }));
        setImportForm((current) => ({
          ...current,
          classId: classList[0]?.id ?? ''
        }));
        setScanTaskForm((current) => ({
          ...current,
          className: classList[0]?.name ?? ''
        }));
        setNewAnswerBankForm((current) => ({
          ...current,
          paperName: current.paperName || taskList[0]?.paperName || '',
          subject: current.subject || bankList[0]?.subject || 'Mathematics'
        }));
        setSelectedScanTaskId(taskList[0]?.id ?? '');
        if (bankList[0]) {
          setEditingAnswerBankId(bankList[0].id);
          setAnswerBankForm({
            grade: bankList[0].grade || grades[0],
            topic: bankList[0].topic || '',
            difficulty: bankList[0].difficulty || 'Standard',
            questionStem: bankList[0].questionStem,
            score: bankList[0].score,
            rubric: bankList[0].rubric,
            status: bankList[0].status
          });
        }
        if (resultList[0]) {
          setEditingResultId(resultList[0].id);
          setResultForm({
            score: resultList[0].score,
            reviewState: resultList[0].reviewState,
            errorReason: resultList[0].errorReason
          });
        }
        if (compositionList[0]) {
          setSelectedCompositionId(compositionList[0].id);
          setCompositionReviewForm({
            status: compositionList[0].status,
            teacherSummary: compositionList[0].teacherSummary ?? '',
            aiSuggestion: compositionList[0].aiSuggestion ?? '',
            overallBand: compositionList[0].overallBand ?? 'Pending'
          });
        }
      } catch (err) {
        setMessage(`Failed to load platform data: ${err instanceof Error ? err.message : 'Network error — is the API server running?'}`);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAiStatusIndex((current) => (current + 1) % aiStatusMessages.length);
    }, 2800);

    return () => window.clearInterval(timer);
  }, [aiStatusMessages.length]);

  useEffect(() => {
    async function refreshCompositions() {
      try {
        const list = await mockApi.listCompositionSubmissions();
        setCompositionSubmissions(list);
      } catch {}
    }
    const id = window.setInterval(() => void refreshCompositions(), 15000);
    return () => window.clearInterval(id);
  }, []);

  function handleNewSubmission(submission: CompositionSubmission) {
    setCompositionSubmissions((current) => {
      const without = current.filter((item) => item.id !== submission.id);
      return [submission, ...without];
    });
    setSelectedCompositionId(submission.id);
  }

  const schoolMetrics = useMemo(() => {
    const totalStudents = classes.reduce((sum, item) => sum + item.studentCount, 0);
    const averageScore = results.length
      ? Math.round((results.reduce((sum, item) => sum + item.score / item.total, 0) / results.length) * 100)
      : 0;
    const pendingReview = results.filter((item) => item.reviewState === 'Needs Review').length;
    return [
      { label: 'Teachers', value: String(teachers.length), trend: 'Admin-managed' },
      { label: 'Classes', value: String(classes.length), trend: `${totalStudents} students` },
      { label: 'Avg Score', value: `${averageScore}%`, trend: 'School aggregate' },
      { label: 'Review Queue', value: String(pendingReview), trend: 'Teacher follow-up' }
    ];
  }, [classes, results, teachers.length]);

  const teacherMetrics = useMemo(() => {
    const teacherPapers = scanTasks.filter((task) => task.type === 'Teacher Paper').length;
    const readyBanks = answerBanks.filter((item) => item.status === 'Ready for Grading').length;
    return [
      { label: 'Teacher Papers', value: String(teacherPapers), trend: 'Template and answer scans' },
      { label: 'Answer Banks Ready', value: String(readyBanks), trend: 'Can be linked to grading' },
      { label: 'Student Results', value: String(results.length), trend: 'Correction workspace' },
      { label: 'Exports', value: '3', trend: 'PDF trace, print trace, Excel' }
    ];
  }, [answerBanks, results.length, scanTasks]);

  const studentMetrics = useMemo(() => {
    const sampleStudent = students[0];
    return [
      { label: 'Accuracy', value: `${Math.round((sampleStudent?.accuracy ?? 0) * 100)}%`, trend: sampleStudent?.name ?? 'Student profile' },
      { label: 'Wrong Questions', value: String((sampleStudent?.weakTags.length ?? 0) + 4), trend: 'Ready to review' },
      { label: 'Practice Sets', value: '5', trend: 'Generated from weak tags' },
      { label: 'Latest Score', value: '84 / 100', trend: 'Mathematics Midterm A' }
    ];
  }, [students]);

  async function handleTeacherSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teacherForm.name || !teacherForm.phone) return;
    const created = await mockApi.registerTeacher(teacherForm);
    setTeachers((current) => [created, ...current]);
    setTeacherForm({ name: '', phone: '', role: 'Teacher' });
    setMessage(`Registered ${created.name} as ${created.role}.`);
  }

  async function handleClassSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classForm.name || !classForm.homeroomTeacherId) return;
    const created = await mockApi.createClass(classForm);
    setClasses((current) => [created, ...current]);
    setTeachers(await mockApi.listTeachers());
    setClassForm({ name: '', grade: grades[0], homeroomTeacherId: classForm.homeroomTeacherId });
    setMessage(`Created ${created.name} and assigned a homeroom teacher.`);
  }

  async function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importForm.classId || !importForm.csvText.trim()) return;
    const imported = await mockApi.importStudents(importForm);
    setStudents((current) => [...imported, ...current]);
    setClasses(await mockApi.listClasses());
    setMessage(`Imported ${imported.length} students into the selected class.`);
  }

  async function handleScanTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scanTaskForm.printer || !scanTaskForm.className || !scanTaskForm.paperName) return;
    const created = await mockApi.createScanTask({
      ...scanTaskForm,
      linkedAnswerPaper: scanTaskForm.type === 'Student Paper' ? scanTaskForm.linkedAnswerPaper || undefined : undefined
    });
    setScanTasks((current) => [created, ...current]);
    setScanTaskForm((current) => ({
      ...current,
      paperName: '',
      linkedAnswerPaper: current.type === 'Student Paper' ? current.linkedAnswerPaper : ''
    }));
    setSelectedScanTaskId(created.id);
    setMessage(`Created ${created.type} task for ${created.paperName}.`);
  }

  async function handleScanTaskUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedScanTaskId || !selectedUploadFile) return;
    const updated = await mockApi.uploadScanTaskFile(selectedScanTaskId, selectedUploadFile);
    setScanTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedUploadFile(null);
    setMessage(`Uploaded ${updated.fileName} to ${updated.paperName}.`);
  }

  async function handleAnswerBankSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAnswerBankId || !answerBankForm.questionStem || !answerBankForm.rubric) return;
    const updated = await mockApi.updateAnswerBank(editingAnswerBankId, {
      ...answerBankForm,
      score: Number(answerBankForm.score)
    });
    setAnswerBanks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setMessage(`Saved answer bank updates for ${updated.paperName}.`);
  }

  async function handleCreateAnswerBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await mockApi.createAnswerBank(newAnswerBankForm);
    const updated = [created, ...answerBanks];
    setAnswerBanks(updated);
    setEditingAnswerBankId(created.id);
    setAnswerBankForm({
      grade: created.grade || grades[0],
      topic: created.topic || '',
      difficulty: created.difficulty || 'Standard',
      questionStem: created.questionStem,
      score: created.score,
      rubric: created.rubric,
      status: created.status
    });
    setNewAnswerBankForm((current) => ({
      ...current,
      paperName: created.paperName,
      subject: created.subject,
      grade: created.grade || grades[0],
      topic: '',
      difficulty: 'Standard',
      questionStem: '',
      score: 1,
      rubric: '',
      status: 'Teacher Review'
    }));
    setMessage(`Question bank item ${created.id} created for ${created.paperName}.`);
  }

  async function handleArchiveAnswerBank() {
    if (!editingAnswerBankId) {
      return;
    }

    await mockApi.archiveAnswerBank(editingAnswerBankId);
    const remaining = answerBanks.filter((item) => item.id !== editingAnswerBankId);
    setAnswerBanks(remaining);
    if (remaining[0]) {
      setEditingAnswerBankId(remaining[0].id);
      setAnswerBankForm({
        grade: remaining[0].grade || grades[0],
        topic: remaining[0].topic || '',
        difficulty: remaining[0].difficulty || 'Standard',
        questionStem: remaining[0].questionStem,
        score: remaining[0].score,
        rubric: remaining[0].rubric,
        status: remaining[0].status
      });
    } else {
      setEditingAnswerBankId('');
      setAnswerBankForm({
        grade: grades[0],
        topic: '',
        difficulty: 'Standard',
        questionStem: '',
        score: 1,
        rubric: '',
        status: 'Teacher Review'
      });
    }
    setMessage(`Question bank item ${editingAnswerBankId} archived.`);
  }

  async function handleRestoreAnswerBank(id: string) {
    await mockApi.restoreAnswerBank(id);
    const restoredItem = archivedAnswerBanks.find((item) => item.id === id);
    const remainingArchived = archivedAnswerBanks.filter((item) => item.id !== id);
    setArchivedAnswerBanks(remainingArchived);
    if (restoredItem) {
      setAnswerBanks((current) => [restoredItem, ...current]);
      setEditingAnswerBankId(restoredItem.id);
      setAnswerBankForm({
        grade: restoredItem.grade || grades[0],
        topic: restoredItem.topic || '',
        difficulty: restoredItem.difficulty || 'Standard',
        questionStem: restoredItem.questionStem,
        score: restoredItem.score,
        rubric: restoredItem.rubric,
        status: restoredItem.status
      });
      setMessage(`Question bank item ${id} restored.`);
    }
  }

  function handleAnswerBankSelect(item: AnswerBankItem) {
    setEditingAnswerBankId(item.id);
    setAnswerBankForm({
      grade: item.grade || grades[0],
      topic: item.topic || '',
      difficulty: item.difficulty || 'Standard',
      questionStem: item.questionStem,
      score: item.score,
      rubric: item.rubric,
      status: item.status
    });
  }

  async function handleResultSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingResultId || !resultForm.errorReason) return;
    const updated = await mockApi.updateResult(editingResultId, {
      ...resultForm,
      score: Number(resultForm.score)
    });
    setResults((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setMessage(`Saved teacher adjustment for ${updated.studentName}.`);
  }

  function handleResultSelect(item: StudentResult) {
    setEditingResultId(item.id);
    setResultForm({
      score: item.score,
      reviewState: item.reviewState,
      errorReason: item.errorReason
    });
  }

  async function handleCompositionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!compositionForm.testCode || !compositionForm.promptTitle || !compositionForm.promptText || !compositionForm.shortAnswer || !compositionForm.essayText) {
      return;
    }

    const created = await mockApi.createCompositionSubmission(compositionForm);
    setCompositionSubmissions((current) => [created, ...current]);
    setSelectedCompositionId(created.id);
    setCompositionForm((current) => ({
      ...current,
      shortAnswer: '',
      essayText: ''
    }));
    setMessage(`Composition submission ${created.testCode} received. You can now track its review status.`);
  }

  function handleCompositionSelect(item: CompositionSubmission) {
    setSelectedCompositionId(item.id);
    setCompositionReviewForm({
      status: item.status,
      teacherSummary: item.teacherSummary ?? '',
      aiSuggestion: item.aiSuggestion ?? '',
      overallBand: item.overallBand ?? 'Pending'
    });
  }

  async function handleCompositionReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompositionId) {
      return;
    }

    const updated = await mockApi.updateCompositionSubmission(selectedCompositionId, compositionReviewForm);
    setCompositionSubmissions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setMessage(`Updated composition review for ${updated.studentName}.`);
  }

  async function handleEvaluate() {
    if (!selectedCompositionId || evaluating) return;
    setEvaluating(true);
    try {
      const updated = await mockApi.evaluateCompositionSubmission(selectedCompositionId);
      setCompositionSubmissions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(`AI evaluation complete for ${updated.studentName}.`);
    } catch (err) {
      setMessage(`Evaluation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setEvaluating(false);
    }
  }

  if (canonicalPath(activeRole, activeView) !== `/${roleSlug ?? ''}/${viewSlug ?? ''}`) {
    return <Navigate to={canonicalPath(activeRole, activeView)} replace />;
  }

  const selectedClassStudents = students.filter((student) => student.classId === importForm.classId);
  const selectedComposition = compositionSubmissions.find((item) => item.id === selectedCompositionId) ?? compositionSubmissions[0];
  const currentStudent = students.find((student) => student.id === currentUser.linkedStudentId) ?? students[0];
  const currentRoleSummary = roleSummary[activeRole];
  const metrics = activeRole === 'Admin' ? schoolMetrics : activeRole === 'Teacher' ? teacherMetrics : studentMetrics;
  const liveCards = activeRole === 'Student'
    ? [
        {
          title: 'Live Status',
          value: 'AI Standby',
          detail: aiStatusMessages[aiStatusIndex]
        },
        {
          title: 'Practice Signals',
          value: '05',
          detail: 'Fresh practice recommendations from recent mistakes.'
        },
        {
          title: 'Review Queue',
          value: '04',
          detail: 'Wrong-question review placeholders ready for live AI guidance.'
        }
      ]
    : [
        {
          title: 'Live Status',
          value: 'AI Standby',
          detail: aiStatusMessages[aiStatusIndex]
        },
        {
          title: 'Teacher Papers Scanned Today',
          value: String(scanTasks.filter((task) => task.type === 'Teacher Paper').length),
          detail: 'Today placeholder for live scan activity.'
        },
        {
          title: 'Answer Banks Ready for Link',
          value: String(answerBanks.filter((item) => item.status === 'Ready for Grading').length),
          detail: 'Ready-to-link placeholder for live bank readiness.'
        }
      ];

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">P</span>
          <div>
            <strong>LearnCoach AI 学习教练</strong>
            <small>LC ver.0.1</small>
          </div>
        </div>

        <div className="personaCard">
          <span className="badge">{currentRoleSummary.cn}</span>
          <strong>{currentRoleSummary.title}</strong>
          <p>{currentRoleSummary.subtitle}</p>
        </div>

        <nav>
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              className={key === activeView ? 'navItem active' : 'navItem'}
              key={key}
              onClick={() => navigate(canonicalPath(activeRole, key))}
              type="button"
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebarPanel">
          <span>V1.1 boundary</span>
          <p>Question-paper grading is live. Answer-card grading remains marked as upcoming.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Role-based school correction platform</p>
            <h1>LearnCoach AI 学习教练</h1>
          </div>
          <div className="topbarControls">
            <div className="userBadge" aria-label="Current session">
              <strong>{currentUser.name}</strong>
              <span>{currentUser.role} · @{currentUser.username}</span>
            </div>
            <button
              className="primaryButton"
              type="button"
              onClick={() => navigate(canonicalPath(activeRole, navByRole[activeRole][1]?.key ?? 'overview'))}
            >
              <Upload size={18} />
              Open Workflow
            </button>
            <button className="secondaryButton" onClick={onLogout} type="button">
              <LogOut size={18} />
              Log Out
            </button>
          </div>
        </header>

        {message ? (
          <div className="flash">
            <CheckCircle2 size={18} />
            <span>{message}</span>
          </div>
        ) : null}

        <section className="liveStrip" aria-label="Live placeholders">
          {liveCards.map((card) => (
            <article className={card.title === 'Live Status' ? 'liveTile liveTileStatus' : 'liveTile'} key={card.title}>
              <span>{card.title}</span>
              <strong>{card.value}</strong>
              <small className={card.title === 'Live Status' ? 'statusTicker' : undefined} key={`${card.title}-${card.detail}`}>
                {card.detail}
              </small>
            </article>
          ))}
        </section>

        <section className="statsGrid">
          {metrics.map((stat) => (
            <article className="statTile" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.trend}</small>
            </article>
          ))}
        </section>

        {loading ? (
          <section className="loadingState">
            <LoaderCircle className="spin" size={22} />
            <span>Loading platform data...</span>
          </section>
        ) : (
          <ErrorBoundary>
          <PageContent
            activeRole={activeRole}
            activeView={activeView}
            answerBanks={answerBanks}
            archivedAnswerBanks={archivedAnswerBanks}
            answerBankForm={answerBankForm}
            newAnswerBankForm={newAnswerBankForm}
            classes={classes}
            classForm={classForm}
            compositionForm={compositionForm}
            compositionReviewForm={compositionReviewForm}
            compositionSubmissions={compositionSubmissions}
            currentStudent={currentStudent}
            editingAnswerBankId={editingAnswerBankId}
            importForm={importForm}
            onAnswerBankFormChange={setAnswerBankForm}
            onAnswerBankSelect={handleAnswerBankSelect}
            onAnswerBankSubmit={handleAnswerBankSubmit}
            onCreateAnswerBank={handleCreateAnswerBank}
            onArchiveAnswerBank={handleArchiveAnswerBank}
            onRestoreAnswerBank={handleRestoreAnswerBank}
            onClassFormChange={setClassForm}
            onClassSubmit={handleClassSubmit}
            onCompositionFormChange={setCompositionForm}
            onCompositionReviewFormChange={setCompositionReviewForm}
            onCompositionReviewSubmit={handleCompositionReviewSubmit}
            onCompositionSelect={handleCompositionSelect}
            onCompositionSubmit={handleCompositionSubmit}
            onNewSubmission={handleNewSubmission}
            onImportFormChange={setImportForm}
            onImportSubmit={handleImportSubmit}
            editingResultId={editingResultId}
            onResultFormChange={setResultForm}
            onResultSelect={handleResultSelect}
            onResultSubmit={handleResultSubmit}
            onScanTaskSelect={setSelectedScanTaskId}
            onScanTaskFormChange={setScanTaskForm}
            onScanTaskSubmit={handleScanTaskSubmit}
            onScanTaskUpload={handleScanTaskUpload}
            results={results}
            resultForm={resultForm}
            expandedDimensionId={expandedDimensionId}
            setExpandedDimensionId={setExpandedDimensionId}
            selectedScanTaskId={selectedScanTaskId}
            selectedComposition={selectedComposition}
            selectedUploadFile={selectedUploadFile}
            setSelectedUploadFile={setSelectedUploadFile}
            scanTaskForm={scanTaskForm}
            scanTasks={scanTasks}
            selectedClassStudents={selectedClassStudents}
            students={students}
            teacherForm={teacherForm}
            teachers={teachers}
            workflow={workflow}
            currentUser={currentUser}
            questionBankFilters={questionBankFilters}
            onTeacherFormChange={setTeacherForm}
            onTeacherSubmit={handleTeacherSubmit}
            setQuestionBankFilters={setQuestionBankFilters}
            setNewAnswerBankForm={setNewAnswerBankForm}
            evaluating={evaluating}
            onEvaluate={handleEvaluate}
            advancedOpen={advancedOpen}
            setAdvancedOpen={setAdvancedOpen}
            advancedTab={advancedTab}
            setAdvancedTab={setAdvancedTab}
          />
          </ErrorBoundary>
        )}
      </section>
    </main>
  );
}

function AuthScreen(props: {
  onLogin: (input: { username: string; password: string }) => Promise<void>;
  onRegister: (input: RegisterInput) => Promise<void>;
}) {
  const { onLogin, onRegister } = props;
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [classes, setClasses] = useState<Array<Pick<SchoolClass, 'id' | 'name' | 'grade'>>>([]);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState<RegisterInput>({
    role: 'Teacher',
    name: '',
    username: '',
    password: '',
    phone: '',
    teacherRole: 'Teacher',
    classId: '',
    studentNo: ''
  });

  useEffect(() => {
    void mockApi.listPublicClasses().then((items) => {
      setClasses(items);
      setRegisterForm((current) => ({
        ...current,
        classId: current.classId || items[0]?.id || ''
      }));
    });
  }, []);

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onLogin(loginForm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onRegister(registerForm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="authShell">
      <div className="authLeft">
        <img src={lcLogo} alt="LearnCoach" className="authHeroCover" />
      </div>

      <div className="authRight">
        <section className="authHero">
          <p className="eyebrow">LearnCoach AI 学习教练 Access</p>
          <h1>Sign in by role, or create a new school account.</h1>
          <p>
            Admins can manage the school, teachers can run grading workflows, and students can review mistakes and track progress.
          </p>
          <div className="chipRow">
            <span className="chip">Admin demo: admin / admin123</span>
            <span className="chip">Teacher demo: mlin / teacher123</span>
            <span className="chip">Student demo: g7-001 / student123</span>
          </div>
        </section>

      <section className="authPanel">
        <div className="topbarControls">
          <div className="roleSwitch" aria-label="Auth mode switcher">
            {(['login', 'register'] as const).map((item) => (
              <button
                className={mode === item ? 'segButton active' : 'segButton'}
                key={item}
                onClick={() => {
                  setMode(item);
                  setError('');
                }}
                type="button"
              >
                {item === 'login' ? 'Log In' : 'Register'}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="flash authFlash">
            <LockKeyhole size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {mode === 'login' ? (
          <form className="formCard" onSubmit={(event) => void handleLoginSubmit(event)}>
            <label>
              <span>Username / Student ID</span>
              <input value={loginForm.username} onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))} />
            </label>
            <label>
              <span>Password / Passcode</span>
              <input type="password" value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} />
            </label>
            <div className="notice">
              <CheckCircle2 size={18} />
              <span>Students sign in with their student ID and passcode. Teachers and admins can keep using username and password.</span>
            </div>
            <button className="primaryButton wide" disabled={submitting} type="submit">
              <LockKeyhole size={18} />
              {submitting ? 'Signing In...' : 'Log In'}
            </button>
          </form>
        ) : (
          <form className="formCard" onSubmit={(event) => void handleRegisterSubmit(event)}>
            <div className="formGrid">
              <label>
                <span>Role</span>
                <select
                  value={registerForm.role}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, role: event.target.value as Role }))}
                >
                  {(['Admin', 'Teacher', 'Student'] as Role[]).map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Name</span>
                <input value={registerForm.name} onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                <span>Username</span>
                <input value={registerForm.username} onChange={(event) => setRegisterForm((current) => ({ ...current, username: event.target.value }))} />
              </label>
              <label>
                <span>Password</span>
                <input type="password" value={registerForm.password} onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))} />
              </label>
            </div>

            {registerForm.role === 'Teacher' ? (
              <div className="formGrid">
                <label>
                  <span>Phone</span>
                  <input value={registerForm.phone ?? ''} onChange={(event) => setRegisterForm((current) => ({ ...current, phone: event.target.value }))} />
                </label>
                <label>
                  <span>Teacher Role</span>
                  <select
                    value={registerForm.teacherRole ?? 'Teacher'}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, teacherRole: event.target.value as TeacherRole }))}
                  >
                    <option value="Teacher">Teacher</option>
                    <option value="Homeroom Teacher">Homeroom Teacher</option>
                  </select>
                </label>
              </div>
            ) : null}

            {registerForm.role === 'Student' ? (
              <div className="formGrid">
                <label>
                  <span>Class</span>
                  <select
                    value={registerForm.classId ?? ''}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, classId: event.target.value }))}
                  >
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Student Number</span>
                  <input value={registerForm.studentNo ?? ''} onChange={(event) => setRegisterForm((current) => ({ ...current, studentNo: event.target.value }))} />
                </label>
              </div>
            ) : null}

            <button className="primaryButton wide" disabled={submitting} type="submit">
              <CheckCircle2 size={18} />
              {submitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}
      </section>
      </div>
    </main>
  );
}

function roleFromSlug(slug?: string): Role | null {
  switch (slug) {
    case 'admin':
      return 'Admin';
    case 'teacher':
      return 'Teacher';
    case 'student':
      return 'Student';
    default:
      return null;
  }
}

function slugFromRole(role: Role): string {
  switch (role) {
    case 'Admin':
      return 'admin';
    case 'Teacher':
      return 'teacher';
    case 'Student':
      return 'student';
  }
}

function viewFromSlug(slug?: string): ViewKey | null {
  if (!slug) return 'overview';
  const views: ViewKey[] = [
    'overview',
    'teacher-registration',
    'class-management',
    'test-grading',
    'paper-grading',
    'question-bank',
    'analytics',
    'composition-test',
    'wrong-questions',
    'practice',
    'score-history',
    'audio-tools'
  ];
  return views.includes(slug as ViewKey) ? (slug as ViewKey) : null;
}

function isViewForRole(role: Role, view: ViewKey): boolean {
  return navByRole[role].some((item) => item.key === view);
}

function canonicalPath(role: Role, view: ViewKey): string {
  return `/${slugFromRole(role)}/${view}`;
}

function PageContent(props: {
  activeRole: Role;
  activeView: ViewKey;
  answerBanks: AnswerBankItem[];
  archivedAnswerBanks: AnswerBankItem[];
  answerBankForm: UpdateAnswerBankInput;
  compositionForm: CreateCompositionSubmissionInput;
  compositionReviewForm: UpdateCompositionSubmissionInput;
  compositionSubmissions: CompositionSubmission[];
  currentUser: AuthUser;
  currentStudent?: Student;
  newAnswerBankForm: CreateAnswerBankInput;
  questionBankFilters: { search: string; subject: string; status: string; grade: string; difficulty: string };
  classes: SchoolClass[];
  classForm: { name: string; grade: string; homeroomTeacherId: string };
  editingAnswerBankId: string;
  editingResultId: string;
  importForm: { classId: string; csvText: string };
  onAnswerBankFormChange: Dispatch<SetStateAction<UpdateAnswerBankInput>>;
  onAnswerBankSelect: (item: AnswerBankItem) => void;
  onAnswerBankSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateAnswerBank: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onArchiveAnswerBank: () => Promise<void>;
  onRestoreAnswerBank: (id: string) => Promise<void>;
  onClassFormChange: Dispatch<SetStateAction<{ name: string; grade: string; homeroomTeacherId: string }>>;
  onClassSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCompositionFormChange: Dispatch<SetStateAction<CreateCompositionSubmissionInput>>;
  onCompositionReviewFormChange: Dispatch<SetStateAction<UpdateCompositionSubmissionInput>>;
  onCompositionReviewSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCompositionSelect: (item: CompositionSubmission) => void;
  onCompositionSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onNewSubmission: (submission: CompositionSubmission) => void;
  onImportFormChange: Dispatch<SetStateAction<{ classId: string; csvText: string }>>;
  onImportSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onResultFormChange: Dispatch<SetStateAction<UpdateStudentResultInput>>;
  onResultSelect: (item: StudentResult) => void;
  onResultSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onScanTaskSelect: Dispatch<SetStateAction<string>>;
  onScanTaskFormChange: Dispatch<SetStateAction<CreateScanTaskInput>>;
  onScanTaskSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onScanTaskUpload: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  results: StudentResult[];
  resultForm: UpdateStudentResultInput;
  expandedDimensionId: string;
  setExpandedDimensionId: Dispatch<SetStateAction<string>>;
  selectedComposition?: CompositionSubmission;
  selectedScanTaskId: string;
  selectedUploadFile: File | null;
  setSelectedUploadFile: Dispatch<SetStateAction<File | null>>;
  scanTaskForm: CreateScanTaskInput;
  scanTasks: ScanTask[];
  selectedClassStudents: Student[];
  students: Student[];
  teacherForm: { name: string; phone: string; role: TeacherRole };
  teachers: Teacher[];
  workflow: Array<{ title: string; cn: string; icon: typeof Upload; status: string; detail: string }>;
  onTeacherFormChange: Dispatch<SetStateAction<{ name: string; phone: string; role: TeacherRole }>>;
  onTeacherSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setQuestionBankFilters: Dispatch<SetStateAction<{ search: string; subject: string; status: string; grade: string; difficulty: string }>>;
  setNewAnswerBankForm: Dispatch<SetStateAction<CreateAnswerBankInput>>;
  evaluating: boolean;
  onEvaluate: () => Promise<void>;
  advancedOpen: boolean;
  setAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  advancedTab: AdvancedTab;
  setAdvancedTab: Dispatch<SetStateAction<AdvancedTab>>;
}) {
  const {
    activeRole,
    activeView,
    answerBanks,
    archivedAnswerBanks,
    answerBankForm,
    compositionForm,
    compositionReviewForm,
    compositionSubmissions,
    currentUser,
    currentStudent,
    newAnswerBankForm,
    questionBankFilters,
    classes,
    classForm,
    editingAnswerBankId,
    editingResultId,
    importForm,
    onAnswerBankFormChange,
    onAnswerBankSelect,
    onAnswerBankSubmit,
    onCreateAnswerBank,
    onArchiveAnswerBank,
    onRestoreAnswerBank,
    onClassFormChange,
    onClassSubmit,
    onCompositionFormChange,
    onCompositionReviewFormChange,
    onCompositionReviewSubmit,
    onCompositionSelect,
    onCompositionSubmit,
    onNewSubmission,
    onImportFormChange,
    onImportSubmit,
    onResultFormChange,
    onResultSelect,
    onResultSubmit,
    onScanTaskSelect,
    onScanTaskFormChange,
    onScanTaskSubmit,
    onScanTaskUpload,
    results,
    resultForm,
    expandedDimensionId,
    setExpandedDimensionId,
    selectedComposition,
    selectedScanTaskId,
    selectedUploadFile,
    setSelectedUploadFile,
    scanTaskForm,
    scanTasks,
    selectedClassStudents,
    students,
    teacherForm,
    teachers,
    workflow,
    onTeacherFormChange,
    onTeacherSubmit,
    setQuestionBankFilters,
    setNewAnswerBankForm,
    evaluating,
    onEvaluate,
    advancedOpen,
    setAdvancedOpen,
    advancedTab,
    setAdvancedTab
  } = props;

  if (activeRole === 'Student') {
    return (
      <>
        {(activeView === 'composition-test' || activeView === 'overview') && (
          <StudentTestView
            activeView={activeView}
            compositionSubmissions={compositionSubmissions}
            currentStudent={currentStudent}
            currentUser={currentUser}
            classes={classes}
            onCompositionSelect={onCompositionSelect}
            onNewSubmission={onNewSubmission}
            selectedComposition={selectedComposition}
          />
        )}

        {(activeView === 'score-history' || activeView === 'overview') && (
          <section className="panel">
            <SectionTitle icon={BarChart3} title="Score History" subtitle="Personal score trend" />
            <div className="barList">
              {[
                ['Chinese', 78],
                ['Mathematics', 84],
                ['English', 81],
                ['Composition', 73]
              ].map(([label, value]) => (
                <div className="barRow" key={String(label)}>
                  <span>{label}</span>
                  <div className="barTrack"><i style={{ width: `${value}%` }} /></div>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {(activeView === 'practice' || activeView === 'overview') && (
          <section className="panel accentPanel">
            <SectionTitle icon={PenLine} title="Practice Queue" subtitle="Auto-grouped from weak tags and recent composition feedback" />
            <div className="chipRow">
              {['Composition opening rewrite', 'Reflection depth', 'Grammar repair', 'Evidence linking', 'Past wrong answers'].map((item) => (
                <span className="chip" key={item}>{item}</span>
              ))}
            </div>
          </section>
        )}

        {activeView === 'wrong-questions' && (
          <section className="panel">
            <SectionTitle icon={FileCheck2} title="Wrong Question Review" subtitle="Question, reason, and correction advice" />
            <div className="listStack">
              {results.slice(0, 2).map((item) => (
                <article className="infoRow" key={item.id}>
                  <div>
                    <strong>{item.paperName}</strong>
                    <span>{item.studentName}</span>
                  </div>
                  <p>{item.errorReason}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  if (activeView === 'teacher-registration') {
    return (
      <section className="split">
        <div className="panel">
          <SectionTitle icon={UserCog} title="Teacher Identity Registration" subtitle="Phone collection, role assignment, and homeroom permissions" />
          <form className="formCard" onSubmit={(event) => void onTeacherSubmit(event)}>
            <label>
              <span>Teacher Name</span>
              <input value={teacherForm.name} onChange={(event) => onTeacherFormChange((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Mobile Phone</span>
              <input value={teacherForm.phone} onChange={(event) => onTeacherFormChange((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label>
              <span>Role</span>
              <select value={teacherForm.role} onChange={(event) => onTeacherFormChange((current) => ({ ...current, role: event.target.value as TeacherRole }))}>
                <option value="Teacher">Teacher</option>
                <option value="Homeroom Teacher">Homeroom Teacher</option>
              </select>
            </label>
            <button className="primaryButton wide" type="submit">
              <UserCog size={18} />
              Register Teacher
            </button>
          </form>
        </div>

        <div className="panel accentPanel">
          <SectionTitle icon={UsersRound} title="Registered Teachers" subtitle="Current teacher roster and permissions" />
          <div className="listStack">
            {teachers.map((teacher) => (
              <article className="infoRow" key={teacher.id}>
                <div>
                  <strong>{teacher.name}</strong>
                  <span>{teacher.phone}</span>
                </div>
                <p>{teacher.role} · Assigned classes: {teacher.assignedClassIds.length || 0}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (activeView === 'class-management') {
    return (
      <section className="split">
        <div className="panel">
          <SectionTitle icon={UsersRound} title="New Class Creation" subtitle="Class name, grade, and homeroom teacher" />
          <form className="formCard" onSubmit={(event) => void onClassSubmit(event)}>
            <label>
              <span>Class Name</span>
              <input value={classForm.name} onChange={(event) => onClassFormChange((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Grade</span>
              <select value={classForm.grade} onChange={(event) => onClassFormChange((current) => ({ ...current, grade: event.target.value }))}>
                {grades.map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Homeroom Teacher</span>
              <select value={classForm.homeroomTeacherId} onChange={(event) => onClassFormChange((current) => ({ ...current, homeroomTeacherId: event.target.value }))}>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.role}</option>
                ))}
              </select>
            </label>
            <button className="primaryButton wide" type="submit">
              <UsersRound size={18} />
              Create Class
            </button>
          </form>
        </div>

        <div className="panel">
          <SectionTitle icon={Upload} title="Student Import" subtitle="Bulk student import" />
          <form className="formCard" onSubmit={(event) => void onImportSubmit(event)}>
            <label>
              <span>Target Class</span>
              <select value={importForm.classId} onChange={(event) => onImportFormChange((current) => ({ ...current, classId: event.target.value }))}>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>CSV lines: name,studentNo</span>
              <textarea value={importForm.csvText} onChange={(event) => onImportFormChange((current) => ({ ...current, csvText: event.target.value }))} />
            </label>
            <button className="primaryButton wide" type="submit">
              <Upload size={18} />
              Import Students
            </button>
          </form>
        </div>

        <div className="panel fullSpan">
          <SectionTitle icon={School} title="Class Directory" subtitle="Class list and student totals" />
          <div className="cardGrid">
            {classes.map((schoolClass) => (
              <article className="miniCard" key={schoolClass.id}>
                <strong>{schoolClass.name}</strong>
                <span>{schoolClass.grade}</span>
                <p>{schoolClass.studentCount} students</p>
              </article>
            ))}
          </div>
          {selectedClassStudents.length ? (
            <div className="listStack topGap">
              {selectedClassStudents.slice(0, 6).map((student) => (
                <article className="infoRow compact" key={student.id}>
                  <div>
                    <strong>{student.name}</strong>
                    <span>{student.studentNo}</span>
                  </div>
                  <p>{Math.round(student.accuracy * 100)}% accuracy</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (activeView === 'test-grading') {
    const eval_ = selectedComposition?.evaluation;
    const studentHistory = selectedComposition
      ? compositionSubmissions.filter((s) => s.studentId === selectedComposition.studentId && s.evaluation && s.id !== selectedComposition.id)
      : [];
    const classEvaluated = selectedComposition
      ? compositionSubmissions.filter((s) => s.classId === selectedComposition.classId && s.evaluation)
      : [];
    const classAvgDims = compositionDimensionExamples.map((dim) => {
      const scores = classEvaluated.map((s) => s.evaluation?.dimensions.find((d) => d.id === dim.id)?.score ?? null).filter((v): v is number => v !== null);
      return { id: dim.id, avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null };
    });
    const advClusterBars = compositionClusterExamples.map((cluster) => ({
      ...cluster,
      average: Math.round((((cluster.essayA + cluster.essayB) / 2) / 5) * 100)
    }));
    const advWritingDims = compositionDimensionExamples.filter((d) => d.cluster === 'Writing Quality');
    const advEvidenceDims = compositionDimensionExamples.filter((d) => d.cluster === 'Evidence Use');
    const advOverallDims = compositionDimensionExamples.filter((d) => d.cluster === 'Overall Evaluation');
    const advAvgA = Math.round((compositionDimensionExamples.reduce((s, d) => s + d.essayA, 0) / (compositionDimensionExamples.length * 5)) * 100);
    const advAvgB = Math.round((compositionDimensionExamples.reduce((s, d) => s + d.essayB, 0) / (compositionDimensionExamples.length * 5)) * 100);

    return (
      <>
        {/* ── Queue + Review Control ── */}
        <section className="split">
          <div className="panel">
            <SectionTitle icon={ClipboardList} title="Test Grading Queue" subtitle="Typed student compositions received by the system and ready for AI or teacher review" />
            <div className="listStack">
              {compositionSubmissions.length ? compositionSubmissions.map((item) => (
                <button
                  className={item.id === selectedComposition?.id ? 'selectCard active' : 'selectCard'}
                  key={item.id}
                  onClick={() => onCompositionSelect(item)}
                  type="button"
                >
                  <div>
                    <strong>{item.studentName}</strong>
                    <span>{item.className} · {item.testCode}</span>
                  </div>
                  <p>{item.promptTitle}</p>
                  <small>
                    {item.status} · {item.overallBand ?? 'Pending'}
                    {item.evaluation ? <span className="evalBadge">✓ Evaluated</span> : null}
                    · {safeDate(item.submittedAt)}
                  </small>
                </button>
              )) : (
                <div className="notice"><CheckCircle2 size={18} /><span>No composition submissions yet.</span></div>
              )}
            </div>
          </div>

          <div className="panel accentPanel">
            <SectionTitle icon={Sparkles} title="Review Control" subtitle="Update status, suggestion, and teacher summary" />
            {selectedComposition ? (
              <form className="formCard" onSubmit={(event) => void onCompositionReviewSubmit(event)}>
                <div className="formGrid">
                  <label>
                    <span>Status</span>
                    <select value={compositionReviewForm.status} onChange={(e) => onCompositionReviewFormChange((c) => ({ ...c, status: e.target.value as CompositionSubmissionStatus }))}>
                      {compositionStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Overall Band</span>
                    <select value={compositionReviewForm.overallBand ?? 'Pending'} onChange={(e) => onCompositionReviewFormChange((c) => ({ ...c, overallBand: e.target.value }))}>
                      {compositionBands.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  <span>Suggestion</span>
                  <textarea value={compositionReviewForm.aiSuggestion ?? ''} onChange={(e) => onCompositionReviewFormChange((c) => ({ ...c, aiSuggestion: e.target.value }))} />
                </label>
                <label>
                  <span>Teacher Summary</span>
                  <textarea value={compositionReviewForm.teacherSummary ?? ''} onChange={(e) => onCompositionReviewFormChange((c) => ({ ...c, teacherSummary: e.target.value }))} />
                </label>
                <button className="primaryButton wide" type="submit"><FileCheck2 size={18} />Save Review Update</button>
              </form>
            ) : (
              <div className="notice"><CheckCircle2 size={18} /><span>Select a submission to begin teacher review.</span></div>
            )}
          </div>
        </section>

        {/* ── Student Response Preview ── */}
        <section className="panel">
          <SectionTitle icon={PenLine} title="Student Response Preview" subtitle="Short answer and essay from the selected submission" />
          {selectedComposition ? (
            <div className="compositionPreviewGrid">
              <article className="infoRow">
                <div><strong>Prompt</strong><span>{selectedComposition.promptTitle}</span></div>
                <p>{selectedComposition.promptText}</p>
              </article>
              <article className="infoRow">
                <div><strong>Short Answer</strong><span>{selectedComposition.studentName}</span></div>
                <p>{selectedComposition.shortAnswer}</p>
              </article>
              <article className="infoRow fullSpan">
                <div><strong>Main Essay</strong><span>{selectedComposition.status}</span></div>
                <p className="essayBodyText">{selectedComposition.essayText}</p>
              </article>
            </div>
          ) : (
            <div className="notice"><CheckCircle2 size={18} /><span>No submission selected.</span></div>
          )}
        </section>

        {/* ── Dimension Evaluation ── */}
        <section className="panel">
          <div className="evalHeader">
            <div>
              <SectionTitle icon={Sparkles} title="Dimension Evaluation" subtitle="11-dimension scoring for the selected essay" />
            </div>
            {selectedComposition && (
              <button
                className={evaluating ? 'secondaryButton evalRunButton' : 'primaryButton evalRunButton'}
                type="button"
                disabled={evaluating}
                onClick={() => void onEvaluate()}
              >
                {evaluating ? <><LoaderCircle className="spin" size={16} />Evaluating…</> : eval_ ? <><Sparkles size={16} />Re-evaluate</> : <><Sparkles size={16} />Evaluate</>}
              </button>
            )}
          </div>

          {!selectedComposition && (
            <div className="notice"><CheckCircle2 size={18} /><span>Select a submission to run evaluation.</span></div>
          )}

          {selectedComposition && !eval_ && !evaluating && (
            <div className="evalEmptyState">
              <Sparkles size={32} className="evalEmptyIcon" />
              <p>Click <strong>Evaluate</strong> to score this essay across all 11 dimensions.</p>
              <small>If no API key is configured the system generates a plausible sample score for demonstration.</small>
            </div>
          )}

          {selectedComposition && evaluating && (
            <div className="evalEmptyState">
              <LoaderCircle size={32} className="spin evalEmptyIcon" />
              <p>Sending essay for 11-dimension scoring…</p>
            </div>
          )}

          {eval_ && (
            <>
              {/* Overall score row */}
              <div className="evalOverallRow">
                <div className="evalScoreCircle" style={{ '--score-pct': `${eval_.overallScore}%` } as React.CSSProperties}>
                  <strong>{eval_.overallScore}</strong>
                  <span>/ 100</span>
                </div>
                <div className="evalOverallMeta">
                  <span className={`evalBandChip evalBand${eval_.overallBand}`}>{eval_.overallBand}</span>
                  <p className="evalOverallComment">{eval_.overallComment}</p>
                  <div className="evalFeedbackRow">
                    <div className="evalFeedbackCol">
                      <strong>Strengths</strong>
                      <ul>{eval_.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                    <div className="evalFeedbackCol">
                      <strong>Improvements</strong>
                      <ul>{eval_.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 11-dimension grid */}
              <div className="evalDimGrid">
                {compositionDimensionExamples.map((dim) => {
                  const ds = eval_.dimensions.find((d) => d.id === dim.id);
                  const score = ds?.score ?? 0;
                  const pct = (score / 5) * 100;
                  const color = scoreColor(score);
                  return (
                    <article className="evalDimCard" key={dim.id}>
                      <div className="evalDimHeader">
                        <span className="evalDimId">{dim.id}</span>
                        <span className="evalDimTitle">{dim.title}</span>
                        <span className="evalDimScore" style={{ color }}>{score.toFixed(1)}</span>
                      </div>
                      <div className="evalDimBarTrack">
                        <div className="evalDimBarFill" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <p className="evalDimComment">{ds?.comment ?? '—'}</p>
                    </article>
                  );
                })}
              </div>
              <p className="evalTimestamp">Evaluated {safeDate(eval_.evaluatedAt)}</p>
            </>
          )}
        </section>

        {/* ── Advanced Analytics (collapsible) ── */}
        <section className="advancedSection">
          <button className="advancedToggle" type="button" onClick={() => setAdvancedOpen((o) => !o)}>
            <BarChart3 size={17} />
            <span>Advanced Analytics</span>
            <span className="advancedChevron">{advancedOpen ? '▲' : '▼'}</span>
          </button>

          {advancedOpen && (
            <div className="advancedBody">
              {/* Tab selector */}
              <div className="advTabRow">
                {(['sample', 'history', 'class'] as AdvancedTab[]).map((tab) => (
                  <button
                    key={tab}
                    className={advancedTab === tab ? 'advTab active' : 'advTab'}
                    type="button"
                    onClick={() => setAdvancedTab(tab)}
                  >
                    {tab === 'sample' ? 'Reference Comparison' : tab === 'history' ? 'Student History' : 'Class Average'}
                  </button>
                ))}
              </div>

              {/* Sample A/B comparison */}
              {advancedTab === 'sample' && (
                <div className="advTabContent">
                  <div className="vizLegend">
                    <span className="legendItem"><span className="legendDot legendEssayA" />Essay A — Narrative Draft</span>
                    <span className="legendItem"><span className="legendDot legendEssayB" />Essay B — Discussion Draft</span>
                  </div>
                  <div className="chartRow topGap">
                    <article className="chartCard chartCardMain">
                      <h3>Overall 11-Dimension View</h3>
                      <div className="radarPlaceholder">
                        <div className="radarRing radarRingOuter" /><div className="radarRing radarRingInner" />
                        <div className="radarCore"><strong>{advAvgB}%</strong><span>Essay B</span></div>
                        <div className="radarFoot"><span>Essay A {advAvgA}%</span><span>11 Dims</span></div>
                      </div>
                    </article>
                    {advClusterBars.map((cluster) => (
                      <article className="chartCard" key={cluster.title}>
                        <h3>{cluster.title}</h3>
                        <div className="clusterMiniStats"><strong>{cluster.average}%</strong><span>{cluster.detail}</span></div>
                        <div className="miniBarRow topGap">
                          <div className="miniBarLabel">A</div>
                          <div className="miniBarTrack"><div className="miniBarFill essayAFill" style={{ width: `${(cluster.essayA / 5) * 100}%` }} /></div>
                          <div className="miniBarValue">{cluster.essayA.toFixed(1)}</div>
                        </div>
                        <div className="miniBarRow">
                          <div className="miniBarLabel">B</div>
                          <div className="miniBarTrack"><div className="miniBarFill essayBFill" style={{ width: `${(cluster.essayB / 5) * 100}%` }} /></div>
                          <div className="miniBarValue">{cluster.essayB.toFixed(1)}</div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="scoreSummary topGap">
                    {([['D1-D4 Writing Quality', advWritingDims], ['D5-D8 Evidence Use', advEvidenceDims], ['D9-D11 Overall', advOverallDims]] as const).map(([label, dims]) => (
                      <div className="clusterSection" key={label}>
                        <h4>{label}</h4>
                        {(dims as typeof compositionDimensionExamples).map((dim) => (
                          <div className="scoreRow" key={dim.id}>
                            <div className="scoreLabel">{dim.id}</div>
                            <div className="scoreBarWrap">
                              <div className="scoreBar essayAFill" style={{ width: `${(dim.essayA / 5) * 100}%` }} />
                              <div className="scoreBar essayBFill" style={{ width: `${(dim.essayB / 5) * 100}%` }} />
                            </div>
                            <div className="scoreVals">{dim.essayA.toFixed(1)} / {dim.essayB.toFixed(1)}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="analyticsSectionTitle topGap">Dimension Detail</div>
                  <div className="dimsGrid">
                    {compositionDimensionExamples.map((dimension) => {
                      const isOpen = expandedDimensionId === dimension.id;
                      return (
                        <article className={isOpen ? 'dimCard open' : 'dimCard'} key={dimension.id}>
                          <button className="dimHeaderButton" onClick={() => setExpandedDimensionId(isOpen ? '' : dimension.id)} type="button">
                            <div className="dimNum">{dimension.id}</div>
                            <div className="dimTitleBlock"><div className="dimLabel">{dimension.title}</div><div className="dimSubLabel">{dimension.sub}</div></div>
                            <div className="dimScoreStack">
                              <span className="scorePill essayAPill">{dimension.essayA.toFixed(1)}</span>
                              <span className="scorePill essayBPill">{dimension.essayB.toFixed(1)}</span>
                            </div>
                            <span className="dimChevron">{isOpen ? '−' : '+'}</span>
                          </button>
                          {isOpen && (
                            <div className="dimBody">
                              <div className="miniBarRow"><div className="miniBarLabel">A</div><div className="miniBarTrack"><div className="miniBarFill essayAFill" style={{ width: `${(dimension.essayA / 5) * 100}%` }} /></div><div className="miniBarValue">{dimension.essayA.toFixed(1)}</div></div>
                              <div className="miniBarRow"><div className="miniBarLabel">B</div><div className="miniBarTrack"><div className="miniBarFill essayBFill" style={{ width: `${(dimension.essayB / 5) * 100}%` }} /></div><div className="miniBarValue">{dimension.essayB.toFixed(1)}</div></div>
                              <div className="dimContentBlock"><span className="essayTag essayTagA">Essay A</span><p>{dimension.essayAText}</p></div>
                              <div className="dimContentBlock"><span className="essayTag essayTagB">Essay B</span><p>{dimension.essayBText}</p></div>
                              <div className="dimContentBlock dimTeacherBlock"><span className="essayTag essayTagTeacher">Teacher View</span><p>{dimension.teacherView}</p></div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Student history */}
              {advancedTab === 'history' && (
                <div className="advTabContent">
                  {!selectedComposition ? (
                    <div className="notice"><CheckCircle2 size={18} /><span>Select a submission to view student history.</span></div>
                  ) : studentHistory.length === 0 ? (
                    <div className="notice"><CheckCircle2 size={18} /><span>No other evaluated submissions found for {selectedComposition.studentName}. Evaluate more submissions to compare.</span></div>
                  ) : (
                    <>
                      <p className="advSubtitle">Comparing <strong>{selectedComposition.studentName}</strong> across {studentHistory.length + 1} evaluated submission{studentHistory.length > 0 ? 's' : ''}.</p>
                      <div className="historyTable">
                        <div className="historyTableHead">
                          <div className="historyDimCol">Dimension</div>
                          <div className="historyScoreCol current">Current<br /><small>{safeDate(selectedComposition.submittedAt).split(',')[0]}</small></div>
                          {studentHistory.map((s) => (
                            <div key={s.id} className="historyScoreCol">
                              {s.testCode}<br /><small>{safeDate(s.submittedAt).split(',')[0]}</small>
                            </div>
                          ))}
                        </div>
                        {compositionDimensionExamples.map((dim) => {
                          const currentScore = eval_?.dimensions.find((d) => d.id === dim.id)?.score;
                          return (
                            <div className="historyTableRow" key={dim.id}>
                              <div className="historyDimCol"><strong>{dim.id}</strong> {dim.title}</div>
                              <div className="historyScoreCol current">
                                {currentScore != null ? (
                                  <span className="historyScorePill" style={{ background: scoreColor(currentScore) }}>{currentScore.toFixed(1)}</span>
                                ) : <span className="historyScorePill muted">—</span>}
                              </div>
                              {studentHistory.map((s) => {
                                const sc = s.evaluation?.dimensions.find((d) => d.id === dim.id)?.score;
                                const delta = currentScore != null && sc != null ? currentScore - sc : null;
                                return (
                                  <div key={s.id} className="historyScoreCol">
                                    {sc != null ? (
                                      <>
                                        <span className="historyScorePill" style={{ background: scoreColor(sc) }}>{sc.toFixed(1)}</span>
                                        {delta != null && delta !== 0 && (
                                          <span className={delta > 0 ? 'historyDelta pos' : 'historyDelta neg'}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}</span>
                                        )}
                                      </>
                                    ) : <span className="historyScorePill muted">—</span>}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                        <div className="historyTableRow historyTotalRow">
                          <div className="historyDimCol"><strong>Overall</strong></div>
                          <div className="historyScoreCol current">
                            {eval_ ? <span className="historyScorePill overallPill">{eval_.overallScore}</span> : <span className="historyScorePill muted">—</span>}
                          </div>
                          {studentHistory.map((s) => (
                            <div key={s.id} className="historyScoreCol">
                              {s.evaluation ? (
                                <>
                                  <span className="historyScorePill overallPill">{s.evaluation.overallScore}</span>
                                  {eval_ && <span className={eval_.overallScore > s.evaluation.overallScore ? 'historyDelta pos' : 'historyDelta neg'}>{eval_.overallScore > s.evaluation.overallScore ? '+' : ''}{eval_.overallScore - s.evaluation.overallScore}</span>}
                                </>
                              ) : <span className="historyScorePill muted">—</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Class average */}
              {advancedTab === 'class' && (
                <div className="advTabContent">
                  {classEvaluated.length < 2 ? (
                    <div className="notice"><CheckCircle2 size={18} /><span>Class average requires at least 2 evaluated submissions in the same class. Currently {classEvaluated.length} evaluated in {selectedComposition?.className ?? 'this class'}.</span></div>
                  ) : (
                    <>
                      <p className="advSubtitle">Class average from <strong>{classEvaluated.length}</strong> evaluated submissions in <strong>{selectedComposition?.className}</strong>.</p>
                      <div className="evalDimGrid">
                        {compositionDimensionExamples.map((dim) => {
                          const avg = classAvgDims.find((d) => d.id === dim.id)?.avg;
                          const currentScore = eval_?.dimensions.find((d) => d.id === dim.id)?.score;
                          const delta = currentScore != null && avg != null ? currentScore - avg : null;
                          const color = avg != null ? scoreColor(avg) : '#ccc';
                          return (
                            <article className="evalDimCard" key={dim.id}>
                              <div className="evalDimHeader">
                                <span className="evalDimId">{dim.id}</span>
                                <span className="evalDimTitle">{dim.title}</span>
                                <span className="evalDimScore" style={{ color }}>{avg != null ? avg.toFixed(1) : '—'}</span>
                              </div>
                              <div className="evalDimBarTrack">
                                {avg != null && <div className="evalDimBarFill" style={{ width: `${(avg / 5) * 100}%`, background: color }} />}
                              </div>
                              {delta != null && (
                                <p className="evalDimComment">
                                  This student: <strong style={{ color: scoreColor(currentScore!) }}>{currentScore!.toFixed(1)}</strong>
                                  <span className={delta >= 0 ? 'historyDelta pos' : 'historyDelta neg'}> ({delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs class avg)</span>
                                </p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </>
    );
  }

  if (activeView === 'paper-grading') {
    const selectedScanTask = scanTasks.find((task) => task.id === selectedScanTaskId) ?? scanTasks[0];

    return (
      <>
        <section className="split">
          <div className="panel">
            <SectionTitle icon={ClipboardList} title="Paper Grading Pipeline" subtitle="Teacher paper to correction result workflow" />
            <div className="timeline">
              {workflow.map(({ title, cn, icon: Icon, status, detail }, index) => (
                <article className="step" key={title}>
                  <div className="stepIcon">
                    <Icon size={19} />
                  </div>
                  <div>
                    <span className="stepStatus">{status}</span>
                    <h3>{index + 1}. {title}</h3>
                    <small>{cn}</small>
                    <p>{detail}</p>
                  </div>
                  <ChevronRight className="stepArrow" size={18} />
                </article>
              ))}
            </div>
          </div>

          <div className="panel accentPanel">
            <SectionTitle icon={Printer} title="New Scan Task" subtitle="Create teacher and student scan jobs" />
            <form className="formCard compactForm" onSubmit={(event) => void onScanTaskSubmit(event)}>
              <div className="formGrid">
                <label>
                  <span>Task Type</span>
                  <select
                    value={scanTaskForm.type}
                    onChange={(event) =>
                      onScanTaskFormChange((current) => ({
                        ...current,
                        type: event.target.value as CreateScanTaskInput['type'],
                        linkedAnswerPaper: event.target.value === 'Student Paper' ? current.linkedAnswerPaper : ''
                      }))
                    }
                  >
                    {scanTaskTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Printer</span>
                  <input value={scanTaskForm.printer} onChange={(event) => onScanTaskFormChange((current) => ({ ...current, printer: event.target.value }))} />
                </label>
                <label>
                  <span>Class</span>
                  <select value={scanTaskForm.className} onChange={(event) => onScanTaskFormChange((current) => ({ ...current, className: event.target.value }))}>
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.name}>{schoolClass.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Subject</span>
                  <select value={scanTaskForm.subject} onChange={(event) => onScanTaskFormChange((current) => ({ ...current, subject: event.target.value as CreateScanTaskInput['subject'] }))}>
                    {subjects.map((subject) => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>Paper Name</span>
                <input value={scanTaskForm.paperName} onChange={(event) => onScanTaskFormChange((current) => ({ ...current, paperName: event.target.value }))} />
              </label>
              {scanTaskForm.type === 'Student Paper' ? (
                <label>
                  <span>Linked Answer Paper</span>
                  <select value={scanTaskForm.linkedAnswerPaper ?? ''} onChange={(event) => onScanTaskFormChange((current) => ({ ...current, linkedAnswerPaper: event.target.value }))}>
                    <option value="">Select answer paper</option>
                    {scanTasks.filter((task) => task.type === 'Teacher Paper').map((task) => (
                      <option key={task.id} value={task.paperName}>{task.paperName}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button className="primaryButton wide" type="submit">
                <Printer size={18} />
                Create Scan Task
              </button>
            </form>
            <form className="formCard compactForm topGap" onSubmit={(event) => void onScanTaskUpload(event)}>
              <label>
                <span>Upload Target</span>
                <select value={selectedScanTaskId} onChange={(event) => onScanTaskSelect(event.target.value)}>
                  <option value="">Select scan task</option>
                  {scanTasks.map((task) => (
                    <option key={task.id} value={task.id}>{task.paperName} · {task.type}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>PDF File</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setSelectedUploadFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button className="primaryButton wide" type="submit">
                <Upload size={18} />
                Upload PDF
              </button>
            </form>
          </div>
        </section>

        <section className="panel">
          <SectionTitle icon={Printer} title="Scan Task Queue" subtitle="Current persisted scan tasks" />
          <div className="listStack">
            {scanTasks.map((task) => (
              <button
                className={task.id === selectedScanTask?.id ? 'selectCard active' : 'selectCard'}
                key={task.id}
                onClick={() => onScanTaskSelect(task.id)}
                type="button"
              >
                <div>
                  <strong>{task.paperName}</strong>
                  <span>{task.type} · {task.subject}</span>
                </div>
                <p>{task.className} · {task.printer} · {task.status}{task.linkedAnswerPaper ? ` · Answer: ${task.linkedAnswerPaper}` : ''}</p>
                <small>{task.fileName ? `PDF: ${task.fileName}` : 'No PDF uploaded yet'}</small>
              </button>
            ))}
          </div>
          <div className="panelInset topGap">
            <SectionTitle icon={FileSearch} title="Scan Task Details" subtitle="Inspect metadata and open the uploaded PDF directly" />
            {selectedScanTask ? (
              <div className="taskDetailCard">
                <div className="taskDetailGrid">
                  <article className="infoRow">
                    <div>
                      <strong>Task</strong>
                      <span>{selectedScanTask.id}</span>
                    </div>
                    <p>{selectedScanTask.paperName}</p>
                  </article>
                  <article className="infoRow">
                    <div>
                      <strong>Routing</strong>
                      <span>{selectedScanTask.type}</span>
                    </div>
                    <p>{selectedScanTask.className} · {selectedScanTask.subject} · {selectedScanTask.printer}</p>
                  </article>
                  <article className="infoRow">
                    <div>
                      <strong>Status</strong>
                      <span>{selectedScanTask.status}</span>
                    </div>
                    <p>{selectedScanTask.linkedAnswerPaper ? `Linked answer paper: ${selectedScanTask.linkedAnswerPaper}` : 'No linked answer paper required yet.'}</p>
                  </article>
                  <article className="infoRow">
                    <div>
                      <strong>Attachment</strong>
                      <span>{selectedScanTask.fileName ? 'PDF attached' : 'Pending upload'}</span>
                    </div>
                    <p>{selectedScanTask.fileName ?? 'Upload a teacher or student PDF to inspect it here.'}</p>
                  </article>
                </div>
                {selectedScanTask.uploadedAt ? (
                  <p className="detailMeta">Uploaded {new Date(selectedScanTask.uploadedAt).toLocaleString()}</p>
                ) : null}
                {selectedScanTask.fileUrl ? (
                  <div className="linkRow">
                    <a className="primaryButton" href={selectedScanTask.fileUrl} rel="noreferrer" target="_blank">
                      <FileSearch size={18} />
                      Preview PDF
                    </a>
                    <a className="secondaryButton" download href={selectedScanTask.fileUrl}>
                      <Download size={18} />
                      Download PDF
                    </a>
                  </div>
                ) : (
                  <div className="notice topGap">
                    <Upload size={18} />
                    <span>Select this task in the upload form and attach a PDF to enable preview and download.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="notice">
                <CheckCircle2 size={18} />
                <span>Create or select a scan task to view its details.</span>
              </div>
            )}
          </div>
        </section>

        <section className="resultsPanel">
          <SectionTitle icon={FileCheck2} title="Correction Results Workspace" subtitle="Select a student result, adjust score, and save teacher review" />
          <div className="split resultsSplit">
            <div className="panelInset">
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Paper</th>
                      <th>Score</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((item) => (
                      <tr
                        className={item.id === editingResultId ? 'selectedRow' : undefined}
                        key={item.id}
                        onClick={() => onResultSelect(item)}
                      >
                        <td>{item.studentName}</td>
                        <td>{item.className}</td>
                        <td>{item.paperName}</td>
                        <td>{item.score} / {item.total}</td>
                        <td><span className="statusPill">{item.reviewState}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panelInset">
              <form className="formCard" onSubmit={(event) => void onResultSubmit(event)}>
                <label>
                  <span>Selected Student</span>
                  <input value={results.find((item) => item.id === editingResultId)?.studentName ?? ''} disabled />
                </label>
                <div className="formGrid">
                  <label>
                    <span>Adjusted Score</span>
                    <input
                      type="number"
                      min="0"
                      value={resultForm.score}
                      onChange={(event) => onResultFormChange((current) => ({ ...current, score: Number(event.target.value) || 0 }))}
                    />
                  </label>
                  <label>
                    <span>Review State</span>
                    <select
                      value={resultForm.reviewState}
                      onChange={(event) => onResultFormChange((current) => ({ ...current, reviewState: event.target.value as StudentResult['reviewState'] }))}
                    >
                      {resultStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  <span>Error Reason / Teacher Note</span>
                  <textarea
                    value={resultForm.errorReason}
                    onChange={(event) => onResultFormChange((current) => ({ ...current, errorReason: event.target.value }))}
                  />
                </label>
                <button className="primaryButton wide" type="submit">
                  <FileCheck2 size={18} />
                  Save Teacher Adjustment
                </button>
              </form>
            </div>
          </div>
          <div className="exportBar">
            <button type="button"><Download size={17} />Original PDF Trace</button>
            <button type="button"><Download size={17} />Printable Trace</button>
            <button type="button"><Download size={17} />Export Excel</button>
          </div>
        </section>
      </>
    );
  }

  if (activeView === 'question-bank') {
    const normalizedSearch = questionBankFilters.search.trim().toLowerCase();
    const matchesQuestionBankFilters = (item: AnswerBankItem) => {
      const matchesSearch = !normalizedSearch
        || item.paperName.toLowerCase().includes(normalizedSearch)
        || item.questionStem.toLowerCase().includes(normalizedSearch)
        || item.rubric.toLowerCase().includes(normalizedSearch)
        || item.subject.toLowerCase().includes(normalizedSearch)
        || (item.grade?.toLowerCase().includes(normalizedSearch) ?? false)
        || (item.topic?.toLowerCase().includes(normalizedSearch) ?? false)
        || (item.difficulty?.toLowerCase().includes(normalizedSearch) ?? false)
        || (item.createdByName?.toLowerCase().includes(normalizedSearch) ?? false);
      const matchesSubject = questionBankFilters.subject === 'All' || item.subject === questionBankFilters.subject;
      const matchesStatus = questionBankFilters.status === 'All' || item.status === questionBankFilters.status;
      const matchesGrade = questionBankFilters.grade === 'All' || (item.grade || '') === questionBankFilters.grade;
      const matchesDifficulty = questionBankFilters.difficulty === 'All' || (item.difficulty || 'Standard') === questionBankFilters.difficulty;
      return matchesSearch && matchesSubject && matchesStatus && matchesGrade && matchesDifficulty;
    };
    const filteredAnswerBanks = answerBanks.filter(matchesQuestionBankFilters);
    const filteredArchivedAnswerBanks = archivedAnswerBanks.filter(matchesQuestionBankFilters);
    const selectedAnswerBank = answerBanks.find((item) => item.id === editingAnswerBankId);
    const canArchiveSelectedAnswerBank = Boolean(
      selectedAnswerBank &&
      selectedAnswerBank.createdByUserId &&
      selectedAnswerBank.createdByUserId === currentUser.id
    );
    return (
      <section className="split">
        <div className="panel">
          <SectionTitle icon={FolderKanban} title="Build Question Bank" subtitle="Teachers can save reusable questions, scores, and rubrics here" />
          <form className="formCard" onSubmit={(event) => void onCreateAnswerBank(event)}>
            <div className="formGrid">
              <label>
                <span>Paper Name</span>
                <input value={newAnswerBankForm.paperName} onChange={(event) => setNewAnswerBankForm((current) => ({ ...current, paperName: event.target.value }))} />
              </label>
              <label>
                <span>Subject</span>
                <select value={newAnswerBankForm.subject} onChange={(event) => setNewAnswerBankForm((current) => ({ ...current, subject: event.target.value as CreateAnswerBankInput['subject'] }))}>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Grade</span>
                <select value={newAnswerBankForm.grade || grades[0]} onChange={(event) => setNewAnswerBankForm((current) => ({ ...current, grade: event.target.value }))}>
                  {grades.map((grade) => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Difficulty</span>
                <select value={newAnswerBankForm.difficulty || 'Standard'} onChange={(event) => setNewAnswerBankForm((current) => ({ ...current, difficulty: event.target.value as QuestionDifficulty }))}>
                  {questionDifficulties.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>{difficulty}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Topic</span>
              <input value={newAnswerBankForm.topic || ''} onChange={(event) => setNewAnswerBankForm((current) => ({ ...current, topic: event.target.value }))} />
            </label>
            <label>
              <span>Question Stem</span>
              <textarea value={newAnswerBankForm.questionStem} onChange={(event) => setNewAnswerBankForm((current) => ({ ...current, questionStem: event.target.value }))} />
            </label>
            <div className="formGrid">
              <label>
                <span>Score</span>
                <input type="number" min="1" value={newAnswerBankForm.score} onChange={(event) => setNewAnswerBankForm((current) => ({ ...current, score: Number(event.target.value) || 1 }))} />
              </label>
              <label>
                <span>Status</span>
                <select value={newAnswerBankForm.status} onChange={(event) => setNewAnswerBankForm((current) => ({ ...current, status: event.target.value as AnswerBankItem['status'] }))}>
                  {answerStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Rubric</span>
              <textarea value={newAnswerBankForm.rubric} onChange={(event) => setNewAnswerBankForm((current) => ({ ...current, rubric: event.target.value }))} />
            </label>
            <button className="primaryButton wide" type="submit">
              <FolderKanban size={18} />
              Add Question Bank Item
            </button>
          </form>
        </div>

        <div className="panel">
          <SectionTitle icon={LibraryBig} title="Answer Bank" subtitle="Select an AI-generated answer set to review and correct" />
          <div className="formCard compactForm">
            <label>
              <span>Search</span>
              <input
                placeholder="Paper name, question, rubric, creator"
                value={questionBankFilters.search}
                onChange={(event) => setQuestionBankFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </label>
            <div className="formGrid">
              <label>
                <span>Subject Filter</span>
                <select
                  value={questionBankFilters.subject}
                  onChange={(event) => setQuestionBankFilters((current) => ({ ...current, subject: event.target.value }))}
                >
                  <option value="All">All subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status Filter</span>
                <select
                  value={questionBankFilters.status}
                  onChange={(event) => setQuestionBankFilters((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="All">All statuses</option>
                  {answerStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Grade Filter</span>
                <select
                  value={questionBankFilters.grade}
                  onChange={(event) => setQuestionBankFilters((current) => ({ ...current, grade: event.target.value }))}
                >
                  <option value="All">All grades</option>
                  {grades.map((grade) => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Difficulty Filter</span>
                <select
                  value={questionBankFilters.difficulty}
                  onChange={(event) => setQuestionBankFilters((current) => ({ ...current, difficulty: event.target.value }))}
                >
                  <option value="All">All difficulty levels</option>
                  {questionDifficulties.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>{difficulty}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="listStack">
            {filteredAnswerBanks.map((item) => (
              <button
                className={item.id === editingAnswerBankId ? 'selectCard active' : 'selectCard'}
                key={item.id}
                onClick={() => onAnswerBankSelect(item)}
                type="button"
              >
                <div>
                  <strong>{item.paperName}</strong>
                  <span>{item.subject} · {item.grade || 'No grade'} · {item.difficulty || 'Standard'}</span>
                </div>
                <p>{item.questionStem}</p>
                <small>{item.score} points · {item.status}{item.topic ? ` · ${item.topic}` : ''}{item.createdByName ? ` · by ${item.createdByName}` : ''}</small>
              </button>
            ))}
            {!filteredAnswerBanks.length ? (
              <div className="notice">
                <CheckCircle2 size={18} />
                <span>No active question-bank items match the current filters.</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <SectionTitle icon={FolderKanban} title="Archived Items" subtitle="Restore previously archived teacher question-bank items" />
          {filteredArchivedAnswerBanks.length ? (
            <div className="listStack">
              {filteredArchivedAnswerBanks.map((item) => (
                <article className="infoRow" key={item.id}>
                  <div>
                    <strong>{item.paperName}</strong>
                    <span>{item.subject} · {item.grade || 'No grade'} · {item.difficulty || 'Standard'}</span>
                  </div>
                  <p>{item.questionStem}</p>
                  <small>{item.score} points{item.topic ? ` · ${item.topic}` : ''} · archived {item.archivedAt ? new Date(item.archivedAt).toLocaleString() : 'recently'}</small>
                  <button className="secondaryButton" onClick={() => void onRestoreAnswerBank(item.id)} type="button">
                    <FolderKanban size={18} />
                    Restore Item
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="notice">
              <CheckCircle2 size={18} />
              <span>No archived question-bank items match the current filters.</span>
            </div>
          )}
        </div>

        <div className="panel accentPanel">
          <SectionTitle icon={PenLine} title="Edit Answer Bank Item" subtitle="Adjust question stem, score, rubric, and release state" />
          {selectedAnswerBank ? (
            <form className="formCard" onSubmit={(event) => void onAnswerBankSubmit(event)}>
              <label>
                <span>Paper</span>
                <input value={selectedAnswerBank.paperName} disabled />
              </label>
              <div className="formGrid">
                <label>
                  <span>Grade</span>
                  <select value={answerBankForm.grade || grades[0]} onChange={(event) => onAnswerBankFormChange((current) => ({ ...current, grade: event.target.value }))}>
                    {grades.map((grade) => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Difficulty</span>
                  <select value={answerBankForm.difficulty || 'Standard'} onChange={(event) => onAnswerBankFormChange((current) => ({ ...current, difficulty: event.target.value as QuestionDifficulty }))}>
                    {questionDifficulties.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>{difficulty}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>Topic</span>
                <input value={answerBankForm.topic || ''} onChange={(event) => onAnswerBankFormChange((current) => ({ ...current, topic: event.target.value }))} />
              </label>
              <label>
                <span>Question Stem</span>
                <textarea value={answerBankForm.questionStem} onChange={(event) => onAnswerBankFormChange((current) => ({ ...current, questionStem: event.target.value }))} />
              </label>
              <div className="formGrid">
                <label>
                  <span>Score</span>
                  <input type="number" min="1" value={answerBankForm.score} onChange={(event) => onAnswerBankFormChange((current) => ({ ...current, score: Number(event.target.value) || 1 }))} />
                </label>
                <label>
                  <span>Status</span>
                  <select value={answerBankForm.status} onChange={(event) => onAnswerBankFormChange((current) => ({ ...current, status: event.target.value as AnswerBankItem['status'] }))}>
                    {answerStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>Rubric</span>
                <textarea value={answerBankForm.rubric} onChange={(event) => onAnswerBankFormChange((current) => ({ ...current, rubric: event.target.value }))} />
              </label>
              <button className="primaryButton wide" type="submit">
                <Sparkles size={18} />
                Save Answer Bank
              </button>
              {canArchiveSelectedAnswerBank ? (
                <button className="secondaryButton wide topGap" onClick={() => void onArchiveAnswerBank()} type="button">
                  <FolderKanban size={18} />
                  Archive Question Bank Item
                </button>
              ) : null}
            </form>
          ) : (
            <div className="notice">
              <CheckCircle2 size={18} />
              <span>Select an answer bank item to begin editing.</span>
            </div>
          )}
        </div>

        <div className="panel fullSpan">
          <SectionTitle icon={PenLine} title="Segmentation Rules" subtitle="How the current V1.1 answer bank is produced" />
          <div className="listStack">
            {subjectRules.map(([title, detail]) => (
              <article className="infoRow" key={title}>
                <div>
                  <strong>{title}</strong>
                  <span>V1.1</span>
                </div>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (activeView === 'audio-tools') {
    return <AudioToolsView />;
  }

  if (activeView === 'analytics') {
    return (
      <section className="split">
        <div className="panel">
          <SectionTitle icon={BarChart3} title="Learning Analytics" subtitle="Class and school level snapshots" />
          <div className="barList">
            {[
              ['Grade 7 Jade', 79],
              ['Grade 8 Harbor', 83],
              ['Grade 9 Cedar', 87]
            ].map(([label, value]) => (
              <div className="barRow" key={label}>
                <span>{label}</span>
                <div className="barTrack"><i style={{ width: `${value}%` }} /></div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="panel accentPanel">
          <SectionTitle icon={Sparkles} title="AI Flags" subtitle="Suggested manual review triggers" />
          <div className="chipRow">
            {['Low OCR confidence', 'Essay page mismatch', 'Rubric edited by teacher', 'Large score adjustment', 'Missing student ID box'].map((item) => (
              <span className="chip" key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="split">
      <div className="panel">
        <SectionTitle icon={School} title="Platform Overview" subtitle="Roles and major system modules" />
        <div className="cardGrid">
          {[
            ['Admin', 'Teacher registration, school stats, question bank'],
            ['Teacher', 'Segmentation, answer review, grading, exports'],
            ['Student', 'Wrong-question review and practice']
          ].map(([title, detail]) => (
            <article className="miniCard" key={title}>
              <strong>{title}</strong>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </div>
      <div className="panel accentPanel">
        <SectionTitle icon={FileSearch} title="Live Snapshot" subtitle="Key objects in the current system" />
        <div className="chipRow">
          <span className="chip">{teachers.length} teachers</span>
          <span className="chip">{classes.length} classes</span>
          <span className="chip">{scanTasks.length} scan tasks</span>
          <span className="chip">{answerBanks.length} answer bank items</span>
          <span className="chip">{results.length} student results</span>
        </div>
      </div>
    </section>
  );
}

function AudioToolsView() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState('');
  const [error, setError] = useState('');

  async function handleProcess() {
    if (!file || processing) return;
    setProcessing(true);
    setError('');
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    try {
      const formData = new FormData();
      formData.append('audio', file);
      const response = await fetch('/api/audio/extract-instrumental', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const base = file.name.replace(/\.[^.]+$/, '');
      setDownloadUrl(url);
      setDownloadName(`${base}-instrumental.mp3`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="split">
      <div className="panel">
        <SectionTitle icon={Music} title="Vocal Removal" subtitle="Upload an MP3 and extract the instrumental track by removing centred vocals" />
        <div className="formCard">
          <label>
            <span>Audio File</span>
            <input
              type="file"
              accept=".mp3,.wav,.m4a,.flac,.ogg,.aac,audio/*"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setDownloadUrl(null);
                setError('');
              }}
            />
          </label>
          {file && (
            <p className="audioFileName"><Music size={14} /> {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
          )}
          <button
            className={processing ? 'secondaryButton wide' : 'primaryButton wide'}
            type="button"
            disabled={!file || processing}
            onClick={() => void handleProcess()}
          >
            {processing ? <><LoaderCircle className="spin" size={16} />Processing…</> : <><Music size={16} />Remove Vocals</>}
          </button>
          {error && <p className="audioError">{error}</p>}
          {downloadUrl && (
            <a className="primaryButton wide audioDownload" href={downloadUrl} download={downloadName}>
              <Download size={16} />{downloadName}
            </a>
          )}
        </div>
      </div>
      <div className="panel accentPanel">
        <SectionTitle icon={Music} title="How it works" subtitle="Center-channel vocal cancellation via FFmpeg" />
        <div className="listStack">
          {[
            ['Works best with', 'Stereo MP3 / WAV tracks where the lead vocal is panned to centre — typical in most commercial recordings.'],
            ['Removes', 'Centred mono signals: lead vocals, spoken narration, centred solo instruments.'],
            ['Keeps', 'Instruments panned left or right — drums, bass, guitars, keys, backing vocals.'],
            ['Output', '192 kbps stereo MP3, ready to download and play immediately.'],
            ['Limitation', 'Mono files or recordings where instruments share the centre channel will sound hollow. Studio-quality separation requires a dedicated ML model (e.g. Demucs).']
          ].map(([label, detail]) => (
            <article className="infoRow" key={label as string}>
              <div><strong>{label as string}</strong></div>
              <p>{detail as string}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const statusOrder: CompositionSubmissionStatus[] = ['Received', 'AI Reviewing', 'Teacher Reviewing', 'Completed'];

function StudentTestView(props: {
  activeView: ViewKey;
  compositionSubmissions: CompositionSubmission[];
  currentStudent?: Student;
  currentUser: AuthUser;
  classes: SchoolClass[];
  onCompositionSelect: (item: CompositionSubmission) => void;
  onNewSubmission: (submission: CompositionSubmission) => void;
  selectedComposition?: CompositionSubmission;
}) {
  const { activeView, compositionSubmissions, currentStudent, currentUser, classes, onCompositionSelect, onNewSubmission, selectedComposition } = props;

  const [step, setStep] = useState<'select' | 'write' | 'done'>('select');
  const [selectedTest, setSelectedTest] = useState<AvailableTest | null>(null);
  const [shortAnswer, setShortAnswer] = useState('');
  const [essayText, setEssayText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const [submitError, setSubmitError] = useState('');

  const className = currentStudent ? (classes.find((c) => c.id === currentStudent.classId)?.name ?? '') : '';
  const wordCount = essayText.trim() ? essayText.trim().split(/\s+/).length : 0;
  const submittedItem = submittedId
    ? (compositionSubmissions.find((s) => s.id === submittedId) ?? null)
    : null;
  const activeStatusIndex = submittedItem ? statusOrder.indexOf(submittedItem.status) : 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedTest || !shortAnswer.trim() || !essayText.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await mockApi.createCompositionSubmission({
        testCode: selectedTest.code,
        promptTitle: selectedTest.title,
        promptText: selectedTest.prompt,
        shortAnswer: shortAnswer.trim(),
        essayText: essayText.trim()
      });
      onNewSubmission(created);
      setSubmittedId(created.id);
      setStep('done');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function startTest(test: AvailableTest) {
    setSelectedTest(test);
    setShortAnswer('');
    setEssayText('');
    setSubmitError('');
    setStep('write');
  }

  function resetToSelect() {
    setStep('select');
    setSelectedTest(null);
    setShortAnswer('');
    setEssayText('');
    setSubmittedId('');
    setSubmitError('');
  }

  if (step === 'select') {
    return (
      <>
        <section className="panel">
          <SectionTitle icon={PenLine} title="Composition Test" subtitle="Select a test below to begin. You can write and submit your answer directly on screen." />
          <div className="testGrid">
            {availableTests.map((test) => (
              <button className="testCard" key={test.code} onClick={() => startTest(test)} type="button">
                <div className="testCardHeader">
                  <span className="testCode">{test.code}</span>
                  <span className="testSubject">{test.subject}</span>
                </div>
                <strong className="testTitle">{test.title}</strong>
                <p className="testPromptPreview">{test.prompt.slice(0, 90)}…</p>
                <span className="testStartCta">Start writing →</span>
              </button>
            ))}
          </div>
        </section>

        {compositionSubmissions.length > 0 && (activeView === 'composition-test' || activeView === 'overview') && (
          <section className="panel">
            <SectionTitle icon={ClipboardList} title="Submission History" subtitle="Your submitted compositions and their current review stage" />
            <div className="listStack">
              {compositionSubmissions.map((item) => (
                <button
                  className={item.id === selectedComposition?.id ? 'selectCard active' : 'selectCard'}
                  key={item.id}
                  onClick={() => onCompositionSelect(item)}
                  type="button"
                >
                  <div>
                    <strong>{item.promptTitle}</strong>
                    <span>{item.testCode} · {item.className}</span>
                  </div>
                  <p>{item.status} · {item.overallBand ?? 'Pending'} · Submitted {safeDate(item.submittedAt)}</p>
                  <small>{item.teacherSummary || item.aiSuggestion || 'Waiting for feedback.'}</small>
                </button>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  if (step === 'write' && selectedTest) {
    return (
      <section className="panel">
        <div className="examHeader">
          <button className="backLink" onClick={resetToSelect} type="button">← All Tests</button>
          <span className="testCode">{selectedTest.code}</span>
          <span className="testSubject">{selectedTest.subject}</span>
        </div>
        <h2 className="examTitle">{selectedTest.title}</h2>

        <div className="promptCard">
          <span className="promptLabel">Prompt</span>
          <p className="promptText">{selectedTest.prompt}</p>
        </div>

        <div className="examMeta">
          <span>Student: <strong>{currentStudent?.studentNo ?? currentUser.username}</strong></span>
          {className && <span>Class: <strong>{className}</strong></span>}
        </div>

        <form className="examForm" onSubmit={(event) => void handleSubmit(event)}>
          <label className="examLabel">
            <span>Short Answer <em>(1–2 sentences, direct response to the prompt)</em></span>
            <textarea
              className="examTextarea"
              placeholder="Write your short answer here…"
              value={shortAnswer}
              onChange={(e) => setShortAnswer(e.target.value)}
              rows={3}
            />
          </label>

          <label className="examLabel">
            <span>Main Essay <em>(develop your ideas fully)</em></span>
            <textarea
              className="examTextarea essayTextarea"
              placeholder="Write your essay here…"
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              rows={14}
            />
            <div className="wordCountRow">
              <span className={wordCount >= 100 ? 'wordCount good' : 'wordCount'}>
                {wordCount} word{wordCount !== 1 ? 's' : ''}
              </span>
              {wordCount < 100 && <span className="wordHint">Aim for at least 100 words</span>}
            </div>
          </label>

          {submitError && (
            <div className="notice" style={{ background: 'rgba(248,228,220,0.9)', color: '#9b4127', borderColor: 'rgba(201,94,63,0.2)' }}>
              {submitError}
            </div>
          )}

          <div className="examActions">
            <button className="secondaryButton" onClick={resetToSelect} type="button">Cancel</button>
            <button
              className="primaryButton"
              type="submit"
              disabled={submitting || !shortAnswer.trim() || !essayText.trim()}
            >
              {submitting ? <><LoaderCircle className="spin" size={16} /> Submitting…</> : <><Upload size={16} /> Submit Composition</>}
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="doneHeader">
          <CheckCircle2 size={32} className="doneIcon" />
          <div>
            <h2 className="doneTitle">Composition Submitted</h2>
            <p className="doneSub">{submittedItem?.testCode ?? selectedTest?.code} · {safeDate(submittedItem?.submittedAt)}</p>
          </div>
        </div>

        <div className="statusTracker">
          {statusOrder.map((status, i) => (
            <div className={i <= activeStatusIndex ? 'statusStep active' : 'statusStep'} key={status}>
              <div className="statusDot" />
              <span>{status}</span>
            </div>
          ))}
        </div>

        {submittedItem && (
          <div className="feedbackGrid">
            <article className="infoRow">
              <div>
                <strong>Overall Band</strong>
                <span>{submittedItem.overallBand ?? 'Pending'}</span>
              </div>
              <p>{submittedItem.overallBand && submittedItem.overallBand !== 'Pending' ? `Your composition has been banded as: ${submittedItem.overallBand}` : 'Band not yet assigned.'}</p>
            </article>
            <article className="infoRow">
              <div>
                <strong>Suggestion</strong>
                <span>Auto-generated</span>
              </div>
              <p>{submittedItem.aiSuggestion || 'Review not yet started.'}</p>
            </article>
            <article className="infoRow fullSpan">
              <div>
                <strong>Teacher Summary</strong>
                <span>From your teacher</span>
              </div>
              <p>{submittedItem.teacherSummary || 'Teacher has not yet added a comment.'}</p>
            </article>
          </div>
        )}

        <p className="refreshNote">This page refreshes automatically every 15 seconds.</p>

        <div className="examActions">
          <button className="secondaryButton" onClick={resetToSelect} type="button">Take Another Test</button>
        </div>
      </section>

      <section className="panel">
        <SectionTitle icon={ClipboardList} title="All Submissions" subtitle="Your submitted compositions and their current review stage" />
        <div className="listStack">
          {compositionSubmissions.map((item) => (
            <button
              className={item.id === submittedItem?.id ? 'selectCard active' : 'selectCard'}
              key={item.id}
              onClick={() => { setSubmittedId(item.id); onCompositionSelect(item); }}
              type="button"
            >
              <div>
                <strong>{item.promptTitle}</strong>
                <span>{item.testCode} · {item.className}</span>
              </div>
              <p>{item.status} · {item.overallBand ?? 'Pending'} · {safeDate(item.submittedAt)}</p>
              <small>{item.teacherSummary || item.aiSuggestion || 'Waiting for feedback.'}</small>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function SectionTitle(props: { icon: typeof School; title: string; subtitle: string }) {
  const { icon: Icon, title, subtitle } = props;
  return (
    <div className="sectionTitle">
      <Icon size={21} />
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

export { App };
