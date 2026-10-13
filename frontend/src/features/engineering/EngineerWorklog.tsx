import { type FormEvent, type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import type { EngineeringTask } from './api';
import { worklogApi, type ProgressReportInput } from './worklogApi';

const today = (): string => new Date().toISOString().slice(0, 10);
const monday = (): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

export function EngineerWorklog({
  projectId,
  tasks,
  userId,
  canManage,
  isEngineer,
}: {
  projectId: string;
  tasks: EngineeringTask[];
  userId?: string;
  canManage: boolean;
  isEngineer: boolean;
}): ReactNode {
  const client = useQueryClient();
  const reports = useQuery({
    queryKey: ['engineer-progress-reports', projectId],
    queryFn: () => worklogApi.reports(projectId),
    enabled: Boolean(projectId),
  });
  const timer = useQuery({
    queryKey: ['engineer-active-timer'],
    queryFn: worklogApi.activeTimer,
    enabled: Boolean(userId && isEngineer),
  });
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [periodStart, setPeriodStart] = useState(today());
  const [completedWork, setCompletedWork] = useState('');
  const [inProgressWork, setInProgressWork] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextPlannedWork, setNextPlannedWork] = useState('');
  const [milestoneProgress, setMilestoneProgress] = useState('');
  const [priorities, setPriorities] = useState('');
  const [timerNote, setTimerNote] = useState('');
  const [discardReason, setDiscardReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const refresh = (): void => {
    void client.invalidateQueries({ queryKey: ['engineer-progress-reports', projectId] });
    void client.invalidateQueries({ queryKey: ['engineer-active-timer'] });
  };
  const create = useMutation({
    mutationFn: (input: ProgressReportInput) => worklogApi.createReport(projectId, input),
    onSuccess: () => {
      setCompletedWork('');
      setInProgressWork('');
      setBlockers('');
      setNextPlannedWork('');
      setMilestoneProgress('');
      setPriorities('');
      setMessage('Progress report submitted.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const review = useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: 'REVIEWED' | 'CLARIFICATION_REQUESTED';
      note: string;
    }) => worklogApi.reviewReport(id, status, note),
    onSuccess: () => {
      setMessage('Report review saved.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const start = useMutation({
    mutationFn: worklogApi.startTimer,
    onSuccess: refresh,
    onError: (error: Error) => setMessage(error.message),
  });
  const stop = useMutation({
    mutationFn: () => worklogApi.stopTimer(timerNote),
    onSuccess: (result) => {
      setTimerNote('');
      setMessage(`${result.entry.minutes} minute(s) recorded.`);
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const discard = useMutation({
    mutationFn: () => worklogApi.discardTimer(discardReason),
    onSuccess: () => {
      setDiscardReason('');
      setMessage('Timer discarded without recording hours.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const approvedTasks = tasks.filter(
    (task) =>
      task.assigneeId === userId &&
      task.approvalStatus === 'APPROVED' &&
      task.status !== 'DONE' &&
      task.status !== 'CANCELLED',
  );
  const activeHere = timer.data?.task.projectId === projectId;
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (period === 'WEEKLY' && new Date(`${periodStart}T00:00:00Z`).getUTCDay() !== 1) {
      setMessage('Weekly reports must begin on a Monday.');
      return;
    }
    create.mutate({
      period,
      periodStart,
      completedWork,
      ...(inProgressWork ? { inProgressWork } : {}),
      ...(blockers ? { blockers } : {}),
      ...(nextPlannedWork ? { nextPlannedWork } : {}),
      ...(milestoneProgress ? { milestoneProgress } : {}),
      ...(priorities ? { priorities } : {}),
    });
  };
  return (
    <section className="space-y-5" aria-label="Engineering worklog">
      <h2 className="text-xl font-semibold">Progress and time</h2>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {isEngineer ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="font-semibold">Task timer</h3>
          {timer.isLoading ? (
            <LoadingState rows={1} />
          ) : timer.isError ? (
            <ErrorState
              description="Could not load active timer."
              onRetry={() => void timer.refetch()}
            />
          ) : timer.data ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm">
                Running: <strong>{timer.data.task.title}</strong> · started{' '}
                {new Date(timer.data.startedAt).toLocaleString()}
                {!activeHere ? ' (another project)' : ''}
              </p>
              <Input
                label="Time entry note (optional)"
                value={timerNote}
                onChange={(event) => setTimerNote(event.target.value)}
              />
              <Button
                disabled={stop.isPending}
                isLoading={stop.isPending}
                onClick={() => stop.mutate()}
              >
                Stop and record time
              </Button>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted">
                  Discard a mistaken or stale timer
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Input
                    aria-label="Reason for discarding timer"
                    placeholder="Reason (at least 5 characters)"
                    minLength={5}
                    value={discardReason}
                    onChange={(event) => setDiscardReason(event.target.value)}
                  />
                  <Button
                    variant="secondary"
                    disabled={discardReason.trim().length < 5 || discard.isPending}
                    isLoading={discard.isPending}
                    onClick={() => discard.mutate()}
                  >
                    Discard timer
                  </Button>
                </div>
              </details>
            </div>
          ) : approvedTasks.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="timer-task">
                Task
              </label>
              <select
                id="timer-task"
                className="min-h-11 flex-1 rounded border border-border bg-surface p-2"
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) start.mutate(event.target.value);
                  event.target.value = '';
                }}
                disabled={start.isPending}
              >
                <option value="">Start timer for an approved task…</option>
                {approvedTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              No approved tasks assigned to you in this project.
            </p>
          )}
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {isEngineer ? (
          <form
            className="space-y-3 rounded-lg border border-border bg-surface p-4"
            onSubmit={submit}
          >
            <h3 className="font-semibold">Submit progress report</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Period
                <select
                  className="mt-1 w-full rounded border border-border bg-surface p-3"
                  value={period}
                  onChange={(event) => {
                    const value = event.target.value as 'DAILY' | 'WEEKLY';
                    setPeriod(value);
                    setPeriodStart(value === 'WEEKLY' ? monday() : today());
                  }}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </label>
              <Input
                label={period === 'WEEKLY' ? 'Week starting Monday' : 'Report date'}
                type="date"
                required
                max={today()}
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
            </div>
            <label className="block text-sm">
              Completed work
              <textarea
                required
                maxLength={5000}
                className="mt-1 min-h-20 w-full rounded border border-border bg-surface p-3"
                value={completedWork}
                onChange={(event) => setCompletedWork(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              Work in progress
              <textarea
                maxLength={5000}
                className="mt-1 min-h-16 w-full rounded border border-border bg-surface p-3"
                value={inProgressWork}
                onChange={(event) => setInProgressWork(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              Blockers
              <textarea
                maxLength={5000}
                className="mt-1 min-h-16 w-full rounded border border-border bg-surface p-3"
                value={blockers}
                onChange={(event) => setBlockers(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              Next planned work
              <textarea
                maxLength={5000}
                className="mt-1 min-h-16 w-full rounded border border-border bg-surface p-3"
                value={nextPlannedWork}
                onChange={(event) => setNextPlannedWork(event.target.value)}
              />
            </label>
            {period === 'WEEKLY' ? (
              <>
                <Input
                  label="Milestone progress"
                  value={milestoneProgress}
                  onChange={(event) => setMilestoneProgress(event.target.value)}
                />
                <Input
                  label="Next week’s priorities"
                  value={priorities}
                  onChange={(event) => setPriorities(event.target.value)}
                />
              </>
            ) : null}
            <p className="text-xs text-muted">
              Hours worked are calculated from recorded time entries for this period.
            </p>
            <Button type="submit" disabled={create.isPending} isLoading={create.isPending}>
              Submit report
            </Button>
          </form>
        ) : null}
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <h3 className="font-semibold">Report history</h3>
          {reports.isLoading ? (
            <LoadingState rows={2} />
          ) : reports.isError ? (
            <ErrorState
              description="Could not load progress reports."
              onRetry={() => void reports.refetch()}
            />
          ) : reports.data?.length ? (
            <ol className="max-h-[720px] space-y-3 overflow-y-auto">
              {reports.data.map((report) => (
                <li
                  key={report.id}
                  className="space-y-2 rounded-md border border-border p-3 text-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>
                      {report.period === 'WEEKLY' ? 'Weekly' : 'Daily'} ·{' '}
                      {new Date(report.periodStart).toLocaleDateString()}
                    </strong>
                    <Badge
                      tone={
                        report.status === 'REVIEWED'
                          ? 'success'
                          : report.status === 'CLARIFICATION_REQUESTED'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {report.status.replaceAll('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-muted">
                    {report.author.name} · {(report.hoursWorkedMinutes / 60).toFixed(1)} hours
                    logged
                  </p>
                  <p className="whitespace-pre-wrap">{report.completedWork}</p>
                  {report.inProgressWork ? <p>In progress: {report.inProgressWork}</p> : null}
                  {report.blockers ? <p>Blockers: {report.blockers}</p> : null}
                  {report.nextPlannedWork ? <p>Next: {report.nextPlannedWork}</p> : null}
                  {report.reviewNote ? (
                    <p className="rounded bg-surface-alt p-2">Review: {report.reviewNote}</p>
                  ) : null}
                  {canManage && report.authorId !== userId ? (
                    <div className="space-y-2">
                      <Input
                        aria-label={`Review note for ${report.id}`}
                        placeholder="Review note or clarification request"
                        value={reviewNotes[report.id] ?? ''}
                        onChange={(event) =>
                          setReviewNotes({ ...reviewNotes, [report.id]: event.target.value })
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={review.isPending || !(reviewNotes[report.id] ?? '').trim()}
                          onClick={() =>
                            review.mutate({
                              id: report.id,
                              status: 'REVIEWED',
                              note: reviewNotes[report.id] ?? '',
                            })
                          }
                        >
                          Mark reviewed
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={review.isPending || !(reviewNotes[report.id] ?? '').trim()}
                          onClick={() =>
                            review.mutate({
                              id: report.id,
                              status: 'CLARIFICATION_REQUESTED',
                              note: reviewNotes[report.id] ?? '',
                            })
                          }
                        >
                          Request clarification
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No progress reports yet" />
          )}
        </section>
      </div>
    </section>
  );
}
