import { z } from 'zod';

// Login credentials (SYSTEM_PROMPT §11 — the same schema drives the RHF resolver
// on the client and validate() on the server).
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// The authenticated user surfaced to the client — never any secret field.
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}
