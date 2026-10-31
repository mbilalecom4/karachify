import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HeartHandshake, LifeBuoy, Search } from 'lucide-react';
import { Field, TextInput } from '../components/ui';
import { PageHero } from '../components/Page';

interface Faq {
  q: string;
  a: string;
  group: 'Browsing' | 'Your account' | 'Businesses' | 'Events' | 'Data & accuracy';
}

const FAQS: Faq[] = [
  {
    group: 'Browsing',
    q: 'How do I find places near me?',
    a: 'Open the map, or start from an area page. Every listing belongs to one of Karachi’s areas, so filtering by area narrows the directory to a walkable or drivable cluster. There is no “near me” search: this site never asks for your location.',
  },
  {
    group: 'Browsing',
    q: 'What do the filters on a category page do?',
    a: 'The text box filters within that category only. The area selector restricts to one locality, sorting covers Karachify picks, A–Z and group-by-area, and the grid/list toggle changes density. All three combine, and the result count updates as you type. Nothing sorts by rating, because no record carries one.',
  },
  {
    group: 'Browsing',
    q: 'Is the site usable on a phone?',
    a: 'Yes. Navigation collapses into a menu, category strips scroll horizontally, and the map switches to a stacked map-over-list layout under the tablet breakpoint.',
  },
  {
    group: 'Browsing',
    q: 'Why does a search for a real restaurant return nothing?',
    a: 'Search only knows the records in this dataset. It never invents a business to fill an empty result — you get a no-results page with suggestions instead.',
  },
  {
    group: 'Your account',
    q: 'Do I need an account to browse?',
    a: 'No. Favourites, saved events and enquiries work as a guest too, stored under a guest profile. An account simply separates people using the same browser.',
  },
  {
    group: 'Your account',
    q: 'Where is my data stored?',
    a: 'In localStorage on this device, under the key karachify.db.v1. Nothing is uploaded, and there is no analytics or advertising tracker on the site. Clearing site data removes everything.',
  },
  {
    group: 'Your account',
    q: 'Is the login secure?',
    a: 'No, and it does not claim to be. There is no server behind this build: passcodes sit in plain text inside your own browser’s storage. Use the profile page’s reset button to return the dataset to its shipped state.',
  },
  {
    group: 'Businesses',
    q: 'How do I list my business?',
    a: 'Use the “List your business” form: name, category, area, address, description and contact. It enters the review queue; approving it publishes a page with its own URL and an area-level pin, badged as not yet verified.',
  },
  {
    group: 'Businesses',
    q: 'What is “Claim This Business”?',
    a: 'It tells the moderation team you represent a listing that already exists. In a hosted build, the claim starts a document check before editing rights are granted; here it records the request in your browser so you can follow the flow.',
  },
  {
    group: 'Businesses',
    q: 'Can I change my opening hours or photos?',
    a: 'Owner accounts can edit name, tagline, description, phone, price band, address and facilities from the dashboard. Edits set the record back to “Not verified yet” so a moderator sees them.',
  },
  {
    group: 'Events',
    q: 'Are the events real?',
    a: 'The board is empty rather than filled. Karachify removed the invented sample calendar it shipped with: an event appears here when a dated source names it, or when a submitted event is published from what the organiser wrote — and that case is badged “Not verified yet”, never presented as confirmed.',
  },
  {
    group: 'Events',
    q: 'Can I add an event to my calendar?',
    a: 'Yes — the event page downloads a .ics file for the exact dates shown, which Apple Calendar, Google Calendar and Outlook all accept.',
  },
  {
    group: 'Events',
    q: 'Can I submit an event for the calendar?',
    a: 'Use the submit-an-event form. The entry waits for moderation, and a published community event carries a “Not verified yet” badge until a dated source is attached to it.',
  },
  {
    group: 'Data & accuracy',
    q: 'How are coordinates chosen?',
    a: 'A source-checked record sits on the OpenStreetMap node or way for that place, and the page links the OSM feature so you can see the evidence. Everything else is placed on an offset from its area centre so the map stays readable — those pages say “Approximate position” and never claim a doorway.',
  },
  {
    group: 'Data & accuracy',
    q: 'Where do the photographs come from?',
    a: 'Wikimedia Commons and Wikipedia articles, hotlinked rather than copied, each checked for subject and Karachi locality. Unresolved subjects get a designed placeholder naming the real place. The full credit list is on the image credits page.',
  },
  {
    group: 'Data & accuracy',
    q: 'What happened to the ratings?',
    a: 'Deleted. Every record used to carry a generated star rating and review count; none of them came from a real visitor, so they were removed rather than relabelled. Cards now say “Rating not verified”, and a review you write here stays in your own browser.',
  },
  {
    group: 'Data & accuracy',
    q: 'How do I know a verified page is really verified?',
    a: 'The page itself says so field by field: the sidebar names the source it was read from, the date it was checked and a link to the OpenStreetMap feature the pin came from. The research behind those pages lives in the repository under docs/verification and is generated into the app by a script — nobody types an opening hour or a price into the interface by hand.',
  },
  {
    group: 'Data & accuracy',
    q: 'I found an error. What now?',
    a: 'Send the listing, the field and a source through the contact form. Corrections to phone numbers, hours and prices are applied only against a citable source.',
  },
  {
    group: 'Data & accuracy',
    q: 'Why is map data from OpenStreetMap?',
    a: 'OSM’s public raster tiles need no API key and no billing account, which suits a static site, and the data itself is openly licensed. They are shared public infrastructure, so a build with real traffic self-hosts tiles or licenses a provider instead of leaning on them.',
  },
];

const GROUPS = ['Browsing', 'Your account', 'Businesses', 'Events', 'Data & accuracy'] as const;

export default function Help() {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [open, setOpen] = useState<string | null>(FAQS[0].q);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return FAQS.filter(
      (f) =>
        (!group || f.group === group) &&
        (!needle || `${f.q} ${f.a}`.toLowerCase().includes(needle))
    );
  }, [q, group]);

  return (
    <>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi"
        eyebrow="Help centre"
        title="Answers about using Karachify"
        sub="How browsing, accounts, submissions, events and the honesty labels work — written for the build that is actually running."
        trail={[{ label: 'Home', to: '/' }, { label: 'Help' }]}
        height="min-h-[240px] sm:min-h-[300px]"
      />

      <div className="shell section">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div>
            <div className="card p-5">
              <Field label="Search the help centre">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
                  <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. claim, ics, coordinates" className="pl-10" />
                </div>
              </Field>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className={`chip ${!group ? 'chip-active' : ''}`} onClick={() => setGroup('')}>
                  All topics
                </button>
                {GROUPS.map((g) => (
                  <button key={g} className={`chip ${group === g ? 'chip-active' : ''}`} onClick={() => setGroup(group === g ? '' : g)}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {shown.map((f) => {
                const isOpen = open === f.q;
                return (
                  <div key={f.q} className="card overflow-hidden">
                    <button
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : f.q)}
                    >
                      <span className="font-semibold text-navy-800">{f.q}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-navy-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-navy-50 bg-mist px-5 py-4">
                        <p className="text-sm leading-relaxed text-navy-600">{f.a}</p>
                        <p className="mt-2 text-[13px] font-semibold uppercase tracking-wide text-navy-400">{f.group}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              {shown.length === 0 && (
                <div className="card p-8 text-center">
                  <h2 className="font-display text-lg font-bold text-navy-800">No answer matches “{q}”</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-navy-500">
                    Try a shorter word, or ask us directly — the contact form logs your question so you can see the whole
                    enquiry flow.
                  </p>
                  <Link to="/contact" className="btn-primary mt-5">
                    Ask the team
                  </Link>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-navy-800">
                <LifeBuoy className="h-4 w-4 text-teal-600" /> Quick actions
              </h2>
              <div className="mt-3 space-y-2">
                <Link to="/list-your-business" className="btn-outline w-full">
                  List a business
                </Link>
                <Link to="/submit-event" className="btn-outline w-full">
                  Submit an event
                </Link>
                <Link to="/contact" className="btn-outline w-full">
                  Report an error
                </Link>
                <Link to="/image-credits" className="btn-ghost w-full">
                  Photo credits
                </Link>
              </div>
            </div>
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-navy-800">
                <HeartHandshake className="h-4 w-4 text-teal-600" /> Shortcuts that help
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-navy-600">
                <li>Press <kbd className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[12px]">Esc</kbd> to dismiss the search suggestion panel without losing your text.</li>
                <li>Arrow keys move through search suggestions; Enter opens the highlighted one, or runs a full search if nothing is highlighted.</li>
                <li>Every card is a link — the whole card, not just the title.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
