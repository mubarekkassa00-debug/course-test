// app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PaymentSection from '@/components/PaymentSection';
import {
  BookOpen,
  Mic,
  GraduationCap,
  Library,
  Lock,
  LogOut,
  User,
  Sparkles,
  Loader2,
  Sun,
  Moon,
  Calendar,
  CheckCircle2,
  Circle,
  Award,
  Clock,
  Download,
  AlertTriangle,
  Send,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// CONFIGURABLE VISUAL ASSET
// ---------------------------------------------------------------------------
// Swap this URL to change the dashboard hero background image.
// Accepts any HTTPS image URL (Cloudinary, Unsplash, CDN) or a local path
// like '/images/hero.jpg' served from /public.
const HERO_IMAGE_URL =
  'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&w=1600&q=80';

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

type DashboardUser = {
  id?: string;
  email?: string;
  full_name?: string;
};

type CourseStatus = 'not_started' | 'in_progress' | 'passed';

interface CourseProgress {
  slug: string;
  displayName: string;
  bestPercent: number;
  status: CourseStatus;
}

type PaymentStatus = 'none' | 'pending' | 'approved' | 'rejected';

// ---------------------------------------------------------------------------
// Course catalogue (4 required books)
// ---------------------------------------------------------------------------

const REQUIRED_COURSES: { slug: string; displayName: string }[] = [
  {
    slug: 'usul_al_thalatha',
    displayName: 'ኡሱሉ ሰላሳ',
  },
  {
    slug: 'arbain',
    displayName: 'አርባኢን ነወዊ',
  },
  {
    slug: 'shurut_as_salah',
    displayName: 'ሹሩጡ ሶላት',
  },
  {
    slug: 'urjuzat',
    displayName: 'ኡርጁዘቱል ሚኢያህ',
  },
];

/** Minimum percentage required to pass a course (matches backend). */
const PASS_THRESHOLD_PERCENT = 50;

// Amharic month names for Hijri calendar (1-indexed)
const hijriMonthsAmh: string[] = [
  'ሙሐረም',
  'ሰፈር',
  'ረቢዑል አወል',
  'ረቢዑስ ሳኒ',
  'ጀማዱል አወል',
  'ጀማዱል አኺር',
  'ረጀብ',
  'ሸዕባን',
  'ረመዷን',
  'ሸወል',
  'ዙልቀዕዳ',
  'ዙልሒጃ',
];

// ---------------------------------------------------------------------------
// Hijri date helper
// ---------------------------------------------------------------------------
function getHijriDate(): string {
  try {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat(
      'en-SA-u-ca-islamic-umalqura-nu-latn',
      {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }
    );
    const parts = formatter.formatToParts(today);

    let day = '1';
    let month = '1';
    let year = '1448';

    for (const part of parts) {
      if (part.type === 'day') day = part.value;
      else if (part.type === 'month') month = part.value;
      else if (part.type === 'year') year = part.value;
    }

    const monthIndex = parseInt(month, 10) - 1;
    const amhMonth =
      hijriMonthsAmh[monthIndex] || `ሙሐረም (${monthIndex + 1})`;

    return `${day} ${amhMonth} ${year} ዓ.ሂ`;
  } catch {
    const now = new Date();
    const fallbackDay = now.getDate();
    return `${fallbackDay} ሙሐረም 1448 ዓ.ሂ`;
  }
}

// ---------------------------------------------------------------------------
// Progress normalizers
// ---------------------------------------------------------------------------

function computePercent(score: unknown, totalQuestions: unknown): number {
  const s = Number(score) || 0;
  const t = Number(totalQuestions) || 0;
  if (t <= 0) return 0;
  return Math.round((s / t) * 100);
}

function buildCourseProgress(rawRows: any[]): CourseProgress[] {
  const bestByCourse = new Map<string, number>();

  for (const row of rawRows || []) {
    const slug = String(row?.course_id ?? '');
    if (!slug) continue;
    const pct = computePercent(row?.score, row?.total_questions);
    const prev = bestByCourse.get(slug) ?? 0;
    if (pct > prev) bestByCourse.set(slug, pct);
  }

  return REQUIRED_COURSES.map(({ slug, displayName }) => {
    const best = bestByCourse.get(slug) ?? 0;
    let status: CourseStatus = 'not_started';
    if (best >= PASS_THRESHOLD_PERCENT) status = 'passed';
    else if (best > 0) status = 'in_progress';

    return { slug, displayName, bestPercent: best, status };
  });
}

function readErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const anyErr = err as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    if (typeof anyErr.message === 'string' && anyErr.message.trim() !== '') {
      return anyErr.message;
    }
    try {
      return JSON.stringify(anyErr);
    } catch {
      return 'Unserializable error object';
    }
  }
  return String(err);
}

/** Build a filesystem-safe filename for the downloaded certificate PDF. */
function buildCertificateFilename(studentName: string): string {
  const safe = studentName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '');
  return `Basira_Certificate_${safe || 'Student'}.pdf`;
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [hijriDate, setHijriDate] = useState('');

  // Progress + payment state
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('none');
  const [paymentLoading, setPaymentLoading] = useState(true);

  // Certificate download state
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [certSuccess, setCertSuccess] = useState<string | null>(null);

  // ---------- Dark mode state & persistence (globally synced) ----------
  useEffect(() => {
    const stored = localStorage.getItem('basira-theme');
    let isDark = false;
    if (stored === 'dark') {
      isDark = true;
    } else if (stored === 'light') {
      isDark = false;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      isDark = true;
    }

    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('basira-theme', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // AUTH GUARD — RESILIENT SESSION CHECK via `onAuthStateChange`
  //
  // PROBLEM WE ARE SOLVING:
  //   When the user navigates /courses → /dashboard (or hard-refreshes), the
  //   Supabase client needs a brief moment to hydrate its session state from
  //   localStorage / cookies. A one-shot `getSession()` call races against
  //   that hydration, so on the very first tick it can return `null` and the
  //   guard bounces the user back to `/login`.
  //
  // STRATEGY:
  //   Subscribe to `supabase.auth.onAuthStateChange` FIRST — before any
  //   navigation happens. Supabase fires the `INITIAL_SESSION` event exactly
  //   once, AFTER its own hydration is finished, carrying either the current
  //   session or `null`. That is our single source of truth:
  //
  //     • INITIAL_SESSION with a user → populate `user`, stop loading.
  //     • INITIAL_SESSION with null   → no session exists → go to /login.
  //     • SIGNED_IN / TOKEN_REFRESHED → keep `user` in sync with the SDK.
  //     • SIGNED_OUT                  → go to /login.
  //
  //   A 5-second safety timeout guarantees we never get stuck on the loading
  //   spinner if the SDK fails to emit `INITIAL_SESSION` for any reason.
  //
  //   The `resolved` flag ensures we only act on the very first authoritative
  //   signal, and the `cancelled` flag prevents state updates after unmount.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let resolved = false;
    let safetyTimeout: ReturnType<typeof setTimeout> | null = null;

    const finalize = (hasSession: boolean, sessionUser?: any) => {
      if (resolved || cancelled) return;
      resolved = true;

      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
        safetyTimeout = null;
      }

      if (hasSession && sessionUser) {
        setUser({
          id: sessionUser.id,
          email: sessionUser.email,
          full_name: sessionUser.user_metadata?.full_name,
        });
        setLoading(false);
      } else {
        router.replace('/login');
      }
    };

    // Safety net — if `INITIAL_SESSION` never fires, don't hang forever.
    safetyTimeout = setTimeout(() => {
      if (!cancelled && !resolved) {
        resolved = true;
        router.replace('/login');
      }
    }, 5000);

    // Subscribe FIRST so we never miss the `INITIAL_SESSION` event.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (event === 'INITIAL_SESSION') {
        // Authoritative hydration signal — act on it exactly once.
        if (session?.user) {
          finalize(true, session.user);
        } else {
          finalize(false);
        }
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Keep the user in sync with the SDK for the lifetime of the page.
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name,
          });
          setLoading(false);
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
    });

    return () => {
      cancelled = true;
      if (safetyTimeout) clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [router]);

  // ---------- Hijri date ----------
  useEffect(() => {
    setHijriDate(getHijriDate());
  }, []);

  // ---------- Fetch course progress ----------
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const fetchProgress = async () => {
      setProgressLoading(true);
      try {
        const slugs = REQUIRED_COURSES.map((c) => c.slug);

        const { data, error } = await supabase
          .from('quiz_results')
          .select('course_id, score, total_questions')
          .eq('user_id', user.id)
          .in('course_id', slugs);

        if (cancelled) return;

        if (error) {
          console.error(
            '[Dashboard] progress query error:',
            error.message || error
          );
          setCourseProgress(buildCourseProgress([]));
          return;
        }

        setCourseProgress(buildCourseProgress((data ?? []) as any[]));
      } catch (err) {
        if (!cancelled) {
          console.error(
            '[Dashboard] progress unexpected error:',
            readErrorMessage(err)
          );
          setCourseProgress(buildCourseProgress([]));
        }
      } finally {
        if (!cancelled) setProgressLoading(false);
      }
    };

    fetchProgress();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ---------- Fetch payment status ----------
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const fetchPayment = async () => {
      setPaymentLoading(true);
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (cancelled) return;

        if (error) {
          console.error(
            '[Dashboard] payment query error:',
            error.message || error
          );

          const retry = await supabase
            .from('payments')
            .select('status')
            .eq('user_id', user.id)
            .limit(1);

          if (retry.error || !retry.data || retry.data.length === 0) {
            setPaymentStatus('none');
            return;
          }

          const s = String(retry.data[0]?.status ?? '').toLowerCase();
          if (s === 'approved') setPaymentStatus('approved');
          else if (s === 'rejected') setPaymentStatus('rejected');
          else setPaymentStatus('pending');
          return;
        }

        if (!data || data.length === 0) {
          setPaymentStatus('none');
          return;
        }

        const s = String(data[0]?.status ?? '').toLowerCase();
        if (s === 'approved') setPaymentStatus('approved');
        else if (s === 'rejected') setPaymentStatus('rejected');
        else setPaymentStatus('pending');
      } catch (err) {
        if (!cancelled) {
          console.error(
            '[Dashboard] payment unexpected error:',
            readErrorMessage(err)
          );
          setPaymentStatus('none');
        }
      } finally {
        if (!cancelled) setPaymentLoading(false);
      }
    };

    fetchPayment();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ---------------------------------------------------------------------------
  // LOGOUT — clears the Supabase session and hard-redirects to /login.
  //
  // `window.location.href` (a full page reload) is used so the cleared
  // session cookies are guaranteed to propagate before the next request
  // hits the server, mirroring the login flow's hard-redirect strategy.
  // The middleware then sees no session and keeps the user on /login.
  // ---------------------------------------------------------------------------
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
    window.location.href = '/login';
  };

  // -------------------------------------------------------------------------
  // Certificate download handler
  // -------------------------------------------------------------------------
  const handleDownloadCertificate = useCallback(async () => {
    if (!user?.id) {
      setCertError('የተጠቃሚ መረጃ አልተገኘም። እባክዎ እንደገና ይግቡ።');
      setCertSuccess(null);
      return;
    }

    setCertLoading(true);
    setCertError(null);
    setCertSuccess(null);

    try {
      const response = await fetch('/api/generate-certificate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (response.status === 401) {
        setCertError(
          payload?.error ||
            'እባክዎ መጀመሪያ ይግቡ — የእርስዎ ክፍለ ጊዜ አልተገኘም።'
        );
        return;
      }

      if (response.status === 400) {
        setCertError(
          payload?.error || 'የተጠቃሚ መለያ (userId) አልተላከም።'
        );
        return;
      }

      if (!response.ok || payload?.eligible === false || payload?.error) {
        setCertError(
          payload?.error ||
            payload?.message ||
            'ሰርቲፊኬቱን ማዘጋጀት አልተቻለም። እባክዎ እንደገና ይሞክሩ።'
        );
        return;
      }

      const certificateUrl: string = payload?.certificateUrl ?? '';
      if (!certificateUrl) {
        setCertError('የሰርቲፊኬቱን አድራሻ ማግኘት አልተቻለም።');
        return;
      }

      const filename = buildCertificateFilename(
        user.full_name || user.email || 'Student'
      );

      const fileRes = await fetch(certificateUrl);
      if (!fileRes.ok) {
        throw new Error(
          `ሰርቲፊኬቱን ማውረድ አልተቻለም (HTTP ${fileRes.status}).`
        );
      }

      const blob = await fileRes.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.rel = 'noopener';
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
      }, 0);

      setCertSuccess(
        `ሰርቲፊኬቱ በተሳካ ሁኔታ ተዘጋጅቷል እና በ${filename} ስም ተቀምጧል።`
      );
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'ያልታወቀ ስህተት ተከስቷል።';
      setCertError(reason);
    } finally {
      setCertLoading(false);
    }
  }, [user?.id, user?.full_name, user?.email]);

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------
  const isPaymentApproved = paymentStatus === 'approved';

  const passedCount = courseProgress.filter((c) => c.status === 'passed').length;
  const allCoursesPassed = passedCount === REQUIRED_COURSES.length;

  const overallProgressPct = Math.round(
    (courseProgress.reduce(
      (acc, c) => acc + Math.min(c.bestPercent, PASS_THRESHOLD_PERCENT),
      0
    ) /
      (REQUIRED_COURSES.length * PASS_THRESHOLD_PERCENT)) *
      100
  );

  // -------------------------------------------------------------------------
  // Loading state (auth)
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const displayName = user?.full_name || user?.email || 'ተማሪ';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        darkMode
          ? 'dark bg-slate-900 text-white'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* ================================================================= */}
      {/* Sticky Header (glassmorphism)                                     */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/20">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 to-emerald-800 dark:from-emerald-300 dark:to-emerald-500 bg-clip-text text-transparent">
                ባሲራ
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 -mt-0.5">
                Basira Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleDarkMode}
              className="relative p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 pl-1 pr-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60">
              <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              <span className="font-medium max-w-[140px] truncate">
                {displayName}
              </span>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors duration-200 disabled:opacity-60"
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">ውጣ</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* Main Content                                                       */}
      {/* ================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-5 sm:mt-6 pb-12">
        {/* ============================================================ */}
        {/* PRIMARY CARD 1 — COMPACT HERO / WELCOME BANNER               */}
        {/* ============================================================ */}
        <div className="relative rounded-2xl overflow-hidden shadow-lg shadow-emerald-950/10 ring-1 ring-emerald-100/60 dark:ring-emerald-900/40">
          {/* Background image + layered overlays */}
          <div className="absolute inset-0">
            <img
              src={HERO_IMAGE_URL}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover scale-105"
            />
            {/* Emerald tint + darkness gradient for legibility */}
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/85 via-emerald-900/70 to-slate-950/80" />
            {/* Subtle decorative glow orbs */}
            <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
          </div>

          {/* Compact content */}
          <div className="relative px-5 sm:px-7 py-6 sm:py-7 flex flex-col gap-3">
            {/* Date badge (glassmorphism) — compact */}
            <div className="self-start inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5">
              <Calendar className="h-4 w-4 text-amber-300" />
              <span className="text-xs font-medium text-white/95 tracking-wide">
                ዛሬ፡ {hijriDate}
              </span>
            </div>

            {/* Greeting — compact */}
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight drop-shadow-sm">
                እንኳን ደህና መጡ፣ {displayName}!
              </h2>
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300" />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* PAYMENT GATE                                                 */}
        {/* ============================================================ */}
        {!paymentLoading && !isPaymentApproved && (
          <>
            <div className="mt-6 rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-900 p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/60">
                  <Lock className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-1">
                    ትምህርቱን ለመጀመር እባክዎ መጀመሪያ ክፍያ ይፈጽሙ።
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200/90 leading-relaxed">
                    የ4 ኪታቦች ትምህርት ለመክፈት እና የምስክር ወረቀትዎን ለማግኘት
                    ክፍያውን ማጠናቀቅ ያስፈልጋል። ከታች ያለውን የክፍያ ቅጽ
                    በመሙላት የደረሰኙን ምስል ይላኩ።
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <PaymentSection
                userId={user?.id ?? ''}
                onPaymentSubmitted={() => {
                  setPaymentStatus('pending');
                }}
              />
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* PRIMARY CARD 2 — COURSE PROGRESS                             */}
        {/* ============================================================ */}
        <div
          className={[
            'mt-6 relative bg-white dark:bg-slate-800 rounded-2xl shadow-md ring-1 ring-emerald-100 dark:ring-emerald-900/40 border border-emerald-100 dark:border-emerald-900/40 p-6 overflow-hidden',
            !isPaymentApproved ? 'opacity-70' : '',
          ].join(' ')}
        >
          {!paymentLoading && !isPaymentApproved && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-[2px]">
              <div className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 px-4 py-2 shadow-lg border border-slate-200 dark:border-slate-700">
                <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  ክፍያ እስኪጸድቅ ድረስ ተቆልፏል
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md shadow-emerald-900/20">
                <Award className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  የትምህርት ሂደት
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {passedCount} / {REQUIRED_COURSES.length} ኪታቦች ተጠናቅቀዋል
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {overallProgressPct}%
              </span>
              <div className="h-2 w-32 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-500"
                  style={{ width: `${overallProgressPct}%` }}
                />
              </div>
            </div>
          </div>

          {progressLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-400" />
              <span className="ml-3 text-sm text-slate-600 dark:text-slate-400">
                ሂደትዎን በመጫን ላይ ነው...
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {courseProgress.map((c) => {
                const isPassed = c.status === 'passed';
                const isInProgress = c.status === 'in_progress';

                const barWidth = Math.max(0, Math.min(100, c.bestPercent));

                const barColor = isPassed
                  ? 'bg-emerald-500'
                  : isInProgress
                  ? 'bg-amber-500'
                  : 'bg-slate-300 dark:bg-slate-600';

                return (
                  <div
                    key={c.slug}
                    className={[
                      'flex flex-col rounded-xl border px-3 py-3 sm:px-4 transition-colors',
                      isPassed
                        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex-shrink-0">
                        {isPassed ? (
                          <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
                        ) : isInProgress ? (
                          <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
                        ) : (
                          <Circle className="h-5 w-5 sm:h-6 sm:w-6 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {c.displayName}
                        </p>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                          {isPassed
                            ? `ተሳክቷል · ${c.bestPercent}%`
                            : isInProgress
                            ? `በሂደት · ${c.bestPercent}% / ${PASS_THRESHOLD_PERCENT}%`
                            : 'አልተጀመረም'}
                        </p>
                      </div>
                      {isPassed && (
                        <span className="hidden sm:inline-flex flex-shrink-0 rounded-full bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5">
                          PASS
                        </span>
                      )}
                    </div>

                    {/* Thin animated progress bar */}
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* PRIMARY CARD 3 — CERTIFICATE FLOW                            */}
        {/* ============================================================ */}
        {!paymentLoading && isPaymentApproved && (
          <>
            {!progressLoading && allCoursesPassed && (
              <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl shadow-md ring-1 ring-emerald-100 dark:ring-emerald-900/40 border border-emerald-100 dark:border-emerald-900/40 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-amber-100 dark:from-emerald-900/40 dark:to-amber-900/40">
                      <GraduationCap className="h-6 w-6 text-emerald-700 dark:text-amber-300" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                      የምስክር ወረቀት
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      አራቱንም ኪታቦች በ{PASS_THRESHOLD_PERCENT}% እና ከዚያ
                      በላይ አጠናቅቀዋል። ክፍያዎም ጸድቋል። አሁን
                      የምስክር ወረቀትዎን ማውረድ ይችላሉ።
                    </p>

                    <button
                      type="button"
                      onClick={handleDownloadCertificate}
                      disabled={certLoading}
                      aria-busy={certLoading}
                      className={[
                        'w-full sm:w-auto inline-flex items-center justify-center gap-2',
                        'px-5 py-3 rounded-xl',
                        'font-bold text-sm tracking-wide',
                        'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700',
                        'text-white ring-1 ring-amber-400/40',
                        'shadow-lg shadow-emerald-950/40',
                        'transition-all duration-200',
                        'hover:from-emerald-600 hover:via-emerald-500 hover:to-emerald-600',
                        'hover:ring-amber-400/70',
                        'active:scale-[0.985]',
                        'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300',
                      ].join(' ')}
                    >
                      {certLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin text-amber-200" />
                          <span>ሰርቲፊኬቱ በመዘጋጀት ላይ ነው...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-5 w-5 text-amber-300" />
                          <span>ሰርቲፊኬቱን አውርድ (PDF)</span>
                        </>
                      )}
                    </button>

                    {certError && !certLoading && (
                      <div
                        role="alert"
                        className="mt-3 flex items-start gap-3 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                        <div className="flex-1">
                          <p className="font-semibold text-red-300">
                            ሰርቲፊኬቱን ማዘጋጀት አልተቻለም
                          </p>
                          <p className="mt-0.5 whitespace-pre-line leading-relaxed text-red-200/90">
                            {certError}
                          </p>
                        </div>
                      </div>
                    )}

                    {certSuccess && !certLoading && !certError && (
                      <div
                        role="status"
                        className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <div className="flex-1">
                          <p className="font-semibold text-emerald-300">
                            ሰርቲፊኬቱ በተሳካ ሁኔታ ተዘጋጅቷል!
                          </p>
                          <p className="mt-0.5 leading-relaxed text-emerald-200/90">
                            {certSuccess}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!progressLoading && !allCoursesPassed && (
              <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl shadow-md ring-1 ring-emerald-100 dark:ring-emerald-900/40 border border-emerald-100 dark:border-emerald-900/40 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/40">
                      <Award className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                      ትምህርቱን ይቀጥሉ 🎓
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      ሰርቲፊኬትዎን ለማግኘት አራቱንም ኪታቦች በ
                      {PASS_THRESHOLD_PERCENT}% እና ከዚያ በላይ
                      ማጠናቀቅ ያስፈልግዎታል። አሁን {passedCount} /{' '}
                      {REQUIRED_COURSES.length} ኪታቦች ተጠናቅቀዋል።
                    </p>
                    <Link
                      href="/courses"
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 px-4 py-2 text-sm font-bold text-white ring-1 ring-amber-400/40 shadow-md hover:from-emerald-600 hover:via-emerald-500 hover:to-emerald-600 transition-all"
                    >
                      <BookOpen className="h-4 w-4" />
                      ኮርሶችን ይቀጥሉ
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* SECONDARY — 4 LEARNING PILLARS                               */}
        {/* ============================================================ */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              የመማሪያ ማዕከላት
            </h3>
            {!paymentLoading && !isPaymentApproved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Lock className="h-3 w-3" />
                ተቆልፏል
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {/* 1. የላቁ ኮርሶች */}
            <Link
              href={isPaymentApproved ? '/courses' : '#'}
              aria-disabled={!isPaymentApproved}
              tabIndex={isPaymentApproved ? 0 : -1}
              className={[
                'group relative bg-white/80 dark:bg-slate-800/70 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 p-4 sm:p-5 transition-all duration-300 touch-manipulation',
                isPaymentApproved
                  ? 'hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 cursor-pointer'
                  : 'opacity-60 pointer-events-none select-none',
              ].join(' ')}
            >
              {!isPaymentApproved && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 px-3 py-1.5 shadow-md border border-slate-200 dark:border-slate-700">
                    <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      ተቆልፏል
                    </span>
                  </div>
                </div>
              )}
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20 mb-3">
                <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                የላቁ ኮርሶች
              </h4>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                የተከፈሉና የላቁ ኮርሶች ከምሁራን ጋር።
              </p>
            </Link>

            {/* 2. የቁርአን ማዕከል */}
            <Link
              href={isPaymentApproved ? '/quran' : '#'}
              aria-disabled={!isPaymentApproved}
              tabIndex={isPaymentApproved ? 0 : -1}
              className={[
                'group relative bg-white/80 dark:bg-slate-800/70 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 p-4 sm:p-5 transition-all duration-300 touch-manipulation',
                isPaymentApproved
                  ? 'hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 cursor-pointer'
                  : 'opacity-60 pointer-events-none select-none',
              ].join(' ')}
            >
              {!isPaymentApproved && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 px-3 py-1.5 shadow-md border border-slate-200 dark:border-slate-700">
                    <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      ተቆልፏል
                    </span>
                  </div>
                </div>
              )}
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 mb-3">
                <Mic className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                የቁርአን ማዕከል
              </h4>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                የቃሪዎች ማዕከል – ተጅዊድና ንባብ ልምምድ።
              </p>
            </Link>

            {/* 3. ዳዕዋዎችና ሙሐደራዎች */}
            <Link
              href={isPaymentApproved ? '/dawah' : '#'}
              aria-disabled={!isPaymentApproved}
              tabIndex={isPaymentApproved ? 0 : -1}
              className={[
                'group relative bg-white/80 dark:bg-slate-800/70 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 p-4 sm:p-5 transition-all duration-300 touch-manipulation',
                isPaymentApproved
                  ? 'hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 cursor-pointer'
                  : 'opacity-60 pointer-events-none select-none',
              ].join(' ')}
            >
              {!isPaymentApproved && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 px-3 py-1.5 shadow-md border border-slate-200 dark:border-slate-700">
                    <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      ተቆልፏል
                    </span>
                  </div>
                </div>
              )}
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 mb-3">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                ዳዕዋዎችና ሙሐደራዎች
              </h4>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                የሀገር ውስጥና ዓለም አቀፍ እስላማዊ ትምህርቶች።
              </p>
            </Link>

            {/* 4. ዲጂታል ቤተ-መጽሐፍት */}
            <Link
              href={isPaymentApproved ? '/library' : '#'}
              aria-disabled={!isPaymentApproved}
              tabIndex={isPaymentApproved ? 0 : -1}
              className={[
                'group relative bg-white/80 dark:bg-slate-800/70 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 p-4 sm:p-5 transition-all duration-300 touch-manipulation',
                isPaymentApproved
                  ? 'hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 cursor-pointer'
                  : 'opacity-60 pointer-events-none select-none',
              ].join(' ')}
            >
              {!isPaymentApproved && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 px-3 py-1.5 shadow-md border border-slate-200 dark:border-slate-700">
                    <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      ተቆልፏል
                    </span>
                  </div>
                </div>
              )}
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/20 mb-3">
                <Library className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                ዲጂታል ቤተ-መጽሐፍት
              </h4>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                ፒዲኤፍ መጻሕፍትና ንባብ ማዕከል።
              </p>
            </Link>
          </div>
        </div>

        {/* ============================================================ */}
        {/* FOOTER — COMPACT TELEGRAM BANNER                             */}
        {/* ============================================================ */}
        {/*
          TODO: Replace the `href="https://t.me/Basira_on"` below with your real Telegram channel link.
          Example:
            href="https://t.me/Basira"
            href="Basira_on"
        */}
        <a
          href="https://t.me/Basira_on"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 group flex items-center gap-3 rounded-xl border border-sky-200/70 dark:border-sky-900/50 bg-sky-50/70 dark:bg-sky-950/30 px-4 py-3 shadow-sm hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 transition-all duration-300"
        >
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg shadow-sm"
            style={{ backgroundColor: '#0088cc' }}
          >
            <Send className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-sky-900 dark:text-sky-100 truncate">
              የቴሌግራም ቻናላችንን ይቀላቀሉ
            </h3>
          </div>
          <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-[#0088cc] px-3 py-1 text-xs font-bold text-white group-hover:bg-[#0077b3] transition-colors">
            Join
          </span>
        </a>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} ባሲራ · Basira
        </p>
      </div>
    </div>
  );
}