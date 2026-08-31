// @somwave/shared — the single source of Zod schemas, inferred types, and
// constants shared by backend and frontend (SYSTEM_PROMPT §4, §6, §16).
//
// Modules are re-exported here as they land:
//   F0.2 — constants/errorCodes (the API envelope's error-code union)
//   F0.3 — constants/roles, permissions, pagination, limits; schemas/auth
//   later — remaining schemas/, types/ (per feature)
export * from './constants/errorCodes';
export * from './constants/roles';
export * from './constants/permissions';
export * from './constants/pagination';
export * from './constants/limits';
export * from './schemas/auth';
export * from './schemas/service';
export * from './schemas/inquiry';
export * from './schemas/portfolio';
export * from './schemas/post';
export * from './schemas/job';
export * from './schemas/user';
export * from './schemas/project';
export * from './schemas/task';
export * from './schemas/milestone';
export * from './schemas/testimonial';
export * from './schemas/team';
export * from './schemas/faq';
