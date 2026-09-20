import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { projectsHomeFn } from "@/lib/projects/functions";

export function useProjectsHome() {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ["fi2-projects", user?.id], enabled: !!user, retry: false, gcTime: 0,
    queryFn: async () => { const r = await projectsHomeFn(); if (!r.ok) throw new Error(r.error); return r.data; },
  });
  return { user, loading: loading || (!!user && query.isPending), ...query, data: user && !query.isError ? query.data : undefined };
}
