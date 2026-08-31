import { z } from 'zod';

// Team members (W5.2). Shown on the public "about / team" surface; managed from
// the CMS (content.*). Shared by the public API, the CMS UI, and validate().

export const publicTeamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  bio: z.string().nullable(),
  photoUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
});

export type PublicTeamMember = z.infer<typeof publicTeamMemberSchema>;

export const adminTeamMemberSchema = publicTeamMemberSchema.extend({
  order: z.number().int(),
  isPublished: z.boolean(),
  createdAt: z.string(), // ISO 8601
});

export type AdminTeamMember = z.infer<typeof adminTeamMemberSchema>;

export const createTeamMemberSchema = z.object({
  name: z.string().trim().min(1, 'Magaca waa waajib').max(200),
  role: z.string().trim().min(1, 'Jagada waa waajib').max(200),
  bio: z.string().trim().max(2000).optional(),
  photoUrl: z.string().url('Fadlan geli link sax ah').optional(),
  linkedinUrl: z.string().url('Fadlan geli link sax ah').optional(),
  order: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(true),
});

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;

export const updateTeamMemberSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    role: z.string().trim().min(1).max(200).optional(),
    bio: z.string().trim().max(2000).nullable().optional(),
    photoUrl: z.string().url('Fadlan geli link sax ah').nullable().optional(),
    linkedinUrl: z.string().url('Fadlan geli link sax ah').nullable().optional(),
    order: z.number().int().nonnegative().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
