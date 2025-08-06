import { SidebarNavItem, SiteConfig } from "types";
import { env } from "@/env.mjs";

const site_url = env.NEXT_PUBLIC_SITE_URL;

export const siteConfig: SiteConfig = {
  name: "FluxKreaFree",
  description: "Experience Flux Krea - the opinionated AI model that excels in photorealism and avoids the oversaturated 'AI look'. Professional-grade image generation, completely free and open-source.",
  url: site_url,
  ogImage: `${site_url}/og.png`,
  links: {
    twitter: "https://twitter.com/fluxkreafree",
    github: "https://github.com/krea-ai/flux",
  },
  mailSupport: "support@fluxkreafree.com",
};
