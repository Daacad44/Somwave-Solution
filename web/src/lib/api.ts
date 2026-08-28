// The website's client for the public API (SYSTEM_PROMPT §6). Unwraps the
// standard { data } envelope (§10). Reads run from SSR pages; submitInquiry runs
// in the browser.
import type {
  CreateInquiryInput,
  PublicPortfolioDetail,
  PublicPortfolioItem,
  PublicPostDetail,
  PublicPostSummary,
  PublicService,
} from '@somwave/shared';

const API_URL = import.meta.env.PUBLIC_API_URL;

async function getData<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`Public API request failed: ${res.status}`);
  const body = (await res.json()) as { data: T };
  return body.data;
}

export function fetchServices(): Promise<PublicService[]> {
  return getData<PublicService[]>('/public/services');
}

export function fetchPortfolio(): Promise<PublicPortfolioItem[]> {
  return getData<PublicPortfolioItem[]>('/public/portfolio');
}

export async function fetchPortfolioItem(slug: string): Promise<PublicPortfolioDetail | null> {
  try {
    return await getData<PublicPortfolioDetail>(`/public/portfolio/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export function fetchPosts(): Promise<PublicPostSummary[]> {
  return getData<PublicPostSummary[]>('/public/posts');
}

export async function fetchPost(slug: string): Promise<PublicPostDetail | null> {
  try {
    return await getData<PublicPostDetail>(`/public/posts/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function submitInquiry(
  input: CreateInquiryInput,
  idempotencyKey: string,
): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/public/inquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => null)) as {
    data?: { id: string };
    error?: { message?: string };
  } | null;
  if (!res.ok || !body?.data) {
    throw new Error(body?.error?.message ?? 'Fariinta lama dirin. Fadlan mar kale isku day.');
  }
  return body.data;
}
