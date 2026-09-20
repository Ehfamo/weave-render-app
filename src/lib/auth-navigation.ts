/** Only local return paths. Normal activation starts at Goal-first Home. */
export function sanitizeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\r\n]/.test(next)) return "/";
  try { const url=new URL(next,"https://xeomx.local");return url.origin==="https://xeomx.local"?next:"/"; }
  catch { return "/"; }
}
