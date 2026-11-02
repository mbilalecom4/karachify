import { Link } from 'react-router-dom';
import { ArrowUpRight, Mail, MapPin } from 'lucide-react';
import { useDB, selectAreas, selectCategories } from '../lib/store';
import { BrandLogo } from './BrandLogo';

const AREA_LINKS = ['clifton', 'dha', 'saddar', 'gulshan-e-iqbal', 'pechs', 'korangi', 'malir', 'lyari'];

export function Footer() {
  const db = useDB();
  const categories = selectCategories(db).filter((c) => c.navOrder <= 16);
  const areas = selectAreas(db);

  return (
    <footer className="mt-16 bg-navy-900 text-navy-100">
      <div className="shell py-14">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_2fr]">
          <div>
            <BrandLogo light />
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-navy-200">
              Karachify is a city-discovery platform for Karachi — places to see, food to find, services every resident
              and visitor searches for, and the source behind each detail we were able to check. Built for Karachi
              first, structured for more cities later.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/contact" className="btn btn-sm border border-navy-700 bg-navy-800 text-white hover:border-lime-400">
                Report a correction
              </Link>
              <Link to="/help" className="btn btn-sm border border-navy-700 bg-navy-800 text-white hover:border-lime-400">
                How we verify
              </Link>
            </div>
            <p className="mt-3 max-w-sm text-[11.5px] leading-relaxed text-navy-300">
              No newsletter, no email list, no tracking: this build has no server, so it asks for nothing it cannot send.
            </p>
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
              <FooterLink to="/directory">Wider directory</FooterLink>
            </FooterCol>
            <FooterCol title="Karachify">
              <FooterLink to="/about">About us</FooterLink>
              <FooterLink to="/contact">Contact</FooterLink>
              <FooterLink to="/advertise">Advertise with us</FooterLink>
              <FooterLink to="/list-your-business">List your business</FooterLink>
              <FooterLink to="/submit-event">Submit an event</FooterLink>
              <FooterLink to="/plan">Plan your day</FooterLink>
              <FooterLink to="/open-now">Open right now</FooterLink>
              <FooterLink to="/guides">City guides</FooterLink>
              <FooterLink to="/help">Help centre</FooterLink>
              <FooterLink to="/sources">Sources & verification</FooterLink>
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
            No Karachify inbox is configured — verified pages link the operator&apos;s own contact details instead.
          </p>
          <p className="flex items-start gap-2">
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
            Photography via Wikimedia Commons under the licences listed on the credits page.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-navy-800 pt-6 text-[12.5px] text-navy-300 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Karachify. Open data, licensed photography and honest gaps.</p>
          <p className="flex flex-wrap gap-4">
            <Link to="/privacy" className="hover:text-lime-300">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-lime-300">
              Terms
            </Link>
            <Link to="/help" className="hover:text-lime-300">
              Help
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
      <Link to={to} className="text-[13.5px] text-navy-200 transition-colors hover:text-lime-300">
        {children}
      </Link>
    </li>
  );
}
