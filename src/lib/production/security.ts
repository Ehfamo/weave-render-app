const SECRET_NAME =
  /^(?:VITE_)?(?:.*(?:SECRET|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_TOKEN|SERVICE_ROLE).*)$/i;
const CLIENT_ALLOWED = /^(?:VITE_)(?:PUBLIC_|APP_|SUPABASE_URL$|SUPABASE_ANON_KEY$)/;
export function findUnsafeClientEnvironment(names: readonly string[]): string[] {
  return names.filter((name) => SECRET_NAME.test(name) && !CLIENT_ALLOWED.test(name)).sort();
}
export function assertSafeBoundedPayload(value: unknown, maxBytes = 64_000): void {
  const text = JSON.stringify(value);
  if (!text || new TextEncoder().encode(text).byteLength > maxBytes)
    throw Error("PAYLOAD_LIMIT_EXCEEDED");
  if (/(-----BEGIN [A-Z ]+PRIVATE KEY-----|sk-[a-z0-9_-]{12,})/i.test(text))
    throw Error("SECRET_CONTENT_REJECTED");
}
