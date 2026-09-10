import { lazy, Suspense } from "react";
import { PromptCard } from "@/components/xeomx/PromptCard";
import { Row } from "@/components/xeomx/Row";
import { PROMPTS, ROWS, type Prompt } from "@/lib/prompts";
import { selectDiscoveryRows } from "@/lib/discovery";
import { m } from "@/paraglide/messages.js";
const IndexRails = lazy(() =>
  import("@/components/xeomx/IndexRails").then((module) => ({ default: module.IndexRails })),
);
export function HomeDiscoverySection({
  filtered,
  isFiltering,
}: {
  filtered: Prompt[];
  isFiltering: boolean;
}) {
  return (
    <>
      {isFiltering ? (
        <section className="space-y-6 px-4 sm:px-8">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">
            {m.results_title()} <span className="text-muted-foreground">({filtered.length})</span>
          </h2>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground">{m.results_empty()}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
              {filtered.map((p) => (
                <div key={p.id} className="contents">
                  <PromptCard prompt={p} />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {selectDiscoveryRows(PROMPTS, ROWS).map((row) => (
            <Row key={row.title} title={row.title} tag={row.tag} ids={row.ids} />
          ))}

          <Suspense fallback={<div style={{ minHeight: 400 }} aria-hidden />}>
            <IndexRails />
          </Suspense>
        </>
      )}
    </>
  );
}
