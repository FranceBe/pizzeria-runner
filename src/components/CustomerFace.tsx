import type { AccessoryId } from "../data/customers";
import type { Looks, Mood } from "../game/types";

// Indexed by mood: smile, flat, slight frown, frown.
const MOUTH_PATHS: Record<Mood, string> = ["M13,27 Q20,33 27,27", "M14,28.5 L26,28.5", "M14,30 Q20,27 26,30", "M13,31 Q20,25 27,31"];
const INK = "#1f1a17";

// Hair behind the head: long hair, curls, a ponytail. Drawn before the face.
function HairBack({ style, color }: { style: number; color: string }) {
  if (style === 3) return <path d="M5,24 Q4,5 20,5 Q36,5 35,24 L36,38 L4,38Z" fill={color} />;
  if (style === 4) return <circle cx="20" cy="16" r="15" fill={color} />;
  if (style === 5) return <ellipse cx="34" cy="25" rx="4" ry="10" fill={color} transform="rotate(-12 34 25)" />;
  return null;
}

// Hair on top of the head. Drawn after the face.
function HairFront({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 0:
    case 5:
      return <path d="M6,20 Q8,6 20,6 Q32,6 34,20 Q30,12 20,12 Q10,12 6,20Z" fill={color} />;
    case 1:
      return <path d="M5,26 Q4,6 20,5 Q36,6 35,26 L32,26 Q32,13 20,12 Q8,13 8,26Z" fill={color} />;
    case 2:
      return (
        <>
          <circle cx="20" cy="9" r="6" fill={color} />
          <path d="M7,18 Q10,8 20,9 Q30,8 33,18 Q27,13 20,14 Q13,13 7,18Z" fill={color} />
        </>
      );
    case 3:
      return <path d="M7,19 Q10,7 20,7 Q30,7 33,19 Q27,12 20,13 Q13,12 7,19Z" fill={color} />;
    case 4:
      return (
        <>
          <circle cx="11" cy="13" r="4" fill={color} />
          <circle cx="20" cy="10" r="4.5" fill={color} />
          <circle cx="29" cy="13" r="4" fill={color} />
        </>
      );
    case 6:
      // Bald: just a little shine.
      return <ellipse cx="15" cy="12" rx="4" ry="2" fill="#fff" opacity=".35" />;
    default:
      return <path d="M7,18 L9,8 L13,13 L16,4 L20,11 L24,3 L27,12 L31,7 L33,18 Q27,12 20,12 Q13,12 7,18Z" fill={color} />;
  }
}

// Facial hair goes under the mouth line; everything else on top of the face.
function FacialHair({ accessory, color }: { accessory: AccessoryId | null | undefined; color: string }) {
  if (accessory === "beard") return <path d="M8,24 Q8,37 20,37 Q32,37 32,24 Q30,31 20,32 Q10,31 8,24Z" fill={color} />;
  if (accessory === "moustache") return <path d="M14,26 Q17,23 20,25 Q23,23 26,26 Q23,27.5 20,26.4 Q17,27.5 14,26Z" fill={color} />;
  return null;
}

function Accessory({ accessory }: { accessory: AccessoryId | null | undefined }) {
  switch (accessory) {
    case "glasses":
      return (
        <g fill="none" stroke={INK} strokeWidth="1.3">
          <circle cx="15" cy="21" r="3.8" />
          <circle cx="25" cy="21" r="3.8" />
          <path d="M18.8,21 L21.2,21" />
        </g>
      );
    case "sunglasses":
      return (
        <g fill={INK}>
          <rect x="10.5" y="18.5" width="8" height="5" rx="2" />
          <rect x="21.5" y="18.5" width="8" height="5" rx="2" />
          <path d="M18.5,20 L21.5,20" stroke={INK} strokeWidth="1.2" />
        </g>
      );
    case "beret":
      return (
        <g transform="rotate(-10 18 9)">
          <ellipse cx="18" cy="9" rx="13" ry="5" fill="#c63a21" />
          <rect x="17" y="2" width="2" height="3" rx="1" fill="#c63a21" />
        </g>
      );
    case "cap":
      return (
        <>
          <path d="M7,14 Q8,3 20,3 Q32,3 33,14Z" fill="#2f6db5" />
          <path d="M20,13 H37 Q38,14 37,16 H20Z" fill="#24579a" />
        </>
      );
    case "earrings":
      return (
        <>
          <circle cx="6.5" cy="27" r="1.8" fill="#e0a020" />
          <circle cx="33.5" cy="27" r="1.8" fill="#e0a020" />
        </>
      );
    case "flower":
      return (
        <g transform="translate(31 10)">
          {[0, 72, 144, 216, 288].map((angle) => (
            <circle key={angle} cx={3 * Math.cos((angle * Math.PI) / 180)} cy={3 * Math.sin((angle * Math.PI) / 180)} r="2.4" fill="#f08aa6" />
          ))}
          <circle r="1.8" fill="#ffd36b" />
        </g>
      );
    case "headband":
      return <path d="M6.5,15 Q20,7 33.5,15 L33,18 Q20,10.5 7,18Z" fill="#e26aa6" />;
    case "bow":
      return (
        <g transform="translate(29 9)">
          <path d="M0,0 L-6,-4 L-6,4Z M0,0 L6,-4 L6,4Z" fill="#e0453a" />
          <circle r="1.8" fill="#b52f26" />
        </g>
      );
    case "bandana":
      return (
        <>
          <path d="M6,17 Q8,6 20,6 Q32,6 34,17 Q20,12 6,17Z" fill="#2f6db5" />
          <circle cx="14" cy="11" r="1" fill="#fff" />
          <circle cx="22" cy="9" r="1" fill="#fff" />
          <circle cx="28" cy="12" r="1" fill="#fff" />
          <path d="M33,15 L38,13 L37,19Z" fill="#2f6db5" />
        </>
      );
    case "headphones":
      return (
        <g>
          <path d="M6,22 Q6,5 20,5 Q34,5 34,22" fill="none" stroke="#2b3439" strokeWidth="2.5" />
          <rect x="3.5" y="19" width="5" height="9" rx="2" fill="#2b3439" />
          <rect x="31.5" y="19" width="5" height="9" rx="2" fill="#2b3439" />
        </g>
      );
    case "freckles":
      return (
        <g fill="#a0623a" opacity=".7">
          {[[12, 24], [14, 26], [10, 26.5], [28, 24], [26, 26], [30, 26.5]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r=".8" />
          ))}
        </g>
      );
    case "hat":
      return (
        <>
          <ellipse cx="20" cy="11" rx="16" ry="3.5" fill="#5b3a22" />
          <path d="M11,11 Q11,2 20,2 Q29,2 29,11Z" fill="#6f4a2d" />
          <rect x="11" y="8" width="18" height="2.2" fill="#2b1d14" />
        </>
      );
    default:
      return null;
  }
}

export function CustomerFace({ customer, mood }: { customer: Looks; mood: Mood }) {
  const { hairStyle, hair, accessory } = customer;
  // Hats sit on the hair, so the hairstyle shows only around them.
  const wearsHat = accessory === "beret" || accessory === "cap" || accessory === "hat" || accessory === "bandana";
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <HairBack style={hairStyle} color={hair} />
      <circle cx="20" cy="22" r="14" fill={customer.skin} />
      {!(wearsHat && hairStyle === 4) && <HairFront style={hairStyle} color={hair} />}
      <circle cx="15" cy="21" r="1.6" fill={INK} />
      <circle cx="25" cy="21" r="1.6" fill={INK} />
      {mood >= 2 && (
        <>
          <path d="M12,17 L17,18.5" stroke={INK} strokeWidth="1.3" />
          <path d="M28,17 L23,18.5" stroke={INK} strokeWidth="1.3" />
        </>
      )}
      <FacialHair accessory={accessory} color={hair} />
      <path d={MOUTH_PATHS[mood]} stroke="#5a2d22" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {mood === 0 && accessory !== "beard" && (
        <>
          <circle cx="11" cy="26" r="2" fill="#ff8a8a" opacity=".4" />
          <circle cx="29" cy="26" r="2" fill="#ff8a8a" opacity=".4" />
        </>
      )}
      <Accessory accessory={accessory} />
    </svg>
  );
}
