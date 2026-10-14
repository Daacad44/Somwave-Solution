import { type FormEvent, type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PERMISSIONS } from '@somwave/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../../../components/states';
import { useHasPermission } from '../../../lib/rbac';
import { engineeringApi } from '../../engineering/api';
import { engineerApi } from '../../engineering/engineerApi';

const PROJECT_ROLES = ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER', 'REVIEWER', 'CONTRIBUTOR'];

export function ProjectTeamPanel({ projectId }: { projectId: string }): ReactNode {
  const client = useQueryClient();
  const canManage = useHasPermission(PERMISSIONS.ENGINEERING_MANAGE);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('ENGINEER');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(40);
  const [priority, setPriority] = useState('MEDIUM');
  const [managerNotes, setManagerNotes] = useState('');
  const [message, setMessage] = useState('');
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const members = useQuery({
    queryKey: ['engineering-members', projectId],
    queryFn: () => engineeringApi.members(projectId),
  });
  const invitations = useQuery({
    queryKey: ['engineering-invitations', projectId],
    queryFn: () => engineeringApi.projectInvitations(projectId),
    enabled: canManage,
  });
  const candidates = useQuery({
    queryKey: ['engineering-eligible-engineers', projectId],
    queryFn: () => engineeringApi.eligibleEngineers(projectId),
    enabled: canManage,
  });
  const profiles = useQuery({
    queryKey: ['engineer-team', projectId],
    queryFn: () => engineerApi.team(projectId),
  });
  const history = useQuery({
    queryKey: ['engineer-assignment-history', projectId],
    queryFn: () => engineerApi.history(projectId),
    enabled: canManage,
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['engineering-members', projectId] });
    void client.invalidateQueries({ queryKey: ['engineering-invitations', projectId] });
    void client.invalidateQueries({ queryKey: ['engineer-team', projectId] });
    void client.invalidateQueries({ queryKey: ['engineer-assignment-history', projectId] });
    void client.invalidateQueries({ queryKey: ['projects'] });
  };
  const invite = useMutation({
    mutationFn: () =>
      engineeringApi.inviteEngineer(projectId, {
        email: email.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
        role,
        description,
        responsibilities,
        startDate: new Date(startDate).toISOString(),
        expectedEndDate: new Date(expectedEndDate).toISOString(),
        estimatedHours,
        priority,
        managerNotes,
      }),
    onSuccess: () => {
      setEmail('');
      setName('');
      setDescription('');
      setResponsibilities('');
      setStartDate('');
      setExpectedEndDate('');
      setManagerNotes('');
      setMessage('Invitation queued. Project access begins after acceptance.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => engineeringApi.removeMember(projectId, userId),
    onSuccess: () => {
      setMessage('Engineer removed from the project.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const cancel = useMutation({
    mutationFn: (invitationId: string) => engineeringApi.cancelInvitation(projectId, invitationId),
    onSuccess: () => {
      setMessage('Invitation cancelled.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const updateRole = useMutation({
    mutationFn: ({ userId, nextRole }: { userId: string; nextRole: string }) =>
      engineeringApi.updateMember(projectId, userId, { role: nextRole }),
    onSuccess: () => {
      setMessage('Project role updated.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const reassign = useMutation({
    mutationFn: () => engineerApi.reassignTasks(projectId, fromUserId, toUserId),
    onSuccess: (result) => {
      setMessage(`${result.reassignedCount} open tasks reassigned.`);
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const handover = useMutation({
    mutationFn: () =>
      engineerApi.createHandover(projectId, {
        fromUserId,
        toUserId,
        notes: handoverNotes,
        removeSource: false,
        transferBugs: true,
        transferMaintenance: true,
        transferDocuments: true,
        transferReleases: true,
      }),
    onSuccess: () => {
      setHandoverNotes('');
      setMessage('Responsibilities transferred and handover recorded.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const selected = candidates.data?.find(
    (person) => person.email.toLowerCase() === email.toLowerCase(),
  );

  return (
    <div className="space-y-6">
      {message ? (
        <p role="status" className="rounded-md border border-border bg-surface p-3 text-sm">
          {message}
        </p>
      ) : null}
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Project team</h2>
        {members.isLoading ? (
          <LoadingState rows={3} />
        ) : members.isError ? (
          <ErrorState
            description="Could not load the project team."
            onRetry={() => void members.refetch()}
          />
        ) : members.data?.length ? (
          <ul className="mt-4 divide-y divide-border">
            {members.data.map((member) => {
              const profile = profiles.data?.find((person) => person.user.id === member.user.id);
              return (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {member.user.name} · {member.role.replaceAll('_', ' ')}
                    </p>
                    <p className="text-muted">{member.user.email}</p>
                    {profile?.user.engineerProfile?.specialization ? (
                      <p className="text-muted">{profile.user.engineerProfile.specialization}</p>
                    ) : null}
                    {profile?.user.engineerProfile?.skills.length ? (
                      <p className="text-muted">
                        Skills: {profile.user.engineerProfile.skills.join(', ')}
                      </p>
                    ) : null}
                    {member.responsibilities ? <p>{member.responsibilities}</p> : null}
                    {profile ? (
                      <p className="text-muted">
                        {profile.assignedTaskCount} assigned tasks · {profile.completedTaskCount}{' '}
                        completed · {profile.estimatedOpenHours} estimated open hours · Joined{' '}
                        {new Date(profile.assignedAt).toLocaleDateString()}
                        {profile.lastActivity
                          ? ` · Last activity ${new Date(profile.lastActivity).toLocaleDateString()}`
                          : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      className="rounded-md px-3 py-2 text-brand underline"
                      to={`/engineering/engineers/${member.user.id}`}
                    >
                      Profile
                    </Link>
                    {canManage && member.role !== 'MANAGER' ? (
                      <select
                        aria-label={`Project role for ${member.user.name}`}
                        className="rounded-md border border-border bg-surface px-2"
                        value={member.role}
                        disabled={updateRole.isPending}
                        onChange={(event) =>
                          updateRole.mutate({
                            userId: member.user.id,
                            nextRole: event.target.value,
                          })
                        }
                      >
                        {PROJECT_ROLES.map((value) => (
                          <option key={value} value={value}>
                            {value.replaceAll('_', ' ')}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {canManage && member.role !== 'MANAGER' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(member.user.id)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No engineers assigned" />
        )}
      </section>

      {canManage ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Assign engineer</h2>
          <p className="mt-1 text-sm text-muted">
            The engineer receives an invitation and joins this project only after accepting it.
          </p>
          {candidates.isError ? (
            <ErrorState
              description="Could not load eligible engineers."
              onRetry={() => void candidates.refetch()}
            />
          ) : null}
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              invite.mutate();
            }}
          >
            <div>
              <Input
                label="Engineer email"
                type="email"
                required
                list="project-eligible-engineers"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <datalist id="project-eligible-engineers">
                {candidates.data
                  ?.filter(
                    (person) => !members.data?.some((member) => member.user.id === person.id),
                  )
                  .map((person) => (
                    <option key={person.id} value={person.email}>
                      {person.name}
                    </option>
                  ))}
              </datalist>
              {selected ? (
                <p role="status" className="mt-1 text-sm text-muted">
                  {selected.specialization || 'Engineer'} · {selected.availability.toLowerCase()} ·{' '}
                  {selected.skills.join(', ') || 'No skills listed'}
                  <br />
                  {selected.estimatedHoursThisWeek} of {selected.availableHoursThisWeek} hours
                  committed this week{selected.nearCapacity ? ' · Capacity warning' : ''}.
                </p>
              ) : null}
            </div>
            <Input
              label="Engineer name (required for a new account)"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <label className="text-sm font-medium">
              Project role
              <select
                className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {PROJECT_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Responsibilities"
              value={responsibilities}
              onChange={(event) => setResponsibilities(event.target.value)}
            />
            <Input
              label="Assignment description"
              required
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Input
              label="Start date"
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <Input
              label="Expected end date"
              type="date"
              required
              min={startDate}
              value={expectedEndDate}
              onChange={(event) => setExpectedEndDate(event.target.value)}
            />
            <Input
              label="Estimated workload (hours)"
              type="number"
              min={0.5}
              max={10000}
              step={0.5}
              required
              value={estimatedHours}
              onChange={(event) => setEstimatedHours(Number(event.target.value))}
            />
            <label className="text-sm font-medium">
              Priority
              <select
                className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((value) => (
                  <option key={value} value={value}>
                    {value[0]}
                    {value.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Manager notes (optional)"
              maxLength={2000}
              value={managerNotes}
              onChange={(event) => setManagerNotes(event.target.value)}
            />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={invite.isPending}>
                Invite engineer
              </Button>
            </div>
          </form>
          {invitations.isError ? (
            <ErrorState
              description="Could not load invitations."
              onRetry={() => void invitations.refetch()}
            />
          ) : null}
          {invitations.data?.length ? (
            <div className="mt-6">
              <h3 className="font-semibold">Assignment invitations</h3>
              <ul className="mt-2 divide-y divide-border">
                {invitations.data.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span>
                      {item.user.name} · {item.user.email} · {item.role.replaceAll('_', ' ')} ·{' '}
                      {item.status}
                      {item.emailDelivery
                        ? ` · Email ${item.emailDelivery.status.toLowerCase()}`
                        : ''}
                    </span>
                    {item.status === 'PENDING' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(item.id)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
      {canManage && history.data?.length ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Assignment history</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {history.data.map((event) => (
              <li key={event.id}>
                {event.action.replaceAll('_', ' ')} · {event.role.replaceAll('_', ' ')} ·{' '}
                {new Date(event.occurredAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {canManage &&
      (members.data?.filter((member) => PROJECT_ROLES.includes(member.role)).length ?? 0) > 1 ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Transfer work</h2>
          <p className="mt-1 text-sm text-muted">
            Both engineers must have accepted active assignments in this project.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              From engineer
              <select
                className="mt-1 h-11 w-full rounded border border-border bg-surface px-3"
                value={fromUserId}
                onChange={(event) => setFromUserId(event.target.value)}
              >
                <option value="">Select engineer</option>
                {members.data
                  ?.filter((member) => PROJECT_ROLES.includes(member.role))
                  .map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              To engineer
              <select
                className="mt-1 h-11 w-full rounded border border-border bg-surface px-3"
                value={toUserId}
                onChange={(event) => setToUserId(event.target.value)}
              >
                <option value="">Select engineer</option>
                {members.data
                  ?.filter((member) => PROJECT_ROLES.includes(member.role))
                  .map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <Input
                label="Handover notes"
                maxLength={5000}
                value={handoverNotes}
                onChange={(event) => setHandoverNotes(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button
                disabled={!fromUserId || !toUserId || fromUserId === toUserId || reassign.isPending}
                onClick={() => reassign.mutate()}
              >
                Reassign open tasks
              </Button>
              <Button
                variant="secondary"
                disabled={
                  !fromUserId ||
                  !toUserId ||
                  fromUserId === toUserId ||
                  !handoverNotes.trim() ||
                  handover.isPending
                }
                onClick={() => handover.mutate()}
              >
                Transfer responsibilities
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
