import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { useAuth } from "@/hooks/use-auth";
import { globalSearchFn } from "@/lib/global-search/search.functions";
import { createProjectFn } from "@/lib/backend/vertical-slice.functions";
import { ACTIONS, runAction, classifyIntent, type ActionId } from "@/lib/command-center/actions";
import { m } from "@/paraglide/messages.js";
import { getLocale, localizeHref } from "@/paraglide/runtime.js";
export function CommandCenter({
  open,
  onOpenChange,
  onLegacy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLegacy: () => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const intent = classifyIntent(text);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), 180);
    return () => clearTimeout(timer);
  }, [text]);
  const result = useQuery({
    queryKey: ["global-search", user?.id, debounced],
    enabled: open && !!user,
    queryFn: () => globalSearchFn({ data: { text: classifyIntent(debounced).query, limit: 20 } }),
    retry: false,
    gcTime: 0,
  });
  const data = user && text === debounced ? result.data : undefined;
  const labels: Record<ActionId, string> = {
    newProject: m.cc_newProject(),
    recentProject: m.cc_recentProject(),
    search: m.cc_search(),
    create: m.cc_create(),
    chat: m.cc_chat(),
    memory: m.cc_memory(),
    generations: m.cc_generations(),
    settings: m.cc_settings(),
    more: m.cc_more(),
  };
  const recentProjects = useQuery({
    queryKey: ["command-recent-projects", user?.id],
    enabled: open && !!user,
    retry: false,
    gcTime: 0,
    queryFn: () =>
      globalSearchFn({
        data: { text: "", sort: "recent", limit: 5, filters: { types: ["project"] } },
      }),
  });
  const recent = user ? recentProjects.data?.results[0]?.target : undefined;
  const choices = ACTIONS.filter(
    (a) =>
      !text ||
      a.id === intent.action ||
      labels[a.id].toLocaleLowerCase().includes(text.toLocaleLowerCase()),
  );
  function go(target: string) {
    onOpenChange(false);
    window.location.assign(localizeHref(target));
  }
  async function execute(id: ActionId) {
    if (busy) return;
    setFailed(false);
    setBusy(true);
    try {
      await runAction(id, {
        recent,
        navigate: go,
        search: () => setText(""),
        more: onLegacy,
        createProject: async () => {
          if (!user) return "/auth";
          const r = await createProjectFn({
            data: { name: text.trim().slice(0, 120) || labels.newProject },
          });
          if (!r.ok) throw new Error("ACTION_FAILED");
          return `/workspace?projectId=${encodeURIComponent(r.data.id)}`;
        },
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.querySelector<HTMLButtonElement>("[data-command-trigger]")?.focus();
        }}
        dir={["fa", "ar"].includes(getLocale()) ? "rtl" : "ltr"}
        className="max-h-[85svh] w-[calc(100%_-_1rem)] overflow-hidden p-4 text-start"
      >
        <DialogTitle>{m.cc_title()}</DialogTitle>
        <DialogDescription>{m.cc_recent()}</DialogDescription>
        <Command shouldFilter={false}>
          <CommandInput
            aria-label={m.cc_title()}
            placeholder={m.cc_placeholder()}
            value={text}
            onValueChange={setText}
            maxLength={300}
          />
          <CommandList className="max-h-[55svh]">
            <CommandEmpty>{m.cc_empty()}</CommandEmpty>
            <CommandGroup heading={m.cc_actions()}>
              {choices.map((a) => (
                <CommandItem
                  className="min-h-11"
                  key={a.id}
                  value={`action:${a.id}`}
                  disabled={busy || (a.id === "recentProject" && !recent)}
                  onSelect={() => void execute(a.id)}
                >
                  {labels[a.id]}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={m.cc_results()}>
              {data?.results.map((r) => (
                <CommandItem
                  className="min-h-11 flex-col items-start"
                  key={`${r.type}:${r.id}`}
                  value={`${r.type}:${r.id}`}
                  onSelect={() => go(r.target)}
                >
                  <span className="line-clamp-1">{r.title}</span>
                  <span className="line-clamp-2 text-muted-foreground">{r.snippet}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {!user ? (
          <button className="min-h-11 text-start" onClick={() => go("/auth")}>
            {m.cc_signin()}
          </button>
        ) : null}
        {result.isFetching && user ? <p role="status">{m.common_loading()}</p> : null}
        {result.isError || data?.sources.some((s) => s.status === "unavailable") ? (
          <p role="status">{m.cc_unavailable()}</p>
        ) : null}
        {failed ? <p role="alert">{m.cc_failed()}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
