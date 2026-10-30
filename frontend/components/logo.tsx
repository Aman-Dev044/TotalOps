import cn from 'clsx';

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn('shrink-0 drop-shadow-[0_6px_14px_rgba(91,91,247,.45)]', className)} aria-hidden>
      <defs>
        <linearGradient id="to-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b5bf7" />
          <stop offset=".6" stopColor="#c026d3" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#to-g)" />
      <path d="M14 22h36v7H35.5v19h-7V29H14z" fill="#fff" />
      <path d="M38 40l12-10v14z" fill="#fff" fillOpacity=".55" />
    </svg>
  );
}

export function Logo({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={34} />
      {!collapsed ? (
        <span className="font-display text-[19px] font-extrabold tracking-tight">
          Total<span className="gradient-text">Ops</span>
        </span>
      ) : null}
    </span>
  );
}
