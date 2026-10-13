import { type FormEvent, type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS, UPLOAD_MAX_BYTES } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { engineeringApi } from './api';
import { useCurrentUser } from '../auth/hooks';
import { EngineerWorklog } from './EngineerWorklog';

const DOCUMENT_CATEGORIES = [
  'Project Overview',
  'Project Scope',
  'Business Requirements',
  'Software Requirements',
  'Functional Requirements',
  'Non-Functional Requirements',
  'System Architecture',
  'Database Schema',
  'API Documentation',
  'UI/UX Specifications',
  'Development Plan',
  'Testing Plan',
  'Deployment Instructions',
  'Maintenance',
  'Change Log',
  'Handover',
];

function MyInvitations(): ReactNode {
  const client = useQueryClient();
  const invitations = useQuery({
    queryKey: ['my-project-invitations'],
    queryFn: engineeringApi.myInvitations,
  });
  const [message, setMessage] = useState('');
  const respond = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'ACCEPT' | 'DECLINE' }) =>
      engineeringApi.respondInvitation(id, decision),
    onSuccess: (result) => {
      setMessage(
        result.status === 'ACCEPTED' ? 'Project invitation accepted.' : 'Invitation declined.',
      );
      void client.invalidateQueries({ queryKey: ['my-project-invitations'] });
      void client.invalidateQueries({ queryKey: ['engineering-projects'] });
      void client.invalidateQueries({ queryKey: ['engineering-metrics'] });
      void client.invalidateQueries({ queryKey: ['engineering-team-overview'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  if (invitations.isLoading) return <LoadingState rows={1} />;
  if (invitations.isError)
    return (
      <ErrorState
        description="Could not load project invitations."
        onRetry={() => void invitations.refetch()}
      />
    );
  if (!invitations.data?.length && !message) return null;
  return (
    <section
      className="rounded-lg border border-border bg-surface p-4"
      aria-label="Project invitations"
    >
      <h2 className="text-lg font-semibold">Project invitations</h2>
      {message ? (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {invitations.data?.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-alt p-3"
          >
            <span>
              <strong>{invitation.project.name}</strong> · {invitation.role.replaceAll('_', ' ')}
              <span className="mt-1 block text-sm text-muted">
                {invitation.project.description || 'No project summary provided.'}
              </span>
              <span className="mt-1 block text-sm">
                Assignment: {invitation.description || '—'}
              </span>
              <span className="mt-1 block text-sm">
                Responsibilities: {invitation.responsibilities || '—'}
              </span>
              <span className="mt-1 block text-sm">
                Manager: {invitation.project.manager?.name || 'Not assigned'} · Deadline:{' '}
                {invitation.project.dueDate
                  ? new Date(invitation.project.dueDate).toLocaleDateString()
                  : 'Not set'}
              </span>
              <span className="mt-1 block text-sm">
                Expected workload:{' '}
                {invitation.estimatedHours == null
                  ? 'Not set'
                  : `${Number(invitation.estimatedHours)} hours`}{' '}
                · Priority: {invitation.priority?.replaceAll('_', ' ') || 'Medium'}
              </span>
              {invitation.managerNotes ? (
                <span className="mt-1 block text-sm">Manager notes: {invitation.managerNotes}</span>
              ) : null}
              {invitation.expiresAt ? (
                <span className="mt-1 block text-xs text-muted">
                  Respond by {new Date(invitation.expiresAt).toLocaleString()}
                </span>
              ) : null}
            </span>
            <span className="flex gap-2">
              <Button
                size="sm"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ id: invitation.id, decision: 'ACCEPT' })}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ id: invitation.id, decision: 'DECLINE' })}
              >
                Decline
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EngineeringWorkspacePage(): ReactNode {
  const client = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [projectId, setProjectId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [documentCategory, setDocumentCategory] = useState(
    DOCUMENT_CATEGORIES[0] ?? 'Project Overview',
  );
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingDocument, setEditingDocument] = useState<{
    id: string;
    version: number;
    content: string;
  } | null>(null);
  const [historyDocumentId, setHistoryDocumentId] = useState('');
  const [message, setMessage] = useState('');
  const [systemId, setSystemId] = useState('');
  const [systemName, setSystemName] = useState('');
  const [systemProductionUrl, setSystemProductionUrl] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('ENGINEER');
  const [newMemberResponsibilities, setNewMemberResponsibilities] = useState('');
  const [newMemberDescription, setNewMemberDescription] = useState('');
  const [newMemberStartDate, setNewMemberStartDate] = useState('');
  const [newMemberEndDate, setNewMemberEndDate] = useState('');
  const [newMemberHours, setNewMemberHours] = useState(40);
  const [newMemberPriority, setNewMemberPriority] = useState('MEDIUM');
  const [newMemberNotes, setNewMemberNotes] = useState('');
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugRootCauses, setBugRootCauses] = useState<Record<string, string>>({});
  const canCreateTask = useHasPermission(PERMISSIONS.ENGINEERING_TASK_CREATE);
  const canReviewTask = useHasPermission(PERMISSIONS.ENGINEERING_TASK_REVIEW);
  const canManage = useHasPermission(PERMISSIONS.ENGINEERING_MANAGE);

  const projects = useQuery({
    queryKey: ['engineering-projects'],
    queryFn: engineeringApi.projects,
  });
  const metrics = useQuery({
    queryKey: ['engineering-metrics'],
    queryFn: engineeringApi.metrics,
  });
  const selectedId = projectId || projects.data?.[0]?.id || '';
  const tasks = useQuery({
    queryKey: ['engineering-tasks', selectedId],
    queryFn: () => engineeringApi.tasks(selectedId),
    enabled: Boolean(selectedId),
  });
  const members = useQuery({
    queryKey: ['engineering-members', selectedId],
    queryFn: () => engineeringApi.members(selectedId),
    enabled: Boolean(selectedId),
  });
  const eligibleEngineers = useQuery({
    queryKey: ['engineering-eligible-engineers', selectedId],
    queryFn: () => engineeringApi.eligibleEngineers(selectedId),
    enabled: Boolean(selectedId && canManage),
  });
  const selectedCandidate = eligibleEngineers.data?.find(
    (engineer) => engineer.email.toLowerCase() === newMemberEmail.trim().toLowerCase(),
  );
  const pendingInvitations = useQuery({
    queryKey: ['engineering-invitations', selectedId],
    queryFn: () => engineeringApi.projectInvitations(selectedId),
    enabled: Boolean(selectedId && canManage),
  });
  const documents = useQuery({
    queryKey: ['engineering-documents', selectedId],
    queryFn: () => engineeringApi.documents(selectedId),
    enabled: Boolean(selectedId),
  });
  const documentHistory = useQuery({
    queryKey: ['engineering-document-history', selectedId, historyDocumentId],
    queryFn: () => engineeringApi.documentVersions(selectedId, historyDocumentId),
    enabled: Boolean(selectedId && historyDocumentId),
  });
  const systems = useQuery({
    queryKey: ['engineering-systems', selectedId],
    queryFn: () => engineeringApi.systems(selectedId),
    enabled: Boolean(selectedId),
  });
  const selectedSystemId = systemId || systems.data?.[0]?.id || '';
  const bugs = useQuery({
    queryKey: ['engineering-bugs', selectedSystemId],
    queryFn: () => engineeringApi.bugs(selectedSystemId),
    enabled: Boolean(selectedSystemId),
  });
  const updates = useQuery({
    queryKey: ['engineering-updates', selectedSystemId],
    queryFn: () => engineeringApi.updates(selectedSystemId),
    enabled: Boolean(selectedSystemId),
  });
  const releases = useQuery({
    queryKey: ['engineering-releases', selectedSystemId],
    queryFn: () => engineeringApi.releases(selectedSystemId),
    enabled: Boolean(selectedSystemId),
  });

  const refresh = (): void => {
    void client.invalidateQueries({ queryKey: ['engineering-tasks', selectedId] });
    void client.invalidateQueries({ queryKey: ['engineering-documents', selectedId] });
    void client.invalidateQueries({ queryKey: ['engineering-metrics'] });
  };
  const taskAction = useMutation({
    mutationFn: async (
      action:
        | { kind: 'create'; title: string; description: string }
        | { kind: 'status'; id: string; status: string }
        | { kind: 'submit' | 'approve'; id: string },
    ) => {
      if (action.kind === 'create')
        return engineeringApi.createTask(selectedId, {
          title: action.title,
          description: action.description,
          type: 'FEATURE',
          priority: 'MEDIUM',
        });
      if (action.kind === 'submit') return engineeringApi.submitTask(action.id);
      if (action.kind === 'status')
        return engineeringApi.updateTaskStatus(action.id, action.status);
      return engineeringApi.reviewTask(action.id, 'APPROVE');
    },
    onSuccess: () => {
      setMessage('Task updated.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const documentAction = useMutation({
    mutationFn: async (
      action:
        | { kind: 'create'; title: string; content: string; category: string }
        | { kind: 'upload'; title: string; category: string; file: File }
        | { kind: 'edit'; id: string; version: number; content: string }
        | { kind: 'review' | 'approve'; id: string; version: number },
    ) => {
      if (action.kind === 'create')
        return engineeringApi.createDocument(
          selectedId,
          action.title,
          action.content,
          action.category,
        );
      if (action.kind === 'upload') {
        if (action.file.size > UPLOAD_MAX_BYTES) throw new Error('The maximum file size is 25 MB.');
        const contentBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
          reader.onerror = () => reject(new Error('Could not read the selected file.'));
          reader.readAsDataURL(action.file);
        });
        return engineeringApi.uploadDocument(
          selectedId,
          action.title,
          action.category,
          action.file,
          contentBase64,
          setUploadProgress,
        );
      }
      if (action.kind === 'edit')
        return engineeringApi.updateDocument(selectedId, action.id, action.version, action.content);
      return engineeringApi.setDocumentStatus(
        selectedId,
        action.id,
        action.version,
        action.kind === 'review' ? 'IN_REVIEW' : 'APPROVED',
      );
    },
    onSuccess: (_result, action) => {
      setMessage('Documentation updated.');
      setEditingDocument(null);
      if (action.kind === 'create' || action.kind === 'upload') {
        setDocumentTitle('');
        setDocumentContent('');
        setDocumentFile(null);
      }
      setUploadProgress(0);
      refresh();
      if (historyDocumentId)
        void client.invalidateQueries({
          queryKey: ['engineering-document-history', selectedId, historyDocumentId],
        });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const systemAction = useMutation({
    mutationFn: (name: string) =>
      engineeringApi.createSystem(selectedId, name, systemProductionUrl),
    onSuccess: () => {
      setSystemName('');
      setSystemProductionUrl('');
      setMessage('System added.');
      void client.invalidateQueries({ queryKey: ['engineering-systems', selectedId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const memberAction = useMutation({
    mutationFn: (userId: string) => engineeringApi.removeMember(selectedId, userId),
    onSuccess: () => {
      setMessage('Project team updated.');
      void client.invalidateQueries({ queryKey: ['engineering-members', selectedId] });
      void client.invalidateQueries({ queryKey: ['engineering-metrics'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const inviteAction = useMutation({
    mutationFn: () =>
      engineeringApi.inviteEngineer(selectedId, {
        email: newMemberEmail,
        ...(newMemberName ? { name: newMemberName } : {}),
        role: newMemberRole,
        description: newMemberDescription,
        responsibilities: newMemberResponsibilities,
        startDate: new Date(newMemberStartDate).toISOString(),
        expectedEndDate: new Date(newMemberEndDate).toISOString(),
        estimatedHours: newMemberHours,
        priority: newMemberPriority,
        managerNotes: newMemberNotes,
      }),
    onSuccess: () => {
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberResponsibilities('');
      setNewMemberDescription('');
      setNewMemberStartDate('');
      setNewMemberEndDate('');
      setNewMemberNotes('');
      setMessage('Invitation queued for email. Project access begins after acceptance.');
      void client.invalidateQueries({ queryKey: ['engineering-invitations', selectedId] });
      void client.invalidateQueries({ queryKey: ['engineering-team-overview'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const bugAction = useMutation({
    mutationFn: () => engineeringApi.createBug(selectedSystemId, bugTitle, bugDescription),
    onSuccess: () => {
      setBugTitle('');
      setBugDescription('');
      setMessage('Bug report submitted.');
      void client.invalidateQueries({ queryKey: ['engineering-bugs', selectedSystemId] });
      void client.invalidateQueries({ queryKey: ['engineering-metrics'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const bugUpdate = useMutation({
    mutationFn: ({
      id,
      status,
      assigneeId,
      rootCause,
    }: {
      id: string;
      status: 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED';
      assigneeId?: string;
      rootCause?: string;
    }) => engineeringApi.updateBug(id, status, assigneeId, rootCause),
    onSuccess: () => {
      setMessage('Bug report updated.');
      void client.invalidateQueries({ queryKey: ['engineering-bugs', selectedSystemId] });
      void client.invalidateQueries({ queryKey: ['engineering-metrics'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  if (projects.isLoading) return <LoadingState rows={5} />;
  if (projects.isError) return <ErrorState onRetry={() => void projects.refetch()} />;
  if (!projects.data?.length)
    return (
      <section className="space-y-4">
        <MyInvitations />
        <EmptyState
          title="No assigned projects"
          description="Accept a project invitation or ask a manager to invite you."
        />
      </section>
    );

  const createTask = (event: FormEvent): void => {
    event.preventDefault();
    taskAction.mutate({ kind: 'create', title: taskTitle, description: taskDescription });
    setTaskTitle('');
    setTaskDescription('');
  };
  const createDocument = (event: FormEvent): void => {
    event.preventDefault();
    if (documentFile)
      documentAction.mutate({
        kind: 'upload',
        title: documentTitle,
        category: documentCategory,
        file: documentFile,
      });
    else
      documentAction.mutate({
        kind: 'create',
        title: documentTitle,
        content: documentContent,
        category: documentCategory,
      });
  };
  const myTasks = (tasks.data ?? []).filter((task) => task.assigneeId === currentUser?.id);
  const today = new Date().toISOString().slice(0, 10);
  const engineerKpis: Array<[string, number]> = [
    ['My projects', projects.data.length],
    ['My tasks in this project', myTasks.length],
    [
      'Due today',
      myTasks.filter((task) => task.dueDate?.slice(0, 10) === today && task.status !== 'DONE')
        .length,
    ],
    ['In progress', myTasks.filter((task) => task.status === 'IN_PROGRESS').length],
    [
      'Overdue',
      myTasks.filter(
        (task) =>
          task.dueDate &&
          task.dueDate.slice(0, 10) < today &&
          !['DONE', 'CANCELLED'].includes(task.status),
      ).length,
    ],
    ['Completed', myTasks.filter((task) => task.status === 'DONE').length],
    [
      'Pending review',
      myTasks.filter(
        (task) =>
          ['SUBMITTED', 'UNDER_REVIEW'].includes(task.approvalStatus) ||
          task.status === 'IN_REVIEW',
      ).length,
    ],
    [
      'Reported blockers',
      myTasks.filter((task) => task.status === 'BLOCKED' || Boolean(task.blockedReason)).length,
    ],
  ];

  return (
    <section className="space-y-8">
      <MyInvitations />
      <div>
        <h1 className="text-2xl font-semibold text-ink">Engineering Workspace</h1>
        <p className="mt-1 text-muted">
          Projects, team, tasks, and approved documentation you can access.
        </p>
      </div>
      <label className="block text-sm font-medium text-ink" htmlFor="engineering-project">
        Project
      </label>
      <select
        id="engineering-project"
        className="h-11 w-full rounded-md border border-border bg-surface px-3"
        value={selectedId}
        onChange={(event) => {
          setProjectId(event.target.value);
          setSystemId('');
        }}
      >
        {projects.data.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      {message ? (
        <p role="status" className="text-sm text-ink">
          {message}
        </p>
      ) : null}
      {currentUser?.roles.some((role) =>
        ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER'].includes(role),
      ) && tasks.data ? (
        <section aria-label="My engineering overview" className="space-y-3">
          <h2 className="text-xl font-semibold">My engineering overview</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {engineerKpis.map(([name, count]) => (
              <div key={name} className="rounded-md border border-border bg-surface p-3">
                <p className="text-sm text-muted">{name}</p>
                <p className="text-2xl font-semibold">{count}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {metrics.data ? (
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {(
            [
              ['Total projects', metrics.data.totalProjects],
              ['Active projects', metrics.data.activeProjects],
              ['Completed projects', metrics.data.completedProjects],
              ['Active engineers', metrics.data.activeEngineers],
              ['Tasks in progress', metrics.data.tasksInProgress],
              ['Completed tasks', metrics.data.completedTasks],
              ['Overdue tasks', metrics.data.overdueTasks],
              ['Pending reviews', metrics.data.pendingReviews],
              ['Open bugs', metrics.data.openBugs],
              ['Critical bugs', metrics.data.criticalBugs],
              ['Scheduled maintenance', metrics.data.scheduledMaintenance],
              ['Upcoming releases', metrics.data.upcomingReleases],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-surface p-4">
              <p className="text-sm text-muted">{label}</p>
              <p className="text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : metrics.isError ? (
        <ErrorState onRetry={() => void metrics.refetch()} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-sm text-muted">Tasks</p>
          <p className="text-2xl font-semibold">{tasks.data?.length ?? '—'}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-sm text-muted">Team members</p>
          <p className="text-2xl font-semibold">{members.data?.length ?? '—'}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-sm text-muted">Documents</p>
          <p className="text-2xl font-semibold">{documents.data?.length ?? '—'}</p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-xl font-semibold">Project team</h2>
        {members.data?.length ? (
          <ul className="mt-3 space-y-2">
            {members.data.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  <strong>{member.user.name}</strong> · {member.role.replaceAll('_', ' ')} ·{' '}
                  {member.user.email}
                </span>
                {canManage && member.role !== 'MANAGER' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={memberAction.isPending}
                    onClick={() => memberAction.mutate(member.user.id)}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : members.isLoading ? (
          <LoadingState rows={2} />
        ) : (
          <p className="mt-2 text-sm text-muted">No team members assigned.</p>
        )}
        {canManage && pendingInvitations.isError ? (
          <ErrorState
            description="Could not load pending invitations."
            onRetry={() => void pendingInvitations.refetch()}
          />
        ) : null}
        {canManage && pendingInvitations.data?.length ? (
          <div className="mt-4">
            <h3 className="font-medium">Assignment invitations</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {pendingInvitations.data.map((invitation) => (
                <li key={invitation.id} className="flex items-center justify-between gap-2">
                  <span>
                    {invitation.user.name} · {invitation.user.email} ·{' '}
                    {invitation.role.replaceAll('_', ' ')} ·{' '}
                    {invitation.status.replaceAll('_', ' ')}
                    {invitation.expiresAt
                      ? ` · Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`
                      : ''}
                  </span>
                  {invitation.status === 'PENDING' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void engineeringApi
                          .cancelInvitation(selectedId, invitation.id)
                          .then(() => {
                            void client.invalidateQueries({
                              queryKey: ['engineering-invitations', selectedId],
                            });
                          })
                          .catch((error: Error) => setMessage(error.message));
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {canManage ? (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (newMemberEmail) inviteAction.mutate();
            }}
          >
            {eligibleEngineers.isError ? (
              <div className="sm:col-span-2">
                <ErrorState
                  description="Could not load eligible engineers."
                  onRetry={() => void eligibleEngineers.refetch()}
                />
              </div>
            ) : null}
            <div>
              <Input
                label="Engineer email"
                type="email"
                required
                list="eligible-engineer-emails"
                value={newMemberEmail}
                onChange={(event) => setNewMemberEmail(event.target.value)}
              />
              <datalist id="eligible-engineer-emails">
                {eligibleEngineers.data
                  ?.filter((user) => !members.data?.some((member) => member.user.id === user.id))
                  .map((user) => (
                    <option key={user.id} value={user.email}>
                      {user.name}
                    </option>
                  ))}
              </datalist>
              {selectedCandidate ? (
                <p
                  className={`mt-2 text-sm ${selectedCandidate.overCapacity || selectedCandidate.nearCapacity ? 'text-warning' : 'text-muted'}`}
                  role={
                    selectedCandidate.overCapacity || selectedCandidate.nearCapacity
                      ? 'status'
                      : undefined
                  }
                >
                  {selectedCandidate.overCapacity
                    ? 'Capacity warning: this engineer is already over capacity this week.'
                    : selectedCandidate.nearCapacity
                      ? 'Capacity warning: this engineer is near capacity this week.'
                      : 'Current week capacity:'}{' '}
                  {Number(selectedCandidate.estimatedHoursThisWeek).toFixed(1)} of{' '}
                  {Number(selectedCandidate.availableHoursThisWeek).toFixed(1)} available hours
                  committed. Review the workload before sending; managers may still make an informed
                  assignment.
                </p>
              ) : null}
            </div>
            <Input
              label="Engineer name (required for a new account)"
              value={newMemberName}
              onChange={(event) => setNewMemberName(event.target.value)}
            />
            <label className="text-sm font-medium">
              Project role
              <select
                className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3"
                value={newMemberRole}
                onChange={(event) => setNewMemberRole(event.target.value)}
              >
                {['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER', 'REVIEWER', 'CONTRIBUTOR'].map(
                  (role) => (
                    <option key={role} value={role}>
                      {role.replaceAll('_', ' ')}
                    </option>
                  ),
                )}
              </select>
            </label>
            <Input
              label="Responsibilities"
              value={newMemberResponsibilities}
              onChange={(event) => setNewMemberResponsibilities(event.target.value)}
            />
            <Input
              label="Assignment description"
              required
              maxLength={2000}
              value={newMemberDescription}
              onChange={(event) => setNewMemberDescription(event.target.value)}
            />
            <Input
              label="Start date"
              type="date"
              required
              value={newMemberStartDate}
              onChange={(event) => setNewMemberStartDate(event.target.value)}
            />
            <Input
              label="Expected end date"
              type="date"
              required
              min={newMemberStartDate}
              value={newMemberEndDate}
              onChange={(event) => setNewMemberEndDate(event.target.value)}
            />
            <Input
              label="Estimated workload (hours)"
              type="number"
              min={0.5}
              max={10000}
              step={0.5}
              required
              value={newMemberHours}
              onChange={(event) => setNewMemberHours(Number(event.target.value))}
            />
            <label className="text-sm font-medium">
              Priority
              <select
                className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3"
                value={newMemberPriority}
                onChange={(event) => setNewMemberPriority(event.target.value)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
            <Input
              label="Manager notes (optional)"
              maxLength={2000}
              value={newMemberNotes}
              onChange={(event) => setNewMemberNotes(event.target.value)}
            />
            <div className="flex items-end">
              <Button type="submit" disabled={inviteAction.isPending || !newMemberEmail}>
                Invite engineer
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Project tasks</h2>
          {tasks.isLoading ? (
            <LoadingState rows={3} />
          ) : tasks.isError ? (
            <ErrorState onRetry={() => void tasks.refetch()} />
          ) : tasks.data?.length ? (
            <ul className="space-y-2">
              {tasks.data.map((task) => (
                <li key={task.id} className="rounded-md border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{task.title}</strong>
                    <span className="text-sm text-muted">
                      {task.approvalStatus.replaceAll('_', ' ')}
                    </span>
                  </div>
                  {task.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm">{task.description}</p>
                  ) : null}
                  {task.approvalStatus === 'APPROVED' && task.assigneeId === currentUser?.id ? (
                    <select
                      aria-label={`Progress for ${task.title}`}
                      className="mt-3 h-10 rounded-md border border-border bg-surface px-2"
                      value={task.status}
                      disabled={taskAction.isPending}
                      onChange={(event) =>
                        taskAction.mutate({
                          kind: 'status',
                          id: task.id,
                          status: event.target.value,
                        })
                      }
                    >
                      {[
                        'BACKLOG',
                        'TODO',
                        'IN_PROGRESS',
                        'BLOCKED',
                        'IN_REVIEW',
                        'TESTING',
                        'DONE',
                        'CANCELLED',
                      ].map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    {task.approvalStatus === 'DRAFT' && canCreateTask ? (
                      <Button
                        size="sm"
                        onClick={() => taskAction.mutate({ kind: 'submit', id: task.id })}
                      >
                        Submit for review
                      </Button>
                    ) : null}
                    {task.approvalStatus === 'SUBMITTED' && canReviewTask ? (
                      <Button
                        size="sm"
                        onClick={() => taskAction.mutate({ kind: 'approve', id: task.id })}
                      >
                        Approve
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No tasks yet" />
          )}
          {canCreateTask ? (
            <form onSubmit={createTask} className="space-y-3 rounded-md border border-border p-4">
              <h3 className="font-medium">Propose a task</h3>
              <Input
                label="Title"
                id="engineering-task-title"
                required
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
              />
              <textarea
                aria-label="Description"
                className="min-h-24 w-full rounded-md border border-border bg-surface p-3"
                value={taskDescription}
                onChange={(event) => setTaskDescription(event.target.value)}
              />
              <Button type="submit" disabled={taskAction.isPending}>
                Create draft
              </Button>
            </form>
          ) : null}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Project documentation</h2>
          {documents.isLoading ? (
            <LoadingState rows={3} />
          ) : documents.isError ? (
            <ErrorState onRetry={() => void documents.refetch()} />
          ) : documents.data?.length ? (
            <ul className="space-y-2">
              {documents.data.map((document) => (
                <li key={document.id} className="rounded-md border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{document.title}</strong>
                    <span className="text-sm text-muted">
                      {document.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {document.category || 'Uncategorized'} · Version {document.currentVersion}
                  </p>
                  {document.content ? (
                    <p className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-sm">
                      {document.content}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    {document.format !== 'FILE' && document.status !== 'ARCHIVED' ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          setEditingDocument({
                            id: document.id,
                            version: document.currentVersion,
                            content: document.content ?? '',
                          })
                        }
                      >
                        Edit
                      </Button>
                    ) : null}
                    {document.format === 'FILE' && document.fileName ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          void engineeringApi
                            .downloadDocument(
                              selectedId,
                              document.id,
                              document.fileName ?? 'document',
                            )
                            .catch((error: Error) => setMessage(error.message))
                        }
                      >
                        Download
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      onClick={() =>
                        setHistoryDocumentId(historyDocumentId === document.id ? '' : document.id)
                      }
                    >
                      Versions
                    </Button>
                    {document.status === 'DRAFT' ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          documentAction.mutate({
                            kind: 'review',
                            id: document.id,
                            version: document.currentVersion,
                          })
                        }
                      >
                        Submit for review
                      </Button>
                    ) : null}
                    {document.status === 'IN_REVIEW' && canReviewTask ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          documentAction.mutate({
                            kind: 'approve',
                            id: document.id,
                            version: document.currentVersion,
                          })
                        }
                      >
                        Approve
                      </Button>
                    ) : null}
                  </div>
                  {editingDocument?.id === document.id ? (
                    <form
                      className="mt-3 space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        documentAction.mutate({ kind: 'edit', ...editingDocument });
                      }}
                    >
                      <textarea
                        aria-label={`Edit ${document.title}`}
                        className="min-h-36 w-full rounded-md border border-border bg-surface p-3"
                        value={editingDocument.content}
                        onChange={(event) =>
                          setEditingDocument({ ...editingDocument, content: event.target.value })
                        }
                      />
                      <Button size="sm" type="submit" disabled={documentAction.isPending}>
                        Save new version
                      </Button>
                    </form>
                  ) : null}
                  {historyDocumentId === document.id ? (
                    <div className="mt-3 text-sm">
                      <strong>Version history</strong>
                      {documentHistory.isLoading ? (
                        <p>Loading versions…</p>
                      ) : documentHistory.isError ? (
                        <p>Could not load versions.</p>
                      ) : (
                        <ul>
                          {documentHistory.data?.map((version) => (
                            <li key={version.id}>
                              Version {version.version} · {version.status.replaceAll('_', ' ')} ·{' '}
                              {new Date(version.createdAt).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No documentation yet" />
          )}
          <form onSubmit={createDocument} className="space-y-3 rounded-md border border-border p-4">
            <h3 className="font-medium">Create documentation</h3>
            <Input
              label="Title"
              id="engineering-doc-title"
              required
              value={documentTitle}
              onChange={(event) => setDocumentTitle(event.target.value)}
            />
            <select
              aria-label="Category"
              className="h-11 w-full rounded-md border border-border bg-surface px-3"
              value={documentCategory}
              onChange={(event) => setDocumentCategory(event.target.value)}
            >
              {DOCUMENT_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <textarea
              aria-label="Markdown content"
              required={!documentFile}
              disabled={Boolean(documentFile)}
              className="min-h-36 w-full rounded-md border border-border bg-surface p-3"
              value={documentContent}
              onChange={(event) => setDocumentContent(event.target.value)}
            />
            <label className="block text-sm font-medium text-ink" htmlFor="engineering-doc-file">
              Or upload PDF, DOCX, Markdown, PNG, JPEG, or WebP (up to 25 MB)
            </label>
            <input
              id="engineering-doc-file"
              type="file"
              accept=".pdf,.docx,.md,.markdown,.png,.jpg,.jpeg,.webp"
              onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
            />
            {documentAction.isPending && documentFile ? (
              <p role="status">Uploading: {uploadProgress}%</p>
            ) : null}
            <Button type="submit" disabled={documentAction.isPending}>
              Save draft
            </Button>
          </form>
        </div>
      </div>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Managed systems</h2>
        {systems.isLoading ? (
          <LoadingState rows={2} />
        ) : systems.isError ? (
          <ErrorState onRetry={() => void systems.refetch()} />
        ) : systems.data?.length ? (
          <select
            aria-label="Managed system"
            className="h-11 w-full rounded-md border border-border bg-surface px-3"
            value={selectedSystemId}
            onChange={(event) => setSystemId(event.target.value)}
          >
            {systems.data.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </select>
        ) : (
          <EmptyState title="No managed systems yet" />
        )}
        {canManage ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              systemAction.mutate(systemName);
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <Input
              label="System name"
              id="engineering-system-name"
              required
              value={systemName}
              onChange={(event) => setSystemName(event.target.value)}
            />
            <Input
              label="Production HTTPS URL (optional)"
              type="url"
              value={systemProductionUrl}
              onChange={(event) => setSystemProductionUrl(event.target.value)}
            />
            <Button type="submit" disabled={systemAction.isPending}>
              Add system
            </Button>
          </form>
        ) : null}
        {selectedSystemId ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-border bg-surface p-4">
              <h3 className="font-medium">Bug reports</h3>
              {bugs.isError ? (
                <ErrorState onRetry={() => void bugs.refetch()} />
              ) : bugs.data?.length ? (
                <ul className="mt-2 space-y-3">
                  {bugs.data.map((bug) => (
                    <li key={bug.id} className="text-sm">
                      {bug.title} · {bug.status.replaceAll('_', ' ')}
                      {canManage && bug.status !== 'CLOSED' ? (
                        <select
                          aria-label={`Assign ${bug.title}`}
                          className="mt-1 block h-10 w-full rounded-md border border-border bg-surface px-2"
                          value={bug.assigneeId ?? ''}
                          onChange={(event) => {
                            if (event.target.value)
                              bugUpdate.mutate({
                                id: bug.id,
                                status: 'ASSIGNED',
                                assigneeId: event.target.value,
                              });
                          }}
                        >
                          <option value="">Assign engineer</option>
                          {(members.data ?? [])
                            .filter((member) =>
                              ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER', 'CONTRIBUTOR'].includes(
                                member.role,
                              ),
                            )
                            .map((member) => (
                              <option key={member.id} value={member.user.id}>
                                {member.user.name}
                              </option>
                            ))}
                        </select>
                      ) : null}
                      {bug.assigneeId === currentUser?.id && bug.status === 'ASSIGNED' ? (
                        <Button
                          size="sm"
                          className="mt-1"
                          onClick={() => bugUpdate.mutate({ id: bug.id, status: 'IN_PROGRESS' })}
                        >
                          Start work
                        </Button>
                      ) : null}
                      {bug.assigneeId === currentUser?.id && bug.status === 'IN_PROGRESS' ? (
                        <form
                          className="mt-2 space-y-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            bugUpdate.mutate({
                              id: bug.id,
                              status: 'RESOLVED',
                              rootCause: bugRootCauses[bug.id],
                            });
                          }}
                        >
                          <textarea
                            aria-label={`Root cause for ${bug.title}`}
                            required
                            className="min-h-20 w-full rounded-md border border-border bg-surface p-2"
                            value={bugRootCauses[bug.id] ?? ''}
                            onChange={(event) =>
                              setBugRootCauses({ ...bugRootCauses, [bug.id]: event.target.value })
                            }
                          />
                          <Button size="sm" type="submit" disabled={bugUpdate.isPending}>
                            Resolve bug
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">No bugs reported.</p>
              )}
            </div>
            <div className="rounded-md border border-border bg-surface p-4">
              <h3 className="font-medium">System updates</h3>
              {updates.isError ? (
                <ErrorState onRetry={() => void updates.refetch()} />
              ) : updates.data?.length ? (
                <ul className="mt-2 space-y-2">
                  {updates.data.map((update) => (
                    <li key={update.id} className="text-sm">
                      {update.title} · {update.status.replaceAll('_', ' ')}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">No updates recorded.</p>
              )}
            </div>
            <div className="rounded-md border border-border bg-surface p-4">
              <h3 className="font-medium">Releases</h3>
              {releases.isError ? (
                <ErrorState onRetry={() => void releases.refetch()} />
              ) : releases.data?.length ? (
                <ul className="mt-2 space-y-2">
                  {releases.data.map((release) => (
                    <li key={release.id} className="text-sm">
                      {release.version} · {release.status.replaceAll('_', ' ')}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">No releases planned.</p>
              )}
            </div>
          </div>
        ) : null}
        {selectedSystemId && canCreateTask ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              bugAction.mutate();
            }}
            className="space-y-3 rounded-md border border-border p-4"
          >
            <h3 className="font-medium">Report a bug</h3>
            <Input
              label="Title"
              id="engineering-bug-title"
              required
              value={bugTitle}
              onChange={(event) => setBugTitle(event.target.value)}
            />
            <textarea
              aria-label="Bug description"
              required
              className="min-h-24 w-full rounded-md border border-border bg-surface p-3"
              value={bugDescription}
              onChange={(event) => setBugDescription(event.target.value)}
            />
            <Button type="submit" disabled={bugAction.isPending}>
              Submit report
            </Button>
          </form>
        ) : null}
      </div>
      <EngineerWorklog
        projectId={selectedId}
        tasks={tasks.data ?? []}
        userId={currentUser?.id}
        canManage={canManage}
        isEngineer={
          members.data?.some(
            (member) =>
              member.user.id === currentUser?.id &&
              ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER', 'CONTRIBUTOR'].includes(member.role),
          ) ?? false
        }
      />
    </section>
  );
}
