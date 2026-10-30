import { Link } from 'react-router-dom';
import { ArrowUpRight, Facebook, Instagram, Mail, MapPin, Send, Twitter, Youtube } from 'lucide-react';
import { useDB, selectAreas, selectCategories } from '../lib/store';
import { BrandLogo } from './BrandLogo';
import { isValidEmail } from '../lib/format';
import { useState } from 'react';
import { actions } from '../lib/store';
import { useToast } from './ui';

const AREA_LINKS = ['clifton', 'dha', 'saddar', 'gulshan-e-iqbal', 'pechs', 'korangi', 'malir', 'lyari'];

export function Footer() {
  const db = useDB();
  const categories = selectCategories(db).filter((c) => c.navOrder <= 16);
  const areas = selectAreas(db);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    actions.addSubmission({
      kind: 'newsletter',
      name: email,
      description: 'Newsletter subscription from the footer form.',
      email,
      status: 'approved',
    });
    setEmail('');
    toast.push('Subscribed — demo only, no email is actually sent.');
  };

  return (
    <footer className="mt-16 bg-navy-900 text-navy-100">
      <div className="shell py-14">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_2fr]">
          <div>
            <BrandLogo light />
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-navy-200">
              Karachify is a city-discovery platform for Karachi — places to see, food to find, events to attend and the services every
              resident and visitor searches for. Built for Karachi first, structured for more cities later.
            </p>
            <form onSubmit={subscribe} className="mt-5 max-w-sm">
              <label htmlFor="footer-email" className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-teal-200">
                Weekly Karachi digest
              </label>
              <div className="flex gap-2">
                <input
                  id="footer-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-invalid={!!error}
                  className="w-full rounded-full border border-navy-700 bg-navy-800 px-4 py-2.5 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 focus:outline-none"
                />
                <button className="btn-primary shrink-0 px-4" aria-label="Subscribe">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {error && <p className="mt-1.5 text-[12.5px] font-medium text-rose-300">{error}</p>}
              <p className="mt-1.5 text-[11.5px] text-navy-400">Demo form — entries are stored locally, nothing is emailed.</p>
            </form>
            <div className="mt-6 flex gap-2">
              {[Instagram, Facebook, Twitter, Youtube].map((Icon, i) => (
                <span
                  key={i}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-navy-700 text-navy-300 transition-colors hover:border-teal-400 hover:text-teal-200"
                  title="Social profile (not configured in this demo)"
                >
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <FooterCol title="Discover">
              {categories.slice(0, 8).map((c) => (
                <FooterLink key={c.id} to={`/category/${c.slug}`}>
                  {c.name}
                </FooterLink>
              ))}
            </FooterCol>
            <FooterCol title="Essentials">
              {categories.slice(8).map((c) => (
                <FooterLink key={c.id} to={`/category/${c.slug}`}>
                  {c.name}
                </FooterLink>
              ))}
            </FooterCol>
            <FooterCol title="Areas">
              {AREA_LINKS.map((slug) => (
                <FooterLink key={slug} to={`/area/${slug}`}>
                  {areas.find((a) => a.slug === slug)?.name ?? slug}
                </FooterLink>
              ))}
              <FooterLink to="/areas">All {areas.length} areas</FooterLink>
            </FooterCol>
            <FooterCol title="Karachify">
              <FooterLink to="/about">About us</FooterLink>
              <FooterLink to="/contact">Contact</FooterLink>
              <FooterLink to="/advertise">Advertise with us</FooterLink>
              <FooterLink to="/list-your-business">List your business</FooterLink>
              <FooterLink to="/submit-event">Submit an event</FooterLink>
              <FooterLink to="/guides">City guides</FooterLink>
              <FooterLink to="/help">Help centre</FooterLink>
              <FooterLink to="/image-credits">Image credits & sources</FooterLink>
              <FooterLink to="/privacy">Privacy policy</FooterLink>
              <FooterLink to="/terms">Terms & conditions</FooterLink>
            </FooterCol>
          </div>
        </div>

        <div className="mt-12 grid gap-4 border-t border-navy-800 pt-8 text-[13px] text-navy-300 sm:grid-cols-3">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
            Karachi, Sindh, Pakistan
          </p>
          <p className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
            hello@karachify.demo
          </p>
          <p className="flex items-start gap-2">
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
            Photography via Wikimedia Commons under the licences listed on the credits page.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-navy-800 pt-6 text-[12.5px] text-navy-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Karachify. Launch preview with sample content.</p>
          <p className="flex flex-wrap gap-4">
            <Link to="/privacy" className="hover:text-teal-200">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-teal-200">
              Terms
            </Link>
            <Link to="/help" className="hover:text-teal-200">
              Help
            </Link>
            <Link to="/admin" className="hover:text-teal-200">
              Admin
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-white">{title}</h4>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-[13.5px] text-navy-200 transition-colors hover:text-teal-200">
        {children}
      </Link>
    </li>
  );
}
