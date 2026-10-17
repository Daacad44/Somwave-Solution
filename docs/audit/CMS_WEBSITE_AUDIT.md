# CMS and Public Website Audit

| | |
|---|---|
| Date | 2026-10-17 |
| Repository state | `main` at `4323f55` (PR #86) |
| Scope | Astro public site, public API, CMS admin modules, media library, storage library and the "Image storage is unavailable" root cause, SEO, i18n, forms. |
| Method | Read-only code inspection with file:line evidence; targeted local test runs; unauthenticated, low-volume GET/HEAD/OPTIONS probes of production. No production credentials, Coolify, Resend, S3 or GitHub App access. |
| Source | CMS & Web agent report (07), prefixes STO-, WEB-, CMS- |
| Related | [System audit report](SYSTEM_AUDIT_REPORT.md) · [Bug register](BUG_REGISTER.md) · [Acceptance matrix](ACCEPTANCE_MATRIX.md) · [Remediation roadmap](REMEDIATION_ROADMAP.md) |

Each finding keeps the specialist agent's original ID; the consolidated `SW-` ID from the [bug register](BUG_REGISTER.md) is shown next to it. Severity in the index is the consolidated severity; where duplicates were merged the higher severity was kept, so it can differ from the severity line inside the original finding text.

## Finding index

| Original ID | SW ID | Severity (consolidated) | Confidence | Consolidated title |
|---|---|---|---|---|
| STO-001 | [SW-005](BUG_REGISTER.md#sw-005) | P1 | CONFIRMED | "Image storage is unavailable": storage is one global fail-closed condition with no readiness signal (production trigger unverified) |
| STO-002 | [SW-060](BUG_REGISTER.md#sw-060) | P2 | CONFIRMED | Public image route shares the 60 requests/minute public rate limit |
| STO-003 | [SW-061](BUG_REGISTER.md#sw-061) | P2 | CONFIRMED | Image URLs are absolute, take their host from the request, and only the id is validated |
| STO-004 | [SW-124](BUG_REGISTER.md#sw-124) | P3 | CONFIRMED | Old images are released only for Articles; other modules leave orphans |
| STO-005 | [SW-125](BUG_REGISTER.md#sw-125) | P3 | CONFIRMED | Preview shows while the upload fails; Portfolio partial failures not reported per file |
| WEB-001 | [SW-006](BUG_REGISTER.md#sw-006) | P1 | CONFIRMED | API is reached through public-hostname hairpins, so all app users (and all SSR page views) share one rate-limit bucket, including the login limiter |
| WEB-002 | [SW-037](BUG_REGISTER.md#sw-037) | P2 | CONFIRMED | Seeded demo content is live in production as real testimonials, team, portfolio, careers and posts |
| WEB-003 | [SW-062](BUG_REGISTER.md#sw-062) | P2 | CONFIRMED | Sitemap omits every CMS detail page; canonical URLs differ by trailing slash |
| WEB-004 | [SW-063](BUG_REGISTER.md#sw-063) | P2 | CONFIRMED | Locale and i18n contradict the requirements: English default, chrome-only translation, no hreflang |
| WEB-005 | [SW-017](BUG_REGISTER.md#sw-017) | P2 | CONFIRMED | Stored XSS on the public site through JSON-LD `set:html={JSON.stringify(...)}` |
| WEB-006 | [SW-126](BUG_REGISTER.md#sw-126) | P3 | CONFIRMED | Public forms have no honeypot or captcha; the idempotency key only blocks double-submits |
| WEB-007 | [SW-064](BUG_REGISTER.md#sw-064) | P2 | CONFIRMED | Careers applicants' resume URL is stored but never shown to staff; `javascript:` URLs accepted |
| WEB-008 | [SW-127](BUG_REGISTER.md#sw-127) | P3 | CONFIRMED | Hardcoded app domain, hardcoded marketing sections, off-palette brand colour and no dark mode on web |
| WEB-009 | [SW-128](BUG_REGISTER.md#sw-128) | P3 | CONFIRMED | Page weight and image optimisation |
| CMS-001 | [SW-027](BUG_REGISTER.md#sw-027) | P2 | CONFIRMED | Large lists lack search/filter/pagination; backend list endpoints are unbounded or silently capped at 100 with no meta.total |
| CMS-002 | [SW-129](BUG_REGISTER.md#sw-129) | P3 | CONFIRMED | Homepage publishing needs two separate administrators (undocumented in the UI) |
| CMS-003 | [SW-130](BUG_REGISTER.md#sw-130) | P3 | CONFIRMED | Newsletter is collection-only (no double opt-in, unsubscribe, export or sending) |
| CMS-004 | [SW-018](BUG_REGISTER.md#sw-018) | P2 | CONFIRMED | `javascript:` and arbitrary/plain-http URLs accepted for CMS URL fields and rendered on the public site |

## 1. Scope

**What I read in code:** web/ (astro.config.mjs, Dockerfile, public/, all pages, layouts, components, lib/api.ts, homeContent.ts, i18n.ts, seedTranslations.ts, publicCache.ts); backend public.routes.ts, public.controller.ts, cms.routes.ts, cms.controller.ts, app.ts (body limits, middleware order), middleware/rateLimit.ts, routes/health.routes.ts, lib/storage.ts, lib/env.ts, services (articleImage, media, media-references, post, portfolio, team, testimonial, site-content, subscriber, job, project-inquiry-attachment); docker-entrypoint.sh, root Dockerfile, prisma/seed.ts; frontend features/cms/* (all admin pages and form modals, api.ts), features/ops/MediaPage.tsx and ApplicationsPage.tsx; packages/shared schemas (articleImage, siteContent, portfolio, team, job); docs/GLOBAL_IMAGE_STORAGE.md.

**Production probes (about 60 requests, all unauthenticated GET/HEAD):**
- somwave.botandev.com: the homepage, the 12 nav/footer pages, 4 detail pages, robots.txt, sitemap-index.xml, sitemap-0.xml, sitemap.xml, one missing slug, 3 JS bundles, and a HEAD on each of 27 internal links and assets.
- api.somwave.botandev.com: /health, /public/homepage, /public/team, /public/services (HEAD), /public/article-images/doesnotexist.
- One external hotlinked image.

I submitted no forms.

**BLOCKED:**
- I could not see the Coolify env (S3_*, STORAGE_PROVIDER, volume mounts) or the API runtime logs. So the exact production cause of "Image storage is unavailable" can only be narrowed down, not confirmed.
- I could not exercise any authenticated CMS flow in production (no credentials).
- I ran no local tests; the QA agent owns the test suite.

## 2. Module inventory

| Module | Frontend route | Backend endpoints | Model | Permission | Tests (files exist) | Status |
|---|---|---|---|---|---|---|
| Website content / homepage | /cms/site-content | GET/PUT /cms/site-content, draft GET, submit/approve/publish; GET /public/site-content, /public/homepage | Setting (group website) | CONTENT_READ/UPDATE; approve and publish also need ADMIN/SUPER_ADMIN plus a different reviewer | site-content.service.test.ts | Works. Two-admin rule. No storage-image release |
| Services | /cms/services | /cms/services CRUD; /public/services(/:slug) | Service | CONTENT_* | service.service.test.ts | CRUD + publish. Icon text only, no image. No search/pagination |
| Articles | /cms/posts | /cms/posts CRUD, /cms/categories, POST /cms/article-images; /public/posts(/:slug), /public/article-images/:id | Post, Category, MediaAsset | CONTENT_* | post/articleImage tests | CRUD + publish + cover. Only module that releases old images |
| Portfolio | /cms/portfolio | /cms/portfolio CRUD; /public/portfolio(/:slug), POST demo-click | PortfolioItem | CONTENT_* | portfolio.service.test.ts | CRUD + publish + cover/gallery. No image release; accepts arbitrary URLs |
| Careers | /cms/careers; applications in ops | /cms/careers CRUD; /public/careers(/:slug), POST applications | JobOpening, JobApplication | CONTENT_* | job.service.test.ts | Works, but applicants' resume URL is never shown to staff |
| Testimonials | /cms/testimonials | CRUD; /public/testimonials | Testimonial | CONTENT_* | testimonial.service.test.ts | Works. No image release |
| Team | /cms/team | CRUD; /public/team | TeamMember | CONTENT_* | team.service.test.ts | Works. Arbitrary photo URL (hotlink live) |
| FAQs | /cms/faqs | CRUD; /public/faqs | Faq | CONTENT_* | faq.service.test.ts | Works |
| Newsletter | /cms/subscribers | GET/DELETE /cms/subscribers; POST /public/subscribers | Subscriber | CONTENT_READ/DELETE | subscriber.service.test.ts | Collection only: no opt-in, unsubscribe, export or sending |
| Media library | ops MediaPage | /media GET/POST, /:id/file, DELETE | MediaAsset | MEDIA_* | media.service.test.ts | Private only. Unpaginated. Cannot be used as a picker for CMS images |
| Project request | web /request-project | /public/project-inquiries (+verify/activate/attachments) | ProjectInquiry + attachments | public + proof token | project-inquiry*.test.ts | Uses the same storage library |

## 3. Findings

### STO-001 (SW-005): "Image storage is unavailable" is one global, fail-closed condition in lib/storage.ts with no readiness signal
- Severity: P1 · Confidence: CONFIRMED (code path) / SUSPECTED (which trigger applies in production) · Module: Storage (all upload modules)
- **Where the message comes from:**
  - Backend: `throw new AppError('INTERNAL_ERROR', 503, 'File storage is unavailable')` at backend/src/lib/storage.ts:51, :58, :71 and :103.
  - Frontend: only the Articles modal translates it: frontend/src/features/cms/components/PostFormModal.tsx:65 `if (err.message?.includes('File storage')) return 'Image storage is unavailable.';`
  - Portfolio (PortfolioFormModal.tsx:136), Team (TeamMemberFormModal.tsx:111), Testimonials and Site content (SiteContentAdminPage.tsx:658) show the raw text "File storage is unavailable" instead. The underlying condition is the same.
- **What triggers it** (storage.ts:35-47, 64-104):
  - **Unconfigured S3.** `STORAGE_PROVIDER` is unset, `NODE_ENV=production`, and any of `S3_BUCKET`/`S3_ACCESS_KEY`/`S3_SECRET_KEY` is missing. The provider becomes `'unconfigured'`, so `configured` is false and every upload, read and delete returns 503.
  - **Incomplete S3 with the provider set.** `STORAGE_PROVIDER=s3` but the three variables are not all set.
  - **Bad filesystem path.** `STORAGE_PROVIDER=filesystem` with `STORAGE_LOCAL_PATH` missing or not absolute.
  - **Any provider exception, all collapsed into the same 503** (the catch at :87-104). This covers S3 bad credentials, wrong region or endpoint, missing bucket and network failures. It also covers filesystem `EACCES`: the Dockerfile:75 `mkdir -p /data/uploads && chown node:node` does not apply to a Coolify volume mounted over that path, which is typically root-owned. A symlinked directory (:57-58) triggers it too.
  - Not a trigger: an invalid `STORAGE_PROVIDER` value fails env validation at boot (env.ts:28), so the process exits instead.
- **Scope:** global. Every upload path uses this one library:
  - CMS images: articleImage.service.ts:11
  - Media library: media.service.ts:5
  - Project-inquiry attachments: project-inquiry-attachment.service.ts:6
  - Documents and engineering attachments: per the doc, and through `putObject`.

  Reads go through `storageOperation` as well, so a misconfiguration also breaks every *existing* public CMS image (they return 503, not 404).
- **No readiness signal:** `storageStatus()` is exported but nothing outside storage.ts calls it (grep). `/health` only checks Redis and Postgres (health.routes.ts:11-19). The production probe returned `{"redis":true,"postgres":true}`. No public storage readiness endpoint exists.
- **Production evidence (SUSPECTED):** `/api/v1/public/homepage` and `/public/team` contain **zero** `/public/article-images/` URLs. Posts, portfolio and testimonials all have null images. The one team photo is a hotlink to `https://imgs.search.brave.com/...` (it resolves, 200 image/jpeg). This fits uploads never having succeeded in production, with an editor pasting an external URL instead.
- **Root cause:** I could not see the Coolify env. Most likely the S3 variables are missing, or `filesystem` was selected with a non-writable volume.
- **Impact:** CMS editors cannot add any image to articles, portfolio, team, testimonials or the hero. Public project-request attachments are also affected.
- **Fix:**
  1. Set the runtime env: either S3 (bucket, key, secret, region/endpoint), or `STORAGE_PROVIDER=filesystem` + `STORAGE_LOCAL_PATH=/data/uploads` + a persistent volume writable by UID 1000.
  2. Report `storageStatus()` in `/health` (or an authenticated `/system/health`), plus a write/read/delete probe.
  3. Log `errorCategory` at error level (this already happens) and check the API logs for it.
  4. Make all modals use one shared upload-error mapper.
- Complexity: S (configuration) / S (readiness). Verify by uploading a CMS image, restarting, redeploying, and fetching the public URL each time.

### STO-002 (SW-060): Public image route shares the 60 requests/minute public rate limit
- Severity: P2 · Confidence: CONFIRMED (code) · Module: Storage / public site
- **Evidence:**
  - public.routes.ts:20 applies `publicRouter.use(publicRateLimiter)` to all public routes, including `/article-images/:id` (:31).
  - rateLimit.ts:32 sets 60 per minute per IP, using the in-memory store.
  - The probe header `ratelimit: limit=60, remaining=59`.
- **Effect:** a portfolio item can have a cover plus 20 gallery images. Visitors behind carrier NAT, which is common on Somali mobile networks, share one IP. Images will start returning 429 and render broken.
- **Fix:** exempt GET `/article-images` from the limiter (or give it a much higher limit) and serve images through a CDN or cache. They are already `Cache-Control: public, max-age=86400` (public.controller.ts:158).
- Complexity: S.

### STO-003 (SW-061): Image URLs are absolute, take their host from the request, and only the id is validated
- Severity: P2 · Confidence: CONFIRMED · Module: CMS images
- **How URLs are built:** cms.controller.ts:206-212 builds `${proto}://${host}/api/v1/public/article-images/${id}`, with host taken from `x-forwarded-host` or `Host`. That absolute URL is stored in the database.
- **Validation is id-only:** `resolveArticleCover` (articleImage.service.ts:83-101) and `articleImageIdFromUrl` (packages/shared/src/schemas/articleImage.ts:18-27) check only the path and the id. Any host passes.
- **Effects:**
  1. If the API domain changes, every stored image URL breaks.
  2. An editor can point a cover at `https://attacker/api/v1/public/article-images/<real id>`, and it renders on the public site.
  3. If Traefik forwards a client-supplied X-Forwarded-Host, the upload response URL can be poisoned (SUSPECTED).
- **Fix:** store the image id or a relative path, build the URL from a configured `PUBLIC_API_URL`, and check that the host equals the API host.
- Complexity: M.

### STO-004 (SW-124): Old images are only released for Articles; other modules leave orphans
- Severity: P3 · Confidence: CONFIRMED · Module: Storage / CMS
- **Only Posts release images:** `releaseArticleImageUrl` is called only from post.service.ts (:273, :284). portfolio.service.ts, team.service.ts, testimonial.service.ts and site-content.service.ts never release anything (grep found no matches). This contradicts the claim in GLOBAL_IMAGE_STORAGE.md.
- **More orphan sources:**
  - Portfolio uploads the cover and gallery in parallel before saving (PortfolioFormModal.tsx:87-90). If one upload or the save fails, the others are orphaned.
  - SiteContent uploads immediately (SiteContentAdminPage.tsx:654). An unsaved form leaves an orphan.
- **Fix:** run release on update and delete in every module, plus a periodic BullMQ sweep for unreferenced `article-covers` assets older than 24 hours.
- Complexity: S/M.

### STO-005 (SW-125): The preview can show while the upload fails (expected), and partial failures in Portfolio are not reported per file
- Severity: P3 · Confidence: CONFIRMED · Module: CMS image field
- **The preview is local:** ArticleImageField.tsx:39-47 renders a blob preview from the local `File` before any upload. The upload happens on submit (PostFormModal.tsx:136-145).
- **On failure:** the preview stays and an error line appears. The record is not saved, so nothing false is persisted. A user can still read the preview as "uploaded".
- **Portfolio:** reports only the first error and does not say which gallery file failed.
- **Fix:** label the preview "Not uploaded yet" until the server returns a URL, and keep per-file status for the gallery.
- Complexity: S.

### WEB-001 (SW-006): SSR pages fetch the public API through its public hostname, so all visitors share one rate-limit key
- Severity: P1 · Confidence: SUSPECTED (depends on network topology; code CONFIRMED) · Module: Public website
- **How SSR reaches the API:** web/Dockerfile:52 sets `PUBLIC_API_URL=https://api.somwave.botandev.com/api/v1`. web/src/lib/api.ts:23-36 has the SSR server call that URL for every page view. All 13 CMS pages are `prerender=false`. The probe confirmed the built chunk contains `https://api.somwave.botandev.com/api/v1`.
- **Why that is a problem:** behind Traefik, `req.ip` for every SSR call is the web container's or VPS's egress IP. That gives one shared bucket of 60 requests/minute (public limiter) and 100/minute (global limiter, app.ts:89), held in an in-memory store.
- **Effect:** past about 60 page views per minute site-wide, the API returns 429.
  - The homepage silently falls back to defaults (index.astro:25-29). Sections show "unavailable".
  - Detail pages return **404**: `fetchPost`/`fetchService`/`fetchPortfolioItem`/`fetchCareer` swallow every error and return null (api.ts:56-62, 70-75, 118-124), and `[slug].astro` then sets 404 (blog/[slug].astro:17-19). Search engines may de-index real pages.
  - `getEnvelope` has no timeout, so a hung API hangs SSR.
- **Fix:**
  - Call the API over the internal Docker hostname, using a separate runtime-only `API_INTERNAL_URL`.
  - Exempt the SSR caller, using a shared secret header or allowlisting the internal network.
  - Return 503 rather than 404 when the error is not a 404.
  - Add `AbortSignal.timeout`.
  - Use a Redis rate-limit store.
- Complexity: M. Verify with a load test of more than 60 requests/minute to /blog/<slug> on staging.

### WEB-002 (SW-037): Seeded demonstration content is live in production as real testimonials, team and portfolio
- Severity: P2 · Confidence: CONFIRMED · Module: Public website / CMS data
- **What is live:**
  - `/public/homepage` returns testimonials "Faadumo Cabdi" and "Axmed Nuur", team "Cabdirisaaq Warsame" and "Hodan Maxamed", portfolio `app-dhaqaale-mobil` and `nidaamka-maamulka-iskuulka`, and posts `muhiimadda-nidaamyada-gudaha` and `sida-loo-doorto-shirkad-website`.
  - All of these come from backend/prisma/seed.ts (:269, :302, :374-406).
  - web/src/lib/seedTranslations.ts actively translates this seed content to English for display.
- **More fictional or unverified content on the site:**
  - Hardcoded "tusaale" (example) projects (homeContent.ts:96-172) are published and listed in the sitemap.
  - Stats "100+ clients / 250+ projects / 99%" (homeContent.ts:174-179) are hardcoded but not currently rendered: HomeStats is not in sectionOrder.
  - Trusted logos for Hormuud, Somtel, Dahabshiil, TAAJ, Premier Bank and Amal Bank are shown as clients (homeContent.ts:4-22; served from /clients/*.png). Whether these are real client relationships is unverified (SUSPECTED misrepresentation and trademark risk).
- **Impact:** made-up testimonials presented as real are a consumer-protection and trust risk.
- **Fix:** the business must replace or unpublish the demo records in the CMS, confirm logo permissions, and drop the seedTranslations shim.
- Complexity: S (content).

### WEB-003 (SW-062): Sitemap leaves out every CMS detail page, and canonical URLs differ by trailing slash
- Severity: P2 · Confidence: CONFIRMED (probe) · Module: SEO
- **Sitemap gaps:** sitemap-0.xml lists 17 URLs: the static pages plus 4 "tusaale" example pages. It has **no** blog posts, services, portfolio items or careers. These SSR routes are not discovered (astro.config.mjs:24-28 only adds `/`). sitemap.xml returns 404; the index lives at /sitemap-index.xml, and robots.txt points there correctly.
- **Trailing-slash mismatch:** the sitemap uses trailing slashes (`/adeegyada/`), but SSR pages declare a canonical without one (`/adeegyada`). Both `/adeegyada` and `/adeegyada/` return 200 with a canonical pointing at themselves (probe), so the same page is indexed twice. Prerendered pages use the slash form (`/ku-saabsan/`); SSR pages do not. BaseLayout.astro:29 builds the canonical from `Astro.url.pathname`.
- **Stale file:** web/public/robots.txt still says `https://somwave.com/sitemap-index.xml`. The robots.txt.ts route wins at runtime, but the public file conflicts with it.
- **Fix:** set `trailingSlash: 'never'` (or `'always'`) and normalise the canonical. Add a sitemap route that reads published slugs from the API. Delete public/robots.txt.
- Complexity: S/M.

### WEB-004 (SW-063): Locale and i18n contradict the requirements: English default, chrome-only translation, no hreflang
- Severity: P2 · Confidence: CONFIRMED · Module: Public website i18n
- **Evidence:**
  - web/src/lib/i18n.ts:9 sets `DEFAULT_LOCALE = 'en'`; CLAUDE.md §17 says Somali is the default.
  - Every page serves `<html lang="en" dir="ltr">` (probe), yet portfolio descriptions are Somali ("Barnaamij mobil oo...").
  - The switcher only swaps `[data-i18n]` chrome strings on the client (LanguageSwitcher.astro:39-52). The body stays English.
  - Arabic sets `dir=rtl` over English content.
  - No hreflang on any page. og:locale is `en_US`.
- **Fix:** a product decision on the default locale, then server-side locale routes with hreflang.
- Complexity: L.

### WEB-005 (SW-017): JSON-LD is injected with `set:html={JSON.stringify(...)}` and no `<` escaping
- Severity: P2 · Confidence: CONFIRMED (code); exploitation needs CMS editor rights · Module: Public website
- **Evidence:** web/src/layouts/BaseLayout.astro:100 and :103. `articleSchema.headline` is the CMS post title (:48-56).
- **Effect:** a title containing `</script><script>…` closes the script tag and runs arbitrary JavaScript on the public site. This is stored XSS reachable by any user holding CONTENT_UPDATE.
- **Fix:** `JSON.stringify(obj).replace(/</g, '\\u003c')`.
- Complexity: S.

### WEB-006 (SW-126): Public forms have no honeypot or captcha, and the idempotency key only blocks double-submits
- Severity: P3 · Confidence: CONFIRMED · Module: Forms
- **What exists:**
  - Contact (nala-soo-xiriir.astro:71-120): the shared Zod schema validates the input client-side, the button is disabled while sending, status messages use `aria-live`, and inquiries require an `Idempotency-Key` (public.controller.ts:172-174).
  - Rate limiting: 5 submissions per hour per IP (rateLimit.ts:35), in-memory, per process.
- **Gaps:**
  - The key is generated per submit (`crypto.randomUUID()` at :106), so a retry after a network error creates a duplicate.
  - No honeypot or captcha on contact, careers, subscribe or request-project (grep found none).
  - Subscribe is not idempotent and has no double opt-in (subscriber.service.ts:9).
- **Fix:** create the key once per form load and reset it on success; add a honeypot field.
- Complexity: S.

### WEB-007 (SW-064): Careers applicants' resume URL is stored but never shown to staff, and `javascript:` URLs are accepted
- Severity: P2 · Confidence: CONFIRMED · Module: Careers / Recruitment
- **The form collects it:** web/src/pages/fursado-shaqo/[slug].astro:72 has a `resumeUrl` field, which is stored at job.service.ts:79 and returned at :250 and :274.
- **Staff never see it:** grep for `resume` across frontend/src returns nothing; ApplicationsPage.tsx does not render it.
- **No upload option:** there is no CV upload field.
- **Unsafe schemes pass validation:** shared job.ts:40 uses `z.string().url()`, which accepts `javascript:alert(1)` (verified with zod 3.25.76 locally). That is a latent stored XSS the day someone renders it as a link.
- **Fix:** restrict to `https:`, render the link with `rel="noopener noreferrer"`, and consider a private CV upload.
- Complexity: S.

### WEB-008 (SW-127): Hardcoded app domain, unused hardcoded marketing copy, an off-palette brand colour, and no dark mode
- Severity: P3 · Confidence: CONFIRMED · Module: Public website
- **Hardcoded portal URL:** `https://app.somwave.botandev.com` appears in Header.astro:17, Footer.astro:23, request-project.astro:88 and :123, and nala-soo-xiriir.astro:28 instead of a `PUBLIC_APP_URL`.
- **Static sections:** why, process, stats, tusaale projects and trusted logos come from homeContent.ts, not the CMS. Visibility and order are CMS-controlled through `sectionOrder`/`hiddenSections`.
- **Off-system tokens:** tokens.css:6 adds `--color-brand: #104fdb` (blue), plus sky and cyan, which are not in the CLAUDE.md §8 palette.
- **No dark mode:** no `prefers-color-scheme` anywhere in web.
- Complexity: S.

### WEB-009 (SW-128): Page weight and image optimisation
- Severity: P3 · Confidence: CONFIRMED · Module: Performance
- **Page sizes:** the homepage is 86 KB of HTML with 10 script tags. Other pages are 22-31 KB with 5-6 scripts.
- **Shared JS chunk:** `/_astro/api.CztqEqx-.js` is 105 KB, because it bundles Zod plus the shared package for client validation.
- **No asset pipeline:** astro:assets is not used. Images come from plain `/public` files, though they do have width/height and lazy loading (the homepage has 19 imgs, all with width set, 13 lazy).
- **Large PNGs:** `/works/*.png` files are 1.6-2.0 MB each, served on the tusaale pages. The og:image is a 379 KB PNG logo.
- **Mixed content and links:** none found. All 27 internal links and assets returned 200.
- **Fix:** convert to WebP/AVIF through astro:assets and import only the schemas needed on the client.
- Complexity: S/M.

### CMS-001 (SW-027): No CMS list has search, filter or pagination, and backend list endpoints are unbounded
- Severity: P2 · Confidence: CONFIRMED · Module: CMS (all)
- **Frontend:** a grep of every `features/cms/*AdminPage.tsx` found 0 search and 0 pagination controls (the SiteContent "filter" hits are unrelated).
- **Backend:** `listAllPosts`, `listAllPortfolio`, `listSubscribers` and `listMedia` (media.service.ts:19-22, a bare `findMany`) return every row. This violates CLAUDE.md §12 (tables over 10 rows) and §10 (pagination).
- **Fix:** server-side `?page&pageSize&q&status`, plus the shared Table pattern.
- Complexity: M.

### CMS-002 (SW-129): Homepage publishing needs two separate administrators
- Severity: P3 · Confidence: CONFIRMED · Module: Website content
- **Evidence:**
  - site-content.service.ts:75 refuses with "A different administrator must approve this draft".
  - cms.controller.ts:85-93 requires ADMIN or SUPER_ADMIN to approve or publish.
  - EDITORs can only submit (PUT and submit need only CONTENT_UPDATE).
- **Effect:** with a single admin, the homepage cannot be published. That may be the intended four-eyes control, but it is undocumented in the UI.
- **Fix:** document it, or allow a SUPER_ADMIN override with an audit entry.
- Complexity: S.

### CMS-003 (SW-130): Newsletter is collection-only
- Severity: P3 · Confidence: CONFIRMED · Module: Newsletter
- **Evidence:** subscriber.service.ts exports only `subscribe`, `listSubscribers` and `deleteSubscriber`. There is no double opt-in, no unsubscribe token, no export and no sending.
- **Impact:** a GDPR-style consent trail is missing.
- Complexity: M.

### CMS-004 (SW-018): Image fields outside Articles accept any URL, including hotlinks and plain http
- Severity: P3 · Confidence: CONFIRMED · Module: Portfolio, Team, Testimonials
- **Evidence:**
  - Team `photoUrl` (team.ts:29) and portfolio `coverImage` (portfolio.ts:88, :120) take any URL.
  - Portfolio gallery (portfolio.ts:6-11) allows `http:`.
  - Production already hotlinks a Brave search-proxy image for "Botandev" (probe of /public/team). Hotlinks break silently and leak visitor IPs to third parties.
- **Fix:** accept only stored image URLs, as Articles do, or HTTPS on an allowlist.
- Complexity: S.

## 4. Acceptance

| Feature | Status | Evidence |
|---|---|---|
| Public pages render (homepage + 12 nav pages + 4 detail pages) | VERIFIED | All returned 200; one h1 each; title, description, canonical, og and twitter tags present |
| Broken internal links / assets | VERIFIED (none) | 27 HEADs all returned 200 |
| Real 404 for unknown slug | VERIFIED | /blog/does-not-exist-audit returned 404 |
| Sitemap / robots | PARTIAL | Index and robots work; CMS detail URLs missing; slash mismatch (WEB-003) |
| CMS-driven homepage sections | PARTIAL | services, portfolio, testimonials, posts, faqs, hero, cta, contact and trusted come from /public/homepage; why, process, stats and examples are hardcoded |
| CMS-published content is real business content | FAILED | Seed demo data is live (WEB-002) |
| CMS image upload in production | BLOCKED / SUSPECTED FAILED | No stored image URLs in live content; env not visible (STO-001) |
| Storage readiness check | NOT IMPLEMENTED | /health covers only Postgres and Redis |
| Public image serving (no expiring URLs) | PARTIAL | A stable public route, not presigned; rate limited at 60/min (STO-002) |
| CMS CRUD + publish per module | PARTIAL (code-read, NOT TESTED) | Routes and services exist for all modules; no search/pagination (CMS-001) |
| Cache invalidation on publish | PARTIAL (code-read) | Redis invalidation in post/portfolio/service/job/team/testimonial/faq services; site-content is uncached; SSR pages send `max-age=0` |
| i18n / RTL / hreflang | FAILED vs spec | English default, chrome only, no hreflang (WEB-004) |
| Dark mode on web | NOT IMPLEMENTED | No `prefers-color-scheme` |
| Form spam protection | PARTIAL | IP rate limit only; no honeypot (WEB-006) |
| Careers applications reviewable with CV | FAILED | resumeUrl not displayed (WEB-007) |

## Note on image storage re-platforming

At the user's request, image storage is being moved to ImageKit in a separate change (`feat/imagekit-media-storage`). Once that change is configured in production it addresses the "Image storage is unavailable" findings (STO-001 / SW-005 and the related durability finding INF-011 / SW-054). The nginx `client_max_body_size` finding (INF-001 / SW-004) still applies, because uploads still pass through the app's same-origin proxy. This audit did not review the ImageKit change.
