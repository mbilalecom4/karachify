import { Link } from 'react-router-dom';
import { AlertTriangle, Github, Inbox } from 'lucide-react';
import type { Listing, Submission } from '../types';
import { selectListings, useDB } from '../lib/store';
import { coordText, formatDate } from '../lib/format';
import { listingHref } from '../lib/openRecords';
import { shareUrl } from '../lib/pageMeta';
import { hoursQuote } from '../lib/hoursRead';
import { Note, PageHero } from '../components/Page';
import { EmptyState, SectionHeading } from '../components/ui';

/**
 * What has been reported — and on whose device.
 *
 * This build has no server, so the only filings it can list are the ones saved
 * in this browser, and the page says that in its first sentence rather than
 * dressing a local notebook up as crowd intelligence: there is no "N visitors
 * said so", no tally, no weighing of one report against another. Only the reports
 * themselves, in the words their author typed, each with the one route that
 * actually reaches the people who edit this data.
 */

/** The same body ReportModal files, so escalating a saved report matches it. */
function issueUrlFor(report: Submission, listing: Listing | undefined) {
  const place = report.name.split(' — ')[0];
  const body = [
    `**Place:** ${place}`,
    `**Page:** ${listing ? shareUrl(listingHref(listing)) : 'not recorded on this device'}`,
    `**What was reported:** ${report.name.split(' — ')[1] ?? 'a problem'}`,
    `**Filed on this device:** ${report.createdAt}`,
    listing ? `**Address shown:** ${listing.address ?? 'not stated'}` : '',
    listing ? `**Hours shown:** ${hoursQuote(listing.hours) || 'none stated'}` : '',
    listing?.lastVerified ? `**Last checked:** ${listing.lastVerified}` : '',
    '',
    report.description,
    '',
    'Filed from Karachify’s reports page, which keeps reports on the visitor’s own device.',
  ]
    .filter(Boolean)
    .join('\n');
  return `https://github.com/mbilalecom4/karachify/issues/new?title=${encodeURIComponent(`Data problem: ${place}`)}&body=${encodeURIComponent(
    body
  )}`;
}

export default function RecentReports() {
  const db = useDB();
  const listings = selectListings(db);
  const reports = db.submissions.filter((s) => s.kind === 'report');

  return (
    <div>
      <PageHero
        mediaKey="hero-karachi"
        label="Filed on this browser"
        eyebrow="Crowd notes"
        title="What has been reported"
        sub="Every problem report filed from this device, newest first, in the words its author used. Nothing here counts visitors or weighs one report against another: a build with no server keeps what it is handed, locally."
        trail={[{ label: 'Home', to: '/' }, { label: 'Reported' }]}
      />

      <section className="shell section">
        <SectionHeading
          eyebrow={`${reports.length} filed on this device`}
          title="Reports kept in this browser"
          sub="Karachify stores a report in this browser's own storage. It is not emailed anywhere, and no other visitor's reports can appear here, so this list is a notebook rather than a vote."
        />

        {reports.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="Nothing has been reported from this device"
            body="Open a listing and press Report a problem and what you file appears here, so it can be copied into a GitHub issue later. The reports that reach whoever maintains this data are the issues on the public repository, and no page in this build can list those."
            action={
              <a
                href="https://github.com/mbilalecom4/karachify/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                <Github className="h-3.5 w-3.5" /> See the public issue list
              </a>
            }
          />
        ) : (
          <ul className="space-y-3">
            {reports.map((report) => {
              const place = report.name.split(' — ')[0];
              const reason = report.name.split(' — ')[1] ?? 'A problem';
              const listing = report.listingId ? listings.find((l) => l.id === report.listingId) : undefined;
              return (
                <li key={report.id} className="card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display text-[16px] font-bold text-navy-800">
                      {listing ? (
                        <Link to={listingHref(listing)} className="hover:text-teal-700">
                          {place}
                        </Link>
                      ) : (
                        place
                      )}
                    </span>
                    <span className="text-[12px] text-navy-400">Filed {formatDate(report.createdAt)}</span>
                  </div>

                  <p className="mt-1 flex items-start gap-1.5 text-[13px] font-semibold text-teal-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {reason}
                  </p>
                  <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-navy-600">{report.description}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a href={issueUrlFor(report, listing)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                      <Github className="h-3.5 w-3.5" /> Send this one to us as an issue
                    </a>
                    <span className="text-[12px] text-navy-400">
                      {report.email ? 'Your email was saved with it.' : 'No email was left, so no follow-up question can reach you.'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Note>
            <strong className="text-navy-700">Why no totals.</strong> A count of reports is easy to fabricate and useless to
            act on: one person who walked into the place outweighs fifty people guessing. Karachify shows the reports and
            their sources and leaves the tallying out.
          </Note>
          <Note>
            <strong className="text-navy-700">Clearing this list.</strong> These reports live in this browser&apos;s own
            storage. Emptying the site&apos;s stored data, or reading the page on another device, empties the list — which is
            exactly why the issue button sits beside every entry.
          </Note>
        </div>
      </section>
    </div>
  );
}
