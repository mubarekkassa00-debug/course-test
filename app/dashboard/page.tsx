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

  // ---------- Dark mode state & persistence ----------
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

  // ---------- Auth ----------
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) {
          setUser({
            id: authUser.id,
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name,
          });
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Error fetching user:', readErrorMessage(error));
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
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

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
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
      // -------------------------------------------------------------
      // 1. POST to the API with the logged-in user's ID in the body.
      // -------------------------------------------------------------
      const response = await fetch('/api/generate-certificate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      // -------------------------------------------------------------
      // 2. Handle auth / server errors. The API always returns JSON,
      //    even on non-2xx responses.
      // -------------------------------------------------------------
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

      // -------------------------------------------------------------
      // 3. Force a direct PDF download (avoids opening in a preview
      //    tab and works uniformly across browsers).
      // -------------------------------------------------------------
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
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
              <GraduationCap className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                በሲራ
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Basira Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={toggleDarkMode}
              className="relative z-50 p-3 touch-manipulation cursor-pointer rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              <span className="font-medium">
                {user?.full_name || user?.email || 'ተማሪ'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors duration-200 disabled:opacity-60"
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pb-12">
        {/* ============================================================ */}
        {/* WELCOME BANNER (Hijri date on top, greeting below)           */}
        {/* ============================================================ */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-emerald-100 dark:border-slate-700 p-6 sm:p-8 flex flex-col gap-4">
          <div className="self-start inline-flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl px-4 py-2">
            <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              ዛሬ፡ {hijriDate}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            እንኳን ደህና መጡ፣ {user?.full_name || 'ተማሪ'}!{' '}
            <Sparkles className="inline h-6 w-6 text-amber-400" />
          </h2>
        </div>

        {/* ============================================================ */}
        {/* TELEGRAM CHANNEL CARD                                        */}
        {/* ============================================================ */}
        {/*
          TODO: Replace the `href="#"` below with your real Telegram channel link.
          Example:
            href="https://t.me/YourChannelName"
            href="YOUR_TELEGRAM_LINK_HERE"
        */}
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 group block rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-gradient-to-br from-sky-50 via-white to-sky-50 dark:from-sky-950/40 dark:via-slate-800 dark:to-sky-950/40 p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl shadow-sm"
              style={{ backgroundColor: '#0088cc' }}
            >
              <Send className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-sky-900 dark:text-sky-100">
                የቴሌግራም ቻናላችንን ይቀላቀሉ
              </h3>
              <p className="mt-0.5 text-xs sm:text-sm text-sky-800/80 dark:text-sky-200/80">
                አዳዲስ ትምህርቶችንና ማሳሰቢያዎችን በቴሌግራም ያግኙ።
              </p>
            </div>
            <span className="hidden sm:inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-[#0088cc] px-3 py-1.5 text-xs font-bold text-white group-hover:bg-[#0077b3] transition-colors">
              Join
            </span>
          </div>
        </a>

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
        {/* COURSE PROGRESS                                              */}
        {/* ============================================================ */}
        <div
          className={[
            'mt-6 relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 overflow-hidden',
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
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
                <Award className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
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
                return (
                  <div
                    key={c.slug}
                    className={[
                      'flex items-center gap-2 sm:gap-3 rounded-xl border px-3 py-3 sm:px-4 transition-colors',
                      isPassed
                        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40',
                    ].join(' ')}
                  >
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
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* CERTIFICATE FLOW                                             */}
        {/* ============================================================ */}
        {!paymentLoading && isPaymentApproved && (
          <>
            {!progressLoading && allCoursesPassed && (
              <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/50 p-6">
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
              <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700/60">
                      <Award className="h-6 w-6 text-slate-500 dark:text-slate-300" />
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
        {/* 4 LEARNING PILLARS (2-column grid)                          */}
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
                'group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 transition-all duration-300 touch-manipulation',
                isPaymentApproved
                  ? 'hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-700 cursor-pointer'
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
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Lock className="h-3 w-3" />
                  የተከፈለ
                </span>
              </div>
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20 mb-3 sm:mb-4">
                <BookOpen className="h-6 w-6 sm:h-7 sm:w-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                የላቁ ኮርሶች
              </h4>
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                የተከፈሉና የላቁ ኮርሶች ከምሁራን ጋር።
              </p>
            </Link>

            {/* 2. የቁርአን ማዕከል */}
            <Link
              href={isPaymentApproved ? '/quran' : '#'}
              aria-disabled={!isPaymentApproved}
              tabIndex={isPaymentApproved ? 0 : -1}
              className={[
                'group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 transition-all duration-300 touch-manipulation',
                isPaymentApproved
                  ? 'hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-700 cursor-pointer'
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
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 mb-3 sm:mb-4">
                <Mic className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h4 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                የቁርአን ማዕከል
              </h4>
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                የቃሪዎች ማዕከል – ተጅዊድና ንባብ ልምምድ።
              </p>
            </Link>

            {/* 3. ዳዕዋዎችና ሙሐደራዎች */}
            <Link
              href={isPaymentApproved ? '/dawah' : '#'}
              aria-disabled={!isPaymentApproved}
              tabIndex={isPaymentApproved ? 0 : -1}
              className={[
                'group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 transition-all duration-300 touch-manipulation',
                isPaymentApproved
                  ? 'hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-700 cursor-pointer'
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
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 mb-3 sm:mb-4">
                <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                ዳዕዋዎችና ሙሐደራዎች
              </h4>
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                የሀገር ውስጥና ዓለም አቀፍ እስላማዊ ትምህርቶች።
              </p>
            </Link>

            {/* 4. ዲጂታል ቤተ-መጽሐፍት */}
            <Link
              href={isPaymentApproved ? '/library' : '#'}
              aria-disabled={!isPaymentApproved}
              tabIndex={isPaymentApproved ? 0 : -1}
              className={[
                'group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 transition-all duration-300 touch-manipulation',
                isPaymentApproved
                  ? 'hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-700 cursor-pointer'
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
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-900/20 mb-3 sm:mb-4">
                <Library className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                ዲጂታል ቤተ-መጽሐፍት
              </h4>
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                ፒዲኤፍ መጻሕፍትና ንባብ ማዕከል።
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}