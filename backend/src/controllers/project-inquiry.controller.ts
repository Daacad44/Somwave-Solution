import type { NextFunction, Request, Response } from 'express';
import type { CreateProjectInquiryInput, ProjectInquiryAttachmentInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as inquiries from '../services/project-inquiry.service';
import * as attachments from '../services/project-inquiry-attachment.service';

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

export const uploadPublicAttachment = handle(async (req, res) => {
  const body = req.body as ProjectInquiryAttachmentInput & { activationToken: string };
  const result = await attachments.uploadProjectInquiryAttachment(id(req), body, {
    kind: 'proof',
    activationToken: body.activationToken,
  });
  sendData(res, result, 201);
});

export const uploadClientAttachment = handle(async (req, res) => {
  const result = await attachments.uploadProjectInquiryAttachment(
    id(req),
    req.body as ProjectInquiryAttachmentInput,
    { kind: 'client', clientId: clientId(req) },
    user(req).id,
  );
  sendData(res, result, 201);
});

export const listClientAttachments = handle(async (req, res) => {
  sendData(
    res,
    await attachments.listProjectInquiryAttachments(id(req), {
      kind: 'client',
      clientId: clientId(req),
    }),
  );
});

export const listAdminAttachments = handle(async (req, res) => {
  sendData(res, await attachments.listProjectInquiryAttachments(id(req), { kind: 'admin' }));
});

async function download(
  req: Request,
  res: Response,
  access: { kind: 'client'; clientId: string } | { kind: 'admin' },
) {
  const attachmentId = req.params.attachmentId;
  if (!attachmentId) throw new AppError('NOT_FOUND', 404, 'Attachment not found');
  const file = await attachments.readProjectInquiryAttachment(id(req), attachmentId, access);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', file.bytes.length);
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', 'sandbox');
  res.setHeader('X-Download-Options', 'noopen');
  res.send(file.bytes);
}

export const downloadClientAttachment = handle(async (req, res) => {
  await download(req, res, { kind: 'client', clientId: clientId(req) });
});

export const downloadAdminAttachment = handle(async (req, res) => {
  await download(req, res, { kind: 'admin' });
});
