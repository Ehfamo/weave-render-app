import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Header } from "@/components/xeomx/Header";
import { getSection } from "@/lib/explore-sections";
import { LaunchingSoon } from "@/components/xeomx/ComingSoon/LaunchingSoon";
import { InDevelopment } from "@/components/xeomx/ComingSoon/InDevelopment";
import { Vision } from "@/components/xeomx/ComingSoon/Vision";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/explore_/$slug")({
  head: ({ params }) => {
    const s = getSection(params.slug);
    const title = s ? m.section_head_title({ name: s.name }) : m.section_head_generic();
    const description = s?.tagline ?? m.section_head_default_desc();
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  loader: ({ params }) => {
    const section = getSection(params.slug);
    if (!section) throw notFound();
    return { section };
  },
  notFoundComponent: () => (
    <div className="min-h-svh bg-background">
      <Header />
      <div className="mx-auto max-w-xl px-6 py-32 text-center">
        <h1 className="font-display text-4xl font-bold">{m.section_not_found()}</h1>
        <p className="mt-3 text-muted-foreground">{m.section_not_found_desc()}</p>
        <Link to="/explore" className="mt-6 inline-flex rounded-full px-5 py-2 text-sm font-semibold text-black" style={{ background: "var(--gradient-gold)" }}>
          {m.section_back_to_explore()}
        </Link>
      </div>
    </div>
  ),
  component: SectionPage,
});

function SectionPage() {
  const loaderData = Route.useLoaderData();
  const section = loaderData?.section;

  if (!section) throw notFound();

  return (
    <div className="bg-background">
      <Header />
      {section.phase === "q1" && <LaunchingSoon section={section} />}
      {section.phase === "q2" && <InDevelopment section={section} />}
      {section.phase === "q3" && <Vision section={section} />}
      {section.phase === "live" && (
        <div className="mx-auto max-w-xl px-6 py-32 text-center">
          <h1 className="font-display text-3xl font-bold">{section.name}</h1>
          <p className="mt-3 text-muted-foreground">{m.section_live_message()}</p>
          <Link to="/" className="mt-6 inline-flex rounded-full px-5 py-2 text-sm font-semibold text-black" style={{ background: "var(--gradient-gold)" }}>
            {m.section_open()}
          </Link>
        </div>
      )}
    </div>
  );
}