import type { NextFunction, Request, Response } from 'express';
import type { CreateProjectInquiryInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as inquiries from '../services/project-inquiry.service';

function id(req: Request): string {
  const value = req.params.id;
  if (!value) throw new AppError('NOT_FOUND', 404, 'Project request not found');
  return value;
}

function user(req: Request) {
  if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Sign in required');
  return req.authUser;
}

function clientId(req: Request): string {
  const owner = user(req).clientId;
  if (!owner) throw new AppError('FORBIDDEN', 403, 'Client account required');
  return owner;
}

const handle =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const create = handle(async (req, res) => {
  const key = req.header('Idempotency-Key') ?? '';
  const result = await inquiries.createProjectInquiry(req.body as CreateProjectInquiryInput, key);
  sendData(res, result, 201);
});

export const resend = handle(async (req, res) => {
  sendData(res, await inquiries.resendProjectInquiryCode(id(req)));
});

export const verify = handle(async (req, res) => {
  sendData(res, await inquiries.verifyProjectInquiry(id(req), (req.body as { code: string }).code));
});

export const activate = handle(async (req, res) => {
  const body = req.body as { activationToken: string; password: string };
  sendData(
    res,
    await inquiries.activateProjectInquiry(id(req), body.activationToken, body.password),
  );
});

export const listClient = handle(async (req, res) => {
  sendData(res, await inquiries.listClientProjectInquiries(clientId(req)));
});

export const listUnlinked = handle(async (req, res) => {
  sendData(res, await inquiries.listUnlinkedProjectInquiries(user(req).id));
});

export const link = handle(async (req, res) => {
  sendData(res, await inquiries.linkProjectInquiry(id(req), user(req).id));
});

export const approveProposal = handle(async (req, res) => {
  sendData(
    res,
    await inquiries.approveProjectInquiryProposal(id(req), clientId(req), user(req).id),
  );
});

export const listAdmin = handle(async (_req, res) => {
  sendData(res, await inquiries.listAdminProjectInquiries());
});

export const review = handle(async (req, res) => {
  const body = req.body as {
    status: 'UNDER_REVIEW' | 'PROPOSAL_SENT' | 'REJECTED' | 'CANCELLED';
    proposalSummary?: string;
  };
  sendData(
    res,
    await inquiries.reviewProjectInquiry(id(req), body.status, user(req).id, body.proposalSummary),
  );
});

export const convert = handle(async (req, res) => {
  const result = await inquiries.convertProjectInquiry(
    id(req),
    user(req).id,
    (req.body as { managerId?: string | null }).managerId,
  );
  sendData(res, result, result.created ? 201 : 200);
});
