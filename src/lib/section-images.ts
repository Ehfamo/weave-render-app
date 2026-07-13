import creationStudios from "@/assets/sections/creation-studios.jpg";
import intelligenceModels from "@/assets/sections/intelligence-models.jpg";
import marketplaceLibrary from "@/assets/sections/marketplace-library.jpg";
import creatorEconomy from "@/assets/sections/creator-economy.jpg";
import socialCommunity from "@/assets/sections/social-community.jpg";
import collaborationWorkflow from "@/assets/sections/collaboration-workflow.jpg";
import adminEnterprise from "@/assets/sections/admin-enterprise.jpg";
import platformSettings from "@/assets/sections/platform-settings.jpg";
import supportGrowth from "@/assets/sections/support-growth.jpg";
import coreImage from "@/assets/sections/core.jpg";
import type { ExploreSection } from "./explore-sections";

// Category-level cinematic backgrounds. Every card falls back to its category
// image; specific slugs can override here for a unique visual per card.
const CATEGORY_IMAGES: Record<string, string> = {
  "Creation Studios": creationStudios,
  "Intelligence & Models": intelligenceModels,
  "Marketplace & Library": marketplaceLibrary,
  "Creator Economy": creatorEconomy,
  "Social & Community": socialCommunity,
  "Collaboration & Workflow": collaborationWorkflow,
  "Admin & Enterprise": adminEnterprise,
  "Platform & Settings": platformSettings,
  "Support & Growth": supportGrowth,
  core: coreImage,
};

// Per-slug overrides. Add entries here to give a specific card a unique image.
const SLUG_IMAGES: Record<string, string> = {};

export function getSectionImage(section: Pick<ExploreSection, "slug" | "category">): string {
  return SLUG_IMAGES[section.slug] ?? CATEGORY_IMAGES[section.category] ?? coreImage;
}