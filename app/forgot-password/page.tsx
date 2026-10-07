// app/forgot-password/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Mail,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  BookOpen,
  Library,
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // SEND RESET LINK
  //
  // Flow:
  //   1. Validate the email client-side.
  //   2. `supabase.auth.resetPasswordForEmail()` — Supabase sends a magic
  //      link to the user. Clicking that link hits our `/auth/callback`
  //      route with a PKCE `?code=...` param, which exchanges the code for
  //      a session and then forwards the user to `/update-password`.
  //   3. On success → show a friendly Amharic confirmation.
  //   4. On error → show the reason.
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmed = email.trim();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setErrorMessage('እባክዎ ትክክለኛ የኢሜይል አድራሻ ያስገቡ።');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();

        if (
          msg.includes('rate limit') ||
          msg.includes('too many requests')
        ) {
          setErrorMessage(
            'በጣም ብዙ ሙከራዎች ተደርገዋል። እባክዎ ትንሽ ቆይተው እንደገና ይሞክሩ።'
          );
        } else if (
          msg.includes('network') ||
          msg.includes('fetch') ||
          msg.includes('failed to fetch')
        ) {
          setErrorMessage(
            'የኢንተርኔት ግንኙነት ችግር አለ። እባክዎ ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ።'
          );
        } else {
          setErrorMessage(
            error.message ||
              'የይለፍ ቃል መቀየሪያ ሊንክ መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።'
          );
        }
        return;
      }

      // Supabase intentionally returns success even for non-existent emails
      // (to avoid leaking account existence). We therefore always show the
      // friendly confirmation message.
      setSuccessMessage('የይለፍ ቃል መቀየሪያ ሊንክ ወደ ኢሜይልዎ ተልኳል!');
      setEmail('');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'ያልታወቀ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
      {/* ================================================================= */}
      {/* AMBIENT EMERALD GLOW BACKGROUND                                  */}
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
          <div className="text-center mb-6">
            <Image
              src="/logo.png"
              alt="Basira Logo"
              width={56}
              height={56}
              className="rounded-2xl mx-auto mb-3 shadow-lg object-contain"
            />
            <h1 className="text-2xl font-extrabold text-white">
              ባሲራ{' '}
              <span className="font-light text-emerald-300/80">(Basira)</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-emerald-200/70 leading-relaxed">
              ፕሪሚየም አካደሚ • የቁርኣን ማዕከል • ዲጂታል ቤተ-መጽሐፍት
            </p>
          </div>

          {/* -------------------- Form heading -------------------- */}
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
              <KeyRound className="h-6 w-6 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              የይለፍ ቃልዎን ይረሱት?
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              እባክዎን የተቀየደውን ኢሜይልዎን ያስገቡ፤ የይለፍ ቃል መቀየሪያ ሊንክ
              እንልክልዎታለን።
            </p>
          </div>

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

          {/* -------------------- Success alert -------------------- */}
          {successMessage && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-3 text-sm text-emerald-200"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
              <div className="flex-1 leading-relaxed">
                <p className="font-semibold">{successMessage}</p>
                <p className="mt-1 text-xs text-emerald-200/80">
                  ካላዩት የስፓም አቃፊዎን ያረጋግጡ። ሊንኩ በ24 ሰዓት ውስጥ ያበቃል።
                </p>
              </div>
            </div>
          )}

          {/* -------------------- Form -------------------- */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 mb-1.5"
              >
                ኢሜይል አድራሻ
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                    if (successMessage) setSuccessMessage(null);
                  }}
                  placeholder="name@example.com"
                  disabled={isLoading}
                  className="block h-12 w-full rounded-2xl border border-slate-700/50 bg-slate-800/60 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/60 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            {/* -------------------- Primary CTA -------------------- */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  በመላክ ላይ...
                </>
              ) : (
                <>
                  <Mail className="h-5 w-5" />
                  ሊንክ ላክ
                </>
              )}
            </button>
          </form>

          {/* -------------------- Back to Login -------------------- */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              ወደ መለያ መግቢያ ተመለስ
            </Link>
          </div>
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
          © {new Date().getFullYear()} ባሲራ · Basira
        </p>
      </div>
    </div>
  );
}