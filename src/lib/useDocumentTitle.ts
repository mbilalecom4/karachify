import { useEffect } from 'react';
import { useDB } from './store';

/**
 * Keeps the browser tab in sync with the admin settings (site name + tagline),
 * so those fields change something a visitor can actually see.
 */
export function useDocumentTitle(page?: string) {
  const db = useDB();
  const siteName = db.settings.siteName.trim() || 'Karachify';
  const tagline = db.settings.tagline.trim();

  useEffect(() => {
    document.title = page ? `${page} · ${siteName}` : tagline ? `${siteName} — ${tagline}` : siteName;
  }, [page, siteName, tagline]);
}
