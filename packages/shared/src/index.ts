// @somwave/shared — the single source of Zod schemas, inferred types, and
// constants shared by backend and frontend (SYSTEM_PROMPT §4, §6, §16).
//
// Modules are re-exported here as they land:
//   F0.2 — constants/errorCodes (the API envelope's error-code union)
//   F0.3 — schemas/, types/, remaining constants (permissions, limits, pagination)
export * from './constants/errorCodes';
