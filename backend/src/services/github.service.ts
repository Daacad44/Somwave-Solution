import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { CreateGitHubTaskLinkInput } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { writeAudit } from '../lib/audit';
import {
  getInstallation,
  getRepositoryActivity,
  listInstallationRepositories,
  type GitHubActivityKind,
  type GitHubRepositoryInfo,
} from './github.client';
import { projectScope } from './project.service';
import { emitNotification } from './notification-delivery.service';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function id(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)) return value;
  return null;
}

export function verifyGitHubWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const received = Buffer.from(signature.slice(7), 'hex');
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function assertGitHubUrl(
  url: string,
  fullName: string,
  kind: CreateGitHubTaskLinkInput['kind'],
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid GitHub URL');
  }
  const base = `/${fullName}/`;
  const prefixes: Record<CreateGitHubTaskLinkInput['kind'], string[]> = {
    ISSUE: ['issues/'],
    BRANCH: ['tree/'],
    COMMIT: ['commit/'],
    PULL_REQUEST: ['pull/'],
    CHECK_RUN: ['runs/', 'actions/runs/'],
    RELEASE: ['releases/tag/', 'releases/'],
  };
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'github.com' ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    !prefixes[kind].some((prefix) => parsed.pathname.startsWith(base + prefix))
  ) {
    throw new AppError('VALIDATION_ERROR', 400, 'URL must point to this GitHub repository');
  }
}

async function upsertRepository(
  installationDbId: string,
  repository: GitHubRepositoryInfo,
): Promise<void> {
  if (!id(repository.id) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.full_name))
    return;
  await prisma.gitHubRepository.upsert({
    where: { githubId: String(repository.id) },
    create: {
      installationId: installationDbId,
      githubId: String(repository.id),
      fullName: repository.full_name,
      defaultBranch: repository.default_branch ?? null,
      isPrivate: repository.private,
      isActive: true,
    },
    update: {
      installationId: installationDbId,
      fullName: repository.full_name,
      defaultBranch: repository.default_branch ?? null,
      isPrivate: repository.private,
      isActive: true,
    },
  });
}

export async function connectInstallation(
  installationId: string,
  actorId: string,
): Promise<unknown> {
  const installation = await getInstallation(installationId);
  if (String(installation.id) !== installationId || !installation.account?.login) {
    throw new AppError('VALIDATION_ERROR', 400, 'GitHub installation did not match');
  }
  const repositories = await listInstallationRepositories(installationId);
  const row = await prisma.gitHubInstallation.upsert({
    where: { installationId },
    create: {
      installationId,
      accountLogin: installation.account.login,
      accountType: installation.account.type,
      status: installation.suspended_at ? 'SUSPENDED' : 'ACTIVE',
      connectedById: actorId,
    },
    update: {
      accountLogin: installation.account.login,
      accountType: installation.account.type,
      status: installation.suspended_at ? 'SUSPENDED' : 'ACTIVE',
      connectedById: actorId,
    },
  });
  const visibleIds = new Set(repositories.map((repository) => String(repository.id)));
  for (const repository of repositories) await upsertRepository(row.id, repository);
  await prisma.gitHubRepository.updateMany({
    where: { installationId: row.id, githubId: { notIn: [...visibleIds] } },
    data: { isActive: false },
  });
  await writeAudit({
    actorId,
    action: 'github.installation.connected',
    subjectType: 'GitHubInstallation',
    subjectId: row.id,
  });
  return {
    id: row.id,
    installationId,
    accountLogin: row.accountLogin,
    status: row.status,
    repositoryCount: repositories.length,
  };
}

export async function listInstallations() {
  return prisma.gitHubInstallation.findMany({
    select: {
      id: true,
      installationId: true,
      accountLogin: true,
      accountType: true,
      status: true,
      updatedAt: true,
      _count: { select: { repositories: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/** Disconnect locally. A subsequent verified webhook must not reactivate it. */
export async function disconnectInstallation(installationDbId: string, actorId: string) {
  const row = await prisma.gitHubInstallation.findUnique({
    where: { id: installationDbId },
    select: { id: true },
  });
  if (!row) throw new AppError('NOT_FOUND', 404, 'GitHub installation not found');
  await prisma.$transaction([
    prisma.gitHubInstallation.update({
      where: { id: installationDbId },
      data: { status: 'DISCONNECTED' },
    }),
    prisma.gitHubRepository.updateMany({
      where: { installationId: installationDbId },
      data: { isActive: false },
    }),
  ]);
  await writeAudit({
    actorId,
    action: 'github.installation.disconnected',
    subjectType: 'GitHubInstallation',
    subjectId: installationDbId,
  });
  return { success: true };
}

export async function listRepositories(actor: Express.AuthUserContext) {
  const privileged = actor.roles.some((role) => role === 'SUPER_ADMIN' || role === 'ADMIN');
  return prisma.gitHubRepository.findMany({
    where: {
      isActive: true,
      installation: { status: 'ACTIVE' },
      ...(privileged ? {} : { project: projectScope(actor) }),
    },
    select: {
      id: true,
      githubId: true,
      fullName: true,
      defaultBranch: true,
      isPrivate: true,
      projectId: true,
      installationId: true,
    },
    orderBy: { fullName: 'asc' },
  });
}

function activityItem(kind: GitHubActivityKind, value: unknown) {
  const item = record(value);
  if (!item) return null;
  const nestedCommit = record(item.commit);
  const nestedAuthor = record(nestedCommit?.author);
  const author = record(item.author) ?? record(item.user) ?? record(item.actor);
  const url =
    typeof item.html_url === 'string' && item.html_url.startsWith('https://github.com/')
      ? item.html_url
      : null;
  const number = id(item.number);
  const sha = typeof item.sha === 'string' && /^[a-f0-9]{40}$/i.test(item.sha) ? item.sha : null;
  const identifier = id(item.id) ?? sha ?? (typeof item.name === 'string' ? item.name : null);
  if (!identifier) return null;
  const title =
    kind === 'commits'
      ? typeof nestedCommit?.message === 'string'
        ? nestedCommit.message.split('\n')[0]
        : sha
      : kind === 'branches'
        ? item.name
        : kind === 'contributors'
          ? item.login
          : kind === 'releases'
            ? item.name || item.tag_name
            : item.title || item.name;
  return {
    id: identifier,
    number,
    title: typeof title === 'string' ? title.slice(0, 500) : 'Untitled',
    url,
    state:
      typeof item.conclusion === 'string'
        ? item.conclusion
        : typeof item.status === 'string'
          ? item.status
          : typeof item.state === 'string'
            ? item.state
            : null,
    actor:
      typeof author?.login === 'string'
        ? author.login
        : typeof nestedAuthor?.name === 'string'
          ? nestedAuthor.name
          : null,
    createdAt:
      typeof item.created_at === 'string'
        ? item.created_at
        : typeof item.published_at === 'string'
          ? item.published_at
          : null,
    additions:
      kind === 'contributors' && typeof item.contributions === 'number' ? item.contributions : null,
    isPullRequest: kind === 'issues' && Boolean(item.pull_request),
  };
}

export async function listRepositoryActivity(
  repositoryId: string,
  kind: GitHubActivityKind,
  actor: Express.AuthUserContext,
) {
  const repository = await prisma.gitHubRepository.findFirst({
    where: {
      id: repositoryId,
      isActive: true,
      installation: { status: 'ACTIVE' },
      project: { deletedAt: null, ...projectScope(actor) },
    },
    select: { fullName: true, installation: { select: { installationId: true } } },
  });
  if (!repository) throw new AppError('NOT_FOUND', 404, 'GitHub repository not found');
  const rows = await getRepositoryActivity(
    repository.installation.installationId,
    repository.fullName,
    kind,
  );
  return rows
    .map((row) => activityItem(kind, row))
    .filter((row) => row && !(kind === 'issues' && row.isPullRequest));
}

export async function mapRepository(
  repositoryId: string,
  projectId: string | null,
  actorId: string,
) {
  const repository = await prisma.gitHubRepository.findFirst({
    where: { id: repositoryId, isActive: true, installation: { status: 'ACTIVE' } },
  });
  if (!repository) throw new AppError('NOT_FOUND', 404, 'GitHub repository not found');
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  }
  const updated = await prisma.gitHubRepository.update({
    where: { id: repositoryId },
    data: { projectId },
    select: { id: true, fullName: true, projectId: true },
  });
  await writeAudit({
    actorId,
    action: 'github.repository.mapped',
    subjectType: 'GitHubRepository',
    subjectId: repositoryId,
  });
  return updated;
}

export async function listTaskLinks(taskId: string, actor: Express.AuthUserContext) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, project: projectScope(actor) },
    select: { id: true },
  });
  if (!task) throw new AppError('NOT_FOUND', 404, 'Task not found');
  return prisma.gitHubTaskLink.findMany({
    where: { taskId },
    select: {
      id: true,
      repositoryId: true,
      kind: true,
      externalId: true,
      url: true,
      title: true,
      number: true,
      state: true,
      lastSyncedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createTaskLink(
  taskId: string,
  input: CreateGitHubTaskLinkInput,
  actor: Express.AuthUserContext,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, project: { deletedAt: null, ...projectScope(actor) } },
    select: { id: true, projectId: true },
  });
  if (!task) throw new AppError('NOT_FOUND', 404, 'Task not found');
  const repository = await prisma.gitHubRepository.findFirst({
    where: { id: input.repositoryId, isActive: true, installation: { status: 'ACTIVE' } },
    select: { id: true, fullName: true, projectId: true },
  });
  if (!repository || repository.projectId !== task.projectId) {
    throw new AppError('VALIDATION_ERROR', 400, 'Repository is not mapped to the task project');
  }
  assertGitHubUrl(input.url, repository.fullName, input.kind);
  if (
    (input.kind === 'ISSUE' || input.kind === 'PULL_REQUEST') &&
    (!/^[1-9]\d*$/.test(input.externalId) || Number(input.externalId) !== input.number)
  ) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Issue and pull request number must match the external ID',
    );
  }
  try {
    const link = await prisma.gitHubTaskLink.create({
      data: {
        taskId,
        repositoryId: repository.id,
        kind: input.kind,
        externalId: input.externalId,
        url: input.url,
        title: input.title ?? null,
        number: input.number ?? null,
      },
      select: {
        id: true,
        repositoryId: true,
        kind: true,
        externalId: true,
        url: true,
        title: true,
        number: true,
        state: true,
      },
    });
    await writeAudit({
      actorId: actor.id,
      action: 'github.task_link.created',
      subjectType: 'GitHubTaskLink',
      subjectId: link.id,
    });
    return link;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('CONFLICT', 409, 'GitHub item is already linked');
    }
    throw error;
  }
}

export async function removeTaskLink(
  taskId: string,
  linkId: string,
  actor: Express.AuthUserContext,
): Promise<void> {
  const link = await prisma.gitHubTaskLink.findFirst({
    where: {
      id: linkId,
      taskId,
      task: { deletedAt: null, project: { deletedAt: null, ...projectScope(actor) } },
    },
    select: { id: true },
  });
  if (!link) throw new AppError('NOT_FOUND', 404, 'GitHub link not found');
  await prisma.gitHubTaskLink.delete({ where: { id: linkId } });
  await writeAudit({
    actorId: actor.id,
    action: 'github.task_link.deleted',
    subjectType: 'GitHubTaskLink',
    subjectId: linkId,
  });
}

function repositoryFromWebhook(value: unknown): GitHubRepositoryInfo | null {
  const object = record(value);
  if (
    !object ||
    !id(object.id) ||
    typeof object.full_name !== 'string' ||
    typeof object.private !== 'boolean'
  )
    return null;
  return {
    id: Number(object.id),
    full_name: object.full_name,
    private: object.private,
    default_branch: typeof object.default_branch === 'string' ? object.default_branch : '',
  };
}

async function updateLinkedItem(
  repository: { id: string; projectId: string | null },
  kind: CreateGitHubTaskLinkInput['kind'],
  externalId: string | null,
  state: string,
  item: JsonRecord | null,
): Promise<void> {
  if (!externalId || !repository.projectId) return;
  await prisma.gitHubTaskLink.updateMany({
    where: {
      repositoryId: repository.id,
      kind,
      externalId,
      task: { projectId: repository.projectId },
    },
    data: {
      state: state.slice(0, 100),
      ...(typeof item?.title === 'string' ? { title: item.title.slice(0, 500) } : {}),
      ...(typeof item?.html_url === 'string' && item.html_url.startsWith('https://github.com/')
        ? { url: item.html_url.slice(0, 2048) }
        : {}),
      lastSyncedAt: new Date(),
    },
  });
}

async function applyWebhookEvent(eventType: string, payload: JsonRecord): Promise<void> {
  const installation = record(payload.installation);
  const installationId = id(installation?.id);
  const action = typeof payload.action === 'string' ? payload.action : '';

  if (eventType === 'installation' && installationId && installation) {
    const account = record(installation.account);
    const accountLogin = typeof account?.login === 'string' ? account.login : null;
    if (!accountLogin) return;
    const status =
      action === 'deleted' ? 'DISCONNECTED' : action === 'suspend' ? 'SUSPENDED' : 'ACTIVE';
    const row = await prisma.gitHubInstallation.findUnique({ where: { installationId } });
    if (!row) return; // Explicit admin connection is required before accepting repository data.
    if (row.status === 'DISCONNECTED') return;
    await prisma.gitHubInstallation.update({
      where: { id: row.id },
      data: {
        accountLogin,
        accountType: typeof account?.type === 'string' ? account.type : null,
        status,
      },
    });
    if (status !== 'ACTIVE') {
      await prisma.gitHubRepository.updateMany({
        where: { installationId: row.id },
        data: { isActive: false },
      });
    } else if (Array.isArray(payload.repositories)) {
      for (const candidate of payload.repositories) {
        const repository = repositoryFromWebhook(candidate);
        if (repository) await upsertRepository(row.id, repository);
      }
    }
    return;
  }

  if (!installationId) return;
  const connected = await prisma.gitHubInstallation.findUnique({
    where: { installationId },
    select: { id: true, status: true },
  });
  if (!connected || connected.status !== 'ACTIVE') return;

  if (eventType === 'installation_repositories') {
    if (Array.isArray(payload.repositories_removed)) {
      const removedIds = payload.repositories_removed
        .map((candidate) => id(record(candidate)?.id))
        .filter((value): value is string => !!value);
      if (removedIds.length)
        await prisma.gitHubRepository.updateMany({
          where: { installationId: connected.id, githubId: { in: removedIds } },
          data: { isActive: false },
        });
    }
    if (Array.isArray(payload.repositories_added)) {
      for (const candidate of payload.repositories_added) {
        const repository = repositoryFromWebhook(candidate);
        if (repository) await upsertRepository(connected.id, repository);
      }
    }
    return;
  }

  const repository = repositoryFromWebhook(payload.repository);
  if (!repository) return;
  if (eventType === 'repository') {
    if (action === 'deleted' || action === 'archived') {
      await prisma.gitHubRepository.updateMany({
        where: { installationId: connected.id, githubId: String(repository.id) },
        data: { isActive: false },
      });
    } else {
      await upsertRepository(connected.id, repository);
    }
    return;
  }
  const mapped = await prisma.gitHubRepository.findFirst({
    where: { installationId: connected.id, githubId: String(repository.id), isActive: true },
    select: { id: true, projectId: true, fullName: true },
  });
  if (!mapped) return;

  if (eventType === 'pull_request') {
    const pull = record(payload.pull_request);
    const number = id(payload.number);
    const state =
      pull?.merged === true
        ? 'MERGED'
        : typeof pull?.state === 'string'
          ? pull.state.toUpperCase()
          : action.toUpperCase();
    await updateLinkedItem(mapped, 'PULL_REQUEST', number, state, pull);
    if (action === 'closed' && pull?.merged === true && mapped.projectId && number) {
      const project = await prisma.project.findUnique({
        where: { id: mapped.projectId },
        select: { managerId: true },
      });
      if (project?.managerId)
        await emitNotification({
          userId: project.managerId,
          eventKey: 'github.pr',
          dedupeKey: `github-pr-merged:${mapped.id}:${number}:${project.managerId}`,
          title: 'Pull request merged',
          body: `Pull request #${number} was merged in ${mapped.fullName}.`,
        });
    }
    // A verified PR may declare its task using `Somwave-Task: <task id>`.
    // Check the mapped project before linking; merges never complete tasks.
    const body = typeof pull?.body === 'string' ? pull.body : '';
    const declaredTaskId = /^Somwave-Task:\s*([A-Za-z0-9_-]{10,40})\s*$/im.exec(body)?.[1];
    if (action === 'opened' && mapped.projectId && number && declaredTaskId) {
      const task = await prisma.task.findFirst({
        where: { id: declaredTaskId, projectId: mapped.projectId, deletedAt: null },
        select: { id: true, project: { select: { managerId: true } } },
      });
      const htmlUrl = typeof pull?.html_url === 'string' ? pull.html_url : '';
      if (task && htmlUrl) {
        assertGitHubUrl(htmlUrl, mapped.fullName, 'PULL_REQUEST');
        try {
          await prisma.gitHubTaskLink.create({
            data: {
              taskId: task.id,
              repositoryId: mapped.id,
              kind: 'PULL_REQUEST',
              externalId: number,
              number: Number(number),
              url: htmlUrl,
              title: typeof pull?.title === 'string' ? pull.title.slice(0, 500) : null,
              state,
            },
          });
          if (task.project.managerId) {
            await emitNotification({
              userId: task.project.managerId,
              eventKey: 'github.pr',
              dedupeKey: `github-pr:${mapped.id}:${number}:${task.project.managerId}`,
              title: 'Pull request opened',
              body: `A pull request was linked to a task in ${mapped.fullName}.`,
            });
          }
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'))
            throw error;
        }
      }
    }
  } else if (eventType === 'issues') {
    const issue = record(payload.issue);
    await updateLinkedItem(
      mapped,
      'ISSUE',
      id(issue?.number),
      typeof issue?.state === 'string' ? issue.state.toUpperCase() : action.toUpperCase(),
      issue,
    );
  } else if (eventType === 'check_run') {
    const check = record(payload.check_run);
    const state =
      typeof check?.conclusion === 'string'
        ? check.conclusion.toUpperCase()
        : typeof check?.status === 'string'
          ? check.status.toUpperCase()
          : action.toUpperCase();
    await updateLinkedItem(mapped, 'CHECK_RUN', id(check?.id), state, check);
    if (mapped.projectId && action === 'completed' && state !== 'SUCCESS' && id(check?.id)) {
      const affected = await prisma.gitHubTaskLink.findMany({
        where: {
          repositoryId: mapped.id,
          kind: 'CHECK_RUN',
          externalId: id(check?.id)!,
          task: { projectId: mapped.projectId },
        },
        select: { taskId: true, task: { select: { project: { select: { managerId: true } } } } },
      });
      for (const link of affected) {
        const revoked = await prisma.task.updateMany({
          where: { id: link.taskId, status: 'TESTING', qaVerifiedAt: { not: null } },
          data: { qaVerifiedAt: null, qaVerifiedById: null },
        });
        if (!revoked.count) continue;
        await prisma.auditLog.create({
          data: {
            action: 'task.qa.revoked_by_ci',
            subjectType: 'Task',
            subjectId: link.taskId,
          },
        });
        if (link.task.project.managerId)
          await emitNotification({
            userId: link.task.project.managerId,
            eventKey: 'github.ci',
            dedupeKey: `qa-revoked:${link.taskId}:${id(check?.id)}:${state}`,
            title: 'QA verification needs review',
            body: `A linked CI check changed to ${state.toLowerCase()}; QA verification was cleared.`,
          });
      }
    }
    if (action === 'completed' && (state === 'FAILURE' || state === 'SUCCESS')) {
      const project = mapped.projectId
        ? await prisma.project.findUnique({
            where: { id: mapped.projectId },
            select: { managerId: true },
          })
        : null;
      if (project?.managerId)
        await emitNotification({
          userId: project.managerId,
          eventKey: 'github.ci',
          dedupeKey: `github-ci:${mapped.id}:${id(check?.id)}:${state}:${project.managerId}`,
          title: state === 'FAILURE' ? 'CI check failed' : 'CI check succeeded',
          body: `${mapped.fullName}: ${typeof check?.name === 'string' ? check.name.slice(0, 200) : 'Check run'} ${state.toLowerCase()}.`,
        });
    }
  } else if (eventType === 'release') {
    const release = record(payload.release);
    await updateLinkedItem(mapped, 'RELEASE', id(release?.id), action.toUpperCase(), release);
  } else if (eventType === 'create' || eventType === 'delete') {
    if (payload.ref_type === 'branch' && typeof payload.ref === 'string') {
      await updateLinkedItem(
        mapped,
        'BRANCH',
        payload.ref,
        eventType === 'delete' ? 'DELETED' : 'CREATED',
        null,
      );
    }
  } else if (eventType === 'push') {
    if (typeof payload.ref === 'string' && payload.ref.startsWith('refs/heads/')) {
      await updateLinkedItem(
        mapped,
        'BRANCH',
        payload.ref.slice('refs/heads/'.length),
        'PUSHED',
        null,
      );
    }
    if (typeof payload.after === 'string' && /^[a-f0-9]{40}$/i.test(payload.after)) {
      await updateLinkedItem(mapped, 'COMMIT', payload.after, 'PUSHED', null);
    }
  }
  // A merged pull request only updates its link. Task completion stays a user action.
}

export async function receiveWebhook(
  deliveryId: string,
  eventType: string,
  payload: unknown,
): Promise<'processed' | 'duplicate'> {
  const object = record(payload);
  if (!object || !/^[a-z0-9-]{16,100}$/i.test(deliveryId) || !/^[a-z_]{1,50}$/.test(eventType)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid GitHub webhook');
  }
  const repositoryId = id(record(object.repository)?.id);
  const action = typeof object.action === 'string' ? object.action.slice(0, 100) : null;
  let eventId: string;
  try {
    const event = await prisma.gitHubWebhookEvent.create({
      data: { deliveryId, eventType, action, status: 'RECEIVED' },
      select: { id: true },
    });
    eventId = event.id;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'))
      throw error;
    const claimed = await prisma.gitHubWebhookEvent.updateMany({
      where: { deliveryId, status: 'FAILED' },
      data: { status: 'RECEIVED', error: null, receivedAt: new Date() },
    });
    if (!claimed.count) return 'duplicate';
    const event = await prisma.gitHubWebhookEvent.findUnique({
      where: { deliveryId },
      select: { id: true },
    });
    if (!event) throw new Error('Claimed webhook delivery disappeared');
    eventId = event.id;
  }
  try {
    await applyWebhookEvent(eventType, object);
    const repository = repositoryId
      ? await prisma.gitHubRepository.findUnique({
          where: { githubId: repositoryId },
          select: { id: true },
        })
      : null;
    await prisma.gitHubWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'PROCESSED', processedAt: new Date(), repositoryId: repository?.id ?? null },
    });
    return 'processed';
  } catch (error) {
    await prisma.gitHubWebhookEvent.update({
      where: { id: eventId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error',
      },
    });
    throw error;
  }
}
