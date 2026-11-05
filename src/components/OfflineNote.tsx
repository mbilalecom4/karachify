import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CloudOff } from 'lucide-react';

/**
 * Says out loud when the page is not the live one.
 *
 * The service worker answers an offline reload from the copy it stored, which
 * is the point of installing the site — but a reader should never have to guess
 * whether what is in front of them is current. A message posted during a
 * navigation cannot reach the document being replaced, so this asks the worker
 * where the current address came from, once per page, and prints the answer.
 *
 * It never claims a time it does not have: a copy with no stamp is reported as
 * a copy, and a page the worker did not serve is reported only as offline.
 */
export function OfflineNote() {
  const { pathname } = useLocation();
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [fromCache, setFromCache] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      setFromCache(false);
      setSavedAt(null);
    };
    const onAnswer = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string; from?: string | null; at?: number | null };
      if (data?.type !== 'karachify:answer' || data.url !== location.href) return;
      setFromCache(data.from === 'cache');
      setSavedAt(typeof data.at === 'number' ? data.at : null);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    navigator.serviceWorker?.addEventListener('message', onAnswer);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      navigator.serviceWorker?.removeEventListener('message', onAnswer);
    };
  }, []);

  /*
   * Asked again on every page: the worker answers for an address, and the
   * answer for the last one says nothing about this one. Cleared first, so a
   * page the worker never served is not described by the previous page's copy.
   */
  useEffect(() => {
    setFromCache(false);
    setSavedAt(null);
    const ask = () => navigator.serviceWorker.controller?.postMessage({ type: 'karachify:why' });
    ask();
    const again = window.setTimeout(ask, 600);
    return () => window.clearTimeout(again);
  }, [pathname]);

  if (!offline && !fromCache) return null;

  const stamp = savedAt ? new Date(savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null;
  const savedLine = `This page came from the copy saved on your device${stamp ? ` on ${stamp}` : ''}. Reload when the site is reachable again for the current one.`;
  const line = offline
    ? fromCache
      ? `You are offline. ${savedLine} Its records, sources and labels are all here; live answers — weather, prayer times, whether a place is open right now — are not.`
      : 'You are offline. Pages you have opened before still load; live answers wait for a connection.'
    : savedLine;

  return (
    <div role="status" aria-live="polite" className="border-b border-navy-700 bg-navy-900 text-white">
      <div className="shell flex items-start gap-2.5 py-2.5">
        <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-navy-100">{line}</p>
      </div>
    </div>
  );
}
