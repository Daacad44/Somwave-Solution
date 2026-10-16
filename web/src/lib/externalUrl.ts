/** Accept public HTTP(S) destinations for links that leave the Somwave site. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes('.')
    )
      return null;
    if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || url.hostname.includes(':')) return null;
    return url.toString();
  } catch {
    return null;
  }
}
