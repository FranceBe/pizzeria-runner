import type { ReactNode } from "react";

export type TabId = "service" | "market" | "menu" | "upgrades" | "journal" | "settings";

// Line icons for the tabs, drawn with currentColor so they follow the tab's text colour.
const ICON_PATHS: Record<TabId, ReactNode> = {
  // A pizza slice
  service: (
    <>
      <path d="M12 3 3.5 19.5a1 1 0 0 0 1.2 1.4c4.6-1.6 10-1.6 14.6 0a1 1 0 0 0 1.2-1.4L12 3Z" />
      <circle cx="10" cy="13" r="1.3" />
      <circle cx="13.5" cy="16.5" r="1.3" />
      <circle cx="12.5" cy="10" r="1" />
    </>
  ),
  // A basket
  market: (
    <>
      <path d="M4 10h16l-1.6 9a1.5 1.5 0 0 1-1.5 1.2H7.1a1.5 1.5 0 0 1-1.5-1.2L4 10Z" />
      <path d="m8 10 3-6M16 10l-3-6M9 14v3M12 14v3M15 14v3" />
    </>
  ),
  // An open menu card
  menu: (
    <>
      <path d="M3 5.5c3-1.3 6-1.3 9 .5v14c-3-1.8-6-1.8-9-.5v-14ZM21 5.5c-3-1.3-6-1.3-9 .5v14c3-1.8 6-1.8 9-.5v-14Z" />
      <path d="M6 9.5h3M6 12.5h3M15 9.5h3M15 12.5h3" />
    </>
  ),
  // A hammer: work on the pizzeria
  upgrades: (
    <g transform="rotate(35 12 12)">
      <rect x="6" y="3" width="12" height="5" rx="1.2" />
      <path d="M12 8v13" strokeWidth="2.6" />
    </g>
  ),
  // A bar chart: the accounts open the journal
  journal: (
    <>
      <path d="M4 20.5h16" />
      <path d="M7.5 17v-4M12 17V7M16.5 17v-6.5" strokeWidth="3" />
    </>
  ),
  // Sliders
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
};

export const TabIcon = ({ tab }: { tab: TabId }) => {
  return (
    <svg className="tab-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[tab]}
    </svg>
  );
};
