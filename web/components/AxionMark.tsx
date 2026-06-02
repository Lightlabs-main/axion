export function AxionMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="axion-g" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#5eead4" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <path
        d="M16 2 L29 9 V23 L16 30 L3 23 V9 Z"
        stroke="url(#axion-g)"
        strokeWidth="1.5"
        fill="rgba(45,212,191,0.06)"
      />
      <path d="M16 8 L22 22 H10 Z" stroke="url(#axion-g)" strokeWidth="1.6" fill="none" />
      <circle cx="16" cy="18.5" r="2.1" fill="#5eead4" />
    </svg>
  );
}
