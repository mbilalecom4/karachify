import provenanceData from '../data/provenance.json';

type ProvRecord = { published?: string[]; notFound?: string[] } | undefined;

const records = (provenanceData as unknown as { records: Record<string, ProvRecord> }).records;

/**
 * True when a citation-backed override actually shipped one of these fields.
 * A date on the record is not enough: a record whose only checked field is a
 * phone number still carries a seeded address, and calling that checked would
 * be a claim the citation does not support.
 */
export function fieldsChecked(slug: string, keys: string[]) {
  const published = records[slug]?.published ?? [];
  return keys.some((k) => published.includes(k));
}

/** True when a researcher looked for the field and recorded that no source states it. */
export function fieldsAbsent(slug: string, keys: string[]) {
  const missing = records[slug]?.notFound ?? [];
  return keys.some((k) => missing.includes(k));
}

/** Whether the pipeline ever touched this record at all. */
export function isAudited(slug: string) {
  return Boolean(records[slug]);
}
