import { engineeringApi } from '../engineering/api';
import type { AssignmentDraft } from './components/ProjectAssignmentFields';

/** Each invitation is independent; one delivery failure must not erase successful assignments. */
export async function inviteSelectedEngineers(projectId: string, draft: AssignmentDraft) {
  const results = await Promise.allSettled(
    draft.engineers.map((engineer) =>
      engineeringApi.inviteEngineer(projectId, {
        email: engineer.email,
        role: engineer.role,
        description: draft.description.trim(),
        responsibilities: draft.responsibilities.trim(),
        startDate: new Date(draft.startDate).toISOString(),
        expectedEndDate: new Date(draft.expectedEndDate).toISOString(),
        estimatedHours: draft.estimatedHours,
        priority: draft.priority,
        managerNotes: draft.managerNotes.trim(),
      }),
    ),
  );
  return {
    invited: results.filter((result) => result.status === 'fulfilled').length,
    succeededIds: results.flatMap((result, index) =>
      result.status === 'fulfilled' ? [draft.engineers[index]!.id] : [],
    ),
    failed: results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [{ engineer: draft.engineers[index]!.name, error: String(result.reason) }]
        : [],
    ),
  };
}
