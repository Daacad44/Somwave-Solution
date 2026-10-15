import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProjectSchema,
  PERMISSIONS,
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  type CreateProjectInput,
} from '@somwave/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { useCurrentUser } from '../../auth/hooks';
import { useHasPermission } from '../../../lib/rbac';
import { listClients } from '../../ops/api';
import { listUsers } from '../../users-roles/api';
import { engineeringApi } from '../../engineering/api';
import { createMilestone } from '../../milestones/api';
import { createTask } from '../../tasks/api';
import { useCreateProject } from '../hooks';
import { inviteSelectedEngineers } from '../assignment';
import {
  emptyAssignmentDraft,
  ProjectAssignmentFields,
  validateAssignmentDraft,
} from './ProjectAssignmentFields';

type PlanningItem = { title: string; dueDate: string };
const STEPS = ['Project information', 'Project team', 'Initial planning', 'Review & create'];

export function ProjectCreationWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactNode {
  const client = useQueryClient();
  const currentUser = useCurrentUser();
  const canManageEngineers = useHasPermission(PERMISSIONS.ENGINEERING_MANAGE);
  const canReadClients = useHasPermission(PERMISSIONS.CLIENTS_READ);
  const canReadUsers = useHasPermission(PERMISSIONS.USERS_READ);
  const canCreateMilestones = useHasPermission(PERMISSIONS.MILESTONES_CREATE);
  const canCreateTasks = useHasPermission(PERMISSIONS.TASKS_CREATE);
  const canEditBudget = useHasPermission(PERMISSIONS.INVOICES_UPDATE);
  const clients = useQuery({
    queryKey: ['project-wizard-clients'],
    queryFn: listClients,
    enabled: canReadClients,
  });
  const managers = useQuery({
    queryKey: ['project-wizard-managers'],
    enabled: canReadUsers,
    queryFn: async () => {
      const first = await listUsers({ page: 1, pageSize: 100 });
      const rows = [...first.data];
      for (let page = 2; page <= Math.ceil(first.meta.total / 100); page += 1)
        rows.push(...(await listUsers({ page, pageSize: 100 })).data);
      return rows.filter(
        (user) =>
          user.isActive &&
          user.roles.some((role) => ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(role)),
      );
    },
  });
  const create = useCreateProject();
  const [step, setStep] = useState(0);
  const [info, setInfo] = useState<CreateProjectInput>({
    name: '',
    description: '',
    status: 'PLANNING',
    priority: 'MEDIUM',
  });
  const [assignment, setAssignment] = useState(emptyAssignmentDraft);
  const [phases, setPhases] = useState<PlanningItem[]>([]);
  const [milestones, setMilestones] = useState<PlanningItem[]>([]);
  const [tasks, setTasks] = useState<PlanningItem[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const next = () => {
    setError('');
    if (step === 0) {
      const parsed = createProjectSchema.safeParse(info);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Check project information.');
        return;
      }
      if (info.startDate && info.dueDate && info.dueDate < info.startDate) {
        setError('Due date must follow start date.');
        return;
      }
    }
    if (step === 1 && assignment.engineers.length) {
      const validation = validateAssignmentDraft(assignment);
      if (validation) {
        setError(validation);
        return;
      }
    }
    if (step === 2 && [...phases, ...milestones, ...tasks].some((item) => !item.title.trim())) {
      setError('Every planning item needs a title.');
      return;
    }
    setStep(step + 1);
  };

  const submit = async () => {
    setError('');
    setSaving(true);
    try {
      const project = await create.mutateAsync({
        ...info,
        ...(info.budget && canEditBudget ? { budget: info.budget } : { budget: undefined }),
        ...(info.managerId
          ? {}
          : currentUser.data?.roles.some((role) => role === 'MANAGER')
            ? { managerId: currentUser.data.id }
            : {}),
      });
      setCreatedId(project.id);
      const failures: string[] = [];
      for (const item of phases) {
        try {
          await engineeringApi.createPhase(
            project.id,
            item.title.trim(),
            undefined,
            item.dueDate ? new Date(item.dueDate).toISOString() : undefined,
          );
        } catch (issue) {
          failures.push(`Phase ${item.title}: ${String(issue)}`);
        }
      }
      for (const [index, item] of milestones.entries()) {
        try {
          await createMilestone({
            projectId: project.id,
            title: item.title.trim(),
            status: 'PENDING',
            clientVisible: false,
            dueDate: item.dueDate || undefined,
            order: index,
          });
        } catch (issue) {
          failures.push(`Milestone ${item.title}: ${String(issue)}`);
        }
      }
      for (const item of tasks) {
        try {
          await createTask({
            projectId: project.id,
            title: item.title.trim(),
            status: 'TODO',
            priority: 'MEDIUM',
            dueDate: item.dueDate || undefined,
          });
        } catch (issue) {
          failures.push(`Task ${item.title}: ${String(issue)}`);
        }
      }
      if (assignment.engineers.length) {
        const invites = await inviteSelectedEngineers(project.id, assignment);
        failures.push(
          ...invites.failed.map((item) => `Invitation ${item.engineer}: ${item.error}`),
        );
      }
      await client.invalidateQueries({ queryKey: ['projects'] });
      setResult(
        failures.length
          ? `Project saved. Review and retry these items in its workspace: ${failures.join('; ')}`
          : assignment.engineers.length
            ? 'Project created. Invitations are pending until each engineer accepts.'
            : 'Project created without engineers. Assign engineers from the project workspace when ready.',
      );
    } catch (issue) {
      setError(String(issue));
    } finally {
      setSaving(false);
    }
  };

  const updatePlanning = (
    items: PlanningItem[],
    setItems: (value: PlanningItem[]) => void,
    index: number,
    key: keyof PlanningItem,
    value: string,
  ) =>
    setItems(
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  const planningSection = (
    label: string,
    items: PlanningItem[],
    setItems: (value: PlanningItem[]) => void,
  ) => (
    <section className="space-y-2 rounded border border-border p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{label}</h3>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setItems([...items, { title: '', dueDate: '' }])}
        >
          Add
        </Button>
      </div>
      {items.map((item, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <Input
            label={`${label} ${index + 1}`}
            value={item.title}
            onChange={(event) =>
              updatePlanning(items, setItems, index, 'title', event.target.value)
            }
          />
          <Input
            label="Deadline"
            type="date"
            value={item.dueDate}
            onChange={(event) =>
              updatePlanning(items, setItems, index, 'dueDate', event.target.value)
            }
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}
          >
            Remove
          </Button>
        </div>
      ))}
    </section>
  );

  return (
    <Modal open={open} wide onClose={onClose} title="New project">
      <p className="mb-4 text-sm text-muted">
        Step {step + 1} of 4 · {STEPS[step]}
      </p>
      {createdId ? (
        <div className="space-y-4">
          <p role="status">{result ?? 'Project saved. Finishing initial setup…'}</p>
          <Link
            className="text-brand underline"
            to={`/projects/${createdId}?tab=team`}
            onClick={onClose}
          >
            Open project workspace
          </Link>
        </div>
      ) : (
        <>
          {step === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Project name"
                required
                value={info.name}
                onChange={(event) => setInfo({ ...info, name: event.target.value })}
              />
              <Select
                label="Status"
                value={info.status}
                onChange={(event) =>
                  setInfo({ ...info, status: event.target.value as CreateProjectInput['status'] })
                }
                options={PROJECT_STATUSES.map((status) => ({
                  value: status,
                  label: status.replaceAll('_', ' '),
                }))}
              />
              <label className="sm:col-span-2 text-sm font-medium">
                Description
                <textarea
                  className="mt-1 w-full rounded border border-border bg-surface p-2"
                  rows={3}
                  value={info.description ?? ''}
                  onChange={(event) => setInfo({ ...info, description: event.target.value })}
                />
              </label>
              <Select
                label="Priority"
                value={info.priority}
                onChange={(event) =>
                  setInfo({
                    ...info,
                    priority: event.target.value as CreateProjectInput['priority'],
                  })
                }
                options={TASK_PRIORITIES.map((priority) => ({ value: priority, label: priority }))}
              />
              {canReadClients ? (
                <Select
                  label="Client"
                  value={info.clientId ?? ''}
                  onChange={(event) =>
                    setInfo({ ...info, clientId: event.target.value || undefined })
                  }
                  options={[
                    { value: '', label: 'No client' },
                    ...(clients.data ?? []).map((client) => ({
                      value: client.id,
                      label: client.companyName,
                    })),
                  ]}
                />
              ) : null}
              {canEditBudget ? (
                <Input
                  label="Budget (USD)"
                  inputMode="decimal"
                  value={info.budget ?? ''}
                  onChange={(event) =>
                    setInfo({ ...info, budget: event.target.value || undefined })
                  }
                />
              ) : null}
              <Input
                label="Start date"
                type="date"
                value={info.startDate ?? ''}
                onChange={(event) =>
                  setInfo({ ...info, startDate: event.target.value || undefined })
                }
              />
              <Input
                label="Due date"
                type="date"
                value={info.dueDate ?? ''}
                onChange={(event) => setInfo({ ...info, dueDate: event.target.value || undefined })}
              />
            </div>
          ) : null}
          {step === 1 ? (
            <div className="space-y-3">
              {canReadUsers ? (
                <Select
                  label="Project manager"
                  value={info.managerId ?? ''}
                  onChange={(event) =>
                    setInfo({ ...info, managerId: event.target.value || undefined })
                  }
                  options={[
                    { value: '', label: 'No manager' },
                    ...(managers.data ?? []).map((user) => ({ value: user.id, label: user.name })),
                  ]}
                />
              ) : null}
              {canManageEngineers ? (
                <ProjectAssignmentFields value={assignment} onChange={setAssignment} />
              ) : (
                <p className="text-sm text-muted">
                  Engineer assignment requires engineering management permission. You can create
                  this project without engineers.
                </p>
              )}
            </div>
          ) : null}
          {step === 2 ? (
            <div className="space-y-3">
              {canManageEngineers ? planningSection('Phase', phases, setPhases) : null}
              {canCreateMilestones ? planningSection('Milestone', milestones, setMilestones) : null}
              {canCreateTasks ? planningSection('Task', tasks, setTasks) : null}
              <p className="text-sm text-muted">
                Initial planning is optional. Documents and detailed scheduling can be added in the
                project workspace.
              </p>
            </div>
          ) : null}
          {step === 3 ? (
            <div className="space-y-2 text-sm">
              <p>
                <strong>{info.name}</strong> · {info.status} · {info.priority} priority
              </p>
              <p>
                Manager:{' '}
                {managers.data?.find((person) => person.id === info.managerId)?.name ??
                  'Not selected'}
              </p>
              <p>
                Engineers:{' '}
                {assignment.engineers
                  .map((person) => `${person.name} (${person.role.replaceAll('_', ' ')})`)
                  .join(', ') || 'None'}
              </p>
              <p>
                Planning: {phases.length} phases, {milestones.length} milestones, {tasks.length}{' '}
                tasks
              </p>
              <p>
                Invitation emails will be queued after the project is saved. Engineers receive
                project access after acceptance.
              </p>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-error">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={step ? () => setStep(step - 1) : onClose}
            >
              {step ? 'Back' : 'Cancel'}
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={next}>
                Next
              </Button>
            ) : (
              <Button type="button" isLoading={saving} onClick={() => void submit()}>
                Create project
              </Button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
