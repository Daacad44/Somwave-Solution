// The website's read client for the public API (SYSTEM_PROMPT §6). Unwraps the
// standard { data } envelope (§10). Used from SSR pages at request time.
import type { PublicService } from '@somwave/shared';

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
