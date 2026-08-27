// @somwave/shared — the single source of Zod schemas, inferred types, and
// constants shared by backend and frontend (SYSTEM_PROMPT §4, §6, §16).
//
// This barrel is intentionally empty at F0.1 (monorepo + tooling). Each module
// is re-exported here as it lands:
//   F0.3 — schemas/, types/, constants/ (errorCodes, permissions, limits, pagination)
export {};
