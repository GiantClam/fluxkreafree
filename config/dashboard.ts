import { DashboardConfig } from "types";

export const dashboardConfig: DashboardConfig = {
  mainNav: [
    {
      title: "Support",
      href: "mailto:support@fluxkrea.free",
      disabled: false,
    },
  ],
  sidebarNav: [
    {
      title: "Flux Krea Free",
      items: [
        {
          title: "Index",
          href: "/app",
          icon: "HomeIcon",
        },
        {
          title: "Generate",
          href: "/app/generate",
          icon: "Eraser"
        },
        {
          title: "History",
          href: "/app/history",
          icon: "History",
        },
        {
          title: "GiftCode",
          href: "/app/giftcode",
          icon: "Gift",
        },
        {
          title: "ChargeOrder",
          href: "/app/order",
          icon: "billing",
        },
      ],
    },
  ],
};
