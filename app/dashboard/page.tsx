// app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
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
  ShieldCheck,
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
  /**
   * ISO timestamp of the user's signup, sourced from the Supabase auth
   * user object (`user.created_at`). Used to compute the 3-day free
   * trial window. When undefined, the user is treated as "outside the
   * trial" — the payment banner will show as before.
   */
  created_at?: string;
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

// ---------------------------------------------------------------------------
// FREE TRIAL — 3 days from signup.
//
// A student whose auth-user `created_at` is at most 3 days old is
// considered to be inside the free trial window. During the trial:
//   • the "pay now" warning banner is replaced with an informational badge;
//   • course content is unlocked (equivalent to a paid user).
// ---------------------------------------------------------------------------
const FREE_TRIAL_DAYS = 3;

// ---------------------------------------------------------------------------
// COURSE CAPACITY MODEL
// ---------------------------------------------------------------------------
// Total expected questions (i.e. full course capacity) per course slug.
// Progress is measured as (earned score across all attempts) ÷ (course
// capacity) — NOT divided by the questions of only the attempted lessons.
//
// This prevents the "1 lesson passed = whole course passed" bug: scoring
// 3/5 on a single lesson yields ~3–5% overall progress, not 60%.
//
// Update these numbers whenever a course's question bank changes.
// ---------------------------------------------------------------------------
const COURSE_TOTAL_QUESTIONS: Record<string, number> = {
  usul_al_thalatha: 85,
  arbain: 85,
  shurut_as_salah: 65,
  urjuzat: 65,
};

/** Fallback capacity for any slug not present in the map above. */
const DEFAULT_COURSE_TOTAL_QUESTIONS = 80;

/** Resolve the total-question capacity for a given course slug. */
function getCourseCapacity(slug: string): number {
  const explicit = COURSE_TOTAL_QUESTIONS[slug];
  if (typeof explicit === 'number' && explicit > 0) return explicit;
  return DEFAULT_COURSE_TOTAL_QUESTIONS;
}

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
 * AGGREGATION RULE (FIXED):
 *   For each course_id, sum the earned `score` across ALL quiz_results
 *   rows, then divide by the FIXED TOTAL COURSE CAPACITY (the total
 *   expected questions for the full course — see COURSE_TOTAL_QUESTIONS),
 *   NOT by the questions of only the attempted quizzes:
 *
 *       Math.round((sumScore / courseCapacity) * 100)
 *
 *   This reflects the student's overall progress toward completing the
 *   entire course, not just the subset they've attempted so far.
 *
 * STATUS RULES:
 *   • 'passed'      → aggregate percentage >= PASS_THRESHOLD_PERCENT (50%)
 *                     of the FULL course capacity.
 *   • 'in_progress' → at least one quiz row exists for the course, but
 *                     aggregate percentage < 50% of the course capacity.
 *   • 'not_started' → no quiz rows exist for the course at all.
 *
 * The `catalogue` argument drives which books are displayed.
 */
function buildCourseProgress(
  rawRows: any[],
  catalogue: CourseMeta[]
): CourseProgress[] {
  // Aggregate total earned score per course across ALL rows.
  // (totalQuestions from rows is intentionally NOT used for the denominator —
  //  we use the fixed per-course capacity instead.)
  const aggregateByCourse = new Map<
    string,
    { totalScore: number; attemptedQuestions: number }
  >();

  for (const row of rawRows || []) {
    const slug = String(row?.course_id ?? '');
    if (!slug) continue;

    const score = Number(row?.score) || 0;
    const total = Number(row?.total_questions) || 0;

    const current = aggregateByCourse.get(slug) ?? {
      totalScore: 0,
      attemptedQuestions: 0,
    };

    current.totalScore += score;
    current.attemptedQuestions += total;
    aggregateByCourse.set(slug, current);
  }

  return catalogue.map(({ slug, displayName }) => {
    const agg = aggregateByCourse.get(slug);
    const courseCapacity = getCourseCapacity(slug);

    // No quiz attempts recorded for this course at all.
    if (!agg) {
      return {
        slug,
        displayName,
        bestPercent: 0,
        status: 'not_started' as CourseStatus,
      };
    }

    // Progress is measured against the FULL course capacity — this is the
    // core bug fix. Attempting only 1 lesson out of N now yields a
    // proportional (small) percentage instead of an inflated one.
    const aggregatedPercent =
      courseCapacity > 0
        ? Math.min(
            100,
            Math.round((agg.totalScore / courseCapacity) * 100)
          )
        : 0;

    // At least one row exists → the student has engaged with this course.
    // Status is 'passed' only if the aggregate clears the threshold of
    // the FULL course capacity; otherwise it's 'in_progress'.
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
  // USER ROLE — used to conditionally render the admin access cards.
  //
  // Fetched from `profiles.role` after auth verification succeeds. When
  // null/undefined, the admin section is entirely omitted from the DOM.
  // -------------------------------------------------------------------------
  const [userRole, setUserRole] = useState<string | null>(null);

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

  // Certificate download state — retained for the dedicated
  // /dashboard/certificate page flow. The dashboard body no longer triggers
  // this handler directly; it simply links to the certificate page.
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
          // Capture the auth-user `created_at` so the free-trial window
          // can be computed without an extra network round-trip.
          created_at: sessionUser.created_at,
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
  // FETCH USER ROLE (for the conditional admin cards)
  //
  // Runs once the auth state resolves. A failure here is non-fatal: we
  // simply leave `userRole` as null, which keeps the admin section hidden
  // and preserves the standard student view.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.warn(
            '[Dashboard] role fetch error — admin section hidden:',
            error.message
          );
          setUserRole(null);
          return;
        }

        setUserRole(data?.role ? String(data.role) : null);
      } catch (err) {
        if (!cancelled) {
          console.warn(
            '[Dashboard] role fetch unexpected error — admin section hidden:',
            readErrorMessage(err)
          );
          setUserRole(null);
        }
      }
    };

    fetchRole();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
  //
  // NOTE: The dashboard hamburger menu now simply navigates to the dedicated
  // /dashboard/certificate page. This handler is retained for use by that
  // page (or any future caller) and is intentionally NOT invoked from the
  // dashboard UI.
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

  // True only when the profiles table reports the user's role as 'admin'.
  const isAdmin = userRole === 'admin';

  // -------------------------------------------------------------------------
  // FREE TRIAL DERIVATIONS
  //
  //   daysSinceRegistration — whole days elapsed since the auth user was
  //                           created. `null` when the timestamp is missing.
  //   isInFreeTrial         — true while the student is inside the 3-day
  //                           window. Drives the "trial badge" instead of
  //                           the "pay now" warning banner.
  //   hasAccess             — the union of approved payment OR active trial;
  //                           used to unlock course content for both paid
  //                           students and trial users.
  // -------------------------------------------------------------------------
  const daysSinceRegistration: number | null = user?.created_at
    ? Math.floor(
        (Date.now() - new Date(user.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const isInFreeTrial =
    daysSinceRegistration !== null &&
    daysSinceRegistration <= FREE_TRIAL_DAYS;

  // Course content is unlocked for paid users AND for students in trial.
  const hasAccess = isPaymentApproved || isInFreeTrial;

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
            <Image
              src="/logo.png"
              alt="Basira Logo"
              width={40}
              height={40}
              className="rounded-xl object-contain"
            />
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

              {/* Certificate — navigates to the dedicated certificate page */}
              <Link
                href="/dashboard/certificate"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/60">
                  <GraduationCap className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                </span>
                <span>የኔ ሰርቲፊኬት</span>
              </Link>

              {/* Admin Students — only for role === 'admin' */}
              {isAdmin && (
                <Link
                  href="/admins/students"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/60">
                    <ShieldCheck className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                  </span>
                  <span>የተማሪዎች መቆጣጠሪያ (Admin)</span>
                </Link>
              )}

              {/* Admin Payments — only for role === 'admin' */}
              {isAdmin && (
                <Link
                  href="/admin/payments"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/60">
                    <CreditCard className="h-4 w-4 text-rose-700 dark:text-rose-300" />
                  </span>
                  <span>የክፍያዎች መቆጣጠሪያ (Admin)</span>
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* ================================================================= */}
      {/* Main Content                                                       */}
      {/* ================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-5 sm:mt-6 pb-12">
        {/* ============================================================ */}
        {/* ADMIN QUICK-ACCESS SECTION — only when role === 'admin'      */}
        {/* ============================================================ */}
        {isAdmin && (
          <div className="mb-5 sm:mb-6 rounded-2xl border border-indigo-300 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/70 to-indigo-100/40 dark:from-indigo-950/40 dark:to-indigo-900/20 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-md shadow-indigo-900/20">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-extrabold text-indigo-900 dark:text-indigo-100">
                  የአስተዳዳሪ መቆጣጠሪያ ማዕከል
                </p>
                <p className="text-[11px] sm:text-xs text-indigo-800/80 dark:text-indigo-200/75 leading-relaxed">
                  የተማሪዎችን የትምህርት ሂደትና የክፍያ ሁኔታ ይከታተሉ
                </p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 flex-shrink-0">
                ADMIN
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* CARD 1 — Admin Students */}
              <Link
                href="/admins/students"
                className="group relative flex items-start gap-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-900/60 p-4 hover:border-indigo-400 dark:hover:border-indigo-700 hover:shadow-md transition-all duration-300"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/60">
                  <ShieldCheck className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                    የተማሪዎች መቆጣጠሪያ
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    የተማሪዎችን የትምህርት ሂደትና ውጤት ይከታተሉ
                  </p>
                </div>
              </Link>

              {/* CARD 2 — Admin Payments */}
              <Link
                href="/admin/payments"
                className="group relative flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900/60 p-4 hover:border-rose-400 dark:hover:border-rose-700 hover:shadow-md transition-all duration-300"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/60">
                  <CreditCard className="h-5 w-5 text-rose-700 dark:text-rose-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-rose-700 dark:group-hover:text-rose-300 transition-colors">
                    የክፍያዎች መቆጣጠሪያ
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    የተማሪዎችን የክፍያ ደረሰኞች ያጽድቁ ወይም ውድቅ ያድርጉ
                  </p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* FREE-TRIAL BADGE — shown only when unpaid + still in trial    */}
        {/* ============================================================ */}
        {!paymentLoading && paymentStatus === 'none' && isInFreeTrial && (
          <div className="mb-5 sm:mb-6 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/20 p-4 sm:p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/60">
                <Sparkles className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-bold text-emerald-900 dark:text-emerald-100">
                  የ3 ቀን ነፃ የትምህርት ጊዜ ላይ ነዎት
                </p>
                <p className="mt-0.5 text-xs sm:text-sm text-emerald-800/90 dark:text-emerald-200/80 leading-relaxed">
                  ሁሉንም ትምህርቶች በነጻ ለማጥናት ይህ የእርስዎ ጊዜ ነው። ከ 3 ቀን
                  በኋላ ለመቀጠል ክፍያ ያስፈልጋል።
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* DYNAMIC PAYMENT STATUS BANNER — pay-now shown only when      */}
        {/* unpaid AND outside the free-trial window                     */}
        {/* ============================================================ */}
        {!paymentLoading && paymentStatus === 'none' && !isInFreeTrial && (
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
            !hasAccess ? 'opacity-70' : '',
          ].join(' ')}
        >
          {!paymentLoading && !hasAccess && (
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
        {/*                                                              */}
        {/* Only "የላቁ ኮርሶች" is active. The other three hubs are         */}
        {/* marked "በቅርብ ቀን" (Coming Soon) and are not navigable.      */}
        {/* ============================================================ */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              የመማሪያ ማዕከላት
            </h3>
            {!paymentLoading && !hasAccess && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Lock className="h-3 w-3" />
                ተቆልፏል
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {/* ------------------------------------------------------ */}
            {/* 1. የላቁ ኮርሶች — ACTIVE                               */}
            {/* ------------------------------------------------------ */}
            <Link
              href={hasAccess ? '/courses' : '#'}
              aria-disabled={!hasAccess}
              tabIndex={hasAccess ? 0 : -1}
              className={[
                'group relative bg-white/80 dark:bg-slate-800/70 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 p-4 sm:p-5 transition-all duration-300 touch-manipulation',
                hasAccess
                  ? 'hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 cursor-pointer'
                  : 'opacity-60 pointer-events-none select-none',
              ].join(' ')}
            >
              {!hasAccess && (
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

            {/* ------------------------------------------------------ */}
            {/* 2. የቁርአን ማዕከል — COMING SOON                         */}
            {/* ------------------------------------------------------ */}
            <div
              aria-disabled="true"
              aria-label="በቅርብ ቀን"
              className="group relative bg-white/80 dark:bg-slate-800/70 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 p-4 sm:p-5 opacity-80 cursor-not-allowed select-none"
            >
              {/* Coming Soon badge */}
              <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap shadow-sm">
                <Clock className="h-3 w-3" />
                በቅርብ ቀን
              </span>

              {!hasAccess && (
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
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                የቁርአን ማዕከል
              </h4>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                የቃሪዎች ማዕከል – ተጅዊድና ንባብ ልምምድ።
              </p>
            </div>

            {/* ------------------------------------------------------ */}
            {/* 3. ዳዕዋዎችና ሙሐደራዎች — COMING SOON                     */}
            {/* ------------------------------------------------------ */}
            <div
              aria-disabled="true"
              aria-label="በቅርብ ቀን"
              className="group relative bg-white/80 dark:bg-slate-800/70 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 p-4 sm:p-5 opacity-80 cursor-not-allowed select-none"
            >
              {/* Coming Soon badge */}
              <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap shadow-sm">
                <Clock className="h-3 w-3" />
                በቅርብ ቀን
              </span>

              {!hasAccess && (
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
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                ዳዕዋዎችና ሙሐደራዎች
              </h4>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                የሀገር ውስጥና ዓለም አቀፍ እስላማዊ ትምህርቶች።
              </p>
            </div>

            {/* ------------------------------------------------------ */}
            {/* 4. ዲጂታል ቤተ-መጽሐፍት — COMING SOON                    */}
            {/* ------------------------------------------------------ */}
            <div
              aria-disabled="true"
              aria-label="በቅርብ ቀን"
              className="group relative bg-white/80 dark:bg-slate-800/70 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 p-4 sm:p-5 opacity-80 cursor-not-allowed select-none"
            >
              {/* Coming Soon badge */}
              <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap shadow-sm">
                <Clock className="h-3 w-3" />
                በቅርብ ቀን
              </span>

              {!hasAccess && (
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
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                ዲጂታል ቤተ-መጽሐፍት
              </h4>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                ፒዲኤፍ መጻሕፍትና ንባብ ማዕከል።
              </p>
            </div>
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