// app/register/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Mail, User, Lock, AlertCircle, Loader2 } from 'lucide-react';

type FormData = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormData, string>> & {
  general?: string;
};

type FormState = 'idle' | 'loading' | 'success' | 'error';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MIN_PASSWORD_LENGTH = 6;

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

export default function RegisterPage() {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'ሙሉ ስም ማስገባት ግዴታ ነው።';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'ሙሉ ስም ቢያንስ 2 ቁምፊ መሆን አለበት።';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'ኢሜይል ማስገባት ግዴታ ነው።';
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      newErrors.email = 'እባክዎ ትክክለኛ የኢሜይል አድራሻ ያስገቡ።';
    }

    if (!formData.password) {
      newErrors.password = 'የይለፍ ቃል ማስገባት ግዴታ ነው።';
    } else if (formData.password.length < MIN_PASSWORD_LENGTH) {
      newErrors.password = `የይለፍ ቃል ቢያንስ ${MIN_PASSWORD_LENGTH} ቁምፊ መሆን አለበት።`;
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'እባክዎ የይለፍ ቃል ያረጋግጡ።';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'የይለፍ ቃላቱ አይመሳሰሉም።';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (errorMessage) {
      setErrorMessage('');
      setFormState('idle');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setFormState('loading');
    setErrorMessage('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setFormState('error');
        return;
      }

      if (data?.user?.identities?.length === 0) {
        setErrorMessage(
          'በዚህ ኢሜይል የተመዘገበ መለያ አስቀድሞ አለ። እባክዎ ይግቡ።'
        );
        setFormState('error');
        return;
      }

      setFormState('success');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'ያልታወቀ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።'
      );
      setFormState('error');
    }
  };

  // ---------------------------------------------------------------------------
  // Google OAuth sign-up — redirects to the Supabase Auth callback route so
  // the OAuth code exchange happens server-side (via /auth/callback), which
  // then forwards the authenticated user to the dashboard.
  //
  // The `redirectTo` value is built from `window.location.origin` so it works
  // in every environment automatically:
  //   • Production  → https://course-test-two.vercel.app/auth/callback
  //   • Preview     → https://<preview>.vercel.app/auth/callback
  //   • Local dev   → http://localhost:3000/auth/callback
  // ---------------------------------------------------------------------------
  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setErrorMessage('');
    setFormState('idle');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setFormState('error');
        setGoogleLoading(false);
        return;
      }

      // On success, Supabase redirects the browser to Google's consent
      // screen — no further client-side action is needed here. We keep
      // `googleLoading` true so the button shows the spinner during the
      // in-flight redirect.
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'የ Google ግንኙነት አልተሳካም። እባክዎ እንደገና ይሞክሩ።'
      );
      setFormState('error');
      setGoogleLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Success screen — Amharic
  // ---------------------------------------------------------------------------
  if (formState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-emerald-100/50 dark:shadow-slate-950/60 p-8 text-center border border-emerald-100 dark:border-slate-800">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 mb-6">
              <Mail className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              ኢሜይልዎን ያረጋግጡ
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
              የማረጋገጫ ማስፈንጠሪያ ልከናል ወደ
            </p>
            <p className="text-emerald-700 dark:text-emerald-400 font-semibold text-lg mb-6 break-all">
              {formData.email}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
              እባክዎ የገቢ መልእክት ሳጥንዎን ይመልከቱ እና መለያዎን ለማግበር
              የማረጋገጫ ማስፈንጠሪያውን ይጫኑ። ካላዩት የስፓም አቃፊዎን
              ያረጋግጡ።
            </p>
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300 text-left">
                  ኢሜይልዎን እስኪያረጋግጡ ድረስ መግባት አይችሉም።
                  የማረጋገጫ ማስፈንጠሪያው ከ24 ሰዓት በኋላ ያበቃል።
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors duration-200"
            >
              ወደ መግቢያ ይሂዱ
            </Link>
          </div>
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            ኢሜይሉ አልደረሰዎትም?{' '}
            <button
              onClick={() => {
                setFormState('idle');
                setErrorMessage('');
              }}
              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors duration-200"
            >
              በሌላ ኢሜይል እንደገና ይሞክሩ
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Registration form
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-200 dark:shadow-emerald-950/40 mb-5">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            መለያ ይፍጠሩ
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            የመማር ጉዞዎን ዛሬ ይጀምሩ
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-emerald-100/50 dark:shadow-slate-950/60 p-8 border border-emerald-100 dark:border-slate-800">
          {/* Google OAuth button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading || formState === 'loading'}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
          >
            {googleLoading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 text-slate-500 dark:text-slate-300" />
                በመገናኘት ላይ...
              </>
            ) : (
              <>
                <GoogleIcon className="h-5 w-5" />
                በ Google ይቀጥሉ
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-500">
                ወይም
              </span>
            </div>
          </div>

          {/* Error banner */}
          {errorMessage && (
            <div className="mb-6 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    ምዝገባው አልተሳካም
                  </p>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300/90">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                ሙሉ ስም
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <User className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  value={formData.fullName}
                  onChange={handleChange('fullName')}
                  placeholder="ለምሳሌ፡ አህመድ አሊ"
                  className={`block w-full rounded-xl border ${
                    errors.fullName
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200 dark:border-red-500/50 dark:focus:border-red-400 dark:focus:ring-red-500/20'
                      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-200 dark:border-slate-700 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20'
                  } py-3 pl-11 pr-4 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-4 transition-all duration-200 text-sm`}
                />
              </div>
              {errors.fullName && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                ኢሜይል
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Mail className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange('email')}
                  placeholder="example@gmail.com"
                  className={`block w-full rounded-xl border ${
                    errors.email
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200 dark:border-red-500/50 dark:focus:border-red-400 dark:focus:ring-red-500/20'
                      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-200 dark:border-slate-700 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20'
                  } py-3 pl-11 pr-4 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-4 transition-all duration-200 text-sm`}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                የይለፍ ቃል
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange('password')}
                  placeholder="ቢያንስ 6 ቁምፊዎች"
                  className={`block w-full rounded-xl border ${
                    errors.password
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200 dark:border-red-500/50 dark:focus:border-red-400 dark:focus:ring-red-500/20'
                      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-200 dark:border-slate-700 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20'
                  } py-3 pl-11 pr-4 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-4 transition-all duration-200 text-sm`}
                />
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                የይለፍ ቃል ያረጋግጡ
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  placeholder="የይለፍ ቃሉን ድጋሚ ያስገቡ"
                  className={`block w-full rounded-xl border ${
                    errors.confirmPassword
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200 dark:border-red-500/50 dark:focus:border-red-400 dark:focus:ring-red-500/20'
                      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-200 dark:border-slate-700 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20'
                  } py-3 pl-11 pr-4 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-4 transition-all duration-200 text-sm`}
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={formState === 'loading' || googleLoading}
              className="w-full flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
            >
              {formState === 'loading' ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                  በመመዝገብ ላይ...
                </>
              ) : (
                'ተመዝገብ'
              )}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          ቀደም ሲል መለያ አለዎት?{' '}
          <Link
            href="/login"
            className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors duration-200"
          >
            ይግቡ
          </Link>
        </p>
      </div>
    </div>
  );
}