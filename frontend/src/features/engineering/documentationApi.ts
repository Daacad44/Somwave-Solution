import type {
  DocumentationCommentRecord,
  DocumentationLinks,
  DocumentationVersionRecord,
  ProjectDocumentation,
} from '@somwave/shared';
import { apiFetch } from '../../lib/apiClient';

const base = (projectId: string) => `/projects/${projectId}/documentation`;
const doc = (projectId: string, documentId: string) => `${base(projectId)}/${documentId}`;

export const documentationApi = {
  list: (projectId: string, search: string, folder: string) =>
    apiFetch<ProjectDocumentation[]>(
      `${base(projectId)}?${new URLSearchParams({ ...(search ? { search } : {}), ...(folder ? { folder } : {}) })}`,
    ),
  folders: (projectId: string) => apiFetch<string[]>(`${base(projectId)}/folders`),
  renameFolder: (projectId: string, from: string, to: string) =>
    apiFetch<{ updated: number }>(`${base(projectId)}/folders/rename`, {
      method: 'PATCH',
      body: JSON.stringify({ from, to }),
    }),
  proposeTasks: (projectId: string, documentId: string) =>
    apiFetch<{ id: string; title: string; approvalStatus: string }[]>(
      `${doc(projectId, documentId)}/propose-tasks`,
      { method: 'POST' },
    ),
  create: (
    projectId: string,
    input: {
      title: string;
      folder?: string;
      format: 'MARKDOWN' | 'RICH_TEXT';
      content: string;
      ownerId?: string;
    },
  ) =>
    apiFetch<ProjectDocumentation>(base(projectId), {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (
    projectId: string,
    documentId: string,
    input: {
      expectedVersion: number;
      title?: string;
      folder?: string | null;
      content?: string;
      ownerId?: string | null;
    },
  ) =>
    apiFetch<ProjectDocumentation>(doc(projectId, documentId), {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  status: (
    projectId: string,
    documentId: string,
    expectedVersion: number,
    status: ProjectDocumentation['status'],
  ) =>
    apiFetch<ProjectDocumentation>(`${doc(projectId, documentId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ expectedVersion, status }),
    }),
  versions: (projectId: string, documentId: string) =>
    apiFetch<DocumentationVersionRecord[]>(`${doc(projectId, documentId)}/versions`),
  comments: (projectId: string, documentId: string) =>
    apiFetch<DocumentationCommentRecord[]>(`${doc(projectId, documentId)}/comments`),
  addComment: (projectId: string, documentId: string, body: string) =>
    apiFetch<DocumentationCommentRecord>(`${doc(projectId, documentId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  removeComment: (projectId: string, documentId: string, commentId: string) =>
    apiFetch(`${doc(projectId, documentId)}/comments/${commentId}`, { method: 'DELETE' }),
  links: (projectId: string, documentId: string) =>
    apiFetch<DocumentationLinks>(`${doc(projectId, documentId)}/links`),
  link: (projectId: string, documentId: string, target: 'task' | 'milestone', targetId: string) =>
    apiFetch<DocumentationLinks>(`${doc(projectId, documentId)}/links/${target}`, {
      method: 'POST',
      body: JSON.stringify({ targetId }),
    }),
  unlink: (projectId: string, documentId: string, target: 'task' | 'milestone', targetId: string) =>
    apiFetch<DocumentationLinks>(`${doc(projectId, documentId)}/links/${target}/${targetId}`, {
      method: 'DELETE',
    }),
};
