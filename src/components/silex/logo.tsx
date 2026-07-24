export function SilexLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative grid h-7 w-7 place-items-center rounded-[9px] bg-primary text-primary-foreground shadow-float overflow-hidden">
        <span className="absolute inset-0 bg-gradient-to-br from-violet/60 via-transparent to-transparent" />
        <svg viewBox="0 0 24 24" className="relative h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8 L12 4 L20 8 L12 12 Z" />
          <path d="M4 16 L12 12 L20 16 L12 20 Z" />
        </svg>
      </span>
      <span className="text-[17px] font-semibold tracking-tight">SILEX</span>
    </span>
  );
}
