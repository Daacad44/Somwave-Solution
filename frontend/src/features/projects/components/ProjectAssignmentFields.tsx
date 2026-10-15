import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ErrorState, LoadingState } from '../../../components/states';
import { engineeringApi, type EligibleEngineer } from '../../engineering/api';

export const ASSIGNMENT_ROLES = [
  'ENGINEER',
  'LEAD_ENGINEER',
  'QA_ENGINEER',
  'REVIEWER',
  'CONTRIBUTOR',
] as const;

export interface AssignmentSelection {
  id: string;
  email: string;
  name: string;
  role: (typeof ASSIGNMENT_ROLES)[number];
}

export interface AssignmentDraft {
  engineers: AssignmentSelection[];
  description: string;
  responsibilities: string;
  startDate: string;
  expectedEndDate: string;
  estimatedHours: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  managerNotes: string;
}

export function emptyAssignmentDraft(): AssignmentDraft {
  return {
    engineers: [],
    description: '',
    responsibilities: '',
    startDate: '',
    expectedEndDate: '',
    estimatedHours: 40,
    priority: 'MEDIUM',
    managerNotes: '',
  };
}

export function validateAssignmentDraft(value: AssignmentDraft): string | null {
  if (!value.engineers.length) return 'Choose at least one engineer.';
  if (value.engineers.filter((engineer) => engineer.role === 'LEAD_ENGINEER').length > 1)
    return 'Choose only one lead engineer.';
  if (!value.description.trim()) return 'Describe the assignment.';
  if (!value.startDate || !value.expectedEndDate) return 'Set assignment dates.';
  if (value.expectedEndDate < value.startDate) return 'Expected end date must follow start date.';
  if (!Number.isFinite(value.estimatedHours) || value.estimatedHours <= 0)
    return 'Estimated workload must be greater than zero.';
  return null;
}

export function ProjectAssignmentFields({
  projectId,
  value,
  onChange,
  excludeIds = [],
}: {
  projectId?: string;
  value: AssignmentDraft;
  onChange: (value: AssignmentDraft) => void;
  excludeIds?: string[];
}): ReactNode {
  const [search, setSearch] = useState('');
  const candidates = useQuery({
    queryKey: ['assignment-candidates', projectId ?? 'new', search],
    queryFn: () =>
      projectId
        ? engineeringApi.eligibleEngineers(projectId, search)
        : engineeringApi.eligibleEngineersForNewProject(search),
  });
  const selected = new Set(value.engineers.map((person) => person.id));
  const excluded = new Set(excludeIds);
  const toggle = (person: EligibleEngineer): void => {
    onChange({
      ...value,
      engineers: selected.has(person.id)
        ? value.engineers.filter((item) => item.id !== person.id)
        : [
            ...value.engineers,
            { id: person.id, email: person.email, name: person.name, role: 'ENGINEER' },
          ],
    });
  };
  return (
    <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
      <Input
        label="Find active engineers"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by name or email"
      />
      {candidates.isLoading ? <LoadingState rows={2} /> : null}
      {candidates.isError ? (
        <ErrorState
          description="Could not load engineers."
          onRetry={() => void candidates.refetch()}
        />
      ) : null}
      {candidates.data ? (
        <div className="max-h-44 space-y-2 overflow-y-auto rounded border border-border p-2">
          {candidates.data
            .filter((person) => !excluded.has(person.id))
            .map((person) => (
              <label
                key={person.id}
                className="flex cursor-pointer gap-2 rounded p-2 hover:bg-surface-alt"
              >
                <input
                  type="checkbox"
                  checked={selected.has(person.id)}
                  onChange={() => toggle(person)}
                  className="mt-1"
                />
                <span className="text-sm">
                  <strong>{person.name}</strong> · {person.email} · Active account
                  <span className="block text-muted">
                    {person.specialization || 'Engineer'} · {person.availability.toLowerCase()} ·{' '}
                    {person.estimatedHoursThisWeek}/{person.availableHoursThisWeek} hours this week
                    {person.nearCapacity ? ' · Capacity warning' : ''}
                  </span>
                </span>
              </label>
            ))}
          {!candidates.data.length ? (
            <p className="text-sm text-muted">No eligible engineers found.</p>
          ) : null}
        </div>
      ) : null}
      {value.engineers.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Selected engineers</p>
          {value.engineers.map((person) => (
            <div
              key={person.id}
              className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-sm"
            >
              <span className="min-w-0 flex-1">{person.name}</span>
              <select
                aria-label={`Project role for ${person.name}`}
                value={person.role}
                onChange={(event) =>
                  onChange({
                    ...value,
                    engineers: value.engineers.map((item) =>
                      item.id === person.id
                        ? { ...item, role: event.target.value as AssignmentSelection['role'] }
                        : item,
                    ),
                  })
                }
                className="rounded border border-border bg-surface p-2"
              >
                {ASSIGNMENT_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  onChange({
                    ...value,
                    engineers: value.engineers.filter((item) => item.id !== person.id),
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <Input
        label="Assignment description"
        maxLength={2000}
        required
        value={value.description}
        onChange={(event) => onChange({ ...value, description: event.target.value })}
      />
      <Input
        label="Responsibilities"
        maxLength={2000}
        value={value.responsibilities}
        onChange={(event) => onChange({ ...value, responsibilities: event.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Start date"
          type="date"
          required
          value={value.startDate}
          onChange={(event) => onChange({ ...value, startDate: event.target.value })}
        />
        <Input
          label="Expected end date"
          type="date"
          required
          min={value.startDate}
          value={value.expectedEndDate}
          onChange={(event) => onChange({ ...value, expectedEndDate: event.target.value })}
        />
      </div>
      <Input
        label="Estimated workload (hours per engineer)"
        type="number"
        min={0.5}
        max={10000}
        step={0.5}
        required
        value={value.estimatedHours}
        onChange={(event) => onChange({ ...value, estimatedHours: Number(event.target.value) })}
      />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Priority
        <select
          value={value.priority}
          onChange={(event) =>
            onChange({ ...value, priority: event.target.value as AssignmentDraft['priority'] })
          }
          className="h-11 rounded border border-border bg-surface px-3"
        >
          {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </label>
      <Input
        label="Manager notes"
        maxLength={2000}
        value={value.managerNotes}
        onChange={(event) => onChange({ ...value, managerNotes: event.target.value })}
      />
    </div>
  );
}
