// app/courses/[id]/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Award,
  BookOpen,
  PlayCircle,
  CheckCircle2,
  Menu,
  Home,
  X,
  Lock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Amharic text constants
// ---------------------------------------------------------------------------
const amh = {
  backToCourses: 'ወደ ኮርሶች ተመለስ',
  backToDashboard: 'ወደ ዳሽቦርድ',
  progress: 'አጠቃላይ እድገት',
  certificateBadge: 'ሰርተፊኬት ያለው',
  dailyLessons: 'ዕለታዊ ደርሶች',
  weeklyQuiz: 'ሳምንታዊ ፈተና',
  finalExam: 'የመጨረሻ ፈተና (ሰርተፊኬት)',
  startLesson: 'ደርሱን ጀምር',
  retry: 'እንደገና ሞክር',
  start: 'ጀምር',
  question: 'ጥያቄ',
  of: 'ከ',
  submitAnswer: 'መልስ አስገባ',
  correct: 'ትክክል ነው!',
  incorrect: 'ስህተት ነው፣ እንደገና ሞክር',
  nextQuestion: 'ቀጣይ ጥያቄ',
  finish: 'ጨርስ',
  quizCompleted: 'ፈተናውን አጠናቅቀዋል',
  close: 'ዝጋ',
  lessons: 'ትምህርቶች',
  dashboard: 'ዳሽቦርድ',
  courses: 'ኮርሶች',
  menu: 'ማውጫ',
  score: 'ውጤት',
  completed: 'ተጠናቋል',
  passed: 'ተሳክቷል',
  failed: 'ያልተሳካ',

  // -------------------------------------------------------------------------
  // Drip-lock (daily gating) messages
  // -------------------------------------------------------------------------
  locked: 'ተቆልፏል',
  /** Shown when the PREVIOUS lesson hasn't been passed yet. */
  completePrevious:
    'እባክዎን አስቀድመው ያለፈውን ደርስ ያጠናቅቁ',
  /** Shown when the PREVIOUS lesson was passed today (same calendar day). */
  comeBackTomorrow: 'ነገ ይከፈታል (በቀን አንድ ደርስ ብቻ)',

  // -------------------------------------------------------------------------
  // Final-exam gating messages
  // -------------------------------------------------------------------------
  /** Shown when not all regular lessons have been passed yet. */
  completeAllLessons:
    'እባክዎን አስቀድመው ሁሉንም ደርሶች ያጠናቅቁ',
  /** Shown when the LAST regular lesson was passed today. */
  comeBackTomorrowExam:
    'ነገ ይከፈታል (በቀን አንድ ደርስ/ፈተና ብቻ)',

  // -------------------------------------------------------------------------
  // Badge labels (free trial + payment gate)
  // -------------------------------------------------------------------------
  /** Free-trial badge for lessons 1–3. */
  badgeFreeLesson: '▶️ ነፃ ደርስ',
  /** Badge shown for lessons scheduled on a future day. */
  badgeUnlocksTomorrow: '⏳ ነገ ይከፈታል',
  /** Badge shown for lessons 4+ when the student hasn't paid. */
  badgePaymentRequired: '🔒 ክፍያ ይፈልጋል',
  /** Badge shown for paid students on unlocked lessons. */
  badgePlay: '▶️ አጫውት',
  /** Reason line under a payment-locked lesson title. */
  paymentLockReason:
    'የ3 ቀን ነፃ ጊዜዎ አልቋል — ለመቀጠል እባክዎ ክፍያ ይፈጽሙ።',
};

// ---------------------------------------------------------------------------
// Header background image
// ---------------------------------------------------------------------------
// Swap this URL to change the course page header banner background.
// Example: '/images/course-header.jpg' or any external URL.
const HEADER_BG_IMAGE =
  'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&w=800&q=80';

// ---------------------------------------------------------------------------
// Free-trial / payment-gate constants
// ---------------------------------------------------------------------------
/**
 * Lessons 1, 2 and 3 are part of the 3-day free trial — one lesson per
 * day, matching the drip-lock cadence. Lesson 4 and onward require an
 * approved payment (`payments.status === 'approved'`).
 */
const FREE_TRIAL_LESSON_COUNT = 3;

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------
interface Question {
  questionText: string;
  options: string[];
  correctIndex: number;
}

interface Quiz {
  title: string;
  questions: Question[];
}

interface Lesson {
  id: string;        // e.g. "lesson-1"
  title: string;
  content?: string;
  quiz: Quiz;
}

interface Course {
  id: number;
  title: string;
  category: string;
  gradient: string;
  lessonsCount: number;
  progress: number;
  lessons: Lesson[];
  weeklyQuizzes: Quiz[];
  finalExam: Quiz;
}

/** A single score record for a lesson or the final exam. */
interface ScoreRecord {
  correct: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

const PASS_THRESHOLD_PERCENT = 50;

function scorePercent(s: ScoreRecord): number {
  if (!s || s.total <= 0) return 0;
  return Math.round((s.correct / s.total) * 100);
}

function isPassed(s: ScoreRecord): boolean {
  return scorePercent(s) >= PASS_THRESHOLD_PERCENT;
}

// ---------------------------------------------------------------------------
// Calendar-day comparison helper (drip-lock logic)
// ---------------------------------------------------------------------------
/**
 * True iff both dates fall on the SAME calendar day in the user's local
 * timezone. Used to decide whether the previous lesson was passed "today"
 * (→ next lesson locked) or on a previous day (→ next lesson unlocked).
 */
function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---------------------------------------------------------------------------
// Final-exam storage convention (must match the lesson page)
// ---------------------------------------------------------------------------
/**
 * Sentinel `lesson_id` used to store the final-exam result in the
 * `quiz_results` table. The dedicated final-exam page writes to this
 * row, and we read it here to render the score badge on the exam card.
 */
const FINAL_EXAM_LESSON_ID = 999;

// ---------------------------------------------------------------------------
// Canonical course slug (for `quiz_results.course_id`)
// ---------------------------------------------------------------------------
/**
 * Maps every accepted URL variant to the canonical slug stored in the
 * `quiz_results` table — must mirror the mapping used by the lesson page:
 *   → 'usul_al_thalatha'
 *   → 'arbain'
 *   → 'shurut_as_salah'
 *   → 'urjuzat'
 */
function getCanonicalCourseSlug(courseId: string): string | null {
  const normalized = (courseId || '').toLowerCase().trim();
  switch (normalized) {
    case '1':
    case 'usul':
    case 'usul_al_thalatha':
      return 'usul_al_thalatha';
    case '2':
    case 'arbaeen':
    case 'arbain':
      return 'arbain';
    case '3':
    case 'shurut':
    case 'shurut-salat':
    case 'shurut_as_salah':
      return 'shurut_as_salah';
    case '4':
    case 'urjuzetul':
    case 'urjizetul':
    case 'urjuzetul-miiyah':
    case 'urjuzat':
    case 'urjuzat_al_miiyyah':
      return 'urjuzat';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Lesson slug → numeric lesson id resolver
// ---------------------------------------------------------------------------
/**
 * Extract the trailing numeric lesson ID from a lesson slug.
 *
 *   "lesson-1"           → 1
 *   "lesson-2"           → 2
 *   "arbaeen-lesson-101" → 1   (values > 100 are normalised modulo 100)
 *
 * Returns `null` when no trailing digits are present.
 */
function lessonIdToNumber(lessonId: string): number | null {
  const match = String(lessonId || '').match(/(\d+)$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n > 100 ? n % 100 : n;
}

// ---------------------------------------------------------------------------
// Mock course data (lesson id as strings)
// ---------------------------------------------------------------------------
const courses: Record<number, Course> = {
  1: {
    id: 1,
    title: 'ሦስቱ መሠረቶች (الأصول الثلاثة)',
    category: 'አቂዳ',
    gradient: 'from-blue-600 to-blue-800',
    lessonsCount: 12,
    progress: 0,
    lessons: Array.from({ length: 11 }, (_, i) => ({
      id: `lesson-${i + 1}`,
      title: `ደርስ ${i + 1}`,
      quiz: {
        title: `የደርስ ${i + 1} ጥያቄ`,
        questions: [
          {
            questionText: `የደርስ ${i + 1} ጥያቄ 1?`,
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 0,
          },
        ],
      },
    })),
    weeklyQuizzes: [
      {
        title: 'የሳምንት 1 ፈተና',
        questions: [
          {
            questionText: 'ሳምንታዊ ጥያቄ 1?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 1,
          },
          {
            questionText: 'ሳምንታዊ ጥያቄ 2?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 2,
          },
        ],
      },
    ],
    finalExam: {
      title: 'የመጨረሻ ፈተና',
      questions: [
        {
          questionText: 'የመጨረሻ ጥያቄ 1?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 0,
        },
        {
          questionText: 'የመጨረሻ ጥያቄ 2?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 3,
        },
      ],
    },
  },
  2: {
    id: 2,
    title: '40ኡ የነወዊ ሀዲሶች (الأربعين النووية)',
    category: 'ሀዲስ',
    gradient: 'from-purple-600 to-purple-800',
    lessonsCount: 15,
    progress: 0,
    lessons: Array.from({ length: 11 }, (_, i) => ({
      id: `lesson-${i + 1}`,
      title: `ደርስ ${i + 1}`,
      quiz: {
        title: `የደርስ ${i + 1} ጥያቄ`,
        questions: [
          {
            questionText: `የደርስ ${i + 1} ጥያቄ 1?`,
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 0,
          },
        ],
      },
    })),
    weeklyQuizzes: [
      {
        title: 'የሳምንት 1 ፈተና',
        questions: [
          {
            questionText: 'ሳምንታዊ ጥያቄ 1?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 1,
          },
        ],
      },
    ],
    finalExam: {
      title: 'የመጨረሻ ፈተና',
      questions: [
        {
          questionText: 'የመጨረሻ ጥያቄ 1?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 0,
        },
      ],
    },
  },
  3: {
    id: 3,
    title: 'የሶላትና የወዱእ ህጎች (شروط الصلاة)',
    category: 'ፊቅህ',
    gradient: 'from-emerald-600 to-emerald-800',
    lessonsCount: 10,
    progress: 0,
    lessons: Array.from({ length: 7 }, (_, i) => ({
      id: `lesson-${i + 1}`,
      title: `ደርስ ${i + 1}`,
      quiz: {
        title: `የደርስ ${i + 1} ጥያቄ`,
        questions: [
          {
            questionText: `የደርስ ${i + 1} ጥያቄ 1?`,
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 0,
          },
        ],
      },
    })),
    weeklyQuizzes: [
      {
        title: 'የሳምንት 1 ፈተና',
        questions: [
          {
            questionText: 'ሳምንታዊ ጥያቄ 1?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 1,
          },
        ],
      },
    ],
    finalExam: {
      title: 'የመጨረሻ ፈተና',
      questions: [
        {
          questionText: 'የመጨረሻ ጥያቄ 1?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 0,
        },
      ],
    },
  },
  4: {
    id: 4,
    title: 'አል-ኡርጁዘቱል ሚኢያህ (الأرجوزة المئية)',
    category: 'ሲራ',
    gradient: 'from-red-600 to-red-800',
    lessonsCount: 14,
    progress: 0,
    lessons: Array.from({ length: 25 }, (_, i) => ({
      id: `lesson-${i + 1}`,
      title: `ደርስ ${i + 1}`,
      quiz: {
        title: `የደርስ ${i + 1} ጥያቄ`,
        questions: [
          {
            questionText: `የደርስ ${i + 1} ጥያቄ 1?`,
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 0,
          },
        ],
      },
    })),
    weeklyQuizzes: [
      {
        title: 'የሳምንት 1 ፈተና',
        questions: [
          {
            questionText: 'ሳምንታዊ ጥያቄ 1?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 1,
          },
        ],
      },
    ],
    finalExam: {
      title: 'የመጨረሻ ፈተና',
      questions: [
        {
          questionText: 'የመጨረሻ ጥያቄ 1?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 0,
        },
      ],
    },
  },
  5: {
    id: 5,
    title: 'መሰረታዊ የአረብኛ ሰዋሰው (አል-አጅሩሚያህ)',
    category: 'ቋንቋ',
    gradient: 'from-amber-600 to-amber-800',
    lessonsCount: 18,
    progress: 0,
    lessons: Array.from({ length: 18 }, (_, i) => ({
      id: `lesson-${i + 1}`,
      title: `ደርስ ${i + 1}`,
      quiz: {
        title: `የደርስ ${i + 1} ጥያቄ`,
        questions: [
          {
            questionText: `የደርስ ${i + 1} ጥያቄ 1?`,
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 0,
          },
        ],
      },
    })),
    weeklyQuizzes: [
      {
        title: 'የሳምንት 1 ፈተና',
        questions: [
          {
            questionText: 'ሳምንታዊ ጥያቄ 1?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 1,
          },
        ],
      },
    ],
    finalExam: {
      title: 'የመጨረሻ ፈተና',
      questions: [
        {
          questionText: 'የመጨረሻ ጥያቄ 1?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 0,
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Main Course Page Component
// ---------------------------------------------------------------------------
export default function CoursePage() {
  const params = useParams();

  // =========================================================================
  // TESTING TOGGLE — UNLOCK ALL LESSONS
  //
  //   `true`  → bypasses the daily drip-lock AND the payment gate for the
  //             entire course. Every lesson and the final exam become
  //             immediately reachable. The existing `completed` /
  //             `passed` badges still render exactly as before (they are
  //             driven by the real `quiz_results` rows).
  //
  //   `false` → restores the original production behavior 100%:
  //               • Lessons unlock one-per-day after the previous lesson
  //                 is passed.
  //               • Lessons 4+ require an `approved` payment.
  //               • The final exam requires every lesson to be passed.
  //
  // Flip this to `false` to ship for production.
  // =========================================================================
  const UNLOCK_ALL_LESSONS = true; // Set to false to restore daily locked lessons

  // -------------------------------------------------------------------------
  // DARK MODE SYNC (globally-scoped on <html>)
  //
  // Applies the persisted theme (`basira-theme` localStorage key — the same
  // key used everywhere else in the app) to `document.documentElement`'s
  // `dark` class, and keeps it synchronized across:
  //
  //   1. Initial mount (covers direct URL loads and hard refreshes).
  //   2. Cross-tab changes via the browser `storage` event.
  //   3. Same-tab changes via a custom `themeChange` event (dispatched by
  //      the dashboard's dark-mode toggle after updating localStorage).
  //   4. OS-level preference changes via `matchMedia` (only meaningful when
  //      no explicit theme is stored — `applyTheme` keeps localStorage
  //      authoritative when it's set).
  //
  // All listeners are removed on unmount to avoid leaks.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyTheme = () => {
      const stored = window.localStorage.getItem('basira-theme');
      let isDark: boolean;

      if (stored === 'dark') {
        isDark = true;
      } else if (stored === 'light') {
        isDark = false;
      } else {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      document.documentElement.classList.toggle('dark', isDark);
    };

    // 1. Apply on mount.
    applyTheme();

    // 2. Cross-tab sync — the `storage` event fires when another tab/window
    //    writes to localStorage. `e.key === null` means the whole store was
    //    cleared, so re-apply in that case too.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'basira-theme' || e.key === null) {
        applyTheme();
      }
    };
    window.addEventListener('storage', onStorage);

    // 3. Same-tab sync — components (e.g. the dashboard toggle) can
    //    dispatch `themeChange` on `window` after updating localStorage.
    const onThemeChange = () => applyTheme();
    window.addEventListener('themeChange', onThemeChange as EventListener);

    // 4. OS preference sync.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = () => applyTheme();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onMediaChange);
    } else if (typeof (media as any).addListener === 'function') {
      // Legacy Safari fallback.
      (media as any).addListener(onMediaChange);
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('themeChange', onThemeChange as EventListener);
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', onMediaChange);
      } else if (typeof (media as any).removeListener === 'function') {
        (media as any).removeListener(onMediaChange);
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // HYDRATION-SAFE MOUNT GUARD
  //
  // `useParams()` can return `undefined` / an unresolved param object during
  // SSR vs the first client render in Next.js 15+ App Router, which makes
  // the derived `course` object differ between the server HTML and the
  // client's initial output — triggering:
  //
  //   "Hydration failed because the server rendered text didn't match
  //    the client"
  //
  // Fix: until the component has fully mounted, always resolve to a stable
  // default course id ('1'). This guarantees the server-rendered HTML and
  // the client's first hydration render are byte-identical. After mount,
  // the real `params.id` is used and the correct course re-renders on the
  // client.
  // -------------------------------------------------------------------------
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // -------------------------------------------------------------------------
  // COURSE ID RESOLUTION (hydration-safe)
  //
  // `params.id` may arrive as either:
  //   • a numeric string  → "2"        (typical /courses/2 route)
  //   • a slug            → "arbaeen"  (friendly alias)
  //
  // We keep the RAW value for URL construction (so nested routes stay
  // consistent with whatever the user is already on) and derive a NUMERIC
  // value only for the `courses[...]` data lookup.
  //
  // Before mount, fall back to '1' so SSR + first client render match.
  // -------------------------------------------------------------------------
  const rawCourseId = hasMounted
    ? String(Array.isArray(params.id) ? params.id[0] : params.id ?? '1').trim() ||
      '1'
    : '1';

  const numericCourseId = Number(rawCourseId);
  const course: Course =
    (Number.isFinite(numericCourseId) && courses[numericCourseId]) ||
    courses[1];

  const [menuOpen, setMenuOpen] = useState(false);

  // -------------------------------------------------------------------------
  // SCORES FROM SUPABASE `quiz_results`
  //
  // Both lesson scores and the final-exam score are read here from a
  // single query. Lesson keys are numeric (`lessonIdToNumber(lesson.id)`),
  // and the final-exam row uses the sentinel `FINAL_EXAM_LESSON_ID` (999).
  //
  // We also read the `created_at` timestamp of every quiz attempt so the
  // drip-lock logic can tell whether the previous lesson was passed
  // TODAY (→ next lesson locked) or on a previous day (→ next unlocked).
  //
  // Guarded by `hasMounted` so the fetch doesn't fire prematurely with
  // the fallback id '1' during SSR / initial hydration.
  // -------------------------------------------------------------------------
  const [lessonScores, setLessonScores] = useState<Record<number, ScoreRecord>>(
    {}
  );
  /**
   * For each lesson, the EARLIEST timestamp at which the student PASSED
   * it (score/total ≥ 50%). Multiple retries within the same lesson only
   * affect the first passing timestamp — a later re-take never pushes
   * the date forward, which would wrongly re-lock the next lesson.
   */
  const [lessonFirstPassDates, setLessonFirstPassDates] = useState<
    Record<number, string>
  >({});
  const [finalScore, setFinalScore] = useState<ScoreRecord | null>(null);
  const [scoresLoading, setScoresLoading] = useState(true);
  const [scoresError, setScoresError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // PAYMENT STATUS (for the free-trial vs. paid badge logic)
  //
  //   isPaid         → true only when the latest `payments` row for this
  //                    user has status === 'approved'.
  //   paymentLoading → true while the check is in flight. While loading,
  //                    we do NOT show the payment-required badge so that
  //                    trial/paid users never briefly see a lock flash.
  //
  // A failure here is non-fatal: we simply keep `isPaid` false, which
  // falls back to the free-trial behaviour for lessons 1–3 and the
  // payment-required badge for lessons 4+.
  // -------------------------------------------------------------------------
  const [isPaid, setIsPaid] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(true);

  useEffect(() => {
    if (!hasMounted) return;
    let cancelled = false;

    const fetchPayment = async () => {
      setPaymentLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!user) {
          setIsPaid(false);
          return;
        }

        const { data, error } = await supabase
          .from('payments')
          .select('status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (cancelled) return;

        if (error) {
          console.warn('[CoursePage] payment fetch warning:', error.message);
          setIsPaid(false);
          return;
        }

        if (!data || data.length === 0) {
          setIsPaid(false);
          return;
        }

        const status = String(data[0]?.status ?? '').toLowerCase();
        setIsPaid(status === 'approved');
      } catch (err) {
        if (!cancelled) {
          console.warn('[CoursePage] payment fetch unexpected error:', err);
          setIsPaid(false);
        }
      } finally {
        if (!cancelled) setPaymentLoading(false);
      }
    };

    fetchPayment();
    return () => {
      cancelled = true;
    };
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;

    let cancelled = false;

    const canonicalSlug = getCanonicalCourseSlug(rawCourseId);
    if (!canonicalSlug) {
      setLessonScores({});
      setLessonFirstPassDates({});
      setFinalScore(null);
      setScoresLoading(false);
      return;
    }

    setScoresLoading(true);
    setScoresError(null);

    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!user) {
          setLessonScores({});
          setLessonFirstPassDates({});
          setFinalScore(null);
          return;
        }

        const { data, error } = await supabase
          .from('quiz_results')
          .select('lesson_id, score, total_questions, created_at')
          .eq('user_id', user.id)
          .eq('course_id', canonicalSlug);

        if (cancelled) return;

        if (error) {
          console.error('[CoursePage] quiz_results fetch error:', error);
          setScoresError('ውጤቶችን ማምጣት አልተቻለም።');
          setLessonScores({});
          setLessonFirstPassDates({});
          setFinalScore(null);
          return;
        }

        const lessonMap: Record<number, ScoreRecord> = {};
        const firstPassMap: Record<number, string> = {};
        let finalRec: ScoreRecord | null = null;

        for (const row of data ?? []) {
          const lid = Number((row as any).lesson_id);
          if (!Number.isFinite(lid)) continue;

          const rec: ScoreRecord = {
            correct: Number((row as any).score) || 0,
            total: Number((row as any).total_questions) || 0,
          };
          const createdAtRaw = (row as any).created_at;
          const createdAt =
            typeof createdAtRaw === 'string' && createdAtRaw.length > 0
              ? createdAtRaw
              : null;
          const rowPercent = scorePercent(rec);

          if (lid === FINAL_EXAM_LESSON_ID) {
            if (!finalRec || rowPercent > scorePercent(finalRec)) {
              finalRec = rec;
            }
          } else {
            // Keep the best-scoring record (as before).
            const existing = lessonMap[lid];
            if (!existing || rowPercent > scorePercent(existing)) {
              lessonMap[lid] = rec;
            }

            // Track the EARLIEST passing timestamp for this lesson.
            if (
              createdAt &&
              rec.total > 0 &&
              rowPercent >= PASS_THRESHOLD_PERCENT
            ) {
              const existingPass = firstPassMap[lid];
              if (
                !existingPass ||
                new Date(createdAt).getTime() <
                  new Date(existingPass).getTime()
              ) {
                firstPassMap[lid] = createdAt;
              }
            }
          }
        }

        setLessonScores(lessonMap);
        setLessonFirstPassDates(firstPassMap);
        setFinalScore(finalRec);
      } catch (e) {
        if (!cancelled) {
          console.error('[CoursePage] unexpected score fetch error:', e);
          setScoresError('ያልታወቀ ስህተት ተከስቷል።');
          setLessonScores({});
          setLessonFirstPassDates({});
          setFinalScore(null);
        }
      } finally {
        if (!cancelled) setScoresLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [hasMounted, rawCourseId]);

  // Close hamburger drawer on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Timeline: lessons + final exam only (weekly quizzes removed).
  const timelineItems = useMemo(() => {
    const items: { type: 'lesson' | 'finalExam'; data: any; id: string }[] = [];
    course.lessons.forEach((lesson) => {
      items.push({ type: 'lesson', data: lesson, id: lesson.id });
    });
    items.push({ type: 'finalExam', data: course.finalExam, id: 'final' });
    return items;
  }, [course]);

  // -------------------------------------------------------------------------
  // DRIP-LOCK RESOLVER (DAILY LESSONS)
  //
  // Given a lesson's 0-based index within `course.lessons`, returns whether
  // it is locked and, if so, the reason:
  //
  //   • UNLOCK_ALL_LESSONS === true    → always UNLOCKED (testing bypass)
  //   • index === 0                    → always UNLOCKED
  //   • previous lesson not yet passed → LOCKED ("complete previous lesson")
  //   • previous lesson passed TODAY   → LOCKED ("come back tomorrow")
  //   • previous lesson passed earlier → UNLOCKED
  //
  // While `scoresLoading` is true we deliberately treat every lesson as
  // unlocked so the initial render doesn't briefly flash incorrect lock
  // states before the fetch completes.
  // -------------------------------------------------------------------------
  const resolveLock = (
    index: number
  ): { locked: boolean; reason: 'previous' | 'tomorrow' | null } => {
    // -----------------------------------------------------------------
    // TESTING BYPASS — when UNLOCK_ALL_LESSONS is true, no lesson is
    // ever drip-locked. Restore production behavior by setting the flag
    // to `false` at the top of the component.
    // -----------------------------------------------------------------
    if (UNLOCK_ALL_LESSONS) return { locked: false, reason: null };

    if (scoresLoading) return { locked: false, reason: null };
    if (index <= 0) return { locked: false, reason: null };

    const prevLesson = course.lessons[index - 1];
    if (!prevLesson) return { locked: false, reason: null };

    const prevNum = lessonIdToNumber(prevLesson.id);
    if (prevNum === null) return { locked: false, reason: null };

    const prevPassDate = lessonFirstPassDates[prevNum];
    if (!prevPassDate) return { locked: true, reason: 'previous' };

    const passDate = new Date(prevPassDate);
    if (Number.isNaN(passDate.getTime())) {
      // Unparseable timestamp — be permissive rather than blocking.
      return { locked: false, reason: null };
    }

    if (isSameCalendarDay(passDate, new Date())) {
      return { locked: true, reason: 'tomorrow' };
    }

    return { locked: false, reason: null };
  };

  // -------------------------------------------------------------------------
  // DRIP-LOCK RESOLVER (FINAL EXAM)
  //
  // Precedence of checks:
  //   1. UNLOCK_ALL_LESSONS === true  → UNLOCKED (testing bypass)
  //   2. Every regular lesson must have a passing record. If even one is
  //      missing (never passed), the final exam is LOCKED with reason
  //      'allLessons' → "እባክዎን አስቀድመው ሁሉንም ደርሶች ያጠናቅቁ".
  //   3. If all lessons are passed, check the LAST lesson's earliest pass
  //      date:
  //        • passed TODAY (same calendar day) → LOCKED, reason 'tomorrow'
  //          → "ነገ ይከፈታል (በቀን አንድ ደርስ/ፈተና ብቻ)"
  //        • passed on an earlier day        → UNLOCKED
  //
  // While `scoresLoading` is true we return unlocked so the initial paint
  // does not flash incorrect lock states.
  // -------------------------------------------------------------------------
  const resolveFinalExamLock = (): {
    locked: boolean;
    reason: 'allLessons' | 'tomorrow' | null;
  } => {
    // -----------------------------------------------------------------
    // TESTING BYPASS — when UNLOCK_ALL_LESSONS is true, the final exam
    // is never locked. Restore production behavior by setting the flag
    // to `false` at the top of the component.
    // -----------------------------------------------------------------
    if (UNLOCK_ALL_LESSONS) return { locked: false, reason: null };

    if (scoresLoading) return { locked: false, reason: null };

    const lessons = course.lessons;
    if (!lessons || lessons.length === 0) {
      return { locked: false, reason: null };
    }

    // 1. Every lesson must have at least one passing attempt.
    for (const lesson of lessons) {
      const num = lessonIdToNumber(lesson.id);
      if (num === null) {
        // Non-standard lesson id — can't verify, so stay permissive.
        return { locked: false, reason: null };
      }
      if (!lessonFirstPassDates[num]) {
        return { locked: true, reason: 'allLessons' };
      }
    }

    // 2. All lessons passed — check the LAST lesson's earliest pass date.
    const lastLesson = lessons[lessons.length - 1];
    const lastNum = lessonIdToNumber(lastLesson.id);
    if (lastNum === null) return { locked: false, reason: null };

    const lastPassDateRaw = lessonFirstPassDates[lastNum];
    if (!lastPassDateRaw) {
      // Shouldn't happen (loop above guarantees presence) — be safe.
      return { locked: true, reason: 'allLessons' };
    }

    const passDate = new Date(lastPassDateRaw);
    if (Number.isNaN(passDate.getTime())) {
      return { locked: false, reason: null };
    }

    if (isSameCalendarDay(passDate, new Date())) {
      return { locked: true, reason: 'tomorrow' };
    }

    return { locked: false, reason: null };
  };

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans"
    >
      {/* =================================================================== */}
      {/* Sticky Banner Header with Islamic background image                  */}
      {/* Left: Back to Courses · Center: Title · Right: Hamburger            */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-40 shadow-md dark:shadow-slate-950/50 dark:bg-slate-900/90 dark:border-b dark:border-slate-800/80">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={HEADER_BG_IMAGE}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
          <div
            className={`absolute inset-0 bg-gradient-to-r ${course.gradient} opacity-80`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/30 dark:from-slate-950/85 dark:via-slate-900/65 dark:to-slate-950/80" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* LEFT — Back to Courses */}
            <Link
              href="/courses"
              aria-label={amh.backToCourses}
              className="flex-shrink-0 p-2 rounded-xl bg-white/15 backdrop-blur-sm hover:bg-white/25 dark:bg-slate-900/40 dark:hover:bg-slate-800/60 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </Link>

            <h1
              suppressHydrationWarning
              className="flex-1 min-w-0 text-base sm:text-xl font-bold text-white truncate text-center drop-shadow-sm"
            >
              {course.title}
            </h1>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={amh.menu}
              aria-expanded={menuOpen}
              className="flex-shrink-0 p-2 rounded-xl bg-white/15 backdrop-blur-sm hover:bg-white/25 dark:bg-slate-900/40 dark:hover:bg-slate-800/60 transition-colors"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            <span
              suppressHydrationWarning
              className="bg-white/20 backdrop-blur text-white text-xs px-3 py-1 rounded-full border border-white/20 dark:bg-slate-900/40 dark:border-slate-700/60 dark:text-slate-100"
            >
              {course.category}
            </span>
            <span className="bg-yellow-400/90 text-yellow-900 dark:bg-amber-500/25 dark:text-amber-300 dark:border dark:border-amber-500/30 text-xs px-3 py-1 rounded-full flex items-center gap-1 font-medium">
              <Award className="h-3 w-3" /> {amh.certificateBadge}
            </span>
            <span
              suppressHydrationWarning
              className="bg-white/20 backdrop-blur text-white text-xs px-3 py-1 rounded-full border border-white/20 flex items-center gap-1 dark:bg-slate-900/40 dark:border-slate-700/60 dark:text-slate-100"
            >
              <BookOpen className="h-3 w-3" />
              {course.lessonsCount} {amh.lessons}
            </span>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* Hamburger Drawer + Backdrop                                          */}
      {/* =================================================================== */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label={amh.menu}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm dark:bg-slate-950/70"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            className="absolute top-0 right-0 h-full w-72 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
                  <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ባሲራ
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
              >
                <Home className="h-5 w-5" />
                {amh.dashboard}
              </Link>
              <Link
                href="/courses"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              >
                <BookOpen className="h-5 w-5" />
                {amh.courses}
              </Link>
            </nav>
          </aside>
        </div>
      )}

      {/* =================================================================== */}
      {/* Timeline List                                                        */}
      {/* =================================================================== */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h3 className="text-lg font-bold mb-6 text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <PlayCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          {amh.dailyLessons}
        </h3>

        {/* Non-blocking score fetch error */}
        {scoresError && (
          <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
            {scoresError}
          </p>
        )}

        <div className="space-y-3">
          {timelineItems.map((item, idx) => {
            // ---------------------------------------------------------
            // LESSON ROW
            // ---------------------------------------------------------
            if (item.type === 'lesson') {
              const lesson: Lesson = item.data;
              const lessonNum = lessonIdToNumber(lesson.id);
              const score =
                lessonNum !== null ? lessonScores[lessonNum] : undefined;
              const completed = !!score;
              const passed = score ? isPassed(score) : false;

              // ---------------------------------------------------------
              // DRIP-LOCK — decide whether this lesson is available.
              // `idx` matches the lesson's 0-based index within
              // `course.lessons` because lessons are pushed first, in
              // order, into `timelineItems`.
              //
              // When UNLOCK_ALL_LESSONS is true, `resolveLock` always
              // returns `{ locked: false }`, so `dripLocked` is false.
              // ---------------------------------------------------------
              const lock = resolveLock(idx);
              const dripLocked = lock.locked;

              // 1-based lesson number used for the free-trial window.
              const lessonNumber = idx + 1;

              // ---------------------------------------------------------
              // PAYMENT GATE
              //
              //   Lessons 1–3  → part of the 3-day free trial.
              //   Lessons 4+   → require an approved payment.
              //
              // When UNLOCK_ALL_LESSONS is true, the payment gate is
              // bypassed entirely so lessons 4+ remain reachable.
              //
              // While `paymentLoading` is true we treat the user as
              // "not payment-locked" so trial users don't briefly see a
              // lock flash before the payment check resolves.
              // ---------------------------------------------------------
              const requiresPayment =
                !UNLOCK_ALL_LESSONS &&
                !paymentLoading &&
                !isPaid &&
                lessonNumber > FREE_TRIAL_LESSON_COUNT;

              const paymentLocked = !dripLocked && requiresPayment;

              // Combined lock state drives the disabled button / no nav.
              const isLocked = dripLocked || paymentLocked;

              // ---------------------------------------------------------
              // STATUS BADGE — small inline pill next to the title.
              //
              //   1. Lessons 1–3 unlocked           → "▶️ ነፃ ደርስ"
              //   2. Any future-day (locked) lesson → "⏳ ነገ ይከፈታል"
              //   3. Lessons 4+ unpaid + arrived    → "🔒 ክፍያ ይፈልጋል"
              //   4. Paid + unlocked lesson         → "▶️ አጫውት"
              //
              // When UNLOCK_ALL_LESSONS is true, dripLocked and
              // paymentLocked are both false, so the badge falls through
              // to the free-trial / paid labels as appropriate.
              // ---------------------------------------------------------
              let badge: { label: string; className: string } | null = null;

              if (dripLocked) {
                // Future day → unlocks tomorrow.
                badge = {
                  label: amh.badgeUnlocksTomorrow,
                  className:
                    'bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60',
                };
              } else if (paymentLocked) {
                badge = {
                  label: amh.badgePaymentRequired,
                  className:
                    'bg-amber-100 text-amber-700 border-amber-200/80 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
                };
              } else if (lessonNumber <= FREE_TRIAL_LESSON_COUNT) {
                badge = {
                  label: amh.badgeFreeLesson,
                  className:
                    'bg-emerald-100 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
                };
              } else if (isPaid || UNLOCK_ALL_LESSONS) {
                // When UNLOCK_ALL_LESSONS is true, treat every unlocked
                // lesson beyond the trial window as playable.
                badge = {
                  label: amh.badgePlay,
                  className:
                    'bg-emerald-100 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
                };
              }

              // Build the numeric lesson id for the `[lessonId]` segment.
              // e.g. "lesson-2" → 2. Falls back to the raw slug safely if
              // the extraction fails for a non-standard id.
              const numericLessonId =
                lessonIdToNumber(lesson.id) ?? lesson.id;

              // Use the RAW course id from params so the URL shape stays
              // consistent with whatever the user navigated to (numeric
              // "/courses/2/..." or slug "/courses/arbaeen/...").
              const lessonHref = `/courses/${rawCourseId}/lessons/${numericLessonId}`;

              return (
                <div
                  key={item.id}
                  className={[
                    'flex items-center gap-3 sm:gap-4 rounded-xl p-4 border transition-all duration-200',
                    isLocked
                      ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-slate-950/40'
                      : completed
                      ? 'bg-emerald-50/60 border-emerald-200/80 shadow-sm dark:bg-emerald-500/[0.06] dark:border-emerald-500/20 dark:shadow-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                      : 'bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-slate-950/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/90',
                  ].join(' ')}
                >
                  <div className="flex-shrink-0">
                    {isLocked ? (
                      <Lock className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                    ) : completed ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <BookOpen className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={[
                          'font-semibold truncate',
                          isLocked
                            ? 'text-slate-500 dark:text-slate-400'
                            : 'text-slate-800 dark:text-slate-200',
                        ].join(' ')}
                      >
                        {lesson.title}
                      </p>

                      {/* Status badge (free trial / tomorrow / payment) */}
                      {badge && (
                        <span
                          className={[
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-bold whitespace-nowrap border',
                            badge.className,
                          ].join(' ')}
                        >
                          {badge.label}
                        </span>
                      )}

                      {score && !isLocked && (
                        <span
                          className={[
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-bold whitespace-nowrap border',
                            passed
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
                              : 'bg-amber-100 text-amber-700 border-amber-200/80 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
                          ].join(' ')}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {amh.score}: {score.correct}/{score.total} ·{' '}
                          {scorePercent(score)}%
                        </span>
                      )}
                    </div>

                    {/* Drip-lock reason line — only rendered when drip-locked */}
                    {dripLocked && (
                      <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 flex items-start gap-1.5 leading-snug">
                        <Lock className="mt-0.5 h-3 w-3 flex-shrink-0" />
                        <span>
                          {lock.reason === 'tomorrow'
                            ? amh.comeBackTomorrow
                            : amh.completePrevious}
                        </span>
                      </p>
                    )}

                    {/* Payment-lock reason line — only rendered when payment-locked */}
                    {paymentLocked && (
                      <p className="mt-1 text-[11px] sm:text-xs font-medium text-amber-600 dark:text-amber-400 flex items-start gap-1.5 leading-snug">
                        <Lock className="mt-0.5 h-3 w-3 flex-shrink-0" />
                        <span>{amh.paymentLockReason}</span>
                      </p>
                    )}
                  </div>

                  {/* Locked → disabled button (no navigation).
                      Unlocked → clean Next.js Link so the App Router
                      handles soft navigation natively. */}
                  {isLocked ? (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      aria-label={amh.locked}
                      className="flex-shrink-0 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed select-none"
                    >
                      <Lock className="h-4 w-4" />
                      <span className="hidden sm:inline">{amh.locked}</span>
                    </button>
                  ) : (
                    <Link
                      href={lessonHref}
                      prefetch={false}
                      aria-label={completed ? amh.retry : amh.startLesson}
                      className={[
                        'flex-shrink-0 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1',
                        completed
                          ? 'bg-white dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/20'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950',
                      ].join(' ')}
                    >
                      <PlayCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {completed ? amh.retry : amh.startLesson}
                      </span>
                    </Link>
                  )}
                </div>
              );
            }

            // ---------------------------------------------------------
            // FINAL EXAM ROW
            //
            // Navigates via <Link> to the dedicated lesson page at
            // `/courses/<id>/lessons/final` — the lesson page handles
            // the `final` slug by fetching all questions, shuffling,
            // and slicing to MAX_FINAL_EXAM_QUESTIONS.
            //
            // DRIP-LOCK (final exam):
            //   • UNLOCK_ALL_LESSONS === true → always UNLOCKED
            //   • Not all regular lessons passed → LOCKED ('allLessons')
            //   • All passed but last passed today → LOCKED ('tomorrow')
            //   • All passed and last passed earlier → UNLOCKED
            // ---------------------------------------------------------
            const finalLock = resolveFinalExamLock();
            const isFinalLocked = finalLock.locked;

            const finalCompleted = !!finalScore;
            const finalPassed = finalScore ? isPassed(finalScore) : false;

            const finalExamHref = `/courses/${rawCourseId}/lessons/final`;

            return (
              <div
                key={item.id}
                className={[
                  'flex items-center gap-3 sm:gap-4 rounded-xl p-4 border transition-all duration-200',
                  isFinalLocked
                    ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-slate-950/40'
                    : finalCompleted
                    ? 'bg-emerald-50/60 border-emerald-200/80 shadow-sm dark:bg-emerald-500/[0.06] dark:border-emerald-500/20 dark:shadow-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                    : 'bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-slate-950/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/90',
                ].join(' ')}
              >
                <div className="flex-shrink-0">
                  {isFinalLocked ? (
                    <Lock className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                  ) : finalCompleted ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Award className="h-6 w-6 text-yellow-500 dark:text-amber-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={[
                        'font-semibold truncate',
                        isFinalLocked
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-slate-800 dark:text-slate-200',
                      ].join(' ')}
                    >
                      {amh.finalExam}
                    </p>
                    {/* Score badge — matches the lesson badge format:
                        `ውጤት: correct/total · percent%` with emerald for
                        pass (≥ 50%) and amber for fail.
                        Hidden while the exam is locked. */}
                    {finalScore && !isFinalLocked && (
                      <span
                        className={[
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-bold whitespace-nowrap border',
                          finalPassed
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
                            : 'bg-amber-100 text-amber-700 border-amber-200/80 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
                        ].join(' ')}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {amh.score}: {finalScore.correct}/{finalScore.total} ·{' '}
                        {scorePercent(finalScore)}%
                      </span>
                    )}
                  </div>

                  {/* Final-exam lock reason line — only rendered when locked */}
                  {isFinalLocked && (
                    <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 flex items-start gap-1.5 leading-snug">
                      <Lock className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      <span>
                        {finalLock.reason === 'tomorrow'
                          ? amh.comeBackTomorrowExam
                          : amh.completeAllLessons}
                      </span>
                    </p>
                  )}
                </div>

                {/* Locked → disabled button (no navigation).
                    Unlocked → clean Next.js Link to the dedicated
                    final-exam page which has its own shuffle + slice flow. */}
                {isFinalLocked ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    aria-label={amh.locked}
                    className="flex-shrink-0 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed select-none"
                  >
                    <Lock className="h-4 w-4" />
                    <span className="hidden sm:inline">{amh.locked}</span>
                  </button>
                ) : (
                  <Link
                    href={finalExamHref}
                    prefetch={false}
                    aria-label={finalCompleted ? amh.retry : amh.start}
                    className={[
                      'flex-shrink-0 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1',
                      finalCompleted
                        ? 'bg-white dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/20'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950',
                    ].join(' ')}
                  >
                    <PlayCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {finalCompleted ? amh.retry : amh.start}
                    </span>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}