import { INGREDIENTS_BY_ID, PALE_COLORS, type Ingredient, type IngredientId, type ToppingShape } from "../data/ingredients";
import { hashString, seededRandom } from "../utils/random";
import { ToppingPiece } from "./ToppingPiece";

// Stock at which a pan looks full.
const FULL_PAN_QUANTITY = 12;

const DoughBalls = ({ quantity }: { quantity: number }) => {
  const ballCount = Math.min(6, Math.ceil(quantity / 2));
  return <>{Array.from({ length: ballCount }, (_, index) => {
    const cx = 16 + (index % 3) * 14;
    const cy = 22 + Math.floor(index / 3) * 16;
    return (
      <g key={index}>
        <circle cx={cx} cy={cy} r="7.5" fill="#efd7a6" stroke="#d6aa6b" strokeWidth="1.2" />
        <ellipse cx={cx - 2} cy={cy - 2.5} rx="3" ry="1.6" fill="#fff4dc" opacity=".7" />
      </g>
    );
  })}</>;
};

interface FillProps {
  ingredient: Ingredient;
  /** 0 (empty) to 1 (full). */
  fillRatio: number;
}

const LiquidLevel = ({ ingredient, fillRatio }: FillProps) => {
  const level = Math.max(0.25, fillRatio);
  return (
    <>
      <rect x="5" y={5 + 50 * (1 - level)} width="50" height={50 * level} rx="3" fill={ingredient.color} />
      <ellipse cx="22" cy="20" rx="9" ry="3" fill="#ffffff" opacity=".22" />
      {ingredient.id === "miel" && <path d="M14,34 Q22,28 30,34 T46,34" stroke="#c9850f" strokeWidth="1.4" fill="none" opacity=".6" />}
    </>
  );
};

const maxPiecesInPan = (shape: ToppingShape | undefined): number => {
  if (shape === "dot") return 70;
  if (shape === "cube") return 34;
  return 16;
};

const LoosePieces = ({ ingredient, fillRatio }: FillProps) => {
  const isBig = ingredient.shape === "egg" || ingredient.shape === "ball";
  const random = seededRandom(hashString("pan" + ingredient.id));
  const maxPieces = isBig ? 4 : maxPiecesInPan(ingredient.shape);
  const pieceCount = Math.max(isBig ? 1 : 3, Math.round(maxPieces * fillRatio));
  return <>{Array.from({ length: pieceCount }, (_, index) => {
    const x = 11 + random() * 38;
    const y = 11 + random() * 38;
    if (isBig) {
      return (
        <ToppingPiece key={index} ingredient={ingredient} x={16 + (index % 2) * 26} y={18 + Math.floor(index / 2) * 24} rotation={0} scale={0.42} />
      );
    }
    return (
      <ToppingPiece
        key={index}
        ingredient={ingredient}
        x={x}
        y={y}
        rotation={Math.round(random() * 360)}
        scale={ingredient.shape === "dot" ? 1.3 : 0.85}
      />
    );
  })}</>;
};

const PanContents = ({ ingredient, quantity }: { ingredient: Ingredient; quantity: number }) => {
  if (quantity <= 0) return null;
  const fillRatio = Math.min(1, quantity / FULL_PAN_QUANTITY);
  if (ingredient.kind === "base") return <DoughBalls quantity={quantity} />;
  if (ingredient.kind === "sauce" || ingredient.id === "miel") return <LiquidLevel ingredient={ingredient} fillRatio={fillRatio} />;
  return <LoosePieces ingredient={ingredient} fillRatio={fillRatio} />;
};

// Top-down view of a stainless gastro pan; how full it looks follows the stock.
export const IngredientPan = ({ id, quantity }: { id: IngredientId; quantity: number }) => {
  const ingredient = INGREDIENTS_BY_ID[id];
  const isPale = PALE_COLORS.includes(ingredient.color);
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <rect x="1" y="1" width="58" height="58" rx="6" fill="#c3cbcf" />
      <rect x="4" y="4" width="52" height="52" rx="4" fill={isPale && quantity > 0 ? "#9aa5ab" : "#aeb7bc"} />
      <rect x="4" y="4" width="52" height="52" rx="4" fill="none" stroke="#e9eef0" strokeWidth="1" opacity=".7" />
      <PanContents ingredient={ingredient} quantity={quantity} />
    </svg>
  );
};
