// Indexed by mood: smile, flat, slight frown, frown.
const MOUTH_PATHS = ["M13,27 Q20,33 27,27", "M14,28.5 L26,28.5", "M14,30 Q20,27 26,30", "M13,31 Q20,25 27,31"];

function Hair({ style, color }) {
  if (style === 0) return <path d="M6,20 Q8,6 20,6 Q32,6 34,20 Q30,12 20,12 Q10,12 6,20Z" fill={color} />;
  if (style === 1) return <path d="M5,26 Q4,6 20,5 Q36,6 35,26 L32,26 Q32,13 20,12 Q8,13 8,26Z" fill={color} />;
  return (
    <>
      <circle cx="20" cy="9" r="6" fill={color} />
      <path d="M7,18 Q10,8 20,9 Q30,8 33,18 Q27,13 20,14 Q13,13 7,18Z" fill={color} />
    </>
  );
}

export function CustomerFace({ customer, mood }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="22" r="14" fill={customer.skin} />
      <Hair style={customer.hairStyle} color={customer.hair} />
      <circle cx="15" cy="21" r="1.6" fill="#1f1a17" />
      <circle cx="25" cy="21" r="1.6" fill="#1f1a17" />
      {mood >= 2 && (
        <>
          <path d="M12,17 L17,18.5" stroke="#1f1a17" strokeWidth="1.3" />
          <path d="M28,17 L23,18.5" stroke="#1f1a17" strokeWidth="1.3" />
        </>
      )}
      <path d={MOUTH_PATHS[mood]} stroke="#5a2d22" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {mood === 0 && (
        <>
          <circle cx="11" cy="26" r="2" fill="#ff8a8a" opacity=".4" />
          <circle cx="29" cy="26" r="2" fill="#ff8a8a" opacity=".4" />
        </>
      )}
    </svg>
  );
}
