import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Header } from "@/components/xeomx/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { globalSearchFn } from "@/lib/global-search/search.functions";
import { SEARCH_TYPES, type GlobalSearchResultType } from "@/lib/global-search/contracts";
import { m } from "@/paraglide/messages.js";
import { localizeHref } from "@/paraglide/runtime.js";
export const Route = createFileRoute("/workspace")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { projectId?: string; type?: GlobalSearchResultType; id?: string } => ({
    projectId:
      typeof s.projectId === "string" && /^[0-9a-f-]{36}$/i.test(s.projectId)
        ? s.projectId
        : undefined,
    type: SEARCH_TYPES.includes(s.type as GlobalSearchResultType)
      ? (s.type as GlobalSearchResultType)
      : undefined,
    id: typeof s.id === "string" ? s.id.slice(0, 200) : undefined,
  }),
  component: Workspace,
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
});
function Workspace() {
  const { user } = useAuth(),
    params = Route.useSearch();
  const [text, setText] = useState("");
  const [offset, setOffset] = useState(0);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(text);
      setOffset(0);
    }, 180);
    return () => clearTimeout(timer);
  }, [text]);
  const result = useQuery({
    queryKey: ["workspace-search", user?.id, params.projectId, params.type, debounced, offset],
    enabled: !!user,
    retry: false,
    gcTime: 0,
    queryFn: () =>
      globalSearchFn({
        data: {
          text: debounced,
          offset,
          limit: 50,
          filters: {
            projectId: params.projectId,
            types: params.type && params.type !== "project" ? [params.type] : undefined,
          },
        },
      }),
  });
  const data = user && debounced === text ? result.data : undefined;
  const selected = data?.results.find((r) => r.id === params.id && r.type === params.type);
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 text-start">
        <h1 className="text-2xl font-semibold">{m.cc_workspace()}</h1>
        <p>{m.cc_recent()}</p>
        {!user ? (
          <Link to="/auth" search={{ next: "/workspace" }}>
            {m.cc_signin()}
          </Link>
        ) : (
          <>
            <Input
              aria-label={m.cc_title()}
              value={text}
              maxLength={300}
              placeholder={m.cc_placeholder()}
              onChange={(e) => setText(e.target.value)}
            />
            {selected ? (
              <section className="rounded-lg border p-4">
                <h2 className="font-semibold">{selected.title}</h2>
                <p className="whitespace-pre-wrap break-words">{selected.snippet}</p>
              </section>
            ) : null}
            {result.isFetching ? <p role="status">{m.common_loading()}</p> : null}
            {result.isError || data?.sources.some((s) => s.status === "unavailable") ? (
              <p role="status">{m.cc_unavailable()}</p>
            ) : null}
            {data?.results.length === 0 ? <p>{m.cc_empty()}</p> : null}
            <ul className="flex flex-col gap-2">
              {data?.results.map((r) => (
                <li key={`${r.type}:${r.id}`} className="rounded-lg border p-3">
                  <a className="flex min-h-11 flex-col gap-1" href={localizeHref(r.target)}>
                    <span className="font-medium">{r.title}</span>
                    <span className="line-clamp-3 break-words text-muted-foreground">
                      {r.snippet}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {offset > 0 ? (
              <Button variant="outline" onClick={() => setOffset(0)}>
                {m.cc_search()}
              </Button>
            ) : null}
            {data?.nextOffset !== null && data?.nextOffset !== undefined ? (
              <Button variant="outline" onClick={() => setOffset(data.nextOffset!)}>
                {m.cc_next()}
              </Button>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
