export function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDayMonth(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
}

export function dateRange(start: string, end?: string) {
  if (!end || end === start) return formatDate(start);
  return `${formatDateShort(start)} → ${formatDateShort(end)}`;
}

export function timeRange(start: string, end: string) {
  if (!start && !end) return 'Time not stated';
  if (!start || !end) return start || end;
  return `${start} – ${end}`;
}

/** How a pin may be described: only an OSM-backed coordinate is called a position. */
export function pinCaption(coordsVerified?: boolean) {
  return coordsVerified ? 'OpenStreetMap position' : 'approximate position';
}

/**
 * The $ bands are only ever set by a business about itself (owner dashboard),
 * so the label says who is speaking rather than implying a measured price.
 * Verified admission prices come through `listing.entryFees` instead.
 */
export function priceLabel(range?: string) {
  switch (range) {
    case 'Free':
      return 'Free entry';
    case '$':
      return 'Budget — stated by the owner';
    case '$$':
      return 'Mid-range — stated by the owner';
    case '$$$':
      return 'Premium — stated by the owner';
    default:
      return 'Pricing to confirm';
  }
}

/**
 * One honest line for a card. Fee tables mix adults, children and per-ride
 * prices, so quoting the cheapest row would understate the visit: use the adult
 * or general row when the source names one, otherwise the lowest paid ticket.
 */
export function admissionLabel(fees?: { label: string; amount: number; basis: string }[]) {
  if (!fees?.length) return null;
  if (fees.every((f) => f.amount === 0)) return 'Free entry';
  const press = fees.every((f) => f.basis === 'press') ? ' (reported)' : '';
  const adult = fees.find((f) => /adult|general|entry/i.test(f.label));
  if (adult) return `Admission PKR ${adult.amount.toLocaleString('en-PK')}${press}`;
  const paid = fees.filter((f) => f.amount > 0).map((f) => f.amount);
  return `From PKR ${Math.min(...paid).toLocaleString('en-PK')}${press}`;
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count.toLocaleString('en-PK')} ${count === 1 ? one : many}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Slugs are how detail URLs resolve, so two records can never share one. */
export function uniqueSlug(taken: string[], desired: string) {
  const base = slugify(desired);
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function coordText(lat: number, lng: number) {
  return `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function directionsUrl(lat: number, lng: number, label?: string) {
  const dest = `${lat},${lng}`;
  const name = label ? `&destination=${encodeURIComponent(label)}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${name}&travelmode=driving`;
}

export function mapLinkUrl(lat: number, lng: number, label?: string) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}${label ? '' : ''}`;
}

export function calendarDownloadName(title: string) {
  return `${slugify(title)}.ics`;
}

export function toICS(event: {
  title: string;
  description: string;
  location: string;
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
}) {
  const day = (isoDate: string) => isoDate.replace(/-/g, '');
  /* A source that never stated a start time is recorded as an all-day event,
     not silently padded to midnight. */
  const timed = Boolean(event.startTime && event.endTime);
  const stamp = (isoDate: string, hhmm: string) => `${day(isoDate)}T${hhmm.replace(':', '')}00`;
  const dtstart = timed ? `DTSTART:${stamp(event.date, event.startTime)}` : `DTSTART;VALUE=DATE:${day(event.date)}`;
  const dtend = timed
    ? `DTEND:${stamp(event.endDate ?? event.date, event.endTime)}`
    : `DTEND;VALUE=DATE:${day(addOneDay(event.endDate ?? event.date))}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Karachify//Visit Karachi//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${day(event.date)}-${Math.random().toString(36).slice(2, 8)}@karachify`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    dtstart,
    dtend,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location.replace(/,/g, '\\,')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

function addOneDay(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function copyText(value: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  return new Promise<void>((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Deliberately loose: demo forms should not reject plausible Pakistani numbers. */
export function looksLikePhone(value: string) {
  return /^[+\d][\d\s-]{6,}$/.test(value.trim());
}

/** A published hours row that itself claims round-the-clock availability. */
export function aroundTheClock(hours?: { day: string; open: string }[]) {
  return (
    hours?.find((h) =>
      /\b24\s*(?:\/\s*7|hours?|h)\b|round[\s-]the[\s-]clock|open\s+all\s+night/i.test(h.open)
    ) ?? null
  );
}
