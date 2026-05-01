export type Role = 'Admin' | 'Teacher' | 'Student';
export type TeacherRole = 'Homeroom Teacher' | 'Teacher';
export type Subject = 'Chinese' | 'Mathematics' | 'English' | 'Composition';
export type QuestionDifficulty = 'Foundation' | 'Standard' | 'Advanced';
export type ScanTaskType = 'Teacher Paper' | 'Student Paper';
export type ScanTaskStatus = 'Completed' | 'Pending Segmentation' | 'Answer Completed' | 'In Grading';
export type CompositionSubmissionStatus = 'Received' | 'AI Reviewing' | 'Teacher Reviewing' | 'Completed';

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  role: TeacherRole;
  assignedClassIds: string[];
}

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  username: string;
  linkedTeacherId?: string;
  linkedStudentId?: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade: string;
  homeroomTeacherId: string;
  studentCount: number;
}

export interface Student {
  id: string;
  name: string;
  classId: string;
  studentNo: string;
  accuracy: number;
  weakTags: string[];
}

export interface DimensionEvalScore {
  id: string;
  score: number;
  comment: string;
}

export interface EssayEvaluation {
  dimensions: DimensionEvalScore[];
  overallScore: number;
  overallBand: string;
  overallComment: string;
  strengths: string[];
  improvements: string[];
  evaluatedAt: string;
}

export interface CompositionSubmission {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  testCode: string;
  promptTitle: string;
  promptText: string;
  shortAnswer: string;
  essayText: string;
  status: CompositionSubmissionStatus;
  submittedAt: string;
  updatedAt: string;
  teacherSummary?: string;
  aiSuggestion?: string;
  overallBand?: string;
  evaluation?: EssayEvaluation;
}

export interface CreateCompositionSubmissionInput {
  testCode: string;
  promptTitle: string;
  promptText: string;
  shortAnswer: string;
  essayText: string;
}

export interface UpdateCompositionSubmissionInput {
  status: CompositionSubmissionStatus;
  teacherSummary?: string;
  aiSuggestion?: string;
  overallBand?: string;
}

export interface ScanTask {
  id: string;
  type: ScanTaskType;
  printer: string;
  className: string;
  subject: Subject;
  paperName: string;
  status: ScanTaskStatus;
  linkedAnswerPaper?: string;
  fileName?: string;
  fileUrl?: string;
  uploadedAt?: string;
}

export interface CreateScanTaskInput {
  type: ScanTaskType;
  printer: string;
  className: string;
  subject: Subject;
  paperName: string;
  linkedAnswerPaper?: string;
}

export interface AnswerBankItem {
  id: string;
  paperName: string;
  subject: Subject;
  grade?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  questionStem: string;
  score: number;
  rubric: string;
  status: 'Teacher Review' | 'Ready for Grading';
  createdByUserId?: string;
  createdByName?: string;
  archivedAt?: string;
  archivedByUserId?: string;
}

export interface UpdateAnswerBankInput {
  grade?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  questionStem: string;
  score: number;
  rubric: string;
  status: AnswerBankItem['status'];
}

export interface CreateAnswerBankInput extends UpdateAnswerBankInput {
  paperName: string;
  subject: Subject;
}

export interface StudentResult {
  id: string;
  studentName: string;
  className: string;
  paperName: string;
  score: number;
  total: number;
  reviewState: 'Ready' | 'Needs Review' | 'Adjusted';
  errorReason: string;
}

export interface UpdateStudentResultInput {
  score: number;
  reviewState: StudentResult['reviewState'];
  errorReason: string;
}

export interface RegisterInput {
  role: Role;
  name: string;
  username: string;
  password: string;
  phone?: string;
  teacherRole?: TeacherRole;
  classId?: string;
  studentNo?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const mockApi = {
  listPublicClasses() {
    return request<Array<Pick<SchoolClass, 'id' | 'name' | 'grade'>>>('/api/public/classes');
  },

  getSession() {
    return request<AuthResponse>('/api/auth/session');
  },

  login(input: { username: string; password: string }) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  register(input: RegisterInput) {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  logout() {
    return request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST'
    });
  },

  listTeachers() {
    return request<Teacher[]>('/api/teachers');
  },

  listClasses() {
    return request<SchoolClass[]>('/api/classes');
  },

  listStudents() {
    return request<Student[]>('/api/students');
  },

  listScanTasks() {
    return request<ScanTask[]>('/api/scan-tasks');
  },

  createScanTask(input: CreateScanTaskInput) {
    return request<ScanTask>('/api/scan-tasks', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async uploadScanTaskFile(id: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`/api/scan-tasks/${id}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Upload failed: ${response.status}`);
    }
    return response.json() as Promise<ScanTask>;
  },

  listAnswerBanks() {
    return request<AnswerBankItem[]>('/api/answer-banks');
  },

  listArchivedAnswerBanks() {
    return request<AnswerBankItem[]>('/api/answer-banks/archived');
  },

  createAnswerBank(input: CreateAnswerBankInput) {
    return request<AnswerBankItem>('/api/answer-banks', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  updateAnswerBank(id: string, input: UpdateAnswerBankInput) {
    return request<AnswerBankItem>(`/api/answer-banks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    });
  },

  archiveAnswerBank(id: string) {
    return request<{ ok: boolean; id: string }>(`/api/answer-banks/${id}/archive`, {
      method: 'POST'
    });
  },

  restoreAnswerBank(id: string) {
    return request<{ ok: boolean; id: string }>(`/api/answer-banks/${id}/restore`, {
      method: 'POST'
    });
  },

  listResults() {
    return request<StudentResult[]>('/api/results');
  },

  listCompositionSubmissions() {
    return request<CompositionSubmission[]>('/api/composition-submissions');
  },

  createCompositionSubmission(input: CreateCompositionSubmissionInput) {
    return request<CompositionSubmission>('/api/composition-submissions', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  updateCompositionSubmission(id: string, input: UpdateCompositionSubmissionInput) {
    return request<CompositionSubmission>(`/api/composition-submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    });
  },

  evaluateCompositionSubmission(id: string) {
    return request<CompositionSubmission>(`/api/composition-submissions/${id}/evaluate`, {
      method: 'POST'
    });
  },

  updateResult(id: string, input: UpdateStudentResultInput) {
    return request<StudentResult>(`/api/results/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    });
  },

  registerTeacher(input: { name: string; phone: string; role: TeacherRole }) {
    return request<Teacher>('/api/teachers', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  createClass(input: { name: string; grade: string; homeroomTeacherId: string }) {
    return request<SchoolClass>('/api/classes', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  importStudents(input: { classId: string; csvText: string }) {
    return request<Student[]>('/api/students/import', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }
};
