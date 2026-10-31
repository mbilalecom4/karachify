import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Link2, Search, ShieldCheck } from 'lucide-react';
import { Field, LoadMore, Select, StatusBadge, TextInput } from '../components/ui';
import { Note, PageHero, Prose } from '../components/Page';
import { selectAreas, selectListings, useDB } from '../lib/store';
import provenanceData from '../data/provenance.json';

interface SourceCitation {
  url: string;
  supports: string[];
  note: string;
  batch: string;
}

interface EvidenceNote {
  kind: 'evidence' | 'absence';
  text: string;
  batch: string;
}

interface RecordProvenance {
  researchName: string;
  status: 'demo' | 'verified' | 'needs-review';
  lastVerified: string | null;
  confidence: string | null;
  batches: string[];
  published: string[];
  sources: SourceCitation[];
  notFound: string[];
  notes: EvidenceNote[];
}

const provenance = provenanceData as unknown as {
  generatedFrom: string[];
  records: Record<string, RecordProvenance>;
  exclusions: { slug: string; field: string; reason: string }[];
};

/** Research field names, as the batches spell them, in the words a reader uses. */
const FIELD_LABELS: Record<string, string> = {
  lat: 'latitude',
  lng: 'longitude',
  coordinates: 'coordinates',
  osmId: 'OpenStreetMap element id',
  osmName: 'name as mapped',
  name: 'name',
  address: 'address',
  website: 'website',
  hours: 'opening hours',
  ticketPrices: 'admission prices',
  entryFees: 'admission prices',
  entryConditions: 'visitor rules',
  contact: 'contact details',
  phone: 'telephone',
  email: 'e-mail',
  description: 'description',
  photo: 'photograph',
  facilities: 'facilities',
  accessibility: 'accessibility',
  familySuitability: 'family suitability',
  sourceUrl: 'source link',
  lastVerified: 'date checked',
};

const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f;

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

/**
 * Who is speaking, judged from the address alone — never from how good the
 * source would like to look. Anything not recognisable stays "other".
 */
function mediumOf(url: string, operatorHost?: string) {
  const h = hostOf(url).toLowerCase();
  if (h.includes('openstreetmap') || h.includes('overpass')) return 'OpenStreetMap';
  if (h.includes('wikimedia') || h.includes('wikipedia')) return 'Wikimedia project';
  if (h.endsWith('.gov.pk') || h.endsWith('.gos.pk') || h.endsWith('.gov')) return 'Government page';
  if (h.endsWith('unesco.org')) return 'Official heritage body';
  if (/(facebook|instagram|linkedin|\.x\.com|^x\.com|youtube)/.test(h)) return 'Social media page';
  if (operatorHost && (h === operatorHost || h.endsWith(`.${operatorHost}`))) return "Operator's own page";
  return 'Other published source';
}

/** A source that could not be opened here is not the same evidence as one that was. */
function fetchCaveat(note: string) {
  if (/search snippet|not fetchable|could not be (read|fetched)|unreachable|only search/i.test(note)) {
    return 'The page itself could not be opened from here — this fact was read from a search result or a secondary copy.';
  }
  return null;
}

const PAGE_SIZE = 8;

export default function Sources() {
  const db = useDB();
  const listings = selectListings(db);
  const areas = selectAreas(db);
  const [q, setQ] = useState('');
  const [state, setState] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const rows = useMemo(() => {
    const built = listings
      .map((l) => ({ listing: l, prov: provenance.records[l.slug] ?? null }))
      .filter((r) => r.prov || r.listing.sourceUrl);
    const rank = { verified: 0, 'needs-review': 1, demo: 2 } as const;
    return built.sort((a, b) => {
      const byStatus = (rank[a.listing.status] ?? 3) - (rank[b.listing.status] ?? 3);
      return byStatus || a.listing.name.localeCompare(b.listing.name);
    });
  }, [listings]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (state === 'verified' && r.listing.status !== 'verified') return false;
      if (state === 'sourced' && !r.prov) return false;
      if (state === 'plain' && r.prov) return false;
      if (!needle) return true;
      const urls = (r.prov?.sources ?? []).map((s) => `${s.url} ${s.note}`).join(' ');
      return `${r.listing.name} ${r.listing.slug} ${urls} ${r.listing.sourceUrl ?? ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, state]);

  const publishers = useMemo(() => {
    const tally = new Map<string, { host: string; url: string; count: number; kind: string; records: string[] }>();
    for (const r of rows) {
      const operatorHost = r.listing.website ? hostOf(r.listing.website).toLowerCase() : undefined;
      const cited = r.prov?.sources.map((s) => s.url) ?? [r.listing.sourceUrl].filter(Boolean) as string[];
      for (const url of cited) {
        const host = hostOf(url);
        const prev = tally.get(host);
        if (prev) {
          prev.count += 1;
          if (!prev.records.includes(r.listing.name)) prev.records.push(r.listing.name);
        } else {
          tally.set(host, { host, url, count: 1, kind: mediumOf(url, operatorHost), records: [r.listing.name] });
        }
      }
    }
    return [...tally.values()].sort((a, b) => b.count - a.count || a.host.localeCompare(b.host));
  }, [rows]);

  const sourcedRecords = rows.filter((r) => r.prov).length;
  const osmPins = listings.filter((l) => l.coordsVerified).length;
  const fullyChecked = listings.filter((l) => l.status === 'verified').length;
  const citationUrls = rows.reduce((n, r) => n + (r.prov?.sources.length ?? 1), 0);
  const noSource = listings.length - rows.length;
  const notFoundTotal = rows.reduce((n, r) => n + (r.prov?.notFound.length ?? 0), 0);
  const absenceNotes = rows.reduce((n, r) => n + (r.prov?.notes.filter((x) => x.kind === 'absence').length ?? 0), 0);
  const exclusions = provenance.exclusions.map((e) => ({
    ...e,
    name: listings.find((l) => l.slug === e.slug)?.name ?? e.slug,
  }));

  return (
    <>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi"
        eyebrow="Verification"
        title="Every source, and what it was allowed to say"
        sub="The address of every page, site and map element a fact in this build was read from — with the date it was checked, the fields each source backs, and the places where no source was found at all."
        trail={[{ label: 'Home', to: '/' }, { label: 'Sources' }]}
        height="min-h-[240px] sm:min-h-[300px]"
      />

      <div className="shell section">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Records with a named source', value: String(rows.length) },
            { label: 'Fully source-checked', value: String(fullyChecked) },
            { label: 'OpenStreetMap-backed pins', value: String(osmPins) },
            { label: 'Records carrying no source yet', value: String(noSource) },
          ].map((s) => (
            <div key={s.label} className="card p-5">
              <p className="font-display text-3xl font-extrabold text-navy-800">{s.value}</p>
              <p className="text-sm text-navy-500">{s.label}</p>
            </div>
          ))}
        </div>

        <Note className="mt-6">
          {citationUrls.toLocaleString('en-PK')} citations sit behind {rows.length} records.{' '}
          {sourcedRecords} of them were researched field by field against named pages; the rest carry a single source
          link recorded in the catalogue data. A source link is not a guarantee: it says where a value was read from and
          when, so you can open it and disagree with us. {notFoundTotal} field positions across the researched records
          are listed below as “no source found” rather than filled with a plausible guess, and{' '}
          {exclusions.length} values were read from a source and then deliberately not published. Report an error through
          the <Link to="/contact" className="link">contact form</Link>; the corrections that arrive there are held on the
          device that typed them until a human opens the repository and edits the research file.
        </Note>

        <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_220px]">
          <Field label="Find a source">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
              <TextInput
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setLimit(PAGE_SIZE);
                }}
                placeholder="Place, publisher or web address"
                className="pl-10"
              />
            </div>
          </Field>
          <Field label="Verification state">
            <Select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setLimit(PAGE_SIZE);
              }}
            >
              <option value="all">All records with a source</option>
              <option value="verified">Fully source-checked only</option>
              <option value="sourced">Field-by-field research only</option>
              <option value="plain">Single source link only</option>
            </Select>
          </Field>
        </div>

        <div className="mt-6 space-y-4">
          {shown.slice(0, limit).map(({ listing, prov }) => {
            const operatorHost = listing.website ? hostOf(listing.website).toLowerCase() : undefined;
            const area = areas.find((a) => a.id === listing.areaId)?.name;
            const citations: SourceCitation[] = prov?.sources.length
              ? prov.sources
              : listing.sourceUrl
                ? [{ url: listing.sourceUrl, supports: [], note: 'Recorded in the catalogue data as the source for this page.', batch: 'catalogue' }]
                : [];
            return (
              <article key={listing.slug} className="card p-5">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-navy-800">
                      <Link to={`/place/${listing.slug}`} className="hover:text-teal-700">
                        {listing.name}
                      </Link>
                    </h2>
                    <p className="mt-0.5 text-[13px] text-navy-500">
                      {area} · <span className="font-mono text-[12px]">{listing.slug}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={listing.status} />
                    {listing.lastVerified && (
                      <span className="text-[12px] font-semibold text-navy-500">checked {listing.lastVerified}</span>
                    )}
                  </div>
                </header>

                {prov?.published && (
                  <p className="mt-3 flex flex-wrap gap-1.5 text-[12px] text-navy-600">
                    <span className="font-semibold text-navy-500">Published from these sources:</span>
                    {prov.published.map((f) => (
                      <span key={f} className="rounded-md bg-mist px-2 py-0.5">
                        {fieldLabel(f)}
                      </span>
                    ))}
                  </p>
                )}

                <ul className="mt-3 space-y-2.5">
                  {citations.map((c, i) => {
                    const caveat = fetchCaveat(c.note);
                    return (
                      <li key={`${c.url}-${i}`} className="rounded-lg border border-navy-100 bg-white p-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="badge-verified whitespace-nowrap">{mediumOf(c.url, operatorHost)}</span>
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link inline-flex min-w-0 items-center gap-1 text-[13px]"
                          >
                            <Link2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate" title={c.url}>
                              {c.url.replace(/^https?:\/\//, '').slice(0, 96)}
                            </span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </div>
                        {c.supports.length > 0 && (
                          <p className="mt-1.5 text-[12.5px] text-navy-600">
                            Backs: {c.supports.map(fieldLabel).join(', ')}
                          </p>
                        )}
                        {c.note && <p className="mt-1 text-[12.5px] leading-relaxed text-navy-500">{c.note}</p>}
                        {caveat && <p className="mt-1.5 text-[12.5px] font-semibold text-amber-800">{caveat}</p>}
                      </li>
                    );
                  })}
                </ul>

                {citations.length === 0 && (
                  <p className="mt-3 text-[13px] leading-relaxed text-navy-500">
                    This record was researched without a citable web address, so no value from it is published — the pin,
                    address and status here are all the catalogue has.
                  </p>
                )}

                {prov && prov.notFound.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
                    <span className="font-semibold text-navy-500">No source found for:</span>
                    {prov.notFound.map((f) => (
                      <span key={f} className="rounded-md bg-mist px-2 py-0.5 text-navy-500">
                        {fieldLabel(f)}
                      </span>
                    ))}
                    <span className="text-navy-400">— these are left blank on the page, not estimated.</span>
                  </p>
                )}

                {prov?.notes.length ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[13px] font-semibold text-navy-600">
                      {prov.notes.length} researcher’s note{prov.notes.length > 1 ? 's' : ''} on this evidence
                    </summary>
                    <ul className="mt-2 space-y-2.5">
                      {prov.notes.map((n, i) => (
                        <li key={`${n.batch}-${i}`} className="border-l-2 border-navy-100 pl-3">
                          <p className="text-[11.5px] font-bold uppercase tracking-wide text-navy-400">
                            {n.kind === 'absence' ? 'Confirmed absence' : 'On the evidence'} · {n.batch}
                          </p>
                          <p className="mt-1 text-[13px] leading-relaxed text-navy-600">{n.text}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 font-mono text-[11.5px] text-navy-400">
                      {prov.batches.join(' + ')} · date shown for every field: {prov.lastVerified} · confidence{' '}
                      {prov.confidence}
                    </p>
                  </details>
                ) : (
                  <p className="mt-3 font-mono text-[11.5px] text-navy-400">
                    {prov?.batches.join(' + ')} · checked {prov?.lastVerified} · confidence {prov?.confidence}
                  </p>
                )}
              </article>
            );
          })}

          {shown.length === 0 && (
            <div className="card p-8 text-center">
              <p className="font-display text-lg font-bold text-navy-800">No source matches that</p>
              <p className="mt-2 text-sm text-navy-500">
                Nothing under “{q}” or that state. Records whose data carries no source link are not listed here at all —
                that absence is stated in the count above and on each of those pages.
              </p>
            </div>
          )}
        </div>

        <LoadMore shown={Math.min(limit, shown.length)} total={shown.length} onClick={() => setLimit((n) => n + PAGE_SIZE)} />

        <h2 className="mt-14 font-display text-2xl font-bold text-navy-800">Who the facts came from</h2>
        <p className="section-sub mt-1">
          Counted by address, not by reputation. {publishers.length} publishers supply the {citationUrls} citations above.
        </p>
        <div className="mt-4 card overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-navy-100 bg-mist text-[13px] uppercase tracking-wide text-navy-500">
              <tr>
                <th className="px-4 py-3">Publisher</th>
                <th className="px-4 py-3">What it is</th>
                <th className="px-4 py-3">Citations</th>
                <th className="px-4 py-3">Records</th>
                <th className="px-4 py-3 text-right">Example</th>
              </tr>
            </thead>
            <tbody>
              {publishers.map((p) => (
                <tr key={p.host} className="border-b border-navy-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-navy-800">{p.host}</td>
                  <td className="px-4 py-2.5 text-navy-600">{p.kind}</td>
                  <td className="px-4 py-2.5 text-navy-600">{p.count}</td>
                  <td className="max-w-[280px] px-4 py-2.5 text-navy-500">{p.records.slice(0, 3).join(', ')}{p.records.length > 3 ? ` +${p.records.length - 3} more` : ''}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-[13px]">
                      open <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-navy-500">
          Map data is © OpenStreetMap contributors and offered under the OpenStreetMap License (ODbL for the data);
          photographs are © their authors and reused under the Creative Commons licences recorded on the{' '}
          <Link to="/image-credits" className="link">image credits page</Link>. Government and operator pages are cited,
          not copied: their text remains theirs, and Karachify states the value it read plus the date it read it.
        </p>

        <h2 className="mt-14 font-display text-2xl font-bold text-navy-800">Read but not published</h2>
        <p className="section-sub mt-1">
          {exclusions.length} values were read from a source and still kept out of the build, each for a reason that
          travels with it below. Alongside them, {absenceNotes} research notes record that an official page was opened and
          published no timetable, no fee or no contact at all — which is a finding, not a gap in the search. These are the
          strongest argument this page can make: a citation is not automatically a fact.
        </p>
        <ul className="mt-4 space-y-3">
          {exclusions.map((e) => (
            <li key={`${e.slug}-${e.field}`} className="card p-4">
              <p className="text-[13px] font-bold uppercase tracking-wide text-navy-500">
                {fieldLabel(e.field)} · {e.name}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-navy-600">{e.reason}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 font-display text-2xl font-bold text-navy-800">How a value gets here</h2>
        <Prose className="mt-4">
          <p>
            Research is written to <code>docs/verification/batch-*.json</code> — {provenance.generatedFrom.length} files,
            one record per place, each value paired with the URL it came from, and a <code>missingFields</code> list
            naming what no source stated. A generator, <code>.tools/apply-verification.mjs</code>, reads those files and
            writes <code>src/data/verified-overrides.json</code> (the values the catalogue may show) and
            <code>src/data/provenance.json</code> (the citations this page prints). No fact on this site is typed into a
            page by hand: if the research file does not carry a URL for it, the value does not exist in the build.
          </p>
          <p>
            A place can be researched twice — once to pin it, later to chase the details the first pass could not find —
            so records merge by name before anything ships. The rules there are deliberately conservative: a re-check
            that lands a different coordinate is reported as a conflict and ignored rather than moving the pin on its own,
            the weaker of two confidence grades wins, and the date published is the <em>earliest</em> of the batches,
            because that date vouches for every field on the page at once.
          </p>
          <p>
            The generator refuses more than it accepts. A record with no coordinates or no address is skipped rather than
            centred on its neighbourhood and labelled as found. Coordinates outside the Karachi bounding box are skipped
            as a probable typo. Opening times written three different ways across the batches are normalised to 24-hour
            form only when they parse; a value that will not parse is published as the source wrote it instead of being
            guessed at. Fees labelled “press” are flagged as reported rather than official. Anything that could not be
            read is left undefined, and every page renders that absence as “Pricing to confirm”, “Rating not verified” or
            “Approximate position”.
          </p>
          <p>
            Confidence is set by the evidence, not by the mood of the write-up: a record is badged Verified only when an
            official source supplied its practical details, and {sourcedRecords - fullyChecked} researched records are
            therefore badged as position-and-address only even though their pin and address came from OpenStreetMap.
            Forty-one further records were deleted outright because their own data entries described them as placeholder
            entries written to demonstrate a layout — generic clinics, salons, agencies and hotels that named no checkable
            business. A directory that sends you to a shop which never existed is worse than a shorter directory.
          </p>
          <p>
            The event board ships empty for the same reason. No dated, attributable Karachi event was found that this
            build could publish, so it publishes none rather than rebasing invented dates to keep the page looking busy.
            What the site does generate is described on the <Link to="/about" className="link">about page</Link>, and how
            a page states its own gaps is visible on any{' '}
            <Link to="/explore" className="link">directory listing</Link>.
          </p>
        </Prose>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <ShieldCheck className="h-5 w-5 text-teal-600" />
            <h3 className="mt-2 font-display text-base font-bold text-navy-800">What this page does not cover</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-navy-600">
              {noSource} directory records carry no source link at all — their names, areas and descriptions came with
              the build and have not been checked against anything. They appear in search and on maps with an approximate
              position and no rating, price, review or opening hour. Emergency numbers in the services hub are printed
              with the note “number not checked against an official source” unless that page lists a source for them.
            </p>
          </div>
          <div className="card p-5">
            <h3 className="font-display text-base font-bold text-navy-800">Reproduce the audit</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-navy-600">
              The research files, the generator and the data every page reads are in one public repository, so this list
              can be checked line by line rather than taken on trust:{' '}
              <a
                href="https://github.com/mbilalecom4/karachify"
                target="_blank"
                rel="noopener noreferrer"
                className="link inline-flex items-center gap-1"
              >
                mbilalecom4/karachify <ExternalLink className="h-3 w-3" />
              </a>
              . Run <code>node .tools/apply-verification.mjs</code> against a changed research file and the catalogue
              values move with it.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
