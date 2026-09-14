'use client';
// components/CertificateButton.tsx
//
// Client-side button that triggers server-side certificate generation via
// `POST /api/generate-certificate`. On success, the PDF is downloaded
// directly to the user's device (no browser preview tab).
//
// Behaviour:
//   • Eligibility is enforced server-side. When the API replies
//     `eligible: false`, no PDF is generated and a standard Amharic
//     eligibility message is shown.
//   • When eligible, the returned PDF URL is fetched as a Blob and forced
//     into a direct file download via a temporary `<a download>` element.
//   • Errors and loading states are surfaced inline.
//
// Styling matches the Basira dark theme with emerald / gold accents.

import { useCallback, useState } from 'react';
import { Award, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CertificateButtonProps {
  /** The authenticated student's user id. */
  userId: string;
  /** The student's display name (used as the certificate recipient). */
  studentName: string;
  /**
   * Optional extra Tailwind classes to control outer spacing / width when
   * this button is dropped into a dashboard card.
   */
  className?: string;
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
// Constants
// ---------------------------------------------------------------------------

/**
 * Standard eligibility message shown whenever the API replies with
 * `eligible: false`. The server's detailed message (which books are still
 * missing, best percentages, etc.) is shown as supplementary info beneath.
 */
const NOT_ELIGIBLE_MESSAGE =
  'ሰርቲፊኬት ለማውረድ ሁሉንም 4 ኪታቦች ማጠናቀቅ አለብዎት።';

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
      `ሰርቲፊኬቱን ማውረድ አልተቻለም (HTTP ${response.status}).`
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

  // Release the object URL on the next macrotask so the browser has
  // finished initiating the download.
  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 0);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CertificateButton({
  userId,
  studentName,
  className = '',
}: CertificateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isDisabled = loading || !userId.trim() || !studentName.trim();

  const handleGenerate = useCallback(async () => {
    // Guard: don't fire with missing data.
    if (!userId.trim() || !studentName.trim()) {
      setError('የተጠቃሚ መረጃ አልተገኘም። እባክዎ እንደገና ይግቡ።');
      setSuccessMessage(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // -----------------------------------------------------------------
      // 1. Ask the server to generate (or verify) the certificate.
      // -----------------------------------------------------------------
      const response = await fetch('/api/generate-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, studentName }),
      });

      // The route always returns JSON, even on 4xx/5xx.
      let payload: CertificateApiResponse;
      try {
        payload = (await response.json()) as CertificateApiResponse;
      } catch {
        throw new Error(
          'የሰርቨር ምላሽ ማንበብ አልተቻለም። እባክዎ እንደገና ይሞክሩ።'
        );
      }

      // -----------------------------------------------------------------
      // 2. Eligibility gate — do NOT download anything if not eligible.
      // -----------------------------------------------------------------
      if (!payload.eligible) {
        // Show the standard Amharic lock message. The server's detailed
        // breakdown (which books are missing, percentages, etc.) is
        // appended below so the student knows what to do next.
        const detailed =
          payload.message &&
          payload.message.trim() !== NOT_ELIGIBLE_MESSAGE.trim()
            ? `\n${payload.message}`
            : '';

        setError(`${NOT_ELIGIBLE_MESSAGE}${detailed}`);
        return;
      }

      // -----------------------------------------------------------------
      // 3. Eligible — force a direct PDF download (no preview tab).
      // -----------------------------------------------------------------
      if (payload.warning) {
        // Non-blocking log if the server attached a soft warning
        // (e.g. metadata persistence fell back to the base row).
        console.warn('[CertificateButton]', payload.warning);
      }

      const filename = buildDownloadFilename(studentName);
      await forceDirectDownload(payload.certificateUrl, filename);

      setSuccessMessage(
        `ሰርቲፊኬቱ በተሳካ ሁኔታ ተዘጋጅቷል እና በ${filename} ስም ተቀምጧል።`
      );
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'ያልታወቀ ስህተት ተከስቷል።';
      setError(reason);
      setSuccessMessage(null);
    } finally {
      setLoading(false);
    }
  }, [userId, studentName]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className={`w-full ${className}`}>
      {/* --------------------------- Button --------------------------- */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        className={[
          // Layout
          'w-full inline-flex items-center justify-center gap-2',
          'px-5 py-3 rounded-xl',
          // Typography
          'font-bold text-sm tracking-wide',
          // Colors — Basira emerald → gold gradient
          'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700',
          'text-white',
          // Gold ring accent
          'ring-1 ring-amber-400/40',
          // Interaction
          'shadow-lg shadow-emerald-950/40',
          'transition-all duration-200',
          'hover:from-emerald-600 hover:via-emerald-500 hover:to-emerald-600',
          'hover:ring-amber-400/70',
          'hover:shadow-emerald-900/60',
          'active:scale-[0.985]',
          // Disabled / loading state
          'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
          // Focus ring
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300',
        ].join(' ')}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-amber-200" />
            <span>ሰርቲፊኬቱ በመዘጋጀት ላይ ነው...</span>
          </>
        ) : (
          <>
            <Award className="h-5 w-5 text-amber-300" />
            <span>ሰርቲፊኬቱን አውርድ (PDF)</span>
          </>
        )}
      </button>

      {/* ------------------------- Error banner ------------------------ */}
      {error && !loading && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-3 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="font-semibold text-red-300">
              ሰርቲፊኬቱን ማዘጋጀት አልተቻለም
            </p>
            <p className="mt-0.5 whitespace-pre-line leading-relaxed text-red-200/90">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* ------------------------ Success banner ----------------------- */}
      {successMessage && !loading && !error && (
        <div
          role="status"
          className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-300">
              ሰርቲፊኬቱ በተሳካ ሁኔታ ተዘጋጅቷል!
            </p>
            <p className="mt-0.5 leading-relaxed text-emerald-200/90">
              {successMessage}
            </p>
            <p className="mt-0.5 leading-relaxed text-emerald-200/90/80 text-xs">
              ማውረዱ ካልተጀመረ የአሳሽዎን ማውረድ (Downloads) ቅንብሮች ያረጋግጡ።
            </p>
          </div>
        </div>
      )}
    </div>
  );
}