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
export * from './schemas/password';
export * from './schemas/dashboard';
export * from './schemas/service';
export * from './schemas/inquiry';
export * from './schemas/projectInquiry';
export * from './schemas/portfolio';
export * from './schemas/siteContent';
export * from './schemas/homepage';
export * from './schemas/post';
export * from './schemas/articleImage';
export * from './schemas/job';
export * from './schemas/user';
export * from './schemas/project';
export * from './schemas/projectPortfolio';
export * from './schemas/projectFinance';
export * from './schemas/finance';
export * from './schemas/projectActivity';
export * from './schemas/task';
export * from './schemas/milestone';
export * from './schemas/testimonial';
export * from './schemas/team';
export * from './schemas/faq';
export * from './schemas/subscriber';
export * from './schemas/client';
export * from './schemas/timesheet';
export * from './schemas/invoice';
export * from './schemas/ticket';
export * from './schemas/payment';
export * from './schemas/employee';
export * from './schemas/attendance';
export * from './schemas/leave';
export * from './schemas/document';
export * from './schemas/projectDocumentation';
export * from './schemas/documentPlan';
export * from './schemas/engineerSkills';
export * from './schemas/engineering';
export * from './schemas/engineerAccount';
export * from './schemas/engineeringOperations';
export * from './schemas/engineeringWorklog';
export * from './schemas/github';
export * from './schemas/media';
export * from './schemas/audit';
export * from './schemas/notification';
export * from './schemas/workspace';
export * from './types/paymentGateway';
