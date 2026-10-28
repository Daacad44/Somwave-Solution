// Approval actions for a project payment, shown where the payment is listed.
// The buttons mirror the backend rules (creator submits/cancels, a different
// approver approves/rejects, a poster posts); the server re-checks every one.
import { type FormEvent, type ReactNode, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS, type ProjectMoneySpend } from '@somwave/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { useHasPermission } from '../../../lib/rbac';
import { useCurrentUser } from '../../auth/hooks';
import { financeApi } from '../api';

type Action = 'submit' | 'approve' | 'reject' | 'post' | 'cancel';

const LABEL: Record<Action, string> = {
  submit: 'Send for approval',
  approve: 'Approve',
  reject: 'Reject',
  post: 'Post to ledger',
  cancel: 'Cancel',
};

export function availableActions(
  row: Pick<ProjectMoneySpend, 'source' | 'state' | 'createdById'>,
  userId: string | undefined,
  can: { create: boolean; approve: boolean; post: boolean },
): Action[] {
  if (row.source !== 'FINANCE_TRANSACTION' || !userId) return [];
  const mine = row.createdById === userId;
  const actions: Action[] = [];
  if (mine && can.create && (row.state === 'DRAFT' || row.state === 'REJECTED'))
    actions.push('submit');
  if (!mine && can.approve && row.state === 'SUBMITTED') actions.push('approve', 'reject');
  if (can.post && row.state === 'APPROVED') actions.push('post');
  if (mine && can.create && ['DRAFT', 'SUBMITTED', 'REJECTED'].includes(row.state))
    actions.push('cancel');
  return actions;
}

export function useSpendPermissions() {
  const { data: user } = useCurrentUser();
  return {
    userId: user?.id,
    can: {
      create: useHasPermission(PERMISSIONS.FINANCE_CREATE),
      approve: useHasPermission(PERMISSIONS.FINANCE_APPROVE),
      post: useHasPermission(PERMISSIONS.FINANCE_POST),
    },
  };
}

export function waitingNote(
  row: Pick<ProjectMoneySpend, 'source' | 'state' | 'createdById'>,
  userId: string | undefined,
): string | null {
  if (row.source !== 'FINANCE_TRANSACTION') return null;
  if (row.state === 'SUBMITTED' && row.createdById === userId)
    return 'Waiting for another finance user to approve';
  if (row.state === 'APPROVED') return 'Approved — waiting to be posted';
  return null;
}

export function SpendActions({
  row,
  onMessage,
}: {
  row: ProjectMoneySpend;
  onMessage: (message: string) => void;
}): ReactNode {
  const queryClient = useQueryClient();
  const { userId, can } = useSpendPermissions();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const run = useMutation({
    mutationFn: ({ action, why }: { action: Action; why?: string }) =>
      financeApi.action(row.id, action, why),
    onSuccess: async (_record, vars) => {
      setRejecting(false);
      setReason('');
      onMessage(`${LABEL[vars.action]}: done.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finance-project-money'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-projects-money'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] }),
      ]);
    },
    onError: (err: Error) => onMessage(err.message),
  });
  const actions = availableActions(row, userId, can);
  const note = waitingNote(row, userId);
  if (!actions.length) return note ? <span className="text-xs text-muted">{note}</span> : null;

  const submitReject = (event: FormEvent) => {
    event.preventDefault();
    run.mutate({ action: 'reject', why: reason.trim() });
  };

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {actions.map((action) => (
        <Button
          key={action}
          size="sm"
          variant={
            action === 'approve' || action === 'post'
              ? 'primary'
              : action === 'reject'
                ? 'danger'
                : 'secondary'
          }
          isLoading={run.isPending && run.variables?.action === action}
          disabled={run.isPending}
          onClick={() => (action === 'reject' ? setRejecting(true) : run.mutate({ action }))}
        >
          {LABEL[action]}
        </Button>
      ))}
      <Modal open={rejecting} onClose={() => setRejecting(false)} title="Reject payment">
        <form onSubmit={submitReject} className="space-y-3">
          <Input
            label="Reason (shown to the person who entered it)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={3}
            maxLength={1000}
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRejecting(false)}>
              Back
            </Button>
            <Button type="submit" variant="danger" isLoading={run.isPending}>
              Reject
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
