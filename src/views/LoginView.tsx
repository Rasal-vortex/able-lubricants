import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../services/api';

const features = [
  { icon: 'inventory_2', label: 'Inventory' },
  { icon: 'receipt_long', label: 'Billing' },
  { icon: 'bar_chart', label: 'Reports' },
];

export const LoginView: React.FC = () => {
  const { login } = useApp();
  const localCredentials = import.meta.env.DEV_LOGIN_CREDENTIALS;
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [email, setEmail] = useState(localCredentials?.ADMIN.email ?? '');
  const [password, setPassword] = useState(localCredentials?.ADMIN.password ?? '');
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="flex min-h-screen w-full items-center justify-center bg-[#f7f4ef] px-4 py-8 sm:px-8 sm:py-12">
      <section className="login-card-layout w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_70px_rgba(35,31,25,0.18)]">
        <div
          className="relative isolate flex min-h-[390px] flex-col justify-between overflow-hidden bg-[#111925] bg-cover bg-center px-7 py-8 text-white sm:px-10 sm:py-10 md:min-h-[620px] md:px-12 md:py-12"
          style={{ backgroundImage: "linear-gradient(180deg, rgba(9,14,22,.16), rgba(9,14,22,.28)), url('/assets/Golden%20Oil%20Waves%20on%20Dark%20Navy%20(2).png')" }}
        >
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#0c1420]/5 via-[#0c1420]/10 to-[#0c1420]/55" />
          <div className="relative z-10 max-w-md pt-4 sm:pt-8 md:pt-16">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#ffc329]">Store workspace</p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">Welcome back</h1>
            <span className="mt-5 block h-1.5 w-16 rounded-full bg-[#ffbd16]" />
            <p className="mt-5 max-w-sm text-lg leading-relaxed text-white/90 sm:text-xl">Sign in to access your workspace.</p>
          </div>

          <div className="relative z-10 mt-10 grid max-w-md grid-cols-3 gap-2.5 sm:gap-3">
            {features.map((feature) => (
              <div key={feature.label} className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.09] px-2 py-3 text-center shadow-sm backdrop-blur-sm sm:min-h-[98px]">
                <span aria-hidden="true" className="material-symbols-outlined text-[27px] text-[#ffc329]">{feature.icon}</span>
                <span className="text-sm font-medium text-white sm:text-base">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-center overflow-hidden bg-white px-6 py-9 sm:px-10 sm:py-12 lg:px-14">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-[#fff0c9] opacity-80 blur-[1px]" />
          <div className="relative z-10 w-full max-w-[430px]">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b37a00]">Able Lubes</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#17191d]">Sign in</h2>
              <p className="mt-2 text-base leading-relaxed text-[#68707d]">Choose your account type and enter your credentials.</p>
            </div>

            <div className="grid grid-cols-2 rounded-full bg-[#f0f1f4] p-1.5" role="group" aria-label="Account type">
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
                  className={`h-12 rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d99a00] sm:text-base ${role === accountRole ? 'bg-[#ffedbd] text-[#17191d] shadow-sm ring-1 ring-[#f3c64d]/70' : 'text-[#606775] hover:text-[#17191d]'}`}
                >
                  {accountRole === 'ADMIN' ? 'Admin' : 'Staff'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <label className="block space-y-2 text-sm font-semibold text-[#20242b]">
                Email
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-[54px] w-full rounded-xl border border-[#d9dde5] bg-white px-4 text-base font-normal text-[#1c2027] outline-none transition focus:border-[#d99a00] focus:ring-4 focus:ring-[#f8d46f]/25"
                  placeholder="Enter your email"
                />
              </label>

              <label className="block space-y-2 text-sm font-semibold text-[#20242b]">
                Password
                <span className="relative block">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-[54px] w-full rounded-xl border border-[#d9dde5] bg-white px-4 pr-14 text-base font-normal text-[#1c2027] outline-none transition focus:border-[#d99a00] focus:ring-4 focus:ring-[#f8d46f]/25"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-2 flex w-10 items-center justify-center rounded-lg text-[#69717e] transition hover:bg-[#f4f5f7] hover:text-[#22262d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d99a00]"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[22px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </span>
              </label>

              {error && <p role="alert" className="rounded-xl border border-[#f5c8c5] bg-[#fff0ef] px-4 py-3 text-sm text-[#a12620]">{error}</p>}

              <button type="submit" disabled={submitting} className="mt-2 flex h-[58px] w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#ffc329] to-[#f5ad00] text-base font-bold text-[#17191d] shadow-[0_8px_18px_rgba(216,157,14,.22)] transition hover:brightness-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b37a00] disabled:cursor-wait disabled:opacity-60">
                <span aria-hidden="true" className="material-symbols-outlined">login</span>
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
};
