import type { SearchHit } from '@somwave/shared';
import { apiFetch } from '../../lib/apiClient';

export function searchRecords(q: string): Promise<SearchHit[]> {
  return apiFetch<SearchHit[]>(`/search?q=${encodeURIComponent(q)}`);
}
