import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../services/api';

export const LoginView: React.FC = () => {
  const { login } = useApp();
  const localCredentials = import.meta.env.DEV_LOGIN_CREDENTIALS;
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [email, setEmail] = useState(localCredentials?.ADMIN.email ?? '');
  const [password, setPassword] = useState(localCredentials?.ADMIN.password ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password, role);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-surface flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-[420px] rounded-xl border border-outline-variant bg-white p-7 shadow-sm">
        <div className="mb-7 flex items-center gap-3">
          <span className="material-symbols-outlined flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">tire_repair</span>
          <div>
            <h1 className="text-lg font-semibold text-on-surface">Able Lubes</h1>
            <p className="text-sm text-on-surface-variant">Inventory and billing</p>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-on-surface">Sign in</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Choose your account type and enter your credentials.</p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg bg-surface-container p-1" role="group" aria-label="Account type">
          {(['ADMIN', 'STAFF'] as const).map((accountRole) => (
            <button
              key={accountRole}
              type="button"
              aria-pressed={role === accountRole}
              onClick={() => {
                setRole(accountRole);
                setEmail(localCredentials?.[accountRole].email ?? '');
                setPassword(localCredentials?.[accountRole].password ?? '');
                setError('');
              }}
              className={`h-10 rounded-md text-sm font-medium transition-colors ${role === accountRole ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {accountRole === 'ADMIN' ? 'Admin' : 'Staff'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block space-y-1.5 text-sm font-medium text-on-surface">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-md border border-outline-variant bg-white px-3 font-normal focus:border-primary focus:outline-none"
              placeholder={role === 'ADMIN' ? 'Admin email' : 'Staff email'}
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-on-surface">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-md border border-outline-variant bg-white px-3 font-normal focus:border-primary focus:outline-none"
              placeholder="Enter your password"
            />
          </label>

          {error && <p role="alert" className="rounded-md bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}

          <button type="submit" disabled={submitting} className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
            {submitting ? 'Signing in…' : `Sign in as ${role === 'ADMIN' ? 'Admin' : 'Staff'}`}
          </button>
        </form>
      </section>
    </main>
  );
};
