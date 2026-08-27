import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

// Public marketing website (SYSTEM_PROMPT §4). Hybrid static/SSR: pages are
// prerendered by default (output: 'static'); opt a page into on-demand SSR with
// `export const prerender = false`, served by the Node adapter.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://somwave.com',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [sitemap()],
});
