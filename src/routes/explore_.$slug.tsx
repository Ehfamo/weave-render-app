import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/explore_/$slug")({
  beforeLoad: () => {
    throw redirect({ to: "/ecosystem" });
  },
});
