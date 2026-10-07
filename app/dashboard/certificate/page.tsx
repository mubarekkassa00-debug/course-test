// app/dashboard/certificate/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  GraduationCap,
  Loader2,
  Lock,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  Send,
  User as UserIcon,
  CreditCard,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants — Basira's 4 required Kitabs
// ---------------------------------------------------------------------------
const REQUIRED_COURSES: { slug: string; displayName: string }[] = [
  { slug: 'usul_al_thalatha', displayName: 'ኡሱሉ ሰላሳ' },
  { slug: 'arbain', displayName: 'አርባኢን ነወዊ' },
  { slug: 'shurut_as_salah', displayName: 'ሹሩጡ ሶላት' },
  { slug: 'urjuzat', displayName: 'ኡርጁዘቱል ሚኢያህ' },
];

/**
 * Exact curriculum capacity (in questions) per course slug:
 *   (lessons × 5) + 30 final-exam questions
 * Must match the dashboard's model so eligibility decisions are consistent.
 */
const COURSE_CAPACITY: Record<string, number> = {
  usul_al_thalatha: 85, // 11×5 + 30
  arbain: 85, // 11×5 + 30
  shurut_as_salah: 65, //  7×5 + 30
  urjuzat: 155, // 25×5 + 30
};

const DEFAULT_COURSE_CAPACITY = 85;
const PASS_THRESHOLD_PERCENT = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PaymentStatus = 'none' | 'pending' | 'approved' | 'rejected';

interface CourseStatusEntry {
  slug: string;
  displayName: string;
  percent: number;
  /** Total possible score (capacity) for this course. Used to guard against division-by-zero. */
  totalMaxScore: number;
  /** Raw earned score for this course (sum of best `score` per quiz row). */
  earnedScore: number;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getCourseCapacity(slug: string): number {
  const explicit = COURSE_CAPACITY[slug];
  if (typeof explicit === 'number' && explicit > 0) return explicit;
  return DEFAULT_COURSE_CAPACITY;
}

/**
 * Build a per-course status entry from raw `quiz_results` rows.
 *
 * The percentage is computed with a strict `safeTotalMax > 0` guard so a
 * zero-capacity course can never produce NaN / Infinity. A course is only
 * considered passed when it actually has capacity AND the earned percentage
 * meets the pass threshold.
 */
function buildCourseStatuses(rawRows: any[]): CourseStatusEntry[] {
  const earnedByCourse = new Map<string, number>();

  for (const row of rawRows || []) {
    const slug = String(row?.course_id ?? '');
    if (!slug) continue;
    const score = Number(row?.score) || 0;
    earnedByCourse.set(slug, (earnedByCourse.get(slug) ?? 0) + score);
  }

  return REQUIRED_COURSES.map(({ slug, displayName }) => {
    const earned = earnedByCourse.get(slug) ?? 0;
    const totalMaxScore = getCourseCapacity(slug);

    // ---- Division-by-zero guard ----
    // Coerce any non-finite / missing value to 0, then guard the division.
    const safeTotalMax = totalMaxScore || 0;
    const percentage =
      safeTotalMax > 0
        ? Math.min(100, Math.round((earned / safeTotalMax) * 100))
        : 0;

    return {
      slug,
      displayName,
      percent: percentage,
      totalMaxScore: safeTotalMax,
      earnedScore: earned,
      // Eligibility requires BOTH a real capacity AND a passing percentage.
      passed:
        safeTotalMax > 0 && percentage >= PASS_THRESHOLD_PERCENT,
    };
  });
}

function buildCertificateFilename(studentName: string): string {
  const safe = studentName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '');
  return `Basira_Certificate_${safe || 'Student'}.pdf`;
}

function readErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const anyErr = err as { message?: unknown };
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

/**
 * Extract the first non-empty string from a list of candidates.
 * Used to pick the best display name from multiple possible sources.
 */
function pickFirstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function CertificatePage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('none');
  const [courseStatuses, setCourseStatuses] = useState<CourseStatusEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [certSuccess, setCertSuccess] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Dark-mode sync — mirrors the dashboard so this standalone page renders
  // correctly when opened directly.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const stored = localStorage.getItem('basira-theme');
    let isDark = false;
    if (stored === 'dark') isDark = true;
    else if (stored === 'light') isDark = false;
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches)
      isDark = true;

    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  // -------------------------------------------------------------------------
  // AUTH GUARD + DISPLAY NAME RESOLUTION
  //
  // Name priority chain (first non-empty wins):
  //   1. profiles.full_name              ← PRIMARY (source of truth)
  //   2. user_metadata.full_name         ← auth-provided fallback
  //   3. 'Ali'                            ← last resort (per product decision)
  //
  // NOTE: We deliberately query only `full_name` (not `display_name`)
  //       because the profiles table in this environment does not expose a
  //       `display_name` column.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const checkUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (error || !user) {
          router.replace('/login');
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email ?? null);

        // ---- 1. Query the profiles table (only `full_name`). ----
        let profileFullName = '';

        try {
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle();

          if (profileErr) {
            console.warn(
              '[Certificate] profiles lookup warning:',
              profileErr.message
            );
          } else if (profile) {
            profileFullName = pickFirstNonEmptyString(
              (profile as any).full_name
            );
          }
        } catch (profileCatch) {
          console.warn(
            '[Certificate] profiles lookup unexpected error:',
            readErrorMessage(profileCatch)
          );
        }

        // ---- 2. Auth user_metadata.full_name fallback. ----
        const metaFullName = pickFirstNonEmptyString(
          user.user_metadata?.full_name
        );

        // ---- 3. Resolve using the documented priority chain. ----
        const studentName =
          profileFullName || metaFullName || 'Ali';

        if (!cancelled) {
          setUserFullName(studentName);
          setAuthLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Certificate] auth failed:', err);
          router.replace('/login');
        }
      }
    };

    checkUser();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // -------------------------------------------------------------------------
  // DATA FETCH — payment status + quiz results
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const loadAll = async () => {
      setDataLoading(true);

      // ---- Payment status ----
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('status, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (cancelled) return;

        if (error) {
          console.warn('[Certificate] payment query error:', error.message);
          setPaymentStatus('none');
        } else if (!data || data.length === 0) {
          setPaymentStatus('none');
        } else {
          const s = String(data[0]?.status ?? '').toLowerCase();
          if (s === 'approved') setPaymentStatus('approved');
          else if (s === 'rejected') setPaymentStatus('rejected');
          else setPaymentStatus('pending');
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(
            '[Certificate] payment unexpected error:',
            readErrorMessage(err)
          );
          setPaymentStatus('none');
        }
      }

      // ---- Quiz results ----
      try {
        const slugs = REQUIRED_COURSES.map((c) => c.slug);
        const { data, error } = await supabase
          .from('quiz_results')
          .select('course_id, score, total_questions')
          .eq('user_id', userId)
          .in('course_id', slugs);

        if (cancelled) return;

        if (error) {
          console.warn('[Certificate] quiz query error:', error.message);
          setCourseStatuses(buildCourseStatuses([]));
        } else {
          setCourseStatuses(buildCourseStatuses((data ?? []) as any[]));
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(
            '[Certificate] quiz unexpected error:',
            readErrorMessage(err)
          );
          setCourseStatuses(buildCourseStatuses([]));
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // -------------------------------------------------------------------------
  // Derived — eligibility + system-wide score
  // -------------------------------------------------------------------------
  const isPaymentApproved = paymentStatus === 'approved';

  const passedCount = useMemo(
    () => courseStatuses.filter((c) => c.passed).length,
    [courseStatuses]
  );

  // `allCoursesPassed` is true only when every required course has a real
  // capacity (> 0) and meets the pass threshold — see `buildCourseStatuses`.
  // The `safeTotalMax > 0` guard inside `buildCourseStatuses` guarantees
  // that a zero/undefined capacity can never be treated as "passed".
  const allCoursesPassed =
    courseStatuses.length === REQUIRED_COURSES.length &&
    passedCount === REQUIRED_COURSES.length;

  const isEligible = isPaymentApproved && allCoursesPassed;

  // ---- System-wide score (used for the eligibility warning text) ----
  // Summed across the four required courses. `safeTotalMax` is guarded so a
  // missing / zero capacity can never produce NaN / Infinity.
  const systemEarnedScore = courseStatuses.reduce(
    (acc, c) => acc + (Number(c.earnedScore) || 0),
    0
  );
  const systemTotalMaxScore = courseStatuses.reduce(
    (acc, c) => acc + (Number(c.totalMaxScore) || 0),
    0
  );
  const safeTotalMax = systemTotalMaxScore || 0;
  const systemPercentage =
    safeTotalMax > 0
      ? Math.round((systemEarnedScore / safeTotalMax) * 100)
      : 0;

  // Final display name: profile-based name → email prefix → 'ተማሪ'.
  // (userFullName is already resolved to 'Ali' if the profile + metadata
  // are both missing — see the auth guard above.)
  const displayName =
    userFullName || userEmail?.split('@')[0] || 'ተማሪ';

  // -------------------------------------------------------------------------
  // DOWNLOAD HANDLER
  // -------------------------------------------------------------------------
  const handleDownload = useCallback(async () => {
    if (!userId) {
      setCertError('የተጠቃሚ መረጃ አልተገኘም። እባክዎ እንደገና ይግቡ።');
      setCertSuccess(null);
      return;
    }
    if (!isEligible) {
      setCertError(
        'ሰርቲፊኬቱን ለማውረድ መጀመሪያ ሁሉንም ትምህርቶች ማጠናቀቅ እና ክፍያዎን ማጽደቅ ያስፈልጋል።'
      );
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
        body: JSON.stringify({ userId }),
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

      const filename = buildCertificateFilename(displayName);

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
  }, [userId, isEligible, displayName]);

  // -------------------------------------------------------------------------
  // LOADING
  // -------------------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            በማረጋገጥ ላይ ነው...
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-300">
      {/* ================================================================= */}
      {/* Sticky Header                                                     */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/20 flex-shrink-0">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight truncate bg-gradient-to-r from-emerald-600 to-emerald-800 dark:from-emerald-300 dark:to-emerald-500 bg-clip-text text-transparent">
                የኔ ሰርቲፊኬት
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Basira · Certificate
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 sm:px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">ወደ ዳሽቦርድ ተመለስ</span>
            <span className="sm:hidden">ተመለስ</span>
          </Link>
        </div>
      </header>

      {/* ================================================================= */}
      {/* Main                                                              */}
      {/* ================================================================= */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* ---------- Feedback toasts ---------- */}
        {certError && !certLoading && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
            <div className="flex-1">
              <p className="font-semibold">ሰርቲፊኬቱን ማዘጋጀት አልተቻለም</p>
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
            className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
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

        {/* ---------- Loading data ---------- */}
        {dataLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                ውሂብዎን በመጫን ላይ ነው...
              </p>
            </div>
          </div>
        ) : !isEligible ? (
          /* ============================================================ */
          /* NOT ELIGIBLE — friendly guidance card                         */
          /* ============================================================ */
          <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/60">
                <Lock className="h-7 w-7 text-amber-700 dark:text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-amber-900 dark:text-amber-100 mb-2">
                  ሰርቲፊኬትዎ እስኪዘጋጅ ድረስ ይጠብቁ
                </h2>
                <p className="text-sm text-amber-800/90 dark:text-amber-200/85 leading-relaxed mb-3">
                  ሰርቲፊኬትዎን ለማግኘት ሁሉንም 4 ኪታቦች በማጠናቀቅ{' '}
                  <span className="font-semibold">
                    50% እና ከዚያ በላይ
                  </span>{' '}
                  ማግኘት እንዲሁም ክፍያዎ ማጽደቅ ይኖርብዎታል።
                </p>

                {/* Current system-wide score snapshot */}
                <p className="text-xs sm:text-sm font-semibold text-amber-900/90 dark:text-amber-100/85 leading-relaxed mb-5">
                  የአሁኑ ውጤት: {systemEarnedScore} / {safeTotalMax} (
                  {systemPercentage}%)
                </p>

                {/* Checklist */}
                <div className="space-y-3">
                  {/* Payment check */}
                  <EligibilityRow
                    ok={isPaymentApproved}
                    label="የክፍያ ማጽደቅ"
                    detail={
                      isPaymentApproved
                        ? 'ክፍያዎ ተጸድቋል'
                        : paymentStatus === 'pending'
                        ? 'የክፍያ ማረጋገጫ በመጠበቅ ላይ'
                        : paymentStatus === 'rejected'
                        ? 'ክፍያዎ ተመልሷል — እባክዎ እንደገና ይመልከቱ'
                        : 'እስካሁን ክፍያ አልፈጸሙም'
                    }
                  />

                  {/* Course checks */}
                  {courseStatuses.map((c) => (
                    <EligibilityRow
                      key={c.slug}
                      ok={c.passed}
                      label={c.displayName}
                      detail={
                        c.passed
                          ? `ተሳክቷል · ${c.percent}%`
                          : `በሂደት · ${c.percent}% / ${PASS_THRESHOLD_PERCENT}%`
                      }
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  {!isPaymentApproved && (
                    <Link
                      href="/dashboard/payment"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-900/20 transition-colors"
                    >
                      <CreditCard className="h-4 w-4" />
                      የክፍያ ሁኔታ
                    </Link>
                  )}
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white/70 dark:bg-slate-900/40 px-4 py-2.5 text-sm font-bold text-amber-800 dark:text-amber-200 hover:bg-white dark:hover:bg-slate-900 transition-colors"
                  >
                    <BookOpen className="h-4 w-4" />
                    ትምህርቶችን ቀጥል
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* ELIGIBLE — beautiful certificate preview card                 */
          /* ============================================================ */
          <div className="space-y-6">
            {/* Celebration badge */}
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-1.5 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 shadow-sm">
                <Sparkles className="h-4 w-4" />
                🎉 የባሲራ ትምህርት ማጠናቀቂያ ምስክር ወረቀት
              </span>
            </div>

            {/* Certificate preview */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-emerald-950/10 ring-1 ring-emerald-100/60 dark:ring-emerald-900/40">
              {/* Decorative background */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/40" />
              <div className="absolute -top-24 -right-24 h-60 w-60 rounded-full bg-amber-300/30 dark:bg-amber-500/10 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 h-60 w-60 rounded-full bg-emerald-300/30 dark:bg-emerald-500/10 blur-3xl" />

              {/* Inner frame */}
              <div className="relative p-6 sm:p-10">
                {/* Double border ornament */}
                <div className="rounded-2xl border-2 border-emerald-300/60 dark:border-emerald-800/60 p-5 sm:p-8">
                  <div className="rounded-xl border border-amber-300/70 dark:border-amber-800/50 bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm px-5 py-8 sm:px-10 sm:py-12 text-center">
                    {/* Award icon */}
                    <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-900/25">
                      <Award className="h-10 w-10 text-white" />
                    </div>

                    <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400 mb-3">
                      የባሲራ ትምህርት ማጠናቀቂያ
                    </p>

                    <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
                      ምስክር ወረቀት
                    </h2>

                    <div className="mx-auto my-5 h-px w-24 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      ይህ ሰርቲፊኬት ለ
                    </p>

                    <p className="text-xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 break-words mb-2">
                      {displayName}
                    </p>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
                      በባሲራ (Basira) የኦንላይን እስላማዊ ትምህርት መድረክ የሚከተሉትን
                      ኪታቦች በተሳካ ሁኔታ ማጠናቀቁን ያረጋግጣል፡
                    </p>

                    {/* Completed courses grid */}
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto text-left">
                      {REQUIRED_COURSES.map((course) => (
                        <div
                          key={course.slug}
                          className="flex items-center gap-3 rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 px-4 py-3"
                        >
                          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 truncate">
                            {course.displayName}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        በባሲራ የትምህርት ክፍል የተረጋገጠ ·{' '}
                        {new Date().getFullYear()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action panel */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/60">
                    <Download className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      ሰርቲፊኬትዎን ያውርዱ
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      የ PDF ፋይሉ በስምዎ ተቀምጦ ወዲያውኑ ይወርዳል።
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={certLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-900/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {certLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      በመዘጋጀት ላይ...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      ሰርቲፊኬት አውርድ (PDF)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------- Telegram footer ---------- */}
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

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} ባሲራ · Basira
        </p>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent — eligibility checklist row
// ---------------------------------------------------------------------------
function EligibilityRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
        ok
          ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30'
          : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40',
      ].join(' ')}
    >
      {ok ? (
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Circle className="h-5 w-5 flex-shrink-0 text-slate-300 dark:text-slate-600" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
          {label}
        </p>
        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
          {detail}
        </p>
      </div>
      {ok ? (
        <span className="hidden sm:inline-flex flex-shrink-0 rounded-full bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5">
          PASS
        </span>
      ) : (
        <Clock className="hidden sm:inline-flex h-4 w-4 text-amber-500 flex-shrink-0" />
      )}
    </div>
  );
}