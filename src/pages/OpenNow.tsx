import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, ExternalLink, Moon } from 'lucide-react';
import { selectAreas, selectListings, useDB } from '../lib/store';
import { categoryById } from '../data/taxonomy';
import { aroundTheClock, formatDate } from '../lib/format';
import { citationsFor } from '../lib/provenance';
import { Note, PageHero } from '../components/Page';
import { EmptyState, SectionHeading } from '../components/ui';

/**
 * Only a record whose own citation says "24 hours" belongs here. A place that
 * merely feels open late is not evidence, which is why the list is short.
 */
export default function OpenNow() {
  const db = useDB();
  const listings = selectListings(db);
  const areas = selectAreas(db);

  const rows = listings
    .map((listing) => ({
      listing,
      row: aroundTheClock(listing.hours),
      cites: citationsFor(listing.slug, 'hours'),
    }))
    .filter((x) => x.row && x.cites.length > 0)
    .sort((a, b) => a.listing.name.localeCompare(b.listing.name));

  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? id;

  return (
    <div>
      <PageHero
        mediaKey="hero-karachi-night"
        label="Karachi at night"
        eyebrow="Around the clock"
        title="Open 24 hours"
        sub="Places whose own published page states round-the-clock hours — a 24-hour emergency department, a service counter that never closes. Every entry prints the exact hours claim and the page it came from."
        trail={[{ label: 'Home', to: '/' }, { label: '24/7 Open' }]}
      />

      <section className="shell section">
        <SectionHeading
          eyebrow={`${rows.length} verified ${rows.length === 1 ? 'claim' : 'claims'}`}
          title="Checked round-the-clock records"
          sub="A record appears only when a cited source states the hours. The row below is that claim, not an inference from late opening."
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={<Moon className="h-6 w-6" />}
            title="No record states 24-hour hours yet"
            body="Karachify used to label places open around the clock without a source. Those labels were removed, and this list fills only from pages that say it themselves. If you run a place that stays open, submit it and the page you publish will be the citation."
            action={
              <Link to="/list-your-business" className="btn-primary">
                List a 24-hour business
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {rows.map(({ listing, row, cites }) => {
              const area = areaName(listing.areaId);
              const category = categoryById.get(listing.categoryId)?.name ?? 'Place';
              return (
                <li key={listing.slug} className="card flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/place/${listing.slug}`} className="font-display text-[18px] font-bold text-navy-800 hover:text-teal-700">
                        {listing.name}
                      </Link>
                      <p className="mt-0.5 text-[13px] text-navy-400">
                        {category} · {area}
                      </p>
                    </div>
                    <span className="badge bg-navy-800 text-white">
                      <Moon className="h-3 w-3" /> 24 hours
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl bg-navy-50 px-3 py-2">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-navy-400">{row!.day}</p>
                    <p className="mt-0.5 text-[15px] font-semibold text-navy-800">{row!.open}</p>
                  </div>

                  <p className="mt-3 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-navy-500">
                    <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                    {listing.lastVerified ? `Checked ${formatDate(listing.lastVerified)}.` : 'Read from the source below.'}{' '}
                    {cites.length === 1 ? 'Stated on' : 'Stated on any of'}{' '}
                    {cites.map((c, i) => (
                      <span key={c.url}>
                        {i > 0 && ' · '}
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link inline-flex items-center gap-0.5"
                        >
                          {new URL(c.url).hostname.replace(/^www\./, '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </span>
                    ))}
                  </p>

                  <Link to={`/place/${listing.slug}`} className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-semibold text-teal-700">
                    Open the record <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Note>
            <strong className="text-navy-700">What a 24-hour row covers.</strong> The label above the hours is the
            department or service the source names. A hospital whose emergency department runs all night may still close
            its outpatient clinics at 5pm, and a 24-hour counter in a mall does not mean the mall is open — the row says
            which part of the place it describes.
          </Note>
          <Note>
            <strong className="text-navy-700">What this list cannot promise.</strong> Hours can change for public holidays,
            maintenance or security. Nothing here replaces a phone call for a journey that matters, and Karachify does not
            add a place to this page because it is probably open — it waits for a page that says so.
          </Note>
        </div>

        <p className="mt-6 text-[13px] leading-relaxed text-navy-500">
          Looking for the numbers to call at any hour instead?{' '}
          <Link to="/services" className="link font-semibold">
            Emergency services
          </Link>{' '}
          lists the city-wide lines with the government pages that publish them.
        </p>
      </section>
    </div>
  );
}
