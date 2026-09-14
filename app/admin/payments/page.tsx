'use client';
// app/admin/payments/page.tsx
//
// Admin payment-approval dashboard.
//
// Features:
//   • Loads every row from `public.payments` (newest first).
//   • Enriches each row with the student's name/email if a public
//     `profiles` table is available (gracefully skipped otherwise).
//   • Renders a responsive table (desktop) / card list (mobile).
//   • Approve / Reject actions mutate the row's `status` in Supabase.
//   • Loading, empty, and error states are all handled inline.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  User,
  Calendar,
  CreditCard,
  FileImage,
  Filter,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PaymentStatus = 'pending' | 'approved' | 'rejected';

/**
 * Canonical shape of a row in `public.payments`.
 *
 * `studentName` and `studentEmail` are enrichment-only fields populated from
 * the `profiles` table — they are optional because the enrichment query may
 * fail (missing table, RLS, etc.) without breaking the page.
 */
interface PaymentRow {
  id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  receipt_url: string;
  status: PaymentStatus;
  created_at: string;
  // Enrichment (best-effort)
  studentName?: string;
  studentEmail?: string;
}

interface ProfileInfo {
  id: string;
  full_name?: string | null;
  email?: string | null;
}

type StatusFilter = 'all' | PaymentStatus;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a possibly-unknown status string into a known PaymentStatus. */
function normalizeStatus(raw: unknown): PaymentStatus {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  return 'pending';
}

/** Format an ISO date string into a compact, readable timestamp. */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format an amount as "300 ETB" (or fallback if missing). */
function formatAmount(amount: number | string | null | undefined): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${n} ETB`;
}

/** Short display for a user id (first 8 chars + ellipsis if longer). */
function shortUserId(id: string): string {
  if (!id) return '—';
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: PaymentStatus }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/50 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
        <XCircle className="h-3 w-3" />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'emerald' | 'red' | 'slate';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const tones: Record<string, string> = {
    amber:
      'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
    emerald:
      'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
    red: 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300',
    slate:
      'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-80">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 dark:bg-black/20">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPaymentsPage() {
  // -------------------------------------------------------------------------
  // State — always initialized to an empty array so it is never `null`.
  // -------------------------------------------------------------------------
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ---------------------------------------------------------------
      // 1. Fetch raw payment rows (primary path: `select('*')`)
      // ---------------------------------------------------------------
      const { data, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      // Fallback: if `created_at` isn't part of the schema, retry without
      // the ordering clause so we still show the data.
      let rawData = data;
      if (payErr && String(payErr.message || '').toLowerCase().includes('created_at')) {
        const retry = await supabase.from('payments').select('*');
        if (retry.error) throw retry.error;
        rawData = retry.data;
      } else if (payErr) {
        throw payErr;
      }

      // `data` from Supabase is `PaymentRow[] | null`. Normalize to an array
      // via `?? []` before doing anything else — this is the exact line that
      // resolves the TypeScript error.
      const baseRows: PaymentRow[] = (rawData ?? []) as PaymentRow[];

      // ---------------------------------------------------------------
      // 2. Best-effort profile enrichment (public.profiles)
      // ---------------------------------------------------------------
      const uniqueUserIds = Array.from(
        new Set(baseRows.map((r) => r.user_id).filter(Boolean))
      );

      const profileMap = new Map<string, ProfileInfo>();
      if (uniqueUserIds.length > 0) {
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', uniqueUserIds);

        if (!profileErr && Array.isArray(profileData)) {
          for (const p of profileData as ProfileInfo[]) {
            if (p?.id) profileMap.set(p.id, p);
          }
        }
        // If the `profiles` table doesn't exist or the query fails, we
        // simply proceed without names.
      }

      const enriched: PaymentRow[] = baseRows.map((r) => ({
        ...r,
        studentName: (profileMap.get(r.user_id)?.full_name ?? '').trim(),
        studentEmail: (profileMap.get(r.user_id)?.email ?? '').trim(),
      }));

      // ---------------------------------------------------------------
      // 3. Commit to state — always a real array, never `null`.
      // ---------------------------------------------------------------
      setRows(enriched);
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'ያልታወቀ ስህተት ተከስቷል።';
      console.error('[AdminPayments] Load error:', err);
      setError(reason);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleUpdateStatus = useCallback(
    async (paymentId: string, nextStatus: PaymentStatus) => {
      const label = nextStatus === 'approved' ? 'Approve' : 'Reject';
      const confirmMsg =
        nextStatus === 'approved'
          ? 'ይህን ክፍያ ማጽደቅ ይፈልጋሉ? ተማሪው ወዲያውኑ ሰርቲፊኬት ማውረድ ይችላል።'
          : 'ይህን ክፍያ ውድቅ ማድረግ ይፈልጋሉ? ተማሪው እንደገና ማስገባት ይችላል።';

      if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) {
        return;
      }

      setActionId(paymentId);
      setError(null);

      try {
        const { error: updateErr } = await supabase
          .from('payments')
          .update({ status: nextStatus })
          .eq('id', paymentId);

        if (updateErr) throw updateErr;

        // Optimistic local update — faster than a full refetch.
        setRows((prev) =>
          prev.map((r) =>
            r.id === paymentId ? { ...r, status: nextStatus } : r
          )
        );
      } catch (err) {
        const reason =
          err instanceof Error
            ? err.message
            : `ክፍያውን ${label.toLowerCase()} ማድረግ አልተቻለም።`;
        console.error('[AdminPayments] Update error:', err);
        setError(reason);
      } finally {
        setActionId(null);
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const stats = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const r of rows) {
      const s = normalizeStatus(r.status);
      counts[s] += 1;
    }
    return { total: rows.length, ...counts };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter((r) => normalizeStatus(r.status) === statusFilter);
  }, [rows, statusFilter]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
              <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold truncate">
                የክፍያ ማረጋገጫ
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Admin · Payment Approvals
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadPayments}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">አድስ</span>
          </button>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Body                                                             */}
      {/* ---------------------------------------------------------------- */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total" value={stats.total} tone="slate" icon={CreditCard} />
          <StatCard label="Pending" value={stats.pending} tone="amber" icon={Clock} />
          <StatCard
            label="Approved"
            value={stats.approved}
            tone="emerald"
            icon={CheckCircle2}
          />
          <StatCard
            label="Rejected"
            value={stats.rejected}
            tone="red"
            icon={XCircle}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            አጣራ
          </span>
          {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map(
            (f) => {
              const active = statusFilter === f;
              const label =
                f === 'all'
                  ? 'ሁሉም'
                  : f === 'pending'
                  ? 'በመጠበቅ'
                  : f === 'approved'
                  ? 'የጸደቀ'
                  : 'ውድቅ';
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            }
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">ስህተት ተከስቷል</p>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && rows.length === 0 && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
            <span className="ml-3 text-sm text-slate-600 dark:text-slate-400">
              የክፍያ መረጃ በመጫን ላይ ነው...
            </span>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredRows.length === 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-16 text-center">
            <CreditCard className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              ምንም የክፍያ መዝገብ አልተገኘም
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ተማሪዎች ደረሰኝ ካስገቡ እዚህ ይታያሉ።
            </p>
          </div>
        )}

        {/* ---------------------------------------------------------- */}
        {/* Desktop table                                             */}
        {/* ---------------------------------------------------------- */}
        {!loading && filteredRows.length > 0 && (
          <>
            {/* Desktop (md+) */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-900/60">
                    <tr>
                      {[
                        'ተማሪ',
                        'ዘዴ',
                        'መጠን',
                        'የግብይት ማጣቀሻ',
                        'ቀን',
                        'ደረሰኝ',
                        'ሁኔታ',
                        'ተግባር',
                      ].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredRows.map((r) => {
                      const status = normalizeStatus(r.status);
                      const busy = actionId === r.id;
                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                        >
                          {/* Student */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                                <User className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {r.studentName ||
                                    r.studentEmail ||
                                    'Unnamed Student'}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                                  {shortUserId(r.user_id)}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Method */}
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                            {r.payment_method || '—'}
                          </td>

                          {/* Amount */}
                          <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {formatAmount(r.amount)}
                          </td>

                          {/* Reference */}
                          <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400">
                            {r.transaction_ref || '—'}
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(r.created_at)}
                            </span>
                          </td>

                          {/* Receipt */}
                          <td className="px-4 py-3">
                            {r.receipt_url ? (
                              <a
                                href={r.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                              >
                                <FileImage className="h-3.5 w-3.5" />
                                ተመልከት
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <StatusBadge status={status} />
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            {status === 'pending' ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    handleUpdateStatus(r.id, 'approved')
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
                                >
                                  {busy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                  አጽድቅ
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    handleUpdateStatus(r.id, 'rejected')
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-60"
                                >
                                  {busy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5" />
                                  )}
                                  ውድቅ አድርግ
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                — እርምጃ አያስፈልግም —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile (<md) */}
            <div className="md:hidden space-y-3">
              {filteredRows.map((r) => {
                const status = normalizeStatus(r.status);
                const busy = actionId === r.id;
                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-4 space-y-3"
                  >
                    {/* Header: student + status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {r.studentName ||
                              r.studentEmail ||
                              'Unnamed Student'}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {shortUserId(r.user_id)}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={status} />
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">ዘዴ</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {r.payment_method || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">
                          መጠን
                        </p>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatAmount(r.amount)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-slate-500 dark:text-slate-400">
                          የግብይት ማጣቀሻ
                        </p>
                        <p className="font-mono text-slate-900 dark:text-slate-100 break-all">
                          {r.transaction_ref || '—'}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-slate-500 dark:text-slate-400">
                          የገባበት ቀን
                        </p>
                        <p className="text-slate-900 dark:text-slate-100">
                          {formatDate(r.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Receipt */}
                    {r.receipt_url && (
                      <a
                        href={r.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        <FileImage className="h-3.5 w-3.5" />
                        ደረሰኙን ተመልከት
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    {/* Actions */}
                    {status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleUpdateStatus(r.id, 'approved')}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          አጽድቅ
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleUpdateStatus(r.id, 'rejected')}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-60"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          ውድቅ አድርግ
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}