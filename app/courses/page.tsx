// app/courses/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Home,
  BookOpen,
  Award,
  ArrowLeft,
  GraduationCap,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Amharic text constants
// ---------------------------------------------------------------------------
const amh = {
  title: 'የላቁ ኢስላማዊ ኮርሶች',
  backToDashboard: 'ወደ ዳሽቦርድ',
  myCertificates: 'የእኔ ሰርተፊኬቶች',
  verifyCertificate: 'ሰርተፊኬት ማረጋገጫ',
  courseStart: 'ትምህርቱን ጀምር',
  lessons: 'ትምህርቶች',
  progress: 'እድገት',
  certificateBadge: 'ሰርተፊኬት ያለው',
  close: 'ዝጋ',
  verifySectionTitle: 'ሰርተፊኬት አረጋግጥ',
  verifyDescription:
    'የኮርስ ማጠናቀቂያ ሰርተፊኬት በ QR ኮድ የተጠበቀ ነው። የሰርተፊኬቱን መለያ ቁጥር በማስገባት ትክክለኝነቱን ያረጋግጡ።',
  certificateCodeLabel: 'የሰርተፊኬት መለያ ቁጥር',
  verifyButton: 'አረጋግጥ',
  dashboard: 'ዳሽቦርድ',
  courses: 'ኮርሶች',
  certificates: 'ሰርተፊኬት',
};

// ---------------------------------------------------------------------------
// Sample courses data (5 foundational books)
// ---------------------------------------------------------------------------
const courses = [
  {
    id: 1,
    title: 'ሦስቱ መሠረቶች (አል-ኡሱል አል-ሰላሳ)',
    category: 'አቂዳ',
    lessonsCount: 12,
    progress: 0,
    gradient: 'from-blue-600 to-blue-800',
  },
  {
    id: 2,
    title: '40ሩ የነወዊ ሀዲሶች (አል-አርባዒን)',
    category: 'ሀዲስ',
    lessonsCount: 15,
    progress: 0,
    gradient: 'from-purple-600 to-purple-800',
  },
  {
    id: 3,
    title: 'የሶላትና የዉዱእ ህጎች (ሹሩጡ ሶላት)',
    category: 'ፊቅህ',
    lessonsCount: 10,
    progress: 0,
    gradient: 'from-emerald-600 to-emerald-800',
  },
  {
    id: 4,
    title: 'አጭሩ የነቢዩ (ﷺ) ታሪክ (ኡርጁዘቱል ሚኢያህ)',
    category: 'ሲራ',
    lessonsCount: 14,
    progress: 0,
    gradient: 'from-red-600 to-red-800',
  },
  {
    id: 5,
    title: 'መሰረታዊ የአረብኛ ሰዋሰው (አል-አጅሩሚያህ)',
    category: 'ቋንቋ',
    lessonsCount: 18,
    progress: 0,
    gradient: 'from-amber-600 to-amber-800',
  },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function CoursesPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [certificateCode, setCertificateCode] = useState('');
  const [verificationResult, setVerificationResult] = useState<'valid' | 'invalid' | null>(null);

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

  const handleVerify = () => {
    if (certificateCode.trim().startsWith('BAS')) {
      setVerificationResult('valid');
    } else {
      setVerificationResult('invalid');
    }
  };

  const scrollToVerify = () => {
    document.getElementById('verify-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      suppressHydrationWarning={true}
      className={`min-h-screen pb-16 md:pb-0 transition-colors duration-300 font-sans tracking-wide leading-relaxed ${
        hasMounted && darkMode
          ? 'dark bg-slate-900 text-white'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Header (visible on all screens, but different content) */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          {/* Left: Back button + Title */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </Link>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              {amh.title}
            </h1>
          </div>

          {/* Desktop Navigation Links (hidden on mobile) */}
          <nav className="hidden md:flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {amh.dashboard}
            </Link>
            <Link
              href="/courses"
              className="text-sm font-medium text-emerald-600 dark:text-emerald-400"
            >
              {amh.courses}
            </Link>
            <button
              onClick={scrollToVerify}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {amh.certificates}
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-12">
        {/* Course Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col"
            >
              {/* Top gradient area */}
              <div className={`relative h-36 bg-gradient-to-br ${course.gradient} p-5 flex items-end`}>
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                  <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full">
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

                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-3">
                  <BookOpen className="h-4 w-4" />
                  <span>
                    {course.lessonsCount} {amh.lessons}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-auto mb-4">
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {amh.progress}: {course.progress}%
                  </p>
                </div>

                {/* Start button navigates to course page */}
                <Link
                  href={`/courses/${course.id}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors text-center"
                >
                  <GraduationCap className="h-5 w-5" />
                  {amh.courseStart}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Certificate Verification Section */}
        <section id="verify-section" className="mt-12">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-8 w-8 text-emerald-600" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {amh.verifySectionTitle}
                  </h2>
                </div>
                <p className="text-slate-600 dark:text-slate-300">{amh.verifyDescription}</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder={amh.certificateCodeLabel}
                    value={certificateCode}
                    onChange={(e) => {
                      setCertificateCode(e.target.value);
                      setVerificationResult(null);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    onClick={handleVerify}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
                  >
                    {amh.verifyButton}
                  </button>
                </div>
                {verificationResult === 'valid' && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                    <CheckCircle2 className="h-5 w-5" /> ትክክለኛ ሰርተፊኬት ነው።
                  </div>
                )}
                {verificationResult === 'invalid' && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium">
                    <X className="h-5 w-5" /> የተሳሳተ ወይም የሌለ ሰርተፊኬት ነው።
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center justify-center">
                <div className="bg-slate-100 dark:bg-slate-700 p-6 rounded-xl">
                  <QrCode className="h-24 w-24 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation Bar (Mobile only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-lg">
        <div className="flex items-center justify-around py-2">
          <Link
            href="/dashboard"
            className="flex flex-col items-center justify-center py-1 px-3 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <Home className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{amh.dashboard}</span>
          </Link>
          <Link
            href="/courses"
            className="flex flex-col items-center justify-center py-1 px-3 text-emerald-600 dark:text-emerald-400 font-bold"
          >
            <BookOpen className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{amh.courses}</span>
          </Link>
          <button
            onClick={scrollToVerify}
            className="flex flex-col items-center justify-center py-1 px-3 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <Award className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{amh.certificates}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}