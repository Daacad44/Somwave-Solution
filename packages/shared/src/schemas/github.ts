import { z } from 'zod';

const githubId = z.string().regex(/^[1-9]\d{0,19}$/, 'Invalid GitHub ID');

export const connectGitHubInstallationSchema = z.object({
  installationId: githubId,
});
export type ConnectGitHubInstallationInput = z.infer<typeof connectGitHubInstallationSchema>;

export const mapGitHubRepositorySchema = z.object({
  projectId: z.string().min(1).nullable(),
});
export type MapGitHubRepositoryInput = z.infer<typeof mapGitHubRepositorySchema>;

export const githubLinkKinds = [
  'ISSUE',
  'BRANCH',
  'COMMIT',
  'PULL_REQUEST',
  'CHECK_RUN',
  'RELEASE',
] as const;
export const githubLinkKindSchema = z.enum(githubLinkKinds);

export const createGitHubTaskLinkSchema = z.object({
  repositoryId: z.string().min(1),
  kind: githubLinkKindSchema,
  externalId: z.string().trim().min(1).max(255),
  url: z.string().url().max(2048),
  title: z.string().trim().max(500).optional(),
  number: z.number().int().positive().optional(),
});
export type CreateGitHubTaskLinkInput = z.infer<typeof createGitHubTaskLinkSchema>;
