import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createEmptyProjectContext,
  bindAuthorizedProject,
  recordProjectHandoff,
  type ProjectLocation,
} from "@/lib/project-context";
import { useAuth } from "@/hooks/use-auth";

function useContextState() {
  const { user } = useAuth();
  const [bound, setBound] = useState(() => ({actorId: null as string | null, context: createEmptyProjectContext()}));
  const context = useMemo(() => bound.actorId === (user?.id ?? null) ? bound.context : createEmptyProjectContext(), [bound,user?.id]);
  const rememberHandoff = useCallback((location: ProjectLocation) => {
    setBound((current) => ({actorId:user?.id??null,context:recordProjectHandoff(current.actorId === (user?.id??null) ? current.context : createEmptyProjectContext(),location)}));
  }, [user?.id]);
  const bindProject = useCallback((projectId: string, actorId: string) => {
    const next = bindAuthorizedProject({project:{id:projectId}},actorId,user?.id??null);
    setBound((current) => current.actorId === actorId && current.context.projectId === next.projectId ? current : {actorId: user?.id??null,context:next});
  }, [user?.id]);
  const clearProject = useCallback((projectId: string) => {
    setBound((current) => current.context.projectId === projectId ? {actorId: null,context:createEmptyProjectContext()} : current);
  }, []);
  return useMemo(() => ({ context, rememberHandoff, bindProject, clearProject }), [context, rememberHandoff, bindProject, clearProject]);
}

const Context = createContext<ReturnType<typeof useContextState> | null>(null);
export function ProjectContextProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value={useContextState()}>{children}</Context.Provider>;
}
export function useProjectContext() {
  const value = useContext(Context);
  if (!value) throw new Error("ProjectContextProvider is required");
  return value;
}
