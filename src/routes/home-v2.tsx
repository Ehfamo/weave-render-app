import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/xeomx/Header";
import { HeroV2 } from "@/components/xeomx/HomeV2/HeroV2";
import { PillarsV2 } from "@/components/xeomx/HomeV2/PillarsV2";
import { ClosingV2 } from "@/components/xeomx/HomeV2/ClosingV2";
import { pageUrl } from "@/lib/seo";

export const Route = createFileRoute("/home-v2")({
  head: () => ({
    meta: [
      { title: "XEOMX — Home v2" },
      {
        name: "description",
        content:
          "A new, isolated landing experience for XEOMX. The original homepage remains available at /.",
      },
      { property: "og:title", content: "XEOMX — Home v2" },
      {
        property: "og:description",
        content: "A new, isolated landing experience for XEOMX.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/home-v2") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/home-v2") }],
  }),
  component: HomeV2Page,
});

function HomeV2Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main">
        <HeroV2 />
        <PillarsV2 />
        <ClosingV2 />
      </main>
    </div>
  );
}