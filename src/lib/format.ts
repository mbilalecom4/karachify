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
  return `${start} – ${end}`;
}

export function priceLabel(range?: string) {
  switch (range) {
    case 'Free':
      return 'Free entry';
    case '$':
      return 'Under PKR 1,000 (demo)';
    case '$$':
      return 'PKR 1,000 – 3,000 (demo)';
    case '$$$':
      return 'PKR 3,000+ (demo)';
    default:
      return 'Pricing to confirm';
  }
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
  const stamp = (isoDate: string, hhmm: string) =>
    `${isoDate.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
  const dtstart = stamp(event.date, event.startTime);
  const dtend = stamp(event.endDate ?? event.date, event.endTime);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Karachify//Demo//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${dtstart}-${Math.random().toString(36).slice(2, 8)}@karachify.demo`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${event.title} (demo event)`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location.replace(/,/g, '\\,')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
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
