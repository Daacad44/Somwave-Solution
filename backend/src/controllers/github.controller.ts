import type { NextFunction, Request, Response } from 'express';
import type {
  ConnectGitHubInstallationInput,
  CreateGitHubTaskLinkInput,
  MapGitHubRepositoryInput,
} from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as githubService from '../services/github.service';
import { githubActivityKinds, type GitHubActivityKind } from '../services/github.client';

export async function connectInstallation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await githubService.connectInstallation(
      (req.body as ConnectGitHubInstallationInput).installationId,
      req.authUser!.id,
    );
    sendData(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function listInstallations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await githubService.listInstallations());
  } catch (error) {
    next(error);
  }
}

export async function disconnectInstallation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(
      res,
      await githubService.disconnectInstallation(req.params.installationId!, req.authUser!.id),
    );
  } catch (error) {
    next(error);
  }
}

export async function listRepositoryActivity(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const kind = req.params.kind;
    if (!githubActivityKinds.includes(kind as GitHubActivityKind)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Unsupported GitHub activity type');
    }
    sendData(
      res,
      await githubService.listRepositoryActivity(
        req.params.repositoryId!,
        kind as GitHubActivityKind,
        req.authUser!,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function listRepositories(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await githubService.listRepositories(req.authUser!));
  } catch (error) {
    next(error);
  }
}

export async function mapRepository(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(
      res,
      await githubService.mapRepository(
        req.params.repositoryId!,
        (req.body as MapGitHubRepositoryInput).projectId,
        req.authUser!.id,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function listTaskLinks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await githubService.listTaskLinks(req.params.taskId!, req.authUser!));
  } catch (error) {
    next(error);
  }
}

export async function createTaskLink(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(
      res,
      await githubService.createTaskLink(
        req.params.taskId!,
        req.body as CreateGitHubTaskLinkInput,
        req.authUser!,
      ),
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function removeTaskLink(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await githubService.removeTaskLink(req.params.taskId!, req.params.linkId!, req.authUser!);
    sendData(res, { success: true });
  } catch (error) {
    next(error);
  }
}

export async function receiveWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!Buffer.isBuffer(req.body))
      throw new AppError('VALIDATION_ERROR', 400, 'Raw webhook body required');
    if (
      !githubService.verifyGitHubWebhookSignature(
        req.body,
        req.header('X-Hub-Signature-256'),
        process.env.GITHUB_WEBHOOK_SECRET,
      )
    )
      throw new AppError('UNAUTHORIZED', 401, 'Invalid GitHub webhook signature');
    let payload: unknown;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid GitHub webhook JSON');
    }
    const result = await githubService.receiveWebhook(
      req.header('X-GitHub-Delivery') ?? '',
      req.header('X-GitHub-Event') ?? '',
      payload,
    );
    sendData(res, { status: result }, result === 'duplicate' ? 200 : 202);
  } catch (error) {
    next(error);
  }
}
