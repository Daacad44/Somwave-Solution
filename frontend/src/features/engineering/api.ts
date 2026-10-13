import type {
  CreateEngineeringTaskInput,
  DocumentationVersionRecord,
  ProjectDocumentation,
} from '@somwave/shared';
import { apiDownload, apiFetch, apiUpload } from '../../lib/apiClient';

export interface EngineeringProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  managerId: string | null;
}

export interface EngineeringTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  approvalStatus: string;
  dueDate: string | null;
  estimatedHours: string | number | null;
  assigneeId: string | null;
  reporterId: string | null;
  kind: string;
  phaseId: string | null;
  parentTaskId: string | null;
  milestoneId: string | null;
  startDate: string | null;
  progressPercent: number;
  blockedReason: string | null;
  qaVerifiedAt: string | null;
}

export interface ProjectPhase {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  order: number;
}
export interface TaskChecklistItem {
  id: string;
  title: string;
  completedAt: string | null;
}
export interface TaskComment {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
}
export interface TaskProgress {
  id: string;
  body: string;
  progressPercent: number;
  createdAt: string;
}
export interface TaskDependency {
  taskId: string;
  dependsOnId: string;
  dependsOn: { id: string; title: string; status: string };
}
export interface TaskTransition {
  id: string;
  fromStatus: string;
  toStatus: string;
  createdAt: string;
  actorId: string;
}
export interface TaskHour {
  id: string;
  minutes: number;
  date: string;
  note: string | null;
  userId: string;
}
export interface TaskAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface EngineeringMember {
  id: string;
  role: string;
  responsibilities: string | null;
  user: { id: string; name: string; email: string };
}

export interface ProjectInvitation {
  id: string;
  projectId: string;
  role: string;
  responsibilities: string | null;
  description: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
  estimatedHours: number | string | null;
  priority: string;
  managerNotes: string | null;
  expiresAt: string | null;
  status: string;
  invitedAt: string;
  project: {
    name: string;
    description: string | null;
    dueDate: string | null;
    manager: { id: string; name: string } | null;
  };
}

export interface PendingProjectInvitation {
  id: string;
  role: string;
  responsibilities: string | null;
  description: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
  estimatedHours: number | string | null;
  priority: string;
  managerNotes: string | null;
  expiresAt: string | null;
  status: string;
  invitedAt: string;
  user: { id: string; name: string; email: string };
}

export interface EligibleEngineer {
  id: string;
  name: string;
  email: string;
  weeklyCapacityHours: number;
  availableHoursThisWeek: number;
  estimatedHoursThisWeek: number;
  estimatedOpenHours: number;
  overCapacity: boolean;
  nearCapacity: boolean;
}

export interface ManagedSystem {
  id: string;
  name: string;
  description: string | null;
  currentVersion: string | null;
  maintenanceStatus: string;
}

export interface EngineeringBug {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  assigneeId: string | null;
}

export interface EngineeringUpdate {
  id: string;
  title: string;
  category: string;
  status: string;
}

export interface EngineeringRelease {
  id: string;
  version: string;
  status: string;
}

export interface EngineeringMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  activeEngineers: number;
  tasksInProgress: number;
  completedTasks: number;
  overdueTasks: number;
  pendingReviews: number;
  openBugs: number;
  criticalBugs: number;
  scheduledMaintenance: number;
  upcomingReleases: number;
}

const DOCUMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  md: 'text/markdown',
  markdown: 'text/markdown',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const engineeringApi = {
  projects: () => apiFetch<EngineeringProject[]>('/engineering/projects'),
  metrics: () => apiFetch<EngineeringMetrics>('/engineering/metrics'),
  tasks: (projectId: string) =>
    apiFetch<EngineeringTask[]>(`/engineering/projects/${projectId}/tasks`),
  phases: (projectId: string) =>
    apiFetch<ProjectPhase[]>(`/engineering/projects/${projectId}/phases`),
  createPhase: (projectId: string, title: string, startDate?: string, dueDate?: string) =>
    apiFetch<ProjectPhase>(`/engineering/projects/${projectId}/phases`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        ...(startDate ? { startDate } : {}),
        ...(dueDate ? { dueDate } : {}),
      }),
    }),
  taskComments: (taskId: string) =>
    apiFetch<TaskComment[]>(`/engineering/tasks/${taskId}/comments`),
  addTaskComment: (taskId: string, body: string) =>
    apiFetch<TaskComment>(`/engineering/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  taskProgress: (taskId: string) =>
    apiFetch<TaskProgress[]>(`/engineering/tasks/${taskId}/progress`),
  addTaskProgress: (
    taskId: string,
    body: string,
    progressPercent: number,
    blockedReason?: string,
  ) =>
    apiFetch<TaskProgress>(`/engineering/tasks/${taskId}/progress`, {
      method: 'POST',
      body: JSON.stringify({ body, progressPercent, ...(blockedReason ? { blockedReason } : {}) }),
    }),
  taskChecklist: (taskId: string) =>
    apiFetch<TaskChecklistItem[]>(`/engineering/tasks/${taskId}/checklist`),
  addTaskChecklistItem: (taskId: string, title: string) =>
    apiFetch<TaskChecklistItem>(`/engineering/tasks/${taskId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  setTaskChecklistItem: (taskId: string, itemId: string, completed: boolean) =>
    apiFetch<TaskChecklistItem>(`/engineering/tasks/${taskId}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),
  taskDependencies: (taskId: string) =>
    apiFetch<TaskDependency[]>(`/engineering/tasks/${taskId}/dependencies`),
  addTaskDependency: (taskId: string, dependsOnId: string) =>
    apiFetch<TaskDependency>(`/engineering/tasks/${taskId}/dependencies`, {
      method: 'POST',
      body: JSON.stringify({ dependsOnId }),
    }),
  taskTransitions: (taskId: string) =>
    apiFetch<TaskTransition[]>(`/engineering/tasks/${taskId}/transitions`),
  verifyTaskQa: (taskId: string) =>
    apiFetch<EngineeringTask>(`/engineering/tasks/${taskId}/verify-qa`, { method: 'POST' }),
  scheduleTask: (
    taskId: string,
    startDate: string | null,
    dueDate: string | null,
    phaseId?: string | null,
  ) =>
    apiFetch<EngineeringTask>(`/engineering/tasks/${taskId}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify({ startDate, dueDate, ...(phaseId !== undefined ? { phaseId } : {}) }),
    }),
  members: (projectId: string) =>
    apiFetch<EngineeringMember[]>(`/engineering/projects/${projectId}/members`),
  projectDependencies: (projectId: string) =>
    apiFetch<Array<{ taskId: string; dependsOnId: string }>>(
      `/engineering/projects/${projectId}/dependencies`,
    ),
  eligibleEngineers: (projectId: string) =>
    apiFetch<EligibleEngineer[]>(`/engineering/projects/${projectId}/eligible-engineers`),
  myInvitations: () => apiFetch<ProjectInvitation[]>('/engineering/invitations/me'),
  respondInvitation: (id: string, decision: 'ACCEPT' | 'DECLINE') =>
    apiFetch<{ id: string; projectId: string; status: string }>(
      `/engineering/invitations/${id}/respond`,
      { method: 'POST', body: JSON.stringify({ decision }) },
    ),
  projectInvitations: (projectId: string) =>
    apiFetch<PendingProjectInvitation[]>(`/engineering/projects/${projectId}/invitations`),
  inviteEngineer: (
    projectId: string,
    input: {
      email: string;
      name?: string;
      role: string;
      description: string;
      responsibilities?: string;
      startDate: string;
      expectedEndDate: string;
      estimatedHours: number;
      priority: string;
      managerNotes?: string;
    },
  ) =>
    apiFetch<{ id: string; status: string }>(`/engineering/projects/${projectId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  cancelInvitation: (projectId: string, invitationId: string) =>
    apiFetch<{ success: boolean }>(
      `/engineering/projects/${projectId}/invitations/${invitationId}`,
      { method: 'DELETE' },
    ),
  addMember: (projectId: string, userId: string, role: string, responsibilities: string) =>
    apiFetch<EngineeringMember>(`/engineering/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role, responsibilities }),
    }),
  removeMember: (projectId: string, userId: string) =>
    apiFetch<{ success: boolean }>(`/engineering/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    }),
  systems: (projectId: string) =>
    apiFetch<ManagedSystem[]>(`/engineering/projects/${projectId}/systems`),
  createSystem: (projectId: string, name: string, productionUrl?: string) =>
    apiFetch<ManagedSystem>(`/engineering/projects/${projectId}/systems`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        technologyStack: [],
        ...(productionUrl ? { productionUrl } : {}),
      }),
    }),
  bugs: (systemId: string) => apiFetch<EngineeringBug[]>(`/engineering/systems/${systemId}/bugs`),
  updates: (systemId: string) =>
    apiFetch<EngineeringUpdate[]>(`/engineering/systems/${systemId}/updates`),
  releases: (systemId: string) =>
    apiFetch<EngineeringRelease[]>(`/engineering/systems/${systemId}/releases`),
  createBug: (systemId: string, title: string, description: string) =>
    apiFetch<EngineeringBug>(`/engineering/systems/${systemId}/bugs`, {
      method: 'POST',
      body: JSON.stringify({ title, description, severity: 'MEDIUM', priority: 'MEDIUM' }),
    }),
  updateBug: (
    bugId: string,
    status: 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED',
    assigneeId?: string,
    rootCause?: string,
  ) =>
    apiFetch<EngineeringBug>(`/engineering/bugs/${bugId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        ...(assigneeId ? { assigneeId } : {}),
        ...(rootCause ? { rootCause } : {}),
      }),
    }),
  createTask: (projectId: string, input: CreateEngineeringTaskInput) =>
    apiFetch<EngineeringTask>(`/engineering/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  submitTask: (taskId: string) =>
    apiFetch<EngineeringTask>(`/engineering/tasks/${taskId}/submit`, { method: 'POST' }),
  reviewTask: (taskId: string, decision: 'APPROVE' | 'REQUEST_CHANGES', note?: string) =>
    apiFetch<EngineeringTask>(`/engineering/tasks/${taskId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    }),
  updateTaskStatus: (taskId: string, status: string) =>
    apiFetch<EngineeringTask>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  documents: (projectId: string) =>
    apiFetch<ProjectDocumentation[]>(`/projects/${projectId}/documentation`),
  createDocument: (projectId: string, title: string, content: string, category: string) =>
    apiFetch<ProjectDocumentation>(`/projects/${projectId}/documentation`, {
      method: 'POST',
      body: JSON.stringify({ title, content, category, format: 'MARKDOWN' }),
    }),
  uploadDocument: (
    projectId: string,
    title: string,
    category: string,
    file: File,
    contentBase64: string,
    onProgress: (percent: number) => void,
  ) =>
    apiUpload<ProjectDocumentation>(
      `/projects/${projectId}/documentation`,
      {
        title,
        category,
        format: 'FILE',
        fileName: file.name,
        mimeType:
          DOCUMENT_MIME_BY_EXTENSION[file.name.toLowerCase().split('.').pop() ?? ''] ?? file.type,
        contentBase64,
      },
      onProgress,
    ),
  taskHours: (taskId: string) => apiFetch<TaskHour[]>(`/engineering/tasks/${taskId}/hours`),
  recordTaskHours: (taskId: string, minutes: number, date: string, note: string) =>
    apiFetch<TaskHour>(`/engineering/tasks/${taskId}/hours`, {
      method: 'POST',
      body: JSON.stringify({ minutes, date, ...(note ? { note } : {}) }),
    }),
  taskAttachments: (taskId: string) =>
    apiFetch<TaskAttachment[]>(`/engineering/tasks/${taskId}/attachments`),
  uploadTaskAttachment: (
    taskId: string,
    fileName: string,
    mimeType: string,
    contentBase64: string,
    onProgress: (percent: number) => void,
  ) =>
    apiUpload<TaskAttachment>(
      `/engineering/tasks/${taskId}/attachments`,
      { fileName, mimeType, contentBase64 },
      onProgress,
    ),
  downloadTaskAttachment: (taskId: string, attachmentId: string, fileName: string) =>
    apiDownload(`/engineering/tasks/${taskId}/attachments/${attachmentId}/file`, fileName),
  updateDocument: (
    projectId: string,
    documentId: string,
    expectedVersion: number,
    content: string,
  ) =>
    apiFetch<ProjectDocumentation>(`/projects/${projectId}/documentation/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ expectedVersion, content }),
    }),
  documentVersions: (projectId: string, documentId: string) =>
    apiFetch<DocumentationVersionRecord[]>(
      `/projects/${projectId}/documentation/${documentId}/versions`,
    ),
  downloadDocument: (projectId: string, documentId: string, fileName: string) =>
    apiDownload(`/projects/${projectId}/documentation/${documentId}/file`, fileName),
  setDocumentStatus: (
    projectId: string,
    documentId: string,
    expectedVersion: number,
    status: 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED',
  ) =>
    apiFetch<ProjectDocumentation>(`/projects/${projectId}/documentation/${documentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ expectedVersion, status }),
    }),
};
