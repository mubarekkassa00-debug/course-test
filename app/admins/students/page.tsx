// app/admins/students/page.tsx
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Search,
  Download,
  CheckCircle,
  BookOpen,
  Phone,
  Mail,
  Loader2,
  X,
  Users,
  RefreshCw,
  ChevronRight,
  Calendar,
  Award,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  GraduationCap,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Supabase browser client (module-level singleton)
// ---------------------------------------------------------------------------
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---------------------------------------------------------------------------
// Constants — the 4 required Kitabs of Basira
// ---------------------------------------------------------------------------
const REQUIRED_COURSES: { slug: string; displayName: string }[] = [
  { slug: 'usul_al_thalatha', displayName: 'ኡሱሉ ሰላሳ' },
  { slug: 'arbain', displayName: 'አርባኢን ነወዊ' },
  { slug: 'shurut_as_salah', displayName: 'ሹሩጡ ሶላት' },
  { slug: 'urjuzat', displayName: 'ኡርጁዘቱል ሚኢያህ' },
];

const COURSE_NAME_BY_SLUG = new Map(
  REQUIRED_COURSES.map((c) => [c.slug, c.displayName])
);

const PASS_THRESHOLD_PERCENT = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  created_at: string | null;
}

interface QuizRow {
  user_id: string;
  course_id: string;
  score: number | null;
  total_questions: number | null;
  created_at: string | null;
}

interface LessonEntry {
  lessonNumber: number;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  date: string | null;
}

interface CourseBreakdown {
  courseId: string;
  courseName: string;
  lessons: LessonEntry[];
  bestPercent: number;
  averagePercent: number;
  passed: boolean;
  lastDate: string | null;
}

interface StudentRow {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  registeredAt: string | null;
  role: string;
  totalCourses: number;
  passedCount: number;
  progressPercent: number;
  averageScore: number;
  attemptsCount: number;
  currentCourseName: string | null;
  currentLessonNumber: number | null;
  breakdown: CourseBreakdown[];
}

type FilterKey = 'all' | 'in_progress' | 'completed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePercent(score: unknown, total: unknown): number {
  const s = Number(score) || 0;
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.round((s / t) * 100);
}

function formatDateAmh(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
  } catch {
    return '—';
  }
}

function describeError(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;

  if (typeof err === 'object') {
    const e = err as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      error_description?: unknown;
      status?: unknown;
    };

    const parts: string[] = [];
    if (e.message) parts.push(`Message: ${String(e.message)}`);
    if (e.code) parts.push(`Code: ${String(e.code)}`);
    if (e.details) parts.push(`Details: ${String(e.details)}`);
    if (e.hint) parts.push(`Hint: ${String(e.hint)}`);
    if (e.error_description)
      parts.push(`Desc: ${String(e.error_description)}`);
    if (e.status) parts.push(`Status: ${String(e.status)}`);

    if (parts.length > 0) return parts.join(' | ');

    try {
      return JSON.stringify(err);
    } catch {
      return 'Unserializable error object';
    }
  }

  return String(err);
}

function buildBreakdown(rows: QuizRow[]): CourseBreakdown[] {
  const byCourse = new Map<string, QuizRow[]>();
  for (const r of rows) {
    const slug = String(r.course_id ?? '');
    if (!slug) continue;
    const arr = byCourse.get(slug) ?? [];
    arr.push(r);
    byCourse.set(slug, arr);
  }

  const breakdowns: CourseBreakdown[] = [];

  for (const [slug, arr] of byCourse.entries()) {
    const ordered = [...arr].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ta - tb;
    });

    const lessons: LessonEntry[] = ordered.map((r, idx) => {
      const s = Number(r.score) || 0;
      const t = Number(r.total_questions) || 0;
      const pct = computePercent(s, t);
      return {
        lessonNumber: idx + 1,
        score: s,
        total: t,
        percent: pct,
        passed: pct >= PASS_THRESHOLD_PERCENT,
        date: r.created_at,
      };
    });

    const percents = lessons.map((l) => l.percent);
    const bestPercent = percents.length > 0 ? Math.max(...percents) : 0;
    const averagePercent =
      percents.length > 0
        ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
        : 0;

    const lastDate = ordered[ordered.length - 1]?.created_at ?? null;

    breakdowns.push({
      courseId: slug,
      courseName: COURSE_NAME_BY_SLUG.get(slug) ?? slug,
      lessons,
      bestPercent,
      averagePercent,
      passed: bestPercent >= PASS_THRESHOLD_PERCENT,
      lastDate,
    });
  }

  breakdowns.sort((a, b) => {
    const ta = a.lastDate ? new Date(a.lastDate).getTime() : 0;
    const tb = b.lastDate ? new Date(b.lastDate).getTime() : 0;
    return tb - ta;
  });

  return breakdowns;
}

function downloadCSV(rows: StudentRow[]) {
  const headers = [
    'ስም',
    'ስልክ',
    'ኢሜይል',
    'የተመዘገቡበት',
    'የጨረሷቸው ኪታቦች',
    'እድገት %',
    'አማካይ ነጥብ %',
    'ጠቅላላ ሙከራዎች',
    'ዝርዝር ውጤቶች',
  ];

  const escape = (v: unknown) => {
    const s = String(v ?? '');
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [headers.join(',')];

  for (const r of rows) {
    const details =
      r.breakdown.length > 0
        ? r.breakdown
            .map((b) => {
              const lessonStr = b.lessons
                .map(
                  (l) =>
                    `ደርስ ${l.lessonNumber}: ${l.score}/${l.total} (${l.percent}%)`
                )
                .join(' · ');
              return `${b.courseName} [${lessonStr}]`;
            })
            .join(' || ')
        : 'ምንም ፈተና አልተወሰደም';

    lines.push(
      [
        r.fullName,
        r.phone,
        r.email,
        r.registeredAt ?? '',
        `${r.passedCount}/${r.totalCourses}`,
        r.progressPercent,
        r.averageScore,
        r.attemptsCount,
        details,
      ]
        .map(escape)
        .join(',')
    );
  }

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `basira-students-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function AdminStudentsPage() {
  const router = useRouter();

  // -------------------------------------------------------------------------
  // RBAC state
  //
  //   authLoading  → true while we're still verifying auth + role.
  //   userRole     → set to the confirmed profile role (or null).
  //   authError    → set when the profile lookup itself fails (rare).
  //
  // The main content is rendered ONLY when `userRole === 'admin'`.
  // -------------------------------------------------------------------------
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<StudentRow | null>(null);

  // -------------------------------------------------------------------------
  // 1. STRICT RBAC — AUTH + ADMIN GUARD
  //
  //   Flow:
  //     a) supabase.auth.getUser() — authoritative session check.
  //        → no user → router.replace('/login')  (never clears authLoading,
  //          so the spinner stays up until the redirect completes).
  //     b) SELECT role FROM profiles WHERE id = user.id
  //        → query failure → authError is set + authLoading cleared.
  //        → role !== 'admin' → router.replace('/dashboard')
  //          (authLoading stays true so nothing flashes before navigation).
  //        → role === 'admin' → set userRole, clear authLoading.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const verifyAdmin = async () => {
      try {
        // ---------- (a) SESSION CHECK ----------
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userErr || !user) {
          console.error('DEBUG_SUPABASE_ERROR:', userErr);
          // Do NOT clear authLoading — the spinner stays up until the
          // router.replace('/login') navigation completes, guaranteeing
          // no protected content ever flashes.
          router.replace('/login');
          return;
        }

        // ---------- (b) ROLE LOOKUP ----------
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (profileErr) {
          console.error('DEBUG_SUPABASE_ERROR:', profileErr);
          setAuthError(`Role Lookup Error: ${describeError(profileErr)}`);
          setAuthLoading(false);
          return;
        }

        const role =
          profile && typeof profile.role === 'string'
            ? profile.role
            : null;

        if (role !== 'admin') {
          // Non-admin (student / null role) → bounce to dashboard.
          // Keep authLoading true so the spinner remains until the
          // redirect completes and no protected data flashes.
          router.replace('/dashboard');
          return;
        }

        // ---------- (c) ADMIN CONFIRMED ----------
        setUserRole('admin');
        setAuthLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('DEBUG_SUPABASE_ERROR:', err);
          setAuthError(`Auth Exception: ${describeError(err)}`);
          setAuthLoading(false);
        }
      }
    };

    verifyAdmin();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // -------------------------------------------------------------------------
  // 2. SAFE DATA LOAD
  //
  // Gated on userRole === 'admin' so the fetch never runs for non-admins.
  // -------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    setDataLoading(true);
    setErrorMessage(null);

    // ---- A) PROFILES (required) ----
    let profiles: ProfileRow[] = [];
    try {
      const { data, error } = await supabase.from('profiles').select('*');

      if (error) {
        console.error('DEBUG_SUPABASE_ERROR:', error);
        setErrorMessage(
          `Profiles Error: ${error.message} (Code: ${error.code ?? 'N/A'})`
        );
        setDataLoading(false);
        return;
      }

      profiles = ((data ?? []) as Array<Record<string, any>>).map((p) => {
        const timestamp =
          (p.created_at as string | null | undefined) ??
          (p.inserted_at as string | null | undefined) ??
          (p.registered_at as string | null | undefined) ??
          (p.updated_at as string | null | undefined) ??
          null;

        return {
          id: String(p.id ?? ''),
          full_name: (p.full_name as string | null) ?? null,
          phone: (p.phone as string | null) ?? null,
          email: (p.email as string | null) ?? null,
          role: (p.role as string | null) ?? null,
          created_at: timestamp,
        };
      });

      profiles.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
    } catch (err) {
      console.error('DEBUG_SUPABASE_ERROR:', err);
      setErrorMessage(`Profiles Exception: ${describeError(err)}`);
      setDataLoading(false);
      return;
    }

    // ---- B) QUIZ RESULTS (optional, SILENT on failure) ----
    let quizRows: QuizRow[] = [];
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('user_id, course_id, score, total_questions, created_at');

      if (error) {
        console.warn(
          '[AdminStudents] Primary quiz_results select failed, retrying minimal columns:',
          error.message
        );

        const fallback = await supabase
          .from('quiz_results')
          .select('user_id, course_id, score, total_questions');

        if (fallback.error) {
          console.error(
            'DEBUG_SUPABASE_ERROR (quiz_results, non-fatal):',
            fallback.error
          );
          quizRows = [];
        } else {
          quizRows = ((fallback.data ?? []) as Array<Record<string, any>>).map(
            (q) => ({
              user_id: String(q.user_id ?? ''),
              course_id: String(q.course_id ?? ''),
              score: (q.score as number | null) ?? null,
              total_questions: (q.total_questions as number | null) ?? null,
              created_at: null,
            })
          );
        }
      } else {
        quizRows = ((data ?? []) as Array<Record<string, any>>).map((q) => ({
          user_id: String(q.user_id ?? ''),
          course_id: String(q.course_id ?? ''),
          score: (q.score as number | null) ?? null,
          total_questions: (q.total_questions as number | null) ?? null,
          created_at: (q.created_at as string | null) ?? null,
        }));
      }
    } catch (err) {
      console.error(
        'DEBUG_SUPABASE_ERROR (quiz_results, non-fatal):',
        err
      );
      quizRows = [];
    }

    // ---- Index quiz rows by user ----
    const quizzesByUser = new Map<string, QuizRow[]>();
    for (const q of quizRows) {
      if (!q.user_id) continue;
      const arr = quizzesByUser.get(q.user_id) ?? [];
      arr.push(q);
      quizzesByUser.set(q.user_id, arr);
    }

    // ---- Compose student rows ----
    const rows: StudentRow[] = profiles
      .filter((p) => p.role !== 'admin' && p.id)
      .map((p) => {
        const userQuizzes = quizzesByUser.get(p.id) ?? [];
        const breakdown = buildBreakdown(userQuizzes);

        const passedCount = breakdown.filter((b) => b.passed).length;
        const totalCourses = REQUIRED_COURSES.length;

        const progressPercent = Math.round(
          (REQUIRED_COURSES.reduce((acc, c) => {
            const b = breakdown.find((x) => x.courseId === c.slug);
            const best = b ? b.bestPercent : 0;
            return acc + Math.min(best, PASS_THRESHOLD_PERCENT);
          }, 0) /
            (totalCourses * PASS_THRESHOLD_PERCENT)) *
            100
        );

        const percents = userQuizzes.map((q) =>
          computePercent(q.score, q.total_questions)
        );
        const averageScore =
          percents.length > 0
            ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
            : 0;

        const current = breakdown[0] ?? null;
        const currentCourseName = current?.courseName ?? null;
        const currentLessonNumber = current
          ? current.lessons[current.lessons.length - 1]?.lessonNumber ?? null
          : null;

        return {
          id: p.id,
          fullName: p.full_name ?? 'ያልተጠቀሰ',
          phone: p.phone ?? '',
          email: p.email ?? '',
          registeredAt: p.created_at,
          role: p.role ?? 'student',
          totalCourses,
          passedCount,
          progressPercent,
          averageScore,
          attemptsCount: userQuizzes.length,
          currentCourseName,
          currentLessonNumber,
          breakdown,
        };
      });

    setStudents(rows);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (userRole === 'admin' && !authError) {
      loadData();
    }
  }, [userRole, authError, loadData]);

  // -------------------------------------------------------------------------
  // 3. FILTER + SEARCH
  // -------------------------------------------------------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return students.filter((s) => {
      if (filter === 'completed' && s.passedCount < 1) return false;
      if (
        filter === 'in_progress' &&
        !(s.attemptsCount > 0 && s.passedCount === 0)
      )
        return false;

      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });
  }, [students, search, filter]);

  // -------------------------------------------------------------------------
  // 4. STATS
  // -------------------------------------------------------------------------
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const completedCount = students.filter((s) => s.passedCount >= 1).length;

    const allPercents: number[] = [];
    let totalAttempts = 0;

    for (const s of students) {
      totalAttempts += s.attemptsCount;
      for (const b of s.breakdown) {
        for (const l of b.lessons) {
          allPercents.push(l.percent);
        }
      }
    }

    const overallAvg =
      allPercents.length > 0
        ? Math.round(
            allPercents.reduce((a, b) => a + b, 0) / allPercents.length
          )
        : 0;

    return { totalStudents, completedCount, overallAvg, totalAttempts };
  }, [students]);

  // -------------------------------------------------------------------------
  // 5. HANDLERS
  // -------------------------------------------------------------------------
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);

  const handleExport = () => {
    if (filtered.length === 0) return;
    downloadCSV(filtered);
  };

  const closeModal = useCallback(() => setSelected(null), []);

  const dismissError = useCallback(() => setErrorMessage(null), []);

  // -------------------------------------------------------------------------
  // 6. RBAC GATES — LOADING SPINNER / ERROR
  //
  // CRITICAL: The full admin UI (header, stats, table, modal) is rendered
  // ONLY after `userRole === 'admin'` is explicitly confirmed. Until then,
  // a full-screen loading state is shown so no protected content flashes.
  // -------------------------------------------------------------------------

  // (a) Verify-in-progress — spinner stays up until admin is confirmed
  //     OR until a redirect (login/dashboard) completes.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/20">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            በማረጋገጥ ላይ ነው...
          </p>
        </div>
      </div>
    );
  }

  // (b) Role-lookup error — no admin UI is ever rendered in this branch.
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <ShieldAlert className="h-6 w-6 text-red-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              መግቢያ ተከልክሏል
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 break-words">
            {authError}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
          >
            ወደ ዳሽቦርድ ተመለስ
          </Link>
        </div>
      </div>
    );
  }

  // (c) Explicit admin gate — renders nothing (spinner) unless the role
  //     has been confirmed. This is the final safety net that guarantees
  //     the protected UI can NEVER flash for a non-admin, even during the
  //     brief moment between state updates and the router redirect.
  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
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
  // 7. MAIN RENDER — reached only when userRole === 'admin'.
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* ================================================================= */}
      {/* Header                                                             */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/20 flex-shrink-0">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                የተማሪዎች ዝርዝር እና ውጤት
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Basira · Admin Panel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={dataLoading}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
            >
              {dataLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              አድስ
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              ዳሽቦርድ
            </Link>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* Main                                                               */}
      {/* ================================================================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ---------- Stats ---------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <StatCard
            label="ጠቅላላ ተማሪዎች"
            value={String(stats.totalStudents)}
            accent="emerald"
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            label="የጨረሱ ተማሪዎች"
            value={String(stats.completedCount)}
            accent="sky"
            icon={<GraduationCap className="h-5 w-5" />}
          />
          <StatCard
            label="አማካይ የፈተና ውጤት"
            value={`${stats.overallAvg}%`}
            accent="purple"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            label="ጠቅላላ ፈተናዎች"
            value={String(stats.totalAttempts)}
            accent="amber"
            icon={<Award className="h-5 w-5" />}
          />
        </div>

        {/* ---------- Toolbar ---------- */}
        <div className="mb-5 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="በስም፣ በስልክ ቁጥር ወይም በኢሜይል ይፈልጉ..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
            {(
              [
                { key: 'all', label: 'ሁሉም' },
                { key: 'in_progress', label: 'በጥናት ላይ' },
                { key: 'completed', label: 'ትምህርት የጨረሱ' },
              ] as { key: FilterKey; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                  filter === f.key
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* CSV export — sleek secondary outline button */}
          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 dark:border-emerald-500 bg-transparent px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            CSV አውርድ
          </button>
        </div>

        {/* ---------- ERROR BANNER ---------- */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-bold mb-0.5">Supabase Error</p>
              <p className="break-words font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
                {errorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissError}
              aria-label="Dismiss error"
              className="flex-shrink-0 rounded-lg p-1 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ---------- Table ---------- */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {dataLoading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                ምንም ተማሪ አልተገኘም።
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-left">
                  <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {/* Sticky first header column */}
                    <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800/60 px-5 py-3 font-semibold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      ተማሪ
                    </th>
                    <th className="px-5 py-3 font-semibold">ስልክ / ኢሜይል</th>
                    <th className="px-5 py-3 font-semibold">
                      የአሁን ኪታብ እና ደርስ
                    </th>
                    <th className="px-5 py-3 font-semibold">አማካይ ነጥብ</th>
                    <th className="px-5 py-3 font-semibold">የጨረሷቸው</th>
                    <th className="px-5 py-3 font-semibold text-right">
                      ዝርዝር
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className="group border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      {/* Student — sticky first column */}
                      <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-5 py-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-sm font-bold">
                            {s.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate max-w-[180px]">
                              {s.fullName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {formatDateAmh(s.registeredAt)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Phone / Email */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          {s.phone ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-700 dark:text-slate-300">
                              <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              {s.phone}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 italic">
                              ስልክ አልተመዘገበም
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-[220px]">
                            <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{s.email || '—'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Current kitab / lesson */}
                      <td className="px-5 py-4">
                        {s.currentCourseName ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                              <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              {s.currentCourseName}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              ደርስ {s.currentLessonNumber ?? 0}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            አልጀመሩም
                          </span>
                        )}
                      </td>

                      {/* Average score */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                            {s.attemptsCount > 0 ? `${s.averageScore}%` : '—'}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {s.attemptsCount > 0
                              ? `${s.attemptsCount} ሙከራ`
                              : 'ምንም ፈተና አልተወሰደም'}
                          </span>
                        </div>
                      </td>

                      {/* Passed kitabs — badge color & icon logic */}
                      <td className="px-5 py-4">
                        {s.passedCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle className="h-3 w-3" />
                            {s.passedCount} / {s.totalCourses}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            0 / {s.totalCourses}
                          </span>
                        )}
                      </td>

                      {/* Row action */}
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(s);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                        >
                          ዝርዝር ውጤት እይ
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          {filtered.length} ከ {students.length} ተማሪዎች ይታያሉ
        </p>
      </main>

      {/* ================================================================= */}
      {/* Detail Modal                                                       */}
      {/* ================================================================= */}
      {selected && <StudentModal student={selected} onClose={closeModal} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: 'emerald' | 'sky' | 'amber' | 'purple';
  icon: ReactNode;
}) {
  const accentMap: Record<string, string> = {
    emerald:
      'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    sky: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    purple:
      'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0 ${accentMap[accent]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {label}
          </p>
          <p className="text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-5 space-y-3">
      <div className="grid grid-cols-6 gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"
          />
        ))}
      </div>
      {[1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="grid grid-cols-6 gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-2.5 w-32 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-2.5 w-16 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="h-3 w-12 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-3 w-20 rounded bg-slate-100 dark:bg-slate-800 animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  );
}

function StudentModal({
  student,
  onClose,
}: {
  student: StudentRow;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const cleanPhone = student.phone.replace(/\s+/g, '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-5 sm:px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-lg font-extrabold">
              {student.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">
                {student.fullName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ዝርዝር የፈተና ውጤት
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-5 space-y-6">
          {/* Contact */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                ስልክ ቁጥር
              </p>
              {student.phone ? (
                <>
                  <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    {student.phone}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`tel:${cleanPhone}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      ደውል
                    </a>
                    <a
                      href={`sms:${cleanPhone}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      መልእክት
                    </a>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                  ስልክ አልተመዘገበም
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                ኢሜይል
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white break-all mb-3">
                {student.email || '—'}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
                የተመዘገቡበት፡ {formatDateAmh(student.registeredAt)}
              </div>
            </div>
          </section>

          {/* Summary */}
          <section className="grid grid-cols-3 gap-3">
            <MiniStat
              label="የጨረሱት ኪታቦች"
              value={`${student.passedCount}/${student.totalCourses}`}
            />
            <MiniStat
              label="አማካይ ነጥብ"
              value={
                student.attemptsCount > 0 ? `${student.averageScore}%` : '—'
              }
            />
            <MiniStat
              label="ጠቅላላ ሙከራዎች"
              value={String(student.attemptsCount)}
            />
          </section>

          {/* Progress bar */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                አጠቃላይ እድገት
              </h3>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {student.progressPercent}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-500"
                style={{ width: `${student.progressPercent}%` }}
              />
            </div>
          </section>

          {/* Lesson breakdown */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              የደርስ በደርስ ዝርዝር ውጤት
            </h3>

            {student.breakdown.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-6 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ምንም ፈተና አልተወሰደም።
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {student.breakdown.map((course) => (
                  <div
                    key={course.courseId}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                            course.passed
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {course.passed ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <BookOpen className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {course.courseName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {course.lessons.length} ደርስ · አማካይ{' '}
                            {course.averagePercent}%
                          </p>
                        </div>
                      </div>
                      <span
                        className={`flex-shrink-0 text-xs font-bold tabular-nums ${
                          course.passed
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {course.bestPercent}%
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {course.lessons.map((lesson) => (
                        <div
                          key={lesson.lessonNumber}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                lesson.passed
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                              }`}
                            >
                              {lesson.lessonNumber}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                ደርስ {lesson.lessonNumber}፡ {lesson.score}/
                                {lesson.total} መለሱ
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {formatDateAmh(lesson.date)}
                              </p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p
                              className={`text-sm font-bold tabular-nums ${
                                lesson.passed
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              {lesson.percent}%
                            </p>
                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              {lesson.passed ? 'ተሳክቷል' : 'አልተሳካም'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-5 sm:px-6 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ዝጋ
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 text-center">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </p>
      <p className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
        {value}
      </p>
    </div>
  );
}