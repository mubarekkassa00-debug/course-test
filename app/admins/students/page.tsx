// app/admins/students/page.tsx
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Search,
  Download,
  User,
  CheckCircle,
  XCircle,
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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Supabase browser client (singleton for the lifetime of the page)
// ---------------------------------------------------------------------------
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIRED_COURSES: { slug: string; displayName: string }[] = [
  { slug: 'usul_al_thalatha', displayName: 'ኡሱሉ ሰላሳ' },
  { slug: 'arbain', displayName: 'አርባኢን ነወዊ' },
  { slug: 'shurut_as_salah', displayName: 'ሹሩጡ ሶላት' },
  { slug: 'urjuzat', displayName: 'ኡርጁዘቱል ሚኢያህ' },
];

const PASS_THRESHOLD_PERCENT = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PaymentStatus = 'none' | 'pending' | 'approved' | 'rejected';

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  created_at: string | null;
}

interface PaymentRow {
  user_id: string;
  status: string | null;
  created_at: string | null;
}

interface QuizRow {
  user_id: string;
  course_id: string;
  score: number | null;
  total_questions: number | null;
  created_at: string | null;
}

interface QuizAttempt {
  courseId: string;
  courseName: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  date: string | null;
}

interface StudentRow {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  registeredAt: string | null;
  role: string;
  paymentStatus: PaymentStatus;
  paymentLabel: string;
  passedCount: number;
  totalCourses: number;
  progressPercent: number;
  averageScore: number;
  recentScore: number | null;
  recentCourseName: string | null;
  attempts: QuizAttempt[];
  attemptsCount: number;
}

type FilterKey = 'all' | 'paid' | 'unpaid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePaymentStatus(raw: unknown): PaymentStatus {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  if (s === 'pending') return 'pending';
  return 'none';
}

function paymentLabelAmh(status: PaymentStatus): string {
  switch (status) {
    case 'approved':
      return 'የከፈሉ';
    case 'pending':
      return 'በመጠባበቅ';
    case 'rejected':
      return 'ውድቅ የተደረገ';
    default:
      return 'ያልከፈሉ';
  }
}

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
    return d.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Build a CSV string and trigger a browser download. */
function downloadCSV(rows: StudentRow[]) {
  const headers = [
    'Full Name',
    'Phone',
    'Email',
    'Registered',
    'Payment',
    'Progress %',
    'Passed Kitabs',
    'Average Score %',
    'Recent Score %',
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
    lines.push(
      [
        r.fullName,
        r.phone,
        r.email,
        r.registeredAt ?? '',
        paymentLabelAmh(r.paymentStatus),
        r.progressPercent,
        `${r.passedCount}/${r.totalCourses}`,
        r.averageScore,
        r.recentScore ?? '',
      ]
        .map(escape)
        .join(',')
    );
  }

  const csv = '\uFEFF' + lines.join('\n'); // BOM for Amharic Excel compatibility
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `basira-students-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
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

  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const [selected, setSelected] = useState<StudentRow | null>(null);

  // -------------------------------------------------------------------------
  // 1. AUTH + ADMIN ROLE GUARD
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userErr || !user) {
          router.replace('/login');
          return;
        }

        // Look up role in profiles
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (profileErr) {
          console.error('[AdminStudents] profile lookup failed:', profileErr);
          setAuthError('የተጠቃሚ መረጃ ማግኘት አልተቻለም።');
          setAuthLoading(false);
          return;
        }

        if (!profile || profile.role !== 'admin') {
          // Not an admin — bounce away silently.
          router.replace('/dashboard');
          return;
        }

        setAuthLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[AdminStudents] auth exception:', err);
          setAuthError('ያልተጠበቀ ስህተት ተከስቷል።');
          setAuthLoading(false);
        }
      }
    };

    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // -------------------------------------------------------------------------
  // 2. FETCH DATA (profiles + payments + quiz_results) — one joined snapshot
  // -------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);

    try {
      // Fetch students (everyone is 'student'; we exclude admins from the list)
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email, role, created_at')
        .order('created_at', { ascending: false });

      if (pErr) throw pErr;

      // Fetch all payments (latest per user wins)
      const { data: payments, error: payErr } = await supabase
        .from('payments')
        .select('user_id, status, created_at')
        .order('created_at', { ascending: false });

      if (payErr) throw payErr;

      // Fetch all quiz results
      const { data: quizzes, error: qErr } = await supabase
        .from('quiz_results')
        .select('user_id, course_id, score, total_questions, created_at')
        .order('created_at', { ascending: false });

      if (qErr) throw qErr;

      const allProfiles = (profiles ?? []) as ProfileRow[];
      const allPayments = (payments ?? []) as PaymentRow[];
      const allQuizzes = (quizzes ?? []) as QuizRow[];

      // Build lookup maps
      const latestPayment = new Map<string, PaymentStatus>();
      for (const p of allPayments) {
        if (!latestPayment.has(p.user_id)) {
          latestPayment.set(p.user_id, normalizePaymentStatus(p.status));
        }
      }

      const quizzesByUser = new Map<string, QuizRow[]>();
      for (const q of allQuizzes) {
        const arr = quizzesByUser.get(q.user_id) ?? [];
        arr.push(q);
        quizzesByUser.set(q.user_id, arr);
      }

      const courseNameBySlug = new Map(
        REQUIRED_COURSES.map((c) => [c.slug, c.displayName])
      );

      // Compose student rows
      const rows: StudentRow[] = allProfiles
        .filter((p) => p.role !== 'admin') // hide admins from the student list
        .map((p) => {
          const userQuizzes = quizzesByUser.get(p.id) ?? [];

          // Best percent per course
          const bestByCourse = new Map<string, number>();
          for (const q of userQuizzes) {
            const slug = String(q.course_id ?? '');
            if (!slug) continue;
            const pct = computePercent(q.score, q.total_questions);
            const prev = bestByCourse.get(slug) ?? 0;
            if (pct > prev) bestByCourse.set(slug, pct);
          }

          const passedCount = REQUIRED_COURSES.reduce((acc, c) => {
            const best = bestByCourse.get(c.slug) ?? 0;
            return acc + (best >= PASS_THRESHOLD_PERCENT ? 1 : 0);
          }, 0);

          const totalCourses = REQUIRED_COURSES.length;

          const progressPercent = Math.round(
            (REQUIRED_COURSES.reduce(
              (acc, c) =>
                acc +
                Math.min(
                  bestByCourse.get(c.slug) ?? 0,
                  PASS_THRESHOLD_PERCENT
                ),
              0
            ) /
              (totalCourses * PASS_THRESHOLD_PERCENT)) *
              100
          );

          // Average across every attempt
          const percents = userQuizzes.map((q) =>
            computePercent(q.score, q.total_questions)
          );
          const averageScore =
            percents.length > 0
              ? Math.round(
                  percents.reduce((a, b) => a + b, 0) / percents.length
                )
              : 0;

          // Most recent attempt
          const recent = userQuizzes[0] ?? null;
          const recentScore = recent
            ? computePercent(recent.score, recent.total_questions)
            : null;
          const recentCourseName = recent
            ? courseNameBySlug.get(String(recent.course_id)) ?? null
            : null;

          // Full attempts list (newest first, as fetched)
          const attempts: QuizAttempt[] = userQuizzes.map((q) => {
            const s = Number(q.score) || 0;
            const t = Number(q.total_questions) || 0;
            const pct = computePercent(s, t);
            return {
              courseId: String(q.course_id ?? ''),
              courseName:
                courseNameBySlug.get(String(q.course_id ?? '')) ??
                String(q.course_id ?? ''),
              score: s,
              total: t,
              percent: pct,
              passed: pct >= PASS_THRESHOLD_PERCENT,
              date: q.created_at,
            };
          });

          const paymentStatus = latestPayment.get(p.id) ?? 'none';

          return {
            id: p.id,
            fullName: p.full_name ?? 'ያልተጠቀሰ',
            phone: p.phone ?? '',
            email: p.email ?? '',
            registeredAt: p.created_at,
            role: p.role ?? 'student',
            paymentStatus,
            paymentLabel: paymentLabelAmh(paymentStatus),
            passedCount,
            totalCourses,
            progressPercent,
            averageScore,
            recentScore,
            recentCourseName,
            attempts,
            attemptsCount: userQuizzes.length,
          };
        });

      setStudents(rows);
    } catch (err) {
      console.error('[AdminStudents] data load failed:', err);
      setDataError('የተማሪ መረጃ ማግኘት አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !authError) {
      loadData();
    }
  }, [authLoading, authError, loadData]);

  // -------------------------------------------------------------------------
  // 3. FILTER + SEARCH
  // -------------------------------------------------------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return students.filter((s) => {
      // Filter by payment
      if (filter === 'paid' && s.paymentStatus !== 'approved') return false;
      if (filter === 'unpaid' && s.paymentStatus === 'approved') return false;

      // Filter by search text
      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });
  }, [students, search, filter]);

  // -------------------------------------------------------------------------
  // 4. HANDLERS
  // -------------------------------------------------------------------------
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);

  const handleExport = () => {
    if (filtered.length === 0) return;
    downloadCSV(filtered);
  };

  const closeModal = useCallback(() => setSelected(null), []);

  // -------------------------------------------------------------------------
  // 5. RENDER — Loading (auth)
  // -------------------------------------------------------------------------
  if (authLoading) {
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
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
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

  // -------------------------------------------------------------------------
  // 6. RENDER — Main
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* ================================================================= */}
      {/* Sticky Header                                                      */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/20 flex-shrink-0">
              <Users className="h-6 w-6 text-white" />
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
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <StatCard
            label="ጠቅላላ ተማሪዎች"
            value={students.length}
            accent="emerald"
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            label="የከፈሉ"
            value={students.filter((s) => s.paymentStatus === 'approved').length}
            accent="sky"
            icon={<CheckCircle className="h-5 w-5" />}
          />
          <StatCard
            label="ያልከፈሉ"
            value={students.filter((s) => s.paymentStatus !== 'approved').length}
            accent="amber"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <StatCard
            label="ጠቅላላ ሙከራዎች"
            value={students.reduce((a, s) => a + s.attemptsCount, 0)}
            accent="purple"
            icon={<Award className="h-5 w-5" />}
          />
        </div>

        {/* Toolbar */}
        <div className="mb-5 flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search */}
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

          {/* Filter buttons */}
          <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
            {(
              [
                { key: 'all', label: 'ሁሉም' },
                { key: 'paid', label: 'የከፈሉ' },
                { key: 'unpaid', label: 'ያልከፈሉ' },
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

          {/* Export */}
          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-900/20 hover:from-emerald-500 hover:to-emerald-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            CSV አውርድ
          </button>
        </div>

        {/* Error */}
        {dataError && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="flex-1">{dataError}</p>
          </div>
        )}

        {/* Table card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                የተማሪዎችን መረጃ በመጫን ላይ ነው...
              </p>
            </div>
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
                    <th className="px-5 py-3 font-semibold">ተማሪ</th>
                    <th className="px-5 py-3 font-semibold">ስልክ ቁጥር</th>
                    <th className="px-5 py-3 font-semibold">ኢሜይል</th>
                    <th className="px-5 py-3 font-semibold">የተመዘገቡበት</th>
                    <th className="px-5 py-3 font-semibold">ክፍያ</th>
                    <th className="px-5 py-3 font-semibold">እድገት</th>
                    <th className="px-5 py-3 font-semibold">አማካይ ውጤት</th>
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
                      className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      {/* Student */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-sm font-bold">
                            {s.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate max-w-[180px]">
                              {s.fullName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {s.passedCount} / {s.totalCourses} ኪታብ ተሳክቷል
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm font-mono text-slate-700 dark:text-slate-300">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {s.phone || '—'}
                        </span>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 max-w-[220px] truncate">
                          <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{s.email || '—'}</span>
                        </span>
                      </td>

                      {/* Registered */}
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {formatDateAmh(s.registeredAt)}
                      </td>

                      {/* Payment badge */}
                      <td className="px-5 py-4">
                        <PaymentBadge status={s.paymentStatus} />
                      </td>

                      {/* Progress */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400"
                              style={{ width: `${s.progressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                            {s.progressPercent}%
                          </span>
                        </div>
                      </td>

                      {/* Average score */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                            {s.averageScore}%
                          </span>
                          {s.recentScore !== null && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              የቅርብ፡ {s.recentScore}%
                            </span>
                          )}
                        </div>
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
                          ይመልከቱ
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

        {/* Footer note */}
        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          {filtered.length} ከ {students.length} ተማሪዎች ይታያሉ
        </p>
      </main>

      {/* ================================================================= */}
      {/* Student Detail Modal                                               */}
      {/* ================================================================= */}
      {selected && (
        <StudentModal student={selected} onClose={closeModal} />
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
}: {
  label: string;
  value: number;
  accent: 'emerald' | 'sky' | 'amber' | 'purple';
  icon: React.ReactNode;
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
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentMap[accent]}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, string> = {
    approved:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
    pending:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/60',
    rejected:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60',
    none: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
  };

  const label: Record<PaymentStatus, string> = {
    approved: 'የከፈሉ',
    pending: 'በመጠባበቅ',
    rejected: 'ውድቅ',
    none: 'ያልከፈሉ',
  };

  const iconMap: Record<PaymentStatus, React.ReactNode> = {
    approved: <CheckCircle className="h-3.5 w-3.5" />,
    pending: <Loader2 className="h-3.5 w-3.5" />,
    rejected: <XCircle className="h-3.5 w-3.5" />,
    none: <XCircle className="h-3.5 w-3.5" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}
    >
      {iconMap[status]}
      {label[status]}
    </span>
  );
}

function StudentModal({
  student,
  onClose,
}: {
  student: StudentRow;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll while open
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
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
              <div className="flex items-center gap-2 mt-0.5">
                <PaymentBadge status={student.paymentStatus} />
              </div>
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
              <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white mb-3">
                {student.phone || '—'}
              </p>
              {student.phone && (
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
                  <a
                    href={`https://t.me/+${cleanPhone.replace(/^\+/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0088cc] hover:bg-[#0077b3] px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                  >
                    Telegram
                  </a>
                </div>
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
              label="የተሳኩ ኪታቦች"
              value={`${student.passedCount}/${student.totalCourses}`}
            />
            <MiniStat label="አማካይ ውጤት" value={`${student.averageScore}%`} />
            <MiniStat
              label="የቅርብ ውጤት"
              value={
                student.recentScore !== null ? `${student.recentScore}%` : '—'
              }
            />
          </section>

          {/* Progress */}
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

          {/* Attempts */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                የፈተና ውጤት
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {student.attemptsCount} ሙከራ
              </span>
            </div>

            {student.attempts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-6 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  እስካሁን ምንም ፈተና አልወሰዱም።
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {student.attempts.map((a, idx) => (
                  <div
                    key={`${a.courseId}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                          a.passed
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {a.passed ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {a.courseName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateAmh(a.date)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {a.score}/{a.total}
                      </p>
                      <p
                        className={`text-[11px] font-semibold ${
                          a.passed
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {a.percent}% · {a.passed ? 'ተሳክቷል' : 'አልተሳካም'}
                      </p>
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