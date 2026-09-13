import { useState } from "react";
import { BadgeCheck, Boxes, Library, Search, Store, WalletCards } from "lucide-react";
import { m } from "@/paraglide/messages.js";
type View = "discover" | "listing" | "creator" | "library";
const views: readonly [View, typeof Store, () => string][] = [
  ["discover", Store, () => m.p6_discover()],
  ["listing", BadgeCheck, () => m.p6_listing()],
  ["creator", WalletCards, () => m.p6_creator()],
  ["library", Library, () => m.p6_library()],
];
export function MarketplaceWorkspace() {
  const [view, setView] = useState<View>("discover"),
    [query, setQuery] = useState("");
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6" dir="auto">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">XEOMX</p>
            <h1 className="text-2xl font-semibold">{m.p6_title()}</h1>
          </div>
          <button className="min-h-11 rounded-md bg-primary px-4 text-sm text-primary-foreground">
            {m.p6_create()}
          </button>
        </header>
        <nav aria-label={m.p6_title()} className="flex gap-2 overflow-x-auto border-b pb-3">
          {views.map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-current={view === id ? "page" : undefined}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label()}
            </button>
          ))}
        </nav>
        {view === "discover" ? (
          <section>
            <label htmlFor="market-search" className="sr-only">
              {m.p6_search()}
            </label>
            <div className="flex items-center gap-2 rounded-lg border px-3">
              <Search className="size-4" aria-hidden="true" />
              <input
                id="market-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={m.p6_search()}
                className="min-h-11 min-w-0 flex-1 bg-transparent"
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <article className="rounded-xl border p-4">
                <Boxes className="size-6" />
                <h2 className="mt-3 font-semibold">SEO Campaign Agent</h2>
                <p className="text-sm text-muted-foreground">v1.0.0 · Free · XEOMX</p>
                <button
                  onClick={() => setView("listing")}
                  className="mt-4 min-h-11 w-full rounded-md border text-sm"
                >
                  {m.p6_listing()}
                </button>
              </article>
            </div>
          </section>
        ) : null}
        {view === "listing" ? (
          <section className="grid gap-4 lg:grid-cols-[1fr_18rem]">
            <article className="rounded-xl border p-5">
              <h2 className="text-xl font-semibold">SEO Campaign Agent</h2>
              <p className="mt-2 text-muted-foreground">
                A versioned, reviewed package with a safe XEOMX preview.
              </p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  m.p6_permissions(),
                  m.p6_dependencies(),
                  m.p6_compatibility(),
                  m.p6_license(),
                  m.p6_provenance(),
                  m.p6_reviews(),
                ].map((label) => (
                  <div key={label} className="rounded-md bg-muted p-3">
                    <dt className="font-medium">{label}</dt>
                    <dd className="text-sm text-muted-foreground">Verified</dd>
                  </div>
                ))}
              </dl>
            </article>
            <aside className="rounded-xl border p-4">
              <p className="font-semibold">Free</p>
              <button className="mt-3 min-h-11 w-full rounded-md bg-primary text-sm text-primary-foreground">
                {m.p6_install()}
              </button>
            </aside>
          </section>
        ) : null}
        {view === "creator" ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[m.p6_validate(), m.p6_publish(), m.p6_sales(), m.p6_earnings()].map((label) => (
              <article key={label} className="rounded-xl border p-4">
                <h2 className="font-medium">{label}</h2>
                <p className="mt-2 text-2xl font-semibold">0</p>
              </article>
            ))}
          </section>
        ) : null}
        {view === "library" ? (
          <section className="rounded-xl border p-5">
            <h2 className="font-semibold">{m.p6_library()}</h2>
            <p className="mt-2 text-sm text-muted-foreground">—</p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
