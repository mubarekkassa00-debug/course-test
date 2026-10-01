'use client';
// components/CertificateButton.tsx
//
// Certificate download button with client-side eligibility gating.
//
// Eligibility rules (client UX gate — the server still enforces these):
//   1. ALL 4 required courses must have at least one quiz attempt
//      (usul_al_thalatha, arbain, shurut_as_salah, urjuzat).
//   2. Every active lesson within each required course must have an attempt.
//   3. The final comprehensive exam (`is_final_exam = true`) must be completed.
//   4. The combined score across all required course quizzes + the final
//      exam must be >= 50%.
//
// Behaviour:
//   • On mount, we fetch the eligibility snapshot from Supabase so the
//     student sees exactly what is missing before they try to download.
//   • If eligible: the button is enabled and downloads the PDF directly
//     (no browser preview tab).
//   • If not eligible: the button is disabled and a checklist of remaining
//     requirements is displayed (courses left, lessons left, final exam, score).
//   • The server (`POST /api/generate-certificate`) still validates
//     eligibility and returns `eligible: false` if the client state is
//     stale — we handle that gracefully.
//
// Styling matches the Basira dark theme with emerald / gold accents.

import { useCallback, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Award,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Lock,
  BookOpen,
  GraduationCap,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Supabase browser client (module-level singleton — matches the rest of app)
// ---------------------------------------------------------------------------
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum combined score (lessons + final exam) required to be eligible. */
const PASS_THRESHOLD_PERCENT = 50;

/**
 * The 4 required books of the BASIRA program.
 *
 * The `slug` values must match the `course_id` strings stored in
 * `quiz_results`. The `label` strings are only used to build the
 * Amharic missing-reason message shown to the student.
 */
const REQUIRED_COURSES: { slug: string; label: string }[] = [
  { slug: 'usul_al_thalatha', label: 'ዩሱል አል-ሠላሠ' },
  { slug: 'arbain', label: 'አርባኢን' },
  { slug: 'shurut_as_salah', label: 'ሹሩጥ አስ-ሶላህ' },
  { slug: 'urjuzat', label: 'ኡርጁዘህ' },
];

/**
 * Standard eligibility message shown whenever eligibility fails — kept short
 * so the detailed checklist below can carry the specifics.
 */
const NOT_ELIGIBLE_HEADLINE =
  'ሰርተፊኬት ለማውረድ የሚከተሉትን መስፈርቶች ማሟላት አለብዎት።';

/**
 * Message shown when one or more of the four required courses have zero
 * quiz attempts.
 */
const MISSING_COURSES_REASON =
  'አራቱንም ኪታቦች (ዩሱል አል-ሠላሠ፣ አርባኢን፣ ሹሩጥ አስ-ሶላህ፣ ኡርጁዘህ) ማጠናቀቅ አለብዎት።';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CertificateButtonProps {
  /** The authenticated student's user id. */
  userId: string;
  /** The student's display name (used as the certificate recipient). */
  studentName: string;
  /** Optional outer wrapper classes (spacing / width). */
  className?: string;
}

interface EligibilitySnapshot {
  totalLessons: number;
  completedLessons: number;
  hasFinalExam: boolean;
  finalExamPercent: number;
  combinedPercent: number;
  eligible: boolean;
  missingReasons: string[];
  /** Per-course completion detail (used to build richer missing reasons). */
  untouchedCourses: string[];
  incompleteCourses: string[];
}

interface CertificateSuccessResponse {
  eligible: true;
  certificateUrl: string;
  certificateId: string;
  issuedAt: string;
  warning?: string;
}

interface CertificateErrorResponse {
  eligible: false;
  code: string;
  message: string;
  details?: unknown;
}

type CertificateApiResponse =
  | CertificateSuccessResponse
  | CertificateErrorResponse;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a filesystem-safe filename for the downloaded PDF,
 * e.g. "Basira_Certificate_Mubarek_Kassa.pdf".
 */
function buildDownloadFilename(studentName: string): string {
  const safeName =
    studentName.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '') ||
    'Student';
  return `Basira_Certificate_${safeName}.pdf`;
}

/**
 * Force-download a file from a URL using a temporary anchor element.
 * Works around browsers that would otherwise open a PDF in a preview tab.
 */
async function forceDirectDownload(
  url: string,
  filename: string
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `ሰርተፊኬቱን ማውረድ አልተቻለም (HTTP ${response.status}).`
    );
  }

  const blob = await response.blob();
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
}

/** Convert a thrown value into a readable string. */
function describeError(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown };
    const parts: string[] = [];
    if (e.message) parts.push(String(e.message));
    if (e.code) parts.push(`Code: ${String(e.code)}`);
    if (parts.length) return parts.join(' | ');
    try {
      return JSON.stringify(err);
    } catch {
      return 'Unserializable error';
    }
  }
  return String(err);
}

/**
 * Fetch active lessons and group them by their parent course.
 *
 * Returns a Map<courseSlug, Set<lessonId>>. Multiple schema variants are
 * tried in order so a mismatch between environments never throws.
 */
async function fetchActiveLessonsByCourse(): Promise<
  Map<string, Set<string>>
> {
  const lessonsByCourse = new Map<string, Set<string>>();

  let rows: Array<Record<string, any>> = [];

  // Attempt 1: (id, course_id, is_active)
  try {
    const primary = await supabase
      .from('lessons')
      .select('id, course_id, is_active');

    if (!primary.error) {
      rows = (primary.data ?? []) as Array<Record<string, any>>;
    } else {
      console.warn(
        '[CertificateButton] lessons select (id, course_id, is_active) failed:',
        primary.error.message
      );

      // Attempt 2: (id, course_id)
      const fb1 = await supabase.from('lessons').select('id, course_id');
      if (!fb1.error) {
        rows = (fb1.data ?? []) as Array<Record<string, any>>;
      } else {
        console.warn(
          '[CertificateButton] lessons select (id, course_id) failed:',
          fb1.error.message
        );

        // Attempt 3: (id, book_id) legacy
        const fb2 = await supabase.from('lessons').select('id, book_id');
        if (!fb2.error) {
          rows = ((fb2.data ?? []) as Array<Record<string, any>>).map(
            (r) => ({ ...r, course_id: r.book_id })
          );
        } else {
          console.error(
            'DEBUG_SUPABASE_ERROR (lessons, non-fatal):',
            fb2.error
          );
        }
      }
    }
  } catch (err) {
    console.error('DEBUG_SUPABASE_ERROR (lessons, non-fatal):', err);
  }

  for (const row of rows) {
    if (row.is_active === false) continue;
    const courseId = String(row.course_id ?? row.book_id ?? '');
    const lessonId = String(row.id ?? '');
    if (!courseId || !lessonId) continue;

    const set = lessonsByCourse.get(courseId) ?? new Set<string>();
    set.add(lessonId);
    lessonsByCourse.set(courseId, set);
  }

  return lessonsByCourse;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CertificateButton({
  userId,
  studentName,
  className = '',
}: CertificateButtonProps) {
  // ----- Eligibility state -----
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<EligibilitySnapshot>({
    totalLessons: 0,
    completedLessons: 0,
    hasFinalExam: false,
    finalExamPercent: 0,
    combinedPercent: 0,
    eligible: false,
    missingReasons: [],
    untouchedCourses: [],
    incompleteCourses: [],
  });

  // ----- Download state -----
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // 1. Fetch eligibility snapshot from Supabase
  // -------------------------------------------------------------------------
  const checkEligibility = useCallback(async () => {
    if (!userId.trim()) {
      setEligibilityError('የተጠቃሚ መረጃ አልተገኘም። እባክዎ እንደገና ይግቡ።');
      setEligibilityLoading(false);
      return;
    }

    setEligibilityLoading(true);
    setEligibilityError(null);

    // ---- A) Fetch active lessons, grouped by course ----
    const lessonsByCourse = await fetchActiveLessonsByCourse();

    // Total active lessons across the 4 required courses ONLY.
    let totalRequiredLessons = 0;
    for (const course of REQUIRED_COURSES) {
      const set = lessonsByCourse.get(course.slug);
      totalRequiredLessons += set ? set.size : 0;
    }

    // ---- B) Fetch the student's quiz attempts ----
    let attempts: Array<Record<string, any>> = [];
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('DEBUG_SUPABASE_ERROR (quiz_results):', error);
        setEligibilityError(
          `የፈተና ውጤቶችን ማግኘት አልተቻለም: ${error.message}`
        );
        setEligibilityLoading(false);
        return;
      }

      attempts = (data ?? []) as Array<Record<string, any>>;
    } catch (err) {
      console.error('DEBUG_SUPABASE_ERROR (quiz_results):', err);
      setEligibilityError(`የፈተና ውጤቶችን ማግኘት አልተቻለም: ${describeError(err)}`);
      setEligibilityLoading(false);
      return;
    }

    // ---- C) Group attempts by course → lesson, and track final exam ----
    //
    //  attemptsByCourse: Map<courseSlug, Map<lessonKey, { score, total }>>
    //    → best attempt per lesson per course
    //
    //  A separate slot tracks the best final-exam attempt.
    const attemptsByCourse = new Map<
      string,
      Map<string, { score: number; total: number }>
    >();
    let bestFinalExam: { score: number; total: number } | null = null;

    // Also track which of the REQUIRED course slugs are actually present.
    const requiredSlugs = new Set(REQUIRED_COURSES.map((c) => c.slug));

    for (const row of attempts) {
      const score = Number(row.score) || 0;
      const total = Number(row.total_questions) || 0;

      // ---- C1. Final exam branch ----
      if (row.is_final_exam === true) {
        if (!bestFinalExam || score > bestFinalExam.score) {
          bestFinalExam = { score, total };
        }
        continue;
      }

      // ---- C2. Regular lesson attempt ----
      const courseId = String(
        row.course_id ?? row.book_id ?? row.course_slug ?? ''
      );
      if (!courseId) continue;

      // Only track courses that are part of the required program.
      // (Non-required courses are ignored for eligibility purposes.)
      const isRequired = requiredSlugs.has(courseId);

      const lessonKey = String(
        row.lesson_id ?? row.lesson_slug ?? row.quiz_id ?? courseId
      );

      const courseMap =
        attemptsByCourse.get(courseId) ??
        new Map<string, { score: number; total: number }>();

      const existing = courseMap.get(lessonKey);
      if (!existing || score > existing.score) {
        courseMap.set(lessonKey, { score, total });
      }

      attemptsByCourse.set(courseId, courseMap);

      // Suppress unused-variable linter hint for isRequired (kept for
      // readability / future use).
      void isRequired;
    }

    // ---- D) Evaluate each required course independently ----
    interface CourseStat {
      slug: string;
      label: string;
      attempted: boolean;
      completedLessons: number;
      totalLessons: number;
    }

    const perCourseStats: CourseStat[] = [];
    let completedLessonsAll = 0;
    let sumScoreAll = 0;
    let sumTotalAll = 0;

    for (const course of REQUIRED_COURSES) {
      const courseMap = attemptsByCourse.get(course.slug);
      const attemptedLessonIds = courseMap ? Array.from(courseMap.keys()) : [];
      const completedCount = attemptedLessonIds.length;

      // Total expected lessons for this course from the `lessons` table.
      // Fallback: if the table has no rows for this course, require at
      // least 1 attempt so the student isn't blocked by an infra gap.
      const requiredSet = lessonsByCourse.get(course.slug);
      const requiredFromTable = requiredSet ? requiredSet.size : 0;
      const effectiveRequired =
        requiredFromTable > 0 ? requiredFromTable : 1;

      perCourseStats.push({
        slug: course.slug,
        label: course.label,
        attempted: completedCount > 0,
        completedLessons: completedCount,
        totalLessons: effectiveRequired,
      });

      // Sum best scores for every completed lesson in this course.
      let courseScore = 0;
      let courseTotal = 0;
      if (courseMap) {
        for (const { score, total } of courseMap.values()) {
          courseScore += score;
          courseTotal += total;
        }
      }

      completedLessonsAll += completedCount;
      sumScoreAll += courseScore;
      sumTotalAll += courseTotal;
    }

    // ---- E) Add the final exam to the aggregate ----
    const hasFinalExam = bestFinalExam !== null;
    const finalExamPercent =
      bestFinalExam && bestFinalExam.total > 0
        ? Math.round((bestFinalExam.score / bestFinalExam.total) * 100)
        : 0;

    if (bestFinalExam) {
      sumScoreAll += bestFinalExam.score;
      sumTotalAll += bestFinalExam.total;
    }

    const combinedPercent =
      sumTotalAll > 0
        ? Math.round((sumScoreAll / sumTotalAll) * 100)
        : 0;

    // ---- F) Apply every rule ----
    //
    // Rule A — every required course must have at least one attempt.
    const untouched = perCourseStats.filter((c) => !c.attempted);
    const untouchedCourses = untouched.map((c) => c.label);

    // Rule B — every required course must have all its lessons completed.
    const incomplete = perCourseStats.filter(
      (c) => c.attempted && c.completedLessons < c.totalLessons
    );
    const incompleteCourses = incomplete.map(
      (c) => `${c.label} (${c.completedLessons}/${c.totalLessons})`
    );

    // Rule C — final exam must be completed.
    // Rule D — combined score must be >= 50%.
    const combinedScoreOk = combinedPercent >= PASS_THRESHOLD_PERCENT;

    const allCoursesAttempted = untouched.length === 0;
    const allLessonsCompleted = incomplete.length === 0;

    const missingReasons: string[] = [];

    if (!allCoursesAttempted) {
      missingReasons.push(MISSING_COURSES_REASON);
    }

    if (!allLessonsCompleted) {
      missingReasons.push(
        `ተጨማሪ ደርሶችን ማጠናቀቅ ያስፈልጋል: ${incompleteCourses.join('، ')}።`
      );
    }

    if (!hasFinalExam) {
      missingReasons.push('የመጨረሻ አጠቃላይ ፈተናውን ማጠናቀቅ ያስፈልጋል።');
    }

    if (!combinedScoreOk) {
      missingReasons.push(
        `አጠቃላይ ውጤት ቢያንስ ${PASS_THRESHOLD_PERCENT}% መሆን አለበት (አሁን ${combinedPercent}%)።`
      );
    }

    const eligible =
      allCoursesAttempted &&
      allLessonsCompleted &&
      hasFinalExam &&
      combinedScoreOk;

    // ---- G) Commit the snapshot ----
    //
    // `totalLessons` reflects the sum of expected lessons across all four
    // required courses. When the `lessons` table has no rows for a course,
    // `effectiveRequired` collapses to 1 so the value stays meaningful.
    const totalRequiredLessonsSum = perCourseStats.reduce(
      (acc, c) => acc + c.totalLessons,
      0
    );

    setSnapshot({
      totalLessons: totalRequiredLessonsSum,
      completedLessons: completedLessonsAll,
      hasFinalExam,
      finalExamPercent,
      combinedPercent,
      eligible,
      missingReasons,
      untouchedCourses,
      incompleteCourses,
    });
    setEligibilityLoading(false);

    // `totalRequiredLessons` from the lessons table is now folded into
    // per-course effective requirements, so we no longer need the flat
    // sum. (Kept the computation above for readability.)
    void totalRequiredLessons;
  }, [userId]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  // -------------------------------------------------------------------------
  // 2. Download handler — only fires when client-side eligible
  // -------------------------------------------------------------------------
  const handleDownload = useCallback(async () => {
    if (!userId.trim() || !studentName.trim()) {
      setDownloadError('የተጠቃሚ መረጃ አልተገኘም። እባክዎ እንደገና ይግቡ።');
      setSuccessMessage(null);
      return;
    }

    setDownloading(true);
    setDownloadError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/generate-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, studentName }),
      });

      let payload: CertificateApiResponse;
      try {
        payload = (await response.json()) as CertificateApiResponse;
      } catch {
        throw new Error(
          'የሰርቨር ምላሽ ማንበብ አልተቻለም። እባክዎ እንደገና ይሞክሩ።'
        );
      }

      // Server-side eligibility gate — the server is the source of truth.
      if (!payload.eligible) {
        // Refresh the client snapshot in case our state was stale, then
        // show the server's message.
        setDownloadError(payload.message || NOT_ELIGIBLE_HEADLINE);
        checkEligibility();
        return;
      }

      if (payload.warning) {
        console.warn('[CertificateButton]', payload.warning);
      }

      const filename = buildDownloadFilename(studentName);
      await forceDirectDownload(payload.certificateUrl, filename);

      setSuccessMessage(
        `ሰርተፊኬቱ በተሳካ ሁኔታ ተዘጋጅቷል እና በ${filename} ስም ተቀምጧል።`
      );
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'ያልታወቀ ስህተት ተከስቷል።';
      setDownloadError(reason);
      setSuccessMessage(null);
    } finally {
      setDownloading(false);
    }
  }, [userId, studentName, checkEligibility]);

  // -------------------------------------------------------------------------
  // Render — Loading (initial eligibility check)
  // -------------------------------------------------------------------------
  if (eligibilityLoading) {
    return (
      <div className={`w-full ${className}`}>
        <button
          type="button"
          disabled
          aria-busy="true"
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm tracking-wide bg-slate-800/60 text-slate-400 ring-1 ring-slate-700 cursor-not-allowed"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>የሰርተፊኬት ብቁነትን በመፈተሽ ላይ...</span>
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render — Eligibility error (could not determine state)
  // -------------------------------------------------------------------------
  if (eligibilityError) {
    return (
      <div className={`w-full ${className}`}>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="font-semibold text-red-300">
              የሰርተፊኬት ሁኔታን ማረጋገጥ አልተቻለም
            </p>
            <p className="mt-0.5 whitespace-pre-line leading-relaxed text-red-200/90">
              {eligibilityError}
            </p>
            <button
              type="button"
              onClick={checkEligibility}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-700/60 bg-red-900/30 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-900/50 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              እንደገና ሞክር
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render — Main
  // -------------------------------------------------------------------------
  return (
    <div className={`w-full ${className}`}>
      {/* ---------- Eligibility checklist card ---------- */}
      <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            የሰርተፊኬት መስፈርቶች
          </h4>
          <button
            type="button"
            onClick={checkEligibility}
            aria-label="Refresh eligibility"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            አድስ
          </button>
        </div>

        <ul className="space-y-2.5">
          {/* Rule 1 — All lessons across the 4 required courses */}
          <ChecklistRow
            satisfied={
              snapshot.totalLessons > 0 &&
              snapshot.completedLessons >= snapshot.totalLessons
            }
            icon={<BookOpen className="h-4 w-4" />}
            label="ሁሉንም ትምህርቶች ማጠናቀቅ"
            detail={
              snapshot.totalLessons > 0
                ? `${snapshot.completedLessons}/${snapshot.totalLessons} ትምህርቶች`
                : 'ምንም ንቁ ትምህርቶች አልተገኙም'
            }
          />

          {/* Rule 2 — Final exam */}
          <ChecklistRow
            satisfied={snapshot.hasFinalExam}
            icon={<GraduationCap className="h-4 w-4" />}
            label="የመጨረሻ አጠቃላይ ፈተና"
            detail={
              snapshot.hasFinalExam
                ? `ተጠናቅቋል · ${snapshot.finalExamPercent}%`
                : 'አልተጠናቀቀም'
            }
          />

          {/* Rule 3 — Combined score */}
          <ChecklistRow
            satisfied={snapshot.combinedPercent >= PASS_THRESHOLD_PERCENT}
            icon={<TrendingUp className="h-4 w-4" />}
            label={`አጠቃላይ ውጤት ≥ ${PASS_THRESHOLD_PERCENT}%`}
            detail={`አሁን ${snapshot.combinedPercent}%`}
          />
        </ul>
      </div>

      {/* ---------- Main download button ---------- */}
      {snapshot.eligible ? (
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          aria-busy={downloading}
          className={[
            'w-full inline-flex items-center justify-center gap-2',
            'px-5 py-3 rounded-xl',
            'font-bold text-sm tracking-wide',
            'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700',
            'text-white',
            'ring-1 ring-amber-400/40',
            'shadow-lg shadow-emerald-950/40',
            'transition-all duration-200',
            'hover:from-emerald-600 hover:via-emerald-500 hover:to-emerald-600',
            'hover:ring-amber-400/70',
            'hover:shadow-emerald-900/60',
            'active:scale-[0.985]',
            'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300',
          ].join(' ')}
        >
          {downloading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-amber-200" />
              <span>ሰርተፊኬቱ በመዘጋጀት ላይ ነው...</span>
            </>
          ) : (
            <>
              <Award className="h-5 w-5 text-amber-300" />
              <span>ሰርተፊኬት አውርድ (PDF)</span>
            </>
          )}
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={NOT_ELIGIBLE_HEADLINE}
            className={[
              'w-full inline-flex items-center justify-center gap-2',
              'px-5 py-3 rounded-xl',
              'font-bold text-sm tracking-wide',
              'bg-slate-200 dark:bg-slate-800',
              'text-slate-500 dark:text-slate-400',
              'ring-1 ring-slate-300 dark:ring-slate-700',
              'cursor-not-allowed',
            ].join(' ')}
          >
            <Lock className="h-5 w-5" />
            <span>ሰርተፊኬት አውርድ (ተቆልፏል)</span>
          </button>

          {/* Missing-reasons panel */}
          {snapshot.missingReasons.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-300/70 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-200 mb-2">
                {NOT_ELIGIBLE_HEADLINE}
              </p>
              <ul className="space-y-1.5">
                {snapshot.missingReasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-amber-800 dark:text-amber-200/90 leading-relaxed"
                  >
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-400 flex-shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* ---------- Download error banner ---------- */}
      {downloadError && !downloading && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-3 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="font-semibold text-red-300">
              ሰርተፊኬቱን ማዘጋጀት አልተቻለም
            </p>
            <p className="mt-0.5 whitespace-pre-line leading-relaxed text-red-200/90">
              {downloadError}
            </p>
          </div>
        </div>
      )}

      {/* ---------- Success banner ---------- */}
      {successMessage && !downloading && !downloadError && (
        <div
          role="status"
          className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-300">
              ሰርተፊኬቱ በተሳካ ሁኔታ ተዘጋጅቷል!
            </p>
            <p className="mt-0.5 leading-relaxed text-emerald-200/90">
              {successMessage}
            </p>
            <p className="mt-0.5 text-xs text-emerald-200/70">
              ማውረዱ ካልተጀመረ የአሳሽዎን ማውረድ (Downloads) ቅንብሮች ያረጋግጡ።
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ChecklistRow({
  satisfied,
  icon,
  label,
  detail,
}: {
  satisfied: boolean;
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
          satisfied
            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
            : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {label}
          </span>
          {satisfied ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <Lock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {detail}
        </p>
      </div>
    </li>
  );
}