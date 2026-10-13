import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import {
  skillCategories,
  skillLevels,
  skillsScheduleApi,
  type StructuredSkill,
  type WeeklySlot,
} from './skillsScheduleApi';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const toMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};
const emptySkill = (): StructuredSkill => ({
  category: 'FRONTEND',
  name: '',
  level: 'INTERMEDIATE',
  experienceYears: 0,
  isPrimary: false,
});
const emptySlot = (): WeeklySlot => ({ weekday: 1, startMinute: 540, endMinute: 1020 });
const nice = (value: string): string =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());

export function EngineerSkillsSchedule({ userId }: { userId?: string }): ReactNode {
  const client = useQueryClient();
  const own = !userId;
  const skills = useQuery({
    queryKey: ['engineer-structured-skills', userId ?? 'me'],
    queryFn: () => skillsScheduleApi.skills(userId),
  });
  const schedule = useQuery({
    queryKey: ['engineer-weekly-schedule', userId ?? 'me'],
    queryFn: () => skillsScheduleApi.schedule(userId),
  });
  const [draftSkills, setDraftSkills] = useState<StructuredSkill[]>([]);
  const [secondary, setSecondary] = useState('');
  const [draftSlots, setDraftSlots] = useState<WeeklySlot[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (skills.data) {
      setDraftSkills(skills.data.skills);
      setSecondary(skills.data.profile.secondarySpecializations.join(', '));
    }
  }, [skills.data]);
  useEffect(() => {
    if (schedule.data) setDraftSlots(schedule.data.slots);
  }, [schedule.data]);
  const saveSkills = useMutation({
    mutationFn: () =>
      skillsScheduleApi.saveSkills({
        skills: draftSkills.map(({ category, name, level, experienceYears, isPrimary }) => ({
          category,
          name: name.trim(),
          level,
          experienceYears: Number(experienceYears),
          isPrimary,
        })),
        secondarySpecializations: [
          ...new Set(
            secondary
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ],
      }),
    onSuccess: () => {
      setMessage('Skills saved.');
      void client.invalidateQueries({ queryKey: ['engineer-structured-skills'] });
      void client.invalidateQueries({ queryKey: ['my-engineer-profile'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const saveSchedule = useMutation({
    mutationFn: () =>
      skillsScheduleApi.saveSchedule({
        slots: draftSlots.map(({ weekday, startMinute, endMinute }) => ({
          weekday,
          startMinute,
          endMinute,
        })),
      }),
    onSuccess: () => {
      setMessage('Weekly schedule saved. Capacity has been recalculated.');
      void client.invalidateQueries({ queryKey: ['engineer-weekly-schedule'] });
      void client.invalidateQueries({ queryKey: ['my-engineer-profile'] });
      void client.invalidateQueries({ queryKey: ['engineer-team'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const updateSkill = (index: number, value: StructuredSkill): void =>
    setDraftSkills(draftSkills.map((item, position) => (position === index ? value : item)));
  const updateSlot = (index: number, value: WeeklySlot): void =>
    setDraftSlots(draftSlots.map((item, position) => (position === index ? value : item)));
  const submitSkills = (event: FormEvent): void => {
    event.preventDefault();
    if (draftSkills.filter((item) => item.isPrimary).length > 1) {
      setMessage('Choose only one primary skill.');
      return;
    }
    saveSkills.mutate();
  };
  const submitSchedule = (event: FormEvent): void => {
    event.preventDefault();
    const sorted = [...draftSlots].sort(
      (a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute,
    );
    if (
      sorted.some(
        (slot, index) =>
          slot.endMinute <= slot.startMinute ||
          (index > 0 &&
            sorted[index - 1]?.weekday === slot.weekday &&
            sorted[index - 1]!.endMinute > slot.startMinute),
      )
    ) {
      setMessage('Working hours must not overlap and end after they start.');
      return;
    }
    saveSchedule.mutate();
  };
  return (
    <section
      className="space-y-4"
      aria-label={own ? 'My skills and working schedule' : 'Engineer skills and schedule'}
    >
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Technical skills</h2>
          {skills.isLoading ? (
            <LoadingState rows={2} />
          ) : skills.isError ? (
            <ErrorState
              description="Could not load structured skills."
              onRetry={() => void skills.refetch()}
            />
          ) : own ? (
            <form className="mt-3 space-y-3" onSubmit={submitSkills}>
              <p className="text-sm text-muted">
                Primary specialization: {skills.data?.profile.specialization || 'Not specified'}
              </p>
              {draftSkills.map((skill, index) => (
                <fieldset
                  key={skill.id ?? index}
                  className="grid gap-2 rounded border border-border p-3 sm:grid-cols-2"
                >
                  <legend className="px-1 text-sm font-medium">Skill {index + 1}</legend>
                  <Input
                    aria-label={`Skill ${index + 1} name`}
                    placeholder="Skill name"
                    required
                    maxLength={80}
                    value={skill.name}
                    onChange={(event) => updateSkill(index, { ...skill, name: event.target.value })}
                  />
                  <select
                    aria-label={`Skill ${index + 1} category`}
                    className="rounded border border-border bg-surface p-2"
                    value={skill.category}
                    onChange={(event) =>
                      updateSkill(index, {
                        ...skill,
                        category: event.target.value as StructuredSkill['category'],
                      })
                    }
                  >
                    {skillCategories.map((value) => (
                      <option key={value} value={value}>
                        {nice(value)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Skill ${index + 1} level`}
                    className="rounded border border-border bg-surface p-2"
                    value={skill.level}
                    onChange={(event) =>
                      updateSkill(index, {
                        ...skill,
                        level: event.target.value as StructuredSkill['level'],
                      })
                    }
                  >
                    {skillLevels.map((value) => (
                      <option key={value} value={value}>
                        {nice(value)}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label={`Skill ${index + 1} experience years`}
                    type="number"
                    min={0}
                    max={99.9}
                    step={0.1}
                    value={skill.experienceYears}
                    onChange={(event) =>
                      updateSkill(index, { ...skill, experienceYears: Number(event.target.value) })
                    }
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={skill.isPrimary}
                      onChange={(event) =>
                        setDraftSkills(
                          draftSkills.map((item, position) => ({
                            ...item,
                            isPrimary: position === index ? event.target.checked : false,
                          })),
                        )
                      }
                    />
                    Primary skill
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setDraftSkills(draftSkills.filter((_, position) => position !== index))
                    }
                  >
                    Remove skill
                  </Button>
                </fieldset>
              ))}
              <Input
                label="Secondary specializations (comma separated)"
                value={secondary}
                onChange={(event) => setSecondary(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={draftSkills.length >= 40}
                  onClick={() => setDraftSkills([...draftSkills, emptySkill()])}
                >
                  Add skill
                </Button>
                <Button type="submit" isLoading={saveSkills.isPending}>
                  Save skills
                </Button>
              </div>
            </form>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">
                Primary specialization: {skills.data?.profile.specialization || 'Not specified'}
              </p>
              <p className="mt-1 text-sm text-muted">
                Secondary: {skills.data?.profile.secondarySpecializations.join(', ') || 'None'}
              </p>
              {skills.data?.skills.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {skills.data.skills.map((skill) => (
                    <li key={skill.id ?? skill.name} className="rounded bg-surface-alt p-2">
                      {skill.name} · {nice(skill.category)} · {nice(skill.level)} ·{' '}
                      {Number(skill.experienceYears)} years{skill.isPrimary ? ' · Primary' : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No structured skills recorded" />
              )}
            </>
          )}
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Weekly working schedule</h2>
          {schedule.isLoading ? (
            <LoadingState rows={2} />
          ) : schedule.isError ? (
            <ErrorState
              description="Could not load weekly schedule."
              onRetry={() => void schedule.refetch()}
            />
          ) : own ? (
            <form className="mt-3 space-y-3" onSubmit={submitSchedule}>
              <p className="text-sm text-muted">
                Times use {schedule.data?.profile.timezone || 'UTC'}. Saving recalculates available
                weekly hours.
              </p>
              {draftSlots.map((slot, index) => (
                <div
                  key={slot.id ?? index}
                  className="grid gap-2 rounded border border-border p-3 sm:grid-cols-4"
                >
                  <select
                    aria-label={`Working slot ${index + 1} day`}
                    className="rounded border border-border bg-surface p-2"
                    value={slot.weekday}
                    onChange={(event) =>
                      updateSlot(index, { ...slot, weekday: Number(event.target.value) })
                    }
                  >
                    {DAYS.map((name, day) => (
                      <option key={name} value={day + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label={`Working slot ${index + 1} start`}
                    type="time"
                    value={toTime(slot.startMinute)}
                    onChange={(event) =>
                      updateSlot(index, { ...slot, startMinute: toMinutes(event.target.value) })
                    }
                  />
                  <Input
                    aria-label={`Working slot ${index + 1} end (00:00 means midnight)`}
                    type="time"
                    value={slot.endMinute === 1440 ? '00:00' : toTime(slot.endMinute)}
                    onChange={(event) =>
                      updateSlot(index, {
                        ...slot,
                        endMinute:
                          event.target.value === '00:00' ? 1440 : toMinutes(event.target.value),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setDraftSlots(draftSlots.filter((_, position) => position !== index))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={draftSlots.length >= 42}
                  onClick={() => setDraftSlots([...draftSlots, emptySlot()])}
                >
                  Add working period
                </Button>
                <Button type="submit" isLoading={saveSchedule.isPending}>
                  Save schedule
                </Button>
              </div>
            </form>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">
                {schedule.data?.profile.timezone || 'UTC'} ·{' '}
                {Number(schedule.data?.profile.weeklyCapacityHours ?? 0)} hours/week
              </p>
              {schedule.data?.slots.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {schedule.data.slots.map((slot) => (
                    <li
                      key={slot.id ?? `${slot.weekday}-${slot.startMinute}`}
                      className="rounded bg-surface-alt p-2"
                    >
                      {DAYS[slot.weekday - 1]} · {toTime(slot.startMinute)}–{toTime(slot.endMinute)}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No working schedule recorded" />
              )}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
