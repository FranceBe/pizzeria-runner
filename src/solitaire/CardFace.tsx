// The pizza deck, drawn in SVG: tomatoes and salami (the red suits), basil and olives (the green ones). Each card is
// 100 × 140 units; the rank and suit sit in the top strip, the part left showing when cards overlap in a column.
import { memo } from "react";
import { colorOf, type Suit } from "./klondike";

const INK = { red: "#b8322a", green: "#2c6e2f" } as const;

// One suit's symbol, centred on 0,0, about 20 units across.
export const Pip = ({ suit }: { suit: Suit }) => {
  switch (suit) {
    case "tomato":
      return (
        <g>
          <circle r="8.5" fill="#d8402c" />
          <ellipse cx="-3" cy="-2.5" rx="2.4" ry="1.6" fill="#f08a6e" opacity=".8" />
          <path d="M0,-8.5 l2.2,-2.6 l0.4,3 l3,-0.4 l-2.4,2 M0,-8.5 l-2.2,-2.6 l-0.4,3 l-3,-0.4 l2.4,2" fill="#3f8f3a" stroke="#3f8f3a" strokeWidth="1.2" strokeLinejoin="round" />
        </g>
      );
    case "salami":
      return (
        <g>
          <circle r="8.5" fill="#a52a24" stroke="#7d1d19" strokeWidth="1.2" />
          <ellipse cx="-3" cy="-2" rx="1.6" ry="1.1" fill="#f2c4b4" />
          <ellipse cx="3" cy="1" rx="1.3" ry="1" fill="#f2c4b4" />
          <ellipse cx="-1" cy="4" rx="1.4" ry="1" fill="#f2c4b4" />
          <ellipse cx="2.5" cy="-4.5" rx="1" ry=".8" fill="#f2c4b4" />
        </g>
      );
    case "basil":
      return (
        <g transform="rotate(-25)">
          <path d="M0,-10 C7.5,-5 7.5,5 0,10 C-7.5,5 -7.5,-5 0,-10Z" fill="#3c8c37" />
          <path d="M0,-8 L0,9 M0,-2 L3.5,-5 M0,2 L-3.5,-1 M0,5 L3,3" stroke="#a8d79a" strokeWidth="1" strokeLinecap="round" fill="none" />
        </g>
      );
    case "olive":
      return (
        <g transform="rotate(20)">
          <ellipse rx="6.5" ry="8.8" fill="#6e8b2b" stroke="#4f661c" strokeWidth="1.2" />
          <ellipse cx="0" cy="-1" rx="2.4" ry="3" fill="#c84a32" />
          <ellipse cx="-3" cy="-5" rx="1.4" ry="2" fill="#b7c97a" opacity=".8" />
        </g>
      );
  }
};

// The kings, queens and jacks wear a crown, a tiara and a chef's hat over a whole pizza of their suit.
const Headwear = ({ rank }: { rank: number }) => {
  if (rank === 11) {
    return (
      <g transform="translate(50 36)">
        <path d="M-14,8 h28 v-7 a8,8 0 0 0 -3,-14 a9,9 0 0 0 -11,-4 a9,9 0 0 0 -11,4 a8,8 0 0 0 -3,14z" fill="#fffdf7" stroke="#cfc6b4" strokeWidth="1.5" />
        <line x1="-14" y1="4" x2="14" y2="4" stroke="#cfc6b4" strokeWidth="1.2" />
      </g>
    );
  }
  if (rank === 12) {
    return (
      <g transform="translate(50 40)">
        <path d="M-16,6 Q0,-2 16,6 L13,-4 L7,1 L0,-9 L-7,1 L-13,-4z" fill="#e9b83b" stroke="#b8862a" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="0" cy="-9" r="2.2" fill="#c84a32" />
      </g>
    );
  }
  return (
    <g transform="translate(50 38)">
      <path d="M-17,8 h34 l3,-16 l-9,6 l-6,-11 l-5,10 l-5,-10 l-6,11 l-9,-6z" fill="#e9b83b" stroke="#b8862a" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="-8.5" cy="3" r="1.8" fill="#c84a32" />
      <circle cx="0" cy="3" r="1.8" fill="#3c8c37" />
      <circle cx="8.5" cy="3" r="1.8" fill="#c84a32" />
    </g>
  );
};

const TOPPING_SPOTS = [[0, 0], [-12, -8], [12, -7], [-11, 9], [11, 10], [0, -16], [0, 16]] as const;

const FacePizza = ({ suit, rank }: { suit: Suit; rank: number }) => (
  <g>
    <circle cx="50" cy="88" r="31" fill="#d9a35b" />
    <circle cx="50" cy="88" r="25.5" fill="#cf4a2a" />
    <circle cx="42" cy="80" r="5" fill="#f6e3b4" opacity=".9" />
    <circle cx="59" cy="96" r="4.5" fill="#f6e3b4" opacity=".9" />
    {TOPPING_SPOTS.map(([x, y], i) => (
      <g key={i} transform={`translate(${50 + x} ${88 + y}) scale(.5)`}>
        <Pip suit={suit} />
      </g>
    ))}
    <Headwear rank={rank} />
  </g>
);

interface CardFaceProps {
  suit: Suit;
  rank: number;
  /** The rank's letter, in the player's language (V/D/R in French). */
  label: string;
}

export const CardFace = memo(({ suit, rank, label }: CardFaceProps) => {
  const ink = INK[colorOf(suit)];
  return (
    <svg viewBox="0 0 100 140" className="card-svg" aria-hidden="true">
      <rect x="1" y="1" width="98" height="138" rx="9" fill="#fffaf0" stroke="#d9cdb6" strokeWidth="2" />
      <text x="8" y="29" className="card-rank" fill={ink} fontSize={label.length > 1 ? 25 : 29}>{label}</text>
      <g transform="translate(83 19) scale(.95)"><Pip suit={suit} /></g>
      {rank >= 11 ? (
        <FacePizza suit={suit} rank={rank} />
      ) : rank === 1 ? (
        <g>
          <circle cx="50" cy="88" r="27" fill="none" stroke={ink} strokeWidth="2" opacity=".25" />
          <g transform="translate(50 88) scale(2.3)"><Pip suit={suit} /></g>
        </g>
      ) : (
        <g transform="translate(50 88) scale(1.9)"><Pip suit={suit} /></g>
      )}
    </svg>
  );
});
CardFace.displayName = "CardFace";

// The back: a red and white tablecloth, a pizza in the middle.
export const CardBack = memo(() => (
  <svg viewBox="0 0 100 140" className="card-svg" aria-hidden="true">
    <defs>
      <pattern id="gingham" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#fbeee6" />
        <rect width="7" height="14" fill="#d8402c" opacity=".55" />
        <rect width="14" height="7" fill="#d8402c" opacity=".55" />
      </pattern>
    </defs>
    <rect x="1" y="1" width="98" height="138" rx="9" fill="url(#gingham)" stroke="#9e2c20" strokeWidth="2" />
    <rect x="7" y="7" width="86" height="126" rx="6" fill="none" stroke="#fffaf0" strokeWidth="2" opacity=".85" />
    <circle cx="50" cy="70" r="20" fill="#d9a35b" stroke="#fffaf0" strokeWidth="2" />
    <circle cx="50" cy="70" r="15.5" fill="#cf4a2a" />
    <circle cx="44" cy="65" r="3.4" fill="#f6e3b4" />
    <circle cx="56" cy="74" r="3" fill="#f6e3b4" />
    <circle cx="55" cy="63" r="2.6" fill="#a52a24" />
    <circle cx="45" cy="76" r="2.6" fill="#a52a24" />
  </svg>
));
CardBack.displayName = "CardBack";
