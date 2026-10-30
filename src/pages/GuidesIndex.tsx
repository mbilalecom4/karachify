import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { guides } from '../data/guides';
import { GuideCard } from '../components/cards';
import { PageHero } from '../components/Page';
import { EmptyState, SectionHeading, TextInput } from '../components/ui';

export default function GuidesIndex() {
  const [q, setQ] = useState('');
  const tags = Array.from(new Set(guides.map((g) => g.tag)));
  const [tag, setTag] = useState('all');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return guides
      .filter((g) => (tag === 'all' ? true : g.tag === tag))
      .filter((g) => (term ? `${g.title} ${g.excerpt} ${g.tag} ${g.area}`.toLowerCase().includes(term) : true));
  }, [q, tag]);

  return (
    <div>
      <PageHero
        mediaKey="banner-guides"
        label="Karachi city guides"
        eyebrow="Long reads"
        title="Karachi city guides"
        sub="Practical, honest plans written for the way the city actually behaves — traffic, weather, timings and the distance between two places that look close on a map."
        trail={[{ label: 'Home', to: '/' }, { label: 'Guides' }]}
      />

      <section className="shell section">
        <div className="card mb-6 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guides…" aria-label="Search guides" className="pl-10" />
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <button onClick={() => setTag('all')} className={`chip whitespace-nowrap ${tag === 'all' ? 'chip-active' : ''}`}>
              All
            </button>
            {tags.map((t) => (
              <button key={t} onClick={() => setTag(t)} className={`chip whitespace-nowrap ${tag === t ? 'chip-active' : ''}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <SectionHeading eyebrow={`${guides.length} guides`} title="Pick a plan" sub="Each guide links out to the listings it mentions, so you can move from reading to booking an evening in the same tab." />

        {filtered.length === 0 ? (
          <EmptyState title="No guide matches that search" body="Try “one day”, “food”, “monsoon” or “kids”, or clear the tag filter." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((g) => (
              <GuideCard key={g.id} guide={g} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
