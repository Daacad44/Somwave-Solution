// CMS feature API (W4, §6: features/<feature>/api.ts → apiClient).
import type {
  AdminService,
  CreateServiceInput,
  UpdateServiceInput,
  AdminPost,
  AdminCategory,
  CreatePostInput,
  UpdatePostInput,
  AdminPortfolioItem,
  CreatePortfolioItemInput,
  UpdatePortfolioItemInput,
  AdminJobOpening,
  CreateJobOpeningInput,
  UpdateJobOpeningInput,
} from '@somwave/shared';
import { apiFetch } from '../../lib/apiClient';

export function listServices(): Promise<AdminService[]> {
  return apiFetch<AdminService[]>('/cms/services');
}

export function createService(input: CreateServiceInput): Promise<AdminService> {
  return apiFetch<AdminService>('/cms/services', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateService(id: string, input: UpdateServiceInput): Promise<AdminService> {
  return apiFetch<AdminService>(`/cms/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteService(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/cms/services/${id}`, { method: 'DELETE' });
}

// ── Blog posts (W4.2) ─────────────────────────────────────────────────────────

export function listPosts(): Promise<AdminPost[]> {
  return apiFetch<AdminPost[]>('/cms/posts');
}

export function listCategories(): Promise<AdminCategory[]> {
  return apiFetch<AdminCategory[]>('/cms/categories');
}

export function createPost(input: CreatePostInput): Promise<AdminPost> {
  return apiFetch<AdminPost>('/cms/posts', { method: 'POST', body: JSON.stringify(input) });
}

export function updatePost(id: string, input: UpdatePostInput): Promise<AdminPost> {
  return apiFetch<AdminPost>(`/cms/posts/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deletePost(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/cms/posts/${id}`, { method: 'DELETE' });
}

// ── Portfolio (W4.3) ──────────────────────────────────────────────────────────

export function listPortfolio(): Promise<AdminPortfolioItem[]> {
  return apiFetch<AdminPortfolioItem[]>('/cms/portfolio');
}

export function createPortfolio(input: CreatePortfolioItemInput): Promise<AdminPortfolioItem> {
  return apiFetch<AdminPortfolioItem>('/cms/portfolio', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePortfolio(
  id: string,
  input: UpdatePortfolioItemInput,
): Promise<AdminPortfolioItem> {
  return apiFetch<AdminPortfolioItem>(`/cms/portfolio/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deletePortfolio(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/cms/portfolio/${id}`, { method: 'DELETE' });
}

// ── Careers / job openings (W4.4) ─────────────────────────────────────────────

export function listOpenings(): Promise<AdminJobOpening[]> {
  return apiFetch<AdminJobOpening[]>('/cms/careers');
}

export function createOpening(input: CreateJobOpeningInput): Promise<AdminJobOpening> {
  return apiFetch<AdminJobOpening>('/cms/careers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOpening(id: string, input: UpdateJobOpeningInput): Promise<AdminJobOpening> {
  return apiFetch<AdminJobOpening>(`/cms/careers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteOpening(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/cms/careers/${id}`, { method: 'DELETE' });
}
