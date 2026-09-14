import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  Library,
  Search,
  ShieldCheck,
  Store,
  WalletCards,
  X,
} from "lucide-react";
import { m } from "@/paraglide/messages.js";
type View = "discover" | "listing" | "creator" | "library" | "compare";
const listing = {
  title: "SEO Campaign Agent",
  creator: "XEOMX",
  version: "1.0.0",
  price: "Free",
  status: "published" as const,
};
export function MarketplaceWorkspace() {
  const [view, setView] = useState<View>("discover"),
    [query, setQuery] = useState(""),
    [acquired, setAcquired] = useState(false),
    [installed, setInstalled] = useState(false);
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6" dir="auto">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{m.p8_marketplace()}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{m.p8_market_goal_hint()}</p>
          </div>
          <button
            onClick={() => setView("creator")}
            className="min-h-11 rounded-xl border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {m.p8_creator_studio()}
          </button>
        </header>
        <nav aria-label={m.p8_marketplace()} className="flex gap-2 overflow-x-auto border-b pb-3">
          {[
            ["discover", Store, m.p8_discover()],
            ["library", Library, m.p8_library()],
            ["creator", WalletCards, m.p8_creator_studio()],
          ].map(([id, Icon, label]) => (
            <button
              key={id as string}
              onClick={() => setView(id as View)}
              aria-current={view === id ? "page" : undefined}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm aria-[current=page]:bg-muted"
            >
              <Icon className="size-4" />
              {label as string}
            </button>
          ))}
        </nav>
        {view === "discover" ? (
          <section aria-labelledby="discover-title">
            <h2 id="discover-title" className="sr-only">
              {m.p8_discover()}
            </h2>
            <form
              role="search"
              onSubmit={(event) => event.preventDefault()}
              className="flex items-center gap-2 rounded-2xl border p-2 shadow-sm"
            >
              <Search className="ms-2 size-5 text-muted-foreground" />
              <label htmlFor="market-goal" className="sr-only">
                {m.p8_market_goal()}
              </label>
              <input
                id="market-goal"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={m.p8_market_goal()}
                className="min-h-11 min-w-0 flex-1 bg-transparent px-2 outline-none"
              />
              <button className="min-h-11 rounded-xl bg-primary px-4 text-sm text-primary-foreground">
                {m.p8_search()}
              </button>
            </form>
            <details className="mt-3">
              <summary className="cursor-pointer min-h-11 py-3 text-sm">{m.p8_filters()}</summary>
              <div className="flex flex-wrap gap-2">
                {[m.p8_category(), m.p8_price(), m.p8_compatibility(), m.p8_language()].map((x) => (
                  <button key={x} className="min-h-11 rounded-lg border px-3 text-sm">
                    {x}
                    <ChevronDown className="ms-2 inline size-4" />
                  </button>
                ))}
              </div>
            </details>
            <div className="mt-5">
              <article className="rounded-2xl border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{m.p8_example_preview()}</p>
                    <h3 className="mt-1 text-lg font-semibold">{listing.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{m.p8_listing_summary()}</p>
                  </div>
                  <span className="text-sm font-medium">{listing.price}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => setView("listing")}
                    className="min-h-11 rounded-xl bg-primary px-4 text-sm text-primary-foreground"
                  >
                    {m.p8_inspect()}
                  </button>
                  <button
                    onClick={() => setView("compare")}
                    className="min-h-11 rounded-xl border px-4 text-sm"
                  >
                    {m.p8_compare()}
                  </button>
                </div>
              </article>
            </div>
          </section>
        ) : null}
        {view === "listing" ? (
          <section className="grid gap-5 lg:grid-cols-[1fr_20rem]">
            <div className="min-w-0 space-y-5">
              <article>
                <button
                  onClick={() => setView("discover")}
                  className="min-h-11 text-sm text-primary"
                >
                  {m.p8_back_results()}
                </button>
                <h2 className="text-2xl font-semibold">{listing.title}</h2>
                <p className="mt-2 text-muted-foreground">{m.p8_listing_summary()}</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Info label={m.p8_creator()} value={listing.creator} />
                  <Info label={m.p8_version()} value={listing.version} />
                  <Info label={m.p8_last_updated()} value={m.p8_available_metadata()} />
                  <Info label={m.p8_runtime_cost()} value={m.p8_runtime_varies()} />
                </dl>
              </article>
              <section aria-labelledby="preview-title" className="rounded-2xl border p-5">
                <h3 id="preview-title" className="font-semibold">
                  {m.p8_preview_demo()}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{m.p8_demo_not_live()}</p>
                <div className="mt-4 rounded-xl bg-muted p-4 text-sm">{m.p8_preview_example()}</div>
              </section>
              <details className="rounded-2xl border p-5">
                <summary className="cursor-pointer font-semibold">{m.p8_details()}</summary>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Info label={m.p8_license()} value="creator-commercial" />
                  <Info label={m.p8_provenance()} value={m.p8_creator_owned()} />
                  <Info label={m.p8_dependencies()} value={m.p8_none()} />
                  <Info label={m.p8_reviews()} value={m.p8_no_reviews()} />
                </dl>
              </details>
            </div>
            <aside className="h-fit rounded-2xl border p-5 lg:sticky lg:top-6">
              <p className="text-sm text-muted-foreground">{m.p8_acquisition_price()}</p>
              <p className="mt-1 text-2xl font-semibold">{listing.price}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.p8_runtime_varies()}</p>
              <div className="mt-5 border-t pt-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="size-5 text-primary" />
                  {m.p8_trust_permissions()}
                </h3>
                <Trust icon={Check} title={m.p8_can()} text={m.p8_can_read()} />
                <Trust
                  icon={AlertTriangle}
                  title={m.p8_requires_approval()}
                  text={m.p8_external_approval()}
                />
                <Trust icon={X} title={m.p8_cannot()} text={m.p8_cannot_escalate()} />
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <BadgeCheck className="size-4" />
                  {m.p8_compatible()}
                </p>
              </div>
              {!acquired ? (
                <button
                  onClick={() => setAcquired(true)}
                  className="mt-5 min-h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
                >
                  {m.p8_acquire()}
                </button>
              ) : !installed ? (
                <>
                  <label className="mt-5 block text-sm">
                    {m.p8_install_destination()}
                    <select className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3">
                      <option>{m.p8_current_project()}</option>
                      <option>{m.p8_library()}</option>
                    </select>
                  </label>
                  <button
                    onClick={() => setInstalled(true)}
                    className="mt-3 min-h-11 w-full rounded-xl bg-primary text-primary-foreground"
                  >
                    {m.p8_install()}
                  </button>
                </>
              ) : (
                <button className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground">
                  {m.p8_use_now()}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </button>
              )}
            </aside>
          </section>
        ) : null}
        {view === "compare" ? (
          <section>
            <button onClick={() => setView("discover")} className="min-h-11 text-primary">
              {m.p8_back_results()}
            </button>
            <h2 className="text-xl font-semibold">{m.p8_compare()}</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-start">{m.p8_purpose()}</th>
                    <th className="p-3 text-start">{m.p8_price()}</th>
                    <th className="p-3 text-start">{m.p8_permissions()}</th>
                    <th className="p-3 text-start">{m.p8_compatibility()}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3">{listing.title}</td>
                    <td className="p-3">{listing.price}</td>
                    <td className="p-3">{m.p8_safe_read()}</td>
                    <td className="p-3">{m.p8_compatible()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        {view === "library" ? (
          <section>
            <h2 className="text-xl font-semibold">{m.p8_library()}</h2>
            <div className="mt-4 rounded-2xl border p-5">
              {installed ? (
                <>
                  <p className="font-medium">{listing.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {m.p8_installed()} · v{listing.version}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      m.p8_use_now(),
                      m.p8_review_permissions(),
                      m.p8_update(),
                      m.p8_disable(),
                      m.p8_uninstall(),
                    ].map((x) => (
                      <button key={x} className="min-h-11 rounded-lg border px-3 text-sm">
                        {x}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <Empty
                  title={m.p8_no_purchases()}
                  action={m.p8_find_capability()}
                  onAction={() => setView("discover")}
                />
              )}
            </div>
          </section>
        ) : null}
        {view === "creator" ? (
          <section>
            <h2 className="text-xl font-semibold">{m.p8_creator_studio()}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{m.p8_creator_flow()}</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_18rem]">
              <div className="rounded-2xl border p-5">
                <h3 className="font-semibold">{m.p8_validation_findings()}</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="rounded-lg bg-amber-500/10 p-3">{m.p8_fix_license()}</li>
                  <li className="rounded-lg bg-amber-500/10 p-3">{m.p8_fix_dependency()}</li>
                </ul>
                <button className="mt-4 min-h-11 rounded-xl bg-primary px-4 text-primary-foreground">
                  {m.p8_fix_draft()}
                </button>
              </div>
              <aside className="rounded-2xl border p-5">
                <h3 className="font-semibold">{m.p8_earnings()}</h3>
                <dl className="mt-3 space-y-3 text-sm">
                  <Info label={m.p8_gross_sales()} value="0" />
                  <Info label={m.p8_commission()} value="0" />
                  <Info label={m.p8_creator_earning()} value="0" />
                  <Info label={m.p8_payout_status()} value={m.p8_not_configured()} />
                </dl>
              </aside>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium" dir="auto">
        {value}
      </dd>
    </div>
  );
}
function Trust({ icon: Icon, title, text }: { icon: typeof Check; title: string; text: string }) {
  return (
    <div className="mt-3 flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
function Empty({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div role="status" className="py-8 text-center">
      <p>{title}</p>
      <button
        onClick={onAction}
        className="mt-3 min-h-11 rounded-xl bg-primary px-4 text-primary-foreground"
      >
        {action}
      </button>
    </div>
  );
}
