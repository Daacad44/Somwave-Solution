/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Buildtime env (SYSTEM_PROMPT §14 — PUBLIC_* are buildtime vars in Coolify).
interface ImportMetaEnv {
  readonly PUBLIC_API_URL: string;
  readonly PUBLIC_SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
