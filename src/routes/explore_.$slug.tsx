import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Header } from "@/components/xeomx/Header";
import { getSection } from "@/lib/explore-sections";
import { LaunchingSoon } from "@/components/xeomx/ComingSoon/LaunchingSoon";
import { InDevelopment } from "@/components/xeomx/ComingSoon/InDevelopment";
import { Vision } from "@/components/xeomx/ComingSoon/Vision";

export const Route = createFileRoute("/explore_/$slug")({
  head: ({ params }) => {
    const s = getSection(params.slug);
    const title = s ? `${s.name} — XeomX` : "Section — XeomX";
    const description = s?.tagline ?? "Explore the XeomX universe.";
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
        <h1 className="font-display text-4xl font-bold">Section not found</h1>
        <p className="mt-3 text-muted-foreground">This corner of the universe doesn't exist yet.</p>
        <Link to="/explore" className="mt-6 inline-flex rounded-full px-5 py-2 text-sm font-semibold text-black" style={{ background: "var(--gradient-gold)" }}>
          Back to Explore
        </Link>
      </div>
    </div>
  ),
  component: SectionPage,
});

function SectionPage() {
  const { section } = Route.useLoaderData();
  return (
    <div className="bg-background">
      <Header />
      {section.phase === "q1" && <LaunchingSoon section={section} />}
      {section.phase === "q2" && <InDevelopment section={section} />}
      {section.phase === "q3" && <Vision section={section} />}
      {section.phase === "live" && (
        <div className="mx-auto max-w-xl px-6 py-32 text-center">
          <h1 className="font-display text-3xl font-bold">{section.name}</h1>
          <p className="mt-3 text-muted-foreground">This section is live.</p>
          <Link to="/" className="mt-6 inline-flex rounded-full px-5 py-2 text-sm font-semibold text-black" style={{ background: "var(--gradient-gold)" }}>
            Open
          </Link>
        </div>
      )}
    </div>
  );
}