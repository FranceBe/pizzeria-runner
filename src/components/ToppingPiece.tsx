import type { Ingredient } from "../data/ingredients";

interface ToppingPieceProps {
  ingredient: Ingredient;
  x: number;
  y: number;
  /** Degrees. */
  rotation: number;
  scale?: number;
}

// One piece of an ingredient (a mushroom slice, an olive ring…) drawn at (x, y), in SVG units.
export function ToppingPiece({ ingredient, x, y, rotation, scale = 1 }: ToppingPieceProps) {
  const color = ingredient.color;
  const transform = `translate(${x} ${y}) rotate(${rotation}) scale(${scale})`;
  switch (ingredient.shape) {
    case "blob":
      return (
        <g transform={transform}>
          <ellipse rx="12" ry="9" fill={color} opacity=".96" />
          {ingredient.hasVeins && <ellipse rx="5" ry="2" fill="#7f93a8" opacity=".7" />}
        </g>
      );
    case "leaf":
      return (
        <g transform={transform}>
          <ellipse rx={ingredient.thin ? 9 : 8} ry={ingredient.thin ? 2.6 : 4} fill={color} />
          <line x1="-6" x2="6" y1="0" y2="0" stroke="#255a22" strokeWidth=".8" />
        </g>
      );
    case "dot":
      return <circle cx={x} cy={y} r={(ingredient.radius || 1.6) * scale} fill={color} />;
    case "square":
      return <rect transform={transform} x="-5.5" y="-5.5" width="11" height="11" rx="2" fill={color} stroke="#f6c9c6" strokeWidth="1" />;
    case "mushroom":
      return (
        <g transform={transform}>
          <rect x="-2" y="-1" width="4" height="6" fill="#efe2cf" />
          <path d="M-7,0 A7,6 0 0 1 7,0 Z" fill={color} />
        </g>
      );
    case "ring":
      return <circle cx={x} cy={y} r={(ingredient.radius || 4.5) * scale} fill="none" stroke={color} strokeWidth={ingredient.strokeWidth || 2.2} />;
    case "strip":
      return <rect transform={transform} x="-8" y="-2" width="16" height="4" rx="2" fill={color} />;
    case "disc":
      return (
        <g transform={transform}>
          <circle r="8" fill={color} />
          <circle cx="-3" cy="-2" r="1.2" fill="#f2c1b0" />
          <circle cx="2.5" cy="2" r="1.1" fill="#f2c1b0" />
          <circle cx="3" cy="-3" r=".9" fill="#f2c1b0" />
        </g>
      );
    case "round":
      return <circle transform={transform} r="8" fill={color} stroke="#d8ccb3" strokeWidth="1.6" />;
    case "shaving":
      return <ellipse transform={transform} rx="5" ry="2.3" fill={color} />;
    case "fish":
      return <ellipse transform={transform} rx="11" ry="2.6" fill={color} stroke="#5d3a26" strokeWidth=".7" />;
    case "heart":
      return <path transform={transform} d="M0,-6 C5,-6 7,0 0,7 C-7,0 -5,-6 0,-6Z" fill={color} stroke="#6f824a" strokeWidth=".8" />;
    case "egg":
      return (
        <g transform={transform}>
          <ellipse rx="22" ry="18" fill="#fffdf6" />
          <circle r="8" fill="#f4b81f" />
        </g>
      );
    case "cube":
      return <rect transform={transform} x="-2.8" y="-2.8" width="5.6" height="5.6" rx="1" fill={color} />;
    case "slice":
      return <circle transform={transform} r="9" fill={color} stroke="#c9ad6c" strokeWidth="1.4" />;
    case "ribbon":
      return <path transform={transform} d="M-10,-3 Q-5,-7 0,-3 T10,-3 L10,3 Q5,-1 0,3 T-10,3Z" fill={color} />;
    case "ball":
      return (
        <g transform={transform}>
          <circle r="22" fill="#fffefa" />
          <circle cx="-6" cy="-6" r="8" fill="#ffffff" />
          <circle r="22" fill="none" stroke="#e7e1d2" strokeWidth="1.5" />
        </g>
      );
    case "drizzle":
      return (
        <path
          transform={transform}
          d="M-50,-30 Q-25,-44 0,-30 T50,-30 M-56,4 Q-28,-10 0,4 T56,4 M-46,36 Q-22,24 2,36 T46,36"
          stroke={color}
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />
      );
    default:
      return null;
  }
}
