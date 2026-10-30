import type { ReactNode } from 'react';
import { imageFor } from '../lib/media';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { Breadcrumbs } from './ui';

/** Standard interior-page header: Karachi banner photo, navy scrim, title block. */
export function PageHero({
  mediaKey,
  label,
  eyebrow,
  title,
  sub,
  trail,
  children,
  height = 'min-h-[300px] sm:min-h-[360px]',
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
  useDocumentTitle(title);
  const media = imageFor(mediaKey, label);
  return (
    <section className={`relative isolate flex items-end overflow-hidden ${height}`}>
      <div className="absolute inset-0 -z-10">
        <img
          src={media.wide}
          alt={label}
          className="h-full w-full object-cover"
          onError={(e) => {
            if (e.currentTarget.src !== media.fallback) e.currentTarget.src = media.fallback;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/92 via-navy-950/70 to-navy-950/45" />
      </div>
      <div className="shell pb-9 pt-20">
        {trail && (
          <div className="[&_a]:text-teal-200 [&_span]:text-navy-200">
            <Breadcrumbs trail={trail} />
          </div>
        )}
        {eyebrow && <p className="eyebrow mb-2 text-teal-300">{eyebrow}</p>}
        <h1 className="max-w-3xl font-display text-3xl font-extrabold leading-tight text-white sm:text-[42px]">{title}</h1>
        {sub && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-navy-100">{sub}</p>}
        {children && <div className="mt-6">{children}</div>}
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
