import { INGREDIENTS_BY_ID, type Ingredient, type IngredientId, type PastaShape } from "../data/ingredients";
import { isFilling, isSauce, sortByLayer } from "../game/pizza";
import { hashString, seededRandom } from "../utils/random";
import { ToppingPiece } from "./ToppingPiece";

// A plate of pasta, seen from above, in the pizza's 200 × 200 frame: the plate, the pasta (its shape), the sauce, then
// what goes on top. Pieces are seeded by ingredient, so a plate looks the same on every screen.
const CENTER = 100;

const darker = (hex: string, amount = 0.18): string => {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.max(0, Math.round(((value >> shift) & 255) * (1 - amount)));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
};

const Spaghetti = ({ color }: { color: string }) => {
  const random = seededRandom(hashString("spaghetti"));
  return (
    <g fill="none" strokeLinecap="round">
      {Array.from({ length: 22 }, (_, index) => {
        const radius = 16 + random() * 40;
        const start = random() * Math.PI * 2;
        const sweep = 1.4 + random() * 2.2;
        const cx = CENTER + (random() - 0.5) * 14;
        const cy = CENTER + (random() - 0.5) * 14;
        const [x1, y1] = [cx + radius * Math.cos(start), cy + radius * Math.sin(start)];
        const [x2, y2] = [cx + radius * Math.cos(start + sweep), cy + radius * Math.sin(start + sweep)];
        const d = `M${x1.toFixed(1)},${y1.toFixed(1)} A${radius.toFixed(1)},${radius.toFixed(1)} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
        return (
          <g key={index}>
            <path d={d} stroke={darker(color)} strokeWidth="4.4" />
            <path d={d} stroke={color} strokeWidth="3" />
          </g>
        );
      })}
    </g>
  );
};

const Penne = ({ color }: { color: string }) => {
  const random = seededRandom(hashString("penne"));
  return (
    <g>
      {Array.from({ length: 20 }, (_, index) => {
        const distance = 48 * Math.sqrt(random());
        const angle = random() * Math.PI * 2;
        const x = CENTER + distance * Math.cos(angle);
        const y = CENTER + distance * Math.sin(angle);
        return (
          <g key={index} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${Math.round(random() * 180)})`}>
            <path d="M-10,-4 L8,-4 L11,4 L-7,4 Z" fill={color} stroke={darker(color)} strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M-6,-4 L-3,4 M0,-4 L3,4 M5,-4 L8,4" stroke={darker(color, 0.1)} strokeWidth=".8" />
          </g>
        );
      })}
    </g>
  );
};

const Tagliatelle = ({ color }: { color: string }) => {
  const random = seededRandom(hashString("tagliatelle"));
  return (
    <g fill="none" strokeLinecap="round">
      {Array.from({ length: 11 }, (_, index) => {
        const y = CENTER - 42 + index * 8.4 + (random() - 0.5) * 4;
        const wave = 6 + random() * 6;
        const d = `M${CENTER - 46},${y.toFixed(1)} q 15,${-wave} 30,0 t 30,0 t 30,0`;
        return (
          <g key={index}>
            <path d={d} stroke={darker(color)} strokeWidth="8.4" />
            <path d={d} stroke={color} strokeWidth="6.4" />
          </g>
        );
      })}
    </g>
  );
};

// Lasagne: a slice from the dish, its layers showing on the side, the top browned in the oven.
const Lasagne = ({ color, sauce, baked }: { color: string; sauce?: string; baked: boolean }) => (
  <g>
    <rect x="48" y="52" width="104" height="96" rx="8" fill={color} stroke={darker(color)} strokeWidth="2" />
    {[66, 84, 102, 120].map((y) => (
      <rect key={y} x="50" y={y} width="100" height="7" fill={sauce ?? darker(color, 0.25)} opacity=".85" />
    ))}
    {baked && [[70, 64], [118, 78], [92, 110], [130, 132], [64, 128]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="7" fill="#b9682a" opacity=".45" />)}
  </g>
);

const ScatteredOnPlate = ({ ingredient }: { ingredient: Ingredient }) => {
  if (ingredient.count === 1) return <ToppingPiece ingredient={ingredient} x={CENTER} y={CENTER - 6} rotation={0} scale={0.8} />;
  const random = seededRandom(hashString(`plate${ingredient.id}`));
  return (
    <g>
      {Array.from({ length: Math.min(ingredient.count ?? 0, ingredient.shape === "dot" ? 24 : 10) }, (_, index) => {
        const distance = 42 * Math.sqrt(random());
        const angle = random() * Math.PI * 2;
        return (
          <ToppingPiece
            key={index}
            ingredient={ingredient}
            x={CENTER + distance * Math.cos(angle)}
            y={CENTER + distance * Math.sin(angle)}
            rotation={Math.round(random() * 360)}
            scale={0.8}
          />
        );
      })}
    </g>
  );
};

const PastaBody = ({ shape, color, sauce, baked }: { shape: PastaShape; color: string; sauce?: string; baked: boolean }) => {
  if (shape === "lasagne") return <Lasagne color={color} sauce={sauce} baked={baked} />;
  if (shape === "penne") return <Penne color={color} />;
  if (shape === "tagliatelle") return <Tagliatelle color={color} />;
  return <Spaghetti color={color} />;
};

export const PastaPlate = ({ ingredients, baked }: { ingredients: readonly IngredientId[]; baked: boolean }) => {
  const layers = sortByLayer(ingredients);
  const pasta = layers.map((id) => INGREDIENTS_BY_ID[id]).find((ingredient) => ingredient.pasta);
  const sauceId = layers.find(isSauce);
  const sauce = sauceId ? INGREDIENTS_BY_ID[sauceId].color : undefined;
  const fillings = layers.filter(isFilling);
  return (
    <g>
      <circle cx={CENTER} cy={CENTER} r="94" fill="#f6f2ea" stroke="#d9d2c4" strokeWidth="2" />
      <circle cx={CENTER} cy={CENTER} r="74" fill="#fffdf8" stroke="#ebe5d9" strokeWidth="1.5" />
      {pasta?.pasta && <PastaBody shape={pasta.pasta} color={pasta.color} sauce={sauce} baked={baked} />}
      {/* The sauce over the pasta (on lasagne, it is in the layers already). */}
      {sauce && pasta?.pasta !== "lasagne" && <circle cx={CENTER} cy={CENTER} r="36" fill={sauce} opacity=".88" />}
      {fillings.map((id) => (
        <ScatteredOnPlate key={id} ingredient={INGREDIENTS_BY_ID[id]} />
      ))}
    </g>
  );
};

// A little of a pasta, for its pan at the prep line or its icon: bundles, tubes, nests, sheets.
export const PastaPile = ({ shape, color, scale = 1 }: { shape: PastaShape; color: string; scale?: number }) => {
  const outline = darker(color);
  if (shape === "spaghetti") {
    return (
      <g transform={`scale(${scale})`} stroke={outline} strokeWidth="0.6">
        {[-6, -3, 0, 3, 6].map((x) => (
          <rect key={x} x={x - 1} y="-12" width="2" height="24" rx="1" fill={color} transform={`rotate(${x * 1.5})`} />
        ))}
      </g>
    );
  }
  if (shape === "penne") {
    return (
      <g transform={`scale(${scale})`}>
        {[[-5, -4, 20], [5, 2, -30], [-2, 6, 70]].map(([x, y, rotation]) => (
          <path key={`${x}${y}`} d="M-6,-2.5 L5,-2.5 L7,2.5 L-4,2.5 Z" fill={color} stroke={outline} strokeWidth="0.8" transform={`translate(${x} ${y}) rotate(${rotation})`} />
        ))}
      </g>
    );
  }
  if (shape === "tagliatelle") {
    return (
      <g transform={`scale(${scale})`} fill="none" strokeLinecap="round">
        <circle r="8" stroke={outline} strokeWidth="5" />
        <circle r="8" stroke={color} strokeWidth="3.6" />
        <circle r="3" stroke={color} strokeWidth="3" />
      </g>
    );
  }
  return (
    <g transform={`scale(${scale})`}>
      {[4, 0, -4].map((offset) => (
        <rect key={offset} x={-10 + offset / 2} y={-7 + offset} width="20" height="12" rx="2" fill={color} stroke={outline} strokeWidth="0.8" />
      ))}
    </g>
  );
};
