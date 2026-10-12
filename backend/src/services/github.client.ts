import { createSign } from 'node:crypto';

const API_ROOT = 'https://api.github.com';
const API_VERSION = '2022-11-28';

export class GitHubApiError extends Error {
  constructor(
    readonly status: number,
    readonly retryable: boolean,
    message = 'GitHub API request failed',
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export function createAppJwt(appId: string, privateKey: string, now = Date.now()): string {
  if (!/^[1-9]\d*$/.test(appId) || !privateKey.includes('PRIVATE KEY')) {
    throw new Error('GitHub App credentials are invalid');
  }
  const issuedAt = Math.floor(now / 1000) - 60;
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iat: issuedAt, exp: issuedAt + 9 * 60, iss: appId }),
  ).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(privateKey, 'base64url');
  return `${signingInput}.${signature}`;
}

function credentials(): { appId: string; privateKey: string } {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!appId || !privateKey) throw new Error('GitHub App credentials are not configured');
  return { appId, privateKey };
}

function retryDelay(response: Response, attempt: number): number | null {
  const remaining = response.headers.get('x-ratelimit-remaining');
  if (
    response.status !== 429 &&
    response.status < 500 &&
    !(response.status === 403 && remaining === '0')
  )
    return null;
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 30_000);
  }
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  if (remaining === '0' && Number.isFinite(reset) && reset > 0) {
    return Math.min(Math.max(reset * 1000 - Date.now(), 0), 30_000);
  }
  return Math.min(500 * 2 ** attempt, 4000);
}

async function apiRequest<T>(
  path: string,
  token: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid GitHub API path');
  // All paths are constructed by this module. Reject absolute URLs and fragments.
  if (path.includes('#')) throw new Error('Invalid GitHub API path');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${API_ROOT}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': API_VERSION,
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    if (response.ok) return (await response.json()) as T;
    const delay = retryDelay(response, attempt);
    if (delay !== null && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    throw new GitHubApiError(response.status, delay !== null);
  }
  throw new GitHubApiError(503, true);
}

export interface GitHubInstallationInfo {
  id: number;
  account: { login: string; type: string };
  suspended_at: string | null;
}

export interface GitHubRepositoryInfo {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
}

export async function getInstallation(installationId: string): Promise<GitHubInstallationInfo> {
  const { appId, privateKey } = credentials();
  return apiRequest<GitHubInstallationInfo>(
    `/app/installations/${encodeURIComponent(installationId)}`,
    createAppJwt(appId, privateKey),
  );
}

export async function getInstallationToken(installationId: string): Promise<string> {
  const { appId, privateKey } = credentials();
  const result = await apiRequest<{ token: string }>(
    `/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    createAppJwt(appId, privateKey),
    { method: 'POST', body: {} },
  );
  return result.token;
}

export async function listInstallationRepositories(
  installationId: string,
): Promise<GitHubRepositoryInfo[]> {
  const token = await getInstallationToken(installationId);
  const repositories: GitHubRepositoryInfo[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await apiRequest<{ repositories: GitHubRepositoryInfo[] }>(
      `/installation/repositories?per_page=100&page=${page}`,
      token,
    );
    repositories.push(...result.repositories);
    if (result.repositories.length < 100) return repositories;
  }
  throw new Error('GitHub installation repository list exceeded 10,000 entries');
}

export const githubActivityKinds = [
  'commits',
  'branches',
  'issues',
  'pulls',
  'runs',
  'contributors',
  'releases',
] as const;
export type GitHubActivityKind = (typeof githubActivityKinds)[number];

/** Fetch a single bounded page. The caller resolves repository ownership first. */
export async function getRepositoryActivity(
  installationId: string,
  fullName: string,
  kind: GitHubActivityKind,
): Promise<unknown[]> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) {
    throw new Error('Invalid GitHub repository name');
  }
  const token = await getInstallationToken(installationId);
  const base = `/repos/${fullName}`;
  const paths: Record<GitHubActivityKind, string> = {
    commits: `${base}/commits?per_page=30`,
    branches: `${base}/branches?per_page=30`,
    issues: `${base}/issues?state=all&per_page=30`,
    pulls: `${base}/pulls?state=all&per_page=30`,
    runs: `${base}/actions/runs?per_page=30`,
    contributors: `${base}/contributors?per_page=30`,
    releases: `${base}/releases?per_page=30`,
  };
  const result = await apiRequest<unknown>(paths[kind], token);
  if (kind === 'runs') {
    const runs =
      result && typeof result === 'object' && 'workflow_runs' in result
        ? result.workflow_runs
        : null;
    return Array.isArray(runs) ? runs : [];
  }
  return Array.isArray(result) ? result : [];
}
