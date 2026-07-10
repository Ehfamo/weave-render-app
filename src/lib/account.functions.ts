import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently delete the currently authenticated user account.
 *
 * Verifies the bearer token via `requireSupabaseAuth`, then uses the
 * admin client to delete the auth user. Public tables cascade via
 * their `ON DELETE CASCADE` foreign keys to `auth.users`.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Best-effort avatar cleanup — never block deletion on this.
    try {
      const { data: files } = await supabaseAdmin.storage.from("avatars").list(userId);
      if (files?.length) {
        await supabaseAdmin.storage
          .from("avatars")
          .remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch {
      /* ignore */
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });