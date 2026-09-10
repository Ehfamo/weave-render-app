import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createEmptyProjectContext,
  recordProjectHandoff,
  type ProjectLocation,
} from "@/lib/project-context";
import { supabase } from "@/integrations/supabase/client";

function useContextState() {
  const [context, setContext] = useState(createEmptyProjectContext);
  const rememberHandoff = useCallback(
    (location: ProjectLocation) => setContext((current) => recordProjectHandoff(current, location)),
    [],
  );
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") setContext(createEmptyProjectContext());
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return useMemo(() => ({ context, rememberHandoff }), [context, rememberHandoff]);
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
