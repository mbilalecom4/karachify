import type { ReactNode } from 'react';
import { failToPlaceholder, imageFor } from '../lib/media';
import { Breadcrumbs, IllustrativeStamp } from './ui';

/** Standard interior-page header: Karachi photograph, opaque scrim, title block. */
export function PageHero({
  mediaKey,
  label,
  eyebrow,
  title,
  sub,
  trail,
  children,
  height = 'min-h-[320px] sm:min-h-[380px]',
}: {
  mediaKey: string;
  label: string;
  eyebrow?: string;
  title: string;
  sub?: string;
  trail?: { label: string; to?: string }[];
  children?: ReactNode;
  height?: string;
}) {
  /* The tab title is not set here. MetaManager owns the document head for every
     page this hero appears on, and a second writer would win only by racing. */
  const media = imageFor(mediaKey, label);
  return (
    <section className={`relative isolate flex items-end overflow-hidden ${height}`}>
      <div className="absolute inset-0 -z-10">
        <img
          {...media.wideImg('hero')}
          alt={label}
          decoding="async"
          className="h-full w-full object-cover"
          onError={(e) => failToPlaceholder(e.currentTarget, media.fallback)}
        />
        {/* Flat scrim: the whole frame is darkened, not just the bottom, so the
            breadcrumbs and eyebrow at the top are never set on open sky. */}
        <div className="media-scrim-flat absolute inset-0" />
      </div>
      <span className="absolute bottom-4 right-4 z-10">
        <IllustrativeStamp entry={media.entry} />
      </span>
      <div className="shell pb-10 pt-24">
        {/* Solid panel, not a gradient: a banner photo can be a white marble
            facade under an open sky, and no alpha ramp makes 13px white text
            safe on that. The panel is opaque, so contrast does not depend on
            what the photograph happens to contain. */}
        <div className="max-w-3xl rounded-[28px] bg-navy-900 p-6 shadow-lift sm:p-8">
          {trail && (
            <div className="[&_a]:text-teal-200 [&_a:hover]:text-white [&_span]:text-navy-200">
              <Breadcrumbs trail={trail} />
            </div>
          )}
          {eyebrow && <p className="eyebrow mb-2 text-teal-300 before:bg-teal-400">{eyebrow}</p>}
          <h1 className="font-display text-[clamp(1.9rem,4.6vw,2.9rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-white">
            {title}
          </h1>
          {sub && <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-navy-100">{sub}</p>}
          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </section>
  );
}

export function Prose({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`max-w-3xl space-y-4 text-[15px] leading-relaxed text-navy-600 [&_a]:font-medium [&_a]:text-teal-700 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-teal-800 [&_code]:rounded [&_code]:bg-navy-50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-navy-700 [&_h2]:mt-9 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-navy-800 [&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-navy-800 [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_strong]:text-navy-800 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function Note({ tone = 'info', children, className = '' }: { tone?: 'info' | 'warn'; children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-4 text-sm leading-relaxed ${
        tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-navy-200 bg-navy-50 text-navy-700'
      } ${className}`}
    >
      {children}
    </div>
  );
}
