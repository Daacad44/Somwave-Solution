import { type FormEvent, type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { engineeringApi } from './api';
import { operationsApi } from './operationsApi';

const UPDATE_NEXT: Record<string, string[]> = {
  REQUESTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_DEVELOPMENT', 'CANCELLED'],
  IN_DEVELOPMENT: ['CODE_REVIEW', 'CANCELLED'],
  CODE_REVIEW: ['IN_DEVELOPMENT', 'TESTING'],
  TESTING: ['IN_DEVELOPMENT', 'STAGING'],
  STAGING: ['TESTING', 'PRODUCTION_APPROVAL'],
  PRODUCTION_APPROVAL: ['DEPLOYED'],
  DEPLOYED: ['VERIFIED'],
  VERIFIED: ['COMPLETED'],
};
const BUG_NEXT: Record<string, string[]> = {
  REPORTED: ['TRIAGED', 'ASSIGNED'],
  TRIAGED: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['CODE_REVIEW', 'TESTING', 'RESOLVED'],
  CODE_REVIEW: ['IN_PROGRESS', 'TESTING'],
  TESTING: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS'],
};
const MAINTENANCE_NEXT: Record<string, string[]> = {
  REQUESTED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
};
const RELEASE_NEXT: Record<string, string[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['IN_PROGRESS', 'CANCELLED'],
  DEPLOYED: ['VERIFIED', 'ROLLED_BACK'],
  VERIFIED: ['ROLLED_BACK'],
};
const UPDATE_CATEGORIES = [
  'NEW_FEATURE',
  'SECURITY_PATCH',
  'BUG_FIX',
  'PERFORMANCE_OPTIMIZATION',
  'UI_UX_UPDATE',
  'DATABASE_MIGRATION',
  'DEPENDENCY_UPGRADE',
  'INFRASTRUCTURE_CHANGE',
];
const MAINTENANCE_TYPES = [
  'PREVENTIVE',
  'CORRECTIVE',
  'EMERGENCY',
  'SCHEDULED',
  'SECURITY_PATCH',
  'HEALTH_CHECK',
  'INCIDENT',
];
const iso = (value: string) => (value ? new Date(value).toISOString() : undefined);

export function EngineeringOperationsPage(): ReactNode {
  const client = useQueryClient();
  const canManage = useHasPermission(PERMISSIONS.ENGINEERING_MANAGE);
  const [projectId, setProjectId] = useState('');
  const [systemId, setSystemId] = useState('');
  const [tab, setTab] = useState<'bugs' | 'maintenance' | 'updates' | 'releases'>('bugs');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('NEW_FEATURE');
  const [severity, setSeverity] = useState('MEDIUM');
  const [maintenanceType, setMaintenanceType] = useState('SCHEDULED');
  const [recurrenceRule, setRecurrenceRule] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [version, setVersion] = useState('');
  const [rollbackPlan, setRollbackPlan] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [releaseTaskId, setReleaseTaskId] = useState('');
  const [releasePullRequestId, setReleasePullRequestId] = useState('');
  const projects = useQuery({
    queryKey: ['engineering-projects'],
    queryFn: engineeringApi.projects,
  });
  const selectedProjectId = projectId || projects.data?.[0]?.id || '';
  const systems = useQuery({
    queryKey: ['engineering-systems', selectedProjectId],
    queryFn: () => engineeringApi.systems(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });
  const selectedSystemId = systemId || systems.data?.[0]?.id || '';
  const members = useQuery({
    queryKey: ['engineering-members', selectedProjectId],
    queryFn: () => engineeringApi.members(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });
  const bugs = useQuery({
    queryKey: ['operations-bugs', selectedSystemId],
    queryFn: () => operationsApi.bugs(selectedSystemId),
    enabled: Boolean(selectedSystemId && tab === 'bugs'),
  });
  const maintenance = useQuery({
    queryKey: ['operations-maintenance', selectedSystemId],
    queryFn: () => operationsApi.maintenance(selectedSystemId),
    enabled: Boolean(selectedSystemId && tab === 'maintenance'),
  });
  const updates = useQuery({
    queryKey: ['operations-updates', selectedSystemId],
    queryFn: () => operationsApi.updates(selectedSystemId),
    enabled: Boolean(selectedSystemId && tab === 'updates'),
  });
  const releases = useQuery({
    queryKey: ['operations-releases', selectedSystemId],
    queryFn: () => operationsApi.releases(selectedSystemId),
    enabled: Boolean(selectedSystemId && tab === 'releases'),
  });
  const tasks = useQuery({
    queryKey: ['engineering-tasks', selectedProjectId],
    queryFn: () => engineeringApi.tasks(selectedProjectId),
    enabled: Boolean(selectedProjectId && tab === 'releases'),
  });
  const pullRequests = useQuery({
    queryKey: ['operations-project-prs', selectedProjectId],
    queryFn: () => operationsApi.projectPullRequests(selectedProjectId),
    enabled: Boolean(selectedProjectId && tab === 'releases'),
  });
  const deployments = useQuery({
    queryKey: ['operations-deployments', selectedReleaseId],
    queryFn: () => operationsApi.deployments(selectedReleaseId),
    enabled: Boolean(selectedReleaseId),
  });
  const refresh = () => {
    for (const key of [
      'operations-bugs',
      'operations-maintenance',
      'operations-updates',
      'operations-releases',
      'operations-deployments',
      'engineering-metrics',
    ])
      void client.invalidateQueries({ queryKey: [key] });
  };
  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => {
      setMessage('Record updated.');
      setTitle('');
      setDescription('');
      setVersion('');
      setReleaseTaskId('');
      setReleasePullRequestId('');
      setNotes('');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const run = (work: () => Promise<unknown>) => action.mutate(work);
  const submit = (event: FormEvent, work: () => Promise<unknown>) => {
    event.preventDefault();
    run(work);
  };
  const engineers =
    members.data?.filter((member) =>
      ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER'].includes(member.role),
    ) ?? [];

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Engineering operations</h1>
        <p className="mt-1 text-sm text-muted">
          Manage bugs, maintenance, system updates and release records by project.
        </p>
      </header>
      {projects.isLoading ? (
        <LoadingState rows={3} />
      ) : projects.isError ? (
        <ErrorState
          description="Could not load projects."
          onRetry={() => void projects.refetch()}
        />
      ) : !projects.data?.length ? (
        <EmptyState title="No accessible projects" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Project
              <select
                className="mt-1 w-full rounded border border-border bg-surface p-3"
                value={selectedProjectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setSystemId('');
                }}
              >
                {projects.data.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Managed system
              <select
                className="mt-1 w-full rounded border border-border bg-surface p-3"
                value={selectedSystemId}
                onChange={(event) => setSystemId(event.target.value)}
              >
                {systems.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!selectedSystemId ? (
            <EmptyState title="Create a managed system in the Engineering Workspace" />
          ) : (
            <>
              <div
                className="flex flex-wrap gap-2"
                role="tablist"
                aria-label="Engineering operations"
              >
                {(['bugs', 'maintenance', 'updates', 'releases'] as const).map((value) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    key={value}
                    className={`rounded px-4 py-2 text-sm ${tab === value ? 'bg-primary text-surface' : 'bg-surface-alt text-ink'}`}
                    onClick={() => setTab(value)}
                  >
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
              {message ? (
                <p role="status" className="text-sm">
                  {message}
                </p>
              ) : null}
              {tab === 'bugs' ? (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold">Bug reports and SLA</h2>
                  {bugs.isLoading ? (
                    <LoadingState rows={3} />
                  ) : bugs.isError ? (
                    <ErrorState
                      description="Could not load bugs."
                      onRetry={() => void bugs.refetch()}
                    />
                  ) : bugs.data?.length ? (
                    <ul className="space-y-2">
                      {bugs.data.map((bug) => (
                        <li key={bug.id} className="rounded border border-border bg-surface p-4">
                          <div className="flex flex-wrap justify-between gap-2">
                            <strong>{bug.title}</strong>
                            <span className="text-sm">
                              {bug.severity} · {bug.status}
                            </span>
                          </div>
                          {bug.sla.responseOverdue || bug.sla.resolutionOverdue ? (
                            <p className="text-sm text-error">
                              SLA breached: {bug.sla.responseOverdue ? 'response ' : ''}
                              {bug.sla.resolutionOverdue ? 'resolution' : ''}
                            </p>
                          ) : null}
                          {bug.rootCause ? (
                            <p className="mt-2 text-sm">Root cause: {bug.rootCause}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {BUG_NEXT[bug.status]?.map((status) => (
                              <Button
                                key={status}
                                size="sm"
                                variant="secondary"
                                disabled={action.isPending}
                                onClick={() => {
                                  const selectedAssignee =
                                    status === 'ASSIGNED'
                                      ? window.prompt(
                                          'Engineer ID from the team list below',
                                          bug.assigneeId ?? '',
                                        )
                                      : undefined;
                                  const rootCause =
                                    status === 'RESOLVED'
                                      ? window.prompt('Root cause analysis (required)')
                                      : undefined;
                                  if (
                                    (status === 'ASSIGNED' && !selectedAssignee) ||
                                    (status === 'RESOLVED' && !rootCause)
                                  )
                                    return;
                                  run(() =>
                                    operationsApi.updateBug(
                                      bug.id,
                                      status,
                                      selectedAssignee ?? undefined,
                                      rootCause ?? undefined,
                                    ),
                                  );
                                }}
                              >
                                {status.replaceAll('_', ' ')}
                              </Button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState title="No bug reports" />
                  )}
                  <form
                    className="space-y-2 rounded border border-border bg-surface p-4"
                    onSubmit={(event) =>
                      submit(event, () =>
                        operationsApi.createBug(selectedSystemId, title, description, severity),
                      )
                    }
                  >
                    <h3 className="font-semibold">Report a bug</h3>
                    <Input
                      label="Title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                    />
                    <textarea
                      className="w-full rounded border border-border bg-surface p-3"
                      aria-label="Description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      required
                    />
                    <label className="text-sm">
                      Severity
                      <select
                        className="ml-2 rounded border border-border bg-surface p-2"
                        value={severity}
                        onChange={(event) => setSeverity(event.target.value)}
                      >
                        {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit" size="sm" isLoading={action.isPending}>
                      Report
                    </Button>
                  </form>
                </div>
              ) : null}
              {tab === 'maintenance' ? (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold">Maintenance and incidents</h2>
                  {maintenance.isLoading ? (
                    <LoadingState rows={3} />
                  ) : maintenance.isError ? (
                    <ErrorState
                      description="Could not load maintenance."
                      onRetry={() => void maintenance.refetch()}
                    />
                  ) : maintenance.data?.length ? (
                    <ul className="space-y-2">
                      {maintenance.data.map((row) => (
                        <li key={row.id} className="rounded border border-border bg-surface p-4">
                          <strong>{row.title}</strong>
                          <p className="text-sm text-muted">
                            {row.type} · {row.status}
                            {row.scheduledAt
                              ? ` · ${new Date(row.scheduledAt).toLocaleString()}`
                              : ''}
                          </p>
                          {row.sla.responseOverdue || row.sla.resolutionOverdue ? (
                            <p className="text-sm text-error">SLA breached</p>
                          ) : null}
                          {row.resolutionNotes ? (
                            <p className="text-sm">Resolution: {row.resolutionNotes}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {MAINTENANCE_NEXT[row.status]?.map((status) => (
                              <Button
                                key={status}
                                size="sm"
                                variant="secondary"
                                disabled={action.isPending}
                                onClick={() => {
                                  const resolutionNotes =
                                    status === 'COMPLETED'
                                      ? window.prompt('Resolution report (required)')
                                      : undefined;
                                  const scheduled =
                                    status === 'SCHEDULED' && !row.scheduledAt
                                      ? window.prompt('Scheduled ISO timestamp')
                                      : undefined;
                                  const engineer =
                                    status === 'IN_PROGRESS' && !row.assigneeId
                                      ? window.prompt('Engineer ID from the team list below')
                                      : undefined;
                                  if (
                                    (status === 'COMPLETED' && !resolutionNotes) ||
                                    (status === 'SCHEDULED' && !row.scheduledAt && !scheduled) ||
                                    (status === 'IN_PROGRESS' && !row.assigneeId && !engineer)
                                  )
                                    return;
                                  run(() =>
                                    operationsApi.updateMaintenance(row.id, status, {
                                      ...(resolutionNotes ? { resolutionNotes } : {}),
                                      ...(scheduled ? { scheduledAt: scheduled } : {}),
                                      ...(engineer ? { assigneeId: engineer } : {}),
                                    }),
                                  );
                                }}
                              >
                                {status.replaceAll('_', ' ')}
                              </Button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState title="No maintenance requests" />
                  )}
                  {canManage ? (
                    <form
                      className="space-y-2 rounded border border-border bg-surface p-4"
                      onSubmit={(event) =>
                        submit(event, () =>
                          operationsApi.createMaintenance(
                            selectedSystemId,
                            title,
                            maintenanceType,
                            iso(scheduledAt),
                            assigneeId || undefined,
                            recurrenceRule || undefined,
                          ),
                        )
                      }
                    >
                      <h3 className="font-semibold">Schedule maintenance</h3>
                      <Input
                        label="Title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                      />
                      <label className="text-sm">
                        Type
                        <select
                          className="ml-2 rounded border border-border bg-surface p-2"
                          value={maintenanceType}
                          onChange={(event) => setMaintenanceType(event.target.value)}
                        >
                          {MAINTENANCE_TYPES.map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                      <Input
                        label="Scheduled time"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(event) => setScheduledAt(event.target.value)}
                      />
                      <label className="block text-sm">
                        Repeat
                        <select
                          className="mt-1 w-full rounded border border-border bg-surface p-2"
                          value={recurrenceRule}
                          onChange={(event) => setRecurrenceRule(event.target.value)}
                        >
                          <option value="">One time</option>
                          <option value="FREQ=DAILY">Daily</option>
                          <option value="FREQ=WEEKLY">Weekly</option>
                          <option value="FREQ=MONTHLY">Monthly</option>
                        </select>
                      </label>
                      <label className="text-sm">
                        Engineer
                        <select
                          className="ml-2 rounded border border-border bg-surface p-2"
                          value={assigneeId}
                          onChange={(event) => setAssigneeId(event.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {engineers.map((member) => (
                            <option key={member.user.id} value={member.user.id}>
                              {member.user.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button type="submit" size="sm" isLoading={action.isPending}>
                        Create request
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}
              {tab === 'updates' ? (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold">System updates</h2>
                  {updates.isLoading ? (
                    <LoadingState rows={3} />
                  ) : updates.isError ? (
                    <ErrorState
                      description="Could not load updates."
                      onRetry={() => void updates.refetch()}
                    />
                  ) : updates.data?.length ? (
                    <ul className="space-y-2">
                      {updates.data.map((row) => (
                        <li key={row.id} className="rounded border border-border bg-surface p-4">
                          <strong>{row.title}</strong>
                          <p className="text-sm text-muted">
                            {row.category} · {row.status.replaceAll('_', ' ')}
                          </p>
                          {row.productionApprovedAt ? (
                            <p className="text-sm">
                              Production approved{' '}
                              {new Date(row.productionApprovedAt).toLocaleString()}
                            </p>
                          ) : null}
                          {canManage ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {row.status === 'PRODUCTION_APPROVAL' && !row.productionApprovedAt ? (
                                <Button
                                  size="sm"
                                  onClick={() => run(() => operationsApi.approveProduction(row.id))}
                                >
                                  Approve production
                                </Button>
                              ) : null}
                              {UPDATE_NEXT[row.status]?.map((status) => (
                                <Button
                                  key={status}
                                  size="sm"
                                  variant="secondary"
                                  disabled={
                                    action.isPending ||
                                    (status === 'DEPLOYED' && !row.productionApprovedAt)
                                  }
                                  onClick={() =>
                                    run(() => operationsApi.transitionUpdate(row.id, status))
                                  }
                                >
                                  {status.replaceAll('_', ' ')}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState title="No system updates" />
                  )}
                  {canManage ? (
                    <form
                      className="space-y-2 rounded border border-border bg-surface p-4"
                      onSubmit={(event) =>
                        submit(event, () =>
                          operationsApi.createUpdate(selectedSystemId, title, category),
                        )
                      }
                    >
                      <h3 className="font-semibold">Request an update</h3>
                      <Input
                        label="Title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                      />
                      <label className="text-sm">
                        Category
                        <select
                          className="ml-2 rounded border border-border bg-surface p-2"
                          value={category}
                          onChange={(event) => setCategory(event.target.value)}
                        >
                          {UPDATE_CATEGORIES.map((value) => (
                            <option key={value}>{value.replaceAll('_', ' ')}</option>
                          ))}
                        </select>
                      </label>
                      <Button type="submit" size="sm" isLoading={action.isPending}>
                        Create update
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}
              {tab === 'releases' ? (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold">Releases and deployment history</h2>
                  {releases.isLoading ? (
                    <LoadingState rows={3} />
                  ) : releases.isError ? (
                    <ErrorState
                      description="Could not load releases."
                      onRetry={() => void releases.refetch()}
                    />
                  ) : releases.data?.length ? (
                    <ul className="space-y-2">
                      {releases.data.map((row) => (
                        <li key={row.id} className="rounded border border-border bg-surface p-4">
                          <strong>Version {row.version}</strong>
                          <p className="text-sm text-muted">
                            {row.status.replaceAll('_', ' ')}
                            {row.approvedAt
                              ? ` · approved ${new Date(row.approvedAt).toLocaleString()}`
                              : ''}
                          </p>
                          {row.notes ? <p className="text-sm">Release notes: {row.notes}</p> : null}
                          {row.rollbackPlan ? (
                            <details className="text-sm">
                              <summary className="cursor-pointer">Rollback plan</summary>
                              {row.rollbackPlan}
                            </details>
                          ) : null}
                          <ul className="mt-2 space-y-1 text-sm">
                            {row.taskLinks.map((link) => (
                              <li key={link.taskId}>
                                Task: {link.task.title}{' '}
                                {canManage ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                      run(() =>
                                        operationsApi.unlinkReleaseTask(row.id, link.taskId),
                                      )
                                    }
                                  >
                                    Unlink
                                  </Button>
                                ) : null}
                                {link.task.githubLinks.map((pr) => (
                                  <a
                                    key={pr.id}
                                    className="ml-2 text-brand underline"
                                    href={pr.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    PR: {pr.title ?? pr.url} ({pr.state ?? 'unknown'})
                                  </a>
                                ))}
                              </li>
                            ))}
                          </ul>
                          <ul className="mt-2 space-y-1 text-sm">
                            {row.pullRequestLinks.map((entry) => (
                              <li key={entry.githubTaskLinkId}>
                                Release PR:{' '}
                                <a
                                  className="text-brand underline"
                                  href={entry.githubTaskLink.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {entry.githubTaskLink.repository.fullName}#
                                  {entry.githubTaskLink.number ?? '?'} ·{' '}
                                  {entry.githubTaskLink.title ?? 'Pull request'}
                                </a>
                                {canManage ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                      run(() =>
                                        operationsApi.unlinkReleasePullRequest(
                                          row.id,
                                          entry.githubTaskLinkId,
                                        ),
                                      )
                                    }
                                  >
                                    Unlink PR
                                  </Button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          {canManage ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <select
                                aria-label={`Task for release ${row.version}`}
                                className="rounded border border-border bg-surface p-2 text-sm"
                                value={releaseTaskId}
                                onChange={(event) => setReleaseTaskId(event.target.value)}
                              >
                                <option value="">Select task</option>
                                {tasks.data
                                  ?.filter(
                                    (task) =>
                                      !row.taskLinks.some((link) => link.taskId === task.id),
                                  )
                                  .map((task) => (
                                    <option key={task.id} value={task.id}>
                                      {task.title}
                                    </option>
                                  ))}
                              </select>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={!releaseTaskId}
                                onClick={() =>
                                  run(() => operationsApi.linkReleaseTask(row.id, releaseTaskId))
                                }
                              >
                                Link task
                              </Button>
                            </div>
                          ) : null}
                          {canManage ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <select
                                aria-label={`Pull request for release ${row.version}`}
                                className="rounded border border-border bg-surface p-2 text-sm"
                                value={releasePullRequestId}
                                onChange={(event) => setReleasePullRequestId(event.target.value)}
                              >
                                <option value="">Select project PR</option>
                                {pullRequests.data
                                  ?.filter(
                                    (pr) =>
                                      !row.pullRequestLinks.some(
                                        (entry) => entry.githubTaskLinkId === pr.id,
                                      ),
                                  )
                                  .map((pr) => (
                                    <option key={pr.id} value={pr.id}>
                                      {pr.repository.fullName}#{pr.number ?? '?'} ·{' '}
                                      {pr.title ?? 'Pull request'}
                                    </option>
                                  ))}
                              </select>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={!releasePullRequestId}
                                onClick={() =>
                                  run(() =>
                                    operationsApi.linkReleasePullRequest(
                                      row.id,
                                      releasePullRequestId,
                                    ),
                                  )
                                }
                              >
                                Link PR
                              </Button>
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {canManage ? (
                              <>
                                {row.status === 'PENDING_APPROVAL' ? (
                                  <Button
                                    size="sm"
                                    onClick={() => run(() => operationsApi.approveRelease(row.id))}
                                  >
                                    Approve release
                                  </Button>
                                ) : null}
                                {RELEASE_NEXT[row.status]?.map((status) => (
                                  <Button
                                    key={status}
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                      run(() => operationsApi.transitionRelease(row.id, status))
                                    }
                                  >
                                    {status.replaceAll('_', ' ')}
                                  </Button>
                                ))}
                                {row.status === 'APPROVED' || row.status === 'DEPLOYED' ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      const environment = window.prompt(
                                        'Environment: STAGING or PRODUCTION',
                                        'STAGING',
                                      );
                                      const outcome = window.prompt(
                                        'Result: SUCCEEDED, FAILED, or ROLLED_BACK',
                                        'SUCCEEDED',
                                      );
                                      const log = window.prompt('Deployment log or evidence') ?? '';
                                      if (
                                        !environment ||
                                        !outcome ||
                                        !['STAGING', 'PRODUCTION'].includes(environment) ||
                                        !['SUCCEEDED', 'FAILED', 'ROLLED_BACK'].includes(outcome)
                                      )
                                        return;
                                      if (
                                        environment === 'PRODUCTION' &&
                                        !window.confirm(
                                          'Record a completed external production deployment? This does not deploy code.',
                                        )
                                      )
                                        return;
                                      run(() =>
                                        operationsApi.recordDeployment(
                                          row.id,
                                          environment as 'STAGING' | 'PRODUCTION',
                                          outcome as 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK',
                                          log,
                                        ),
                                      );
                                    }}
                                  >
                                    Record deployment
                                  </Button>
                                ) : null}
                              </>
                            ) : null}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setSelectedReleaseId(selectedReleaseId === row.id ? '' : row.id)
                              }
                            >
                              History
                            </Button>
                          </div>
                          {selectedReleaseId === row.id ? (
                            <div className="mt-3 text-sm">
                              {deployments.isLoading ? (
                                <LoadingState rows={2} />
                              ) : deployments.data?.length ? (
                                <ul>
                                  {deployments.data.map((deployment) => (
                                    <li key={deployment.id}>
                                      {deployment.environment} · {deployment.status} ·{' '}
                                      {new Date(deployment.createdAt).toLocaleString()}{' '}
                                      {deployment.notes}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p>No deployment records.</p>
                              )}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState title="No releases" />
                  )}
                  {canManage ? (
                    <form
                      className="space-y-2 rounded border border-border bg-surface p-4"
                      onSubmit={(event) =>
                        submit(event, () =>
                          operationsApi.createRelease(
                            selectedSystemId,
                            version,
                            notes,
                            rollbackPlan,
                          ),
                        )
                      }
                    >
                      <h3 className="font-semibold">Plan a release</h3>
                      <Input
                        label="Version"
                        value={version}
                        onChange={(event) => setVersion(event.target.value)}
                        required
                      />
                      <label className="block text-sm">
                        Release notes
                        <textarea
                          className="mt-1 w-full rounded border border-border bg-surface p-3"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                        />
                      </label>
                      <label className="block text-sm">
                        Rollback plan
                        <textarea
                          className="mt-1 w-full rounded border border-border bg-surface p-3"
                          value={rollbackPlan}
                          onChange={(event) => setRollbackPlan(event.target.value)}
                          required
                        />
                      </label>
                      <Button type="submit" size="sm" isLoading={action.isPending}>
                        Plan release
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </section>
  );
}
