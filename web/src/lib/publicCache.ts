// CMS-backed HTML is rendered on each request. Tell caches to revalidate so a
// publish, edit, or unpublish shows up without a rebuild or a polling loop.
// The API drops its Redis list cache on those writes; this header stops a CDN
// from serving the previous HTML after that.
export function markCmsPageFresh(headers: Headers): void {
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
}
