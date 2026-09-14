import { Link } from "@tanstack/react-router";
import { ArrowRight, Store } from "lucide-react";
import { m } from "@/paraglide/messages.js";
export function MarketplaceHomeCta() {
  return (
    <section
      aria-labelledby="market-title"
      className="mt-10 flex flex-col gap-4 rounded-2xl border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h2 id="market-title" className="flex items-center gap-2 text-xl font-semibold">
          <Store className="size-5" />
          {m.p8_marketplace()}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{m.p8_marketplace_hint()}</p>
      </div>
      <Link
        to="/marketplace"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        {m.p8_find_capability()}
        <ArrowRight className="size-4 rtl:rotate-180" />
      </Link>
    </section>
  );
}
