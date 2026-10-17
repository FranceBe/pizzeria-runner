import { DRINKS, type DrinkId } from "../data/drinks";

// A small glass (or bottle, for wine and chinotto) filled with the drink's colour.
export function DrinkGlass({ id, className }: { id: DrinkId; className?: string }) {
  const { color } = DRINKS[id];
  const isBottle = id === "vin" || id === "chinotto";
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      {isBottle ? (
        <>
          <path d="M10 2h4v5c2 1 3 2.5 3 4.5V21a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-9.5C7 9.5 8 8 10 7V2Z" fill={color} />
          <rect x="7.5" y="13" width="9" height="5" rx="1" fill="#fff" opacity=".8" />
        </>
      ) : (
        <>
          <path d="M6 4h12l-1.4 16.2a1 1 0 0 1-1 .8H8.4a1 1 0 0 1-1-.8L6 4Z" fill="#fff" opacity=".7" stroke="#9aa5ab" strokeWidth="1" />
          <path d="M7 9h10l-1 11H8L7 9Z" fill={color} />
          {id === "eau" && <circle cx="11" cy="14" r="1" fill="#fff" />}
          {id === "limonade" && <circle cx="15" cy="6" r="3" fill="#f2d33b" stroke="#c9a91f" strokeWidth=".8" />}
        </>
      )}
    </svg>
  );
}
