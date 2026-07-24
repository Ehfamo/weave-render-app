import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function safeRelative(href: string | undefined): string | undefined {
  if (!href) return undefined;
  // Keep only same-origin relative paths.
  if (!href.startsWith("/") || href.startsWith("//")) return undefined;
  return href;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { next: safeRelative(location.href) },
      });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});