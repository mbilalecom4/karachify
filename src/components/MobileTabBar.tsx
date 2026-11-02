import { NavLink } from 'react-router-dom';
import { CalendarRange, Compass, Home, Map as MapIcon, Search } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/map', label: 'Map', icon: MapIcon },
  { to: '/plan', label: 'Plan', icon: CalendarRange },
  { to: '/search', label: 'Search', icon: Search },
];

export function MobileTabBar() {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-navy-100 bg-white lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-[560px] items-stretch">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-teal-700' : 'text-navy-500 hover:text-navy-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <t.icon className={`h-5 w-5 ${isActive ? 'text-teal-600' : 'text-navy-400'}`} />
                  {t.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
