/** Bounded JSON validation shared by the recovered Stage5.3 contracts. */
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  let nodes = 0;
  function visit(input: unknown, depth: number): JsonValue {
    if (++nodes > 10000 || depth > 64) throw new TypeError("JSON_LIMIT_EXCEEDED");
    if (input === null || typeof input === "boolean" || typeof input === "string") return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input !== "object" || input === null || ancestors.has(input))
      throw new TypeError("INVALID_JSON");
    if (
      !Array.isArray(input) &&
      Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null
    )
      throw new TypeError("INVALID_JSON");
    ancestors.add(input);
    let output: JsonValue;
    if (Array.isArray(input)) {
      if (input.length > 10000) throw new TypeError("JSON_LIMIT_EXCEEDED");
      output = Array.from({ length: input.length }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
        if (!descriptor || !("value" in descriptor)) throw new TypeError("INVALID_JSON");
        return visit(descriptor.value, depth + 1);
      });
    } else {
      const record: { [key: string]: JsonValue } = Object.create(null);
      for (const key of Object.keys(input).sort()) {
        const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
        if (!("value" in descriptor)) throw new TypeError("INVALID_JSON");
        record[key] = visit(descriptor.value, depth + 1);
      }
      output = record;
    }
    ancestors.delete(input);
    return output;
  }
  return JSON.stringify(visit(value, 0));
}
const SECRET_KEYS = new Set([
  "password",
  "passwd",
  "pwd",
  "secret",
  "clientsecret",
  "oauthsecret",
  "webhooksecret",
  "signingsecret",
  "token",
  "accesstoken",
  "refreshtoken",
  "authtoken",
  "bearertoken",
  "idtoken",
  "sessiontoken",
  "apikey",
  "providerapikey",
  "clientkey",
  "servicerole",
  "servicerolekey",
  "privatekey",
  "signingkey",
  "encryptionkey",
  "authorization",
  "proxyauthorization",
  "cookie",
  "setcookie",
  "credential",
  "credentials",
  "credentialvalue",
  "webhooksignature",
  "signatureheader",
  "rawpayload",
  "webhookpayload",
]);
export function hasSensitiveJson(value: unknown): boolean {
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(canonicalJson(value));
  } catch {
    return true;
  }
  function inspect(input: JsonValue): boolean {
    if (Array.isArray(input)) return input.some(inspect);
    if (input === null || typeof input !== "object") return false;
    return Object.entries(input).some(([key, child]) => {
      const normalized = key.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
      return (
        SECRET_KEYS.has(normalized) ||
        /(apikey|secret|token|password|privatekey|signingkey|encryptionkey|credentialvalue|webhooksignature)$/.test(
          normalized,
        ) ||
        inspect(child)
      );
    });
  }
  return inspect(parsed);
}
