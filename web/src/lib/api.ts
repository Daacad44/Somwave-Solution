// The website's client for the public API (SYSTEM_PROMPT §6). Unwraps the
// standard { data } envelope (§10). Reads run from SSR pages; submitInquiry runs
// in the browser.
import {
  DEFAULT_PAGE_SIZE,
  type CreateInquiryInput,
  type CreateJobApplicationInput,
  type PublicJobOpeningDetail,
  type PublicJobOpeningSummary,
  type PublicPortfolioDetail,
  type PublicPortfolioItem,
  type PublicPostDetail,
  type PublicPostSummary,
  type PublicService,
  type PublicServiceDetail,
  type PublicTestimonial,
  type PublicTeamMember,
  type PublicFaq,
} from '@somwave/shared';

const API_URL = import.meta.env.PUBLIC_API_URL;

interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

async function getEnvelope<T>(path: string): Promise<{ data: T; meta?: PageMeta }> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`Public API request failed: ${res.status}`);
  return (await res.json()) as { data: T; meta?: PageMeta };
}

async function getData<T>(path: string): Promise<T> {
  const body = await getEnvelope<T>(path);
  return body.data;
}

export function fetchServices(): Promise<PublicService[]> {
  return getData<PublicService[]>('/public/services');
}

export async function fetchService(slug: string): Promise<PublicServiceDetail | null> {
  try {
    return await getData<PublicServiceDetail>(`/public/services/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
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

export interface PublicPostPage {
  items: PublicPostSummary[];
  page: number;
  pageSize: number;
  total: number;
}

/** Published posts only, newest first. Drafts are never returned by this route. */
export async function fetchPosts(options?: {
  page?: number;
  pageSize?: number;
}): Promise<PublicPostPage> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const body = await getEnvelope<PublicPostSummary[]>(`/public/posts?${params.toString()}`);
  return {
    items: body.data,
    page: body.meta?.page ?? page,
    pageSize: body.meta?.pageSize ?? pageSize,
    total: body.meta?.total ?? body.data.length,
  };
}

const HOME_POST_LIMIT = 3;

export async function fetchLatestPosts(): Promise<PublicPostSummary[]> {
  const { items } = await fetchPosts({ page: 1, pageSize: HOME_POST_LIMIT });
  return items.slice(0, HOME_POST_LIMIT);
}

export async function fetchPost(slug: string): Promise<PublicPostDetail | null> {
  try {
    return await getData<PublicPostDetail>(`/public/posts/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export function fetchCareers(): Promise<PublicJobOpeningSummary[]> {
  return getData<PublicJobOpeningSummary[]>('/public/careers');
}

export function fetchTestimonials(): Promise<PublicTestimonial[]> {
  return getData<PublicTestimonial[]>('/public/testimonials');
}

export function fetchTeam(): Promise<PublicTeamMember[]> {
  return getData<PublicTeamMember[]>('/public/team');
}

export function fetchFaqs(): Promise<PublicFaq[]> {
  return getData<PublicFaq[]>('/public/faqs');
}

export async function fetchCareer(slug: string): Promise<PublicJobOpeningDetail | null> {
  try {
    return await getData<PublicJobOpeningDetail>(`/public/careers/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function applyToCareer(
  slug: string,
  input: CreateJobApplicationInput,
  idempotencyKey: string,
): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/public/careers/${encodeURIComponent(slug)}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => null)) as {
    data?: { id: string };
    error?: { message?: string };
  } | null;
  if (!res.ok || !body?.data) {
    throw new Error(body?.error?.message ?? 'Codsigaaga lama dirin. Fadlan mar kale isku day.');
  }
  return body.data;
}

export async function subscribe(email: string): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/public/subscribers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = (await res.json().catch(() => null)) as {
    data?: { id: string };
    error?: { message?: string };
  } | null;
  if (!res.ok || !body?.data) {
    throw new Error(body?.error?.message ?? 'Diiwaangelintu ma dhicin. Fadlan mar kale isku day.');
  }
  return body.data;
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
