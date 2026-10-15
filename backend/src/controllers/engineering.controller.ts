import type { NextFunction, Request, Response } from 'express';
import type {
  AddProjectMemberInput,
  CreateEngineeringTaskInput,
  ReviewEngineeringTaskInput,
  UpdateProjectMemberInput,
  CreateProjectPhaseInput,
  UpdateEngineerProfileInput,
  CreateEngineerAvailabilityInput,
  InviteProjectEngineerInput,
  RespondProjectInvitationInput,
  ReassignProjectTasksInput,
  CreateProjectHandoverInput,
} from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as engineering from '../services/engineering.service';
import { getEngineeringAnalytics } from '../services/engineering-analytics.service';
import { getEngineeringTeamOverview } from '../services/engineering-team.service';
import { getEngineerOperationalOverview } from '../services/engineer-overview.service';

function actor(req: Request): Express.AuthUserContext {
  if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return req.authUser;
}

function projectId(req: Request): string {
  const id = req.params.projectId;
  if (!id) throw new AppError('VALIDATION_ERROR', 400, 'Project ID is required');
  return id;
}

function taskId(req: Request): string {
  const id = req.params.taskId;
  if (!id) throw new AppError('VALIDATION_ERROR', 400, 'Task ID is required');
  return id;
}

export async function myProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await engineering.listMyProjects(actor(req)));
  } catch (error) {
    next(error);
  }
}

export async function metrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await engineering.getEngineeringMetrics(actor(req)));
  } catch (error) {
    next(error);
  }
}

export async function teamOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await getEngineeringTeamOverview(actor(req)));
  } catch (error) {
    next(error);
  }
}

export async function engineerOverview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.userId;
    if (!id) throw new AppError('VALIDATION_ERROR', 400, 'Engineer ID is required');
    sendData(res, await getEngineerOperationalOverview(id, actor(req)));
  } catch (error) {
    next(error);
  }
}

export async function members(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await engineering.listProjectMembers(projectId(req), actor(req)));
  } catch (error) {
    next(error);
  }
}

export async function eligibleEngineers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : undefined;
    sendData(res, await engineering.listEligibleEngineers(projectId(req), actor(req), search));
  } catch (error) {
    next(error);
  }
}

export async function addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(
      res,
      await engineering.addProjectMember(
        projectId(req),
        actor(req),
        req.body as AddProjectMemberInput,
      ),
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function updateMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.userId;
    if (!userId) throw new AppError('VALIDATION_ERROR', 400, 'User ID is required');
    sendData(
      res,
      await engineering.updateProjectMember(
        projectId(req),
        userId,
        actor(req),
        req.body as UpdateProjectMemberInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.userId;
    if (!userId) throw new AppError('VALIDATION_ERROR', 400, 'User ID is required');
    await engineering.removeProjectMember(projectId(req), userId, actor(req));
    sendData(res, { success: true });
  } catch (error) {
    next(error);
  }
}

export async function tasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await engineering.listProjectEngineeringTasks(projectId(req), actor(req)));
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(
      res,
      await engineering.createEngineeringTask(
        projectId(req),
        actor(req),
        req.body as CreateEngineeringTaskInput,
      ),
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function submitTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await engineering.submitEngineeringTask(taskId(req), actor(req)));
  } catch (error) {
    next(error);
  }
}

export async function reviewTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(
      res,
      await engineering.reviewEngineeringTask(
        taskId(req),
        actor(req),
        req.body as ReviewEngineeringTaskInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

type Action = (req: Request) => Promise<unknown>;
function handle(action: Action, status = 200) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendData(res, await action(req), status);
    } catch (error) {
      next(error);
    }
  };
}

export const phases = handle((req) => engineering.listProjectPhases(projectId(req), actor(req)));
export const createPhase = handle(
  (req) =>
    engineering.createProjectPhase(projectId(req), actor(req), req.body as CreateProjectPhaseInput),
  201,
);
export const assignmentHistory = handle((req) =>
  engineering.listAssignmentHistory(projectId(req), actor(req)),
);
export const engineerAssignments = handle((req) => {
  const id = req.params.userId;
  if (!id) throw new AppError('VALIDATION_ERROR', 400, 'Engineer ID is required');
  return engineering.listEngineerAssignments(id, actor(req));
});
export const handovers = handle((req) =>
  engineering.listProjectHandovers(projectId(req), actor(req)),
);
export const createHandover = handle(
  (req) =>
    engineering.createProjectHandover(
      projectId(req),
      actor(req),
      req.body as CreateProjectHandoverInput,
    ),
  201,
);
export const myInvitations = handle((req) => engineering.listMyProjectInvitations(actor(req)));
export const projectInvitations = handle((req) =>
  engineering.listProjectInvitations(projectId(req), actor(req)),
);
export const eligibleEngineersForNewProject = handle((req) =>
  engineering.listEligibleEngineers(
    null,
    actor(req),
    typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : undefined,
  ),
);
export const projectDependencies = handle((req) =>
  engineering.listProjectDependencies(projectId(req), actor(req)),
);
export const inviteEngineer = handle(
  (req) =>
    engineering.inviteProjectEngineer(
      projectId(req),
      actor(req),
      req.body as InviteProjectEngineerInput,
    ),
  201,
);
export const respondInvitation = handle((req) => {
  const id = req.params.invitationId;
  if (!id) throw new AppError('VALIDATION_ERROR', 400, 'Invitation ID is required');
  return engineering.respondToProjectInvitation(
    id,
    actor(req),
    req.body as RespondProjectInvitationInput,
  );
});
export const cancelInvitation = handle((req) => {
  const id = req.params.invitationId;
  if (!id) throw new AppError('VALIDATION_ERROR', 400, 'Invitation ID is required');
  return engineering.cancelProjectInvitation(projectId(req), id, actor(req));
});
export const resendInvitation = handle((req) => {
  const id = req.params.invitationId;
  if (!id) throw new AppError('VALIDATION_ERROR', 400, 'Invitation ID is required');
  return engineering.resendProjectInvitation(projectId(req), id, actor(req));
});
export const reassignTasks = handle((req) =>
  engineering.reassignProjectTasks(
    projectId(req),
    actor(req),
    req.body as ReassignProjectTasksInput,
  ),
);
export const analytics = handle((req) => getEngineeringAnalytics(actor(req)));
export const engineerProfiles = handle((req) =>
  engineering.listProjectEngineerProfiles(projectId(req), actor(req)),
);
export const myEngineerProfile = handle((req) => engineering.getMyEngineerProfile(actor(req)));
export const updateMyEngineerProfile = handle((req) =>
  engineering.updateMyEngineerProfile(actor(req), req.body as UpdateEngineerProfileInput),
);
export const myAvailability = handle((req) => engineering.listMyAvailability(actor(req)));
export const addMyAvailability = handle(
  (req) => engineering.addMyAvailability(actor(req), req.body as CreateEngineerAvailabilityInput),
  201,
);
export const removeMyAvailability = handle((req) =>
  engineering.removeMyAvailability(actor(req), req.params.slotId!),
);
export const comments = handle((req) => engineering.listTaskComments(taskId(req), actor(req)));
export const addComment = handle(
  (req) => engineering.addTaskComment(taskId(req), actor(req), req.body.body),
  201,
);
export const progress = handle((req) => engineering.listTaskProgress(taskId(req), actor(req)));
export const addProgress = handle(
  (req) => engineering.addTaskProgress(taskId(req), actor(req), req.body),
  201,
);
export const checklist = handle((req) => engineering.listTaskChecklist(taskId(req), actor(req)));
export const addChecklistItem = handle(
  (req) => engineering.addTaskChecklistItem(taskId(req), actor(req), req.body.title),
  201,
);
export const setChecklistItem = handle((req) =>
  engineering.setTaskChecklistItem(taskId(req), req.params.itemId!, actor(req), req.body.completed),
);
export const dependencies = handle((req) =>
  engineering.listTaskDependencies(taskId(req), actor(req)),
);
export const addDependency = handle(
  (req) => engineering.addTaskDependency(taskId(req), actor(req), req.body.dependsOnId),
  201,
);
export const removeDependency = handle((req) =>
  engineering.removeTaskDependency(taskId(req), actor(req), req.params.dependsOnId!),
);
export const verifyQa = handle((req) => engineering.verifyTaskQa(taskId(req), actor(req)));
export const transitions = handle((req) =>
  engineering.listTaskTransitions(taskId(req), actor(req)),
);
export const scheduleTask = handle((req) =>
  engineering.scheduleTask(taskId(req), actor(req), req.body),
);
export const hours = handle((req) => engineering.listTaskHours(taskId(req), actor(req)));
export const recordHours = handle(
  (req) => engineering.recordTaskHours(taskId(req), actor(req), req.body),
  201,
);
export const attachments = handle((req) =>
  engineering.listTaskAttachments(taskId(req), actor(req)),
);
export const addAttachment = handle(
  (req) => engineering.addTaskAttachment(taskId(req), actor(req), req.body),
  201,
);
export async function downloadAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const attachmentId = req.params.attachmentId;
    if (!attachmentId) throw new AppError('VALIDATION_ERROR', 400, 'Attachment ID is required');
    const file = await engineering.getTaskAttachment(taskId(req), attachmentId, actor(req));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName.replace(/[\r\n"\\]/g, '_')}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.bytes);
  } catch (error) {
    next(error);
  }
}
