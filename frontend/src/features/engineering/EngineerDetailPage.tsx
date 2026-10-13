import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { apiFetch } from '../../lib/apiClient';
import { accountsApi, type EngineerAccountInput } from './accountsApi';
import { EngineerOperationalOverview } from './EngineerOperationalOverview';
import { EngineerSkillsSchedule } from './EngineerSkillsSchedule';

interface EngineerAssignment {
  id: string;
  status: string;
  role: string;
  startDate?: string | null;
  expectedEndDate?: string | null;
  responsibilities?: string | null;
  estimatedHours?: number | string | null;
  project: { id: string; name: string; dueDate?: string | null };
}
interface EngineerAssignments {
  memberships: EngineerAssignment[];
  invitations: EngineerAssignment[];
}

const humanize = (value: string | null | undefined): string =>
  value
    ? value
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/^./, (letter) => letter.toUpperCase())
    : 'Not specified';
const shortDate = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleDateString() : '—';

export function EngineerDetailPage(): ReactNode {
  const { id = '' } = useParams();
  const client = useQueryClient();
  const account = useQuery({
    queryKey: ['engineer-account', id],
    queryFn: () => accountsApi.detail(id),
    enabled: Boolean(id),
  });
  const activity = useQuery({
    queryKey: ['engineer-account-activity', id],
    queryFn: () => accountsApi.activity(id),
    enabled: Boolean(id),
  });
  const assignments = useQuery({
    queryKey: ['engineer-assignments', id],
    queryFn: () => apiFetch<EngineerAssignments>(`/engineering/engineers/${id}/assignments`),
    enabled: Boolean(id),
  });
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<'resend' | 'cancel' | 'suspend' | 'reactivate' | null>(null);
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState<Partial<EngineerAccountInput>>({});
  const [skills, setSkills] = useState('');
  useEffect(() => {
    if (!account.data) return;
    const value = account.data.profile;
    setProfile({
      phone: value.phone ?? '',
      jobTitle: value.jobTitle ?? '',
      specialization: value.specialization ?? '',
      experienceLevel: value.experienceLevel as EngineerAccountInput['experienceLevel'],
      employmentType: value.employmentType as EngineerAccountInput['employmentType'],
      weeklyCapacityHours: Number(value.weeklyCapacityHours),
      availability: value.availability as EngineerAccountInput['availability'],
    });
    setSkills(value.skills.join(', '));
  }, [account.data]);
  const refresh = (): void => {
    void client.invalidateQueries({ queryKey: ['engineer-account', id] });
    void client.invalidateQueries({ queryKey: ['engineer-account-activity', id] });
    void client.invalidateQueries({ queryKey: ['engineer-accounts'] });
    void client.invalidateQueries({ queryKey: ['engineering-team-overview'] });
  };
  const statusMutation = useMutation({
    mutationFn: (kind: NonNullable<typeof action>) => accountsApi.action(id, kind),
    onSuccess: () => {
      setMessage('Engineer account updated.');
      setAction(null);
      refresh();
    },
    onError: (error: Error) => {
      setMessage(error.message);
      setAction(null);
    },
  });
  const save = useMutation({
    mutationFn: () =>
      accountsApi.update(id, {
        ...profile,
        skills: [
          ...new Set(
            skills
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ],
      }),
    onSuccess: () => {
      setEditing(false);
      setMessage('Engineer profile saved.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  if (account.isLoading) return <LoadingState rows={5} />;
  if (account.isError || !account.data)
    return (
      <ErrorState
        description="Could not load engineer profile."
        onRetry={() => void account.refetch()}
      />
    );
  const engineer = account.data;
  const status = engineer.profile.status;
  const activeAssignments = assignments.data?.memberships ?? [];
  const allAssignments = [
    ...(assignments.data?.memberships ?? []).map((item) => ({ ...item, status: 'ACTIVE' })),
    ...(assignments.data?.invitations ?? []),
  ];
  return (
    <section className="space-y-5">
      <Link className="text-sm text-brand hover:underline" to="/engineering/engineers">
        ← Engineering team
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface p-5">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{engineer.name}</h1>
          <p className="text-muted">{engineer.email}</p>
          <p className="mt-1 text-sm text-muted">
            {engineer.profile.jobTitle || engineer.profile.specialization || 'Engineer'}
          </p>
        </div>
        <Badge
          tone={
            status === 'ACTIVE'
              ? 'success'
              : status === 'SUSPENDED' || status === 'DEACTIVATED'
                ? 'error'
                : 'warning'
          }
        >
          {humanize(status)}
        </Badge>
      </header>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit profile
        </Button>
        {['INVITED', 'PENDING_VERIFICATION', 'PENDING_ACTIVATION'].includes(status) ? (
          <>
            <Button variant="secondary" onClick={() => setAction('resend')}>
              Resend invitation
            </Button>
            <Button variant="danger" onClick={() => setAction('cancel')}>
              Cancel invitation
            </Button>
          </>
        ) : null}
        {status === 'ACTIVE' ? (
          <Button variant="danger" onClick={() => setAction('suspend')}>
            Suspend engineer
          </Button>
        ) : null}
        {status === 'SUSPENDED' || status === 'DEACTIVATED' ? (
          <Button onClick={() => setAction('reactivate')}>Reactivate engineer</Button>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Profile overview</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {[
              ['Phone', engineer.profile.phone || '—'],
              ['Specialization', engineer.profile.specialization || '—'],
              ['Experience', humanize(engineer.profile.experienceLevel)],
              ['Employment', humanize(engineer.profile.employmentType)],
              ['Availability', humanize(engineer.profile.availability)],
              ['Weekly capacity', `${Number(engineer.profile.weeklyCapacityHours)} hours`],
            ].map(([name, value]) => (
              <div key={name}>
                <dt className="text-muted">{name}</dt>
                <dd className="font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Technical skills</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {engineer.profile.skills.length ? (
                engineer.profile.skills.map((skill) => <Badge key={skill}>{skill}</Badge>)
              ) : (
                <span className="text-sm text-muted">No skills recorded.</span>
              )}
            </div>
          </div>
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Assignment overview</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Active projects</dt>
              <dd className="text-2xl font-semibold">{activeAssignments.length}</dd>
            </div>
            <div>
              <dt className="text-muted">Assignment records</dt>
              <dd className="text-2xl font-semibold">
                {assignments.data ? allAssignments.length : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Invitation delivery</dt>
              <dd className="font-medium">
                {humanize(engineer.engineerAccountInvitation?.deliveryStatus)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Invitation expires</dt>
              <dd className="font-medium">
                {shortDate(engineer.engineerAccountInvitation?.expiresAt)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted">
            Project access depends on an accepted assignment and an active account.
          </p>
        </section>
      </div>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Assigned projects and history</h2>
        {assignments.isLoading ? (
          <LoadingState rows={2} />
        ) : assignments.isError ? (
          <ErrorState
            description="Could not load assignments."
            onRetry={() => void assignments.refetch()}
          />
        ) : allAssignments.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="p-2">Project</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Start</th>
                  <th className="p-2">Expected end</th>
                  <th className="p-2">Workload</th>
                </tr>
              </thead>
              <tbody>
                {allAssignments.map((item) => (
                  <tr
                    key={`${item.status}-${item.id}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="p-2">
                      <Link
                        className="text-brand hover:underline"
                        to={`/projects/${item.project.id}`}
                      >
                        {item.project.name}
                      </Link>
                    </td>
                    <td className="p-2">{humanize(item.role)}</td>
                    <td className="p-2">{humanize(item.status)}</td>
                    <td className="p-2">{shortDate(item.startDate)}</td>
                    <td className="p-2">{shortDate(item.expectedEndDate)}</td>
                    <td className="p-2">
                      {item.estimatedHours == null ? '—' : `${Number(item.estimatedHours)} h`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No project assignments" />
        )}
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Activity history</h2>
        {activity.isLoading ? (
          <LoadingState rows={2} />
        ) : activity.isError ? (
          <ErrorState
            description="Could not load activity history."
            onRetry={() => void activity.refetch()}
          />
        ) : activity.data?.length ? (
          <ol className="mt-3 space-y-2 text-sm">
            {activity.data.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap justify-between gap-2 border-b border-border py-2"
              >
                <span>{humanize(event.action)}</span>
                <time className="text-muted">{shortDate(event.createdAt ?? event.occurredAt)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No activity recorded" />
        )}
      </section>
      <EngineerOperationalOverview
        engineerId={id}
        weeklyCapacityHours={Number(engineer.profile.weeklyCapacityHours)}
      />
      <EngineerSkillsSchedule userId={id} />
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit engineer profile">
        <form
          className="max-h-[75vh] space-y-3 overflow-y-auto"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Input
            label="Phone"
            maxLength={40}
            value={profile.phone ?? ''}
            onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
          />
          <Input
            label="Job title"
            maxLength={120}
            required
            value={profile.jobTitle ?? ''}
            onChange={(event) => setProfile({ ...profile, jobTitle: event.target.value })}
          />
          <Input
            label="Specialization"
            maxLength={120}
            required
            value={profile.specialization ?? ''}
            onChange={(event) => setProfile({ ...profile, specialization: event.target.value })}
          />
          <Input
            label="Skills (comma separated)"
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
          />
          <label className="block text-sm">
            Experience level
            <select
              className="mt-1 w-full rounded border border-border bg-surface p-3"
              value={profile.experienceLevel ?? 'MID'}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  experienceLevel: event.target.value as EngineerAccountInput['experienceLevel'],
                })
              }
            >
              <option value="JUNIOR">Junior</option>
              <option value="MID">Mid-level</option>
              <option value="SENIOR">Senior</option>
              <option value="PRINCIPAL">Principal</option>
            </select>
          </label>
          <label className="block text-sm">
            Employment type
            <select
              className="mt-1 w-full rounded border border-border bg-surface p-3"
              value={profile.employmentType ?? 'FULL_TIME'}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  employmentType: event.target.value as EngineerAccountInput['employmentType'],
                })
              }
            >
              <option value="FULL_TIME">Full-time</option>
              <option value="PART_TIME">Part-time</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </label>
          <Input
            label="Weekly capacity (hours)"
            type="number"
            min={1}
            max={80}
            step={0.5}
            value={profile.weeklyCapacityHours ?? 40}
            onChange={(event) =>
              setProfile({ ...profile, weeklyCapacityHours: Number(event.target.value) })
            }
          />
          <label className="block text-sm">
            Availability
            <select
              className="mt-1 w-full rounded border border-border bg-surface p-3"
              value={profile.availability ?? 'AVAILABLE'}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  availability: event.target.value as EngineerAccountInput['availability'],
                })
              }
            >
              <option value="AVAILABLE">Available</option>
              <option value="LIMITED">Limited</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </label>
          {save.isError ? (
            <p role="alert" className="text-sm text-error">
              {save.error.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={save.isPending}>
              Save profile
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={Boolean(action)} onClose={() => setAction(null)} title="Confirm account action">
        <p className="text-sm text-muted">
          {action === 'resend'
            ? `Send a new invitation to ${engineer.email}?`
            : action === 'cancel'
              ? `Cancel the pending invitation for ${engineer.name}?`
              : action === 'suspend'
                ? `Suspend ${engineer.name} and revoke active access?`
                : `Reactivate ${engineer.name}?`}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAction(null)}>
            Keep account
          </Button>
          <Button
            variant={action === 'cancel' || action === 'suspend' ? 'danger' : 'primary'}
            isLoading={statusMutation.isPending}
            onClick={() => {
              if (action) statusMutation.mutate(action);
            }}
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </section>
  );
}
