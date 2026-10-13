import { z } from 'zod';
import { passwordSchema } from './user';

export const engineerExperienceLevels = ['JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL'] as const;
export const engineerEmploymentTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT'] as const;

const profileFields = {
  phone: z.string().trim().max(40).nullable().optional(),
  jobTitle: z.string().trim().min(1).max(120),
  specialization: z.string().trim().min(1).max(120),
  skills: z.array(z.string().trim().min(1).max(80)).max(40),
  experienceLevel: z.enum(engineerExperienceLevels),
  employmentType: z.enum(engineerEmploymentTypes),
  weeklyCapacityHours: z.number().min(1).max(80),
  availability: z.enum(['AVAILABLE', 'LIMITED', 'UNAVAILABLE']),
};

export const createEngineerAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
  ...profileFields,
});
export type CreateEngineerAccountInput = z.infer<typeof createEngineerAccountSchema>;

export const updateEngineerAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: profileFields.phone,
    jobTitle: profileFields.jobTitle.optional(),
    specialization: profileFields.specialization.optional(),
    skills: profileFields.skills.optional(),
    experienceLevel: profileFields.experienceLevel.optional(),
    employmentType: profileFields.employmentType.optional(),
    weeklyCapacityHours: profileFields.weeklyCapacityHours.optional(),
    availability: profileFields.availability.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one change is required');
export type UpdateEngineerAccountInput = z.infer<typeof updateEngineerAccountSchema>;

export const verifyEngineerInvitationSchema = z.object({ token: z.string().min(32).max(256) });
export type VerifyEngineerInvitationInput = z.infer<typeof verifyEngineerInvitationSchema>;

export const resendEngineerVerificationSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
});
export type ResendEngineerVerificationInput = z.infer<typeof resendEngineerVerificationSchema>;

export const activateEngineerInvitationSchema = z.object({
  activationToken: z.string().min(32).max(256),
  password: passwordSchema,
  phone: profileFields.phone,
  jobTitle: profileFields.jobTitle.optional(),
  specialization: profileFields.specialization.optional(),
  skills: profileFields.skills.optional(),
  experienceLevel: profileFields.experienceLevel.optional(),
  employmentType: profileFields.employmentType.optional(),
  weeklyCapacityHours: profileFields.weeklyCapacityHours.optional(),
});
export type ActivateEngineerInvitationInput = z.infer<typeof activateEngineerInvitationSchema>;
