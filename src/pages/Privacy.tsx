import { Link } from 'react-router-dom';
import { PageHero, Prose } from '../components/Page';

export default function Privacy() {
  return (
    <>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi"
        eyebrow="Legal"
        title="Privacy notice"
        sub="Written for the build you are looking at: a static demo that stores everything in your own browser."
        trail={[{ label: 'Home', to: '/' }, { label: 'Privacy' }]}
        height="min-h-[220px] sm:min-h-[280px]"
      />
      <div className="shell section">
        <Prose className="mx-auto">
          <p className="text-sm text-navy-400">Last reviewed for this build: October 2026. Not legal advice.</p>
          <h2>The short version</h2>
          <p>
            Karachify, as deployed for this showcase, does not receive personal data. There is no server, no database on
            our side, no analytics script and no advertising tracker. Forms work, but their output stays on your device.
          </p>
          <h2>What is stored on your device</h2>
          <ul>
            <li>
              One document in <code>localStorage</code> under the key <code>karachify.db.v1</code> containing demo users,
              your favourites, saved events, recent searches, submissions and enquiries.
            </li>
            <li>Names, emails and phone numbers you type into forms — in plain text, on your machine only.</li>
          </ul>
          <p>
            Clearing site data for this origin removes all of it, and the profile page has a reset button that restores the
            shipped dataset.
          </p>
          <h2>Passwords and passcodes</h2>
          <p>
            Demo passcodes are not hashed and not verified against anything remote. They exist so the logged-in flows can
            be demonstrated. Please do not reuse a real password here.
          </p>
          <h2>Third-party requests</h2>
          <ul>
            <li>Photographs load from Wikimedia project domains, so those servers see a normal image request with this page as the referrer.</li>
            <li>Map tiles load from OpenStreetMap's public raster tile service for the demo map.</li>
            <li>
              The "Karachi weather" and "Prayer times" panels fetch from Open-Meteo and Aladhan. Both requests carry only
              the fixed coordinates of central Karachi that the site already publishes — no account, no name, nothing you
              typed — and your IP address is visible to those two servers as it is to any website you load.
            </li>
            <li>Fonts are loaded from Google Fonts when available and fall back to system fonts offline.</li>
            <li>
              What you have already loaded — the page, its photographs, the record files — is also kept on your own device
              by a service worker, so a returning visit or an installed app can open it without a connection. That copy
              never leaves the device, live weather and prayer figures are not part of it, and clearing site data removes
              it.
            </li>
          </ul>
          <p>
            No other network calls are made. Saved places, the day plan and anything written into a form stay in this
            browser. If this build is forked and pointed at a hosted backend such as Supabase, that provider's own terms
            begin to apply to whatever is sent to it.
          </p>
          <h2>Location</h2>
          <p>
            The site never asks for your geolocation. Map positions come from the coordinates stored with each record: an
            OpenStreetMap feature for a verified place, an offset from the locality centre for every other one, which is
            why each pin states which of the two it is.
          </p>
          <h2>Children</h2>
          <p>
            The demo is not directed at children and collects nothing from anyone. A production version would need its own
            assessment before accepting accounts from minors.
          </p>
          <h2>Changes</h2>
          <p>
            This notice describes the current build. If hosting, authentication or analytics are added, the sections above
            must be rewritten to match reality before launch — a privacy policy that describes a system that no longer
            exists is worse than none.
          </p>
          <h2>Questions</h2>
          <p>
            Use the <Link to="/contact" className="link">contact form</Link>. For a data request in a hosted deployment, we
            would verify the account first; here, the answer is simply: delete your browser data.
          </p>
        </Prose>
      </div>
    </>
  );
}
