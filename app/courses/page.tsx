// app/courses/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Home,
  BookOpen,
  Award,
  GraduationCap,
  Menu,
  X,
  ArrowLeft,
  Lock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// CONFIGURABLE VISUAL ASSET
// ---------------------------------------------------------------------------
// Swap this URL to change the header background image.
// Accepts any HTTPS image URL (Cloudinary, Unsplash, CDN) or a local path
// like '/images/header.jpg' served from /public.
const HEADER_BG_URL =
  'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&w=1600&q=80';

// ---------------------------------------------------------------------------
// Amharic text constants
// ---------------------------------------------------------------------------
const amh = {
  title: 'የላቁ ኢስላማዊ ኮርሶች',
  courseStart: 'ትምህርቱን ጀምር',
  lessons: 'ትምህርቶች',
  certificateBadge: 'ሰርተፊኬት ያለው',
  dashboard: 'ዳሽቦርድ',
  courses: 'ኮርሶች',
  menu: 'ማውጫ',
  backToDashboard: 'ወደ ዳሽቦርድ',
  /** Button label shown when a course is locked by the prerequisite chain. */
  lockedCourse: 'ተቆልፏል (አስቀድመው የቀደመውን ኮርስ ያጠናቅቁ)',
  /** Short badge shown over the cover image of a locked course. */
  lockedBadge: 'ተቆልፏል',
};

// ---------------------------------------------------------------------------
// Sample courses data (4 foundational books)
// ---------------------------------------------------------------------------
const courses = [
  {
    id: 1,
    title: 'ሦስቱ መሠረቶች (አል-ኡሱል አል-ሰላሳ)',
    category: 'አቂዳ',
    lessonsCount: 11,
    gradient: 'from-blue-700 to-blue-900',
    image:
      'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 2,
    title: '40ሩ የነወዊ ሀዲሶች (አል-አርባዒን)',
    category: 'ሀዲስ',
    lessonsCount: 11,
    gradient: 'from-purple-700 to-purple-900',
    image:
      'https://images.unsplash.com/photo-1585036156171-384164a8c675?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 3,
    title: 'የሶላትና የዉዱእ ህጎች (ሹሩጡ ሶላት)',
    category: 'ፊቅህ',
    lessonsCount: 10,
    gradient: 'from-emerald-700 to-emerald-900',
    image:
      'https://images.unsplash.com/photo-1618022325802-7e5e732d97a1?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 4,
    title: 'አጭሩ የነቢዩ (ﷺ) ታሪክ (ኡርጁዘቱል ሚኢያህ)',
    category: 'ሲራ',
    lessonsCount: 14,
    gradient: 'from-red-700 to-red-900',
    image:
      'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=800&q=80',
  },
];

// ---------------------------------------------------------------------------
// COURSE PROGRESSION — prerequisite chain
// ---------------------------------------------------------------------------
// The order below defines the strict prerequisite chain:
//   Course 1 → always unlocked
//   Course 2 → locked until Course 1 is fully passed (all lessons + final)
//   Course 3 → locked until Course 2 is fully passed (all lessons + final)
//   Course 4 → locked until Course 3 is fully passed (all lessons + final)
//
// `slug`         — the canonical value stored in `quiz_results.course_id`.
// `lessonCount`  — the ACTUAL number of daily lessons inside the course
//                  (matches the lesson array length on the course page,
//                  which is the true source of truth — not the display
//                  `lessonsCount` in the courses array above).
// ---------------------------------------------------------------------------
const FINAL_EXAM_LESSON_ID = 999;
const PASS_THRESHOLD_PERCENT = 50;

const COURSE_PROGRESSION: {
  courseId: number;
  slug: string;
  lessonCount: number;
}[] = [
  { courseId: 1, slug: 'usul_al_thalatha', lessonCount: 11 },
  { courseId: 2, slug: 'arbain', lessonCount: 11 },
  { courseId: 3, slug: 'shurut_as_salah', lessonCount: 7 },
  { courseId: 4, slug: 'urjuzat', lessonCount: 25 },
];

/**
 * Returns true iff the given `quiz_results` rows contain a PASSING attempt
 * (≥ 50%) for EVERY daily lesson (1..lessonCount) AND for the final exam
 * (lesson_id = 999) of the specified course slug.
 */
function isCourseFullyPassed(
  rows: any[],
  slug: string,
  lessonCount: number
): boolean {
  const passingLessons = new Set<number>();
  let finalPassed = false;

  for (const r of rows || []) {
    if (String(r?.course_id ?? '') !== slug) continue;

    const lid = Number(r?.lesson_id);
    if (!Number.isFinite(lid)) continue;

    const s = Number(r?.score) || 0;
    const t = Number(r?.total_questions) || 0;
    if (t <= 0) continue;

    const pct = Math.round((s / t) * 100);
    if (pct < PASS_THRESHOLD_PERCENT) continue;

    if (lid === FINAL_EXAM_LESSON_ID) {
      finalPassed = true;
    } else if (lid >= 1 && lid <= lessonCount) {
      passingLessons.add(lid);
    }
  }

  if (!finalPassed) return false;
  for (let i = 1; i <= lessonCount; i++) {
    if (!passingLessons.has(i)) return false;
  }
  return true;
}

/**
 * Build the unlock map across the full progression chain. Each course is
 * unlocked only if every PREVIOUS course in the chain is fully passed.
 * Course 1 is unconditionally unlocked.
 */
function computeUnlockedMap(rows: any[]): Record<number, boolean> {
  const unlocked: Record<number, boolean> = {};

  let prevFullyPassed = true; // Course 1 has no prerequisites.
  for (const step of COURSE_PROGRESSION) {
    unlocked[step.courseId] = prevFullyPassed;
    if (!prevFullyPassed) {
      // Once a link in the chain fails, all subsequent courses stay locked.
      prevFullyPassed = false;
      continue;
    }
    prevFullyPassed = isCourseFullyPassed(
      rows,
      step.slug,
      step.lessonCount
    );
  }

  return unlocked;
}

// ---------------------------------------------------------------------------
// Default unlocked map — PESSIMISTIC.
//
// Before the fetch resolves we cannot know whether the student has
// completed the previous courses, so we default to the STRICT
// prerequisite chain:
//
//   Course 1 → unlocked (no prerequisites, by design)
//   Course 2 → locked
//   Course 3 → locked
//   Course 4 → locked
//
// This guarantees that a course which is ultimately locked cannot
// briefly flash as unlocked on the very first paint. Once the
// `quiz_results` fetch resolves, the real unlock map replaces this.
//
// The same map is used as the fallback on fetch errors and when no
// authenticated user is found, so a network glitch or a signed-out
// visitor never briefly sees everything unlocked.
// ---------------------------------------------------------------------------
const DEFAULT_UNLOCKED: Record<number, boolean> = {
  1: true,
  2: false,
  3: false,
  4: false,
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function CoursesPage() {
  // =========================================================================
  // TESTING TOGGLE — UNLOCK ALL COURSES
  //
  //   `true`  → bypasses the entire course-prerequisite chain. Every course
  //             card renders in its active / unlocked state, and the "ትምህርቱን
  //             ጀምር" button navigates normally.
  //
  //   `false` → restores the original production behavior 100%: each course
  //             is gated behind the FULL completion (all lessons + final
  //             exam, ≥ 50%) of the previous course in `COURSE_PROGRESSION`.
  //
  // Keep this `false` in production.
  // =========================================================================
  const UNLOCK_ALL_COURSES = false; // Set to false to restore course prerequisites

  const [hasMounted, setHasMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sequential-unlock state ------------------------------------------------
  const [unlockedMap, setUnlockedMap] =
    useState<Record<number, boolean>>(DEFAULT_UNLOCKED);
  const [progressLoading, setProgressLoading] = useState(true);

  // Component did mount → safe to apply dynamic classes
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Global dark mode initialization (read from localStorage)
  useEffect(() => {
    const stored = localStorage.getItem('basira-theme');
    if (stored === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // -------------------------------------------------------------------------
  // FETCH QUIZ RESULTS → compute sequential-unlock map
  //
  // The initial `unlockedMap` state is PESSIMISTIC (see DEFAULT_UNLOCKED
  // above), so until this effect resolves, only Course 1 is shown as
  // unlocked and every subsequent course is shown as locked. This
  // prevents any "unlocked → locked" flash on the first paint.
  //
  // On a fetch failure or when the user is signed out, we keep the
  // pessimistic default so the page never briefly claims everything is
  // unlocked. Once a real response arrives, the map is replaced with
  // the computed chain state.
  //
  // When UNLOCK_ALL_COURSES is true, the fetch still runs (so the
  // state stays consistent) but its result is ignored at render time.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!hasMounted) return;
    let cancelled = false;

    const run = async () => {
      setProgressLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!user) {
          // No authenticated user — keep the pessimistic default.
          setUnlockedMap(DEFAULT_UNLOCKED);
          return;
        }

        const slugs = COURSE_PROGRESSION.map((c) => c.slug);

        const { data, error } = await supabase
          .from('quiz_results')
          .select('course_id, lesson_id, score, total_questions')
          .eq('user_id', user.id)
          .in('course_id', slugs);

        if (cancelled) return;

        if (error) {
          console.warn(
            '[Courses] quiz_results fetch error — using pessimistic default:',
            error.message
          );
          setUnlockedMap(DEFAULT_UNLOCKED);
          return;
        }

        setUnlockedMap(computeUnlockedMap((data ?? []) as any[]));
      } catch (e) {
        if (!cancelled) {
          console.warn('[Courses] unexpected progression error:', e);
          setUnlockedMap(DEFAULT_UNLOCKED);
        }
      } finally {
        if (!cancelled) setProgressLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [hasMounted]);

  // Close drawer on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div
      suppressHydrationWarning={true}
      className={`min-h-screen transition-colors duration-300 font-sans tracking-wide leading-relaxed ${
        hasMounted && darkMode
          ? 'dark bg-slate-900 text-white'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* =================================================================== */}
      {/* Top Header with background image                                    */}
      {/* Left: Back → Dashboard · Center: Title · Right: Hamburger           */}
      {/* =================================================================== */}
      <header className="relative sticky top-0 z-40 overflow-hidden shadow-sm border-b border-slate-200/60 dark:border-slate-700/60">
        {/* Background image + overlay layers */}
        <div className="absolute inset-0">
          <img
            src={HEADER_BG_URL}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover scale-105"
          />
          {/* Emerald tint + darkness for legibility */}
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/85 via-emerald-900/70 to-slate-950/80" />
          {/* Subtle decorative glow */}
          <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl" />
        </div>

        {/* Header content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
          {/* LEFT — Back to Dashboard */}
          <Link
            href="/dashboard"
            aria-label={amh.backToDashboard}
            className="flex-shrink-0 p-2 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-white" />
          </Link>

          {/* CENTER — Title */}
          <h1 className="flex-1 min-w-0 text-lg sm:text-xl font-bold text-white flex items-center justify-center gap-2 truncate drop-shadow-sm">
            <GraduationCap className="h-6 w-6 flex-shrink-0 text-amber-300" />
            <span className="truncate">{amh.title}</span>
          </h1>

          {/* RIGHT — Hamburger Menu */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={amh.menu}
            aria-expanded={menuOpen}
            className="flex-shrink-0 p-2 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
          >
            <Menu className="h-6 w-6 text-white" />
          </button>
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
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer panel */}
          <aside
            className="absolute top-0 right-0 h-full w-72 max-w-[85vw] bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
                  <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  ባሲራ
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
              >
                <Home className="h-5 w-5" />
                {amh.dashboard}
              </Link>
              <Link
                href="/courses"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
              >
                <BookOpen className="h-5 w-5" />
                {amh.courses}
              </Link>
            </nav>
          </aside>
        </div>
      )}

      {/* =================================================================== */}
      {/* Main content — course grid starts directly below the header         */}
      {/* =================================================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {courses.map((course) => {
            // -----------------------------------------------------------------
            // TESTING BYPASS — when UNLOCK_ALL_COURSES is true, every course
            // is treated as unlocked. Restore production behavior by setting
            // the flag to `false` at the top of the component.
            //
            // INSTANT LOCK STATE — the `unlockedMap` state starts PESSIMISTIC
            // (only Course 1 unlocked). This means the very first render
            // already shows Courses 2-4 as locked, and they only ever flip
            // to unlocked if the `quiz_results` fetch confirms the student
            // has completed every previous course. There is no
            // "unlocked → locked" flash.
            // -----------------------------------------------------------------
            const isLocked = UNLOCK_ALL_COURSES
              ? false
              : !unlockedMap[course.id];

            return (
              <div
                key={course.id}
                className={[
                  'group bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col transition-all duration-300 ease-out',
                  isLocked
                    ? 'opacity-95'
                    : 'hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-950/10 hover:border-emerald-200 dark:hover:border-emerald-900/60',
                ].join(' ')}
              >
                {/* Islamic cover image with subtle gradient overlay */}
                <div
                  className={`relative h-40 overflow-hidden bg-gradient-to-br ${course.gradient}`}
                >
                  <img
                    src={course.image}
                    alt={course.title}
                    loading="lazy"
                    className={[
                      'absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-500 ease-out',
                      isLocked
                        ? 'grayscale-[35%]'
                        : 'group-hover:scale-110',
                    ].join(' ')}
                  />
                  {/* Subtle dark gradient for readability + premium feel */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
                  {/* Islamic geometric accent line */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300" />

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10">
                    <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full border border-white/30">
                      {course.category}
                    </span>
                    <span className="bg-yellow-400/90 text-yellow-900 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      {amh.certificateBadge}
                    </span>
                  </div>

                  {/* Lock badge — top-right corner, only when locked */}
                  {isLocked && (
                    <div className="absolute top-3 right-3 z-10">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/85 dark:bg-slate-950/85 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 border border-white/25 shadow-sm">
                        <Lock className="h-3 w-3" />
                        {amh.lockedBadge}
                      </span>
                    </div>
                  )}

                  {/* Lock watermark overlay — large centered lock icon */}
                  {isLocked && (
                    <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900/40 dark:bg-slate-950/50 backdrop-blur-sm border border-white/25 shadow-lg">
                        <Lock className="h-7 w-7 text-white drop-shadow" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    {course.title}
                  </h3>

                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
                    <BookOpen className="h-4 w-4" />
                    <span>
                      {course.lessonsCount} {amh.lessons}
                    </span>
                  </div>

                  {/* Action — active Link when unlocked, disabled button
                      when locked by the prerequisite chain.

                      When UNLOCK_ALL_COURSES is true, `isLocked` is always
                      false, so every card renders the active Link. */}
                  {isLocked ? (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      aria-label={amh.lockedCourse}
                      className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium cursor-not-allowed select-none text-center text-xs sm:text-sm leading-tight"
                    >
                      <Lock className="h-4 w-4 flex-shrink-0" />
                      <span>{amh.lockedCourse}</span>
                    </button>
                  ) : (
                    <Link
                      href={`/courses/${course.id}`}
                      className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors text-center"
                    >
                      <GraduationCap className="h-5 w-5" />
                      {amh.courseStart}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}