export function BrandLogo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-navy-800 shadow-card">
        <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
          <path d="M8 22V10h3v5l5-5h3.6l-5.2 5.4L22.6 22H18.6l-4.4-4.8L11 19.6V22z" fill="#CBFF54" />
          <path d="M4 25.5h24" stroke="#CFE9E6" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className={`block font-display text-[19px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-navy-800'}`}>
            Karachify
          </span>
          <span className={`mt-0.5 block text-[10.5px] font-semibold uppercase tracking-[0.16em] ${light ? 'text-lime-300' : 'text-teal-700'}`}>
            Karachi
          </span>
        </span>
      )}
    </span>
  );
}
