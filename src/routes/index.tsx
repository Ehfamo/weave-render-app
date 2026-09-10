import { createFileRoute } from "@tanstack/react-router";
import { HomeExperience } from "@/components/xeomx/os/HomeExperience";
import { pageUrl } from "@/lib/seo";
import { heroPreloadLinks } from "@/components/xeomx/HeroBackground";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "XeomX — Cinematic AI Prompt Marketplace" },
      {
        name: "description",
        content:
          "Discover, remix and own the world's most cinematic AI prompts. Netflix-style discovery, viral feed, premium drops.",
      },
      { property: "og:title", content: "XeomX — Cinematic AI Prompt Marketplace" },
      {
        property: "og:description",
        content: "Discover, remix and own the world's most cinematic AI prompts.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/") }, ...heroPreloadLinks],
  }),
  component: HomeExperience,
});
