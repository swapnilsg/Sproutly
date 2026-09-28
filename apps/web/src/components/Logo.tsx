/** Single-sprout mark on a rounded brand-green square (from docs/sproutly_branded_screens.html). */
export function SproutMark({ size = 64 }: { size?: number }) {
  return (
    <span className="sprout-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.56} height={size * 0.69} viewBox="0 0 36 44">
        <line
          x1="18"
          y1="42"
          x2="18"
          y2="20"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path d="M18 20 Q18 6 30 4 Q30 18 18 20Z" fill="#fff" />
        <path d="M18 29 Q18 17 7 15 Q7 27 18 29Z" fill="rgba(255,255,255,0.65)" />
      </svg>
    </span>
  );
}
