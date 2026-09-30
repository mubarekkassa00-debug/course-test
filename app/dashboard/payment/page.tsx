// app/dashboard/payment/page.tsx
//
// Server Component — renders the dedicated course-payment route.
//   1. Reads the Supabase auth session from cookies (server-side).
//   2. If the student is not authenticated, redirects to /login.
//   3. Otherwise renders the header + <PaymentSection /> with the user's id.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { ArrowLeft, CreditCard } from 'lucide-react';
import PaymentSection from '@/components/PaymentSection';

export const metadata = {
  title: 'የኮርስ ክፍያ · Basira',
  description: 'የባሲራ ኮርሶችን ለመክፈት ክፍያ ይፈጽሙ።',
};

export default async function PaymentPage() {
  // ---------------------------------------------------------------------------
  // 1. Supabase Server Client — reads/writes auth cookies via next/headers
  // ---------------------------------------------------------------------------
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
            // Server Components cannot always write cookies (e.g. during
            // streaming). We swallow the error here — `middleware.ts`
            // is responsible for refreshing the session cookies on
            // every request, so this is safe.
          }
        },
      },
    }
  );

  // ---------------------------------------------------------------------------
  // 2. Authenticate — `getUser()` validates the JWT with Supabase servers
  // ---------------------------------------------------------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ---------------------------------------------------------------------------
  // 3. Unauthenticated users are bounced to /login
  // ---------------------------------------------------------------------------
  if (!user) {
    redirect('/login');
  }

  // ---------------------------------------------------------------------------
  // 4. Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* =================================================================== */}
        {/* HEADER                                                               */}
        {/* =================================================================== */}
        <div className="flex items-start gap-3 mb-8">
          {/* Back button */}
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* Title + description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md shadow-emerald-900/20">
                <CreditCard className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                የኮርስ ክፍያ
              </h1>
            </div>
            <p className="mt-2 text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
              ሁሉንም ትምህርቶች፣ ዲጂታል ቤተ-መጽሐፍት እና የምስክር ወረቀትዎን
              ለመክፈት ክፍያውን ያጠናቅቁ።
            </p>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PAYMENT SECTION                                                      */}
        {/* =================================================================== */}
        <PaymentSection userId={user.id} />
      </div>
    </div>
  );
}