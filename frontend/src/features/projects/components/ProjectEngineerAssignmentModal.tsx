import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { engineeringApi } from '../../engineering/api';
import { inviteSelectedEngineers } from '../assignment';
import {
  emptyAssignmentDraft,
  ProjectAssignmentFields,
  validateAssignmentDraft,
} from './ProjectAssignmentFields';

export function ProjectEngineerAssignmentModal({
  project,
  onClose,
}: {
  project: { id: string; name: string };
  onClose: () => void;
}): ReactNode {
  const client = useQueryClient();
  const [draft, setDraft] = useState(emptyAssignmentDraft);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const members = useQuery({
    queryKey: ['engineering-members', project.id],
    queryFn: () => engineeringApi.members(project.id),
  });
  const invitations = useQuery({
    queryKey: ['engineering-invitations', project.id],
    queryFn: () => engineeringApi.projectInvitations(project.id),
  });
  const excludeIds = [
    ...(members.data ?? []).map((member) => member.user.id),
    ...(invitations.data ?? [])
      .filter((item) => item.status === 'PENDING')
      .map((item) => item.user.id),
  ];
  const submit = async () => {
    const error = validateAssignmentDraft(draft);
    if (error) {
      setMessage(error);
      return;
    }
    setPending(true);
    try {
      const result = await inviteSelectedEngineers(project.id, draft);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['projects'] }),
        client.invalidateQueries({ queryKey: ['engineering-invitations', project.id] }),
        client.invalidateQueries({ queryKey: ['engineering-eligible-engineers', project.id] }),
      ]);
      if (result.failed.length) {
        setDraft((current) => ({
          ...current,
          engineers: current.engineers.filter(
            (engineer) => !result.succeededIds.includes(engineer.id),
          ),
        }));
        setMessage(
          `${result.invited} invitation(s) saved. ${result.failed.map((item) => `${item.engineer}: ${item.error}`).join('; ')}`,
        );
      } else {
        onClose();
      }
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal open wide onClose={onClose} title={`Assign engineers · ${project.name}`}>
      <p className="mb-3 text-sm text-muted">
        Select active engineers. They join the project after accepting their invitation.
      </p>
      <ProjectAssignmentFields
        projectId={project.id}
        value={draft}
        onChange={setDraft}
        excludeIds={excludeIds}
      />
      {message ? (
        <p role="alert" className="mt-3 text-sm text-error">
          {message}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => void submit()} isLoading={pending}>
          Send invitations
        </Button>
      </div>
    </Modal>
  );
}
