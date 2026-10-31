import { Link } from 'react-router-dom';
import { PageHero, Prose } from '../components/Page';

export default function Terms() {
  return (
    <>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi"
        eyebrow="Legal"
        title="Terms of use"
        sub="Plain terms for a demonstration platform — including the one thing you must not do with its content."
        trail={[{ label: 'Home', to: '/' }, { label: 'Terms' }]}
        height="min-h-[220px] sm:min-h-[280px]"
      />
      <div className="shell section">
        <Prose className="mx-auto">
          <p className="text-sm text-navy-400">Last reviewed for this build: October 2026. Not legal advice.</p>
          <h2>1. What this site is</h2>
          <p>
            Karachify here is a portfolio-grade demonstration of a Karachi city-discovery platform. It runs entirely in
            your browser. It is not a booking service, not an official tourism platform, and not a directory you can rely
            on to reach a business.
          </p>
          <h2>2. Verified and unverified records</h2>
          <p>
            A page badged <span className="badge-verified mx-0.5 align-middle">Verified</span> states the source it was
            built from and the date it was checked. A page badged
            <span className="badge-demo mx-0.5 align-middle">Not verified yet</span> is a real Karachi place whose details
            have not been checked — those records carry no star rating, no review count and no invented price band, and
            anything the source did not publish is left blank rather than guessed. Do not republish either kind as proof
            of a business’s current trading status; confirm with the operator before you travel.
          </p>
          <h2>3. Real places mentioned</h2>
          <p>
            Some records name genuine Karachi landmarks because a city index with invented names would not demonstrate
            anything. Names and photographs belong to their owners; their presence here does not imply endorsement,
            partnership or accuracy about their current trading status.
          </p>
          <h2>4. Photographs and third-party licences</h2>
          <p>
            Hotlinked images remain under the licences held by their authors and Wikimedia projects, with attribution
            listed on the <Link to="/image-credits" className="link">credits page</Link>. Interface design, copy and code
            in this project are the author's work; if you fork it, keep the attribution table with the images you reuse.
          </p>
          <h2>5. Your content</h2>
          <p>
            Anything you submit through the forms stays in your browser. You grant no licence because nothing is
            transmitted. In a hosted deployment, these terms would need a section on moderation, your right to delete your
            submissions, and how business claims are verified.
          </p>
          <h2>6. Acceptable use</h2>
          <ul>
            <li>Do not present unverified records as live information about a real business.</li>
            <li>Do not hammer the third-party services this page loads from — Wikimedia and OpenStreetMap tiles are shared public infrastructure.</li>
            <li>Do not use the admin dashboard as if it were access control; it is a UI demonstration with local storage and no server.</li>
          </ul>
          <h2>7. Disclaimer of warranty</h2>
          <p>
            The software is provided as-is, without warranty of any kind. Information may be inaccurate, incomplete or
            stale. Travel, health and legal decisions should be made from primary sources — a hospital's own published
            number, not a directory entry.
          </p>
          <h2>8. Liability</h2>
          <p>
            The author accepts no liability for losses arising from reliance on this demonstration, including losses caused
            by treating sample listings, timings or coordinates as real.
          </p>
          <h2>9. Takedown and corrections</h2>
          <p>
            If you represent a business or photograph rightsholder and want a record changed or removed, use the{' '}
            <Link to="/contact" className="link">contact form</Link>. In this static build the fastest fix is a new deploy
            — say so in the message and the record can be dropped from the dataset.
          </p>
          <h2>10. Changes to these terms</h2>
          <p>
            Continuing to use the site after this page is updated means the newer text applies. A hosted version would
            notify registered users before material changes take effect.
          </p>
        </Prose>
      </div>
    </>
  );
}
