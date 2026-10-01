import type { ReactNode } from 'react';

/** Stroke icons from the onboarding v2 design. Decorative: colour comes from `currentColor`. */
function Icon({
  size = 24,
  strokeWidth = 1.8,
  children,
}: {
  size?: number;
  strokeWidth?: number;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function BackIcon() {
  return (
    <Icon size={22} strokeWidth={2}>
      <path d="M15 5l-7 7 7 7" />
    </Icon>
  );
}

export function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <Icon size={size} strokeWidth={3}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function BalconyIcon() {
  return (
    <Icon size={26}>
      <path d="M3 10.5h18M4 10.5V20M20 10.5V20M3 20h18M8 10.5V20M12 10.5V20M16 10.5V20" />
      <path d="M9 10.5V8a3 3 0 0 1 6 0v2.5" />
      <path d="M12 5V3" />
    </Icon>
  );
}

export function IndoorsIcon() {
  return (
    <Icon size={26}>
      <path d="M3.5 11L12 4l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <rect x="9" y="12" width="6" height="5" rx="0.5" />
      <path d="M12 12v5M9 14.5h6" />
    </Icon>
  );
}

export function SproutIcon() {
  return (
    <Icon size={26}>
      <path d="M12 21v-8" />
      <path d="M12 13c0-4 2.5-6.5 7-6.5 0 4.5-2.5 6.5-7 6.5z" />
      <path d="M12 15.5c0-3-2-5-5.5-5 0 3.5 2 5 5.5 5z" />
    </Icon>
  );
}

export function SunIcon() {
  return (
    <Icon size={26}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </Icon>
  );
}

export function SunCloudIcon() {
  return (
    <Icon size={26}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M9 2.5v1.5M3 8.5h1.5M4.8 4.3l1 1M13.2 4.3l-1 1" />
      <path d="M8 19.5h9.5a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.3 1.4A2.8 2.8 0 0 0 8 19.5z" />
    </Icon>
  );
}

export function CloudIcon() {
  return (
    <Icon size={26}>
      <path d="M7 18.5h10.5a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.6A3.2 3.2 0 0 0 7 18.5z" />
    </Icon>
  );
}

export function QuestionIcon() {
  return (
    <Icon size={26}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.7" />
      <path d="M12 17.2h.01" />
    </Icon>
  );
}
