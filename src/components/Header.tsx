import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Heart,
  Info,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Plus,
  Search,
  User,
  X,
} from 'lucide-react';
import { useDB, currentUser, actions, prefsFor, selectCategories, selectListings } from '../lib/store';
import { BrandLogo } from './BrandLogo';
import { SearchBox } from './SearchBox';

interface NavItem {
  label: string;
  to: string;
  children?: { label: string; to: string; note?: string }[];
}

export function Header() {
  const db = useDB();
  const user = currentUser(db);
  const categories = selectCategories(db);
  const listings = selectListings(db);
  const verifiedCount = listings.filter((l) => l.status === 'verified').length;
  const sourcedCount = listings.filter((l) => l.coordsVerified).length;
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [account, setAccount] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const cat = (slug: string) => `/category/${slug}`;
  const byId = (id: string) => categories.find((c) => c.id === id);

  const nav: NavItem[] = [
    {
      label: 'Explore',
      to: '/explore',
      children: [
        { label: 'Home', to: '/', note: 'Discover Everything Karachi' },
        { label: 'All categories', to: '/explore', note: 'Every section in one place' },
        ...categories.filter((c) => c.group === 'Discover').map((c) => ({ label: c.name, to: cat(c.slug) })),
        { label: 'City guides', to: '/guides', note: 'How to spend a day here' },
        { label: 'Explore map', to: '/map' },
      ],
    },
    {
      label: 'Places',
      to: cat(byId('tourist-places')?.slug ?? 'tourist-places'),
      children: [
        { label: 'Tourist places & attractions', to: cat('tourist-places') },
        { label: 'Museums & art galleries', to: cat('museums-and-art-galleries') },
        { label: 'Parks & recreation', to: cat('parks-and-recreation') },
        { label: 'Beaches', to: cat('beaches') },
        { label: 'Religious places', to: cat('religious-places') },
        { label: 'Art & culture', to: cat('art-and-culture') },
        { label: 'Sports & fitness', to: cat('sports-and-fitness') },
        { label: 'Browse by area', to: '/areas' },
      ],
    },
    { label: 'Events', to: '/events' },
    { label: 'Restaurants', to: cat('restaurants-and-cafes') },
    {
      label: 'Hotels',
      to: cat('hotels-and-accommodation'),
      children: [
        { label: 'Hotels & accommodation', to: cat('hotels-and-accommodation') },
        { label: 'Wedding & event venues', to: cat('wedding-and-event-venues') },
      ],
    },
    { label: 'Shopping', to: cat('shopping-and-markets') },
    {
      label: 'Services',
      to: '/services',
      children: [
        { label: 'Hospitals & healthcare', to: cat('hospitals-and-healthcare') },
        { label: 'Doctors & clinics', to: cat('doctors-and-clinics') },
        { label: 'Pharmacies & laboratories', to: cat('pharmacies-and-laboratories') },
        { label: 'Universities & colleges', to: cat('universities-and-colleges') },
        { label: 'Schools & institutes', to: cat('schools-and-institutes') },
        { label: 'Transport & travel', to: cat('transport-and-travel') },
        { label: 'Government offices', to: cat('government-offices') },
        { label: 'Emergency services', to: cat('emergency-services') },
        { label: 'Professional & local services', to: cat('professional-and-local-services') },
      ],
    },
    { label: 'Map', to: '/map' },
    {
      label: 'About',
      to: '/about',
      children: [
        { label: 'About Karachify', to: '/about' },
        { label: 'Contact us', to: '/contact' },
        { label: 'Advertise with us', to: '/advertise' },
        { label: 'List your business', to: '/list-your-business' },
        { label: 'Submit an event', to: '/submit-event' },
        { label: 'Help centre & FAQ', to: '/help' },
        { label: 'Sources & verification', to: '/sources' },
        { label: 'Image credits', to: '/image-credits' },
        { label: 'Privacy policy', to: '/privacy' },
        { label: 'Terms & conditions', to: '/terms' },
      ],
    },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpenMenu(null);
    setMobile(false);
    setAccount(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.style.overflow = mobile ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobile]);

  const hoverOpen = (label: string) => {
    window.clearTimeout(closeTimer.current);
    setOpenMenu(label);
  };
  const hoverClose = () => {
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 140);
  };

  const favourites = prefsFor(db).favouriteListings.length;

  return (
    <>
      <div className="hidden bg-navy-800 text-white lg:block">
        <div className="shell flex items-center justify-between gap-6 py-1.5 text-[12.5px]">
          <p className="flex items-start gap-2 text-navy-100">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-300" />
            <span>
              Launch preview · <strong className="font-semibold text-white">{sourcedCount} destinations</strong> have a
              sourced address and OpenStreetMap pin with the date it was checked,{' '}
              <strong className="font-semibold text-white">{verifiedCount} of them</strong> also carry operator-published
              hours, admission and contacts; everything else is unconfirmed and generates no rating, review, price or
              opening hour.{' '}
              <Link to="/sources" className="font-semibold text-teal-200 underline underline-offset-2">
                See every source
              </Link>
            </span>
          </p>
          <div className="flex items-center gap-4">
            <Link to="/list-your-business" className="text-navy-100 hover:text-teal-200">
              List your business
            </Link>
            <span className="h-3 w-px bg-navy-600" />
            <Link to="/advertise" className="text-navy-100 hover:text-teal-200">
              Advertise
            </Link>
            <span className="h-3 w-px bg-navy-600" />
            <Link to="/admin" className="rounded-full bg-teal-500/15 px-2.5 py-1 font-semibold text-teal-200 hover:bg-teal-500/25">
              Admin
            </Link>
          </div>
        </div>
      </div>

      <header
        className={`sticky top-0 z-[60] border-b transition-all duration-300 ${
          scrolled ? 'border-navy-100 bg-white/95 shadow-card backdrop-blur' : 'border-transparent bg-white'
        }`}
      >
        <div className="shell flex h-16 items-center gap-3 lg:h-[68px] lg:gap-2 2xl:gap-3">
          <Link to="/" className="mr-1 shrink-0" aria-label="Karachify home">
            <BrandLogo />
          </Link>

          <nav className="hidden items-center xl:flex" aria-label="Main">
            {nav.map((item) =>
              item.children ? (
                <div key={item.label} className="relative" onMouseEnter={() => hoverOpen(item.label)} onMouseLeave={hoverClose}>
                  <button
                    onClick={() => (openMenu === item.label ? setOpenMenu(null) : hoverOpen(item.label))}
                    aria-expanded={openMenu === item.label}
                    className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-semibold text-navy-700 hover:bg-navy-50 hover:text-navy-900 2xl:px-3 2xl:text-[14px]"
                  >
                    {item.label}
                    <ChevronDown className={`h-4 w-4 text-navy-400 transition-transform ${openMenu === item.label ? 'rotate-180' : ''}`} />
                  </button>
                  {openMenu === item.label && (
                    <div className="absolute left-0 top-[calc(100%+6px)] w-[318px] rounded-2xl border border-navy-100 bg-white p-2 shadow-lift animate-fade-up">
                      {item.children.map((child) => (
                        <Link
                          key={child.to + child.label}
                          to={child.to}
                          className="group block rounded-xl px-3 py-2.5 hover:bg-mist"
                        >
                          <span className="block text-[14px] font-semibold text-navy-800 group-hover:text-teal-700">{child.label}</span>
                          {child.note && <span className="mt-0.5 block text-[12.5px] text-navy-400">{child.note}</span>}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-semibold transition-colors 2xl:px-3 2xl:text-[14px] ${
                      isActive && item.to !== '/' ? 'bg-navy-50 text-teal-700' : 'text-navy-700 hover:bg-navy-50 hover:text-navy-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>

          <div className="ml-auto hidden min-w-[150px] flex-1 items-center justify-end gap-2 lg:flex xl:max-w-[210px] 2xl:min-w-[170px] 2xl:max-w-[320px]">
            <SearchBox variant="header" placeholder="Search Karachi..." />
          </div>

          <button className="ml-auto rounded-full p-2 text-navy-700 hover:bg-navy-50 lg:hidden" onClick={() => setMobileSearch((s) => !s)} aria-label="Open search">
            <Search className="h-5 w-5" />
          </button>

          <button className="hidden rounded-full p-2 text-navy-700 hover:bg-navy-50 lg:block" onClick={() => navigate('/saved')} aria-label={`Favourites (${favourites})`}>
            <span className="relative block">
              <Heart className="h-5 w-5" />
              {favourites > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-white">
                  {favourites}
                </span>
              )}
            </span>
          </button>

          {user ? (
            <div className="relative hidden lg:block">
              <button
                onClick={() => setAccount((a) => !a)}
                className="flex items-center gap-2 rounded-full border border-navy-100 py-1 pl-1 pr-3 hover:border-teal-300"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-800 text-[12px] font-bold text-white">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[92px] truncate text-[13px] font-semibold text-navy-800">{user.name.split(' ')[0]}</span>
                <ChevronDown className="h-4 w-4 text-navy-400" />
              </button>
              {account && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-2xl border border-navy-100 bg-white p-2 shadow-lift animate-fade-up">
                  <p className="px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-navy-400">{user.role} account</p>
                  <Link to="/profile" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-800 hover:bg-mist">
                    <User className="h-4 w-4 text-teal-600" /> My profile
                  </Link>
                  <Link to="/saved" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-800 hover:bg-mist">
                    <Heart className="h-4 w-4 text-teal-600" /> Favourites
                  </Link>
                  <Link to="/dashboard" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-800 hover:bg-mist">
                    <Plus className="h-4 w-4 text-teal-600" /> My submissions
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-800 hover:bg-mist">
                      <LayoutDashboard className="h-4 w-4 text-teal-600" /> Admin dashboard
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      actions.logout();
                      setAccount(false);
                      navigate('/');
                    }}
                    className="mt-1 flex w-full items-center gap-2.5 rounded-xl border-t border-navy-100 px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Link to="/login" className="btn-ghost btn-sm">
                Log in
              </Link>
              <Link to="/signup" className="btn-primary btn-sm">
                Sign up
              </Link>
            </div>
          )}

          <button
            className="rounded-xl border border-navy-100 p-2 text-navy-800 xl:hidden"
            onClick={() => setMobile((m) => !m)}
            aria-label={mobile ? 'Close menu' : 'Open menu'}
            aria-expanded={mobile}
          >
            {mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileSearch && (
          <div className="border-t border-navy-100 bg-white px-4 py-3 lg:hidden">
            <SearchBox variant="page" placeholder="Search places, food, events..." />
          </div>
        )}
      </header>

      {mobile && (
        <div className="fixed inset-0 top-16 z-[55] overflow-y-auto bg-white xl:hidden">
          <nav className="px-4 py-4" aria-label="Mobile">
            {nav.map((item) => (
              <MobileNode key={item.label} item={item} />
            ))}
            <div className="mt-5 grid gap-2 border-t border-navy-100 pt-5">
              {user ? (
                <>
                  <Link to="/profile" className="btn-outline justify-start">
                    <User className="h-4 w-4" /> {user.name}
                  </Link>
                  <Link to="/saved" className="btn-outline justify-start">
                    <Heart className="h-4 w-4" /> Favourites ({favourites})
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin" className="btn-outline justify-start">
                      <LayoutDashboard className="h-4 w-4" /> Admin dashboard
                    </Link>
                  )}
                  <button
                    className="btn-ghost justify-start text-rose-600"
                    onClick={() => {
                      actions.logout();
                      setMobile(false);
                      navigate('/');
                    }}
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/signup" className="btn-primary justify-center">
                    Sign up free
                  </Link>
                  <Link to="/login" className="btn-outline justify-center">
                    Log in
                  </Link>
                </>
              )}
              <Link to="/map" className="btn-ghost justify-start">
                <MapIcon className="h-4 w-4" /> Explore map
              </Link>
            </div>
            <p className="mt-5 rounded-xl bg-mist px-4 py-3 text-[12.5px] leading-relaxed text-navy-500">
              Karachify publishes three kinds of record: {verifiedCount} destinations whose address, hours, admission and
              contacts all come from a named source with the date it was checked; {sourcedCount - verifiedCount} more
              whose location and address are sourced but whose practical details are not; and the rest of the directory,
              which has not been confirmed against a source at all — so the site invents no price, rating or review for
              any of it.
            </p>
          </nav>
        </div>
      )}
    </>
  );
}

function MobileNode({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  if (!item.children) {
    return (
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          `block rounded-xl px-3 py-3 text-[15px] font-bold ${isActive && item.to !== '/' ? 'bg-mist text-teal-700' : 'text-navy-800'}`
        }
      >
        {item.label}
      </NavLink>
    );
  }
  return (
    <div className="border-b border-navy-50">
      <div className="flex items-center justify-between">
        <Link to={item.to} className="block flex-1 rounded-xl px-3 py-3 text-[15px] font-bold text-navy-800">
          {item.label}
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={`Toggle ${item.label} submenu`}
          aria-expanded={open}
          aria-controls={`submenu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          className="p-2 text-navy-500"
        >
          <ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div id={`submenu-${item.label.toLowerCase().replace(/\s+/g, '-')}`} className="pb-2 pl-3">
          {item.children.map((c) => (
            <Link key={c.to + c.label} to={c.to} className="block rounded-lg px-3 py-2.5 text-[14px] font-medium text-navy-600 hover:bg-mist">
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
