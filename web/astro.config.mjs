import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

// Public marketing website (SYSTEM_PROMPT §4). Hybrid static/SSR: pages are
// prerendered by default (output: 'static'); opt a page into on-demand SSR with
// `export const prerender = false`, served by the Node adapter. Tailwind maps to
// the shared design tokens — base styles come from src/styles/global.css.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://somwave.com',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [tailwind({ applyBaseStyles: false }), sitemap()],
});
