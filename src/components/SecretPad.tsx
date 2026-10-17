import type { SecretPad as Pad } from "../hooks/useSecretCode";

// Two gamepad buttons, shown on touch screens once the right swipes are in (see hooks/useSecretCode.ts).
export function SecretPad({ pad }: { pad: Pad }) {
  if (!pad.isOpen) return null;
  return (
    <div className="secret-pad">
      <button className="pad-btn pad-b" aria-label="B" onClick={() => pad.press("b")}>B</button>
      <button className="pad-btn pad-a" aria-label="A" onClick={() => pad.press("a")}>A</button>
    </div>
  );
}
