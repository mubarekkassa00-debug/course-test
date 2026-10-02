// app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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
  Menu,
  X,
  CreditCard,
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
// Types & Constants
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

/** Shape of an entry in the dynamic course catalogue. */
interface CourseMeta {
  slug: string;
  displayName: string;
}

type PaymentStatus = 'none' | 'pending' | 'approved' | 'rejected';

// ---------------------------------------------------------------------------
// Fallback course catalogue (4 required books).
//
// This is used ONLY when the dynamic fetch from Supabase fails, so the
// dashboard never renders empty. When the fetch succeeds, the live list
// replaces this fallback everywhere (progress cards, header count, etc.).
// ---------------------------------------------------------------------------

const REQUIRED_COURSES: CourseMeta[] = [
  { slug: 'usul_al_thalatha', displayName: 'ኡሱሉ ሰላሳ' },
  { slug: 'arbain', displayName: 'አርባኢን ነወዊ' },
  { slug: 'shurut_as_salah', displayName: 'ሹሩጡ ሶላት' },
  { slug: 'urjuzat', displayName: 'ኡርጁዘቱል ሚኢያህ' },
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

/**
 * Build the per-course progress list.
 *
 * AGGREGATION RULE:
 *   For each course_id, sum the earned `score` and the maximum possible
 *   `total_questions` across ALL quiz_results rows, then compute the
 *   aggregate percentage as:
 *
 *       Math.round((sumScore / sumTotalQuestions) * 100)
 *
 *   This reflects the student's overall performance across every attempt
 *   for that course — not just the single best attempt.
 *
 * STATUS RULES:
 *   • 'passed'      → aggregate percentage >= PASS_THRESHOLD_PERCENT (50%)
 *   • 'in_progress' → at least one quiz row exists for the course, but
 *                     aggregate percentage < 50%
 *   • 'not_started' → no quiz rows exist for the course at all
 *
 * The `catalogue` argument drives which books are displayed.
 */
function buildCourseProgress(
  rawRows: any[],
  catalogue: CourseMeta[]
): CourseProgress[] {
  // Aggregate (sum score, sum total_questions) per course across ALL rows.
  const aggregateByCourse = new Map<
    string,
    { totalScore: number; totalQuestions: number }
  >();

  for (const row of rawRows || []) {
    const slug = String(row?.course_id ?? '');
    if (!slug) continue;

    const score = Number(row?.score) || 0;
    const total = Number(row?.total_questions) || 0;

    const current = aggregateByCourse.get(slug) ?? {
      totalScore: 0,
      totalQuestions: 0,
    };

    current.totalScore += score;
    current.totalQuestions += total;
    aggregateByCourse.set(slug, current);
  }

  return catalogue.map(({ slug, displayName }) => {
    const agg = aggregateByCourse.get(slug);

    // No quiz attempts recorded for this course at all.
    if (!agg) {
      return {
        slug,
        displayName,
        bestPercent: 0,
        status: 'not_started' as CourseStatus,
      };
    }

    // Aggregate percentage across all attempts.
    const aggregatedPercent =
      agg.totalQuestions > 0
        ? Math.round((agg.totalScore / agg.totalQuestions) * 100)
        : 0;

    // At least one row exists → the student has engaged with this course.
    // Status is 'passed' only if the aggregate clears the threshold;
    // otherwise it's 'in_progress'.
    let status: CourseStatus = 'in_progress';
    if (aggregatedPercent >= PASS_THRESHOLD_PERCENT) status = 'passed';

    return {
      slug,
      displayName,
      bestPercent: aggregatedPercent,
      status,
    };
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

  // Mobile hamburger menu open/close state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // -------------------------------------------------------------------------
  // DYNAMIC COURSE CATALOGUE
  //
  // Starts with the hardcoded fallback so the UI never renders empty.
  // A background fetch replaces it with the live list from the database.
  // -------------------------------------------------------------------------
  const [courseCatalogue, setCourseCatalogue] =
    useState<CourseMeta[]>(REQUIRED_COURSES);

  // Progress + payment state
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('none');
  const [paymentLoading, setPaymentLoading] = useState(true);

  // Certificate download state
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [certSuccess, setCertSuccess] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Dark mode state & persistence (globally synced)
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // AUTH VERIFICATION — authoritative `getUser()` against Supabase Auth.
  //
  // Why `getUser()` and NOT the `INITIAL_SESSION` event:
  //   With `@supabase/ssr`'s `createBrowserClient`, the session lives in
  //   cookies. The `INITIAL_SESSION` event can fire before the browser
  //   client finishes reading those cookies, momentarily emitting `null`
  //   and causing a false bounce to /login. `getUser()` reads the cookies
  //   directly and validates the JWT with Supabase Auth — no timing race.
  //
  // `onAuthStateChange` is kept ONLY as a sign-out listener (multi-tab
  // cleanup). It never determines the initial auth state.
  // -------------------------------------------------------------------------
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

    const checkUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (error || !user) {
          finalize(false);
          return;
        }

        finalize(true, user);
      } catch (err) {
        if (!cancelled) {
          console.error('[Dashboard] getUser failed:', err);
          finalize(false);
        }
      }
    };

    checkUser();

    // Safety net — if nothing resolves within 5 seconds, bail out.
    safetyTimeout = setTimeout(() => {
      if (!cancelled && !resolved) {
        resolved = true;
        router.replace('/login');
      }
    }, 5000);

    // Sign-out listener only.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
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

  // -------------------------------------------------------------------------
  // FETCH DYNAMIC COURSE CATALOGUE
  //
  // We attempt to read the live list of courses from the database so the
  // dashboard always reflects the current catalogue. If the table is
  // missing, empty, or the query fails for any reason, we silently keep
  // the hardcoded fallback — the UI stays fully functional.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const fetchCatalogue = async () => {
      try {
        // Primary: `courses` table with `slug` + `display_name`.
        const { data, error } = await supabase
          .from('courses')
          .select('slug, display_name, order_index')
          .order('order_index', { ascending: true });

        if (cancelled) return;

        if (error) {
          // Fallback attempt: `books` table with `slug` + `title`.
          const fallback = await supabase
            .from('books')
            .select('slug, title');

          if (cancelled) return;

          if (fallback.error || !fallback.data || fallback.data.length === 0) {
            console.warn(
              '[Dashboard] courses/books fetch failed — using fallback catalogue.',
              error.message,
              fallback.error?.message
            );
            return;
          }

          const mapped = (fallback.data as Array<Record<string, any>>)
            .map((row) => ({
              slug: String(row.slug ?? ''),
              displayName: String(row.title ?? row.slug ?? ''),
            }))
            .filter((c) => c.slug !== '');

          if (mapped.length > 0) {
            setCourseCatalogue(mapped);
          }
          return;
        }

        if (!data || data.length === 0) {
          console.warn(
            '[Dashboard] courses table returned no rows — using fallback catalogue.'
          );
          return;
        }

        const mapped = (data as Array<Record<string, any>>)
          .map((row) => ({
            slug: String(row.slug ?? ''),
            displayName: String(row.display_name ?? row.slug ?? ''),
          }))
          .filter((c) => c.slug !== '');

        if (mapped.length > 0) {
          setCourseCatalogue(mapped);
        }
      } catch (err) {
        console.warn(
          '[Dashboard] catalogue fetch unexpected error — using fallback:',
          readErrorMessage(err)
        );
      }
    };

    fetchCatalogue();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------------------------
  // FETCH COURSE PROGRESS
  //
  // Depends on both `user.id` and the current `courseCatalogue`. If the
  // catalogue is later replaced with the live list, progress recomputes
  // against the new slug set.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const fetchProgress = async () => {
      setProgressLoading(true);
      try {
        const slugs = courseCatalogue.map((c) => c.slug);

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
          setCourseProgress(buildCourseProgress([], courseCatalogue));
          return;
        }

        setCourseProgress(
          buildCourseProgress((data ?? []) as any[], courseCatalogue)
        );
      } catch (err) {
        if (!cancelled) {
          console.error(
            '[Dashboard] progress unexpected error:',
            readErrorMessage(err)
          );
          setCourseProgress(buildCourseProgress([], courseCatalogue));
        }
      } finally {
        if (!cancelled) setProgressLoading(false);
      }
    };

    fetchProgress();
    return () => {
      cancelled = true;
    };
  }, [user?.id, courseCatalogue]);

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

  // -------------------------------------------------------------------------
  // LOGOUT — clears the Supabase session and hard-redirects to /login.
  // -------------------------------------------------------------------------
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

  // Total number of courses comes from the live catalogue (falls back to 4).
  const totalCoursesCount = courseCatalogue.length;

  const passedCount = courseProgress.filter(
    (c) => c.status === 'passed'
  ).length;

  // -------------------------------------------------------------------------
  // Overall progress = plain average of every course's aggregated percentage.
  // -------------------------------------------------------------------------
  const overallProgressPct =
    totalCoursesCount > 0
      ? Math.round(
          courseProgress.reduce((acc, c) => acc + c.bestPercent, 0) /
            totalCoursesCount
        )
      : 0;

  // -------------------------------------------------------------------------
  // Loading state — shown while auth is being verified or user is unknown.
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const displayName = user.full_name || user.email || 'ተማሪ';

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
            {/* Mobile hamburger button */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden relative p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

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

        {/* Mobile dropdown navigation panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200/60 dark:border-slate-800/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-1">
              <Link
                href="/dashboard/payment"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/60">
                  <CreditCard className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                </span>
                <span>የክፍያ ሁኔታ</span>
              </Link>

              {/* NEW — Certificate download moved into the mobile drawer */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleDownloadCertificate();
                }}
                disabled={certLoading}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/60">
                  {certLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-700 dark:text-amber-300" />
                  ) : (
                    <GraduationCap className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  )}
                </span>
                <span>{certLoading ? 'በመዘጋጀት ላይ...' : 'የኔ ሰርቲፊኬት'}</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* ================================================================= */}
      {/* Main Content                                                       */}
      {/* ================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-5 sm:mt-6 pb-12">
        {/* ============================================================ */}
        {/* DYNAMIC PAYMENT STATUS BANNER                                 */}
        {/* ============================================================ */}
        {!paymentLoading && paymentStatus === 'none' && (
          <div className="mb-5 sm:mb-6 rounded-2xl border border-amber-300 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20 p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/60">
                  <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-bold text-amber-900 dark:text-amber-100">
                    ትምህርቶችን ሙሉ በሙሉ ለመክፈት ክፍያ ይፈጽሙ
                  </p>
                  <p className="mt-0.5 text-xs sm:text-sm text-amber-800/90 dark:text-amber-200/80 leading-relaxed">
                    ክፍያዎን አጠናቀው ሁሉንም ትምህርቶች፣ ዲጂታል ቤተ-መጽሐፍት እና
                    ሰርቲፊኬት ይክፈቱ።
                  </p>
                </div>
              </div>

              <Link
                href="/dashboard/payment"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-900/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 flex-shrink-0"
              >
                አሁኑኑ ይክፈሉ
              </Link>
            </div>
          </div>
        )}

        {!paymentLoading && paymentStatus === 'pending' && (
          <div className="mb-5 sm:mb-6 rounded-2xl border border-sky-300 dark:border-sky-800 bg-gradient-to-r from-sky-50 to-sky-100/60 dark:from-sky-950/40 dark:to-sky-900/20 p-4 sm:p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/60">
                <Clock className="h-5 w-5 text-sky-700 dark:text-sky-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-bold text-sky-900 dark:text-sky-100">
                  ⏳ የላኩት ደረሰኝ በመመርመር ላይ ነው!
                </p>
                <p className="mt-0.5 text-xs sm:text-sm text-sky-800/90 dark:text-sky-200/80 leading-relaxed">
                  አድሚኑ እንደሚያረጋግጥልዎ ሙሉ ትምህርቶቹ ይከፈታሉ። እባክዎ በትዕግስት
                  ይጠብቁ።
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CERTIFICATE DOWNLOAD ERROR / SUCCESS TOASTS                  */}
        {/*                                                              */}
        {/* The big certificate card has been moved into the mobile      */}
        {/* hamburger drawer. Only the small inline toasts remain here  */}
        {/* so the student gets feedback when they tap the menu item.   */}
        {/* ============================================================ */}
        {certError && !certLoading && (
          <div
            role="alert"
            className="mb-5 sm:mb-6 flex items-start gap-3 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
            <div className="flex-1">
              <p className="font-semibold">
                ሰርቲፊኬቱን ማዘጋጀት አልተቻለም
              </p>
              <p className="mt-0.5 whitespace-pre-line leading-relaxed">
                {certError}
              </p>
              <button
                type="button"
                onClick={() => setCertError(null)}
                className="mt-2 text-xs font-semibold underline hover:no-underline"
              >
                ዝጋ
              </button>
            </div>
          </div>
        )}

        {certSuccess && !certLoading && !certError && (
          <div
            role="status"
            className="mb-5 sm:mb-6 flex items-start gap-3 rounded-xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <div className="flex-1">
              <p className="font-semibold">
                ሰርቲፊኬቱ በተሳካ ሁኔታ ተዘጋጅቷል!
              </p>
              <p className="mt-0.5 leading-relaxed">{certSuccess}</p>
              <button
                type="button"
                onClick={() => setCertSuccess(null)}
                className="mt-2 text-xs font-semibold underline hover:no-underline"
              >
                ዝጋ
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PRIMARY CARD 1 — COMPACT HERO / WELCOME BANNER               */}
        {/* ============================================================ */}
        <div className="relative rounded-2xl overflow-hidden shadow-lg shadow-emerald-950/10 ring-1 ring-emerald-100/60 dark:ring-emerald-900/40">
          <div className="absolute inset-0">
            <img
              src={HERO_IMAGE_URL}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/85 via-emerald-900/70 to-slate-950/80" />
            <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
          </div>

          <div className="relative px-5 sm:px-7 py-6 sm:py-7 flex flex-col gap-3">
            <div className="self-start inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5">
              <Calendar className="h-4 w-4 text-amber-300" />
              <span className="text-xs font-medium text-white/95 tracking-wide">
                ዛሬ፡ {hijriDate}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight drop-shadow-sm">
                እንኳን ደህና መጡ፣ {displayName}!
              </h2>
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300" />
            </div>
          </div>
        </div>

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
                  {passedCount} / {totalCoursesCount} ኪታቦች ተጠናቅቀዋል
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