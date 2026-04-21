interface FunnelIconProps {
  size?: number;
  className?: string;
}

export function FunnelIcon({ size = 24, className }: FunnelIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 4h18l-6.5 7.5V18l-5 3V11.5L3 4z" />
    </svg>
  );
}
