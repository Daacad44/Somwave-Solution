import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useCurrentUser } from '../auth/hooks';
import { engineeringApi } from './api';
import { engineerApi, type HandoverInput } from './engineerApi';
import { EngineerDirectory } from './EngineerDirectory';
import { EngineerSkillsSchedule } from './EngineerSkillsSchedule';
import { Modal } from '../../components/ui/Modal';

function MyProfile(): ReactNode {
  const client = useQueryClient();
  const mine = useQuery({ queryKey: ['my-engineer-profile'], queryFn: engineerApi.mine });
  const slots = useQuery({
    queryKey: ['my-engineer-availability'],
    queryFn: engineerApi.availability,
  });
  const [headline, setHeadline] = useState('');
  const [skills, setSkills] = useState('');
  const [availability, setAvailability] = useState('AVAILABLE');
  const [capacity, setCapacity] = useState(40);
  const [timezone, setTimezone] = useState('UTC');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [kind, setKind] = useState('WORKING');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!mine.data) return;
    setHeadline(mine.data.headline ?? '');
    setSkills(mine.data.skills.join(', '));
    setAvailability(mine.data.availability);
    setCapacity(Number(mine.data.weeklyCapacityHours));
    setTimezone(mine.data.timezone);
  }, [mine.data]);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['my-engineer-profile'] });
    void client.invalidateQueries({ queryKey: ['my-engineer-availability'] });
    void client.invalidateQueries({ queryKey: ['engineer-team'] });
  };
  const save = useMutation({
    mutationFn: () =>
      engineerApi.updateMine({
        headline: headline || null,
        skills: skills
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        availability,
        weeklyCapacityHours: capacity,
        timezone,
      }),
    onSuccess: () => {
      setMessage('Profile saved.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const add = useMutation({
    mutationFn: () =>
      engineerApi.addAvailability(
        new Date(startAt).toISOString(),
        new Date(endAt).toISOString(),
        kind,
        note,
      ),
    onSuccess: () => {
      setStartAt('');
      setEndAt('');
      setNote('');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const remove = useMutation({
    mutationFn: engineerApi.removeAvailability,
    onSuccess: refresh,
    onError: (error: Error) => setMessage(error.message),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {message ? (
        <p role="status" className="lg:col-span-2">
          {message}
        </p>
      ) : null}
      <form
        className="space-y-3 rounded-lg border border-border bg-surface p-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="text-lg font-semibold">My engineer profile</h2>
        <Input
          label="Headline"
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          maxLength={500}
        />
        <Input
          label="Technical skills (comma separated)"
          value={skills}
          onChange={(event) => setSkills(event.target.value)}
        />
        <label className="block text-sm">
          Availability
          <select
            className="mt-1 w-full rounded border border-border bg-surface p-3"
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
          >
            <option value="AVAILABLE">Available</option>
            <option value="LIMITED">Limited</option>
            <option value="UNAVAILABLE">Unavailable</option>
          </select>
        </label>
        <Input
          label="Weekly capacity (hours)"
          type="number"
          min={1}
          max={80}
          step="0.5"
          value={capacity}
          onChange={(event) => setCapacity(Number(event.target.value))}
        />
        <Input
          label="Timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          required
        />
        <Button type="submit" isLoading={save.isPending}>
          Save profile
        </Button>
      </form>
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">My availability calendar</h2>
        <ul className="space-y-1 text-sm">
          {slots.data?.map((slot) => (
            <li
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded bg-surface-alt p-2"
            >
              <span>
                {slot.kind.replaceAll('_', ' ')} · {new Date(slot.startAt).toLocaleString()} –{' '}
                {new Date(slot.endAt).toLocaleString()}
              </span>
              <Button size="sm" variant="secondary" onClick={() => remove.mutate(slot.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="space-y-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <Input
            label="From"
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            required
          />
          <Input
            label="To"
            type="datetime-local"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            required
          />
          <label className="block text-sm">
            Kind
            <select
              className="mt-1 w-full rounded border border-border bg-surface p-3"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="WORKING">Working</option>
              <option value="TIME_OFF">Time off</option>
              <option value="ON_CALL">On call</option>
            </select>
          </label>
          <Input label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button type="submit" isLoading={add.isPending}>
            Add availability
          </Button>
        </form>
      </section>
      <div className="lg:col-span-2">
        <EngineerSkillsSchedule />
      </div>
    </div>
  );
}

export function EngineerManagementPage(): ReactNode {
  const { data: user } = useCurrentUser();
  const canManage = useHasPermission(PERMISSIONS.ENGINEERING_MANAGE);
  const isEngineer =
    user?.roles.some((role) => ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER'].includes(role)) ??
    false;
  const [projectId, setProjectId] = useState('');
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [handoverOptions, setHandoverOptions] = useState({
    removeSource: false,
    transferBugs: true,
    transferMaintenance: true,
    transferDocuments: true,
    transferReleases: true,
  });
  const [confirmHandover, setConfirmHandover] = useState(false);
  const queryClient = useQueryClient();
  const projects = useQuery({
    queryKey: ['engineering-projects'],
    queryFn: engineeringApi.projects,
  });
  const selectedId = projectId || projects.data?.[0]?.id || '';
  const team = useQuery({
    queryKey: ['engineer-team', selectedId],
    queryFn: () => engineerApi.team(selectedId),
    enabled: Boolean(selectedId),
  });
  const history = useQuery({
    queryKey: ['engineer-assignment-history', selectedId],
    queryFn: () => engineerApi.history(selectedId),
    enabled: Boolean(selectedId && canManage),
  });
  const handovers = useQuery({
    queryKey: ['engineer-handovers', selectedId],
    queryFn: () => engineerApi.handovers(selectedId),
    enabled: Boolean(selectedId && canManage),
  });
  const reassignment = useMutation({
    mutationFn: (input: HandoverInput) => engineerApi.createHandover(selectedId, input),
    onSuccess: (result) => {
      setActionMessage(
        `Handover recorded. ${result.transferredTaskCount} task(s), ${result.transferredBugCount} bug(s), and ${result.transferredMaintenanceCount} maintenance item(s) transferred.`,
      );
      setConfirmHandover(false);
      setHandoverNotes('');
      void queryClient.invalidateQueries({ queryKey: ['engineer-team', selectedId] });
      void queryClient.invalidateQueries({ queryKey: ['engineer-assignment-history', selectedId] });
      void queryClient.invalidateQueries({ queryKey: ['engineer-handovers', selectedId] });
      void queryClient.invalidateQueries({ queryKey: ['engineering-tasks', selectedId] });
    },
    onError: (error: Error) => setActionMessage(error.message),
  });
  const engineerMembers = (team.data ?? []).filter((member) =>
    ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER', 'REVIEWER', 'CONTRIBUTOR'].includes(member.role),
  );
  const recommendations = [...engineerMembers]
    .filter((member) => member.user.id !== fromUserId)
    .map((member) => ({
      ...member,
      headroom: Math.max(
        0,
        (member.weeklyCapacity[0]?.availableHours ?? 0) -
          (member.weeklyCapacity[0]?.estimatedHours ?? 0),
      ),
      available:
        member.user.engineerProfile?.availability !== 'UNAVAILABLE' &&
        !member.user.availabilitySlots.some(
          (slot) =>
            slot.kind === 'TIME_OFF' &&
            new Date(slot.startAt) <= new Date() &&
            new Date(slot.endAt) >= new Date(),
        ),
    }))
    .sort((a, b) => Number(b.available) - Number(a.available) || b.headroom - a.headroom);
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold text-ink">Engineer management</h1>
      {canManage && user?.roles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role)) ? (
        <EngineerDirectory />
      ) : null}
      {projects.isLoading ? (
        <LoadingState rows={2} />
      ) : projects.isError ? (
        <ErrorState
          description="Could not load projects."
          onRetry={() => void projects.refetch()}
        />
      ) : projects.data?.length ? (
        <>
          <label className="block text-sm">
            Project
            <select
              className="mt-1 w-full rounded border border-border bg-surface p-3"
              value={selectedId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setFromUserId('');
                setToUserId('');
                setActionMessage('');
              }}
            >
              {projects.data.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {team.isLoading ? (
              <LoadingState rows={3} />
            ) : team.isError ? (
              <ErrorState
                description="Could not load team profiles."
                onRetry={() => void team.refetch()}
              />
            ) : team.data?.length ? (
              team.data.map((member) => (
                <article
                  key={member.user.id}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <h2 className="font-semibold">{member.user.name}</h2>
                  <p className="text-sm text-muted">
                    {member.role.replaceAll('_', ' ')} · {member.user.email}
                  </p>
                  {member.user.engineerProfile ? (
                    <>
                      <p className="mt-2 text-sm">{member.user.engineerProfile.headline}</p>
                      <p className="mt-1 text-sm">
                        Skills: {member.user.engineerProfile.skills.join(', ') || 'Not specified'}
                      </p>
                      <p className="mt-1 text-sm">
                        {member.user.engineerProfile.availability} ·{' '}
                        {Number(member.user.engineerProfile.weeklyCapacityHours)} hours/week
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Profile not filled in.</p>
                  )}
                  <p className="mt-2 text-sm">
                    {member.activeTaskCount} active tasks · {member.estimatedOpenHours} estimated
                    hours in this project · {member.estimatedAllProjectsHours} estimated hours
                    across projects
                  </p>
                  {member.user.availabilitySlots.length ? (
                    <ul className="mt-2 text-xs">
                      {member.user.availabilitySlots.map((slot) => (
                        <li key={slot.id}>
                          {slot.kind.replaceAll('_', ' ')} ·{' '}
                          {new Date(slot.startAt).toLocaleString()} –{' '}
                          {new Date(slot.endAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))
            ) : (
              <EmptyState title="No engineers assigned" />
            )}
          </div>
          {canManage && engineerMembers.length > 1 ? (
            <form
              className="space-y-3 rounded-lg border border-border bg-surface p-4"
              onSubmit={(event) => {
                event.preventDefault();
                setConfirmHandover(true);
              }}
            >
              <h2 className="text-lg font-semibold">Engineer handover</h2>
              <p className="text-sm text-muted">
                Transfer unfinished tasks to an accepted project engineer. Choose which other
                responsibilities to transfer and record a handover note. The complete checklist is
                saved for review.
              </p>
              {actionMessage ? (
                <p role="status" className="text-sm">
                  {actionMessage}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  From engineer
                  <select
                    className="mt-1 w-full rounded border border-border bg-surface p-3"
                    required
                    value={fromUserId}
                    onChange={(event) => {
                      setFromUserId(event.target.value);
                      setToUserId('');
                    }}
                  >
                    <option value="">Select engineer</option>
                    {engineerMembers.map((member) => (
                      <option key={member.user.id} value={member.user.id}>
                        {member.user.name} ({member.activeTaskCount} open tasks)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  To engineer
                  <select
                    className="mt-1 w-full rounded border border-border bg-surface p-3"
                    required
                    value={toUserId}
                    onChange={(event) => setToUserId(event.target.value)}
                  >
                    <option value="">Select engineer</option>
                    {recommendations.map((member) => (
                      <option key={member.user.id} value={member.user.id}>
                        {member.user.name} ·{' '}
                        {member.available
                          ? `${member.headroom}h estimated headroom`
                          : 'unavailable'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {fromUserId && recommendations[0]?.available ? (
                <p className="text-sm text-muted">
                  Recommended: {recommendations[0].user.name} ({recommendations[0].headroom}h
                  estimated headroom).
                </p>
              ) : null}
              <label className="block text-sm">
                Handover notes
                <textarea
                  className="mt-1 min-h-24 w-full rounded border border-border bg-surface p-3"
                  minLength={1}
                  maxLength={5000}
                  required
                  value={handoverNotes}
                  onChange={(event) => setHandoverNotes(event.target.value)}
                />
              </label>
              <fieldset className="grid gap-2 text-sm sm:grid-cols-2">
                <legend className="mb-2 font-medium">Transfer responsibilities</legend>
                {(
                  [
                    ['transferBugs', 'Open bugs'],
                    ['transferMaintenance', 'Maintenance work'],
                    ['transferDocuments', 'Document ownership'],
                    ['transferReleases', 'Active releases'],
                    ['removeSource', 'Remove source from this project after handover'],
                  ] as const
                ).map(([key, title]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={handoverOptions[key]}
                      onChange={(event) =>
                        setHandoverOptions({ ...handoverOptions, [key]: event.target.checked })
                      }
                    />
                    {title}
                  </label>
                ))}
              </fieldset>
              <Button
                type="submit"
                disabled={
                  !fromUserId || !toUserId || !handoverNotes.trim() || reassignment.isPending
                }
                isLoading={reassignment.isPending}
              >
                Review handover
              </Button>
            </form>
          ) : null}
          {canManage ? (
            <section className="rounded-lg border border-border bg-surface p-4">
              <h2 className="font-semibold">Handover history</h2>
              {handovers.isLoading ? (
                <LoadingState rows={2} />
              ) : handovers.isError ? (
                <ErrorState
                  description="Could not load handover history."
                  onRetry={() => void handovers.refetch()}
                />
              ) : handovers.data?.length ? (
                <ol className="mt-3 space-y-2 text-sm">
                  {handovers.data.map((row) => (
                    <li key={row.id} className="rounded border border-border p-3">
                      <strong>
                        {row.fromUser?.name ??
                          team.data?.find((member) => member.user.id === row.fromUserId)?.user
                            .name ??
                          row.fromUserId}
                      </strong>{' '}
                      →{' '}
                      <strong>
                        {row.toUser?.name ??
                          team.data?.find((member) => member.user.id === row.toUserId)?.user.name ??
                          row.toUserId}
                      </strong>{' '}
                      · {new Date(row.createdAt).toLocaleString()}
                      <p className="mt-1">{row.notes}</p>
                      <p className="mt-1 text-muted">
                        Transferred: {row.transferredTaskCount} tasks, {row.transferredBugCount}{' '}
                        bugs, {row.transferredMaintenanceCount} maintenance,{' '}
                        {row.transferredDocumentCount} documents, {row.transferredReleaseCount}{' '}
                        releases · Source {row.sourceRemoved ? 'removed' : 'retained'}
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer">Recorded checklist</summary>
                        <ul className="ml-4 mt-1 list-disc text-muted">
                          <li>{row.checklist.incompleteTaskIds.length} unfinished tasks</li>
                          <li>{row.checklist.pendingReviewTaskIds.length} pending reviews</li>
                          <li>{row.checklist.openBugIds.length} open bugs</li>
                          <li>{row.checklist.openMaintenanceIds.length} maintenance requests</li>
                          <li>{row.checklist.documentIds.length} documents</li>
                          <li>{row.checklist.activeReleaseIds.length} active releases</li>
                        </ul>
                      </details>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState title="No handovers recorded" />
              )}
            </section>
          ) : null}
          {canManage ? (
            <details className="rounded-lg border border-border bg-surface p-4">
              <summary className="cursor-pointer font-semibold">Assignment history</summary>
              {history.isError ? (
                <ErrorState
                  description="Could not load assignment history."
                  onRetry={() => void history.refetch()}
                />
              ) : (
                <ul className="mt-3 space-y-1 text-sm">
                  {history.data?.map((event) => (
                    <li key={event.id}>
                      {team.data?.find((member) => member.user.id === event.userId)?.user.name ??
                        event.userId}{' '}
                      · {event.action} · {event.role} ·{' '}
                      {new Date(event.occurredAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          ) : null}
        </>
      ) : (
        <EmptyState title="No projects available" />
      )}
      {isEngineer ? <MyProfile /> : null}
      <Modal
        open={confirmHandover}
        onClose={() => setConfirmHandover(false)}
        title="Confirm engineer handover"
      >
        <p className="text-sm text-muted">
          Transfer active responsibilities from{' '}
          {team.data?.find((member) => member.user.id === fromUserId)?.user.name ??
            'the source engineer'}{' '}
          to{' '}
          {team.data?.find((member) => member.user.id === toUserId)?.user.name ??
            'the replacement engineer'}
          ?{' '}
          {handoverOptions.removeSource
            ? 'The source engineer will also be removed from this project.'
            : 'The source engineer will remain a project member.'}
        </p>
        <p className="mt-2 text-sm">The transfer and audit record will be saved together.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmHandover(false)}>
            Cancel
          </Button>
          <Button
            isLoading={reassignment.isPending}
            onClick={() =>
              reassignment.mutate({
                fromUserId,
                toUserId,
                notes: handoverNotes,
                ...handoverOptions,
              })
            }
          >
            Confirm handover
          </Button>
        </div>
      </Modal>
    </section>
  );
}
