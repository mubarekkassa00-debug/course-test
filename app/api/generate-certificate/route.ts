// app/api/generate-certificate/route.ts
//
// Server-side eligibility check + PDF certificate generator.
//
// Flow:
//   1. Read `userId` from the JSON request body.
//   2. Fetch the user record from Supabase Auth and extract their display
//      name from `user_metadata` (display_name → username → 'kassa').
//   3. Verify the user has passed ALL 4 required courses (score / total ≥ 0.5).
//   4. Verify the user has an `approved` row in `payments`.
//   5. Generate a landscape A4 PDF in memory, upload it to Supabase Storage,
//      and return the public URL + certificate ID.
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

/** Fallback display name used when the user has no metadata. */
const FALLBACK_STUDENT_NAME = 'kassa';

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
        'Auth admin APIs (getUserById) will be skipped; the display name will use the fallback.'
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
 * Resolve the display name from a Supabase Auth user object.
 * Priority:  metadata.display_name  →  metadata.username  →  fallback.
 */
function resolveStudentName(authUser: unknown): string {
  const meta = (authUser as { user_metadata?: Record<string, unknown> } | null)
    ?.user_metadata;
  if (meta) {
    const displayName = meta.display_name;
    if (typeof displayName === 'string' && displayName.trim() !== '') {
      return displayName.trim();
    }
    const username = meta.username;
    if (typeof username === 'string' && username.trim() !== '') {
      return username.trim();
    }
  }
  return FALLBACK_STUDENT_NAME;
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

      // Student name (fetched from Supabase Auth metadata)
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

  // ---------- 3. Fetch the user's display name from Supabase Auth ----------
  //   Only attempt the Auth admin API when we actually have the service
  //   role key — otherwise skip silently and use the fallback name.
  let studentName = FALLBACK_STUDENT_NAME;
  if (clientMode === 'service') {
    try {
      const { data: userData, error: userErr } =
        await supabase.auth.admin.getUserById(userId);

      if (userErr) {
        console.warn(
          '[generate-certificate] getUserById warning:',
          userErr.message
        );
        // Non-fatal: fall back to the default name.
      } else {
        studentName = resolveStudentName(userData?.user);
      }
    } catch (userCatch) {
      console.warn(
        '[generate-certificate] getUserById unexpected error:',
        userCatch instanceof Error ? userCatch.message : String(userCatch)
      );
      // Non-fatal: fall back to the default name.
    }
  } else {
    console.warn(
      '[generate-certificate] Anon key in use — skipping Auth admin lookup; using fallback display name.'
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

  // ---------- 6. Generate and upload the PDF ----------
  const issueDate = new Date();
  const certificateId = generateCertificateId();
  const filePath = `${safeUserId}/${certificateId}.pdf`;

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

  const { error: uploadError } = await supabase.storage
    .from(CERTIFICATES_BUCKET)
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    console.error('[generate-certificate] upload error:', uploadError);
    return NextResponse.json(
      { eligible: false, error: 'Failed to upload certificate.' },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from(CERTIFICATES_BUCKET)
    .getPublicUrl(filePath);

  const certificateUrl = publicUrlData?.publicUrl ?? '';

  if (!certificateUrl) {
    await supabase.storage.from(CERTIFICATES_BUCKET).remove([filePath]);
    return NextResponse.json(
      { eligible: false, error: 'Failed to resolve certificate URL.' },
      { status: 500 }
    );
  }

  // ---------- 7. Success ----------
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