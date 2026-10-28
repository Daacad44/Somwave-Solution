import { describe, expect, it } from 'vitest';
import { availableActions, waitingNote } from './SpendActions';

const all = { create: true, approve: true, post: true };
const tx = (state: string, createdById = 'me') =>
  ({ source: 'FINANCE_TRANSACTION', state, createdById }) as const;

describe('project payment actions', () => {
  it('lets the creator send a draft or rejected payment for approval, or cancel it', () => {
    expect(availableActions(tx('DRAFT'), 'me', all)).toEqual(['submit', 'cancel']);
    expect(availableActions(tx('REJECTED'), 'me', all)).toEqual(['submit', 'cancel']);
  });

  it('never offers self-approval', () => {
    expect(availableActions(tx('SUBMITTED'), 'me', all)).toEqual(['cancel']);
    expect(waitingNote(tx('SUBMITTED'), 'me')).toMatch(/another finance user/);
  });

  it('offers approve and reject to a different approver only', () => {
    expect(availableActions(tx('SUBMITTED', 'other'), 'me', all)).toEqual(['approve', 'reject']);
    expect(availableActions(tx('SUBMITTED', 'other'), 'me', { ...all, approve: false })).toEqual(
      [],
    );
  });

  it('offers posting once approved, and nothing once posted', () => {
    expect(availableActions(tx('APPROVED', 'other'), 'me', all)).toEqual(['post']);
    expect(availableActions(tx('POSTED', 'other'), 'me', all)).toEqual([]);
  });

  it('has no actions for project expenses', () => {
    expect(
      availableActions(
        { source: 'PROJECT_EXPENSE', state: 'ACTUAL', createdById: null },
        'me',
        all,
      ),
    ).toEqual([]);
  });
});
