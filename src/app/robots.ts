import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";

// Per-user / thin surfaces no crawler should index.
const DISALLOW = ["/api/", "/admin", "/vendor/dashboard", "/enquiries", "/shortlist"];

// Answer-engine + training crawlers, welcomed explicitly. Patch is AI-native —
// being read and cited by these is a primary channel, so we name them rather
// than relying on the wildcard (and guard against an accidental future block).
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",      // OpenAI (train / search / act)
  "ClaudeBot", "Claude-Web", "anthropic-ai",       // Anthropic
  "PerplexityBot", "Perplexity-User",              // Perplexity
  "Google-Extended",                                // Gemini / AI Overviews training
  "Applebot-Extended",                              // Apple Intelligence
  "CCBot", "cohere-ai",                             // Common Crawl, Cohere
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_BOTS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
