// app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  BookOpen,
  Mic,
  GraduationCap,
  Library,
  Lock,
  LogOut,
  User,
  Sparkles,
  Loader2,
  Sun,
  Moon,
  Calendar,
  Quote,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

type DashboardUser = {
  email?: string;
  full_name?: string;
};

type Hadith = {
  text: string;
  source: string;
};

// Daily rotating ahadith (Amharic)
const ahadith: Hadith[] = [
  {
    text: '“ተግባራት ሁሉ የሚመዘኑት በኒያ (ዓላማ) ነው፤ ለእያንዳንዱም ሰው ያሰበው ነገር ብቻ ይመለሳል።”',
    source: 'ቡኻሪና ሙስሊም',
  },
  {
    text: '“ሙእሚን አንድ ሙእሚን ወንድሙን እንደ አንድ ግድግዳ የሚደግፍ ነው።”',
    source: 'ቡኻሪና ሙስሊም',
  },
  {
    text: '“ከእናንተ በላጩ ቁርአንን የተማረና ያስተማረ ነው።”',
    source: 'ቡኻሪ',
  },
  {
    text: '“ማንም በምድር ላይ ያለ አንድ ችግር ያለበትን ቢያቀልልለት አላህ የትንሣኤውን ችግር ያቀልልለታል።”',
    source: 'ሙስሊም',
  },
  {
    text: '“ጠንካራ ሙእሚን ከደካማ ሙእሚን ይልቅ በአላህ ዘንድ የተወደደና የተሻለ ነው።”',
    source: 'ሙስሊም',
  },
];

// Amharic month names for Hijri calendar (1-indexed)
const hijriMonthsAmh: string[] = [
  'ሙሐረም',
  'ሰፈር',
  'ረቢዑል አወል',
  'ረቢዑስ ሳኒ',
  'ጀማዱል አወል',
  'ጀማዱል አኺር',
  'ረጀብ',
  'ሸዕባን',
  'ረመዷን',
  'ሸወል',
  'ዙልቀዕዳ',
  'ዙልሒጃ',
];

// ---------------------------------------------------------------------------
// Hijri date with standard Latin numbers & Amharic month
// ---------------------------------------------------------------------------
function getHijriDate(): string {
  try {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat(
      'en-SA-u-ca-islamic-umalqura-nu-latn',
      {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }
    );
    const parts = formatter.formatToParts(today);

    let day = '1';
    let month = '1';
    let year = '1448';

    for (const part of parts) {
      if (part.type === 'day') day = part.value;
      else if (part.type === 'month') month = part.value;
      else if (part.type === 'year') year = part.value;
    }

    const monthIndex = parseInt(month, 10) - 1;
    const amhMonth =
      hijriMonthsAmh[monthIndex] || `ሙሐረም (${monthIndex + 1})`;

    return `${day} ${amhMonth} ${year} ዓ.ሂ`;
  } catch {
    const now = new Date();
    const fallbackDay = now.getDate();
    return `${fallbackDay} ሙሐረም 1448 ዓ.ሂ`;
  }
}

// ---------------------------------------------------------------------------
// Daily Hadith index (day of year)
// ---------------------------------------------------------------------------
function getDailyHadithIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return dayOfYear % ahadith.length;
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [hijriDate, setHijriDate] = useState('');
  const [hadithIndex, setHadithIndex] = useState(0);

  // ---------- Dark mode state & persistence ----------
  useEffect(() => {
    const stored = localStorage.getItem('basira-theme');
    let isDark = false;
    if (stored === 'dark') {
      isDark = true;
    } else if (stored === 'light') {
      isDark = false;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      isDark = true;
    }

    setDarkMode(isDark);
    // Apply the class to the document root for global effect
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      // Persist preference
      localStorage.setItem('basira-theme', next ? 'dark' : 'light');
      // Apply/remove dark class on html element for global dark mode
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  // ---------- Auth ----------
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) {
          setUser({
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name,
          });
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  // ---------- Hijri date & daily hadith ----------
  useEffect(() => {
    setHijriDate(getHijriDate());
    setHadithIndex(getDailyHadithIndex());
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  // ---------- Loading state ----------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const currentHadith = ahadith[hadithIndex];

  // ---------- Render ----------
  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        darkMode
          ? 'dark bg-slate-900 text-white'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          {/* Logo / Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
              <GraduationCap className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">በሲራ</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Basira Dashboard</p>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Dark mode toggle - enhanced for touch */}
            <button
              onClick={toggleDarkMode}
              className="relative z-50 p-3 touch-manipulation cursor-pointer rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* User greeting (hidden on small screens) */}
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              <span className="font-medium">
                {user?.full_name || user?.email || 'ተማሪ'}
              </span>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors duration-200 disabled:opacity-60"
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">ውጣ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pb-12">
        {/* Welcome Banner with Hijri Date */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-emerald-100 dark:border-slate-700 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              እንኳን ደህና መጡ፣ {user?.full_name || 'ተማሪ'}!{' '}
              <Sparkles className="inline h-6 w-6 text-amber-400" />
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              የእውቀት ጉዞዎን ይቀጥሉ።
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl px-4 py-2">
            <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              ዛሬ፡ {hijriDate}
            </span>
          </div>
        </div>

        {/* Daily Hadith */}
        <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-amber-100 dark:border-amber-900/50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <Quote className="h-8 w-8 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-800 dark:text-amber-200 mb-2">
                የዕለቱ ሐዲስ
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-base sm:text-lg">
                {currentHadith.text}
              </p>
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 font-medium">
                — {currentHadith.source}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Learning Pillars */}
        <div className="mt-8">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">
            የመማሪያ ማዕከላት
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. የላቁ ኮርሶች */}
            <Link
              href="/courses"
              className="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-700 transition-all duration-300 touch-manipulation cursor-pointer"
            >
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Lock className="h-3 w-3" />
                  የተከፈለ
                </span>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20 mb-4">
                <BookOpen className="h-7 w-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                የላቁ ኮርሶች
              </h4>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                የተከፈሉና የላቁ ኮርሶች ከምሁራን ጋር።
              </p>
            </Link>

            {/* 2. የቁርአን ማዕከል */}
            <Link
              href="/quran"
              className="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-700 transition-all duration-300 touch-manipulation cursor-pointer"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 mb-4">
                <Mic className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                የቁርአን ማዕከል
              </h4>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                የቃሪዎች ማዕከል – ተጅዊድና ንባብ ልምምድ።
              </p>
            </Link>

            {/* 3. ዳዕዋዎችና ሙሐደራዎች */}
            <Link
              href="/dawah"
              className="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-700 transition-all duration-300 touch-manipulation cursor-pointer"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 mb-4">
                <GraduationCap className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                ዳዕዋዎችና ሙሐደራዎች
              </h4>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                የሀገር ውስጥና ዓለም አቀፍ እስላማዊ ትምህርቶች።
              </p>
            </Link>

            {/* 4. ዲጂታል ቤተ-መጽሐፍት */}
            <Link
              href="/library"
              className="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-700 transition-all duration-300 touch-manipulation cursor-pointer"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-900/20 mb-4">
                <Library className="h-7 w-7 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                ዲጂታል ቤተ-መጽሐፍት
              </h4>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                ፒዲኤፍ መጻሕፍትና ንባብ ማዕከል።
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}