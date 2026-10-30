import { Link } from 'react-router-dom';
import { Compass, MapPin, Search } from 'lucide-react';
import { selectCategories, useDB } from '../lib/store';
import { SearchBox } from '../components/SearchBox';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export default function NotFound() {
  useDocumentTitle('Page not found');
  const db = useDB();
  const top = selectCategories(db).slice(0, 8);

  return (
    <div className="shell section">
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy-50">
          <Compass className="h-7 w-7 text-navy-500" />
        </span>
        <p className="eyebrow mt-5">404 — off the map</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold text-navy-800">That page is not in Karachi</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-navy-500">
          The link is broken, the record was deleted, or the address never existed. Nothing was invented to fill this gap —
          search the real dataset instead.
        </p>

        <div className="mx-auto mt-7 max-w-xl">
          <SearchBox variant="page" placeholder="Search places, restaurants, events, areas…" />
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary">
            <Search className="h-4 w-4" /> Back to the homepage
          </Link>
          <Link to="/explore" className="btn-outline">
            <MapPin className="h-4 w-4" /> Explore Karachi
          </Link>
          <Link to="/map" className="btn-outline">
            Open the map
          </Link>
        </div>

        <div className="card mt-10 p-6 text-left">
          <h2 className="font-display text-[17px] font-bold text-navy-800">Popular categories</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {top.map((c) => (
              <li key={c.id}>
                <Link to={`/category/${c.slug}`} className="link text-sm">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-sm text-navy-500">
          Broken link on our side?{' '}
          <Link to="/contact" className="link">
            Tell us the address
          </Link>{' '}
          and we will fix the route.
        </p>
      </div>
    </div>
  );
}
