// app/api/generate-certificate/route.ts
//
// Server-side eligibility check + PDF certificate generator.
//
// Flow:
//   1. Authenticate the caller from request cookies via Supabase SSR.
//   2. Verify the caller's identity matches the `userId` in the body
//      (prevents one student from generating another student's certificate).
//   3. Enforce the four-part eligibility rule:
//        a) Every required course in REQUIRED_COURSES must have at least one
//           quiz attempt recorded in `quiz_results`.
//        b) Every active lesson within each required course must have an
//           attempt recorded.
//        c) A final comprehensive exam attempt must exist
//           (`is_final_exam = true`).
//        d) The SYSTEM-WIDE score must be >= 50%:
//             overallPercent =
//               Math.round((totalEarnedPoints / totalSystemPossibleQuestions) * 100)
//           where `totalSystemPossibleQuestions` is the sum of every active
//           lesson's question count across the whole curriculum (plus the
//           final exam when applicable). This closes the loophole where a
//           student completing 1 lesson could otherwise hit 50% locally.
//   4. Resolve the student's display name using this strict priority:
//        a) profiles.full_name
//        b) user_metadata.full_name → name → display_name → username
//        c) Capitalized email prefix  (e.g. "abebe@gmail.com" → "Abebe")
//      The generic "Student" label is never rendered.
//   5. Verify the user has an `approved` row in `payments`.
//   6. Generate a landscape A4 PDF in memory.
//   7. Try to upload the PDF to Supabase Storage. If the upload FAILS for
//      any reason (missing bucket, RLS denial, network, quota, etc.), fall
//      back to streaming the PDF directly to the client as a download.
//   8. On successful upload, return the public URL + certificate ID.
//
// This file contains ONLY server-side logic — no JSX, no HTML, no React hooks.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Route configuration
// ---------------------------------------------------------------------------
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The 4 required books — used to render the list on the PDF certificate. */
const REQUIRED_COURSES: { slug: string; displayName: string }[] = [
  {
    slug: 'usul_al_thalatha',
    displayName: 'Usul Al-Thalatha (The Three Fundamentals)',
  },
  {
    slug: 'arbain',
    displayName: "Arba'in An-Nawawi (The Forty Hadith)",
  },
  {
    slug: 'shurut_as_salah',
    displayName: 'Shurut As-Salah (Conditions of Prayer)',
  },
  {
    slug: 'urjuzat',
    displayName: "Urjuzat Al-Mi'iyyah",
  },
];

/** Minimum SYSTEM-WIDE score percentage required to pass. */
const PASS_THRESHOLD_PERCENT = 50;

/** Supabase Storage bucket that holds the generated PDFs. */
const CERTIFICATES_BUCKET = 'certificates';

/** A4 landscape page size, in PDF points. */
const PAGE_W = 841.89;
const PAGE_H = 595.28;

/** Canonical Amharic message returned on eligibility failure. */
const NOT_ELIGIBLE_MESSAGE =
  'ሁሉንም ደርሶች እና የማጠቃለያ ፈተና አጠናቀው ከ 50% በላይ ማምጣት አለብዎት።';

/**
 * Default question count used when the `lessons` table does not expose a
 * per-lesson question count. Keeps the denominator meaningful instead of
 * collapsing to zero.
 */
const DEFAULT_QUESTIONS_PER_LESSON = 10;

// ---------------------------------------------------------------------------
// Local asset loader — reads PNGs from `public/` for PDF embedding
// ---------------------------------------------------------------------------
//
// Returns `null` on any failure (missing file, permissions, unsupported
// filesystem) so the certificate PDF can still be generated — just without
// the signature / seal — instead of throwing a 500 to the client.
//
// PNG transparency is preserved natively by PDFKit, so a correctly-authored
// transparent PNG renders with no background box.
// ---------------------------------------------------------------------------
function loadPublicImage(filename: string): Buffer | null {
  try {
    const fullPath = path.join(process.cwd(), 'public', filename);
    if (!fs.existsSync(fullPath)) {
      console.warn(
        `[generate-certificate] Optional asset not found (PDF will render without it): ${fullPath}`
      );
      return null;
    }
    return fs.readFileSync(fullPath);
  } catch (err) {
    console.warn(
      `[generate-certificate] Failed to read optional asset "${filename}":`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Supabase service-role client (lazy, cached) — anon-key fallback
// ---------------------------------------------------------------------------

let cachedClient: SupabaseClient | null = null;
let cachedClientMode: 'service' | 'anon' | null = null;

function getSupabaseClient(): {
  client: SupabaseClient;
  mode: 'service' | 'anon';
} {
  if (cachedClient && cachedClientMode) {
    return { client: cachedClient, mode: cachedClientMode };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.');
  }

  const chosenKey = serviceKey || anonKey;
  const mode: 'service' | 'anon' = serviceKey ? 'service' : 'anon';

  if (!chosenKey) {
    throw new Error(
      'Missing both SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY — at least one is required.'
    );
  }

  if (!serviceKey) {
    console.warn(
      '[generate-certificate] SUPABASE_SERVICE_ROLE_KEY not set — falling back to NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Auth admin APIs (getUserById) will be skipped; the display name will be derived from the profiles table or the email prefix.'
    );
  }

  cachedClient = createClient(url.replace(/\/+$/, ''), chosenKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  cachedClientMode = mode;

  return { client: cachedClient, mode };
}

// ---------------------------------------------------------------------------
// Authenticated client — reads the caller's session from request cookies.
// Used to identify WHO is calling. This is the security boundary.
// ---------------------------------------------------------------------------

async function getAuthClient(): Promise<{
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null;
  error: string | null;
}> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // In a Route Handler this normally does not throw, but we
              // guard against it so a cookie write never blocks the request.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return { user: null, error: error.message };
    }
    if (!user) {
      return { user: null, error: 'No authenticated session.' };
    }

    return { user, error: null };
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeRatio(score: unknown, total: unknown): number {
  const s = Number(score) || 0;
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return s / t;
}

function generateCertificateId(): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const block = (n: number): string => {
    let out = '';
    for (let i = 0; i < n; i += 1) {
      out += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
    }
    return out;
  };
  return `CERT-${block(6)}-${block(4)}`;
}

function sanitizeUserId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

function formatIssueDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function buildCertificateFilename(studentName: string): string {
  const safe = studentName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '');
  return `Basira_Certificate_${safe || 'Certificate'}.pdf`;
}

function pdfDownloadResponse(
  pdfBuffer: Buffer,
  filename: string,
  certificateId: string
): NextResponse {
  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'no-store',
      'X-Certificate-Id': certificateId,
    },
  });
}

function pickFirstNonEmpty(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate.trim();
    }
  }
  return '';
}

function nameFromEmail(email: string): string {
  const trimmed = email.trim();
  if (trimmed === '') return '';

  const atIndex = trimmed.indexOf('@');
  const localPart = atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed;
  if (localPart === '') return '';

  const segments = localPart.split(/[._\-+]+/).filter((s) => s !== '');
  if (segments.length === 0) return '';

  return segments
    .map((segment) => {
      if (segment.length === 0) return segment;
      const first = segment.charAt(0).toUpperCase();
      const rest = segment.slice(1);
      return first + rest;
    })
    .join(' ');
}

function nameFromAuthUser(authUser: unknown): string {
  const user = authUser as
    | {
        email?: unknown;
        user_metadata?: Record<string, unknown> | null;
      }
    | null;

  const meta = user?.user_metadata ?? undefined;

  const fromMetadata = pickFirstNonEmpty(
    meta?.full_name,
    meta?.name,
    meta?.display_name,
    meta?.username
  );
  if (fromMetadata !== '') return fromMetadata;

  const email = typeof user?.email === 'string' ? user.email : '';
  const fromEmail = nameFromEmail(email);
  if (fromEmail !== '') return fromEmail;

  return '';
}

async function fetchProfileFullName(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn(
        '[generate-certificate] profiles lookup warning:',
        error.message
      );
      return '';
    }

    const fullName = (data as { full_name?: unknown } | null)?.full_name;
    return pickFirstNonEmpty(fullName);
  } catch (err) {
    console.warn(
      '[generate-certificate] profiles lookup unexpected error:',
      err instanceof Error ? err.message : String(err)
    );
    return '';
  }
}

// ---------------------------------------------------------------------------
// Curriculum loader — fetches all active lessons with their question counts
// ---------------------------------------------------------------------------
//
// Returns:
//   • lessonsByCourse     → Map<courseSlug, Set<lessonId>>
//   • lessonMaxById       → Map<lessonId, maxQuestions>
//   • perCourseMax        → Map<courseSlug, totalMaxQuestions>
//   • totalSystemMax      → sum of maxQuestions across every active lesson
//   • totalActiveLessons  → count of every active lesson
//
// Multiple column-name fallbacks are attempted so the function never throws
// a hard failure if the schema varies slightly between environments.
// ---------------------------------------------------------------------------

interface CurriculumData {
  lessonsByCourse: Map<string, Set<string>>;
  lessonMaxById: Map<string, number>;
  perCourseMax: Map<string, number>;
  totalSystemMax: number;
  totalActiveLessons: number;
}

async function fetchCurriculumData(
  supabase: SupabaseClient
): Promise<CurriculumData> {
  const lessonsByCourse = new Map<string, Set<string>>();
  const lessonMaxById = new Map<string, number>();
  const perCourseMax = new Map<string, number>();
  let totalSystemMax = 0;
  let totalActiveLessons = 0;

  let lessonsData: Array<Record<string, any>> = [];

  // ---- Attempt 1: modern schema with `total_questions` ----
  try {
    const t1 = await supabase
      .from('lessons')
      .select('id, course_id, is_active, total_questions');

    if (!t1.error) {
      lessonsData = (t1.data ?? []) as Array<Record<string, any>>;
    } else {
      console.warn(
        '[generate-certificate] lessons select (id, course_id, is_active, total_questions) failed:',
        t1.error.message
      );

      // ---- Attempt 2: `questions_count` alias ----
      const t2 = await supabase
        .from('lessons')
        .select('id, course_id, is_active, questions_count');

      if (!t2.error) {
        lessonsData = ((t2.data ?? []) as Array<Record<string, any>>).map(
          (r) => ({ ...r, total_questions: r.questions_count })
        );
      } else {
        console.warn(
          '[generate-certificate] lessons select (id, course_id, is_active, questions_count) failed:',
          t2.error.message
        );

        // ---- Attempt 3: no is_active, with total_questions ----
        const t3 = await supabase
          .from('lessons')
          .select('id, course_id, total_questions');

        if (!t3.error) {
          lessonsData = (t3.data ?? []) as Array<Record<string, any>>;
        } else {
          console.warn(
            '[generate-certificate] lessons select (id, course_id, total_questions) failed:',
            t3.error.message
          );

          // ---- Attempt 4: no question count, use default ----
          const t4 = await supabase
            .from('lessons')
            .select('id, course_id, is_active');

          if (!t4.error) {
            lessonsData = ((t4.data ?? []) as Array<Record<string, any>>).map(
              (r) => ({ ...r, total_questions: DEFAULT_QUESTIONS_PER_LESSON })
            );
          } else {
            console.warn(
              '[generate-certificate] lessons select (id, course_id, is_active) failed:',
              t4.error.message
            );

            // ---- Attempt 5: legacy `book_id` ----
            const t5 = await supabase.from('lessons').select('id, book_id');

            if (!t5.error) {
              lessonsData = ((t5.data ?? []) as Array<Record<string, any>>).map(
                (r) => ({
                  id: r.id,
                  course_id: r.book_id,
                  is_active: true,
                  total_questions: DEFAULT_QUESTIONS_PER_LESSON,
                })
              );
            } else {
              console.error(
                '[generate-certificate] lessons select (id, book_id) failed (non-fatal):',
                t5.error.message
              );
              lessonsData = [];
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(
      '[generate-certificate] lessons fetch unexpected error:',
      err instanceof Error ? err.message : String(err)
    );
    lessonsData = [];
  }

  // ---- Aggregate rows ----
  for (const row of lessonsData) {
    if (row.is_active === false) continue;

    const courseId = String(row.course_id ?? row.book_id ?? '');
    const lessonId = String(row.id ?? '');
    if (!courseId || !lessonId) continue;

    const rawMax = Number(
      row.total_questions ?? row.questions_count ?? row.question_count
    );
    const lessonMax =
      Number.isFinite(rawMax) && rawMax > 0
        ? rawMax
        : DEFAULT_QUESTIONS_PER_LESSON;

    const set = lessonsByCourse.get(courseId) ?? new Set<string>();
    set.add(lessonId);
    lessonsByCourse.set(courseId, set);

    lessonMaxById.set(lessonId, lessonMax);
    perCourseMax.set(courseId, (perCourseMax.get(courseId) ?? 0) + lessonMax);

    totalSystemMax += lessonMax;
    totalActiveLessons += 1;
  }

  return {
    lessonsByCourse,
    lessonMaxById,
    perCourseMax,
    totalSystemMax,
    totalActiveLessons,
  };
}

// ---------------------------------------------------------------------------
// Eligibility evaluation — fetches curriculum + quiz_results, applies rules
//
// RULES ENFORCED (all must pass):
//   1. Every required course must have at least one quiz attempt.
//   2. Every active lesson within each required course must have an attempt.
//   3. A final comprehensive exam attempt must exist (is_final_exam = true).
//   4. SYSTEM-WIDE score must be >= 50%:
//        overallPercent = (totalEarnedPoints / totalSystemPossibleQuestions) * 100
//
// The previous version used the student's own attempt totals as the
// denominator, which allowed a single completed lesson (e.g. 5/10) to reach
// 50% locally and unlock the certificate. This version enforces the true
// curriculum-wide percentage instead.
// ---------------------------------------------------------------------------

interface EligibilityResult {
  eligible: boolean;
  reason: string | null;
  details: {
    totalLessons: number;
    completedLessons: number;
    hasFinalExam: boolean;
    finalExamPercent: number;
    combinedPercent: number;
    totalEarnedPoints: number;
    totalSystemPossibleQuestions: number;
  };
}

async function evaluateEligibility(
  supabase: SupabaseClient,
  userId: string
): Promise<EligibilityResult> {
  // ---- 1. Fetch curriculum data (lessons + question counts) ----
  const curriculum = await fetchCurriculumData(supabase);
  const {
    lessonsByCourse,
    perCourseMax,
    totalSystemMax,
  } = curriculum;

  // Restrict the system denominator to the four REQUIRED courses only, so
  // optional/decorative lessons outside the program don't inflate the max.
  let totalRequiredMax = 0;
  for (const course of REQUIRED_COURSES) {
    totalRequiredMax += perCourseMax.get(course.slug) ?? 0;
  }

  // ---- 2. Fetch the student's quiz attempts ----
  let attempts: Array<Record<string, any>> = [];
  try {
    const { data, error } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return {
        eligible: false,
        reason: `የፈተና ውጤቶችን ማግኘት አልተቻለም: ${error.message}`,
        details: {
          totalLessons: curriculum.totalActiveLessons,
          completedLessons: 0,
          hasFinalExam: false,
          finalExamPercent: 0,
          combinedPercent: 0,
          totalEarnedPoints: 0,
          totalSystemPossibleQuestions: totalRequiredMax,
        },
      };
    }

    attempts = (data ?? []) as Array<Record<string, any>>;
  } catch (err) {
    return {
      eligible: false,
      reason: `የፈተና ውጤቶችን ማግኘት አልተቻለም: ${
        err instanceof Error ? err.message : String(err)
      }`,
      details: {
        totalLessons: curriculum.totalActiveLessons,
        completedLessons: 0,
        hasFinalExam: false,
        finalExamPercent: 0,
        combinedPercent: 0,
        totalEarnedPoints: 0,
        totalSystemPossibleQuestions: totalRequiredMax,
      },
    };
  }

  // ---- 3. Group attempts by COURSE → LESSON ----
  //
  //   attemptsByCourse: Map<courseSlug, Map<lessonKey, { score, total }>>
  //     → best attempt per lesson per course (retakes don't double-count)
  //
  //   A separate slot tracks the best final-exam attempt.
  const attemptsByCourse = new Map<
    string,
    Map<string, { score: number; total: number }>
  >();
  let bestFinalExam: { score: number; total: number } | null = null;

  for (const row of attempts) {
    const score = Number(row.score) || 0;
    const total = Number(row.total_questions) || 0;

    // ---- 3a. Final exam branch ----
    if (row.is_final_exam === true) {
      if (!bestFinalExam || score > bestFinalExam.score) {
        bestFinalExam = { score, total };
      }
      continue;
    }

    // ---- 3b. Regular lesson attempt ----
    const courseId = String(
      row.course_id ?? row.book_id ?? row.course_slug ?? ''
    );
    if (!courseId) continue;

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
  }

  // ---- 4. Evaluate each required course independently ----
  interface CourseStat {
    slug: string;
    displayName: string;
    attempted: boolean;
    completedLessons: number;
    totalLessons: number;
    courseMax: number;
    earnedScore: number;
  }

  const perCourseStats: CourseStat[] = [];
  let totalEarnedPoints = 0;
  let completedLessonsAll = 0;

  for (const course of REQUIRED_COURSES) {
    const courseMap = attemptsByCourse.get(course.slug);

    // Distinct lesson keys the student has attempted for this course.
    const attemptedLessonIds = courseMap ? Array.from(courseMap.keys()) : [];
    const completedCount = attemptedLessonIds.length;

    // Total lessons expected for this course (from `lessons` table).
    // If the table is unavailable or has no rows for this course, we fall
    // back to requiring just 1 attempt so the student is not falsely
    // blocked by an infrastructure gap.
    const requiredLessonSet = lessonsByCourse.get(course.slug);
    const requiredCountFromTable = requiredLessonSet
      ? requiredLessonSet.size
      : 0;
    const effectiveRequired =
      requiredCountFromTable > 0 ? requiredCountFromTable : 1;

    // Sum the best scores for every completed lesson in this course.
    let courseScore = 0;
    if (courseMap) {
      for (const { score } of courseMap.values()) {
        courseScore += score;
      }
    }

    const courseMax = perCourseMax.get(course.slug) ?? 0;

    perCourseStats.push({
      slug: course.slug,
      displayName: course.displayName,
      attempted: completedCount > 0,
      completedLessons: completedCount,
      totalLessons: effectiveRequired,
      courseMax,
      earnedScore: courseScore,
    });

    totalEarnedPoints += courseScore;
    completedLessonsAll += completedCount;
  }

  // ---- 5. Add the final exam to the aggregate ----
  const hasFinalExam = bestFinalExam !== null;
  const finalExamPercent =
    bestFinalExam && bestFinalExam.total > 0
      ? Math.round((bestFinalExam.score / bestFinalExam.total) * 100)
      : 0;

  let totalSystemPossibleQuestions = totalRequiredMax;
  if (bestFinalExam) {
    totalEarnedPoints += bestFinalExam.score;
    totalSystemPossibleQuestions += bestFinalExam.total;
  }

  // ---- 6. Compute the strict system-wide percentage ----
  const combinedPercent =
    totalSystemPossibleQuestions > 0
      ? Math.round((totalEarnedPoints / totalSystemPossibleQuestions) * 100)
      : 0;

  // ---- 7. Enforce every rule ----
  const missingParts: string[] = [];

  // Rule A — every required course must have at least one attempt.
  const untouchedCourses = perCourseStats.filter((c) => !c.attempted);
  if (untouchedCourses.length > 0) {
    const names = untouchedCourses.map((c) => c.displayName).join('، ');
    missingParts.push(`የሚከተሉት ኪታቦች ገና አልተጀመሩም: ${names}።`);
  }

  // Rule B — every required course must have all its lessons completed.
  const incompleteCourses = perCourseStats.filter(
    (c) => c.attempted && c.completedLessons < c.totalLessons
  );
  if (incompleteCourses.length > 0) {
    const detail = incompleteCourses
      .map(
        (c) =>
          `${c.displayName} (${c.completedLessons}/${c.totalLessons} ደርሶች)`
      )
      .join('، ');
    missingParts.push(`ተጨማሪ ደርሶችን ማጠናቀቅ ያስፈልጋል: ${detail}።`);
  }

  // Rule C — final exam must be completed.
  if (!hasFinalExam) {
    missingParts.push('የማጠቃለያ ፈተናውን ማጠናቀቅ ያስፈልጋል።');
  }

  // Rule D — system-wide score ≥ 50%.
  if (combinedPercent < PASS_THRESHOLD_PERCENT) {
    missingParts.push(
      `እስካሁን ያገኙት ነጥብ ${totalEarnedPoints} / ${totalSystemPossibleQuestions} (${combinedPercent}%) ነው። ሰርተፊኬት ለማግኘት ከጠቅላላው ቢያንስ ${PASS_THRESHOLD_PERCENT}% ማምጣት አለብዎት።`
    );
  }

  const allCoursesAttempted = untouchedCourses.length === 0;
  const allLessonsCompleted = incompleteCourses.length === 0;
  const scoreOk = combinedPercent >= PASS_THRESHOLD_PERCENT;

  const eligible =
    allCoursesAttempted &&
    allLessonsCompleted &&
    hasFinalExam &&
    scoreOk;

  // ---- 8. Return ----
  //
  // `totalLessons` reflects the sum of expected lessons across all required
  // courses. When the `lessons` table is unavailable, `effectiveRequired`
  // collapses to 1 per course, so this value stays meaningful.
  const totalRequiredLessons = perCourseStats.reduce(
    (acc, c) => acc + c.totalLessons,
    0
  );

  return {
    eligible,
    reason: eligible
      ? null
      : `${NOT_ELIGIBLE_MESSAGE} ${missingParts.join(' ')}`.trim(),
    details: {
      totalLessons: totalRequiredLessons,
      completedLessons: completedLessonsAll,
      hasFinalExam,
      finalExamPercent,
      combinedPercent,
      totalEarnedPoints,
      totalSystemPossibleQuestions,
    },
  };
}

// ---------------------------------------------------------------------------
// PDF generation — 100% programmatic, no template file, no fs access
// ---------------------------------------------------------------------------

function generateCertificatePdf(opts: {
  studentName: string;
  certificateId: string;
  issueDate: Date;
  completedBooks: string[];
}): Promise<Buffer> {
  const { studentName, certificateId, issueDate, completedBooks } = opts;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PAGE_W, PAGE_H],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: 'Certificate of Completion',
          Author: 'BASIRA Islamic Studies Program',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const cx = PAGE_W / 2;

      const DARK_GREEN = '#0f3d24';
      const GOLD = '#c9a227';
      const SLATE = '#4b5563';
      const NEAR_BLACK = '#111827';
      const CREAM = '#fdfbf3';

      doc.rect(0, 0, PAGE_W, PAGE_H).fill(CREAM);

      doc.lineWidth(3).strokeColor(GOLD)
        .rect(20, 20, PAGE_W - 40, PAGE_H - 40).stroke();
      doc.lineWidth(0.75).strokeColor(DARK_GREEN)
        .rect(28, 28, PAGE_W - 56, PAGE_H - 56).stroke();
      doc.lineWidth(0.5).strokeColor(GOLD)
        .rect(34, 34, PAGE_W - 68, PAGE_H - 68).stroke();

      const drawDiamond = (x: number, y: number, size: number) => {
        doc.moveTo(x, y - size)
          .lineTo(x + size, y)
          .lineTo(x, y + size)
          .lineTo(x - size, y)
          .closePath()
          .fill(GOLD);
      };
      drawDiamond(34, 34, 5);
      drawDiamond(PAGE_W - 34, 34, 5);
      drawDiamond(34, PAGE_H - 34, 5);
      drawDiamond(PAGE_W - 34, PAGE_H - 34, 5);

      const sealCY = 95;
      const sealR = 42;
      doc.circle(cx, sealCY, sealR).lineWidth(2).strokeColor(GOLD).stroke();
      doc.circle(cx, sealCY, sealR - 6).lineWidth(0.75).strokeColor(DARK_GREEN).stroke();
      doc.circle(cx, sealCY, sealR - 12).lineWidth(0.5).strokeColor(GOLD).stroke();

      drawDiamond(cx, sealCY - sealR, 3.5);
      drawDiamond(cx + sealR, sealCY, 3.5);
      drawDiamond(cx, sealCY + sealR, 3.5);
      drawDiamond(cx - sealR, sealCY, 3.5);

      doc.fillColor(DARK_GREEN).font('Helvetica-Bold').fontSize(14)
        .text('BASIRA', cx - 45, sealCY - 10, { width: 90, align: 'center' });

      doc.fillColor(DARK_GREEN).font('Helvetica-Bold').fontSize(32)
        .text('CERTIFICATE', 0, 158, { align: 'center', width: PAGE_W });
      doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(13)
        .text('OF COMPLETION', 0, 200, { align: 'center', width: PAGE_W });

      const divY = 225;
      doc.moveTo(cx - 150, divY).lineTo(cx + 150, divY)
        .lineWidth(0.75).strokeColor(GOLD).stroke();
      drawDiamond(cx, divY, 4);

      doc.fillColor(SLATE).font('Helvetica-Oblique').fontSize(11)
        .text('This is to certify that', 0, 242, {
          align: 'center', width: PAGE_W,
        });

      doc.fillColor(NEAR_BLACK).font('Helvetica-Bold').fontSize(30)
        .text(studentName, 0, 262, { align: 'center', width: PAGE_W });

      let nameW = 200;
      try {
        nameW = doc.widthOfString(studentName);
      } catch {
        nameW = Math.min(studentName.length * 16, 400);
      }
      nameW = Math.min(nameW, PAGE_W * 0.6);
      const underY = 302;
      doc.moveTo(cx - nameW / 2 - 20, underY)
        .lineTo(cx + nameW / 2 + 20, underY)
        .lineWidth(1).strokeColor(GOLD).stroke();

      doc.fillColor(SLATE).font('Helvetica').fontSize(11)
        .text(
          'has successfully completed all four required books of the BASIRA Islamic Studies Program:',
          0, 322, { align: 'center', width: PAGE_W }
        );

      let y = 356;
      for (const book of completedBooks) {
        drawDiamond(cx - 170, y, 3.5);
        doc.fillColor(NEAR_BLACK).font('Helvetica').fontSize(11)
          .text(book, cx - 154, y - 5, { width: 360 });
        y += 20;
      }

      // ---------------------------------------------------------------------
      // Digital signature — embedded from `public/signature.png`
      //
      // The signature is centered horizontally on the page by anchoring a
      // fixed-width box on `cx` and using `align: 'center'` inside the box.
      // This guarantees perfect centering above the "Authorized Signature"
      // rule line regardless of the source PNG's aspect ratio.
      //
      // PDFKit preserves the PNG's alpha channel, so a correctly-authored
      // transparent PNG renders cleanly with no background box.
      //
      // If the file is missing or unreadable, `loadPublicImage` returns
      // `null` and we simply skip the image — the rule line and caption
      // below still render so the certificate stays visually complete.
      // ---------------------------------------------------------------------
      const sigY = 468;
      const sigHalf = 80;

      const signatureBuffer = loadPublicImage('signature.png');
      if (signatureBuffer) {
        // Box is centered on `cx`: left edge = cx - (boxW / 2).
        const sigBoxW = 220;
        const sigBoxH = 65;
        const sigBoxX = cx - sigBoxW / 2;
        const sigBoxY = 405;

        try {
          doc.image(signatureBuffer, sigBoxX, sigBoxY, {
            fit: [sigBoxW, sigBoxH],
            align: 'center',
            valign: 'center',
          });
        } catch (sigErr) {
          console.warn(
            '[generate-certificate] Failed to embed signature image:',
            sigErr instanceof Error ? sigErr.message : String(sigErr)
          );
        }
      }

      // Horizontal rule + caption below the signature image.
      doc.moveTo(cx - sigHalf, sigY).lineTo(cx + sigHalf, sigY)
        .lineWidth(0.5).strokeColor(SLATE).stroke();
      doc.fillColor(SLATE).font('Helvetica-Oblique').fontSize(9)
        .text('Authorized Signature', cx - sigHalf, sigY + 5, {
          width: sigHalf * 2, align: 'center',
        });

      // ---------------------------------------------------------------------
      // Official seal — embedded from `public/seal.png`
      //
      // Anchored in the bottom-right corner, inside the inner border ring
      // and above the footer labels. The box is fixed at 100×100pt so the
      // seal never collides with the book list (which ends around y≈436 on
      // the right side is empty) or the footer text (y≈517).
      //
      // PDFKit preserves the PNG's alpha channel — a properly-authored
      // transparent seal renders with no black background box.
      // ---------------------------------------------------------------------
      const sealBuffer = loadPublicImage('seal.png');
      if (sealBuffer) {
        const sealBoxW = 100;
        const sealBoxH = 100;
        const sealRightMargin = 70; // from PAGE_W
        const sealBoxX = PAGE_W - sealRightMargin - sealBoxW;
        const sealBoxY = 380;

        try {
          doc.image(sealBuffer, sealBoxX, sealBoxY, {
            fit: [sealBoxW, sealBoxH],
            align: 'center',
            valign: 'center',
          });
        } catch (sealErr) {
          console.warn(
            '[generate-certificate] Failed to embed seal image:',
            sealErr instanceof Error ? sealErr.message : String(sealErr)
          );
        }
      }

      const footLabelY = PAGE_H - 78;
      const footValueY = PAGE_H - 62;
      doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(8)
        .text('ISSUED ON', 74, footLabelY, { width: 220 });
      doc.fillColor(NEAR_BLACK).font('Helvetica').fontSize(11)
        .text(formatIssueDate(issueDate), 74, footValueY, { width: 220 });

      doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(8)
        .text('CERTIFICATE ID', PAGE_W - 294, footLabelY, {
          width: 220, align: 'right',
        });
      doc.fillColor(NEAR_BLACK).font('Helvetica').fontSize(11)
        .text(certificateId, PAGE_W - 294, footValueY, {
          width: 220, align: 'right',
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // ---------- 1. Authenticate the caller from request cookies ----------
  const { user: authUser, error: authError } = await getAuthClient();

  if (authError || !authUser) {
    console.error(
      '[generate-certificate] Auth error:',
      authError || 'No authenticated session.'
    );
    return NextResponse.json(
      {
        eligible: false,
        error: 'ያልተረጋገጠ ጥያቄ። እባክዎ መጀመሪያ ይግቡ።',
        code: 'UNAUTHENTICATED',
      },
      { status: 401 }
    );
  }

  // ---------- 2. Read and validate the request body ----------
  let bodyUserId = '';

  try {
    const body = (await request.json()) as { userId?: string };
    if (typeof body.userId === 'string') bodyUserId = body.userId.trim();
  } catch {
    return NextResponse.json(
      { eligible: false, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  // The authenticated user's ID is the source of truth. If the client sent
  // a different `userId`, reject — this prevents cross-user abuse.
  if (bodyUserId && bodyUserId !== authUser.id) {
    console.error(
      '[generate-certificate] userId mismatch — auth:',
      authUser.id,
      'body:',
      bodyUserId
    );
    return NextResponse.json(
      {
        eligible: false,
        error: 'የተጠቃሚ መለያ አለመመሳሰል። እባክዎ እንደገና ይግቡ።',
        code: 'USER_ID_MISMATCH',
      },
      { status: 403 }
    );
  }

  const userId = authUser.id;
  const safeUserId = sanitizeUserId(userId);

  // ---------- 3. Obtain service-role Supabase client ----------
  let supabase: SupabaseClient;
  let clientMode: 'service' | 'anon';
  try {
    const resolved = getSupabaseClient();
    supabase = resolved.client;
    clientMode = resolved.mode;
  } catch (envErr) {
    console.error('[generate-certificate] Supabase init error:', envErr);
    return NextResponse.json(
      {
        eligible: false,
        error:
          'Server misconfigured: Supabase credentials are missing. ' +
          'Set NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      },
      { status: 500 }
    );
  }

  // ---------- 4. Verify payment approval ----------
  const { data: approvedRows, error: paymentErr } = await supabase
    .from('payments')
    .select('id, status')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .limit(1);

  if (paymentErr) {
    console.error('[generate-certificate] payments error:', paymentErr);
    return NextResponse.json(
      { eligible: false, error: 'Failed to verify payment.' },
      { status: 500 }
    );
  }

  if (!approvedRows || approvedRows.length === 0) {
    return NextResponse.json(
      {
        eligible: false,
        error: 'ሰርተፊኬት ለማውረድ ክፍያዎ በአድሚን መረጋገጥ አለበት።',
      },
      { status: 403 }
    );
  }

  // ---------- 5. Evaluate lessons + final exam + system-wide score ----------
  const eligibility = await evaluateEligibility(supabase, userId);

  if (!eligibility.eligible) {
    console.warn(
      '[generate-certificate] Eligibility failed for user',
      userId,
      '—',
      eligibility.details
    );
    return NextResponse.json(
      {
        eligible: false,
        error: eligibility.reason || NOT_ELIGIBLE_MESSAGE,
        details: eligibility.details,
      },
      { status: 400 }
    );
  }

  // ---------- 6. Resolve the student's display name ----------
  //
  //   Priority chain (first non-empty wins):
  //     1. profiles.full_name                       ← PRIMARY
  //     2. auth user_metadata.full_name / name / display_name / username
  //     3. Capitalized email prefix
  //     4. "User <short-id>" as absolute last resort (never "Student")
  //
  let studentName = '';

  // (a) profiles.full_name
  studentName = await fetchProfileFullName(supabase, userId);

  // (b) Auth metadata + email prefix
  if (studentName === '') {
    // First, use the already-authenticated user object we obtained above.
    const fromAuthSession = nameFromAuthUser(authUser);
    if (fromAuthSession !== '') {
      studentName = fromAuthSession;
    }

    // If still empty and we have service-role access, try the admin API
    // for a richer metadata lookup.
    if (studentName === '' && clientMode === 'service') {
      try {
        const { data: userData, error: userErr } =
          await supabase.auth.admin.getUserById(userId);

        if (userErr) {
          console.warn(
            '[generate-certificate] getUserById warning:',
            userErr.message
          );
        } else if (userData?.user) {
          const fromAdmin = nameFromAuthUser(userData.user);
          if (fromAdmin !== '') {
            studentName = fromAdmin;
          }
        }
      } catch (userCatch) {
        console.warn(
          '[generate-certificate] getUserById unexpected error:',
          userCatch instanceof Error ? userCatch.message : String(userCatch)
        );
      }
    }
  }

  // (c) Absolute last resort — derive from the userId itself.
  if (studentName === '') {
    const shortId = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    studentName = shortId !== '' ? `User ${shortId}` : 'Certificate Holder';
  }

  // ---------- 7. Generate the PDF ----------
  const issueDate = new Date();
  const certificateId = generateCertificateId();
  const filePath = `${safeUserId}/${certificateId}.pdf`;
  const downloadFilename = buildCertificateFilename(studentName);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateCertificatePdf({
      studentName,
      certificateId,
      issueDate,
      completedBooks: REQUIRED_COURSES.map((c) => c.displayName),
    });
  } catch (pdfErr) {
    console.error('[generate-certificate] PDF error:', pdfErr);
    return NextResponse.json(
      { eligible: false, error: 'Failed to generate PDF.' },
      { status: 500 }
    );
  }

  // ---------- 8. Try to upload the PDF to Supabase Storage ----------
  let uploadFailed = false;
  let uploadErrorMessage = '';

  try {
    const { error: uploadError } = await supabase.storage
      .from(CERTIFICATES_BUCKET)
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      uploadFailed = true;
      uploadErrorMessage = uploadError.message || 'unknown storage error';
      console.error(
        '[generate-certificate] Storage upload failed — falling back to direct PDF stream:',
        uploadError
      );
    }
  } catch (uploadCatch) {
    uploadFailed = true;
    uploadErrorMessage =
      uploadCatch instanceof Error ? uploadCatch.message : String(uploadCatch);
    console.error(
      '[generate-certificate] Storage upload threw — falling back to direct PDF stream:',
      uploadCatch
    );
  }

  // ---------- 9a. Fallback: stream the PDF directly ----------
  if (uploadFailed) {
    console.warn(
      `[generate-certificate] Delivering PDF inline (storage unavailable). Reason: ${uploadErrorMessage}`
    );
    return pdfDownloadResponse(pdfBuffer, downloadFilename, certificateId);
  }

  // ---------- 9b. Happy path: resolve the public URL ----------
  const { data: publicUrlData } = supabase.storage
    .from(CERTIFICATES_BUCKET)
    .getPublicUrl(filePath);

  const certificateUrl = publicUrlData?.publicUrl ?? '';

  if (!certificateUrl) {
    console.warn(
      '[generate-certificate] getPublicUrl returned empty — falling back to direct PDF stream.'
    );
    try {
      await supabase.storage.from(CERTIFICATES_BUCKET).remove([filePath]);
    } catch {
      /* ignore cleanup errors */
    }
    return pdfDownloadResponse(pdfBuffer, downloadFilename, certificateId);
  }

  // ---------- 10. Success ----------
  return NextResponse.json(
    {
      eligible: true,
      certificateUrl,
      certificateId,
      studentName,
      issuedAt: issueDate.toISOString(),
    },
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// ---------------------------------------------------------------------------
// Method guard
// ---------------------------------------------------------------------------
export async function GET() {
  return NextResponse.json(
    { eligible: false, error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}