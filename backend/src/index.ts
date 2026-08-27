// @somwave/backend — Node 20 + Express + TypeScript API (SYSTEM_PROMPT §4, §5).
// Layered: routes → controller → service → prisma. Only services touch Prisma.
//
// F0.2 wired the HTTP runtime (env, logger, redis, app, /health). The Prisma
// core, auth, and feature routers land in F0.3.
export { createApp } from './app';
