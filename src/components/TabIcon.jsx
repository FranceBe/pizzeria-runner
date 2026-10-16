// Line icons for the tabs, drawn with currentColor so they follow the tab's text colour.
const ICON_PATHS = {
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
  // An arrow going up out of a bar
  upgrades: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  // A gear
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
};

export function TabIcon({ tab }) {
  return (
    <svg className="tab-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[tab]}
    </svg>
  );
}
