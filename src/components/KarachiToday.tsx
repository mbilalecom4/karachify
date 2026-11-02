import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  RefreshCw,
  Sun,
  Wind,
} from 'lucide-react';
import { formatDayMonth } from '../lib/format';

/**
 * The only two numbers on this site that come from outside the dataset, and
 * both are live: they can fail, be late or be wrong for your street. So each
 * half states its source, its observation time and its limits, and neither
 * shows a figure it did not actually receive.
 */

/* Karachi centre. One reading for the whole city — say so rather than implying
   a per-area forecast. */
const LAT = 24.86;
const LNG = 67.01;

const OPEN_METEO =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}` +
  '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
  '&timezone=Asia%2FKarachi&forecast_days=3';

/* Method 2 is the University of Islamic Sciences, Karachi — the calculation
   Karachi masjids most often quote. */
const ALADHAN = (date: string) =>
  `https://api.aladhan.com/v1/timings/${date}?latitude=${LAT}&longitude=${LNG}&method=2`;

type Weather = {
  tempC: number;
  feelsC: number;
  humidity: number;
  windKph: number;
  code: number;
  observedAt: string;
  days: { date: string; min: number; max: number; code: number; rainChance: number | null }[];
};

type Prayers = { fajr: string; sunrise: string; dhuhr: string; asr: string; maghrib: string; isha: string };

/* Both APIs are rate-limited and the panel appears on two pages, so a module
   cache keeps one visit to one request per source. */
const TTL = 10 * 60 * 1000;
const cache: { weather?: { at: number; value: Weather }; prayers?: { at: number; value: Prayers } } = {};

async function getJSON(url: string, signal: AbortSignal): Promise<any> {
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function loadWeather(signal: AbortSignal): Promise<Weather> {
  const hit = cache.weather;
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const j = await getJSON(OPEN_METEO, signal);
  const c = j?.current;
  const d = j?.daily;
  if (!c || typeof c.temperature_2m !== 'number' || !Array.isArray(d?.time)) throw new Error('unexpected response');
  const value: Weather = {
    tempC: c.temperature_2m,
    feelsC: typeof c.apparent_temperature === 'number' ? c.apparent_temperature : c.temperature_2m,
    humidity: typeof c.relative_humidity_2m === 'number' ? c.relative_humidity_2m : NaN,
    windKph: typeof c.wind_speed_10m === 'number' ? c.wind_speed_10m : NaN,
    code: Number(c.weather_code),
    observedAt: String(c.time ?? ''),
    days: d.time.map((date: string, i: number) => ({
      date,
      min: Number(d.temperature_2m_min[i]),
      max: Number(d.temperature_2m_max[i]),
      code: Number(d.weather_code[i]),
      rainChance: Array.isArray(d.precipitation_probability_max) ? numOrNull(d.precipitation_probability_max[i]) : null,
    })),
  };
  cache.weather = { at: Date.now(), value };
  return value;
}

async function loadPrayers(signal: AbortSignal): Promise<Prayers> {
  const hit = cache.prayers;
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const j = await getJSON(ALADHAN(karachiDate()), signal);
  const t = j?.data?.timings;
  if (!t || !t.Fajr || !t.Isha) throw new Error('unexpected response');
  const value: Prayers = {
    fajr: hm(t.Fajr),
    sunrise: hm(t.Sunrise),
    dhuhr: hm(t.Dhuhr),
    asr: hm(t.Asr),
    maghrib: hm(t.Maghrib),
    isha: hm(t.Isha),
  };
  cache.prayers = { at: Date.now(), value };
  return value;
}

const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** "05:36+05:00" -> "05:36" */
function hm(value: unknown) {
  const m = String(value ?? '').match(/^\d{2}:\d{2}/);
  return m ? m[0] : '';
}

/** Today's date as Karachi counts it, not as the visitor's device does. */
function karachiDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}-${get('month')}-${get('year')}`;
}

const WMO: Record<number, { label: string; Icon: typeof Sun }> = {
  0: { label: 'Clear sky', Icon: Sun },
  1: { label: 'Mostly clear', Icon: Sun },
  2: { label: 'Partly cloudy', Icon: CloudSun },
  3: { label: 'Overcast', Icon: Cloud },
  45: { label: 'Fog', Icon: CloudFog },
  48: { label: 'Freezing fog', Icon: CloudFog },
  51: { label: 'Light drizzle', Icon: CloudDrizzle },
  53: { label: 'Drizzle', Icon: CloudDrizzle },
  55: { label: 'Heavy drizzle', Icon: CloudDrizzle },
  61: { label: 'Light rain', Icon: CloudRain },
  63: { label: 'Rain', Icon: CloudRain },
  65: { label: 'Heavy rain', Icon: CloudRain },
  71: { label: 'Light snow', Icon: CloudSnow },
  73: { label: 'Snow', Icon: CloudSnow },
  75: { label: 'Heavy snow', Icon: CloudSnow },
  80: { label: 'Rain showers', Icon: CloudRain },
  81: { label: 'Rain showers', Icon: CloudRain },
  82: { label: 'Violent showers', Icon: CloudRain },
  85: { label: 'Snow showers', Icon: CloudSnow },
  86: { label: 'Snow showers', Icon: CloudSnow },
  95: { label: 'Thunderstorm', Icon: CloudLightning },
  96: { label: 'Thunderstorm, hail', Icon: CloudLightning },
  99: { label: 'Thunderstorm, hail', Icon: CloudLightning },
};

const wmo = (code: number) => WMO[code] ?? { label: 'Unrecognised condition code', Icon: Cloud };

const tempText = (v: number) => (Number.isFinite(v) ? `${Math.round(v)}°` : '—');

function useLive<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [value, setValue] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    /* A request can stall — Open-Meteo did while this was being tested. Without
       a deadline the card sits on "Loading" forever, which reads as a working
       panel, so the timeout has to land in the same honest failure state. */
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ac.abort('karachify-live-timeout');
    }, 8000);
    setFailed(false);
    load(ac.signal)
      .then((v) => setValue(v))
      .catch((e: unknown) => {
        if (timedOut || (e as Error)?.name !== 'AbortError') setFailed(true);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { value, failed, loading: value === null && !failed, retry };
}

function TryAgain({ onRetry, what }: { onRetry: () => void; what: string }) {
  return (
    <div className="space-y-2">
      <p className="flex items-start gap-2 text-[13px] leading-snug text-navy-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>
          {what} did not load. Karachify keeps no figures of its own, so nothing is put in its place — a blank panel is
          truer than a number we made up.
        </span>
      </p>
      <button type="button" className="btn-outline btn-sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" /> Try again
      </button>
    </div>
  );
}

/* ------------------------------ weather card ------------------------------ */

function WeatherCard() {
  const { value, failed, loading, retry } = useLive(loadWeather);

  return (
    <div className="card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-teal-700">Karachi weather</p>
          <h3 className="mt-1 font-display text-[19px] font-bold leading-snug text-navy-800">Right now, city-wide</h3>
        </div>
        {value && <span className="chip bg-teal-50 text-teal-800">live</span>}
      </div>

      {loading && <p className="mt-4 text-[13px] text-navy-400">Loading…</p>}
      {failed && (
        <div className="mt-4">
          <TryAgain onRetry={retry} what="Open-Meteo" />
        </div>
      )}

      {value && (
        <>
          {(() => {
            const { label, Icon } = wmo(value.code);
            return (
              <div className="mt-4 flex items-center gap-4">
                <Icon className="h-11 w-11 shrink-0 text-teal-700" aria-hidden />
                <div>
                  <p className="font-display text-[34px] font-extrabold leading-none text-navy-900">
                    {tempText(value.tempC)}
                    <span className="ml-1 align-top text-[15px] font-bold text-navy-500">C</span>
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-navy-600">{label}</p>
                </div>
              </div>
            );
          })()}

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { k: 'Feels like', v: tempText(value.feelsC) },
              Number.isFinite(value.humidity) ? { k: 'Humidity', v: `${Math.round(value.humidity)}%`, Icon: Droplets } : null,
              Number.isFinite(value.windKph) ? { k: 'Wind', v: `${Math.round(value.windKph)} km/h`, Icon: Wind } : null,
            ]
              .filter(Boolean)
              .map((raw) => {
                const s = raw as { k: string; v: string; Icon?: typeof Sun };
                return (
                  <div key={s.k} className="rounded-xl bg-mist px-2 py-2.5">
                    <dt className="flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-navy-500">
                      {s.Icon && <s.Icon className="h-3 w-3" aria-hidden />}
                      {s.k}
                    </dt>
                    <dd className="mt-1 text-[15px] font-bold text-navy-800">{s.v}</dd>
                  </div>
                );
              })}
          </dl>

          <ul className="mt-4 divide-y divide-navy-100 border-y border-navy-100">
            {value.days.slice(0, 3).map((d) => {
              const { label, Icon } = wmo(d.code);
              return (
                <li key={d.date} className="flex items-center gap-2 py-2">
                  <Icon className="h-4 w-4 shrink-0 text-navy-400" aria-hidden />
                  <span className="w-[58px] shrink-0 text-[13px] font-semibold text-navy-700">{formatDayMonth(d.date)}</span>
                  <span className="flex-1 truncate text-[12.5px] text-navy-500">{label}</span>
                  <span className="text-[13px] font-bold text-navy-800">
                    {tempText(d.max)}
                    <span className="font-medium text-navy-400"> / {tempText(d.min)}</span>
                  </span>
                  {d.rainChance !== null && (
                    <span className="w-[54px] shrink-0 text-right text-[12px] font-semibold text-sky-700">{d.rainChance}% rain</span>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-[11.5px] leading-snug text-navy-400">
            Forecast for one point in central Karachi ({LAT.toFixed(2)}° N, {LNG.toFixed(2)}° E), not your street.
          </p>
        </>
      )}

      <p className="mt-auto pt-4 text-[11.5px] leading-snug text-navy-400">
        {value ? (
          <>
            As at {value.observedAt.slice(11, 16)} PKT ·{' '}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-teal-700 underline underline-offset-2"
            >
              Open-Meteo
            </a>
            , a free weather API. Karachify does not forecast.
          </>
        ) : (
          'Nothing here is cached from an earlier visit — if it did not load, the panel says so.'
        )}
      </p>
    </div>
  );
}

/* ------------------------------ prayer card ------------------------------- */

const PRAYER_ROWS: { key: keyof Prayers; label: string; prayer: boolean }[] = [
  { key: 'fajr', label: 'Fajr', prayer: true },
  { key: 'sunrise', label: 'Sunrise', prayer: false },
  { key: 'dhuhr', label: 'Dhuhr', prayer: true },
  { key: 'asr', label: 'Asr', prayer: true },
  { key: 'maghrib', label: 'Maghrib', prayer: true },
  { key: 'isha', label: 'Isha', prayer: true },
];

function PrayerCard() {
  const { value, failed, loading, retry } = useLive(loadPrayers);

  const nowInKarachi = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());

  const nextKey = (() => {
    if (!value) return null;
    const after = PRAYER_ROWS.filter((r) => r.prayer && value[r.key] > nowInKarachi);
    return after.length ? after[0].key : 'fajr';
  })();

  return (
    <div className="card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-teal-700">Prayer times</p>
          <h3 className="mt-1 font-display text-[19px] font-bold leading-snug text-navy-800">
            Karachi · {new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'long' }).format(new Date())}
          </h3>
        </div>
        {value && <CalendarDays className="h-5 w-5 shrink-0 text-navy-300" aria-hidden />}
      </div>

      {loading && <p className="mt-4 text-[13px] text-navy-400">Loading…</p>}
      {failed && (
        <div className="mt-4">
          <TryAgain onRetry={retry} what="The prayer-time calculation" />
        </div>
      )}

      {value && (
        <ul className="mt-4 divide-y divide-navy-100 border-y border-navy-100">
          {PRAYER_ROWS.map((r) => (
            <li
              key={r.key}
              className={`flex items-center justify-between gap-3 py-2 ${nextKey === r.key ? 'bg-teal-50' : ''}`}
            >
              <span className="pl-2 text-[13.5px] font-semibold text-navy-700">{r.label}</span>
              <span className="pr-2 flex items-center gap-2">
                {nextKey === r.key && (
                  <span className="text-[11px] font-bold uppercase tracking-wide text-teal-800">
                    {r.key === 'fajr' ? 'tomorrow' : 'next'}
                  </span>
                )}
                <span className="font-display text-[15px] font-bold tabular-nums text-navy-900">{value[r.key]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-auto pt-4 text-[11.5px] leading-snug text-navy-400">
        Calculated, not published: these come from{' '}
        <a
          href="https://aladhan.com/prayer-times"
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold text-teal-700 underline underline-offset-2"
        >
          Aladhan
        </a>{' '}
        using the University of Islamic Sciences, Karachi method for the city's coordinates. Masjids set their own
        times around this — confirm with the one you are praying at.
      </p>
    </div>
  );
}

/* --------------------------------- panel ---------------------------------- */

export function KarachiToday() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <WeatherCard />
      <PrayerCard />
    </div>
  );
}
