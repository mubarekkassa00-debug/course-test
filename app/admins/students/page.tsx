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
  Megaphone,
  Send,
  Clock,
  UserPlus,
  CreditCard,
  Unlock,
  Pencil,
  Save,
  RotateCcw,
  Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Supabase browser client (module-level singleton)
// ---------------------------------------------------------------------------
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---------------------------------------------------------------------------
// Constants — the 4 required Kitabs of Istibsar
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

/** Default total-questions value used when an admin unlocks a lesson. */
const DEFAULT_UNLOCK_TOTAL_QUESTIONS = 5;

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
  /**
   * Primary key of the lesson the attempt belongs to. This column is
   * declared NOT NULL in the database, so it MUST always be carried
   * through to any downstream INSERT/UPDATE operations.
   */
  lesson_id: string | null;
  score: number | null;
  total_questions: number | null;
  created_at: string | null;
}

interface LessonEntry {
  lessonNumber: number;
  /** The `lessons.id` value of this attempt — needed for admin overrides. */
  lessonId: string | null;
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
  /** Slug of the student's current kitab — used by the override tools. */
  currentCourseId: string | null;
  breakdown: CourseBreakdown[];
  /** Latest quiz attempt timestamp — used to compute "active today". */
  lastActivityAt: string | null;
  /** Flat, chronological list of every lesson attempt (for score chips). */
  flatLessons: LessonEntry[];
}

type FilterKey = 'all' | 'in_progress' | 'completed';

/**
 * Quick-filter overlays that can be applied by clicking the top stats
 * cards. These are evaluated as an ADDITIONAL constraint on top of the
 * regular name/email/phone search and the filter-tab selection.
 */
type QuickFilterKey =
  | 'none'
  | 'pending_payments'
  | 'active_today'
  | 'new_this_week';

/**
 * Which of the two mutually-exclusive tables is currently displayed.
 *
 *   'list'    → ጠቅላላ ተማሪዎች (contact & registration overview)
 *   'monitor' → የተማሪዎች መቆጣጠሪያ (progress & score monitor)
 */
type ActiveView = 'list' | 'monitor';

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

function formatDateTimeAmh(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const date = formatDateAmh(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${date} · ${hh}:${mm}`;
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
        lessonId: r.lesson_id ? String(r.lesson_id) : null,
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

/** Flatten every lesson across all courses into one chronological list. */
function buildFlatLessons(breakdown: CourseBreakdown[]): LessonEntry[] {
  const all: LessonEntry[] = [];
  for (const b of breakdown) {
    for (const l of b.lessons) all.push(l);
  }
  all.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return ta - tb;
  });
  return all;
}

/**
 * Resolve the next valid `lesson_id` for a given course.
 *
 * The `quiz_results.lesson_id` column is NOT NULL, so every admin insert
 * MUST supply a real primary key from the `lessons` table. This helper
 * probes several schema variants (modern `course_id` FK, legacy `book_id`
 * FK, multiple ordering columns) and returns:
 *
 *   1. The first lesson the student has NOT yet attempted (preferred),
 *      OR
 *   2. The very last lesson when every lesson has been attempted,
 *      OR
 *   3. `null` when the `lessons` table cannot be queried at all — the
 *      caller then shows an explicit error to the admin instead of
 *      sending a NULL `lesson_id` to the DB.
 */
async function fetchNextLessonIdForCourse(
  courseId: string,
  attemptedLessonIds: Set<string>
): Promise<{ lessonId: string | null; reason: string }> {
  const idColumns: Array<'course_id' | 'book_id'> = [
    'course_id',
    'book_id',
  ];
  const orderColumns: Array<string | null> = [
    'order_index',
    'lesson_number',
    'position',
    'created_at',
    null,
  ];

  console.group(
    `[fetchNextLessonIdForCourse] Resolving lesson_id for course "${courseId}"`
  );
  console.log(
    'Already-attempted lesson_ids:',
    Array.from(attemptedLessonIds)
  );

  for (const idCol of idColumns) {
    for (const orderCol of orderColumns) {
      try {
        const cols = ['id', idCol];
        if (orderCol) cols.push(orderCol);

        let query = supabase
          .from('lessons')
          .select(cols.join(', '))
          .eq(idCol, courseId);

        if (orderCol) {
          query = query.order(orderCol, { ascending: true });
        }

        const { data, error } = await query;
        if (error || !data || data.length === 0) {
          console.log(
            `[fetchNextLessonIdForCourse] Variant (idCol=${idCol}, orderCol=${orderCol}) → no data / error:`,
            error?.message ?? 'empty'
          );
          continue;
        }

        const rows = data as Array<Record<string, any>>;
        console.log(
          `[fetchNextLessonIdForCourse] Variant (idCol=${idCol}, orderCol=${orderCol}) → ${rows.length} rows:`,
          rows
        );

        // 1. Prefer the first lesson that has NOT been attempted yet.
        for (const row of rows) {
          const id = String(row?.id ?? '');
          if (id && !attemptedLessonIds.has(id)) {
            console.groupEnd();
            return {
              lessonId: id,
              reason: `resolved via lessons.${idCol} (order=${orderCol ?? 'none'}) — first unattempted lesson`,
            };
          }
        }

        // 2. Every lesson has already been attempted → credit the last one.
        const lastRow = rows[rows.length - 1];
        const lastId = String(lastRow?.id ?? '');
        if (lastId) {
          console.groupEnd();
          return {
            lessonId: lastId,
            reason: `resolved via lessons.${idCol} (order=${orderCol ?? 'none'}) — last lesson (all attempted)`,
          };
        }
      } catch (err) {
        console.log(
          `[fetchNextLessonIdForCourse] Variant (idCol=${idCol}, orderCol=${orderCol}) threw:`,
          err
        );
      }
    }
  }

  console.groupEnd();
  return {
    lessonId: null,
    reason:
      'no rows returned from `lessons` table for any known schema variant',
  };
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
  a.download = `istibsar-students-${new Date().toISOString().slice(0, 10)}.csv`;
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
  // Active view — only ONE of the two tables renders at a time.
  // -------------------------------------------------------------------------
  const [activeView, setActiveView] = useState<ActiveView>('list');

  // -------------------------------------------------------------------------
  // Pending-payments count + the set of user_ids with pending payments.
  // -------------------------------------------------------------------------
  const [pendingPayments, setPendingPayments] = useState(0);
  const [pendingPaymentUserIds, setPendingPaymentUserIds] = useState<
    Set<string>
  >(new Set());

  // -------------------------------------------------------------------------
  // Quick-filter overlay
  // -------------------------------------------------------------------------
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>('none');

  // -------------------------------------------------------------------------
  // Announcement composer modal state
  // -------------------------------------------------------------------------
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceMessage, setAnnounceMessage] = useState('');
  const [announceRecipients, setAnnounceRecipients] = useState<
    'all' | 'active' | 'completed'
  >('all');
  const [announceSending, setAnnounceSending] = useState(false);
  const [announceStatus, setAnnounceStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // -------------------------------------------------------------------------
  // 1. STRICT RBAC — AUTH + ADMIN GUARD
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const verifyAdmin = async () => {
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userErr || !user) {
          console.error('DEBUG_SUPABASE_ERROR:', userErr);
          router.replace('/login');
          return;
        }

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
          router.replace('/dashboard');
          return;
        }

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
    // Prefer including `lesson_id` (NOT NULL in DB — required for admin
    // override inserts). Fall back gracefully when the column isn't
    // available in the current schema.
    let quizRows: QuizRow[] = [];
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select(
          'user_id, course_id, lesson_id, score, total_questions, created_at'
        );

      if (error) {
        console.warn(
          '[AdminStudents] Primary quiz_results select (with lesson_id) failed, retrying without lesson_id:',
          error.message
        );

        // Attempt 2: without lesson_id
        const fallback = await supabase
          .from('quiz_results')
          .select('user_id, course_id, score, total_questions, created_at');

        if (fallback.error) {
          console.warn(
            '[AdminStudents] Secondary quiz_results select failed, retrying minimal columns:',
            fallback.error.message
          );

          // Attempt 3: absolute minimal
          const minimal = await supabase
            .from('quiz_results')
            .select('user_id, course_id, score, total_questions');

          if (minimal.error) {
            console.error(
              'DEBUG_SUPABASE_ERROR (quiz_results, non-fatal):',
              minimal.error
            );
            quizRows = [];
          } else {
            quizRows = ((minimal.data ?? []) as Array<
              Record<string, any>
            >).map((q) => ({
              user_id: String(q.user_id ?? ''),
              course_id: String(q.course_id ?? ''),
              lesson_id: null,
              score: (q.score as number | null) ?? null,
              total_questions: (q.total_questions as number | null) ?? null,
              created_at: null,
            }));
          }
        } else {
          quizRows = ((fallback.data ?? []) as Array<
            Record<string, any>
          >).map((q) => ({
            user_id: String(q.user_id ?? ''),
            course_id: String(q.course_id ?? ''),
            lesson_id: null,
            score: (q.score as number | null) ?? null,
            total_questions: (q.total_questions as number | null) ?? null,
            created_at: (q.created_at as string | null) ?? null,
          }));
        }
      } else {
        quizRows = ((data ?? []) as Array<Record<string, any>>).map((q) => ({
          user_id: String(q.user_id ?? ''),
          course_id: String(q.course_id ?? ''),
          lesson_id: (q.lesson_id as string | null) ?? null,
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

    // ---- B2) PENDING PAYMENTS: count + user_id set (optional, SILENT) ----
    let pendingCount = 0;
    let pendingIds = new Set<string>();
    try {
      const { count, error: payErr } = await supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (payErr) {
        console.warn(
          '[AdminStudents] payments pending-count query failed (non-fatal):',
          payErr.message
        );
      } else {
        pendingCount = typeof count === 'number' ? count : 0;
      }

      const { data: pendingRows, error: pendingRowsErr } = await supabase
        .from('payments')
        .select('user_id')
        .eq('status', 'pending');

      if (pendingRowsErr) {
        console.warn(
          '[AdminStudents] payments pending user_ids query failed (non-fatal):',
          pendingRowsErr.message
        );
      } else if (pendingRows) {
        for (const r of pendingRows as Array<Record<string, any>>) {
          const uid = r?.user_id ? String(r.user_id) : '';
          if (uid) pendingIds.add(uid);
        }
      }
    } catch (payCatch) {
      console.warn(
        '[AdminStudents] payments pending unexpected error (non-fatal):',
        payCatch instanceof Error ? payCatch.message : String(payCatch)
      );
    }
    setPendingPayments(pendingCount);
    setPendingPaymentUserIds(pendingIds);

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
        const currentCourseId = current?.courseId ?? null;
        const currentLessonNumber = current
          ? current.lessons[current.lessons.length - 1]?.lessonNumber ?? null
          : null;

        // Latest quiz attempt timestamp — drives the "active today" filter.
        let lastActivityAt: string | null = null;
        for (const q of userQuizzes) {
          if (!q.created_at) continue;
          if (
            !lastActivityAt ||
            new Date(q.created_at).getTime() >
              new Date(lastActivityAt).getTime()
          ) {
            lastActivityAt = q.created_at;
          }
        }

        const flatLessons = buildFlatLessons(breakdown);

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
          currentCourseId,
          currentLessonNumber,
          breakdown,
          lastActivityAt,
          flatLessons,
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
  // 3. DERIVED DATE BOUNDARIES
  // -------------------------------------------------------------------------
  const todayStartMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const weekAgoMs = useMemo(() => {
    return Date.now() - 7 * 24 * 60 * 60 * 1000;
  }, []);

  const activeTodayCount = useMemo(() => {
    return students.filter((s) => {
      if (!s.lastActivityAt) return false;
      const t = new Date(s.lastActivityAt).getTime();
      return Number.isFinite(t) && t >= todayStartMs;
    }).length;
  }, [students, todayStartMs]);

  const newThisWeekCount = useMemo(() => {
    return students.filter((s) => {
      if (!s.registeredAt) return false;
      const t = new Date(s.registeredAt).getTime();
      return Number.isFinite(t) && t >= weekAgoMs;
    }).length;
  }, [students, weekAgoMs]);

  // -------------------------------------------------------------------------
  // 4. FILTER + SEARCH
  // -------------------------------------------------------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return students.filter((s) => {
      if (quickFilter === 'active_today') {
        if (!s.lastActivityAt) return false;
        const t = new Date(s.lastActivityAt).getTime();
        if (!Number.isFinite(t) || t < todayStartMs) return false;
      } else if (quickFilter === 'new_this_week') {
        if (!s.registeredAt) return false;
        const t = new Date(s.registeredAt).getTime();
        if (!Number.isFinite(t) || t < weekAgoMs) return false;
      } else if (quickFilter === 'pending_payments') {
        if (!pendingPaymentUserIds.has(s.id)) return false;
      }

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
  }, [
    students,
    search,
    filter,
    quickFilter,
    todayStartMs,
    weekAgoMs,
    pendingPaymentUserIds,
  ]);

  // -------------------------------------------------------------------------
  // 5. STATS
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
  // 6. HANDLERS
  // -------------------------------------------------------------------------
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);

  const handleExport = () => {
    if (filtered.length === 0) return;
    downloadCSV(filtered);
  };

  const closeModal = useCallback(() => setSelected(null), []);

  const dismissError = useCallback(() => setErrorMessage(null), []);

  const handleStatCardClick = useCallback((next: QuickFilterKey) => {
    setActiveView('list');
    setQuickFilter((prev) => (prev === next ? 'none' : next));
    if (next !== 'none') {
      setFilter('all');
      setSearch('');
    }
  }, []);

  const handleShowAllStudents = useCallback(() => {
    setActiveView('list');
    setQuickFilter('none');
    setFilter('all');
    setSearch('');
  }, []);

  const handleShowMonitor = useCallback(() => {
    setActiveView('monitor');
    setQuickFilter('none');
    setFilter('all');
    setSearch('');
  }, []);

  // -------------------------------------------------------------------------
  // 7. ANNOUNCEMENT SENDER
  // -------------------------------------------------------------------------
  const handleSendAnnouncement = useCallback(async () => {
    if (announceSending) return;

    const title = announceTitle.trim();
    const message = announceMessage.trim();

    if (title === '' || message === '') {
      setAnnounceStatus({
        type: 'error',
        text: 'እባክዎ ርዕስ እና መልእክት ሁለቱንም ይሙሉ።',
      });
      return;
    }

    setAnnounceSending(true);
    setAnnounceStatus(null);

    try {
      const res = await fetch('/api/admin/announce', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          recipients: announceRecipients,
        }),
      });

      let payload: any = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok) {
        setAnnounceStatus({
          type: 'error',
          text:
            payload?.error ||
            payload?.message ||
            `ማስታወቂያውን መላክ አልተቻለም (HTTP ${res.status})።`,
        });
        return;
      }

      setAnnounceStatus({
        type: 'success',
        text:
          payload?.message ||
          'ማስታወቂያው በተሳካ ሁኔታ ተልኳል።',
      });
      setAnnounceTitle('');
      setAnnounceMessage('');
    } catch (err) {
      setAnnounceStatus({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'ያልታወቀ ስህተት ተከስቷል።',
      });
    } finally {
      setAnnounceSending(false);
    }
  }, [
    announceSending,
    announceTitle,
    announceMessage,
    announceRecipients,
  ]);

  // -------------------------------------------------------------------------
  // 8. RBAC GATES
  // -------------------------------------------------------------------------
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
  // 9. MAIN RENDER
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
                እስቲብሳር | Admin Panel
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                የተማሪዎች ዝርዝር፣ የትምህርት ሂደት እና ውጤት
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
            <button
              type="button"
              onClick={() => {
                setAnnounceStatus(null);
                setAnnounceOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-sm font-bold text-white shadow-sm shadow-emerald-900/20 transition-colors"
            >
              <Megaphone className="h-4 w-4" />
              <span className="hidden sm:inline">ማስታወቂያ ላክ</span>
              <span className="sm:hidden">ላክ</span>
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
        {/* SECTION-SELECTOR CARDS — top summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
          {/* Card — ጠቅላላ ተማሪዎች */}
          <button
            type="button"
            onClick={handleShowAllStudents}
            className={[
              'text-left rounded-2xl border bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-all duration-200',
              'cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800',
              activeView === 'list'
                ? 'border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ጠቅላላ ተማሪዎች
                </p>
                <p className="text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white">
                  {stats.totalStudents}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  ስም · የተመዘገቡበት ቀን · ስልክ · ኢሜይል
                </p>
              </div>
              {activeView === 'list' && (
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
          </button>

          {/* Card — የተማሪዎች መቆጣጠሪያ */}
          <button
            type="button"
            onClick={handleShowMonitor}
            className={[
              'text-left rounded-2xl border bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-all duration-200',
              'cursor-pointer hover:shadow-md hover:border-sky-300 dark:hover:border-sky-800',
              activeView === 'monitor'
                ? 'border-sky-400 dark:border-sky-700 ring-2 ring-sky-500/20'
                : 'border-slate-200 dark:border-slate-800',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  የተማሪዎች መቆጣጠሪያ
                </p>
                <p className="text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white">
                  {stats.totalStudents}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  ኪታብ · ደርስ · የፈተና ውጤቶች · ማስተካከያ
                </p>
              </div>
              {activeView === 'monitor' && (
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-sky-600 dark:text-sky-400" />
              )}
            </div>
          </button>
        </div>

        {/* Primary Filter Stats (4 Interactive Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
          <StatCard
            label="ማረጋገጫ የሚጠብቁ ክፍያዎች"
            value={String(pendingPayments)}
            accent="rose"
            icon={<CreditCard className="h-5 w-5" />}
            active={activeView === 'list' && quickFilter === 'pending_payments'}
            onClick={() => handleStatCardClick('pending_payments')}
          />

          <StatCard
            label="ዛሬ ንቁ የነበሩ"
            value={String(activeTodayCount)}
            accent="sky"
            icon={<Clock className="h-5 w-5" />}
            active={activeView === 'list' && quickFilter === 'active_today'}
            onClick={() => handleStatCardClick('active_today')}
          />

          <StatCard
            label="በዚህ ሳምንት አዲስ የተመዘገቡ"
            value={String(newThisWeekCount)}
            accent="purple"
            icon={<UserPlus className="h-5 w-5" />}
            active={activeView === 'list' && quickFilter === 'new_this_week'}
            onClick={() => handleStatCardClick('new_this_week')}
          />

          <StatCard
            label="የጨረሱ ተማሪዎች"
            value={String(stats.completedCount)}
            accent="emerald"
            icon={<GraduationCap className="h-5 w-5" />}
            active={false}
          />
        </div>

        {/* Quick-filter indicator */}
        {activeView === 'list' && quickFilter !== 'none' && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-2 text-xs">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              ንቁ ማጣሪያ፡
            </span>
            <span className="text-emerald-900 dark:text-emerald-200">
              {quickFilter === 'active_today' && 'ዛሬ ንቁ የነበሩ ተማሪዎች'}
              {quickFilter === 'new_this_week' &&
                'በዚህ ሳምንት አዲስ የተመዘገቡ ተማሪዎች'}
              {quickFilter === 'pending_payments' &&
                'ማረጋገጫ የሚጠብቁ ክፍያዎች ያላቸው ተማሪዎች'}
            </span>
            <button
              type="button"
              onClick={() => setQuickFilter('none')}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors"
            >
              <X className="h-3 w-3" />
              አጥፋ
            </button>
          </div>
        )}

        {/* Secondary Summary Strip */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <SmallStat
            label="የጨረሱ ተማሪዎች"
            value={String(stats.completedCount)}
            icon={<GraduationCap className="h-4 w-4" />}
          />
          <SmallStat
            label="አማካይ የፈተና ውጤት"
            value={`${stats.overallAvg}%`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <SmallStat
            label="ጠቅላላ ፈተናዎች"
            value={String(stats.totalAttempts)}
            icon={<Award className="h-4 w-4" />}
          />
        </div>

        {/* Toolbar */}
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

        {/* ERROR BANNER */}
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

        {/* ACTIVE VIEW — only ONE table is rendered at a time */}
        {activeView === 'list' ? (
          <section>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                    ጠቅላላ ተማሪዎች
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    የተማሪዎች ስም፣ የተመዘገቡበት ቀን፣ ስልክ እና ኢሜይል
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {filtered.length} / {students.length}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              {dataLoading ? (
                <ContactTableSkeleton />
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-3">
                  <Users className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ምንም ተማሪ አልተገኘም።
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-left">
                      <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="px-5 py-3 font-semibold">ተማሪ</th>
                        <th className="px-5 py-3 font-semibold">
                          የተመዘገቡበት ቀን
                        </th>
                        <th className="px-5 py-3 font-semibold">ስልክ ቁጥር</th>
                        <th className="px-5 py-3 font-semibold">ኢሜይል</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => (
                        <tr
                          key={s.id}
                          className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-sm font-bold">
                                {s.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate max-w-[220px]">
                                  {s.fullName}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {s.role === 'student' ? 'ተማሪ' : s.role}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 tabular-nums">
                              <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                              {formatDateAmh(s.registeredAt)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {s.phone ? (
                              <span className="inline-flex items-center gap-1.5 text-sm font-mono text-slate-700 dark:text-slate-300">
                                <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                {s.phone}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                                ስልክ አልተመዘገበም
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {s.email ? (
                              <span className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 max-w-[280px]">
                                <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{s.email}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                                ኢሜይል አልተመዘገበም
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                    የተማሪዎች መቆጣጠሪያ
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    የትምህርት ሂደት፣ የአሁን ኪታብ/ደርስ እና የፈተና ውጤቶች
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {filtered.length} ተማሪ
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              {dataLoading ? (
                <ContactTableSkeleton />
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-3">
                  <GraduationCap className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ምንም የትምህርት ሂደት አልተገኘም።
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-left">
                      <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="px-5 py-3 font-semibold">
                          የተማሪው ስም
                        </th>
                        <th className="px-5 py-3 font-semibold">
                          አሁን ያሉበት ኪታብ እና ደርስ
                        </th>
                        <th className="px-5 py-3 font-semibold">
                          የትምህርት ሂደት %
                        </th>
                        <th className="px-5 py-3 font-semibold">
                          የፈተና ውጤቶች
                        </th>
                        <th className="px-5 py-3 font-semibold text-right">
                          እርምጃ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => (
                        <tr
                          key={`monitor-${s.id}`}
                          className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-sm font-bold">
                                {s.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate max-w-[200px]">
                                  {s.fullName}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {s.attemptsCount > 0
                                    ? `${s.attemptsCount} ሙከራ`
                                    : 'ምንም ፈተና አልተወሰደም'}
                                </p>
                              </div>
                            </div>
                          </td>

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

                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1.5 min-w-[130px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                                  {s.progressPercent}%
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                                  {s.passedCount}/{s.totalCourses}
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-500"
                                  style={{ width: `${s.progressPercent}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            {s.flatLessons.length === 0 ? (
                              <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                                —
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                                {s.flatLessons.slice(-5).map((l, idx) => (
                                  <span
                                    key={idx}
                                    className={[
                                      'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums border',
                                      l.passed
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                                        : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/60',
                                    ].join(' ')}
                                    title={
                                      l.date
                                        ? formatDateAmh(l.date)
                                        : undefined
                                    }
                                  >
                                    {l.score}/{l.total}
                                  </span>
                                ))}
                                {s.flatLessons.length > 5 && (
                                  <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">
                                    +{s.flatLessons.length - 5}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelected(s)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 dark:border-emerald-500 bg-transparent px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors whitespace-nowrap"
                            >
                              ዝርዝር እና ማስተካከያ
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
          </section>
        )}

        <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
          {filtered.length} ከ {students.length} ተማሪዎች ይታያሉ
        </p>
      </main>

      {/* Detail + Override Modal */}
      {selected && (
        <StudentModal
          student={selected}
          onClose={closeModal}
          onRefresh={loadData}
        />
      )}

      {/* Announcement / Notification Composer Modal */}
      {announceOpen && (
        <AnnouncementModal
          title={announceTitle}
          message={announceMessage}
          recipients={announceRecipients}
          sending={announceSending}
          status={announceStatus}
          totalStudents={stats.totalStudents}
          activeTodayCount={activeTodayCount}
          completedCount={stats.completedCount}
          onTitleChange={setAnnounceTitle}
          onMessageChange={setAnnounceMessage}
          onRecipientsChange={setAnnounceRecipients}
          onSend={handleSendAnnouncement}
          onClose={() => {
            if (!announceSending) {
              setAnnounceOpen(false);
              setAnnounceStatus(null);
            }
          }}
        />
      )}
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
  active,
  onClick,
}: {
  label: string;
  value: string;
  accent: 'emerald' | 'sky' | 'amber' | 'purple' | 'rose';
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const accentMap: Record<string, string> = {
    emerald:
      'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    sky: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    purple:
      'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
    rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300',
  };

  const isClickable = typeof onClick === 'function';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={[
        'text-left rounded-2xl border bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-all duration-200',
        isClickable
          ? 'cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800'
          : 'cursor-default',
        active
          ? 'border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/20'
          : 'border-slate-200 dark:border-slate-800',
      ].join(' ')}
    >
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
    </button>
  );
}

function SmallStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-3 shadow-sm">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {label}
        </p>
        <p className="text-base font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

function ContactTableSkeleton() {
  return (
    <div className="p-5 space-y-3">
      <div className="grid grid-cols-4 gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"
          />
        ))}
      </div>
      {[1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="grid grid-cols-4 gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            </div>
          </div>
          <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800 animate-pulse my-auto" />
          <div className="h-3 w-28 rounded bg-slate-100 dark:bg-slate-800 animate-pulse my-auto" />
          <div className="h-3 w-40 rounded bg-slate-100 dark:bg-slate-800 animate-pulse my-auto" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StudentModal — detail view + ADMIN OVERRIDE CONTROLS
// ---------------------------------------------------------------------------
function StudentModal({
  student,
  onClose,
  onRefresh,
}: {
  student: StudentRow;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
}) {
  // -------------------------------------------------------------------------
  // Local override state
  // -------------------------------------------------------------------------
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editScore, setEditScore] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [unlockingCourseId, setUnlockingCourseId] = useState<string | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

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

  /**
   * Stable per-row identity — prefers the real `lesson_id` when we have
   * it, and falls back to the timestamp for legacy rows where the column
   * was not fetched.
   */
  const lessonKey = (
    courseId: string,
    lessonId: string | null,
    date: string | null
  ) => `${courseId}::${lessonId ?? date ?? ''}`;

  // -------------------------------------------------------------------------
  // ADMIN OVERRIDE — Save new score
  //
  // Prefers the exact `lesson_id` when available (unique + guaranteed),
  // and falls back to `created_at` for legacy rows.
  // -------------------------------------------------------------------------
  const handleSaveScore = useCallback(
    async (
      courseId: string,
      lessonId: string | null,
      lessonDate: string | null
    ) => {
      const trimmed = editScore.trim();
      if (trimmed === '') {
        setFeedback({
          type: 'error',
          text: 'እባክዎ አዲሱን ነጥብ ያስገቡ።',
        });
        return;
      }

      // Accept "3" or "3/5". Parse the numerator (or the full number).
      let newScore = 0;
      if (trimmed.includes('/')) {
        const [num] = trimmed.split('/');
        newScore = Number(num);
      } else {
        newScore = Number(trimmed);
      }

      if (!Number.isFinite(newScore) || newScore < 0) {
        setFeedback({
          type: 'error',
          text: 'የተሰጠው ነጥብ ትክክል አይደለም።',
        });
        return;
      }

      if (!lessonId && !lessonDate) {
        setFeedback({
          type: 'error',
          text: 'የዚህ ሙከራ መለያ (lesson_id) ወይም ቀን አልተገኘም። ማስተካከል አልተቻለም።',
        });
        return;
      }

      console.group('[AdminOverride] SaveScore');
      console.log('Student ID:', student.id);
      console.log('Course ID:', courseId);
      console.log('Lesson ID:', lessonId);
      console.log('Lesson date:', lessonDate);
      console.log('New score:', newScore);

      setBusyKey(lessonKey(courseId, lessonId, lessonDate));
      setFeedback(null);

      try {
        let query = supabase
          .from('quiz_results')
          .update({ score: newScore })
          .eq('user_id', student.id)
          .eq('course_id', courseId);

        if (lessonId) {
          query = query.eq('lesson_id', lessonId);
        } else if (lessonDate) {
          query = query.eq('created_at', lessonDate);
        }

        const { error } = await query;

        if (error) {
          console.error('[AdminOverride] SaveScore failed. Full error:', error);
          console.groupEnd();
          setFeedback({
            type: 'error',
            text: `ማስተካከል አልተቻለም፡ ${error.message}`,
          });
          return;
        }

        console.log('[AdminOverride] SaveScore success');
        console.groupEnd();

        setFeedback({
          type: 'success',
          text: 'የፈተናው ነጥብ በተሳካ ሁኔታ ተስተካክሏል።',
        });
        setEditingKey(null);
        setEditScore('');
        await onRefresh();
      } catch (err) {
        console.error('[AdminOverride] SaveScore unexpected error:', err);
        console.groupEnd();
        setFeedback({
          type: 'error',
          text: `ያልታወቀ ስህተት፡ ${describeError(err)}`,
        });
      } finally {
        setBusyKey(null);
      }
    },
    [editScore, student.id, onRefresh]
  );

  // -------------------------------------------------------------------------
  // ADMIN OVERRIDE — Delete quiz attempt (allow retake)
  // -------------------------------------------------------------------------
  const handleDeleteAttempt = useCallback(
    async (
      courseId: string,
      lessonId: string | null,
      lessonDate: string | null
    ) => {
      if (!lessonId && !lessonDate) {
        setFeedback({
          type: 'error',
          text: 'የዚህ ሙከራ መለያ (lesson_id) ወይም ቀን አልተገኘም። ማጥፋት አልተቻለም።',
        });
        return;
      }

      const confirmed = window.confirm(
        'ይህን የፈተና ሙከራ ማጥፋት ይፈልጋሉ? ተማሪው እንደገና መፈተን ይችላል።'
      );
      if (!confirmed) return;

      console.group('[AdminOverride] DeleteAttempt');
      console.log('Student ID:', student.id);
      console.log('Course ID:', courseId);
      console.log('Lesson ID:', lessonId);
      console.log('Lesson date:', lessonDate);

      setBusyKey(lessonKey(courseId, lessonId, lessonDate));
      setFeedback(null);

      try {
        let query = supabase
          .from('quiz_results')
          .delete()
          .eq('user_id', student.id)
          .eq('course_id', courseId);

        if (lessonId) {
          query = query.eq('lesson_id', lessonId);
        } else if (lessonDate) {
          query = query.eq('created_at', lessonDate);
        }

        const { error } = await query;

        if (error) {
          console.error(
            '[AdminOverride] DeleteAttempt failed. Full error:',
            error
          );
          console.groupEnd();
          setFeedback({
            type: 'error',
            text: `ማጥፋት አልተቻለም፡ ${error.message}`,
          });
          return;
        }

        console.log('[AdminOverride] DeleteAttempt success');
        console.groupEnd();

        setFeedback({
          type: 'success',
          text: 'የፈተናው ሙከራ ተሰርዟል። ተማሪው እንደገና መፈተን ይችላል።',
        });
        await onRefresh();
      } catch (err) {
        console.error('[AdminOverride] DeleteAttempt unexpected error:', err);
        console.groupEnd();
        setFeedback({
          type: 'error',
          text: `ያልታወቀ ስህተት፡ ${describeError(err)}`,
        });
      } finally {
        setBusyKey(null);
      }
    },
    [student.id, onRefresh]
  );

  // -------------------------------------------------------------------------
  // ADMIN OVERRIDE — Unlock the next lesson
  //
  // FIX for "null value in column 'lesson_id'":
  //   The `quiz_results.lesson_id` column is NOT NULL, so we MUST resolve
  //   a real primary key from the `lessons` table BEFORE inserting. We
  //   probe several schema variants and pick the first lesson the student
  //   has not yet attempted (falling back to the last lesson when all
  //   lessons have already been attempted).
  //
  //   If the lesson_id cannot be resolved, we abort and show an explicit
  //   error to the admin instead of sending a NULL to Supabase.
  //
  // Detailed debug logging records the exact payload sent to Supabase so
  // any future constraint failure can be diagnosed from the browser
  // console.
  // -------------------------------------------------------------------------
  const handleUnlockNextLesson = useCallback(
    async (courseId: string) => {
      console.group('[AdminOverride] UnlockNextLesson');
      console.log('Student ID:', student.id);
      console.log('Student name:', student.fullName);
      console.log('Course ID:', courseId);

      setUnlockingCourseId(courseId);
      setFeedback(null);

      try {
        // 1. Build the set of lesson_ids the student has already attempted
        //    for this course. This drives "pick the next unattempted" logic.
        const attemptedLessonIds = new Set<string>();
        const courseBreakdown = student.breakdown.find(
          (b) => b.courseId === courseId
        );
        if (courseBreakdown) {
          for (const l of courseBreakdown.lessons) {
            if (l.lessonId) attemptedLessonIds.add(l.lessonId);
          }
        }
        console.log(
          'Already-attempted lesson_ids for this course:',
          Array.from(attemptedLessonIds)
        );

        // 2. Resolve a valid `lesson_id` from the `lessons` table.
        const resolved = await fetchNextLessonIdForCourse(
          courseId,
          attemptedLessonIds
        );
        const nextLessonId = resolved.lessonId;

        console.log('Resolved lesson_id:', nextLessonId);
        console.log('Resolution reason:', resolved.reason);

        if (!nextLessonId) {
          console.error(
            '[AdminOverride] UnlockNextLesson aborted — no valid lesson_id could be resolved.'
          );
          console.error(
            'Attempted lesson_ids snapshot:',
            Array.from(attemptedLessonIds)
          );
          console.groupEnd();
          setFeedback({
            type: 'error',
            text:
              '❌ የትምህርቱ ደርስ መለያ (lesson_id) ማግኘት አልተቻለም። እባክዎ በ `lessons` ሰንጠረዥ ውስጥ ለዚህ ኮርስ ደርሶች መኖራቸውን ያረጋግጡ። ' +
              `(course_id: ${courseId})`,
          });
          return;
        }

        // 3. Build the exact payload. `lesson_id` is now guaranteed to be
        //    a non-null string that exists in the `lessons` table.
        const total = DEFAULT_UNLOCK_TOTAL_QUESTIONS;
        const passingScore = Math.ceil(
          (total * PASS_THRESHOLD_PERCENT) / 100
        );
        const createdAt = new Date().toISOString();

        const insertPayload = {
          user_id: student.id,
          course_id: courseId,
          lesson_id: nextLessonId,
          score: passingScore,
          total_questions: total,
          created_at: createdAt,
        };

        console.log(
          '[AdminOverride] Final INSERT payload → quiz_results:',
          insertPayload
        );
        console.log(
          '[AdminOverride] Payload JSON:',
          JSON.stringify(insertPayload, null, 2)
        );

        // 4. Sanity-check every required field before sending the request.
        const missingFields: string[] = [];
        if (!insertPayload.user_id) missingFields.push('user_id');
        if (!insertPayload.course_id) missingFields.push('course_id');
        if (!insertPayload.lesson_id) missingFields.push('lesson_id');
        if (
          typeof insertPayload.score !== 'number' ||
          Number.isNaN(insertPayload.score)
        ) {
          missingFields.push('score');
        }
        if (
          typeof insertPayload.total_questions !== 'number' ||
          Number.isNaN(insertPayload.total_questions)
        ) {
          missingFields.push('total_questions');
        }

        if (missingFields.length > 0) {
          const msg = `❌ የሚከተሉት የግዴታ መስኮች ጎድለዋል፡ ${missingFields.join(
            ', '
          )}። እባክዎ እንደገና ይሞክሩ።`;
          console.error('[AdminOverride] Aborting — missing fields:', missingFields);
          console.groupEnd();
          setFeedback({ type: 'error', text: msg });
          return;
        }

        // 5. Perform the insert.
        const { data: insertedRows, error } = await supabase
          .from('quiz_results')
          .insert(insertPayload)
          .select();

        if (error) {
          console.error(
            '[AdminOverride] Supabase INSERT failed. Full error object:',
            error
          );
          console.error(
            '[AdminOverride] Supabase INSERT failed. JSON:',
            JSON.stringify(error, null, 2)
          );
          console.groupEnd();

          // Try to give a specific, actionable message based on the error.
          const errorText = String(error.message || '');
          let hint = '';
          if (errorText.includes('lesson_id')) {
            hint = ' (lesson_id ላይ ችግር አለ — እባክዎ የ lessons ሰንጠረዥን ያረጋግጡ)';
          } else if (errorText.includes('user_id')) {
            hint = ' (user_id ላይ ችግር አለ)';
          } else if (errorText.includes('course_id')) {
            hint = ' (course_id ላይ ችግር አለ)';
          }

          setFeedback({
            type: 'error',
            text: `ቀጣዩን ደርስ መክፈት አልተቻለም፡ ${error.message}${hint}`,
          });
          return;
        }

        console.log(
          '[AdminOverride] Supabase INSERT success. Returned rows:',
          insertedRows
        );
        console.groupEnd();

        setFeedback({
          type: 'success',
          text: `ቀጣዩ ደርስ በተሳካ ሁኔታ ተከፍቷል። (lesson_id: ${nextLessonId})`,
        });
        await onRefresh();
      } catch (err) {
        console.error('[AdminOverride] UnlockNextLesson unexpected error:', err);
        console.groupEnd();
        setFeedback({
          type: 'error',
          text: `ያልታወቀ ስህተት፡ ${describeError(err)}`,
        });
      } finally {
        setUnlockingCourseId(null);
      }
    },
    [student.id, student.fullName, student.breakdown, onRefresh]
  );

  const startEditing = (
    courseId: string,
    lessonId: string | null,
    lessonDate: string | null,
    currentScore: number
  ) => {
    setEditingKey(lessonKey(courseId, lessonId, lessonDate));
    setEditScore(String(currentScore));
    setFeedback(null);
  };

  const cancelEditing = () => {
    setEditingKey(null);
    setEditScore('');
    setFeedback(null);
  };

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
                ዝርዝር ውጤት እና የአስተዳዳሪ ማስተካከያ
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
          {/* Inline feedback banner */}
          {feedback && (
            <div
              role={feedback.type === 'error' ? 'alert' : 'status'}
              className={[
                'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm',
                feedback.type === 'error'
                  ? 'border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                  : 'border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
              ].join(' ')}
            >
              {feedback.type === 'error' ? (
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span className="flex-1 break-words">{feedback.text}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Dismiss"
                className="flex-shrink-0 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Contact & Account details */}
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
                የተመዘገቡበት፡ {formatDateTimeAmh(student.registeredAt)}
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

          {/* Current Kitab / Course progress */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              የአሁን ኪታብ እና ደርስ
            </h3>
            {student.currentCourseName ? (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100 truncate">
                      {student.currentCourseName}
                    </p>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
                      ደርስ {student.currentLessonNumber ?? 0} ላይ ይገኛሉ
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                    {student.progressPercent}%
                  </span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-white/70 dark:bg-emerald-950/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-500"
                    style={{ width: `${student.progressPercent}%` }}
                  />
                </div>

                {student.currentCourseId && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleUnlockNextLesson(student.currentCourseId!)
                      }
                      disabled={unlockingCourseId === student.currentCourseId}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-60"
                    >
                      {unlockingCourseId === student.currentCourseId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5" />
                      )}
                      ቀጣዩን ደርስ ክፈት
                    </button>
                    <span className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
                      ተማሪው በቴክኒክ ችግር ምክንያት ሲዘገይ ብቻ ይጠቀሙበት።
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-4 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  እስካሁን ምንም ኪታብ አልጀመሩም።
                </p>
              </div>
            )}
          </section>

          {/* Overall progress bar */}
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

          {/* Admin Override info line */}
          <section className="flex items-start gap-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 px-3.5 py-2.5 text-xs text-indigo-800 dark:text-indigo-300">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              የአስተዳዳሪ ማስተካከያ መሳሪያዎች፡ የተማሪውን የፈተና ነጥብ ማስተካከል፣ የተሳሳተ
              ሙከራ ማጥፋት እና ቀጣይ ደርስ መክፈት ይችላሉ። ማንኛውም ስህተት ከተከሰተ ዝርዝር
              መረጃ በ browser console ውስጥ ይታያል።
            </span>
          </section>

          {/* Lesson breakdown with override controls */}
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
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            course.passed
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {course.bestPercent}%
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleUnlockNextLesson(course.courseId)
                          }
                          disabled={unlockingCourseId === course.courseId}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition-colors disabled:opacity-60"
                          title="ቀጣዩን ደርስ ክፈት"
                        >
                          {unlockingCourseId === course.courseId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Unlock className="h-3 w-3" />
                          )}
                          ክፈት
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {course.lessons.map((lesson) => {
                        const key = lessonKey(
                          course.courseId,
                          lesson.lessonId,
                          lesson.date
                        );
                        const isEditing = editingKey === key;
                        const isBusy = busyKey === key;

                        return (
                          <div
                            key={`${course.courseId}-${lesson.lessonNumber}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
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
                                  {formatDateTimeAmh(lesson.date)}
                                </p>
                              </div>
                            </div>

                            {/* Override controls */}
                            <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                              {isEditing ? (
                                <>
                                  <input
                                    type="text"
                                    value={editScore}
                                    onChange={(e) =>
                                      setEditScore(e.target.value)
                                    }
                                    placeholder={`${lesson.score}`}
                                    className="w-20 px-2.5 py-1.5 rounded-lg border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-slate-900 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    disabled={isBusy}
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSaveScore(
                                        course.courseId,
                                        lesson.lessonId,
                                        lesson.date
                                      )
                                    }
                                    disabled={isBusy}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors disabled:opacity-60"
                                  >
                                    {isBusy ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                    አስቀምጥ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditing}
                                    disabled={isBusy}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
                                  >
                                    ሰርዝ
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span
                                    className={`text-sm font-bold tabular-nums ${
                                      lesson.passed
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-red-700 dark:text-red-400'
                                    }`}
                                  >
                                    {lesson.percent}%
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditing(
                                        course.courseId,
                                        lesson.lessonId,
                                        lesson.date,
                                        lesson.score
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="ነጥብ አስተካክል"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    አስተካክል
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteAttempt(
                                        course.courseId,
                                        lesson.lessonId,
                                        lesson.date
                                      )
                                    }
                                    disabled={isBusy}
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors disabled:opacity-60"
                                    title="ሙከራውን አጥፋ (እንደገና እንዲፈተን)"
                                  >
                                    {isBusy ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-3 w-3" />
                                    )}
                                    እንደገና
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
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

// ---------------------------------------------------------------------------
// Announcement / Notification Composer
// ---------------------------------------------------------------------------
function AnnouncementModal({
  title,
  message,
  recipients,
  sending,
  status,
  totalStudents,
  activeTodayCount,
  completedCount,
  onTitleChange,
  onMessageChange,
  onRecipientsChange,
  onSend,
  onClose,
}: {
  title: string;
  message: string;
  recipients: 'all' | 'active' | 'completed';
  sending: boolean;
  status: { type: 'success' | 'error'; text: string } | null;
  totalStudents: number;
  activeTodayCount: number;
  completedCount: number;
  onTitleChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onRecipientsChange: (v: 'all' | 'active' | 'completed') => void;
  onSend: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, sending]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const audienceOptions: {
    key: 'all' | 'active' | 'completed';
    label: string;
    count: number;
  }[] = [
    { key: 'all', label: 'ሁሉም ተማሪዎች', count: totalStudents },
    { key: 'active', label: 'ዛሬ ንቁ የነበሩ', count: activeTodayCount },
    { key: 'completed', label: 'ትምህርት የጨረሱ', count: completedCount },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => {
          if (!sending) onClose();
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-5 sm:px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md shadow-emerald-900/20">
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">
                ማስታወቂያ / መልእክት ላክ
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ለተማሪዎች የሚላክ የጋራ መልእክት
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Close"
            className="flex-shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-5 space-y-5">
          {/* Recipients */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              ተቀባዮች
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {audienceOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onRecipientsChange(opt.key)}
                  className={[
                    'flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                    recipients === opt.key
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  <span
                    className={`text-xs font-semibold ${
                      recipients === opt.key
                        ? 'text-emerald-800 dark:text-emerald-300'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span
                    className={`flex-shrink-0 text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                      recipients === opt.key
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {opt.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="announce-title"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2"
            >
              ርዕስ
            </label>
            <input
              id="announce-title"
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="ለምሳሌ፡ አዲስ የፈተና ጊዜ ተቀይሯል"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
              disabled={sending}
            />
          </div>

          {/* Message */}
          <div>
            <label
              htmlFor="announce-message"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2"
            >
              መልእክት
            </label>
            <textarea
              id="announce-message"
              rows={6}
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="የመልእክቱን ዝርዝር እዚህ ይጻፉ..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all resize-y"
              disabled={sending}
            />
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              {message.length} ፊደላት
            </p>
          </div>

          {/* Status banner */}
          {status && (
            <div
              role={status.type === 'error' ? 'alert' : 'status'}
              className={[
                'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm',
                status.type === 'error'
                  ? 'border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                  : 'border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
              ].join(' ')}
            >
              {status.type === 'error' ? (
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span className="flex-1">{status.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-5 sm:px-6 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            ሰርዝ
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={sending || title.trim() === '' || message.trim() === ''}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-emerald-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending ? 'በመላክ ላይ...' : 'ላክ'}
          </button>
        </div>
      </div>
    </div>
  );
}