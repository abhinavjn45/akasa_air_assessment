import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [notice, setNotice] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    setNotice('Sign-in is not available yet. Authentication is still being set up.');
  }

  function handleForgotPassword(event) {
    event.preventDefault();
    setNotice('Password reset is not available yet. Please contact your administrator.');
  }

  return (
    <main className="login-background relative isolate flex h-screen overflow-y-auto bg-canvas px-6 py-6">
      <section
        className="relative z-10 m-auto w-full max-w-[440px] rounded-lg border border-line bg-surface p-8 shadow-[0_14px_42px_rgba(74,48,32,0.08)] sm:p-10"
        aria-labelledby="sign-in-heading"
      >
        <div className="mb-9 text-center">
          <p className="text-2xl font-semibold tracking-tight text-ink">Leave Tracker</p>
          <span aria-hidden="true" className="mx-auto mt-3 block h-1 w-10 rounded-sm bg-brand-orange" />
        </div>

        <h1 id="sign-in-heading" className="mb-7 text-2xl font-semibold tracking-tight text-ink">
          Sign in
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-ink">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              required
              className="form-input"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <label htmlFor="password" className="text-sm font-medium text-ink">
                Password
              </label>
              <a
                href="#password-help"
                onClick={handleForgotPassword}
                className="rounded-sm text-sm font-medium text-link hover:text-link-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                className="form-input pr-14"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-slate-500 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-focus"
              >
                {showPassword ? <EyeOff size={19} strokeWidth={1.75} /> : <Eye size={19} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name="rememberMe"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            Remember me
          </label>

          {notice && (
            <div id="password-help" role="status" className="rounded-md border border-line bg-surface px-4 py-3 text-sm leading-6 text-muted">
              {notice}
            </div>
          )}

          <button
            type="submit"
            className="min-h-12 w-full rounded-md bg-brand-orange px-4 py-3 text-sm text-white font-semibold text-ink transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Log in
          </button>
        </form>
      </section>
    </main>
  );
}
