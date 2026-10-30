import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, LogIn, ShieldCheck } from 'lucide-react';
import { actions, currentUser, useDB } from '../lib/store';
import { Field, TextInput, useToast } from '../components/ui';
import { Note } from '../components/Page';
import { isValidEmail } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export default function Login() {
  useDocumentTitle('Log in');
  const db = useDB();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (currentUser(db)) {
    return (
      <div className="shell section">
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="font-display text-xl font-bold text-navy-800">You are already signed in</h1>
          <p className="mt-2 text-sm text-navy-500">Demo accounts are stored in this browser only.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link to="/profile" className="btn-primary">
              Open profile
            </Link>
            <button
              className="btn-outline"
              onClick={() => {
                actions.logout();
                toast.push('Signed out of the demo session', 'info');
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell section">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <form
          className="card p-6 sm:p-8"
          onSubmit={(e) => {
            e.preventDefault();
            const next: Record<string, string> = {};
            if (!isValidEmail(email)) next.email = 'Enter the email you signed up with';
            if (passcode.length < 4) next.passcode = 'Passcode must be at least 4 characters';
            setErrors(next);
            if (Object.keys(next).length) return;
            const res = actions.login(email, passcode);
            if (!res.ok) {
              setErrors({ passcode: res.error });
              return;
            }
            toast.push(`Welcome back, ${res.user.name.split(' ')[0]} (demo session)`);
            navigate(res.user.role === 'admin' ? '/admin' : '/profile');
          }}
        >
          <p className="eyebrow">Account</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-navy-800">Log in to Karachify</h1>
          <p className="mt-2 text-[15px] text-navy-500">
            Favourites, saved events and submissions are kept per account inside this browser.
          </p>

          <div className="mt-6 space-y-4">
            <Field label="Email" required error={errors.email}>
              <TextInput type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" error={Boolean(errors.email)} />
            </Field>
            <Field label="Passcode" required error={errors.passcode} hint="Demo passcodes are stored in plain text in localStorage. A real build uses Supabase Auth.">
              <TextInput type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} error={Boolean(errors.passcode)} />
            </Field>
          </div>

          <button type="submit" className="btn-primary mt-6 w-full">
            <LogIn className="h-4 w-4" /> Log in
          </button>
          <p className="mt-3 text-center text-sm text-navy-500">
            No account yet?{' '}
            <Link to="/signup" className="link">
              Sign up in 20 seconds
            </Link>
          </p>
        </form>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-navy-800">
              <Lock className="h-4 w-4 text-teal-600" /> Demo accounts
            </h2>
            <ul className="mt-3 space-y-3 text-sm">
              {[
                { role: 'Administrator', email: 'admin@karachify.demo', pass: 'admin123', to: '/admin' },
                { role: 'Business owner', email: 'owner@karachify.demo', pass: 'owner123', to: '/dashboard' },
              ].map((a) => (
                <li key={a.email} className="rounded-xl border border-navy-100 bg-mist p-3">
                  <p className="font-semibold text-navy-800">{a.role}</p>
                  <p className="mt-1 text-navy-600">
                    <button className="link" onClick={() => { setEmail(a.email); setPasscode(a.pass); }}>
                      Fill these in
                    </button>
                  </p>
                  <p className="mt-1 font-mono text-[12px] text-navy-500">{a.email} · {a.pass}</p>
                  <Link to={a.to} className="text-[13px] text-navy-500">
                    or open {a.to}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Note tone="warn">
            This is a functional demo, not authentication. Credentials never leave your machine and anyone using this
            browser can read them. Do not reuse a real password.
          </Note>
          <div className="card p-5">
            <p className="flex items-center gap-2 font-semibold text-navy-800">
              <ShieldCheck className="h-4 w-4 text-teal-600" /> What an account unlocks
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-navy-500">
              <li>Favourites and saved events on your profile</li>
              <li>Enquiry history for every form you submit</li>
              <li>Business owner dashboard with editing rights</li>
              <li>Admin CRUD when signed in as the admin demo user</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
