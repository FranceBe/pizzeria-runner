// The pizzeria's front, drawn next to the sign: it fills up as upgrades are bought.
//   decor  1: potted plants · 3: they flower (2 adds string lights, see .lights in Header)
//   room   one bistro table per level
//   oven   a wood-fired oven, its fire growing with each level
import type { UpgradeKey } from "../data/progression";

function PottedPlant({ isFlowering, isFlipped = false }: { isFlowering: boolean; isFlipped?: boolean }) {
  return (
    <svg className="decor plant" viewBox="0 0 30 40" style={isFlipped ? { transform: "scaleX(-1)" } : undefined}>
      <ellipse cx="10" cy="17" rx="4" ry="9" transform="rotate(-25 10 17)" fill="#3f8f3a" />
      <ellipse cx="20" cy="15" rx="4" ry="10" transform="rotate(20 20 15)" fill="#2c7746" />
      <ellipse cx="15" cy="13" rx="3.5" ry="10" fill="#4f9f45" />
      {isFlowering && (
        <>
          <circle cx="8" cy="9" r="3" fill="#f08aa6" />
          <circle cx="22" cy="6" r="3" fill="#ffd36b" />
          <circle cx="15" cy="4" r="2.6" fill="#f08aa6" />
        </>
      )}
      <path d="M7 26h16l-2 13H9z" fill="#c8693f" />
      <rect x="6" y="24" width="18" height="4" rx="1" fill="#b05a33" />
    </svg>
  );
}

function BistroTable() {
  return (
    <svg className="decor table" viewBox="0 0 44 40">
      <path d="M6 16v22M6 26h7v12M38 16v22M38 26h-7v12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="22" cy="22" rx="12" ry="3.5" fill="var(--accent)" />
      <path d="M12 22.5q2 3 5 0q2.5 3 5 0q2.5 3 5 0q3 3 5 0" fill="#fff" opacity=".85" />
      <path d="M22 25v13M17 38h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WoodOven({ level }: { level: number }) {
  return (
    <svg className="decor oven-front" viewBox="0 0 44 40">
      <rect x="18" y="1" width="7" height="10" fill="#8a4a33" />
      <path d="M4 38V24a18 16 0 0 1 36 0v14z" fill="#b5543a" />
      <path d="M4 30h36M10 22h24M8 34h28" stroke="#8a3f29" strokeWidth="1" opacity=".6" />
      <path d="M13 38v-7a9 8 0 0 1 18 0v7z" fill="#2a1d17" />
      <g className="flame">
        <path d={`M22 38c-${3 + level} 0-${4 + level}-4-${1 + level}-${8 + 2 * level}c1 3 3 3 3 0c2 3 ${3 + level} 5 ${2 + level} 8c-1 0-2 0-4 0z`} fill="#ff8a2b" />
        <path d="M22 38c-2 0-2.5-3-.5-5c.5 2 2.5 2 2.5 5z" fill="#ffd36b" />
      </g>
    </svg>
  );
}

export function StorefrontDecor({ upgrades }: { upgrades: Record<UpgradeKey, number> }) {
  const { deco, salle, oven } = upgrades;
  if (!deco && !salle && !oven) return null;
  return (
    <div className="storefront" aria-hidden="true">
      {deco >= 1 && <PottedPlant isFlowering={deco >= 3} />}
      {Array.from({ length: salle }, (_, index) => <BistroTable key={index} />)}
      {oven >= 1 && <WoodOven level={oven} />}
      {deco >= 1 && <PottedPlant isFlowering={deco >= 3} isFlipped />}
    </div>
  );
}
