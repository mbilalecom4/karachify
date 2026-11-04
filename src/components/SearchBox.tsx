import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Map as MapIcon, MapPin, Search, Sparkles, Tag, TrendingUp, X } from 'lucide-react';
import { groupByType, search, TYPE_LABEL, type ResultType, type SearchDoc } from '../lib/search';
import { actions, prefsFor, selectListings, useDB } from '../lib/store';
import { isOpenListing } from '../lib/openRecords';
import { tierLabel, useOpenNames } from '../lib/openNames';
import { imageFor, pictureSubject } from '../lib/media';
import { ImageWithFallback } from './ui';

const ICONS = {
  listing: MapPin,
  event: Sparkles,
  area: TrendingUp,
  category: Tag,
  guide: Clock,
  open: MapIcon,
} as const;

/** Underlines the part of a suggestion the user actually typed. */
function Match({ text, term }: { text: string; term: string }) {
  const needle = term.trim().toLowerCase();
  const at = needle.length >= 2 ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-teal-100 px-0.5 text-navy-900">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

export function SearchBox({
  variant = 'hero',
  placeholder = 'Search places, restaurants, events, hotels and more...',
  autoFocus = false,
  compactOnFocus = false,
}: {
  variant?: 'hero' | 'header' | 'page';
  placeholder?: string;
  autoFocus?: boolean;
  compactOnFocus?: boolean;
}) {
  const db = useDB();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  // Enter should only jump to a suggestion the person actually aimed at; otherwise
  // it opens the full results page for the words on the screen.
  const [aimed, setAimed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => (q.trim().length >= 2 ? search(db, q, { limit: 12 }) : []), [db, q]);
  const recent = prefsFor(db).recentSearches;

  /* The unchecked tier is searched by name only, and a record that already has a
     checked page is left out, so one place never shows up twice with two
     different claims about it. */
  const curatedKeys = useMemo(
    () => selectListings(db).filter((l) => !isOpenListing(l)).map((l) => ({ slug: l.slug, name: l.name, categoryId: l.categoryId })),
    [db]
  );
  const wider = useOpenNames(q, curatedKeys, 4);

  // Everyone reads suggestions in buckets — places, then areas, then the rest — the
  // same order the results page uses for its tabs. Cursor walks this flattened order.
  const groups = useMemo(() => {
    const order: ResultType[] = ['listing', 'area', 'category', 'event', 'guide', 'open'];
    const byType = groupByType([...results, ...wider.docs]);
    const buckets = order
      .map((t) => ({ type: t, items: byType.get(t) ?? [] }))
      .filter((b) => b.items.length > 0);
    let start = 0;
    return buckets.map((b) => ({ ...b, start: (start += b.items.length) - b.items.length }));
  }, [results, wider.docs]);
  const suggestions = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    setCursor(0);
    setAimed(false);
  }, [q]);

  const go = (doc: SearchDoc) => {
    actions.pushRecentSearch(doc.title);
    setOpen(false);
    setQ('');
    navigate(doc.path);
  };

  const submit = () => {
    const term = q.trim();
    if (!term) return;
    actions.pushRecentSearch(term);
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  const isHero = variant === 'hero';

  return (
    <div ref={boxRef} className="relative w-full">
      <div
        onClick={() => inputRef.current?.focus()}
        className={`flex min-h-[44px] items-center gap-2 rounded-full bg-white shadow-lift transition-shadow ${
          isHero ? 'border-2 border-white/70 p-1.5 sm:p-2' : 'border border-navy-200 p-1'
        } ${open && compactOnFocus ? 'ring-4 ring-teal-500/15' : ''}`}
      >
        <Search className={`ml-3 shrink-0 text-navy-400 ${isHero ? 'h-5 w-5' : 'h-4 w-4'}`} aria-hidden />
        <input
          ref={inputRef}
          value={q}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open}
          aria-controls="search-suggestions"
          aria-label="Search Karachify"
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (aimed && suggestions[cursor]) go(suggestions[cursor]);
              else submit();
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAimed(true);
              setOpen(true);
              setCursor((c) => Math.min(c + 1, Math.max(suggestions.length - 1, 0)));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          className={`min-w-0 flex-1 bg-transparent font-medium text-navy-800 placeholder:text-navy-400 focus:outline-none ${
            isHero ? 'py-2.5 text-[15px] sm:text-base' : 'py-1.5 text-sm'
          }`}
        />
        {q && (
          <button
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full text-navy-400 hover:bg-navy-50 hover:text-navy-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button onClick={submit} className={isHero ? 'btn-primary' : 'btn-dark btn-sm min-h-[44px]'} aria-label="Search">
          {isHero ? 'Search' : 'Go'}
        </button>
      </div>

      {open && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-navy-100 bg-white p-2 shadow-lift animate-fade-up"
        >
          {q.trim().length === 1 && (
            <p className="px-3 py-4 text-sm text-navy-500">Keep typing — two characters is enough to start.</p>
          )}

          {q.trim().length < 2 && recent.length > 0 && (
            <div className="px-1 pb-1">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-400">Recent searches</span>
                <button className="text-[12px] font-semibold text-teal-700 hover:underline" onClick={() => actions.clearRecents()}>
                  Clear
                </button>
              </div>
              {recent.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setQ(r);
                    inputRef.current?.focus();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-navy-700 hover:bg-mist"
                >
                  <Clock className="h-4 w-4 text-navy-400" />
                  {r}
                </button>
              ))}
            </div>
          )}

          {q.trim().length < 2 && recent.length === 0 && (
            <div className="px-3 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400">Try</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {['Mazar-e-Quaid', 'Biryani', 'Clifton', 'Hotels', 'Expo Centre', 'Beaches'].map((t) => (
                  <button key={t} className="chip" onClick={() => setQ(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {q.trim().length >= 2 && suggestions.length === 0 && !wider.loading && (
            <div className="px-3 py-6 text-center">
              <p className="text-sm font-semibold text-navy-800">No matches for “{q}”</p>
              <p className="mt-1 text-[13px] text-navy-500">
                {wider.failed
                  ? 'The checked pages have no hit, and the unchecked OpenStreetMap records could not be read just now — nothing below is a guess at what they hold.'
                  : 'Try the area name, the dish, or a broader word like “beach”, “cafe” or “hospital”.'}
              </p>
              <button className="btn-outline btn-sm mt-3" onClick={submit}>
                Open full search page
              </button>
            </div>
          )}

          {wider.loading && (
            <p className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-navy-500">
              <MapIcon className="h-3.5 w-3.5 text-teal-700" aria-hidden />
              Searching the {tierLabel()}…
            </p>
          )}

          {groups.map((g) => {
            const GroupIcon = ICONS[g.type];
            return (
            <div key={g.type} role="group" aria-label={TYPE_LABEL[g.type]} className="pb-1">
              <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-navy-400">
                <GroupIcon className="h-3.5 w-3.5 text-teal-700" aria-hidden />
                {TYPE_LABEL[g.type]} · {g.items.length}
              </p>
              {g.items.map((doc, j) => {
                const i = g.start + j;
                const media = imageFor(doc.mediaKey, doc.title);
                const on = i === cursor;
                return (
                  <button
                    key={`${doc.type}-${doc.id}`}
                    role="option"
                    aria-selected={on}
                    onMouseEnter={() => {
                      setCursor(i);
                      setAimed(true);
                    }}
                    onClick={() => go(doc)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${on ? 'bg-mist' : 'hover:bg-mist'}`}
                  >
                    <ImageWithFallback
                      src={media.thumb}
                      alt=""
                      label={doc.title}
                      title={media.entry?.kind === 'related' ? `Illustrative photo — shows ${pictureSubject(media.entry)}` : undefined}
                      wrapperClass="hidden h-11 w-11 shrink-0 rounded-lg sm:block"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy-800">
                        <Match text={doc.title} term={q} />
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-navy-500">{doc.subtitle}</span>
                    </span>
                    <ArrowRight className={`h-4 w-4 shrink-0 transition-opacity ${on ? 'text-teal-700 opacity-100' : 'opacity-0'}`} aria-hidden />
                  </button>
                );
              })}
            </div>
            );
          })}

          {suggestions.length > 0 && (
            <button
              onClick={submit}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-50 px-3 py-2.5 text-sm font-bold text-navy-700 hover:bg-navy-100"
            >
              <Search className="h-4 w-4" />
              See all results for “{q}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
