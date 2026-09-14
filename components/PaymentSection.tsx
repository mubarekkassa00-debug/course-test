'use client';
// components/PaymentSection.tsx
//
// Payment submission + status card for the Basira student dashboard.
//
// Flow:
//   1. On mount, query `public.payments` for the student's latest record.
//   2. If none exists, render the submission form.
//   3. On submit: upload the receipt image to the `receipts` bucket, then
//      insert a new row with status `pending`.
//   4. If a record exists:
//        • pending  → show "waiting for admin approval" banner.
//        • approved → show success message.
//        • rejected → show error + allow resubmission.
//
// Styling matches the Basira emerald / gold dark-theme design.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PaymentMethod = 'telebirr' | 'cbe';

type PaymentStatus = 'pending' | 'approved' | 'rejected';

interface PaymentRecord {
  id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  receipt_url: string | null;
  status: PaymentStatus;
  created_at?: string;
}

interface PaymentSectionProps {
  /** The authenticated student's user id. */
  userId: string;
  /** Optional callback fired after a successful submission. */
  onPaymentSubmitted?: () => void;
}

type UIState = 'loading' | 'idle' | 'uploading' | 'pending' | 'approved' | 'rejected';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAYMENT_AMOUNT_ETB = 300;
const RECEIPTS_BUCKET = 'receipts';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const PAYMENT_DETAILS = {
  telebirr: {
    label: 'Telebirr',
    account: '09XXXXXXXX',
    holder: 'Mubarek Kassa',
    hint: 'የቴሌብር ዋሌት ቁጥር',
  },
  cbe: {
    label: 'Commercial Bank of Ethiopia (CBE)',
    account: '1000XXXXXXXX',
    holder: 'Mubarek Kassa',
    hint: 'የኢትዮጵያ ንግድ ባንክ አካውንት ቁጥር',
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a lowercase extension without the dot, defaulting to `png`. */
function getFileExtension(file: File): string {
  const name = file.name || '';
  const dot = name.lastIndexOf('.');
  if (dot < 0) return 'png';
  const ext = name.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'png';
}

/** Copy text to the clipboard with a small fallback for older browsers. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers / insecure contexts.
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
// Sub-components
// ---------------------------------------------------------------------------

function CopyableAccountField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }, [value]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="font-mono text-sm text-slate-900 dark:text-slate-100 truncate">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PaymentSection({
  userId,
  onPaymentSubmitted,
}: PaymentSectionProps) {
  const [uiState, setUiState] = useState<UIState>('loading');
  const [existingPayment, setExistingPayment] = useState<PaymentRecord | null>(
    null
  );

  // Form state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('telebirr');
  const [transactionRef, setTransactionRef] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedDetails = useMemo(
    () => PAYMENT_DETAILS[paymentMethod],
    [paymentMethod]
  );

  // -------------------------------------------------------------------------
  // Load existing payment record on mount / userId change
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadPayment = async () => {
      if (!userId) {
        if (!cancelled) setUiState('idle');
        return;
      }

      setUiState('loading');

      try {
        // Fetch the most recent payment for this user.
        const { data, error } = await supabase
          .from('payments')
          .select(
            'id, user_id, amount, payment_method, transaction_ref, receipt_url, status, created_at'
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('[PaymentSection] Failed to load payment:', error);
          setUiState('idle');
          return;
        }

        if (data) {
          const record = data as PaymentRecord;
          setExistingPayment(record);

          if (record.status === 'approved') {
            setUiState('approved');
          } else if (record.status === 'rejected') {
            setUiState('rejected');
          } else {
            setUiState('pending');
          }
        } else {
          setExistingPayment(null);
          setUiState('idle');
        }
      } catch (err) {
        console.error('[PaymentSection] Unexpected error:', err);
        if (!cancelled) setUiState('idle');
      }
    };

    loadPayment();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // -------------------------------------------------------------------------
  // Preview URL lifecycle
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // -------------------------------------------------------------------------
  // File input handler
  // -------------------------------------------------------------------------
  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
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
    },
    []
  );

  const handleClearFile = useCallback(() => {
    setFile(null);
    setFormError(null);
  }, []);

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------
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

      setUiState('uploading');

      try {
        // --------------------------------------------------------------
        // 1. Upload the receipt image to Supabase Storage
        // --------------------------------------------------------------
        const ext = getFileExtension(file);
        const fileName = `${userId}_${Date.now()}.${ext}`;
        const filePath = `${fileName}`; // bucket root

        const { error: uploadError } = await supabase.storage
          .from(RECEIPTS_BUCKET)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'image/png',
          });

        if (uploadError) {
          console.error('[PaymentSection] Upload error:', uploadError);
          throw new Error(
            'ደረሰኙን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።'
          );
        }

        // --------------------------------------------------------------
        // 2. Resolve the public URL
        // --------------------------------------------------------------
        const { data: publicUrlData } = supabase.storage
          .from(RECEIPTS_BUCKET)
          .getPublicUrl(filePath);

        const receiptUrl = publicUrlData?.publicUrl ?? '';

        if (!receiptUrl) {
          // Best-effort cleanup of the orphaned file.
          await supabase.storage.from(RECEIPTS_BUCKET).remove([filePath]);
          throw new Error('የደረሰኙን አድራሻ ማግኘት አልተቻለም።');
        }

        // --------------------------------------------------------------
        // 3. Insert a new payment row (status = 'pending')
        // --------------------------------------------------------------
        const { data: inserted, error: insertError } = await supabase
          .from('payments')
          .insert({
            user_id: userId,
            amount: PAYMENT_AMOUNT_ETB,
            payment_method: selectedDetails.label,
            transaction_ref: transactionRef.trim() || null,
            receipt_url: receiptUrl,
            status: 'pending',
          })
          .select(
            'id, user_id, amount, payment_method, transaction_ref, receipt_url, status, created_at'
          )
          .single();

        if (insertError) {
          console.error('[PaymentSection] Insert error:', insertError);
          // Best-effort cleanup of the uploaded file since the DB row
          // couldn't be created.
          await supabase.storage.from(RECEIPTS_BUCKET).remove([filePath]);
          throw new Error(
            'የክፍያ መረጃውን መመዝገብ አልተቻለም። እባክዎ እንደገና ይሞክሩ።'
          );
        }

        // --------------------------------------------------------------
        // 4. Success
        // --------------------------------------------------------------
        const record = (inserted ?? null) as PaymentRecord | null;
        setExistingPayment(record);
        setUiState('pending');

        // Reset the form for a clean slate.
        setFile(null);
        setTransactionRef('');
        setPaymentMethod('telebirr');

        // Notify the parent (e.g. to refresh dashboard data).
        onPaymentSubmitted?.();
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : 'ያልታወቀ ስህተት ተከስቷል።';
        setFormError(reason);
        setUiState('idle');
      }
    },
    [
      userId,
      file,
      transactionRef,
      selectedDetails,
      onPaymentSubmitted,
    ]
  );

  // -------------------------------------------------------------------------
  // Retry (rejected → idle)
  // -------------------------------------------------------------------------
  const handleRetry = useCallback(() => {
    setExistingPayment(null);
    setFormError(null);
    setUiState('idle');
  }, []);

  // -------------------------------------------------------------------------
  // Render: loading
  // -------------------------------------------------------------------------
  if (uiState === 'loading') {
    return (
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
          <span className="ml-3 text-sm text-slate-600 dark:text-slate-400">
            የክፍያ መረጃ በመጫን ላይ ነው...
          </span>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Render: approved
  // -------------------------------------------------------------------------
  if (uiState === 'approved') {
    return (
      <section className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-900 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/60">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
              ክፍያዎ ጸድቋል!
            </h3>
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200/90 leading-relaxed">
              ሰርቲፊኬት ማውረድ ይችላሉ። ወደ ዳሽቦርዱ ተመልሰው የምስክር ወረቀት ክፍሉን ይጠቀሙ።
            </p>
            {existingPayment?.transaction_ref && (
              <p className="mt-2 text-xs text-emerald-700/80 dark:text-emerald-300/80 font-mono">
                Ref: {existingPayment.transaction_ref}
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Render: pending
  // -------------------------------------------------------------------------
  if (uiState === 'pending') {
    return (
      <section className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/60">
            <Clock className="h-6 w-6 text-amber-600 dark:text-amber-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">
              በመጠበቅ ላይ ነው (Pending)
            </h3>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200/90 leading-relaxed">
              የከፈሉት ደረሰኝ ደርሶናል! በአድሚን ማረጋገጫ በመጠበቅ ላይ ነው (Pending)...
            </p>
            {existingPayment && (
              <div className="mt-3 space-y-1 text-xs text-amber-800/90 dark:text-amber-200/80">
                <p>
                  <span className="font-semibold">የክፍያ ዘዴ፡</span>{' '}
                  {existingPayment.payment_method}
                </p>
                <p>
                  <span className="font-semibold">መጠን፡</span>{' '}
                  {existingPayment.amount} ብር
                </p>
                {existingPayment.transaction_ref && (
                  <p className="font-mono">
                    Ref: {existingPayment.transaction_ref}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Render: rejected
  // -------------------------------------------------------------------------
  if (uiState === 'rejected') {
    return (
      <section className="rounded-2xl border border-red-300 dark:border-red-800 bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-slate-900 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/60">
            <XCircle className="h-6 w-6 text-red-600 dark:text-red-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-900 dark:text-red-100">
              ክፍያው አልጸደቀም
            </h3>
            <p className="mt-1 text-sm text-red-800 dark:text-red-200/90 leading-relaxed">
              የከፈሉት ደረሰኝ ተቀባይነት አላገኘም። እባክዎ ትክክለኛውን ደረሰኝ በድጋሚ ይላኩ።
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 px-4 py-2 text-sm font-bold text-white ring-1 ring-amber-400/40 shadow-md hover:from-emerald-600 hover:via-emerald-500 hover:to-emerald-600 transition-all"
            >
              <Upload className="h-4 w-4" />
              በድጋሚ ይላኩ
            </button>
          </div>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Render: idle (form) / uploading (form disabled)
  // -------------------------------------------------------------------------
  const isUploading = uiState === 'uploading';

  return (
    <section className="rounded-2xl border border-emerald-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-amber-100 dark:from-emerald-900/40 dark:to-amber-900/40">
          <CreditCard className="h-6 w-6 text-emerald-700 dark:text-amber-300" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            የኮርስ ክፍያ
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            ኮርሱን ለመክፈት {PAYMENT_AMOUNT_ETB} ብር ይክፈሉ። ደረሰኙን ከዚህ
            በታች ይላኩ።
          </p>
        </div>
        <div className="hidden sm:flex shrink-0 items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
          {PAYMENT_AMOUNT_ETB} ETB
        </div>
      </div>

      {/* Payment accounts */}
      <div className="mt-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          የክፍያ አማራጮች
        </p>
        <CopyableAccountField
          label={`${PAYMENT_DETAILS.telebirr.label} — ${PAYMENT_DETAILS.telebirr.hint}`}
          value={PAYMENT_DETAILS.telebirr.account}
        />
        <CopyableAccountField
          label={`${PAYMENT_DETAILS.cbe.label} — ${PAYMENT_DETAILS.cbe.hint}`}
          value={PAYMENT_DETAILS.cbe.account}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          የአካውንት ባለቤት፡ <span className="font-semibold">Mubarek Kassa</span>
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Payment method */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            የክፍያ ዘዴ <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['telebirr', 'cbe'] as PaymentMethod[]).map((method) => {
              const details = PAYMENT_DETAILS[method];
              const selected = paymentMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  disabled={isUploading}
                  className={[
                    'flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all',
                    selected
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                    isUploading ? 'opacity-60 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {details.label}
                  </span>
                  {selected && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Transaction reference (optional) */}
        <div>
          <label
            htmlFor="transactionRef"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
          >
            የግብይት ማጣቀሻ ቁጥር (አማራጭ)
          </label>
          <input
            id="transactionRef"
            type="text"
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            disabled={isUploading}
            placeholder="ለምሳሌ፡ TRX12345678"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
          />
        </div>

        {/* Receipt image */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            የክፍያ ደረሰኝ ምስል <span className="text-red-500">*</span>
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
                disabled={isUploading}
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
                isUploading ? 'opacity-60 cursor-not-allowed' : '',
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
                disabled={isUploading}
                className="sr-only"
              />
            </label>
          )}
        </div>

        {/* Form-level error */}
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
          disabled={isUploading || !file}
          className={[
            'w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl',
            'font-bold text-sm tracking-wide text-white',
            'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700',
            'ring-1 ring-amber-400/40',
            'shadow-lg shadow-emerald-950/40',
            'transition-all duration-200',
            'hover:from-emerald-600 hover:via-emerald-500 hover:to-emerald-600',
            'hover:ring-amber-400/70',
            'active:scale-[0.985]',
            'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300',
          ].join(' ')}
        >
          {isUploading ? (
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
  );
}