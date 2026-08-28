import { z } from 'zod';

// User & role management (I1). Shared between the internal admin UI (React Hook
// Form resolver) and the backend validate() middleware (SYSTEM_PROMPT §11, §16).

// A role as shown in the admin role picker.
export const adminRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
});

export type AdminRole = z.infer<typeof adminRoleSchema>;

// A user as shown in the internal admin list/detail — never a secret field (§13).
export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  isActive: z.boolean(),
  roles: z.array(z.string()),
  createdAt: z.string(), // ISO 8601 (§11)
});

export type AdminUser = z.infer<typeof adminUserSchema>;

// Passwords: min 12 chars (§13 posture — long over complex). Reused by create.
export const passwordSchema = z
  .string()
  .min(12, 'Furaha sirta waa inuu ugu yaraan 12 xaraf yahay')
  .max(200);

export const createUserSchema = z.object({
  email: z.string().trim().email('Fadlan geli iimayl sax ah'),
  name: z.string().trim().min(1, 'Magaca waa waajib').max(120),
  password: passwordSchema,
  roleIds: z.array(z.string()).default([]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Edit: email is immutable (it is the login identity); everything else optional.
export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Magaca waa waajib').max(120).optional(),
    isActive: z.boolean().optional(),
    roleIds: z.array(z.string()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
