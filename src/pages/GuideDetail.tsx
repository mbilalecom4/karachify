import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import { guides, getGuide } from '../data/guides';
import { selectListings, useDB } from '../lib/store';
import { GuideCard } from '../components/cards';
import { PageHero, Note } from '../components/Page';
import { EmptyState, SectionHeading } from '../components/ui';

export default function GuideDetail() {
  const { slug = '' } = useParams();
  const guide = getGuide(slug);
  const db = useDB();
  const listings = selectListings(db);

  const mentioned = useMemo(() => {
    if (!guide) return [];
    const body = `${guide.title} ${guide.excerpt} ${guide.sections.map((s) => `${s.heading} ${s.body.join(' ')}`).join(' ')}`.toLowerCase();
    return listings
      .filter((l) => {
        const needle = l.name.toLowerCase().split(/[ (—-]/)[0];
        return needle.length > 4 && body.includes(needle);
      })
      .slice(0, 8);
  }, [guide, listings]);

  if (!guide) {
    return (
      <div className="shell section">
        <EmptyState
          title="Guide not found"
          body="That guide is not part of this build. Every published guide is listed on the guides index."
          action={
            <Link to="/guides" className="btn-primary">
              All guides
            </Link>
          }
        />
      </div>
    );
  }

  const related = guides.filter((g) => g.slug !== guide.slug).slice(0, 3);

  return (
    <div>
      <PageHero
        mediaKey={`guide-${guide.slug}`}
        label={guide.title}
        eyebrow={`Guide · ${guide.tag}`}
        title={guide.title}
        sub={guide.excerpt}
        trail={[{ label: 'Home', to: '/' }, { label: 'Guides', to: '/guides' }, { label: guide.title }]}
      >
        <div className="flex flex-wrap items-center gap-3 text-sm text-navy-100">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-teal-300" /> {guide.readMinutes} minute read
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-teal-300" /> {guide.area}
          </span>
        </div>
      </PageHero>

      <section className="shell section">
        <div className="mx-auto max-w-3xl">
          <Note>
            Guides on this showcase are written as realistic demo editorial — the places named exist, but timings,
            prices and availability must be confirmed with each venue before you plan around them.
          </Note>

          <article className="mt-8 space-y-8">
            {guide.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="font-display text-2xl font-bold text-navy-800">{s.heading}</h2>
                {s.body.map((p, i) => (
                  <p key={i} className="mt-3 text-[16px] leading-[1.75] text-navy-600">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </article>

          {mentioned.length > 0 && (
            <div className="mt-12">
              <SectionHeading eyebrow="In this build" title="Places mentioned" />
              <ul className="grid gap-3 sm:grid-cols-2">
                {mentioned.map((l) => (
                  <li key={l.id}>
                    <Link to={`/place/${l.slug}`} className="card card-hover flex items-center justify-between gap-3 p-4">
                      <span>
                        <span className="block font-semibold text-navy-800">{l.name}</span>
                        <span className="block text-[13px] text-navy-500">{l.address}</span>
                      </span>
                      <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="shell">
          <SectionHeading
            eyebrow="Keep reading"
            title="More Karachi guides"
            action={
              <Link to="/guides" className="btn-outline btn-sm">
                All guides
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-3">
            {related.map((g) => (
              <GuideCard key={g.id} guide={g} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
