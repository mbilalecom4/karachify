import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, CalendarCheck, UserPlus } from 'lucide-react';
import { actions, currentUser, useDB } from '../lib/store';
import { Field, TextInput, Select, useToast } from '../components/ui';
import { Note } from '../components/Page';
import { isValidEmail } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export default function Signup() {
  useDocumentTitle('Create a demo account');
  const db = useDB();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', passcode: '', confirm: '', role: 'user' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (currentUser(db)) {
    return (
      <div className="shell section">
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="font-display text-xl font-bold text-navy-800">You already have a demo session open</h1>
          <p className="mt-2 text-sm text-navy-500">Sign out first if you want to create a different demo account.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link to="/profile" className="btn-primary">
              Open profile
            </Link>
            <button
              className="btn-outline"
              onClick={() => {
                actions.logout();
                toast.push('Signed out — you can create a new demo account', 'info');
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
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <form
          className="card p-6 sm:p-8"
          onSubmit={(e) => {
            e.preventDefault();
            const next: Record<string, string> = {};
            if (form.name.trim().length < 2) next.name = 'Tell us what to call you';
            if (!isValidEmail(form.email)) next.email = 'That does not look like an email address';
            if (form.passcode.length < 6) next.passcode = 'Use at least 6 characters';
            if (form.confirm !== form.passcode) next.confirm = 'Passcodes do not match';
            setErrors(next);
            if (Object.keys(next).length) return;

            const res = actions.signup({
              name: form.name,
              email: form.email,
              passcode: form.passcode,
              role: form.role === 'owner' ? 'owner' : 'user',
            });
            if (!res.ok) {
              setErrors({ email: res.error });
              return;
            }
            toast.push(`Account created — welcome, ${res.user.name.split(' ')[0]} (demo)`);
            navigate(res.user.role === 'owner' ? '/dashboard' : '/profile');
          }}
        >
          <p className="eyebrow">Account</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-navy-800">Create your Karachify demo account</h1>
          <p className="mt-2 text-[15px] text-navy-500">
            It keeps your favourites, saved events and submissions together. Nothing is sent anywhere — the account
            lives in this browser.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Your name" required error={errors.name} className="sm:col-span-2">
              <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ayesha Khan" error={Boolean(errors.name)} />
            </Field>
            <Field label="Email" required error={errors.email} className="sm:col-span-2">
              <TextInput type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" error={Boolean(errors.email)} />
            </Field>
            <Field label="Passcode" required error={errors.passcode}>
              <TextInput type="password" autoComplete="new-password" value={form.passcode} onChange={(e) => set('passcode', e.target.value)} error={Boolean(errors.passcode)} />
            </Field>
            <Field label="Confirm passcode" required error={errors.confirm}>
              <TextInput type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} error={Boolean(errors.confirm)} />
            </Field>
            <Field label="I am signing up as" hint="Owner accounts get access to the business dashboard." className="sm:col-span-2">
              <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
                <option value="user">A Karachi explorer</option>
                <option value="owner">A business owner</option>
              </Select>
            </Field>
          </div>

          <button type="submit" className="btn-primary mt-6 w-full">
            <UserPlus className="h-4 w-4" /> Create demo account
          </button>
          <p className="mt-3 text-center text-sm text-navy-500">
            Already have one?{' '}
            <Link to="/login" className="link">
              Log in
            </Link>
          </p>
        </form>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="font-display text-[17px] font-bold text-navy-800">What you get</h2>
            <ul className="mt-3 space-y-3 text-sm text-navy-600">
              <li className="flex gap-2.5">
                <Heart className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /> Favourites that survive a page reload
              </li>
              <li className="flex gap-2.5">
                <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> Saved events with one-tap calendar files
              </li>
              <li className="flex gap-2.5">
                <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-navy-500" /> Enquiry history for every form you submit
              </li>
            </ul>
          </div>
          <Note tone="warn">
            No email is verified and no password is hashed — this is a UI demo running entirely on your machine. Do not
            reuse a real password.
          </Note>
          <div className="card p-5">
            <p className="text-sm font-semibold text-navy-800">Prefer not to sign up?</p>
            <p className="mt-1.5 text-sm text-navy-500">
              Browsing, search, filters, map and every listing page work as a guest. Favourites are kept under a guest
              profile in this browser.
            </p>
            <Link to="/" className="btn-outline mt-4 w-full">
              Back to the homepage
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
