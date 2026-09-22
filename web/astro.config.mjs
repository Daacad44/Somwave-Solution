import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

// Public marketing website (SYSTEM_PROMPT §4). Hybrid static/SSR: pages are
// prerendered by default (output: 'static'); CMS-backed routes opt into
// on-demand SSR with `export const prerender = false` and are served by the
// Node adapter. Tailwind maps to the shared design tokens — base styles come
// from src/styles/global.css.
//
// `server.host: true` binds 0.0.0.0 so Coolify/Traefik can reach the process.
// PUBLIC_SITE_URL is a Coolify Buildtime var (sitemap, canonical, OG).
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://somwave.botandev.com',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  server: { host: true, port: 4321 },
  integrations: [tailwind({ applyBaseStyles: false }), sitemap()],
});
