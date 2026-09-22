import type { APIRoute } from 'astro';

// Generated at build time from `site` (PUBLIC_SITE_URL). Do not keep a second
// copy under public/robots.txt — it would override this and hardcode a domain.
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site ?? 'https://somwave.botandev.com').href;
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
