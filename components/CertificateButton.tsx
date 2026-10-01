'use client';
// components/CertificateButton.tsx
//
// Certificate download button with client-side eligibility gating.
//
// Eligibility rules (client UX gate — the server still enforces these):
//   1. Every active lesson must have at least one quiz attempt.
//   2. The final comprehensive exam must be completed.
//   3. The combined score across all lessons + final exam must be >= 50%.
//
// Behaviour:
//   • On mount, we fetch the eligibility snapshot from Supabase so the
//     student sees exactly what is missing before they try to download.
//   • If eligible: the button is enabled and downloads the PDF directly
//     (no browser preview tab).
//   • If not eligible: the button is disabled and a checklist of remaining
//     requirements is displayed (lessons left, final exam, score).
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
 * Standard eligibility message shown whenever eligibility fails — kept short
 * so the detailed checklist below can carry the specifics.
 */
const NOT_ELIGIBLE_HEADLINE =
  'ሰርተፊኬት ለማውረድ የሚከተሉትን መስፈርቶች ማሟላት አለብዎት።';

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

    // ---- A) Count active lessons ----
    let totalLessons = 0;
    try {
      // Try with the `is_active` flag first.
      const { count, error } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (error) {
        console.warn(
          '[CertificateButton] lessons select (is_active) failed, retrying unfiltered:',
          error.message
        );
        const fallback = await supabase
          .from('lessons')
          .select('id', { count: 'exact', head: true });

        if (fallback.error) {
          console.error(
            'DEBUG_SUPABASE_ERROR (lessons, non-fatal):',
            fallback.error
          );
          totalLessons = 0;
        } else {
          totalLessons = fallback.count ?? 0;
        }
      } else {
        totalLessons = count ?? 0;
      }
    } catch (err) {
      console.error(
        'DEBUG_SUPABASE_ERROR (lessons, non-fatal):',
        err
      );
      totalLessons = 0;
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

    // ---- C) Compute snapshot from best attempts ----
    // Best score per lesson (retakes only count once, using the highest).
    const bestByLesson = new Map<string, { score: number; total: number }>();
    let bestFinalExam: { score: number; total: number } | null = null;

    for (const row of attempts) {
      const score = Number(row.score) || 0;
      const total = Number(row.total_questions) || 0;

      if (row.is_final_exam === true) {
        if (!bestFinalExam || score > bestFinalExam.score) {
          bestFinalExam = { score, total };
        }
        continue;
      }

      // Identify the lesson — try `lesson_id`, then `course_id`, then
      // `course_slug` in case the schema uses a different key.
      const lessonKey = String(
        row.lesson_id ?? row.course_id ?? row.course_slug ?? ''
      );
      if (!lessonKey) continue;

      const existing = bestByLesson.get(lessonKey);
      if (!existing || score > existing.score) {
        bestByLesson.set(lessonKey, { score, total });
      }
    }

    const completedLessons = bestByLesson.size;

    // Combined score = sum of best earned / sum of best max, across all
    // lessons PLUS the final exam.
    let sumScore = 0;
    let sumTotal = 0;

    for (const { score, total } of bestByLesson.values()) {
      sumScore += score;
      sumTotal += total;
    }
    if (bestFinalExam) {
      sumScore += bestFinalExam.score;
      sumTotal += bestFinalExam.total;
    }

    const combinedPercent =
      sumTotal > 0 ? Math.round((sumScore / sumTotal) * 100) : 0;

    const finalExamPercent = bestFinalExam
      ? bestFinalExam.total > 0
        ? Math.round((bestFinalExam.score / bestFinalExam.total) * 100)
        : 0
      : 0;

    // ---- D) Evaluate the three rules ----
    const allLessonsCompleted =
      totalLessons > 0 && completedLessons >= totalLessons;
    const hasFinalExam = bestFinalExam !== null;
    const combinedScoreOk = combinedPercent >= PASS_THRESHOLD_PERCENT;

    const missingReasons: string[] = [];

    if (!allLessonsCompleted) {
      const remaining = Math.max(0, totalLessons - completedLessons);
      missingReasons.push(
        `ተጨማሪ ${remaining} ትምህርቶችን ማጠናቀቅ ያስፈልጋል (${completedLessons}/${totalLessons})።`
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
      allLessonsCompleted && hasFinalExam && combinedScoreOk;

    setSnapshot({
      totalLessons,
      completedLessons,
      hasFinalExam,
      finalExamPercent,
      combinedPercent,
      eligible,
      missingReasons,
    });
    setEligibilityLoading(false);
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
          {/* Rule 1 — All lessons */}
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