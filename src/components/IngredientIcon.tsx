import { INGREDIENTS_BY_ID, PALE_COLORS, type Ingredient, type IngredientId } from "../data/ingredients";
import { ToppingPiece } from "./ToppingPiece";

const DOT_POSITIONS: readonly (readonly [number, number])[] = [[-5, -3], [4, -5], [0, 3], [-4, 6], [6, 4], [-8, 1]];

const IconBody = ({ ingredient }: { ingredient: Ingredient }) => {
  const { kind, shape, color } = ingredient;
  if (kind === "base") return <circle r="12" fill="#efd7a6" stroke="#dcae6d" strokeWidth="3" />;
  if (kind === "sauce") {
    return (
      <>
        <circle r="12" fill="#efd7a6" />
        <circle r="9" fill={color} />
      </>
    );
  }
  if (shape === "dot") {
    return (
      <>
        {DOT_POSITIONS.map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r={Math.max(1.7, ingredient.radius || 1.6)} fill={color} />
        ))}
      </>
    );
  }
  if (shape === "egg" || shape === "ball") return <ToppingPiece ingredient={ingredient} x={0} y={0} rotation={0} scale={0.55} />;
  if (shape === "drizzle") {
    return <path d="M-12,-5 Q-6,-10 0,-5 T12,-5 M-12,5 Q-6,0 0,5 T12,5" stroke={color} strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  }
  // Small pieces read better as a little pile of three.
  if (shape === "cube" || shape === "shaving") {
    return (
      <>
        <ToppingPiece ingredient={ingredient} x={-4} y={-3} rotation={20} />
        <ToppingPiece ingredient={ingredient} x={5} y={2} rotation={-30} />
        <ToppingPiece ingredient={ingredient} x={-2} y={6} rotation={60} />
      </>
    );
  }
  return <ToppingPiece ingredient={ingredient} x={0} y={0} rotation={-15} scale={1.15} />;
};

export const IngredientIcon = ({ id, className }: { id: IngredientId; className?: string }) => {
  const ingredient = INGREDIENTS_BY_ID[id];
  const needsBackdrop = PALE_COLORS.includes(ingredient.color) && ingredient.kind !== "base";
  return (
    <svg className={className} viewBox="-16 -16 32 32" aria-hidden="true">
      {needsBackdrop && <circle r="15" fill="#c9a06c" opacity=".35" />}
      <IconBody ingredient={ingredient} />
    </svg>
  );
};
