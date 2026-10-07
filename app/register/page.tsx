// app/register/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Mail,
  User,
  Lock,
  Phone,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  GraduationCap,
  BookOpen,
  Library,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FormData = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormData, string>> & {
  general?: string;
};

type FormState = 'idle' | 'loading' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MIN_PASSWORD_LENGTH = 6;

// Ethiopian phone: accepts 09xxxxxxxx, 07xxxxxxxx, +2519xxxxxxxx, +2517xxxxxxxx
// Strips spaces/dashes on validation so users can paste formatted numbers.
const PHONE_REGEX = /^(?:\+251|0)(9|7)\d{8}$/;

function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, '').trim();
}

// ---------------------------------------------------------------------------
// Explicit production callback URL for the email verification link.
// ---------------------------------------------------------------------------
const EMAIL_REDIRECT_URL =
  'https://course-test-two.vercel.app/auth/callback';

// ---------------------------------------------------------------------------
// Google icon
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
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Password visibility toggles
  // -------------------------------------------------------------------------
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------
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

    const cleanedPhone = normalizePhone(formData.phone);
    if (!cleanedPhone) {
      newErrors.phone = 'የስልክ ቁጥር ማስገባት ግዴታ ነው።';
    } else if (!PHONE_REGEX.test(cleanedPhone)) {
      newErrors.phone =
        'ትክክለኛ የስልክ ቁጥር ያስገቡ (ምሳሌ፡ 0911223344 ወይም +251911223344)።';
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

  // -------------------------------------------------------------------------
  // EMAIL + PASSWORD REGISTRATION
  //
  // Flow:
  //   1. Validate form client-side (including phone).
  //   2. `supabase.auth.signUp()` with user_metadata = { full_name, phone }.
  //   3. On success, upsert the same data into `profiles`.
  //   4. Show the "verify your email" success screen.
  // -------------------------------------------------------------------------
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setFormState('loading');
    setErrorMessage('');

    const cleanedPhone = normalizePhone(formData.phone);
    const cleanName = formData.fullName.trim();
    const cleanEmail = formData.email.trim();

    try {
      // ---- 1. Create auth user ----
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: formData.password,
        options: {
          data: {
            full_name: cleanName,
            phone: cleanedPhone,
          },
          emailRedirectTo: EMAIL_REDIRECT_URL,
        },
      });

      // ---- Handle Supabase-side error ----
      if (error) {
        const msg = (error.message || '').toLowerCase();

        if (
          msg.includes('already registered') ||
          msg.includes('already been registered') ||
          msg.includes('user already exists')
        ) {
          setErrorMessage(
            'በዚህ ኢሜይል የተመዘገበ መለያ አስቀድሞ አለ። እባክዎ ይግቡ ወይም የይለፍ ቃልዎን ያስታውሱ።'
          );
        } else if (
          msg.includes('rate limit') ||
          msg.includes('too many requests')
        ) {
          setErrorMessage(
            'በጣም ብዙ ሙከራዎች ተደርገዋል። እባክዎ ትንሽ ቆይተው እንደገና ይሞክሩ።'
          );
        } else if (msg.includes('password')) {
          setErrorMessage(
            'የይለፍ ቃሉ ተቀባይነት አላገኘም። እባክዎ ጠንካራ የይለፍ ቃል ይምረጡ።'
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
              'ምዝገባውን ማጠናቀቅ አልተቻለም። እባክዎ እንደገና ይሞክሩ።'
          );
        }
        setFormState('error');
        return;
      }

      // ---- Duplicate email (Supabase returns empty identities) ----
      if (data?.user?.identities?.length === 0) {
        setErrorMessage(
          'በዚህ ኢሜይል የተመዘገበ መለያ አስቀድሞ አለ። እባክዎ ይግቡ።'
        );
        setFormState('error');
        return;
      }

      // ---- 2. Write to `profiles` ----
      //
      // We attempt an upsert keyed on `id`. If RLS is not yet configured
      // to allow self-inserts, the insert silently fails — the auth user
      // still exists, and the /complete-profile page will pick up the
      // missing phone later. We log the error so it's visible in DevTools.
      const userId = data?.user?.id;

      if (userId) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert(
            {
              id: userId,
              full_name: cleanName,
              email: cleanEmail,
              phone: cleanedPhone,
              role: 'student',
            },
            { onConflict: 'id' }
          );

        if (profileErr) {
          console.error(
            'DEBUG_SUPABASE_ERROR (profiles upsert, non-fatal):',
            profileErr
          );
        }
      }

      // ---- 3. Success screen ----
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

  // -------------------------------------------------------------------------
  // Google OAuth sign-up — after Google auth, the user may be missing a
  // phone number. `/auth/callback` detects that and forwards them to
  // `/complete-profile`, where they fill in the phone before proceeding.
  // -------------------------------------------------------------------------
  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setErrorMessage('');
    setFormState('idle');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setFormState('error');
        setGoogleLoading(false);
        return;
      }
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

  // -------------------------------------------------------------------------
  // Success screen
  // -------------------------------------------------------------------------
  if (formState === 'success') {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
        {/* Ambient emerald glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <div className="relative w-full max-w-md px-4">
          <div className="rounded-3xl border border-emerald-500/20 bg-slate-900/90 shadow-2xl shadow-emerald-950/40 backdrop-blur-md px-6 py-8 sm:px-8 sm:py-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
              <Mail className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              ኢሜይልዎን ያረጋግጡ
            </h2>
            <p className="text-slate-400 mb-2 leading-relaxed text-sm">
              የማረጋገጫ ማስፈንጠሪያ ልከናል ወደ
            </p>
            <p className="text-emerald-400 font-semibold text-base mb-6 break-all">
              {formData.email}
            </p>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              እባክዎ የገቢ መልእክት ሳጥንዎን ይመልከቱ እና መለያዎን ለማግበር
              የማረጋገጫ ማስፈንጠሪያውን ይጫኑ። ካላዩት የስፓም አቃፊዎን
              ያረጋግጡ።
            </p>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200 text-left leading-relaxed">
                  ኢሜይልዎን እስኪያረጋግጡ ድረስ መግባት አይችሉም።
                  የማረጋገጫ ማስፈንጠሪያው ከ24 ሰዓት በኋላ ያበቃል።
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 active:scale-95 transition-all"
            >
              ወደ መግቢያ ይሂዱ
            </Link>
          </div>
          <p className="mt-6 text-center text-sm text-slate-400">
            ኢሜይሉ አልደረሰዎትም?{' '}
            <button
              onClick={() => {
                setFormState('idle');
                setErrorMessage('');
              }}
              className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              በሌላ ኢሜይል እንደገና ይሞክሩ
            </button>
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Registration form
  // -------------------------------------------------------------------------
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4 py-6 sm:py-10 sm:px-6 lg:px-8">
      {/* Autofill override — keeps Chrome/Safari autofill from painting
          the inputs a light cream/yellow that clashes with the dark UI. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            input:-webkit-autofill,
            input:-webkit-autofill:hover,
            input:-webkit-autofill:focus,
            input:-webkit-autofill:active {
              -webkit-text-fill-color: #f1f5f9 !important;
              -webkit-box-shadow: 0 0 0 1000px rgba(30, 41, 59, 0.6) inset !important;
              box-shadow: 0 0 0 1000px rgba(30, 41, 59, 0.6) inset !important;
              transition: background-color 9999s ease-in-out 0s !important;
              caret-color: #f1f5f9 !important;
            }
          `,
        }}
      />

      {/* Ambient emerald glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-emerald-600/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4">
        <div className="rounded-3xl border border-emerald-500/20 bg-slate-900/90 shadow-2xl shadow-emerald-950/40 backdrop-blur-md px-5 py-6 sm:px-8 sm:py-9">
          {/* -------------------- Header -------------------- */}
          <div className="text-center mb-5 sm:mb-6">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/40">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">
              ባሲራ{' '}
              <span className="font-light text-emerald-300/80">(Basira)</span>
            </h1>
            <p className="mt-1 text-[11px] sm:text-xs text-emerald-200/70 leading-relaxed">
              ፕሪሚየም አካደሚ • የቁርኣን ማዕከል • ዲጂታል ቤተ-መጽሐፍት
            </p>
          </div>

          {/* Form heading */}
          <h2 className="text-lg font-bold text-white mb-0.5 text-center">
            መለያ ይፍጠሩ
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mb-5 text-center leading-relaxed">
            የመማር ጉዞዎን ዛሬ ይጀምሩ
          </p>

          {/* -------------------- Google OAuth -------------------- */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading || formState === 'loading'}
            className="w-full flex h-12 items-center justify-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/40 px-6 text-sm font-semibold text-slate-200 hover:bg-slate-800/70 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {googleLoading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 text-slate-400" />
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
          <div className="relative my-4 sm:my-5">
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

          {/* -------------------- Error banner -------------------- */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 rounded-2xl border border-red-500/30 bg-red-950/40 px-3.5 py-3"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-red-200">
                    ምዝገባው አልተሳካም
                  </p>
                  <p className="mt-0.5 text-xs text-red-300/90 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-3.5"
            noValidate
          >
            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                ሙሉ ስም
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  value={formData.fullName}
                  onChange={handleChange('fullName')}
                  placeholder="ለምሳሌ፡ አህመድ አሊ"
                  className={`block h-12 w-full rounded-2xl border bg-slate-800/60 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                    errors.fullName
                      ? 'border-red-500/60 focus:ring-red-500 focus:border-red-500/60'
                      : 'border-slate-700/50 focus:ring-emerald-500 focus:border-emerald-500/60'
                  }`}
                />
              </div>
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                ኢሜይል
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
                  value={formData.email}
                  onChange={handleChange('email')}
                  placeholder="example@gmail.com"
                  className={`block h-12 w-full rounded-2xl border bg-slate-800/60 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                    errors.email
                      ? 'border-red-500/60 focus:ring-red-500 focus:border-red-500/60'
                      : 'border-slate-700/50 focus:ring-emerald-500 focus:border-emerald-500/60'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label
                htmlFor="phone"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                የስልክ ቁጥር
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Phone className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={handleChange('phone')}
                  placeholder="ምሳሌ: 0911223344"
                  className={`block h-12 w-full rounded-2xl border bg-slate-800/60 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                    errors.phone
                      ? 'border-red-500/60 focus:ring-red-500 focus:border-red-500/60'
                      : 'border-slate-700/50 focus:ring-emerald-500 focus:border-emerald-500/60'
                  }`}
                />
              </div>
              {errors.phone && (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                የይለፍ ቃል
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange('password')}
                  placeholder="ቢያንስ 6 ቁምፊዎች"
                  className={`block h-12 w-full rounded-2xl border bg-slate-800/60 pl-11 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                    errors.password
                      ? 'border-red-500/60 focus:ring-red-500 focus:border-red-500/60'
                      : 'border-slate-700/50 focus:ring-emerald-500 focus:border-emerald-500/60'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-emerald-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                የይለፍ ቃል ያረጋግጡ
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  placeholder="የይለፍ ቃሉን ድጋሚ ያስገቡ"
                  className={`block h-12 w-full rounded-2xl border bg-slate-800/60 pl-11 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                    errors.confirmPassword
                      ? 'border-red-500/60 focus:ring-red-500 focus:border-red-500/60'
                      : 'border-slate-700/50 focus:ring-emerald-500 focus:border-emerald-500/60'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-emerald-300 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={formState === 'loading' || googleLoading}
              className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 mt-1"
            >
              {formState === 'loading' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  በመመዝገብ ላይ...
                </>
              ) : (
                'ተመዝገብ'
              )}
            </button>
          </form>

          {/* -------------------- Login link -------------------- */}
          <p className="mt-5 text-center text-sm text-slate-400">
            ቀደም ሲል መለያ አለዎት?{' '}
            <Link
              href="/login"
              className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              ይግቡ
            </Link>
          </p>
        </div>

        {/* -------------------- Sub-card footer -------------------- */}
        <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-slate-500">
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

        <p className="mt-4 text-center text-[11px] text-slate-600">
          © {new Date().getFullYear()} ባሲራ · Basira
        </p>
      </div>
    </div>
  );
}