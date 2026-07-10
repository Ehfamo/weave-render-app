// Shared client-side validators for the auth + profile surfaces.
// Server-side rules (RLS, CHECK constraints, Supabase HIBP, unique index)
// are the source of truth; these mirror them for fast UX feedback.

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
export const WEBSITE_REGEX = /^https?:\/\/[^\s]{3,200}$/i;

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hints: string[];
  ok: boolean;
};

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789",
  "qwerty123", "iloveyou", "letmein1", "welcome1", "admin123",
  "111111", "123123", "abc12345", "1q2w3e4r", "qwertyui",
]);

export function scorePassword(pw: string): PasswordStrength {
  const hints: string[] = [];
  const lengthOk = pw.length >= 8;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const common = COMMON_PASSWORDS.has(pw.toLowerCase());

  if (!lengthOk) hints.push("At least 8 characters");
  if (!hasLower) hints.push("Add a lowercase letter");
  if (!hasUpper) hints.push("Add an uppercase letter");
  if (!hasNumber) hints.push("Add a number");
  if (!hasSymbol) hints.push("Add a symbol (!@#$…)");
  if (common) hints.push("Too common — pick something unique");

  const bits = [lengthOk, hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  let score: PasswordStrength["score"] = 0;
  if (common) score = 0;
  else if (bits <= 2) score = 1;
  else if (bits === 3) score = 2;
  else if (bits === 4) score = 3;
  else score = 4;

  const label = ["Too weak", "Weak", "Fair", "Good", "Strong"][score] ?? "Too weak";
  const ok = score >= 3 && !common && lengthOk && hasLower && hasUpper && hasNumber;

  return { score, label, hints, ok };
}

export function normalizeUsername(v: string): string {
  return v.toLowerCase().trim();
}

export function validateUsernameFormat(v: string): string | null {
  if (!v) return "Username is required";
  if (!USERNAME_REGEX.test(v)) return "3–20 chars, lowercase letters, digits, or _";
  return null;
}

export function validateDisplayName(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) return "Display name is required";
  if (trimmed.length > 60) return "Max 60 characters";
  return null;
}

export function validateBio(v: string): string | null {
  if (v.length > 300) return "Max 300 characters";
  return null;
}

export function validateWebsite(v: string): string | null {
  if (!v) return null;
  if (!WEBSITE_REGEX.test(v)) return "Must be a valid https:// URL";
  return null;
}

export function validateAvatarFile(file: File): string | null {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) return "PNG, JPG or WebP only";
  if (file.size > 2 * 1024 * 1024) return "Max 2 MB";
  return null;
}

/** Best-effort friendly translation of Supabase auth error messages. */
export function friendlyAuthError(message: string | undefined): string {
  if (!message) return "Something went wrong. Please try again.";
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Please verify your email first.";
  if (m.includes("user already registered")) return "An account already exists for that email.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("password") && m.includes("weak")) return "Password is too weak — pick something stronger.";
  if (m.includes("pwned") || m.includes("breach")) return "This password has appeared in a data breach. Please choose another.";
  if (m.includes("network")) return "Network error. Check your connection and retry.";
  return message;
}