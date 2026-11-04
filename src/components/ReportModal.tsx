import { useState } from 'react';
import { Flag, Github } from 'lucide-react';
import type { Listing } from '../types';
import { actions } from '../lib/store';
import { coordText, isValidEmail } from '../lib/format';
import { listingHref } from '../lib/openRecords';
import { shareUrl } from '../lib/pageMeta';
import { Note } from './Page';
import { Field, Modal, Select, TextArea, TextInput, useToast } from './ui';

const REPORT_REASONS = [
  'The map pin is in the wrong place',
  'The address is wrong or incomplete',
  'It has closed, moved or changed name',
  'A phone number, website or opening hour is wrong',
  'A photograph is not this place',
  'Something else about this record',
];

/**
 * Reporting has two honest routes and the modal names both: this build has no
 * server, so a form can only ever file on the visitor's own device. The issue
 * link is the one that actually reaches whoever maintains the data.
 */
export function ReportModal({ open, onClose, listing }: { open: boolean; onClose: () => void; listing: Listing }) {
  const toast = useToast();
  const [form, setForm] = useState({ reason: REPORT_REASONS[0], details: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* The published URL of this page, not window.location: a report filed while
     testing on a laptop must not cite an address nobody else can open. */
  const pageUrl = shareUrl(listingHref(listing));
  const issueUrl = () => {
    const body = [
      `**Place:** ${listing.name}`,
      `**Page:** ${pageUrl}`,
      `**What looks wrong:** ${form.reason}`,
      form.details.trim() ? `**Details:** ${form.details.trim()}` : '',
      `**Address shown:** ${listing.address ?? 'not stated'}`,
      `**Map position shown:** ${coordText(listing.lat, listing.lng)}${
        listing.coordsVerified ? ' (recorded as an OpenStreetMap position)' : ' (approximate, derived from the area centre)'
      }`,
      listing.lastVerified ? `**Last checked:** ${listing.lastVerified}` : '',
      '',
      'Filed from the Karachify listing page.',
    ]
      .filter(Boolean)
      .join('\n');
    return `https://github.com/mbilalecom4/karachify/issues/new?title=${encodeURIComponent(
      `Data problem: ${listing.name}`
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Modal open={open} onClose={onClose} title={`Report a problem · ${listing.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const next: Record<string, string> = {};
          if (form.details.trim().length < 10) next.details = 'Say what is wrong in at least a few words';
          if (form.email.trim() && !isValidEmail(form.email)) next.email = 'Enter a valid email, or leave it blank';
          setErrors(next);
          if (Object.keys(next).length) return;
          actions.addSubmission({
            kind: 'report',
            name: `${listing.name} — ${form.reason}`,
            categoryId: listing.categoryId,
            areaId: listing.areaId,
            listingId: listing.id,
            email: form.email.trim() || undefined,
            description: form.details.trim(),
          });
          onClose();
          setForm({ reason: REPORT_REASONS[0], details: '', email: '' });
          toast.push('Filed on this device — use the issue link below to send it to us as well', 'info');
        }}
        className="space-y-4"
      >
        <Note>
          This build has no server, so nothing here can be emailed. Filing saves the report into the review queue in <em>this</em>{' '}
          browser, where the admin screen shows it — useful for the owner of this device, useless for telling us. To actually reach the
          people who edit this data, send the second option: it opens a prefilled issue on the public Karachify repository and needs a
          free GitHub account.
        </Note>
        <Field label="What is wrong?">
          <Select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
            {REPORT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="What should it say instead?"
          required
          error={errors.details}
          hint="An address, a phone number, a closing date — whatever you know first hand."
        >
          <TextArea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} error={Boolean(errors.details)} />
        </Field>
        <Field label="Your email (optional)" error={errors.email} hint="Only so a follow-up question can reach you.">
          <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={Boolean(errors.email)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary">
            <Flag className="h-3.5 w-3.5" /> File on this device
          </button>
          <a href={issueUrl()} target="_blank" rel="noopener noreferrer" className="btn-outline">
            <Github className="h-3.5 w-3.5" /> Send it to us as an issue
          </a>
        </div>
      </form>
    </Modal>
  );
}
