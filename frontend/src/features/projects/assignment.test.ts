import { describe, expect, it, vi } from 'vitest';
import { engineeringApi } from '../engineering/api';
import { inviteSelectedEngineers } from './assignment';
import type { AssignmentDraft } from './components/ProjectAssignmentFields';

vi.mock('../engineering/api', () => ({
  engineeringApi: { inviteEngineer: vi.fn() },
}));

const draft: AssignmentDraft = {
  engineers: [
    { id: 'one', email: 'one@example.com', name: 'One', role: 'LEAD_ENGINEER' },
    { id: 'two', email: 'two@example.com', name: 'Two', role: 'QA_ENGINEER' },
  ],
  description: 'Build the project',
  responsibilities: 'Planning',
  startDate: '2026-10-16',
  expectedEndDate: '2026-11-16',
  estimatedHours: 40,
  priority: 'HIGH',
  managerNotes: '',
};

describe('inviteSelectedEngineers', () => {
  it('sends each selected role and keeps successful invitations when one fails', async () => {
    vi.mocked(engineeringApi.inviteEngineer)
      .mockResolvedValueOnce({ id: 'invitation-one', status: 'PENDING' })
      .mockRejectedValueOnce(new Error('Email queue unavailable'));
    const result = await inviteSelectedEngineers('project-one', draft);
    expect(engineeringApi.inviteEngineer).toHaveBeenCalledTimes(2);
    expect(engineeringApi.inviteEngineer).toHaveBeenCalledWith(
      'project-one',
      expect.objectContaining({ email: 'one@example.com', role: 'LEAD_ENGINEER' }),
    );
    expect(result).toEqual({
      invited: 1,
      succeededIds: ['one'],
      failed: [{ engineer: 'Two', error: 'Error: Email queue unavailable' }],
    });
  });
});
