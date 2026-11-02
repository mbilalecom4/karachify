import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ExternalLink } from 'lucide-react';
import { attributionRows, pictureSubject, placeholderImage, resolvedMediaCount } from '../lib/media';
import { selectListings, useDB } from '../lib/store';
import { Field, TextInput } from '../components/ui';
import { Note, PageHero } from '../components/Page';

export default function ImageCredits() {
  const db = useDB();
  const rows = attributionRows();
  const listings = selectListings(db);
  const [q, setQ] = useState('');

  const shown = useMemo(
    () => rows.filter((m) => `${m.key} ${m.subject} ${pictureSubject(m)} ${m.artist ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())),
    [rows, q]
  );

  const illustrative = rows.filter((m) => m.kind === 'related').length;
  const withPhoto = listings.filter((l) => rows.some((r) => r.key === l.slug)).length;

  return (
    <>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi"
        eyebrow="Attribution"
        title="Photograph credits"
        sub="Every image hotlinked by this build, the subject it depicts, the artist and the licence — plus how a place is handled when no suitable Karachi photograph exists."
        trail={[{ label: 'Home', to: '/' }, { label: 'Image credits' }]}
        height="min-h-[240px] sm:min-h-[300px]"
      />

      <div className="shell section">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Photographs credited', value: String(rows.length) },
            { label: 'Depicting the exact subject', value: String(rows.length - illustrative) },
            { label: 'Labelled illustrative stand-ins', value: String(illustrative) },
          ].map((s) => (
            <div key={s.label} className="card p-5">
              <p className="font-display text-3xl font-extrabold text-navy-800">{s.value}</p>
              <p className="text-sm text-navy-500">{s.label}</p>
            </div>
          ))}
        </div>

        <Note className="mt-6">
          {resolvedMediaCount} registry keys are filled and {withPhoto} of {listings.length} directory records carry a
          real photograph. Images are hotlinked from Wikimedia projects under their respective licences and are validated
          for both subject and locality before use — an article about a bombing, a battle or another city is rejected even
          if it mentions a Karachi neighbourhood. {illustrative} images depict a Karachi scene of the same kind rather
          than the exact subject and are labelled “Illustrative” wherever they appear. Where nothing suitable can be
          found, Karachify renders a designed placeholder that names the actual subject instead of dressing an unrelated
          photograph up as Karachi. Report an attribution problem through the{' '}
          <Link to="/contact" className="link">contact form</Link>.
        </Note>

        <div className="mt-8 max-w-sm">
          <Field label="Find a credit">
            <div className="relative">
              <Camera className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
              <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Subject, artist or record key" className="pl-10" />
            </div>
          </Field>
        </div>

        <div className="mt-6 card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-navy-100 bg-mist text-[13px] uppercase tracking-wide text-navy-500">
              <tr>
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Record key</th>
                <th className="px-4 py-3">Artist</th>
                <th className="px-4 py-3">Licence</th>
                <th className="px-4 py-3 text-right">Source</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.key} className="border-b border-navy-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <img
                      src={m.thumb}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      className="h-12 w-16 rounded-md bg-navy-50 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = placeholderImage(m.subject);
                      }}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-navy-800">
                    {m.kind === 'related' ? (
                      <>
                        {pictureSubject(m)}
                        <span className="mt-1 block text-[12px] font-normal leading-snug text-navy-500">
                          Illustrative — attached to <span className="text-navy-700">{m.subject}</span>, same kind of scene, not this record
                        </span>
                      </>
                    ) : (
                      m.subject
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-navy-400">{m.key}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-navy-600" title={m.artist}>
                    {m.artist ?? 'See file page'}
                  </td>
                  <td className="px-4 py-2.5 text-navy-600">{m.license ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    {m.filePage ? (
                      <a href={m.filePage} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-[13px]">
                        File page <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-navy-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-navy-500">
                    No credit matches “{q}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-navy-500">
          Showing {shown.length} of {rows.length} credited photographs.
        </p>
      </div>
    </>
  );
}
