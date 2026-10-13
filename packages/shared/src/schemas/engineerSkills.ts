import { z } from 'zod';

export const ENGINEER_SKILL_CATEGORIES = [
  'FRONTEND',
  'BACKEND',
  'MOBILE',
  'DEVOPS',
  'DESIGN',
  'QA',
  'DATABASE',
  'SECURITY',
  'ARCHITECTURE',
  'OTHER',
] as const;
export const ENGINEER_SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

export const engineerSkillCategorySchema = z.enum(ENGINEER_SKILL_CATEGORIES);
export const engineerSkillLevelSchema = z.enum(ENGINEER_SKILL_LEVELS);

export const replaceEngineerSkillsSchema = z
  .object({
    skills: z
      .array(
        z.object({
          category: engineerSkillCategorySchema,
          name: z.string().trim().min(1).max(80),
          level: engineerSkillLevelSchema,
          experienceYears: z.number().min(0).max(99.9),
          isPrimary: z.boolean().default(false),
        }),
      )
      .max(40),
    secondarySpecializations: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.skills.map((skill) => skill.name.toLocaleLowerCase('en'))).size !==
      value.skills.length
    )
      ctx.addIssue({ code: 'custom', path: ['skills'], message: 'Skill names must be unique' });
    if (value.skills.filter((skill) => skill.isPrimary).length > 1)
      ctx.addIssue({
        code: 'custom',
        path: ['skills'],
        message: 'Only one primary skill is allowed',
      });
    if (
      new Set(value.secondarySpecializations.map((item) => item.toLocaleLowerCase('en'))).size !==
      value.secondarySpecializations.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['secondarySpecializations'],
        message: 'Specializations must be unique',
      });
  });
export type ReplaceEngineerSkillsInput = z.infer<typeof replaceEngineerSkillsSchema>;

export const replaceEngineerWeeklyScheduleSchema = z
  .object({
    // ISO weekday: Monday=1 through Sunday=7; minutes are local to profile timezone.
    slots: z
      .array(
        z.object({
          weekday: z.number().int().min(1).max(7),
          startMinute: z.number().int().min(0).max(1439),
          endMinute: z.number().int().min(1).max(1440),
        }),
      )
      .max(42),
  })
  .superRefine((value, ctx) => {
    const sorted = [...value.slots].sort(
      (a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute,
    );
    for (const [index, slot] of sorted.entries()) {
      if (slot.endMinute <= slot.startMinute)
        ctx.addIssue({
          code: 'custom',
          path: ['slots'],
          message: 'End time must follow start time',
        });
      const previous = sorted[index - 1];
      if (previous && previous.weekday === slot.weekday && previous.endMinute > slot.startMinute)
        ctx.addIssue({ code: 'custom', path: ['slots'], message: 'Working hours cannot overlap' });
    }
    const totalMinutes = value.slots.reduce(
      (total, slot) => total + Math.max(0, slot.endMinute - slot.startMinute),
      0,
    );
    if (totalMinutes > 80 * 60)
      ctx.addIssue({
        code: 'custom',
        path: ['slots'],
        message: 'Weekly schedule cannot exceed 80 hours',
      });
  });
export type ReplaceEngineerWeeklyScheduleInput = z.infer<
  typeof replaceEngineerWeeklyScheduleSchema
>;

export const engineerSkillSearchSchema = z.object({
  category: engineerSkillCategorySchema.optional(),
  level: engineerSkillLevelSchema.optional(),
  name: z.string().trim().min(1).max(80).optional(),
});
export type EngineerSkillSearch = z.infer<typeof engineerSkillSearchSchema>;
