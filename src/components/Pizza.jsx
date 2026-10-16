import { INGREDIENTS_BY_ID } from "../data/ingredients.js";
import { sortByLayer, isSauce, isFilling } from "../game/pizza.js";
import { hashString, seededRandom } from "../utils/random.js";
import { ToppingPiece } from "./ToppingPiece.jsx";

const CENTER = 100;
const SAUCE_RADIUS = 74;
const TOPPING_SPREAD_RADIUS = 64;
const CHAR_SPOT_ANGLES = [20, 75, 140, 200, 260, 320];

const toRadians = (degrees) => (degrees * Math.PI) / 180;

function ScatteredToppings({ ingredient }) {
  if (ingredient.count === 1) return <ToppingPiece ingredient={ingredient} x={CENTER} y={CENTER} rotation={0} />;
  // Seeded by ingredient id so pieces stay put between renders and look the same on every pizza.
  const random = seededRandom(hashString(ingredient.id));
  return (
    <g>
      {Array.from({ length: ingredient.count }, (_, index) => {
        const distance = TOPPING_SPREAD_RADIUS * Math.sqrt(random());
        const angle = random() * Math.PI * 2;
        return (
          <ToppingPiece
            key={index}
            ingredient={ingredient}
            x={CENTER + distance * Math.cos(angle)}
            y={CENTER + distance * Math.sin(angle)}
            rotation={Math.round(random() * 360)}
          />
        );
      })}
    </g>
  );
}

export function Pizza({ ingredients, baked, className, size }) {
  const layers = sortByLayer(ingredients);
  const sauce = layers.find(isSauce);
  const fillings = layers.filter(isFilling);
  const label = layers.map((id) => INGREDIENTS_BY_ID[id].name).join(", ");
  return (
    <svg className={className} viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={label}>
      {layers.includes("pate") && (
        <>
          <circle cx={CENTER} cy={CENTER} r="90" fill={baked ? "#bf7f3c" : "#dcae6d"} />
          <circle cx={CENTER} cy={CENTER} r="79" fill={baked ? "#e6c07f" : "#efd7a6"} />
          {baked &&
            CHAR_SPOT_ANGLES.map((angle) => (
              <circle
                key={angle}
                cx={CENTER + 85 * Math.cos(toRadians(angle))}
                cy={CENTER + 85 * Math.sin(toRadians(angle))}
                r="4"
                fill="#6b3d1c"
                opacity=".55"
              />
            ))}
        </>
      )}
      {sauce && <circle cx={CENTER} cy={CENTER} r={SAUCE_RADIUS} fill={INGREDIENTS_BY_ID[sauce].color} opacity={baked ? 0.92 : 1} />}
      {fillings.map((id) => (
        <ScatteredToppings key={id} ingredient={INGREDIENTS_BY_ID[id]} />
      ))}
      {baked && <circle cx={CENTER} cy={CENTER} r={SAUCE_RADIUS} fill="#a85a1a" opacity=".07" />}
    </svg>
  );
}
