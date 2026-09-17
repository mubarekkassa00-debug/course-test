// app/courses/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Home,
  BookOpen,
  Award,
  GraduationCap,
  Menu,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Amharic text constants
// ---------------------------------------------------------------------------
const amh = {
  title: 'የላቁ ኢስላማዊ ኮርሶች',
  courseStart: 'ትምህርቱን ጀምር',
  lessons: 'ትምህርቶች',
  certificateBadge: 'ሰርተፊኬት ያለው',
  dashboard: 'ዳሽቦርድ',
  courses: 'ኮርሶች',
  menu: 'ማውጫ',
};

// ---------------------------------------------------------------------------
// Sample courses data (4 foundational books)
// ---------------------------------------------------------------------------
const courses = [
  {
    id: 1,
    title: 'ሦስቱ መሠረቶች (አል-ኡሱል አል-ሰላሳ)',
    category: 'አቂዳ',
    lessonsCount: 11,
    gradient: 'from-blue-700 to-blue-900',
    image:
      'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 2,
    title: '40ሩ የነወዊ ሀዲሶች (አል-አርባዒን)',
    category: 'ሀዲስ',
    lessonsCount: 11,
    gradient: 'from-purple-700 to-purple-900',
    image:
      'https://images.unsplash.com/photo-1585036156171-384164a8c675?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 3,
    title: 'የሶላትና የዉዱእ ህጎች (ሹሩጡ ሶላት)',
    category: 'ፊቅህ',
    lessonsCount: 10,
    gradient: 'from-emerald-700 to-emerald-900',
    image:
      'https://images.unsplash.com/photo-1618022325802-7e5e732d97a1?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 4,
    title: 'አጭሩ የነቢዩ (ﷺ) ታሪክ (ኡርጁዘቱል ሚኢያህ)',
    category: 'ሲራ',
    lessonsCount: 14,
    gradient: 'from-red-700 to-red-900',
    image:
      'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=800&q=80',
  },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function CoursesPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Component did mount → safe to apply dynamic classes
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Global dark mode initialization (read from localStorage)
  useEffect(() => {
    const stored = localStorage.getItem('basira-theme');
    if (stored === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Close drawer on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div
      suppressHydrationWarning={true}
      className={`min-h-screen transition-colors duration-300 font-sans tracking-wide leading-relaxed ${
        hasMounted && darkMode
          ? 'dark bg-slate-900 text-white'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Header with Hamburger Menu */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={amh.menu}
              aria-expanded={menuOpen}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Menu className="h-6 w-6 text-slate-700 dark:text-slate-200" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
              <GraduationCap className="h-6 w-6 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{amh.title}</span>
            </h1>
          </div>
        </div>
      </header>

      {/* Hamburger Drawer + Backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label={amh.menu}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer panel */}
          <aside
            className="absolute top-0 left-0 h-full w-72 max-w-[85vw] bg-white dark:bg-slate-800 shadow-2xl border-r border-slate-200 dark:border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
                  <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  በሲራ
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
              >
                <Home className="h-5 w-5" />
                {amh.dashboard}
              </Link>
              <Link
                href="/courses"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
              >
                <BookOpen className="h-5 w-5" />
                {amh.courses}
              </Link>
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-12">
        {/* Course Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col"
            >
              {/* Islamic cover image with subtle gradient overlay */}
              <div
                className={`relative h-40 overflow-hidden bg-gradient-to-br ${course.gradient}`}
              >
                <img
                  src={course.image}
                  alt={course.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-90"
                />
                {/* Subtle dark gradient for readability + premium feel */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
                {/* Islamic geometric accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300" />

                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10">
                  <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full border border-white/30">
                    {course.category}
                  </span>
                  <span className="bg-yellow-400/90 text-yellow-900 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    {amh.certificateBadge}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {course.title}
                </h3>

                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
                  <BookOpen className="h-4 w-4" />
                  <span>
                    {course.lessonsCount} {amh.lessons}
                  </span>
                </div>

                {/* Start button navigates to course page */}
                <Link
                  href={`/courses/${course.id}`}
                  className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors text-center"
                >
                  <GraduationCap className="h-5 w-5" />
                  {amh.courseStart}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}