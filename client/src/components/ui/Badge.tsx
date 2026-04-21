import { clsx } from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
        className
      )}
    >
      {children}
    </span>
  );
}
