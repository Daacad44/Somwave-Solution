/// <reference types="vite/client" />

// Buildtime env inlined by Vite (SYSTEM_PROMPT §14 — VITE_* are buildtime vars).
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
