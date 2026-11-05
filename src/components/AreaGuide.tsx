import type { Area, Category, Listing } from '../types';
import { Printer, X } from 'lucide-react';
import { citationsFor } from '../lib/provenance';
import { hoursQuote } from '../lib/hoursRead';
import { coordText, formatDate } from '../lib/format';
import { shareUrl } from '../lib/pageMeta';

/**
 * The one-page sheet for a locality.
 *
 * Paper is where the no-fabrication rule bites hardest: a printed line leaves no
 * page to click back to, so only records that name a source are written on it,
 * hours appear only when the source itself states them, and the records left off
 * are counted on the sheet rather than silently dropped. A locality with nothing
 * sourced prints that fact instead of padding itself out.
 */
type Props = {
  area: Area;
  items: Listing[];
  categories: Category[];
  /** On screen as well as on paper, once the visitor has asked to see it. */
  preview: boolean;
  onPreview: (on: boolean) => void;
  onPrint: () => void;
};

const hostOf = (url?: string) => {
  try {
    return new URL(url as string).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * Many records carry an address that opens with the place's own name, because
 * that is how the source wrote it. On paper the repeat reads like two entries,
 * so the name is trimmed off the front — the full address stays on the page.
 */
function addressLine(l: Listing) {
  const address = l.address?.trim() ?? '';
  if (!address) return '';
  const head = address.toLowerCase();
  const name = l.name.toLowerCase();
  /* Only a real separator counts as a repeat: "Mazar-e-Quaid-e-Azam" is one
     longer name, not the name and then the street. */
  const separator = address.slice(l.name.length, l.name.length + 2);
  if (head.startsWith(name) && /^[,·–]\s/.test(separator)) {
    const rest = address.slice(l.name.length).replace(/^[\s,·–]+/, '');
    if (rest.length > 3) return rest;
  }
  return address;
}

export function AreaGuide({ area, items, categories, preview, onPreview, onPrint }: Props) {
  const sourced = items.filter((l) => l.sourceUrl);
  const grouped = categories
    .map((c) => ({ category: c, rows: sourced.filter((l) => l.categoryId === c.id) }))
    .filter((g) => g.rows.length > 0)
    .sort((a, b) => b.rows.length - a.rows.length);
  const dropped = items.length - sourced.length;
  const osmPositions = sourced.filter((l) => l.coordsVerified).length;
  const printedOn = formatDate(new Date().toISOString().slice(0, 10));

  return (
    <section className={preview ? 'area-guide shell section' : 'area-guide print-only'}>
      <div className={preview ? 'card p-6' : ''}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-navy-200 pb-2">
          <h2 className="font-display text-[20px] font-extrabold text-navy-900">
            Karachify area guide · {area.name}
          </h2>
          <span className="text-[11px] uppercase tracking-wide text-navy-500">{area.zone} zone · printed {printedOn}</span>
        </div>

        <p className="mt-2 text-[12px] leading-relaxed text-navy-600">
          Locality centre {coordText(area.lat, area.lng)}.{' '}
          {sourced.length > 0 ? (
            <>
              {sourced.length} of the {items.length} records Karachify holds for {area.name} name a source it was read from, and
              those are the ones written below.
            </>
          ) : (
            <>
              Karachify holds {items.length} {items.length === 1 ? 'record' : 'records'} for {area.name} and none of them names a
              source, so there is nothing to print here but the address of the page.
            </>
          )}
        </p>

        {grouped.map(({ category, rows }) => (
          <div key={category.id} className="mt-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-teal-700">
              {category.name} · {rows.length}
            </h3>
            <ul className="mt-1 space-y-1">
              {rows.map((l) => {
                const hours = citationsFor(l.slug, 'hours').length ? hoursQuote(l.hours) : '';
                const address = addressLine(l);
                return (
                  <li key={l.id} className="text-[12px] leading-snug text-navy-800">
                    <b className="font-semibold">{l.name}</b>
                    {address ? ` — ${address}` : ''}
                    {l.phone ? ` · ${l.phone}` : ''}
                    {hours ? ` · ${hours}` : ''}
                    <span className="text-navy-500"> · {hostOf(l.sourceUrl)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mt-3 border-t border-navy-200 pt-2 text-[11px] leading-relaxed text-navy-600">
          <p>
            Nobody at Karachify has been to these places. Each line is what the named source states, and the hours are printed
            only where a source states them — a blank here means nobody could find the figure, not that the door is shut.
          </p>
          <p className="mt-1">
            {osmPositions} of the {sourced.length} records above sit on their own OpenStreetMap feature; the rest are placed near
            the locality centre and are not addresses.
            {dropped > 0 ? ` ${dropped} further ${dropped === 1 ? 'record is' : 'records are'} held for this locality without a source and are left off this sheet.` : ''}
            {' '}No rating, review count or price appears here, because none was sourced.
          </p>
          <p className="mt-1">
            The live page, with photographs and the wider map record: {shareUrl(`/area/${area.slug}`)} · sources and how they
            were checked: {shareUrl('/sources')}
          </p>
        </div>

        {preview && (
          <div className="no-print mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary btn-sm inline-flex items-center gap-1.5" onClick={onPrint}>
              <Printer className="h-3.5 w-3.5" /> Print or save as PDF
            </button>
            <button type="button" className="btn-outline btn-sm inline-flex items-center gap-1.5" onClick={() => onPreview(false)}>
              <X className="h-3.5 w-3.5" /> Back to the area page
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
