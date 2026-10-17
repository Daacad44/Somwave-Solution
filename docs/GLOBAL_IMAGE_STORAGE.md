# Global image storage diagnosis and deployment

## Diagnosis

The exact application error originates in `backend/src/lib/storage.ts`: production uploads fail closed with HTTP 503 (`File storage is unavailable`) when S3 bucket/access key/secret are missing. `PostFormModal` maps that response to `Image storage is unavailable`. A local preview is a browser blob and does not prove persistence. An S3 authentication, network or bucket error now also maps safely to the same 503 and emits a structured diagnostic. Runtime Coolify settings/logs have not been supplied; missing configuration versus provider failure must be confirmed there, not inferred from a preview.

Previously non-production fallback was an in-memory map and production supported S3 only. No persistent mount existed in the repository image. Existing S3 objects and keys are unchanged; no automatic migration, deletion or fallback is performed.

## Providers and deployment

- Existing S3: `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`; optional `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE=true` for providers requiring path addressing. `STORAGE_PROVIDER=s3` makes the choice explicit; leaving it unset preserves S3 auto-detection.
- Optional VPS filesystem: set `STORAGE_PROVIDER=filesystem`, `STORAGE_LOCAL_PATH=/data/uploads`. In the **existing API Coolify service**, mount a named persistent volume at `/data/uploads`. The image creates that directory owned by the `node` user (UID/GID 1000); the mounted volume must also be writable by that UID. The path alone does **not** provide persistence. Do not use an ephemeral container directory. Multiple API replicas must share the same persistent filesystem or use S3.
- Memory remains development/test-only. Production never silently falls back to memory. Selecting filesystem does not copy historical S3 objects: preserve the original provider unless a separately verified copy of every referenced object has been made.

Do not change bucket policies to public. Public CMS image URLs are served by the existing `/api/v1/public/article-images/:id` route; only the public CMS collection is exposed. Private media/documents/project files use their existing authenticated routes and project/client authorization. No storage credentials reach browsers.

Before any production change: back up DB plus S3 objects or mounted files; record current image digest/env/provider and volume mapping. Build/test, verify mount permissions and upload/retrieve a representative CMS image plus an authorized private file, restart API and retrieve both, redeploy same verified image and retrieve both again. Confirm anonymous private-file denial. Keep files and database intact when rolling back the application image. Live restart/redeployment evidence remains BLOCKED until authorized Coolify access is available.

## Module coverage

| Module | Existing image contract / status |
| --- | --- |
| Articles CMS | Signed JPEG/PNG/WebP <=5 MB, shared CMS upload, progress/preview/replace/remove, save waits for server upload |
| Portfolio cover/gallery | Same CMS upload and public image collection; referenced images protected against deletion |
| Website content / homepage hero slides | Same CMS upload; content/draft references protected against deletion |
| Team members / testimonials | Existing URL fields preserved; same validated upload picker added, upload completes before save |
| Media Library | Shared private object service, authenticated MEDIA_READ/CREATE/DELETE, PDF/JPEG/PNG/WebP signature check <=25 MB, DB failure cleans up object, referenced public CMS images cannot be deleted |
| Client Portal documents | Existing private shared storage, client access checks retained |
| Project / engineering / inquiry attachments | Existing private shared storage and resource authorization retained; WebP now accepted consistently |
| Services | Icon text field; no uploaded image field in current schema |
| User profile | No avatar field/upload feature in current schema; no new unsupported endpoint added |

CMS media ownership is recorded as `createdById`; organization content permissions control editing/deletion rather than treating public site assets as private per-user resources. Private resource services retain their resource-level authorization. CMS replacement uploads unique keys first; only after successful record save can old unreferenced images be released. Shared reference checks cover articles, portfolio, team, testimonials and website live/draft JSON. No historical images are removed by this fix.

## Diagnostics and verification

Shared operations record operation/provider/module/status/duration and safe error category, never keys, credentials or file contents. Storage logs include the server-generated request correlation ID from the shared request context; HTTP response status is recorded by the request logger. Storage configuration status is available internally through `storageStatus()`; this is not proof of provider write permissions. Automated tests cover signed formats, mismatch/size limits, safe keys, production fail-closed, local persistent read across a fresh module instance and two independent Node processes, atomic refusal of object symlinks, deletion, and CMS reference protection. Local module reload evidence is not a substitute for Coolify restart/redeployment verification.
