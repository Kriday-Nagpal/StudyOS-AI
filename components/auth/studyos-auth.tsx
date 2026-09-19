'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import ParticleDrift from '@/components/ui/particle-drift';
import { getSupabaseClient } from '@/lib/supabase';

type Mode = 'signin' | 'signup';

function friendlyAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes('invalid login')) return 'The email or password is incorrect.';
  if (value.includes('already registered')) return 'An account already exists for this email.';
  if (value.includes('email not confirmed')) return 'Verify your email first, then sign in again.';
  if (value.includes('password')) return 'Please check your password and try again.';
  if (value.includes('provider') && (value.includes('disabled') || value.includes('not enabled'))) {
    return 'Google sign-in is not enabled for this StudyOS project yet.';
  }
  if (value.includes('redirect')) return 'The sign-in redirect is not approved yet for this StudyOS URL.';
  return "We couldn't complete that request. Please try again.";
}

function safeDestination(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/app';
  return value;
}

export default function StudyOSAuth({ initialMode = 'signin', initialError = '' }: { initialMode?: Mode; initialError?: string }) {
  const supabase = getSupabaseClient();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [forgot, setForgot] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState('');

  const callbackUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/auth';
    const current = new URL(window.location.href);
    const url = new URL('/auth', window.location.origin);
    url.searchParams.set('next', safeDestination(current.searchParams.get('next')));
    return url.toString();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const params = new URL(window.location.href).searchParams;
    let active = true;

    void (async () => {
      const code = params.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && active) {
          setError(friendlyAuthError(exchangeError.message));
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session && active && !recovery) {
        const destination = safeDestination(params.get('next'));
        window.location.replace(destination);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
        setForgot(false);
        setError('');
        setMessage('');
        return;
      }
      if (event === 'SIGNED_IN' && session && !recovery) {
        window.location.replace(safeDestination(new URL(window.location.href).searchParams.get('next')));
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, recovery]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setPending(true);
    setError('');
    setMessage('');

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    const result =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: callbackUrl },
          });

    setPending(false);

    if (result.error) {
      setError(friendlyAuthError(result.error.message));
      return;
    }

    if (result.data.session) {
      window.location.replace('/app');
      return;
    }

    setMessage('Check your email to verify your StudyOS account. The verification link will return you here.');
  }

  async function google() {
    if (!supabase) return;
    setPending(true);
    setError('');
    setMessage('');

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (oauthError) {
      setPending(false);
      setError(friendlyAuthError(oauthError.message));
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setPending(true);
    setError('');
    setMessage('');

    const email = String(new FormData(event.currentTarget).get('email') || '').trim();
    const redirectTo = typeof window === 'undefined' ? callbackUrl : new URL('/auth', window.location.origin).toString();

    const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setPending(false);

    if (result.error) {
      setError(friendlyAuthError(result.error.message));
      return;
    }

    setMessage('Check your email for a secure StudyOS password reset link.');
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setPending(true);
    setError('');
    setMessage('');

    const password = String(new FormData(event.currentTarget).get('password') || '');
    const result = await supabase.auth.updateUser({ password });
    setPending(false);

    if (result.error) {
      setError(friendlyAuthError(result.error.message));
      return;
    }

    setMessage('Password updated. Taking you back to StudyOS…');
    setTimeout(() => window.location.replace('/app'), 700);
  }

  const title = recovery
    ? 'Choose a new password'
    : forgot
      ? 'Reset your password'
      : mode === 'signin'
        ? 'Welcome back'
        : 'Create your StudyOS';

  const copy = recovery
    ? 'Set a new password for your private academic workspace.'
    : forgot
      ? 'We’ll send a secure reset link to your email.'
      : mode === 'signin'
        ? 'Continue to your private academic operating system.'
        : 'Start with a clean workspace and no fabricated study data.';

  return (
    <main className="grid min-h-screen bg-[#f7f7fb] text-[#171522] lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-white/8 bg-black p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <ParticleDrift className="absolute inset-0 h-full w-full opacity-75" speed={0.48} density={0.68} opacity={0.54} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(105,78,230,.20),transparent_34%),linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.78))]" />

        <Link href="/" className="relative z-10 flex items-center gap-3 text-sm font-semibold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06]">
            <Sparkles className="size-4 text-violet-200" />
          </span>
          StudyOS <span className="font-light text-white/45">AI</span>
        </Link>

        <div className="relative z-10 max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[.20em] text-violet-200/70">A private academic operating system</p>
          <h1 className="mt-5 text-5xl font-extralight leading-[1.03] tracking-[-.045em]">
            Every study decision,
            <span className="block text-white/35">connected to real academic context.</span>
          </h1>
          <div className="mt-9 grid gap-4 text-sm font-light text-white/48">
            {[
              'Fresh accounts start without fake marks, plans or progress',
              'Uploaded school documents remain private to your account',
              'Uncertain AI extraction waits for your confirmation',
            ].map((item) => (
              <p key={item} className="flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-full border border-violet-200/10 bg-violet-200/[0.04]">
                  <Check className="size-3.5 text-violet-200" />
                </span>
                {item}
              </p>
            ))}
          </div>
        </div>

        <p className="relative z-10 flex items-center gap-2 text-xs font-light text-white/35">
          <LockKeyhole className="size-4" />
          Private by default · Source-aware academic data
        </p>
      </section>

      <section className="grid min-h-screen place-items-center bg-[#f8f8fb] p-5 sm:p-8">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-[#8c8898] transition hover:text-[#292536]">
            <ArrowLeft className="size-4" />
            Back to StudyOS
          </Link>

          <div className="mb-8 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2 font-semibold">
              <span className="grid size-8 place-items-center rounded-lg bg-[#6654d7] text-white">
                <Sparkles className="size-4" />
              </span>
              StudyOS AI
            </div>
            <span className="rounded-full border border-[#e5e2ef] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#8d879a]">
              Private workspace
            </span>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-[#e8e4f5] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#7568b6] shadow-sm">
            <ShieldCheck className="size-3.5" />
            Secure access
          </span>

          <h2 className="mt-5 text-3xl font-semibold tracking-[-.035em]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#868190]">{copy}</p>

          {recovery ? (
            <form onSubmit={updatePassword} className="mt-8 space-y-4">
              <PasswordField show={showPassword} setShow={setShowPassword} autoComplete="new-password" />
              {error ? <Alert tone="error">{error}</Alert> : null}
              {message ? <Alert tone="success">{message}</Alert> : null}
              <button
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#211d31] text-sm font-semibold text-white transition hover:bg-[#2b2540] disabled:opacity-50"
                disabled={pending}
              >
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Update password
              </button>
            </form>
          ) : forgot ? (
            <form onSubmit={resetPassword} className="mt-8 space-y-4">
              <EmailField />
              {error ? <Alert tone="error">{error}</Alert> : null}
              {message ? <Alert tone="success">{message}</Alert> : null}
              <button
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#211d31] text-sm font-semibold text-white transition hover:bg-[#2b2540] disabled:opacity-50"
                disabled={pending}
              >
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />}
                Send reset link
              </button>
              <button
                type="button"
                className="h-10 w-full rounded-xl text-sm font-semibold text-[#6857c9] transition hover:bg-[#efedfa]"
                onClick={() => {
                  setForgot(false);
                  setError('');
                  setMessage('');
                }}
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void google()}
                disabled={pending}
                className="mt-8 flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-[#dedbe7] bg-white text-sm font-semibold text-[#312d3a] shadow-sm transition hover:border-[#cbc5dd] hover:bg-[#fbfaff] disabled:opacity-50"
              >
                {pending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <span className="grid size-5 place-items-center rounded-full bg-white text-[13px] font-bold text-[#4285f4]">G</span>
                )}
                Continue with Google
              </button>

              <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#aaa5b2]">
                <span className="h-px flex-1 bg-[#e5e2ea]" />
                Or use email
                <span className="h-px flex-1 bg-[#e5e2ea]" />
              </div>

              <form onSubmit={submit} className="space-y-4">
                <EmailField />
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-xs font-semibold text-[#625d6c]">Password</label>
                    {mode === 'signin' ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#6857c9]"
                        onClick={() => {
                          setForgot(true);
                          setError('');
                          setMessage('');
                        }}
                      >
                        Forgot password?
                      </button>
                    ) : null}
                  </div>
                  <PasswordField show={showPassword} setShow={setShowPassword} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
                </div>

                {error ? <Alert tone="error">{error}</Alert> : null}
                {message ? <Alert tone="success">{message}</Alert> : null}

                <button
                  type="submit"
                  disabled={pending}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#211d31] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(33,29,49,.16)] transition hover:bg-[#2b2540] disabled:opacity-50"
                >
                  {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-[#918c9a]">
                {mode === 'signin' ? 'New to StudyOS?' : 'Already have an account?'}{' '}
                <button
                  className="font-semibold text-[#6756c8]"
                  onClick={() => {
                    const nextMode = mode === 'signin' ? 'signup' : 'signin';
                    setMode(nextMode);
                    setError('');
                    setMessage('');
                    const url = new URL(window.location.href);
                    url.searchParams.set('mode', nextMode);
                    window.history.replaceState({}, '', url.toString());
                  }}
                >
                  {mode === 'signin' ? 'Create account' : 'Sign in'}
                </button>
              </p>
            </>
          )}

          <div className="mt-10 grid grid-cols-3 gap-2 border-t border-[#ebe8f0] pt-5 text-center">
            {[
              ['Private', 'Documents'],
              ['RLS', 'User data'],
              ['Review', 'AI changes'],
            ].map(([value, label]) => (
              <div key={value}>
                <p className="text-[11px] font-semibold text-[#3b3547]">{value}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[.08em] text-[#aaa5b2]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function EmailField() {
  return (
    <div>
      <label htmlFor="email" className="text-xs font-semibold text-[#625d6c]">Email address</label>
      <div className="relative mt-1.5">
        <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#aaa4b3]" />
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="h-11 w-full rounded-xl border border-[#ddd9e5] bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-[#b5b1bc] focus:border-[#8b7ce1] focus:ring-4 focus:ring-[#8b7ce1]/10"
        />
      </div>
    </div>
  );
}

function PasswordField({
  show,
  setShow,
  autoComplete,
}: {
  show: boolean;
  setShow: (value: boolean) => void;
  autoComplete: string;
}) {
  return (
    <div className="relative mt-1.5">
      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#aaa4b3]" />
      <input
        id="password"
        name="password"
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={8}
        required
        placeholder="At least 8 characters"
        className="h-11 w-full rounded-xl border border-[#ddd9e5] bg-white pl-10 pr-10 text-sm outline-none transition placeholder:text-[#b5b1bc] focus:border-[#8b7ce1] focus:ring-4 focus:ring-[#8b7ce1]/10"
      />
      <button
        type="button"
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9993a2] transition hover:text-[#514a5d]"
        onClick={() => setShow(!show)}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function Alert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const className =
    tone === 'error'
      ? 'border-[#efc6c9] bg-[#fff1f2] text-[#a84950]'
      : 'border-[#cbe8d6] bg-[#f0faf4] text-[#31724b]';
  return <p className={'rounded-xl border p-3 text-sm ' + className}>{children}</p>;
}
