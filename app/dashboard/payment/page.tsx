'use client';

// components/PaymentForm.tsx
//
// Client component that renders the payment page body:
//   • Bank / Telebirr cards with copy buttons
//   • Status banner (none / pending / approved / rejected)
//   • Receipt submission form (bank dropdown + ref + image upload)
//
// Data is fetched once on mount from `public.payments`. The parent page
// passes the initial row (if any) so first paint is instant.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  CreditCard,
  Upload,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Image as ImageIcon,
  X,
  Copy,
  Check,
  ArrowLeft,
  BookOpen,
  Building2,
  Smartphone,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type BankKey = 'telebirr' | 'cbe' | 'abyssinia';

interface BankInfo {
  key: BankKey;
  label: string;
  account: string;
  holder: string;
  hint: string;
  icon: typeof Smartphone;
  accent: string;
}

type PaymentStatus = 'pending' | 'approved' | 'rejected';

interface PaymentRow {
  id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  receipt_url: string | null;
  status: PaymentStatus;
  created_at?: string;
}

export interface PaymentFormProps {
  userId: string;
  initialPayment: PaymentRow | null;
}

const PAYMENT_AMOUNT_ETB = 300;
const RECEIPTS_BUCKET = 'receipts';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const BANKS: BankInfo[] = [
  {
    key: 'telebirr',
    label: 'Telebirr',
    account: '09XXXXXXXX',
    holder: 'Mubarek Kassa',
    hint: 'የቴሌብር ዋሌት ቁጥር',
    icon: Smartphone,
    accent: 'from-emerald-500 to-emerald-700',
  },
  {
    key: 'cbe',
    label: 'Commercial Bank of Ethiopia',
    account: '1000XXXXXXXX',
    holder: 'Mubarek Kassa',
    hint: 'የኢትዮጵያ ንግድ ባንክ አካውንት',
    icon: Building2,
    accent: 'from-amber-500 to-amber-700',
  },
  {
    key: 'abyssinia',
    label: 'Bank of Abyssinia',
    account: '8000XXXXXXXX',
    holder: 'Mubarek Kassa',
    hint: 'የአቢሲኒያ ባንክ አካውንት',
    icon: Building2,
    accent: 'from-blue-500 to-blue-700',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileExtension(file: File): string {
  const name = file.name || '';
  const dot = name.lastIndexOf('.');
  if (dot < 0) return 'png';
  const ext = name.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'png';
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy account number"
      className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          ተቀድቷል
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          ቅዳ
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Bank card
// ---------------------------------------------------------------------------

function BankCard({ bank }: { bank: BankInfo }) {
  const Icon = bank.icon;
  return (
    <div className="relative rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${bank.accent} shadow-md shadow-slate-900/10`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {bank.label}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {bank.hint}
          </p>
          <p className="mt-3 font-mono text-base text-slate-900 dark:text-slate-100 tracking-wide">
            {bank.account}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            የአካውንት ባለቤት፡ <span className="font-semibold">{bank.holder}</span>
          </p>
        </div>
        <CopyButton value={bank.account} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PaymentForm({ userId, initialPayment }: PaymentFormProps) {
  const [payment, setPayment] = useState<PaymentRow | null>(initialPayment);
  const [status, setStatus] = useState<
    'none' | 'pending' | 'approved' | 'rejected'
  >(initialPayment?.status ?? 'none');

  // Form state
  const [method, setMethod] = useState<BankKey>('telebirr');
  const [transactionRef, setTransactionRef] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedBank = useMemo(
    () => BANKS.find((b) => b.key === method) ?? BANKS[0],
    [method]
  );

  // -----------------------------------------------------------------------
  // Preview URL lifecycle
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // -----------------------------------------------------------------------
  // File picker
  // -----------------------------------------------------------------------
  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const picked = e.target.files?.[0] ?? null;

    if (!picked) {
      setFile(null);
      return;
    }
    if (!picked.type.startsWith('image/')) {
      setFormError('እባክዎ የምስል ፋይል ብቻ ይምረጡ (PNG, JPG, JPEG)።');
      setFile(null);
      e.target.value = '';
      return;
    }
    if (picked.size > MAX_FILE_SIZE_BYTES) {
      setFormError('የፋይሉ መጠን ከ5MB መብለጥ የለበትም።');
      setFile(null);
      e.target.value = '';
      return;
    }
    setFile(picked);
  }, []);

  const handleClearFile = useCallback(() => {
    setFile(null);
    setFormError(null);
  }, []);

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError(null);

      if (!userId) {
        setFormError('የተጠቃሚ መረጃ አልተገኘም። እባክዎ እንደገና ይግቡ።');
        return;
      }
      if (!file) {
        setFormError('እባክዎ የክፍያ ደረሰኝ ምስል ይምረጡ።');
        return;
      }

      setSubmitting(true);

      try {
        const ext = getFileExtension(file);
        const fileName = `${userId}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(RECEIPTS_BUCKET)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'image/png',
          });

        if (uploadError) {
          console.error('[PaymentForm] upload error:', uploadError);
          throw new Error('ደረሰኙን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
        }

        const { data: urlData } = supabase.storage
          .from(RECEIPTS_BUCKET)
          .getPublicUrl(fileName);

        const receiptUrl = urlData?.publicUrl ?? '';
        if (!receiptUrl) {
          await supabase.storage.from(RECEIPTS_BUCKET).remove([fileName]);
          throw new Error('የደረሰኙን አድራሻ ማግኘት አልተቻለም።');
        }

        const { data: inserted, error: insertError } = await supabase
          .from('payments')
          .insert({
            user_id: userId,
            amount: PAYMENT_AMOUNT_ETB,
            payment_method: selectedBank.label,
            transaction_ref: transactionRef.trim() || null,
            receipt_url: receiptUrl,
            status: 'pending',
          })
          .select(
            'id, user_id, amount, payment_method, transaction_ref, receipt_url, status, created_at'
          )
          .single();

        if (insertError) {
          console.error('[PaymentForm] insert error:', insertError);
          await supabase.storage.from(RECEIPTS_BUCKET).remove([fileName]);
          throw new Error('የክፍያ መረጃውን መመዝገብ አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
        }

        const record = inserted as PaymentRow;
        setPayment(record);
        setStatus('pending');

        // Reset form
        setFile(null);
        setTransactionRef('');
        setMethod('telebirr');
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : 'ያልታወቀ ስህተት ተከስቷል።';
        setFormError(reason);
      } finally {
        setSubmitting(false);
      }
    },
    [userId, file, transactionRef, selectedBank]
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* STATUS BANNER                                                        */}
      {/* =================================================================== */}
      {status === 'approved' && (
        <section className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-900 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/60">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                ክፍያዎ ተረጋግጧል!
              </h3>
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200/90 leading-relaxed">
                ሁሉም ትምህርቶች ተከፍተውልዎታል። ወደ ትምህርቶቹ ተመልሰው መማር ይቀጥሉ።
              </p>
              <Link
                href="/dashboard/courses"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:from-emerald-600 hover:to-emerald-500 transition-all"
              >
                <BookOpen className="h-4 w-4" />
                ወደ ትምህርቶቼ ተመለስ
              </Link>
            </div>
          </div>
        </section>
      )}

      {status === 'pending' && payment && (
        <section className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/60">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">
                ክፍያዎ በመመርመር ላይ ነው
              </h3>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200/90 leading-relaxed">
                እባክዎን አድሚኑ እስኪያረጋግጥ ድረስ ይጠብቁ። በቅርቡ ማረጋገጫ ይደርስዎታል።
              </p>
              <div className="mt-3 space-y-1 text-xs text-amber-800/90 dark:text-amber-200/80">
                <p>
                  <span className="font-semibold">የክፍያ ዘዴ፡</span>{' '}
                  {payment.payment_method}
                </p>
                <p>
                  <span className="font-semibold">መጠን፡</span>{' '}
                  {payment.amount} ብር
                </p>
                {payment.transaction_ref && (
                  <p className="font-mono">Ref: {payment.transaction_ref}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {status === 'rejected' && (
        <section className="rounded-2xl border border-red-300 dark:border-red-800 bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-slate-900 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/60">
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 dark:text-red-100">
                ክፍያው አልጸደቀም
              </h3>
              <p className="mt-1 text-sm text-red-800 dark:text-red-200/90 leading-relaxed">
                የላኩት ደረሰኝ ተቀባይነት አላገኘም። እባክዎ ትክክለኛውን ደረሰኝ በድጋሚ ይላኩ።
              </p>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* HEADER                                                               */}
      {/* =================================================================== */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            የኮርስ ክፍያ
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ሁሉንም ትምህርቶች ለመክፈት {PAYMENT_AMOUNT_ETB} ብር ይክፈሉ
          </p>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BANK ACCOUNTS                                                        */}
      {/* =================================================================== */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            የክፍያ አማራጮች
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BANKS.map((bank) => (
            <BankCard key={bank.key} bank={bank} />
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          ከክፍያ በኋላ የከፈሉበትን ደረሰኝ ከዚህ በታች ያለውን ቅጽ በመሙላት ይላኩ።
        </p>
      </section>

      {/* =================================================================== */}
      {/* SUBMISSION FORM (hidden when approved)                               */}
      {/* =================================================================== */}
      {status !== 'approved' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            ደረሰኝ ያስገቡ
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            የከፈሉበትን የባንክ ወይም የቴሌብር ደረሰኝ ምስል እዚህ ይላኩ።
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Bank dropdown */}
            <div>
              <label
                htmlFor="method"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
              >
                የክፍያ ዘዴ <span className="text-red-500">*</span>
              </label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value as BankKey)}
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
              >
                {BANKS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction reference */}
            <div>
              <label
                htmlFor="transactionRef"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
              >
                የግብይት ማጣቀሻ ቁጥር (Transaction Reference)
              </label>
              <input
                id="transactionRef"
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                disabled={submitting}
                placeholder="ለምሳሌ፡ TRX12345678"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
              />
            </div>

            {/* Receipt image */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                የደረሰኝ ምስል <span className="text-red-500">*</span>
              </label>

              {previewUrl && file ? (
                <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    className="max-h-64 w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleClearFile}
                    disabled={submitting}
                    aria-label="Remove receipt"
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                    {file.name} · {(file.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              ) : (
                <label
                  className={[
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
                    'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60',
                    'hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20',
                    submitting ? 'opacity-60 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <ImageIcon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    ምስል ለመምረጥ እዚህ ይጫኑ
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    PNG, JPG · ከ5MB በታች
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={submitting}
                    className="sr-only"
                  />
                </label>
              )}
            </div>

            {/* Error */}
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="flex-1 leading-relaxed">{formError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !file}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 px-5 py-3 text-sm font-bold text-white ring-1 ring-amber-400/40 shadow-lg shadow-emerald-950/40 transition-all hover:from-emerald-600 hover:via-emerald-500 hover:to-emerald-600 hover:ring-amber-400/70 active:scale-[0.985] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-amber-200" />
                  <span>ደረሰኙ በመላክ ላይ ነው...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-amber-300" />
                  <span>ደረሰኙን ላክ</span>
                </>
              )}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}