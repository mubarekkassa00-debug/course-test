// app/login/page.tsx
'use client';

import { useState, useCallback, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Mail,
  Lock,
  LogIn,
  Eye,
  EyeOff,
  Loader2,
  BookOpen,
  Library,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Google "G" brand icon (inline SVG so we don't pull an extra dependency).
// ---------------------------------------------------------------------------
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.141 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Create a single browser Supabase client for the whole app.
//
// `createBrowserClient` from `@supabase/ssr`:
//   • Stores the session in cookies (not localStorage), so middleware.ts
//     and Server Components can read it.
//   • Uses the PKCE flow by default — which is exactly what we need so
//     Google OAuth returns `?code=...` to `/auth/callback` instead of
//     `#access_token=...` on the root URL.
// ---------------------------------------------------------------------------
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // EMAIL + PASSWORD SIGN-IN
  //
  // Flow:
  //   1. preventDefault + client-side validation.
  //   2. `supabase.auth.signInWithPassword()` — writes session cookies
  //      (createBrowserClient stores the session in cookies, not localStorage).
  //   3. On success → immediate HARD redirect via `window.location.href`.
  //      A hard reload guarantees the freshly-set cookies are sent with the
  //      very next request, so middleware.ts + Server Components see the new
  //      session on the first try.
  //   4. On error → show an Amharic message and reset the loading state.
  // ---------------------------------------------------------------------------
  const handleLogin = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErrorMessage(null);

      // Basic validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        setErrorMessage('ትክክለኛ የኢሜይል አድራሻ ያስገቡ');
        return;
      }
      if (!password) {
        setErrorMessage('የይለፍ ቃል ያስገቡ');
        return;
      }

      setIsLoading(true);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        // -------------------------------------------------------------
        // ERROR HANDLING
        // -------------------------------------------------------------
        if (error) {
          const msg = (error.message || '').toLowerCase();

          if (
            msg.includes('invalid login credentials') ||
            msg.includes('invalid_grant')
          ) {
            setErrorMessage('ኢሜይል ወይም የይለፍ ቃል ትክክል አይደለም');
          } else if (
            msg.includes('email not confirmed') ||
            msg.includes('not confirmed')
          ) {
            setErrorMessage(
              'ኢሜይልዎ ገና አልተረጋገጠም። እባክዎ የማረጋገጫ ማስፈንጠሪያውን ይጫኑ።'
            );
          } else {
            setErrorMessage(error.message);
          }

          setIsLoading(false);
          return;
        }

        // -------------------------------------------------------------
        // SUCCESS — HARD REDIRECT
        // -------------------------------------------------------------
        if (data?.session) {
          window.location.href = '/dashboard';
          return;
        }

        window.location.href = '/dashboard';
      } catch (err) {
        setErrorMessage('ያልተጠበቀ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ');
        console.error('Login error:', err);
        setIsLoading(false);
      }
    },
    [email, password]
  );

  // ---------------------------------------------------------------------------
  // Google OAuth sign-in
  //
  // PKCE FLOW (via @supabase/ssr):
  //
  //   `createBrowserClient` enables PKCE by default. This means Supabase
  //   now redirects Google's response back to our `/auth/callback` route
  //   with a `?code=...` query parameter — NOT a `#access_token=...` hash.
  //
  //   The callback route (`app/auth/callback/route.ts`) then performs
  //   `exchangeCodeForSession(code)` server-side and sets the auth cookies
  //   before redirecting the user to `/dashboard`.
  //
  //   This is the correct, secure pattern for Next.js App Router — cookies
  //   are set on the server, so `middleware.ts` and Server Components see
  //   the session immediately on the next request.
  // ---------------------------------------------------------------------------
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setGoogleLoading(false);
        return;
      }

      // On success, Supabase redirects the browser to Google's consent
      // screen — no further client-side action is needed here.
    } catch (err) {
      setErrorMessage('በ Google መግባት አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
      console.error('Google login error:', err);
      setGoogleLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
      {/* ================================================================= */}
      {/* AMBIENT EMERALD GLOW BACKGROUND                                  */}
      {/* Subtle, cinematic lighting that sits behind everything.          */}
      {/* ================================================================= */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-emerald-600/5 blur-3xl" />
      </div>

      {/* ================================================================= */}
      {/* GLASS CARD                                                        */}
      {/* ================================================================= */}
      <div className="relative w-full max-w-md px-4">
        <div className="rounded-3xl border border-emerald-500/20 bg-slate-900/90 shadow-2xl shadow-emerald-950/40 backdrop-blur-md px-6 py-8 sm:px-8 sm:py-10">
          {/* -------------------- Header -------------------- */}
          <div className="text-center mb-8">
            <Image
              src="/logo.png"
              alt="Istibsar Logo"
              width={56}
              height={56}
              className="rounded-2xl mx-auto mb-3 shadow-lg object-contain"
            />
            <h1 className="text-2xl font-extrabold text-white">
              እስቲብሳር{' '}
              <span className="font-light text-emerald-300/80">
                (Istibsar)
              </span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-emerald-200/70 leading-relaxed">
              ፕሪሚየም አካደሚ • የቁርኣን ማዕከል • ዲጂታል ቤተ-መጽሐፍት
            </p>
          </div>

          {/* -------------------- Form heading -------------------- */}
          <h2 className="text-xl font-bold text-white mb-1">
            ወደ መለያዎ ይግቡ
          </h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            ለመቀጠል የእርስዎን ኢሜይል እና የይለፍ ቃል ያስገቡ
          </p>

          {/* -------------------- Error alert -------------------- */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-950/40 px-3.5 py-3 text-sm text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* -------------------- Google OAuth -------------------- */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || isLoading}
            className="w-full flex h-12 items-center justify-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/40 px-6 text-sm font-semibold text-slate-200 hover:bg-slate-800/70 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {googleLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                በመገናኘት ላይ...
              </>
            ) : (
              <>
                <GoogleIcon className="h-5 w-5" />
                በ Google ይቀጥሉ
              </>
            )}
          </button>

          {/* -------------------- Divider -------------------- */}
          <div className="relative my-6">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
            >
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-900/90 px-3 text-xs text-slate-500">
                ወይም
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* -------------------- Email -------------------- */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 mb-1.5"
              >
                ኢሜይል አድራሻ
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="block h-12 w-full rounded-2xl border border-slate-700/50 bg-slate-800/60 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/60 transition-all"
                  disabled={isLoading || googleLoading}
                />
              </div>
            </div>

            {/* -------------------- Password -------------------- */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300 mb-1.5"
              >
                የይለፍ ቃል
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="block h-12 w-full rounded-2xl border border-slate-700/50 bg-slate-800/60 pl-11 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/60 transition-all"
                  disabled={isLoading || googleLoading}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-emerald-300 focus:outline-none transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading || googleLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Forgot password link */}
              <div className="mt-2 text-right">
                <Link
                  href="/forgot-password"
                  className="text-xs text-emerald-400 hover:underline"
                >
                  የይለፍ ቃል ረስተዋል?
                </Link>
              </div>
            </div>

            {/* -------------------- Primary CTA -------------------- */}
            <button
              type="submit"
              disabled={isLoading || googleLoading}
              className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  በመግባት ላይ...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  ይግቡ
                </>
              )}
            </button>
          </form>

          {/* -------------------- Register link -------------------- */}
          <p className="mt-6 text-center text-sm text-slate-400">
            መለያ የለዎትም?{' '}
            <a
              href="/register"
              className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              አዲስ መለያ ይፍጠሩ
            </a>
          </p>
        </div>

        {/* -------------------- Sub-card footer -------------------- */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-emerald-500/70" />
            የቁርኣን ማዕከል
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-700" />
          <span className="inline-flex items-center gap-1.5">
            <Library className="h-3.5 w-3.5 text-emerald-500/70" />
            ዲጂታል ቤተ-መጽሐፍት
          </span>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-600">
          © {new Date().getFullYear()} እስቲብሳር · Istibsar
        </p>
      </div>
    </div>
  );
}