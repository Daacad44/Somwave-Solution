import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { accountsApi, type EngineerAccountInput, type EngineerAccountStatus } from './accountsApi';
import { engineeringApi } from './api';
import { skillCategories, skillLevels, skillsScheduleApi } from './skillsScheduleApi';

const PAGE_SIZE = 10;
const SPECIALIZATIONS = [
  'Frontend Engineer',
  'Backend Engineer',
  'Full-Stack Engineer',
  'Mobile Developer',
  'DevOps Engineer',
  'UI/UX Designer',
  'QA Engineer',
  'Database Engineer',
  'Software Architect',
];
const initialInput: EngineerAccountInput = {
  name: '',
  email: '',
  jobTitle: '',
  specialization: 'Frontend Engineer',
  skills: [],
  experienceLevel: 'MID',
  employmentType: 'FULL_TIME',
  weeklyCapacityHours: 40,
  availability: 'AVAILABLE',
};
const statusTone = (status: EngineerAccountStatus): 'success' | 'warning' | 'error' | 'neutral' =>
  status === 'ACTIVE'
    ? 'success'
    : status === 'SUSPENDED' || status === 'DEACTIVATED'
      ? 'error'
      : 'warning';
const label = (value: string): string =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
const deliveryLabel = (value: string): string =>
  value === 'ACCEPTED' ? 'Accepted by Resend' : label(value);

export function EngineerDirectory(): ReactNode {
  const client = useQueryClient();
  const accounts = useQuery({ queryKey: ['engineer-accounts'], queryFn: accountsApi.list });
  const overview = useQuery({
    queryKey: ['engineering-team-overview'],
    queryFn: accountsApi.overview,
  });
  const projects = useQuery({
    queryKey: ['engineering-projects'],
    queryFn: engineeringApi.projects,
  });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [specialization, setSpecialization] = useState('ALL');
  const [availability, setAvailability] = useState('ALL');
  const [projectId, setProjectId] = useState('ALL');
  const [workload, setWorkload] = useState('ALL');
  const [taskStatus, setTaskStatus] = useState('ALL');
  const [skillName, setSkillName] = useState('');
  const [skillCategory, setSkillCategory] = useState('ALL');
  const [skillLevel, setSkillLevel] = useState('ALL');
  const skillFilterActive = Boolean(
    skillName.trim() || skillCategory !== 'ALL' || skillLevel !== 'ALL',
  );
  const skillMatches = useQuery({
    queryKey: ['engineer-skill-search', skillName.trim(), skillCategory, skillLevel],
    queryFn: () =>
      skillsScheduleApi.search({
        ...(skillName.trim() ? { name: skillName.trim() } : {}),
        ...(skillCategory !== 'ALL' ? { category: skillCategory } : {}),
        ...(skillLevel !== 'ALL' ? { level: skillLevel } : {}),
      }),
    enabled: skillFilterActive,
  });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const emailStatus = useQuery({
    queryKey: ['engineer-email-readiness'],
    queryFn: accountsApi.emailReadiness,
    enabled: open,
    staleTime: 0,
  });
  const [input, setInput] = useState<EngineerAccountInput>(initialInput);
  const [skillsText, setSkillsText] = useState('');
  const [message, setMessage] = useState('');
  const filtered = useMemo(
    () =>
      (accounts.data ?? []).filter((account) => {
        const term = search.trim().toLowerCase();
        return (
          (!term ||
            `${account.name} ${account.email} ${account.profile?.skills?.join(' ') ?? ''}`
              .toLowerCase()
              .includes(term)) &&
          (status === 'ALL' || account.profile?.status === status) &&
          (specialization === 'ALL' || account.profile?.specialization === specialization) &&
          (availability === 'ALL' || account.profile?.availability === availability) &&
          (projectId === 'ALL' || account.projectIds?.includes(projectId)) &&
          (taskStatus === 'ALL' || account.taskStatuses?.includes(taskStatus)) &&
          (!skillFilterActive ||
            (skillMatches.data?.some((match) => match.userId === account.id) ?? false)) &&
          (workload === 'ALL' ||
            (workload === 'AT_CAPACITY'
              ? Number(account.workloadHours ?? 0) >=
                Number(account.profile?.weeklyCapacityHours ?? 0)
              : workload === 'NEAR_CAPACITY'
                ? Number(account.workloadHours ?? 0) >=
                    0.8 * Number(account.profile?.weeklyCapacityHours ?? 0) &&
                  Number(account.workloadHours ?? 0) <
                    Number(account.profile?.weeklyCapacityHours ?? 0)
                : Number(account.workloadHours ?? 0) <
                  0.8 * Number(account.profile?.weeklyCapacityHours ?? 0)))
        );
      }),
    [
      accounts.data,
      search,
      status,
      specialization,
      availability,
      projectId,
      workload,
      taskStatus,
      skillFilterActive,
      skillMatches.data,
    ],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const create = useMutation({
    mutationFn: accountsApi.create,
    onSuccess: (result) => {
      setOpen(false);
      setInput(initialInput);
      setSkillsText('');
      setMessage(
        result.engineerAccountInvitation?.deliveryStatus === 'ACCEPTED'
          ? 'Engineer invitation accepted by Resend. The engineer can verify and activate their account using the email link.'
          : `Engineer invitation created. Email status: ${deliveryLabel(result.engineerAccountInvitation?.deliveryStatus ?? 'PENDING')}.`,
      );
      void client.invalidateQueries({ queryKey: ['engineer-accounts'] });
      void client.invalidateQueries({ queryKey: ['engineering-team-overview'] });
    },
    onError: (error: Error) => {
      setMessage(error.message);
      void client.invalidateQueries({ queryKey: ['engineer-accounts'] });
      void client.invalidateQueries({ queryKey: ['engineering-team-overview'] });
    },
  });
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setMessage('');
    const skills = [
      ...new Set(
        skillsText
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
      ),
    ];
    if (skills.length > 40 || skills.some((skill) => skill.length > 80)) {
      setMessage('Enter at most 40 skills, with up to 80 characters each.');
      return;
    }
    create.mutate({
      ...input,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      skills,
    });
  };

  return (
    <section
      className="space-y-4 rounded-lg border border-border bg-surface p-4 md:p-5"
      aria-label="Engineering team directory"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Engineering team</h2>
          <p className="text-sm text-muted">
            Manage engineer accounts, invitations, availability and profiles.
          </p>
        </div>
        <Button
          onClick={() => {
            setMessage('');
            setOpen(true);
          }}
        >
          Register engineer
        </Button>
      </div>
      {message ? (
        <p role="status" className="text-sm text-ink">
          {message}
        </p>
      ) : null}
      {overview.isError ? (
        <ErrorState
          description="Could not load engineering team overview."
          onRetry={() => void overview.refetch()}
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ['Total engineers', 'totalEngineers'],
            ['Active engineers', 'activeEngineers'],
            ['Pending invitations', 'pendingInvitations'],
            ['Pending project acceptances', 'pendingProjectAcceptances'],
            ['Available engineers', 'availableEngineers'],
            ['At capacity', 'engineersAtCapacity'],
            ['Assigned projects', 'totalAssignedProjects'],
            ['Active engineering tasks', 'activeEngineeringTasks'],
            ['Overdue tasks', 'overdueTasks'],
            ['Projects at risk', 'projectsAtRisk'],
          ] as const
        ).map(([name, key]) => (
          <div key={name} className="rounded-md border border-border bg-surface-alt p-3">
            <p className="text-sm text-muted">{name}</p>
            <p className="text-2xl font-semibold text-ink">{overview.data?.[key] ?? '—'}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <Input
          aria-label="Search engineers"
          placeholder="Search name, email or skills"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filter account status"
          className="rounded border border-border bg-surface p-2"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All account statuses</option>
          {(
            [
              'INVITED',
              'PENDING_VERIFICATION',
              'PENDING_ACTIVATION',
              'ACTIVE',
              'SUSPENDED',
              'DEACTIVATED',
            ] as const
          ).map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter specialization"
          className="rounded border border-border bg-surface p-2"
          value={specialization}
          onChange={(event) => {
            setSpecialization(event.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All specializations</option>
          {SPECIALIZATIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter availability"
          className="rounded border border-border bg-surface p-2"
          value={availability}
          onChange={(event) => {
            setAvailability(event.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All availability</option>
          <option value="AVAILABLE">Available</option>
          <option value="LIMITED">Limited</option>
          <option value="UNAVAILABLE">Unavailable</option>
        </select>
        <select
          aria-label="Filter project"
          className="rounded border border-border bg-surface p-2"
          value={projectId}
          onChange={(event) => {
            setProjectId(event.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All projects</option>
          {projects.data?.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter workload"
          className="rounded border border-border bg-surface p-2"
          value={workload}
          onChange={(event) => {
            setWorkload(event.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All workloads</option>
          <option value="AVAILABLE">Below 80% capacity</option>
          <option value="NEAR_CAPACITY">Near capacity</option>
          <option value="AT_CAPACITY">At or over capacity</option>
        </select>
        <select
          aria-label="Filter task status"
          className="rounded border border-border bg-surface p-2"
          value={taskStatus}
          onChange={(event) => {
            setTaskStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All task statuses</option>
          {['BACKLOG', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'TESTING', 'DONE'].map(
            (value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ),
          )}
        </select>
        <Input
          aria-label="Search structured skills"
          placeholder="Structured skill name"
          value={skillName}
          onChange={(event) => {
            setSkillName(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filter skill category"
          className="rounded border border-border bg-surface p-2"
          value={skillCategory}
          onChange={(event) => {
            setSkillCategory(event.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All skill categories</option>
          {skillCategories.map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter skill level"
          className="rounded border border-border bg-surface p-2"
          value={skillLevel}
          onChange={(event) => {
            setSkillLevel(event.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All skill levels</option>
          {skillLevels.map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
      </div>
      {skillMatches.isError ? (
        <ErrorState
          description="Could not search engineer skills."
          onRetry={() => void skillMatches.refetch()}
        />
      ) : null}
      {accounts.isLoading || (skillFilterActive && skillMatches.isLoading) ? (
        <LoadingState rows={4} />
      ) : accounts.isError ? (
        <ErrorState
          description="Could not load engineer accounts."
          onRetry={() => void accounts.refetch()}
        />
      ) : filtered.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="p-2">Engineer</th>
                  <th className="p-2">Specialization</th>
                  <th className="p-2">Account</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Availability</th>
                  <th className="p-2">Projects</th>
                  <th className="p-2">Tasks</th>
                  <th className="p-2">Workload</th>
                  <th className="p-2">Last activity</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                  .map((account) => (
                    <tr key={account.id} className="border-b border-border last:border-0">
                      <td className="p-2">
                        <strong className="text-ink">{account.name}</strong>
                        <br />
                        <span className="text-muted">{account.email}</span>
                      </td>
                      <td className="p-2">{account.profile?.specialization || 'Not specified'}</td>
                      <td className="p-2">
                        <Badge tone={statusTone(account.profile?.status ?? 'INVITED')}>
                          {label(account.profile?.status ?? 'INVITED')}
                        </Badge>
                      </td>
                      <td className="p-2">
                        {account.engineerAccountInvitation
                          ? deliveryLabel(account.engineerAccountInvitation.deliveryStatus)
                          : '—'}
                      </td>
                      <td className="p-2">
                        {label(account.profile?.availability ?? 'UNAVAILABLE')}
                      </td>
                      <td className="p-2">{account.activeProjects ?? '—'}</td>
                      <td className="p-2">{account.assignedTasks ?? '—'}</td>
                      <td className="p-2">
                        {account.workloadHours == null
                          ? '—'
                          : `${Number(account.workloadHours).toFixed(1)} h`}{' '}
                        / {Number(account.profile?.weeklyCapacityHours ?? 0)} h/week
                      </td>
                      <td className="p-2">
                        {account.lastActivity
                          ? new Date(account.lastActivity).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="p-2">
                        <Link
                          className="font-medium text-brand hover:underline"
                          to={`/engineering/engineers/${account.id}`}
                        >
                          View profile
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {filtered.length > PAGE_SIZE ? (
            <nav aria-label="Engineer pages" className="flex items-center justify-between text-sm">
              <span>
                Page {currentPage} of {pages} · {filtered.length} engineers
              </span>
              <span className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage >= pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </span>
            </nav>
          ) : null}
        </>
      ) : (
        <EmptyState
          title={accounts.data?.length ? 'No matching engineers' : 'No engineers registered'}
          description={
            accounts.data?.length
              ? 'Try different search filters.'
              : 'Register the first engineer to send an account invitation.'
          }
        />
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Register engineer">
        <form className="max-h-[75vh] space-y-3 overflow-y-auto pr-1" onSubmit={submit}>
          <p className="text-sm text-muted">
            An invitation will be sent to the engineer’s unique email address.
          </p>
          {emailStatus.isLoading ? (
            <p role="status" className="text-sm text-muted">
              Checking Resend configuration…
            </p>
          ) : emailStatus.isError ? (
            <div role="alert" className="text-sm text-error">
              Could not check email configuration.{' '}
              <button
                type="button"
                className="underline"
                onClick={() => void emailStatus.refetch()}
              >
                Try again
              </button>
            </div>
          ) : emailStatus.data?.configured ? (
            <p role="status" className="text-sm text-muted">
              Resend settings are present. Provider acceptance is confirmed after submission;
              mailbox delivery may take longer.
            </p>
          ) : (
            <p role="alert" className="text-sm text-error">
              Email is not configured. Backend settings needed:{' '}
              {emailStatus.data?.missing.join(', ')}.
            </p>
          )}
          <Input
            label="Full name"
            required
            maxLength={120}
            value={input.name}
            onChange={(event) => setInput({ ...input, name: event.target.value })}
          />
          <Input
            label="Email address"
            type="email"
            required
            maxLength={255}
            value={input.email}
            onChange={(event) => setInput({ ...input, email: event.target.value })}
          />
          <Input
            label="Phone number (optional)"
            type="tel"
            maxLength={40}
            value={input.phone ?? ''}
            onChange={(event) => setInput({ ...input, phone: event.target.value })}
          />
          <Input
            label="Job title"
            required
            maxLength={120}
            value={input.jobTitle}
            onChange={(event) => setInput({ ...input, jobTitle: event.target.value })}
          />
          <label className="block text-sm">
            Specialization
            <select
              className="mt-1 w-full rounded border border-border bg-surface p-3"
              value={input.specialization}
              onChange={(event) => setInput({ ...input, specialization: event.target.value })}
            >
              {SPECIALIZATIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Technical skills (comma separated)"
            value={skillsText}
            onChange={(event) => setSkillsText(event.target.value)}
          />
          <label className="block text-sm">
            Experience level
            <select
              className="mt-1 w-full rounded border border-border bg-surface p-3"
              value={input.experienceLevel}
              onChange={(event) =>
                setInput({
                  ...input,
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
              value={input.employmentType}
              onChange={(event) =>
                setInput({
                  ...input,
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
            label="Weekly working hours"
            type="number"
            min={1}
            max={80}
            step={0.5}
            required
            value={input.weeklyCapacityHours}
            onChange={(event) =>
              setInput({ ...input, weeklyCapacityHours: Number(event.target.value) })
            }
          />
          <label className="block text-sm">
            Availability
            <select
              className="mt-1 w-full rounded border border-border bg-surface p-3"
              value={input.availability}
              onChange={(event) =>
                setInput({
                  ...input,
                  availability: event.target.value as EngineerAccountInput['availability'],
                })
              }
            >
              <option value="AVAILABLE">Available</option>
              <option value="LIMITED">Limited</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </label>
          {create.isError ? (
            <p role="alert" className="text-sm text-error">
              {create.error.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={create.isPending}
              disabled={!emailStatus.data?.configured || emailStatus.isFetching}
            >
              Send invitation
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
