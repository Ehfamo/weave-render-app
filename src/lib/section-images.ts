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

// Per-slug unique cinematic assets
import landing from "@/assets/sections/slug/landing.jpg";
import login from "@/assets/sections/slug/login.jpg";
import dashboard from "@/assets/sections/slug/dashboard.jpg";
import home from "@/assets/sections/slug/home.jpg";
import studioCanvas from "@/assets/sections/slug/studio-canvas.jpg";
import visualWorkflow from "@/assets/sections/slug/visual-workflow.jpg";
import videoStudio from "@/assets/sections/slug/video-studio.jpg";
import codingStudio from "@/assets/sections/slug/coding-studio.jpg";
import appBuilder from "@/assets/sections/slug/app-builder.jpg";
import avatarStudio from "@/assets/sections/slug/3d-avatar-studio.jpg";
import voiceStudio from "@/assets/sections/slug/voice-studio.jpg";
import arVrStudio from "@/assets/sections/slug/ar-vr-studio.jpg";
import productionAutomation from "@/assets/sections/slug/production-automation.jpg";
import modelIntelligence from "@/assets/sections/slug/model-intelligence.jpg";
import aiCompare from "@/assets/sections/slug/ai-compare.jpg";
import fineTuning from "@/assets/sections/slug/fine-tuning.jpg";
import researchHub from "@/assets/sections/slug/research-hub.jpg";
import personalization from "@/assets/sections/slug/personalization.jpg";
import contextEngineering from "@/assets/sections/slug/context-engineering.jpg";
import multimodalChat from "@/assets/sections/slug/multimodal-chat.jpg";
import localExecution from "@/assets/sections/slug/local-execution.jpg";
import promptLibrary from "@/assets/sections/slug/prompt-library.jpg";
import agentStore from "@/assets/sections/slug/agent-store.jpg";
import knowledgeBase from "@/assets/sections/slug/knowledge-base.jpg";
import assetLibrary from "@/assets/sections/slug/asset-library.jpg";
import templateLibrary from "@/assets/sections/slug/template-library.jpg";
import exportCenter from "@/assets/sections/slug/export-center.jpg";
import docsAi from "@/assets/sections/slug/docs-ai.jpg";
import creatorMonetization from "@/assets/sections/slug/creator-monetization.jpg";
import creatorPayout from "@/assets/sections/slug/creator-payout.jpg";
import founders from "@/assets/sections/slug/founders.jpg";
import billing from "@/assets/sections/slug/billing.jpg";
import socialFeed from "@/assets/sections/slug/social-feed.jpg";
import community from "@/assets/sections/slug/community.jpg";
import viralSharing from "@/assets/sections/slug/viral-sharing.jpg";
import trends from "@/assets/sections/slug/trends.jpg";
import governance from "@/assets/sections/slug/governance.jpg";
import roadmap from "@/assets/sections/slug/roadmap.jpg";
import collaboration from "@/assets/sections/slug/collaboration.jpg";
import teamWorkspace from "@/assets/sections/slug/team-workspace.jpg";
import aiAgents from "@/assets/sections/slug/ai-agents.jpg";
import versionControl from "@/assets/sections/slug/version-control.jpg";
import humanLoop from "@/assets/sections/slug/human-loop.jpg";
import enterpriseAdmin from "@/assets/sections/slug/enterprise-admin.jpg";
import privacyCompliance from "@/assets/sections/slug/privacy-compliance.jpg";
import auditLog from "@/assets/sections/slug/audit-log.jpg";
import sso from "@/assets/sections/slug/sso.jpg";
import securityImg from "@/assets/sections/slug/security.jpg";
import costControl from "@/assets/sections/slug/cost-control.jpg";
import apiQuota from "@/assets/sections/slug/api-quota.jpg";
import backup from "@/assets/sections/slug/backup.jpg";
import settingsImg from "@/assets/sections/slug/settings.jpg";
import profile from "@/assets/sections/slug/profile.jpg";
import mobilePwa from "@/assets/sections/slug/mobile-pwa.jpg";
import integrations from "@/assets/sections/slug/integrations.jpg";
import accessibility from "@/assets/sections/slug/accessibility.jpg";
import localization from "@/assets/sections/slug/localization.jpg";
import performance from "@/assets/sections/slug/performance.jpg";
import analytics from "@/assets/sections/slug/analytics.jpg";
import superAppHub from "@/assets/sections/slug/super-app-hub.jpg";
import academy from "@/assets/sections/slug/academy.jpg";
import safety from "@/assets/sections/slug/safety.jpg";
import support from "@/assets/sections/slug/support.jpg";
import feedback from "@/assets/sections/slug/feedback.jpg";
import beta from "@/assets/sections/slug/beta.jpg";

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

// Per-slug unique cinematic images (every card gets its own artwork).
const SLUG_IMAGES: Record<string, string> = {
  landing, login, dashboard, home,
  "studio-canvas": studioCanvas,
  "visual-workflow": visualWorkflow,
  "video-studio": videoStudio,
  "coding-studio": codingStudio,
  "app-builder": appBuilder,
  "3d-avatar-studio": avatarStudio,
  "voice-studio": voiceStudio,
  "ar-vr-studio": arVrStudio,
  "production-automation": productionAutomation,
  "model-intelligence": modelIntelligence,
  "ai-compare": aiCompare,
  "fine-tuning": fineTuning,
  "research-hub": researchHub,
  personalization,
  "context-engineering": contextEngineering,
  "multimodal-chat": multimodalChat,
  "local-execution": localExecution,
  "prompt-library": promptLibrary,
  "agent-store": agentStore,
  "knowledge-base": knowledgeBase,
  "asset-library": assetLibrary,
  "template-library": templateLibrary,
  "export-center": exportCenter,
  "docs-ai": docsAi,
  "creator-monetization": creatorMonetization,
  "creator-payout": creatorPayout,
  founders,
  billing,
  "social-feed": socialFeed,
  community,
  "viral-sharing": viralSharing,
  trends,
  governance,
  roadmap,
  collaboration,
  "team-workspace": teamWorkspace,
  "ai-agents": aiAgents,
  "version-control": versionControl,
  "human-loop": humanLoop,
  "enterprise-admin": enterpriseAdmin,
  "privacy-compliance": privacyCompliance,
  "audit-log": auditLog,
  sso,
  security: securityImg,
  "cost-control": costControl,
  "api-quota": apiQuota,
  backup,
  settings: settingsImg,
  profile,
  "mobile-pwa": mobilePwa,
  integrations,
  accessibility,
  localization,
  performance,
  analytics,
  "super-app-hub": superAppHub,
  academy,
  safety,
  support,
  feedback,
  beta,
};

export function getSectionImage(section: Pick<ExploreSection, "slug" | "category">): string {
  return SLUG_IMAGES[section.slug] ?? CATEGORY_IMAGES[section.category] ?? coreImage;
}