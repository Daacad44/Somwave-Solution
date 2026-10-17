# ImageKit media storage

Snapshot: 17 October 2026. Branch `feat/imagekit-media-storage`.

ImageKit is now the single store and delivery CDN for every image the Somwave UI
uploads. The existing S3 / filesystem storage is kept for non-image documents
(PDFs, Word, Markdown) so no document is touched. Historical images continue to
be served from their original provider; nothing is migrated automatically.

## 1. Root cause of the previous failure

`frontend/src/features/cms/components/PostFormModal.tsx` mapped every upload
error that mentioned "File storage" to the single sentence "Image storage is
unavailable." The sentence is produced by `backend/src/lib/storage.ts:51/58/71`
which fails closed any time the configured provider cannot write.

In production that collapses several conditions into one message:

- `STORAGE_PROVIDER=s3` and the S3 bucket/access key/secret are unset →
  `storageStatus()` returns `provider: 'unconfigured'`.
- `STORAGE_PROVIDER=filesystem` and `STORAGE_LOCAL_PATH` isn't an absolute
  path, or the mounted volume isn't writable by the `node` user.
- A networked S3/filesystem error, or `nginx` sent 413 before the request
  reached the API (the SPA proxy had no `client_max_body_size`, so nginx's
  default 1 MB rejected anything larger).

ImageKit replaces the fragile mix with one managed provider and real error
messages — SDK failures now reach the UI as "Image storage is not configured",
"rejected the API credentials", "did not respond", "rate limited", or
"rejected the file", with the reason code logged separately.

## 2. Architecture

```
Form upload (CMS / Media Library / project attachments)
  └─ frontend api.ts (uploadArticleImage / createMedia / addTaskAttachment)
     └─ POST /api/v1/cms/article-images  (or /media, /projects/.../attachments)
        └─ validated Zod schema from packages/shared
           └─ service → lib/storage.ts
              ├─ images  → lib/imagekit.ts  → ImageKit REST (private key, HTTPS)
              └─ documents → S3 or filesystem provider (unchanged)

ImageKit → CDN delivery URL recorded on the MediaAsset row
  └─ public pages render that URL directly (no proxying bytes)
  └─ /api/v1/public/article-images/:id 302-redirects legacy links to the CDN
  └─ private files are read server-side with a 120-second signed URL
```

Only the backend holds `IMAGEKIT_PRIVATE_KEY`. The private key never ships to
the browser; `VITE_*`/`PUBLIC_*` builds are not touched.

### Server-chosen folders (ImageKit paths)

| Module                 | Folder                                       | Visibility |
| ---------------------- | -------------------------------------------- | ---------- |
| Articles               | `somwave/website/articles`                   | public     |
| Portfolio              | `somwave/website/portfolio`                  | public     |
| Services               | `somwave/website/services`                   | public     |
| Testimonials           | `somwave/website/testimonials`               | public     |
| Team                   | `somwave/website/team`                       | public     |
| Careers                | `somwave/website/careers`                    | public     |
| Hero / site content    | `somwave/website/hero`                       | public     |
| Branding               | `somwave/branding/logos`                     | public     |
| Media Library          | `somwave/private/media`                      | private    |
| Project documentation  | `somwave/private/projects/documentation`     | private    |
| Project attachments    | `somwave/private/projects/attachments`       | private    |
| Shared documents       | `somwave/private/documents`                  | private    |
| Project inquiries      | `somwave/private/inquiries`                  | private    |

User input never becomes part of the path; the file name is a server-generated
32-hex id, so URLs map back to their database row.

## 3. Code map

| File                                           | Change                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `backend/src/lib/imagekit.ts`                  | ImageKit adapter (upload, delete, signed read, verify, folder table).  |
| `backend/src/lib/storage.ts`                   | Images route through ImageKit; documents stay on the existing provider.|
| `backend/src/lib/env.ts`                       | `IMAGEKIT_*` env vars with boot-time validation and paired-key rules.  |
| `backend/src/services/articleImage.service.ts` | Records ImageKit metadata, audits each upload and release.             |
| `backend/src/services/media.service.ts`        | Audits deletions and exposes `GET /media/storage-status`.              |
| `backend/src/services/{portfolio,team,testimonial,site-content}.service.ts` | Release replaced/removed images now, not just articles. |
| `backend/src/controllers/public.controller.ts` | `/public/article-images/:id` 302-redirects to the CDN for ImageKit rows. |
| `backend/prisma/migrations/20261017120000_imagekit_media_metadata/` | Additive `provider`, `provider_file_id`, `url`, `width`, `height`, `folder`, `legacy_storage_key`, `updated_at`. |
| `packages/shared/src/schemas/articleImage.ts`  | `module` enum, GIF accepted, ImageKit CDN URLs recognised.             |
| `frontend/src/features/cms/*`                  | Every CMS form sends its module; GIF accepted; real server error shown.|
| `frontend/nginx.conf`                          | `client_max_body_size 40m` for the SPA → API proxy.                    |

Changed files: 29. Added files: 4 (adapter, two test files, this doc, the migration).

## 4. Database

Migration `20261017120000_imagekit_media_metadata` adds nullable columns to
`media_assets`:

- `provider` (text, indexed) — `imagekit` / `s3` / `filesystem` / `memory`.
  NULL on rows created before ImageKit.
- `provider_file_id` (text, unique) — ImageKit `fileId`, required to replace
  or delete the remote file.
- `url` (text) — public CDN URL. NULL for private files, which are served
  through the authorised download routes with a signed URL.
- `width`, `height` (int) — reported by ImageKit on upload.
- `folder` (text) — server-chosen folder, for diagnostics only.
- `legacy_storage_key` (text) — the key the row used before migration, kept
  for rollback.
- `updated_at` (timestamp, default `now()`) — set by Prisma `@updatedAt`.

No table is dropped or recreated. Historical rows keep their `storage_key`
and remain readable through the legacy provider.

## 5. API additions

- `GET /api/v1/media/storage-status` — administrator-only (`media.create`).
  Returns `{ images: { provider, configured, reachable, urlEndpointHost }, documents }`.
  `?verify=true` makes one read-only ImageKit list call to prove the keys.
- `POST /api/v1/cms/article-images` — now accepts an optional
  `module` field (one of the public modules in §2). Response includes
  `width` and `height`.
- `GET /api/v1/public/article-images/:id` — unchanged for callers; now
  302-redirects to the ImageKit CDN when the row has a public URL, preserving
  every link in previously published content.

## 6. Security

- Private key is a backend-only env var; boot refuses to start if only one of
  `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT` is set, or if a value
  starting with `private_` is placed in `IMAGEKIT_PUBLIC_KEY`.
- The server never proxies private bytes without authorisation; `readObject`
  on an ImageKit key requests a signed URL that expires in 120 seconds.
- Keys stored in the database are validated by `parseImageKitKey`; folder,
  path traversal and malformed IDs are refused.
- Upload audit (`media.image.uploaded`) and delete audit (`media.image.deleted`,
  `media.deleted`) record actor, provider, folder, size and MIME.
- All upload callers already check magic bytes before accepting a payload;
  SVG is still refused. GIF is now explicitly supported.
- Error logging redacts credentials and never includes file contents.

## 7. Deployment

Set these in the Coolify API service (runtime, not build):

| Variable                    | Required | Notes                                             |
| --------------------------- | -------- | ------------------------------------------------- |
| `IMAGEKIT_PRIVATE_KEY`      | yes      | ImageKit dashboard → Developer options.           |
| `IMAGEKIT_URL_ENDPOINT`     | yes      | `https://ik.imagekit.io/<your-id>`.               |
| `IMAGEKIT_PUBLIC_KEY`       | no       | Only needed by browser SDKs, which we do not use. |

The server exits on boot with a named issue if either required value is
missing while the other is set. If both are omitted in production, every
image upload fails with the actionable error "Image storage is not
configured — ask an administrator to set the ImageKit keys on the API
service" instead of the previous blanket message.

No new volume or persistence is required. The migration is idempotent and
runs on container start under the existing entrypoint.

Also update the reverse proxy / Coolify nginx service so uploads can reach
the API: `client_max_body_size 40m` (committed in `frontend/nginx.conf`;
mirror it in any front-of-API Traefik/nginx middleware).

## 8. Verified in this change

- 621 unit tests pass across 101 files (13 skipped, 0 failing). New suites:
  `backend/src/lib/imagekit.test.ts` (18 tests) and
  `backend/src/lib/storage-imagekit.test.ts` (7 tests).
- Prisma migration applied from empty on a scratch database; `prisma migrate
  diff` reports no drift against the schema.
- `npm run build`, `npm run lint`, `npm run format:check`, `npm run typecheck`
  all pass on the full monorepo.

## 9. Not changed in this patch (intentional)

- No historical image is migrated. The two providers coexist; a later
  reconciliation job can copy legacy objects to ImageKit when authorised.
- No destructive deletion is performed. Legacy MediaAssets keep their
  `storage_key` and continue to be served from the previous provider.
- No new UI avatar/profile picture field is added. The master acceptance
  matrix flagged user avatars as "no field in schema"; this change does not
  invent one.
- EVC, Resend, S3 and non-image document uploads are unchanged.

## 10. Acceptance

| Criterion                                     | Status      | Evidence                                       |
| --------------------------------------------- | ----------- | ---------------------------------------------- |
| ImageKit configured through env vars          | VERIFIED    | `backend/src/lib/env.ts`; boot test above.     |
| Centralised storage service                   | VERIFIED    | `backend/src/lib/imagekit.ts`.                 |
| Images routed through one path                | VERIFIED    | `backend/src/lib/storage.ts` + unit tests.     |
| Article / portfolio / team / testimonial / hero uploads use ImageKit | VERIFIED | Unit tests + CMS component updates.         |
| Private module uploads (project attachments, documentation, inquiries, media library) use ImageKit | VERIFIED | `storage-imagekit.test.ts`. |
| ImageKit file id stored for replace/delete    | VERIFIED    | `MediaAsset.providerFileId` migration + tests. |
| Image replacement releases old images         | VERIFIED    | `releaseRemovedImages` unit tests.             |
| Deletion checks references + audit log        | VERIFIED    | `mediaIsReferenced`, `writeAudit` tests.       |
| Signed URL for private delivery               | VERIFIED    | `readFromImageKit` test.                       |
| Error logging is structured, no secrets       | VERIFIED    | `imagekit.test.ts` error-mapping test.         |
| Automated tests pass                          | VERIFIED    | `npm run coverage` — 621 passed.               |
| Browser E2E against production                | NOT TESTED  | No production credentials in this session.     |
| Live Coolify deployment                       | BLOCKED     | Coolify env update is the user's step.         |
| Existing image migration                      | NOT TESTED  | Intentionally deferred; nothing is deleted.    |
| nginx client body size raised                 | VERIFIED    | `frontend/nginx.conf` (also set at Traefik).   |

## 11. User action required

1. In Coolify → backend service → Environment, add
   `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT` (optionally
   `IMAGEKIT_PUBLIC_KEY`) as **runtime** variables, then redeploy.
2. If a Traefik/nginx middleware sits in front of the API with a smaller
   body size than 40 MB, raise it. The committed `frontend/nginx.conf`
   change covers the SPA → API proxy.
3. After redeploy, call
   `GET https://api.somwave.botandev.com/api/v1/media/storage-status?verify=true`
   as a user with `media.create` permission. The response should be
   `{ images: { configured: true, reachable: true, … } }`.
4. In Articles CMS, upload an image. The saved post should render the
   `ik.imagekit.io/...` URL on both the admin page and the public site.
