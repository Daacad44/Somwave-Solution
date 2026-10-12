import { type FormEvent, type ReactNode, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS, UPLOAD_MAX_BYTES, type CreateEngineeringTaskInput } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useCurrentUser } from '../auth/hooks';
import { listMilestones } from '../milestones/api';
import { engineeringApi, type EngineeringTask } from './api';

const TYPES = [
  'FEATURE',
  'BUG_FIX',
  'IMPROVEMENT',
  'RESEARCH',
  'DESIGN',
  'TESTING',
  'DOCUMENTATION',
  'MAINTENANCE',
  'OTHER',
] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const dateInput = (value: string | null) =>
  value ? new Date(value).toISOString().slice(0, 16) : '';
const iso = (value: string) => (value ? new Date(value).toISOString() : null);

function Timeline({
  tasks,
  canManage,
  moving,
  onMove,
}: {
  tasks: EngineeringTask[];
  canManage: boolean;
  moving: boolean;
  onMove: (task: EngineeringTask, days: number) => void;
}): ReactNode {
  const dragStartX = useRef<number | null>(null);
  const dated = tasks.filter((task) => task.dueDate);
  if (!dated.length) return <EmptyState title="Schedule tasks to see the timeline" />;
  const dates = dated.flatMap((task) => [
    Date.parse(task.startDate ?? task.dueDate!),
    Date.parse(task.dueDate!),
  ]);
  const start = Math.min(...dates);
  const end = Math.max(...dates, start + 86400000);
  const span = end - start + 86400000;
  return (
    <div className="space-y-3 overflow-x-auto" aria-label="Project Gantt timeline">
      {canManage ? (
        <p className="text-xs text-muted">
          Drag a bar or use its arrow keys to move a task by whole days.
        </p>
      ) : null}
      <div className="flex justify-between text-xs text-muted">
        <span>{new Date(start).toLocaleDateString()}</span>
        <span>{new Date(end).toLocaleDateString()}</span>
      </div>
      {dated.map((task) => {
        const left = ((Date.parse(task.startDate ?? task.dueDate!) - start) / span) * 100;
        const width = Math.max(
          2,
          ((Date.parse(task.dueDate!) - Date.parse(task.startDate ?? task.dueDate!) + 86400000) /
            span) *
            100,
        );
        return (
          <div
            key={task.id}
            className="grid min-w-96 grid-cols-[10rem_1fr] items-center gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-1" title={task.title}>
              <span className="truncate">{task.title}</span>
              {canManage ? (
                <span className="ml-auto flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="rounded border border-border px-1"
                    disabled={moving}
                    aria-label={`Move ${task.title} one day earlier`}
                    onClick={() => onMove(task, -1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="rounded border border-border px-1"
                    disabled={moving}
                    aria-label={`Move ${task.title} one day later`}
                    onClick={() => onMove(task, 1)}
                  >
                    →
                  </button>
                </span>
              ) : null}
            </span>
            <div className="relative h-7 rounded bg-surface-alt">
              <button
                type="button"
                draggable={canManage && !moving}
                disabled={!canManage || moving}
                className="absolute top-1 h-5 rounded bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-default"
                style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                title={`${task.title}: ${task.startDate ? new Date(task.startDate).toLocaleDateString() : 'Unscheduled start'} to ${new Date(task.dueDate!).toLocaleDateString()}`}
                aria-label={`Move ${task.title} on timeline`}
                onDragStart={(event) => {
                  dragStartX.current = event.clientX;
                }}
                onDragEnd={(event) => {
                  if (dragStartX.current === null || !event.clientX) return;
                  const trackWidth =
                    event.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                  if (trackWidth > 0) {
                    const days = Math.round(
                      (((event.clientX - dragStartX.current) / trackWidth) * span) / 86400000,
                    );
                    if (days) onMove(task, days);
                  }
                  dragStartX.current = null;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    onMove(task, event.key === 'ArrowLeft' ? -1 : 1);
                  }
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskDetail({
  projectId,
  task,
  tasks,
  canManage,
  canReview,
  currentUserId,
}: {
  projectId: string;
  task: EngineeringTask;
  tasks: EngineeringTask[];
  canManage: boolean;
  canReview: boolean;
  currentUserId?: string;
}): ReactNode {
  const client = useQueryClient();
  const [comment, setComment] = useState('');
  const [report, setReport] = useState('');
  const [percent, setPercent] = useState(task.progressPercent);
  const [blocker, setBlocker] = useState('');
  const [checklistTitle, setChecklistTitle] = useState('');
  const [dependsOnId, setDependsOnId] = useState('');
  const [startDate, setStartDate] = useState(dateInput(task.startDate));
  const [dueDate, setDueDate] = useState(dateInput(task.dueDate));
  const [phaseId, setPhaseId] = useState(task.phaseId ?? '');
  const [message, setMessage] = useState('');
  const [hours, setHours] = useState(1);
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [workNote, setWorkNote] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const phases = useQuery({
    queryKey: ['engineering-phases', projectId],
    queryFn: () => engineeringApi.phases(projectId),
  });
  const comments = useQuery({
    queryKey: ['task-comments', task.id],
    queryFn: () => engineeringApi.taskComments(task.id),
  });
  const progress = useQuery({
    queryKey: ['task-progress', task.id],
    queryFn: () => engineeringApi.taskProgress(task.id),
  });
  const checklist = useQuery({
    queryKey: ['task-checklist', task.id],
    queryFn: () => engineeringApi.taskChecklist(task.id),
  });
  const dependencies = useQuery({
    queryKey: ['task-dependencies', task.id],
    queryFn: () => engineeringApi.taskDependencies(task.id),
  });
  const transitions = useQuery({
    queryKey: ['task-transitions', task.id],
    queryFn: () => engineeringApi.taskTransitions(task.id),
  });
  const timeEntries = useQuery({
    queryKey: ['task-hours', task.id],
    queryFn: () => engineeringApi.taskHours(task.id),
  });
  const attachments = useQuery({
    queryKey: ['task-attachments', task.id],
    queryFn: () => engineeringApi.taskAttachments(task.id),
  });
  const refresh = () => {
    for (const key of [
      'engineering-tasks',
      'task-comments',
      'task-progress',
      'task-checklist',
      'task-dependencies',
      'task-transitions',
      'task-hours',
      'task-attachments',
    ])
      void client.invalidateQueries({ queryKey: [key] });
  };
  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => {
      setMessage('Task updated.');
      setComment('');
      setReport('');
      setChecklistTitle('');
      setDependsOnId('');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const submit = (event: FormEvent, run: () => Promise<unknown>) => {
    event.preventDefault();
    action.mutate(run);
  };
  const upload = async () => {
    if (!attachmentFile) return;
    if (attachmentFile.size > UPLOAD_MAX_BYTES) throw new Error('The maximum file size is 25 MB.');
    const mimeType =
      attachmentFile.type ||
      (attachmentFile.name.toLowerCase().endsWith('.md') ? 'text/markdown' : '');
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(new Error('Could not read the attachment.'));
      reader.readAsDataURL(attachmentFile);
    });
    await engineeringApi.uploadTaskAttachment(
      task.id,
      attachmentFile.name,
      mimeType,
      base64,
      setUploadProgress,
    );
    setAttachmentFile(null);
    setUploadProgress(0);
  };
  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-xl font-semibold">{task.title}</h2>
      <p className="text-sm text-muted">
        {task.kind} · {task.status.replaceAll('_', ' ')} ·{' '}
        {task.approvalStatus.replaceAll('_', ' ')} · {task.progressPercent}% complete
      </p>
      {task.description ? <p className="whitespace-pre-wrap text-sm">{task.description}</p> : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {canManage ? (
        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={(event) =>
            submit(event, () =>
              engineeringApi.scheduleTask(task.id, iso(startDate), iso(dueDate), phaseId || null),
            )
          }
        >
          <Input
            label="Start"
            type="datetime-local"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <Input
            label="Due"
            type="datetime-local"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
          <label className="text-sm">
            Phase
            <select
              className="mt-1 w-full rounded border border-border bg-surface p-3"
              value={phaseId}
              onChange={(event) => setPhaseId(event.target.value)}
            >
              <option value="">No phase</option>
              {phases.data?.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.title}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" size="sm" disabled={action.isPending}>
              Save schedule
            </Button>
          </div>
        </form>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Checklist</h3>
            <ul className="mt-2 space-y-1">
              {checklist.data?.map((item) => (
                <li key={item.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(item.completedAt)}
                      disabled={action.isPending || task.approvalStatus !== 'APPROVED'}
                      onChange={(event) =>
                        action.mutate(() =>
                          engineeringApi.setTaskChecklistItem(
                            task.id,
                            item.id,
                            event.target.checked,
                          ),
                        )
                      }
                    />
                    {item.title}
                  </label>
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) =>
                submit(event, () => engineeringApi.addTaskChecklistItem(task.id, checklistTitle))
              }
            >
              <Input
                aria-label="New checklist item"
                value={checklistTitle}
                onChange={(event) => setChecklistTitle(event.target.value)}
                required
              />
              <Button type="submit" size="sm">
                Add
              </Button>
            </form>
          </div>
          <div>
            <h3 className="font-semibold">Dependencies</h3>
            <ul className="mt-2 text-sm">
              {dependencies.data?.map((entry) => (
                <li key={entry.dependsOnId}>
                  {entry.dependsOn.title} · {entry.dependsOn.status}
                </li>
              ))}
            </ul>
            {canManage ? (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(event) =>
                  submit(event, () => engineeringApi.addTaskDependency(task.id, dependsOnId))
                }
              >
                <select
                  className="min-w-0 flex-1 rounded border border-border bg-surface p-2"
                  value={dependsOnId}
                  onChange={(event) => setDependsOnId(event.target.value)}
                  required
                >
                  <option value="">Choose prerequisite</option>
                  {tasks
                    .filter((row) => row.id !== task.id)
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.title}
                      </option>
                    ))}
                </select>
                <Button type="submit" size="sm">
                  Add
                </Button>
              </form>
            ) : null}
          </div>
          {task.status === 'TESTING' &&
          canReview &&
          !task.qaVerifiedAt &&
          task.assigneeId !== currentUserId ? (
            <Button
              size="sm"
              onClick={() => action.mutate(() => engineeringApi.verifyTaskQa(task.id))}
            >
              Verify QA
            </Button>
          ) : null}
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Comments</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {comments.data?.map((row) => (
                <li key={row.id} className="rounded bg-surface-alt p-2">
                  {row.body}
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) =>
                submit(event, () => engineeringApi.addTaskComment(task.id, comment))
              }
            >
              <Input
                aria-label="Task comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                required
              />
              <Button type="submit" size="sm">
                Post
              </Button>
            </form>
          </div>
          <div>
            <h3 className="font-semibold">Progress reports</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {progress.data?.map((row) => (
                <li key={row.id} className="rounded bg-surface-alt p-2">
                  {row.progressPercent}% · {row.body}
                </li>
              ))}
            </ul>
            {task.assigneeId === currentUserId && task.approvalStatus === 'APPROVED' ? (
              <form
                className="mt-2 space-y-2"
                onSubmit={(event) =>
                  submit(event, () =>
                    engineeringApi.addTaskProgress(task.id, report, percent, blocker),
                  )
                }
              >
                <textarea
                  className="w-full rounded border border-border bg-surface p-2"
                  aria-label="Progress report"
                  value={report}
                  onChange={(event) => setReport(event.target.value)}
                  required
                />
                <Input
                  label="Percent complete"
                  type="number"
                  min={0}
                  max={100}
                  value={percent}
                  onChange={(event) => setPercent(Number(event.target.value))}
                />
                <Input
                  label="Blocker (optional)"
                  value={blocker}
                  onChange={(event) => setBlocker(event.target.value)}
                />
                <Button type="submit" size="sm">
                  Submit report
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <h3 className="font-semibold">Working hours</h3>
          <ul className="text-sm">
            {timeEntries.data?.map((entry) => (
              <li key={entry.id}>
                {new Date(entry.date).toLocaleDateString()} · {(entry.minutes / 60).toFixed(2)}{' '}
                hours{entry.note ? ` · ${entry.note}` : ''}
              </li>
            ))}
          </ul>
          {task.assigneeId === currentUserId && task.approvalStatus === 'APPROVED' ? (
            <form
              className="space-y-2"
              onSubmit={(event) =>
                submit(event, () =>
                  engineeringApi.recordTaskHours(
                    task.id,
                    Math.round(hours * 60),
                    workDate,
                    workNote,
                  ),
                )
              }
            >
              <Input
                label="Hours worked"
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                value={hours}
                onChange={(event) => setHours(Number(event.target.value))}
                required
              />
              <Input
                label="Work date"
                type="date"
                value={workDate}
                onChange={(event) => setWorkDate(event.target.value)}
                required
              />
              <Input
                label="Note"
                value={workNote}
                onChange={(event) => setWorkNote(event.target.value)}
              />
              <Button size="sm" type="submit">
                Record hours
              </Button>
            </form>
          ) : null}
        </section>
        <section className="space-y-2">
          <h3 className="font-semibold">Attachments</h3>
          <ul className="text-sm">
            {attachments.data?.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() =>
                    void engineeringApi
                      .downloadTaskAttachment(task.id, item.id, item.fileName)
                      .catch((error: Error) => setMessage(error.message))
                  }
                >
                  {item.fileName}
                </button>{' '}
                · {(item.sizeBytes / 1024).toFixed(0)} KB
              </li>
            ))}
          </ul>
          <form className="space-y-2" onSubmit={(event) => submit(event, upload)}>
            <Input
              label="Upload file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.md,.docx"
              onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
            />
            <Button type="submit" size="sm" disabled={!attachmentFile || action.isPending}>
              Upload attachment
            </Button>
            {uploadProgress ? <p className="text-sm">Uploading {uploadProgress}%</p> : null}
          </form>
        </section>
      </div>
      <details>
        <summary className="cursor-pointer font-semibold">Transition history</summary>
        <ul className="mt-2 text-sm">
          {transitions.data?.map((row) => (
            <li key={row.id}>
              {row.fromStatus} → {row.toStatus} · {new Date(row.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function TaskPlanningPage(): ReactNode {
  const client = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const canManage = useHasPermission(PERMISSIONS.ENGINEERING_MANAGE);
  const canCreate = useHasPermission(PERMISSIONS.ENGINEERING_TASK_CREATE);
  const canReview = useHasPermission(PERMISSIONS.ENGINEERING_TASK_REVIEW);
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [phaseTitle, setPhaseTitle] = useState('');
  const [input, setInput] = useState<CreateEngineeringTaskInput>({
    title: '',
    type: 'FEATURE',
    priority: 'MEDIUM',
  });
  const [checklist, setChecklist] = useState('');
  const [message, setMessage] = useState('');
  const projects = useQuery({
    queryKey: ['engineering-projects'],
    queryFn: engineeringApi.projects,
  });
  const selectedProjectId = projectId || projects.data?.[0]?.id || '';
  const tasks = useQuery({
    queryKey: ['engineering-tasks', selectedProjectId],
    queryFn: () => engineeringApi.tasks(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });
  const phases = useQuery({
    queryKey: ['engineering-phases', selectedProjectId],
    queryFn: () => engineeringApi.phases(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });
  const members = useQuery({
    queryKey: ['engineering-members', selectedProjectId],
    queryFn: () => engineeringApi.members(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });
  const milestones = useQuery({
    queryKey: ['planning-milestones', selectedProjectId],
    queryFn: () => listMilestones({ page: 1, pageSize: 100, projectId: selectedProjectId }),
    enabled: Boolean(selectedProjectId),
  });
  const selected = tasks.data?.find((task) => task.id === taskId);
  const createTask = useMutation({
    mutationFn: () =>
      engineeringApi.createTask(selectedProjectId, {
        ...input,
        checklist: checklist
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setInput({ title: '', type: 'FEATURE', priority: 'MEDIUM' });
      setChecklist('');
      setMessage('Task proposal created. Submit it for approval in the Engineering Workspace.');
      void client.invalidateQueries({ queryKey: ['engineering-tasks'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const createPhase = useMutation({
    mutationFn: () => engineeringApi.createPhase(selectedProjectId, phaseTitle),
    onSuccess: () => {
      setPhaseTitle('');
      void client.invalidateQueries({ queryKey: ['engineering-phases'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const moveTimelineTask = useMutation({
    mutationFn: ({ task, days }: { task: EngineeringTask; days: number }) => {
      const shift = (date: string) => new Date(Date.parse(date) + days * 86400000).toISOString();
      return engineeringApi.scheduleTask(
        task.id,
        shift(task.startDate ?? task.dueDate!),
        shift(task.dueDate!),
        task.phaseId,
      );
    },
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ['engineering-tasks', selectedProjectId] }),
    onError: (error: Error) => setMessage(error.message),
  });
  const workload =
    members.data?.map((member) => ({
      name: member.user.name,
      count:
        tasks.data?.filter(
          (task) =>
            task.assigneeId === member.user.id && !['DONE', 'CANCELLED'].includes(task.status),
        ).length ?? 0,
    })) ?? [];
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Task planning</h1>
      {projects.isLoading ? (
        <LoadingState rows={4} />
      ) : projects.isError ? (
        <ErrorState
          description="Could not load projects."
          onRetry={() => void projects.refetch()}
        />
      ) : !projects.data?.length ? (
        <EmptyState title="No accessible projects" />
      ) : (
        <>
          <label className="block text-sm">
            Project
            <select
              className="mt-1 w-full rounded border border-border bg-surface p-3"
              value={selectedProjectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setTaskId('');
              }}
            >
              {projects.data.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          {message ? (
            <p role="status" className="text-sm">
              {message}
            </p>
          ) : null}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Project phases</h2>
            {phases.isLoading ? (
              <LoadingState rows={2} />
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {phases.data?.map((row) => (
                  <span key={row.id} className="rounded bg-surface-alt px-3 py-2 text-sm">
                    {row.title}
                  </span>
                ))}
              </div>
            )}
            {canManage ? (
              <form
                className="mt-3 flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  createPhase.mutate();
                }}
              >
                <Input
                  aria-label="New phase"
                  value={phaseTitle}
                  onChange={(event) => setPhaseTitle(event.target.value)}
                  required
                />
                <Button type="submit" size="sm" isLoading={createPhase.isPending}>
                  Add phase
                </Button>
              </form>
            ) : null}
          </section>
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Project timeline</h2>
            {tasks.isLoading ? (
              <LoadingState rows={4} />
            ) : tasks.isError ? (
              <ErrorState
                description="Could not load tasks."
                onRetry={() => void tasks.refetch()}
              />
            ) : (
              <Timeline
                tasks={tasks.data ?? []}
                canManage={canManage}
                moving={moveTimelineTask.isPending}
                onMove={(task, days) => moveTimelineTask.mutate({ task, days })}
              />
            )}
          </section>
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Engineer workload</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {workload.map((row) => (
                <div key={row.name} className="rounded bg-surface-alt p-3 text-sm">
                  {row.name} · {row.count} active tasks
                </div>
              ))}
            </div>
          </section>
          <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
            <aside className="rounded-lg border border-border bg-surface p-4">
              <h2 className="font-semibold">Tasks</h2>
              {tasks.data?.length ? (
                <ul className="mt-2 space-y-1">
                  {tasks.data.map((task) => (
                    <li key={task.id}>
                      <button
                        className="w-full rounded p-2 text-left hover:bg-surface-alt"
                        onClick={() => setTaskId(task.id)}
                      >
                        <span className="block font-medium">{task.title}</span>
                        <span className="text-xs text-muted">
                          {task.kind} · {task.status} ·{' '}
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString()
                            : 'No deadline'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No tasks" />
              )}
            </aside>
            {selected ? (
              <TaskDetail
                key={selected.id}
                projectId={selectedProjectId}
                task={selected}
                tasks={tasks.data ?? []}
                canManage={canManage}
                canReview={canReview}
                currentUserId={currentUser?.id}
              />
            ) : (
              <EmptyState title="Select a task" />
            )}
          </div>
          {canCreate ? (
            <form
              className="space-y-3 rounded-lg border border-border bg-surface p-4"
              onSubmit={(event) => {
                event.preventDefault();
                createTask.mutate();
              }}
            >
              <h2 className="text-lg font-semibold">Propose a task</h2>
              <p className="text-sm text-muted">
                New tasks remain drafts until a project manager approves them.
              </p>
              <Input
                label="Title"
                value={input.title}
                onChange={(event) => setInput({ ...input, title: event.target.value })}
                required
              />
              <textarea
                className="min-h-24 w-full rounded border border-border bg-surface p-3"
                aria-label="Description"
                value={input.description ?? ''}
                onChange={(event) => setInput({ ...input, description: event.target.value })}
                placeholder="Description"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Kind
                  <select
                    className="mt-1 w-full rounded border border-border bg-surface p-3"
                    value={input.kind ?? 'TASK'}
                    onChange={(event) =>
                      setInput({
                        ...input,
                        kind: event.target.value as CreateEngineeringTaskInput['kind'],
                      })
                    }
                  >
                    <option value="EPIC">Epic</option>
                    <option value="TASK">Task</option>
                    <option value="SUBTASK">Subtask</option>
                  </select>
                </label>
                <label className="text-sm">
                  Type
                  <select
                    className="mt-1 w-full rounded border border-border bg-surface p-3"
                    value={input.type}
                    onChange={(event) =>
                      setInput({
                        ...input,
                        type: event.target.value as CreateEngineeringTaskInput['type'],
                      })
                    }
                  >
                    {TYPES.map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Priority
                  <select
                    className="mt-1 w-full rounded border border-border bg-surface p-3"
                    value={input.priority}
                    onChange={(event) =>
                      setInput({
                        ...input,
                        priority: event.target.value as CreateEngineeringTaskInput['priority'],
                      })
                    }
                  >
                    {PRIORITIES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Estimated hours"
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={input.estimatedHours ?? ''}
                  onChange={(event) =>
                    setInput({
                      ...input,
                      estimatedHours: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
                <label className="text-sm">
                  Phase
                  <select
                    className="mt-1 w-full rounded border border-border bg-surface p-3"
                    value={input.phaseId ?? ''}
                    onChange={(event) =>
                      setInput({ ...input, phaseId: event.target.value || undefined })
                    }
                  >
                    <option value="">No phase</option>
                    {phases.data?.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Milestone
                  <select
                    className="mt-1 w-full rounded border border-border bg-surface p-3"
                    value={input.milestoneId ?? ''}
                    onChange={(event) =>
                      setInput({ ...input, milestoneId: event.target.value || undefined })
                    }
                  >
                    <option value="">No milestone</option>
                    {milestones.data?.data.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Assignee
                  <select
                    className="mt-1 w-full rounded border border-border bg-surface p-3"
                    value={input.assigneeId ?? ''}
                    onChange={(event) =>
                      setInput({ ...input, assigneeId: event.target.value || undefined })
                    }
                  >
                    <option value="">Myself</option>
                    {members.data
                      ?.filter((row) => row.role !== 'VIEWER')
                      .map((row) => (
                        <option key={row.user.id} value={row.user.id}>
                          {row.user.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm">
                  Parent task
                  <select
                    className="mt-1 w-full rounded border border-border bg-surface p-3"
                    value={input.parentTaskId ?? ''}
                    onChange={(event) =>
                      setInput({ ...input, parentTaskId: event.target.value || undefined })
                    }
                  >
                    <option value="">No parent</option>
                    {tasks.data?.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.title}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Start"
                  type="datetime-local"
                  onChange={(event) =>
                    setInput({ ...input, startDate: iso(event.target.value) ?? undefined })
                  }
                />
                <Input
                  label="Due"
                  type="datetime-local"
                  onChange={(event) =>
                    setInput({ ...input, dueDate: iso(event.target.value) ?? undefined })
                  }
                />
              </div>
              <label className="block text-sm">
                Acceptance criteria
                <textarea
                  className="mt-1 min-h-24 w-full rounded border border-border bg-surface p-3"
                  value={input.acceptanceCriteria ?? ''}
                  onChange={(event) =>
                    setInput({ ...input, acceptanceCriteria: event.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                Checklist (one item per line)
                <textarea
                  className="mt-1 min-h-24 w-full rounded border border-border bg-surface p-3"
                  value={checklist}
                  onChange={(event) => setChecklist(event.target.value)}
                />
              </label>
              <Button type="submit" isLoading={createTask.isPending}>
                Create draft
              </Button>
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
