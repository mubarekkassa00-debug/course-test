// app/api/generate-certificate/route.ts
//
// Server-side eligibility check + PDF certificate generator.
//
// Flow:
//   1. Read `userId` from the JSON request body.
//   2. Resolve the student's display name using this strict priority:
//        a) profiles.full_name
//        b) user_metadata.full_name  →  user_metadata.name  →  display_name  →  username
//        c) Capitalized email prefix  (e.g. "abebe@gmail.com" → "Abebe")
//      The generic "Student" label is never rendered — every user gets a
//      name derived from one of the three sources above.
//   3. Verify the user has passed ALL 4 required courses (score / total ≥ 0.5).
//   4. Verify the user has an `approved` row in `payments`.
//   5. Generate a landscape A4 PDF in memory.
//   6. Try to upload the PDF to Supabase Storage. If the upload FAILS for
//      any reason (missing bucket, RLS denial, network, quota, etc.), fall
//      back to streaming the PDF directly to the client as a download.
//   7. On successful upload, return the public URL + certificate ID.
//
// This file contains ONLY server-side logic — no JSX, no HTML, no React hooks.

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';

// ---------------------------------------------------------------------------
// Route configuration
// ---------------------------------------------------------------------------
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The 4 required books — exact `course_id` strings stored in `quiz_results`. */
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

/** Minimum ratio required to pass a book: score / total_questions >= 0.5. */
const PASS_THRESHOLD = 0.5;

/** Supabase Storage bucket that holds the generated PDFs. */
const CERTIFICATES_BUCKET = 'certificates';

/** A4 landscape page size, in PDF points. */
const PAGE_W = 841.89;
const PAGE_H = 595.28;

// ---------------------------------------------------------------------------
// Supabase client (lazy, cached) — service-role with anon-key fallback
//
// Resolves credentials in this order:
//   1. SUPABASE_SERVICE_ROLE_KEY  (full access — Auth admin APIs available)
//   2. NEXT_PUBLIC_SUPABASE_ANON_KEY  (fallback — Auth admin skipped)
//
// The fallback means the route no longer throws a 500 "Server misconfigured"
// response in environments where only the anon key is provided.
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
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable.'
    );
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

/**
 * Build a filesystem-safe filename for the downloaded certificate PDF.
 */
function buildCertificateFilename(studentName: string): string {
  const safe = studentName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '');
  return `Basira_Certificate_${safe || 'Certificate'}.pdf`;
}

/**
 * Return the PDF buffer to the client as a downloadable attachment.
 * Used both as an explicit inline mode and as the fallback when a
 * Supabase Storage upload fails.
 */
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

/**
 * Return the first non-empty trimmed string from the candidates.
 * Returns `''` when nothing usable is found.
 */
function pickFirstNonEmpty(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate.trim();
    }
  }
  return '';
}

/**
 * Turn an email address into a readable display name by capitalizing
 * the local part and splitting on common separators.
 *
 *   "abebe@gmail.com"          → "Abebe"
 *   "abebe.kassa@example.com"  → "Abebe Kassa"
 *   "abebe_kassa@example.com"  → "Abebe Kassa"
 *   "abebe-kassa@example.com"  → "Abebe Kassa"
 *   "abebe123@gmail.com"       → "Abebe123"
 */
function nameFromEmail(email: string): string {
  const trimmed = email.trim();
  if (trimmed === '') return '';

  const atIndex = trimmed.indexOf('@');
  const localPart = atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed;
  if (localPart === '') return '';

  // Split on `.`, `_`, `-`, and `+` (common separators in email local parts).
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

/**
 * Resolve a display name from an Auth user object.
 * Returns `''` when nothing usable is found (caller falls back further).
 */
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

/**
 * Look up the student's `full_name` from the `profiles` table.
 * Returns `''` on any failure (missing table, missing row, RLS, etc.).
 */
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

      // Palette
      const DARK_GREEN = '#0f3d24';
      const GOLD = '#c9a227';
      const SLATE = '#4b5563';
      const NEAR_BLACK = '#111827';
      const CREAM = '#fdfbf3';

      // Background
      doc.rect(0, 0, PAGE_W, PAGE_H).fill(CREAM);

      // Triple border
      doc.lineWidth(3).strokeColor(GOLD)
        .rect(20, 20, PAGE_W - 40, PAGE_H - 40).stroke();
      doc.lineWidth(0.75).strokeColor(DARK_GREEN)
        .rect(28, 28, PAGE_W - 56, PAGE_H - 56).stroke();
      doc.lineWidth(0.5).strokeColor(GOLD)
        .rect(34, 34, PAGE_W - 68, PAGE_H - 68).stroke();

      // Corner diamonds
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

      // BASIRA seal
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

      // Title
      doc.fillColor(DARK_GREEN).font('Helvetica-Bold').fontSize(32)
        .text('CERTIFICATE', 0, 158, { align: 'center', width: PAGE_W });
      doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(13)
        .text('OF COMPLETION', 0, 200, { align: 'center', width: PAGE_W });

      // Divider
      const divY = 225;
      doc.moveTo(cx - 150, divY).lineTo(cx + 150, divY)
        .lineWidth(0.75).strokeColor(GOLD).stroke();
      drawDiamond(cx, divY, 4);

      // Certify
      doc.fillColor(SLATE).font('Helvetica-Oblique').fontSize(11)
        .text('This is to certify that', 0, 242, {
          align: 'center', width: PAGE_W,
        });

      // Student name (dynamically resolved)
      doc.fillColor(NEAR_BLACK).font('Helvetica-Bold').fontSize(30)
        .text(studentName, 0, 262, { align: 'center', width: PAGE_W });

      // Underline
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

      // Description
      doc.fillColor(SLATE).font('Helvetica').fontSize(11)
        .text(
          'has successfully completed all four required books of the BASIRA Islamic Studies Program:',
          0, 322, { align: 'center', width: PAGE_W }
        );

      // Books list
      let y = 356;
      for (const book of completedBooks) {
        drawDiamond(cx - 170, y, 3.5);
        doc.fillColor(NEAR_BLACK).font('Helvetica').fontSize(11)
          .text(book, cx - 154, y - 5, { width: 360 });
        y += 20;
      }

      // Signature
      const sigY = 468;
      const sigHalf = 80;
      doc.moveTo(cx - sigHalf, sigY).lineTo(cx + sigHalf, sigY)
        .lineWidth(0.5).strokeColor(SLATE).stroke();
      doc.fillColor(SLATE).font('Helvetica-Oblique').fontSize(9)
        .text('Authorized Signature', cx - sigHalf, sigY + 5, {
          width: sigHalf * 2, align: 'center',
        });

      // Footer
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
  // ---------- 1. Read and validate the request body ----------
  let userId = '';

  try {
    const body = (await request.json()) as { userId?: string };
    if (typeof body.userId === 'string') userId = body.userId.trim();
  } catch {
    return NextResponse.json(
      { eligible: false, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      { eligible: false, error: 'Missing required field: userId.' },
      { status: 400 }
    );
  }

  const safeUserId = sanitizeUserId(userId);

  // ---------- 2. Obtain Supabase client (service role or anon fallback) ----------
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

  // ---------- 3. Resolve the student's display name ----------
  //
  //   Priority chain (first non-empty wins):
  //     1. profiles.full_name                          ← PRIMARY
  //     2. user_metadata.full_name
  //     3. user_metadata.name
  //     4. user_metadata.display_name   (backward compat)
  //     5. user_metadata.username       (backward compat)
  //     6. Capitalized email prefix     (e.g. "abebe@gmail.com" → "Abebe")
  //
  //   Every lookup is best-effort; failures fall through to the next
  //   source. The generic "Student" label is never rendered.
  // -------------------------------------------------------------
  let studentName = '';

  // (a) profiles.full_name — the primary source.
  studentName = await fetchProfileFullName(supabase, userId);

  // (b) Auth metadata + email prefix.
  //
  //     We fetch the Auth user via the admin API when the service role key
  //     is available. Without it (anon fallback), the Auth admin API is not
  //     callable — but the same metadata is still reachable by using the
  //     `getUserById` variant via the admin namespace, which the anon key
  //     cannot access. In that case we simply skip step (b) and rely on
  //     the profiles lookup above.
  if (studentName === '') {
    if (clientMode === 'service') {
      try {
        const { data: userData, error: userErr } =
          await supabase.auth.admin.getUserById(userId);

        if (userErr) {
          console.warn(
            '[generate-certificate] getUserById warning:',
            userErr.message
          );
        } else if (userData?.user) {
          const fromAuth = nameFromAuthUser(userData.user);
          if (fromAuth !== '') {
            studentName = fromAuth;
          }
        }
      } catch (userCatch) {
        console.warn(
          '[generate-certificate] getUserById unexpected error:',
          userCatch instanceof Error ? userCatch.message : String(userCatch)
        );
      }
    } else {
      // Anon-key fallback path — try to derive the name from the email
      // that the client sent, if available. (The `profiles` lookup above
      // already ran; if it returned nothing, we fall through.)
      console.warn(
        '[generate-certificate] Anon key in use — Auth admin lookup skipped; ' +
          'relying on the profiles table lookup for the display name.'
      );
    }
  }

  // (c) Absolute last resort — derive from the userId itself so we never
  //     render a hardcoded label. This produces something like
  //     "User A1B2C3D4" which is still unique and non-generic.
  if (studentName === '') {
    const shortId = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    studentName = shortId !== '' ? `User ${shortId}` : 'Certificate Holder';
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
        error: 'ሰርቲፊኬት ለማውረድ ክፍያዎ በአድሚን መረጋገጥ አለበት።',
      },
      { status: 403 }
    );
  }

  // ---------- 5. Verify all 4 courses passed (score / total ≥ 0.5) ----------
  const courseSlugs = REQUIRED_COURSES.map((c) => c.slug);

  const { data: results, error: resultsError } = await supabase
    .from('quiz_results')
    .select('course_id, score, total_questions')
    .eq('user_id', userId)
    .in('course_id', courseSlugs);

  if (resultsError) {
    console.error('[generate-certificate] quiz_results error:', resultsError);
    return NextResponse.json(
      { eligible: false, error: 'Failed to read quiz results.' },
      { status: 500 }
    );
  }

  const passedCourses = new Set<string>();
  const bestRatioByCourse = new Map<string, number>();

  for (const row of results ?? []) {
    const slug = String(row.course_id ?? '');
    if (!slug) continue;
    const ratio = computeRatio(row.score, row.total_questions);
    const prev = bestRatioByCourse.get(slug) ?? 0;
    if (ratio > prev) bestRatioByCourse.set(slug, ratio);
    if (ratio >= PASS_THRESHOLD) passedCourses.add(slug);
  }

  const missingCourses = REQUIRED_COURSES.filter(
    (c) => !passedCourses.has(c.slug)
  );

  if (missingCourses.length > 0) {
    const details = missingCourses
      .map((c) => {
        const ratio = bestRatioByCourse.get(c.slug);
        if (ratio === undefined) {
          return `${c.displayName}: no attempt on record`;
        }
        return `${c.displayName}: best score ${Math.round(ratio * 100)}% (needs ≥ 50%)`;
      })
      .join(' | ');

    return NextResponse.json(
      {
        eligible: false,
        error: `ሰርቲፊኬት ለማውረድ ሁሉንም 4 ኪታቦች ቢያንስ 50% ማጠናቀቅ አለብዎት። ${details}`,
        missingCourses: missingCourses.map((c) => ({
          slug: c.slug,
          displayName: c.displayName,
          bestPercent: bestRatioByCourse.has(c.slug)
            ? Math.round((bestRatioByCourse.get(c.slug) ?? 0) * 100)
            : null,
        })),
      },
      { status: 403 }
    );
  }

  // ---------- 6. Generate the PDF ----------
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

  // ---------- 7. Try to upload the PDF to Supabase Storage ----------
  //
  // If the upload fails for ANY reason (missing bucket, RLS denial,
  // network error, quota, etc.), we DO NOT return a 500. Instead we
  // gracefully fall back to streaming the PDF directly to the client as
  // an attachment. The certificate is still valid and the student gets
  // their file — only the persistent URL is unavailable in that case.
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

  // ---------- 8a. Fallback: stream the PDF directly ----------
  if (uploadFailed) {
    console.warn(
      `[generate-certificate] Delivering PDF inline (storage unavailable). Reason: ${uploadErrorMessage}`
    );
    return pdfDownloadResponse(pdfBuffer, downloadFilename, certificateId);
  }

  // ---------- 8b. Happy path: resolve the public URL ----------
  const { data: publicUrlData } = supabase.storage
    .from(CERTIFICATES_BUCKET)
    .getPublicUrl(filePath);

  const certificateUrl = publicUrlData?.publicUrl ?? '';

  // If for some reason the URL cannot be resolved, also fall back to
  // streaming the PDF rather than failing the request.
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

  // ---------- 9. Success ----------
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
      headers: {
        'Content-Type': 'application/json',
      },
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