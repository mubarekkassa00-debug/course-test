'use client';

// app/page.tsx
import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Mic,
  Library,
  GraduationCap,
  Award,
  Smartphone,
  Clock,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  Send,
  Menu,
  ArrowRight,
  PlayCircle,
  ShieldCheck,
  Globe,
  Quote,
  Users,
  BookMarked,
  Mail,
  MessageCircle,
  ChevronDown,
  HelpCircle,
  LogIn,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Translations — English / Amharic
// ---------------------------------------------------------------------------

type Lang = 'en' | 'am';

const translations = {
  en: {
    nav: {
      courses: 'Courses',
      quran: 'Quran',
      library: 'Library',
      about: 'About',
    },
    header: {
      signIn: 'Sign In',
      register: 'Register',
      menu: 'Menu',
    },
    hero: {
      badge: 'Trusted Islamic Learning Platform',
      titlePart1: 'Draw closer to Allah through the light of knowledge',
      titlePart2: 'with Basira',
      subtitle:
        'Following the Prophet’s ﷺ prayer — “My Lord, increase me in knowledge” — Basira delivers the authentic knowledge of the Quran and Sunnah with excellence, wisdom, and love to every Muslim home.',
      getStarted: 'Get Started',
      exploreCourses: 'Explore Courses',
      noCreditCard: 'No credit card required',
      verifiedCertificates: 'Verified certificates',
      aqeedah: 'Aqeedah',
      coursesCount: '4 Courses',
      books: 'Books',
      lessons: 'Lessons',
      certified: 'Certified',
      tajweedPractice: 'Tajweed Practice',
      audioGuided: 'Audio-guided lessons',
    },
    scripture: {
      badge: 'Quran & Hadith Evidence',
      title: 'The Station of Knowledge in Islam',
      subtitle:
        'Knowledge holds one of the highest stations of worship in Islam. It is the path that draws us closer to Allah, illuminates the heart, and instills within us a deep reverence for our Lord.',
      quranLabel: 'Quran',
      quranArabic: 'وَقُل رَّبِّ زِدْنِي عِلْمًا',
      quranTranslation:
        '“And say: My Lord, increase me in knowledge.”',
      quranSource: '— Surah Taha: 114',
      hadithLabel: 'Hadith',
      hadithArabic:
        'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ',
      hadithTranslation:
        '“Whoever treads a path in search of knowledge, Allah will make easy for him the path to Paradise.”',
      hadithSource: '— Sahih Muslim',
    },
    features: {
      badge: 'Everything You Need',
      title: 'One platform. Complete Islamic learning.',
      subtitle:
        'From the Quran to classical texts and verified certificates, Basira gives you the tools to grow in knowledge — anywhere, anytime, for the sake of Allah.',
      items: [
        {
          title: 'Authentic Quran & Tajweed',
          description:
            'Structured Hifz paths and Tajweed lessons guided by qualified reciters — practice, review, and perfect your recitation.',
        },
        {
          title: 'Digital Islamic Library',
          description:
            'A curated collection of classical texts, PDFs, and references covering Aqeedah, Fiqh, Hadith, Seerah, and more.',
        },
        {
          title: 'Interactive Lessons',
          description:
            'Bite-sized video lessons and quizzes from trusted scholars — learn at your own pace, on any device, whenever it suits you.',
        },
        {
          title: 'Verified QR-Code Certificates',
          description:
            'Finish each course and earn shareable, QR-coded certificates — verifiable and ready for your portfolio.',
        },
      ],
    },
    stats: {
      badge: 'Our Impact',
      title: 'Growth that speaks in numbers',
      subtitle:
        'Every number represents a student, a lesson, and a heart drawing closer to Allah through knowledge.',
      items: [
        { value: '4', label: 'Core Courses' },
        { value: '5,000+', label: 'Students' },
        { value: '45+', label: 'Books & Lessons' },
        { value: '1,200+', label: 'Verified Certificates' },
      ],
    },
    faq: {
      badge: 'Frequently Asked Questions',
      title: 'Everything you might want to know',
      subtitle:
        'Have a question before you begin? Here are the answers to the questions students ask us most often.',
      items: [
        {
          question: 'What is the course fee?',
          answer:
            'To ensure high quality and platform maintenance, our courses are offered at a very nominal and affordable fee of only 200 ETB. This includes lifetime access to learning materials and a verified certificate.',
        },
        {
          question: 'Can I study using my mobile phone?',
          answer:
            'Yes! The platform is fully responsive and optimized for mobile phones, tablets, and desktop computers — so you can learn from any device, wherever you are.',
        },
        {
          question: 'Will I receive a completion certificate?',
          answer:
            'Yes! Upon completing the course and assessments, you will receive an official QR-code verified digital certificate — shareable and ready for your portfolio.',
        },
        {
          question: 'How do I pay and start learning?',
          answer:
            'Simply click the "Get Started" button or join our Telegram channel to complete the easy payment process and start learning immediately.',
        },
      ],
    },
    cta: {
      badge: 'Start Today',
      title: 'Begin your journey on the path of knowledge — the path to Paradise',
      subtitle:
        'Take your first step on this blessed journey. Create your free account and unlock structured courses, interactive quizzes, and a digital library. May every step draw you closer to Jannah.',
      joinNow: 'Join Now',
      signIn: 'Sign In',
    },
    footer: {
      description:
        'A modern Islamic learning platform — bringing authentic knowledge, verified progress, and structured courses to students everywhere, for the sake of Allah.',
      platform: 'Platform',
      account: 'Account',
      platformLinks: [
        { href: '/courses', label: 'Courses' },
        { href: '/quran', label: 'Quran Center' },
        { href: '/library', label: 'Digital Library' },
        { href: '/about', label: 'About Basira' },
      ],
      accountLinks: [
        { href: '/login', label: 'Sign In' },
        { href: '/register', label: 'Create Account' },
        { href: '/about', label: 'About Basira' },
        { href: '/contact', label: 'Contact' },
      ],
      copyright: '© {year} Basira · ባሲራ. All rights reserved.',
      privacy: 'Privacy',
      terms: 'Terms',
      telegram: 'Telegram',
    },
  },
  am: {
    nav: {
      courses: 'ኮርሶች',
      quran: 'ቁርአን',
      library: 'ቤተ መጻሕፍት',
      about: 'ስለ እኛ',
    },
    header: {
      signIn: 'ይግቡ',
      register: 'ይመዝገቡ',
      menu: 'ዝርዝር',
    },
    hero: {
      badge: 'የታመነ የኢስላማዊ ትምህርት መድረክ',
      titlePart1: 'በእውቀት ብርሃን ወደ አላህ ይቅረቡ',
      titlePart2: 'ከባሲራ ጋር',
      subtitle:
        '«ጌታዬ ሆይ! እውቀትን ጨምርልኝ» የሚለውን የነቢዩን (ሰ.ዐ.ወ) ጸሎት በመከተል፣ ባሲራ ትክክለኛውን የቁርአንና የሱና እውቀት በጥራት፣ በጥበብና በፍቅር ወደ እያንዳንዱ ሙስሊም ቤት ያደርሳል።',
      getStarted: 'ይጀምሩ',
      exploreCourses: 'ኮርሶችን ያስሱ',
      noCreditCard: 'ክሬዲት ካርድ አያስፈልግም',
      verifiedCertificates: 'የተረጋገጡ ሰርተፊኬቶች',
      aqeedah: 'አቂዳ',
      coursesCount: '4 ኮርሶች',
      books: 'መጻሕፍት',
      lessons: 'ትምህርቶች',
      certified: 'የተመሰከረ',
      tajweedPractice: 'የተጅዊድ ልምምድ',
      audioGuided: 'በድምጽ የሚመሩ ትምህርቶች',
    },
    scripture: {
      badge: 'የቁርአንና የሐዲስ ማስረጃ',
      title: 'የእውቀት ደረጃ በኢስላም',
      subtitle:
        'እውቀት በኢስላም ከፍተኛ ደረጃ የተሰጠው አምልኮ ነው። ወደ አላህ የሚያቀርብ፣ ልብን የሚያበራና እርሱን እንድንፈራ የሚያደርግ መንገድ ነው።',
      quranLabel: 'ቁርአን',
      quranArabic: 'وَقُل رَّبِّ زِدْنِي عِلْمًا',
      quranTranslation:
        '«በልም፡- ጌታዬ ሆይ! እውቀትን ጨምርልኝ።»',
      quranSource: '— ሱረቱ ጣሃ፡ 114',
      hadithLabel: 'ሐዲስ',
      hadithArabic:
        'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ',
      hadithTranslation:
        '«እውቀትን ፍለጋ መንገድን የጀመረ ሰው አላህ ወደ ጀነት የሚወስደውን መንገድ ያገራለታል።»',
      hadithSource: '— ሶሒሕ ሙስሊም',
    },
    features: {
      badge: 'የሚያገኙት ሁሉ',
      title: 'አንድ መድረክ። ሙሉ የኢስላማዊ ትምህርት።',
      subtitle:
        'ከቁርአን እስከ ጥንታዊ ጽሑፎችና የተረጋገጡ ሰርተፊኬቶች ድረስ፣ ባሲራ ለአላህ ፈቃድ በእውቀት ለማደግ የሚያስፈልጉ መሳሪያዎችን ይሰጥዎታል — በየትኛውም ቦታ፣ በየትኛውም ጊዜ።',
      items: [
        {
          title: 'ትክክለኛ ቁርአንና ተጅዊድ',
          description:
            'በብቁ ቀራኦች የሚመሩ የተዋቀሩ የሒፍዝ መስመሮችና የተጅዊድ ትምህርቶች — ይለማመዱ፣ ይገምግሙ እና ንባብዎን ያሟሉ።',
        },
        {
          title: 'ዲጂታል የኢስላማዊ ቤተ መጻሕፍት',
          description:
            'አቂዳን፣ ፊቅህን፣ ሐዲስን፣ ሲራን እና ሌሎችንም የሚሸፍን የተመረጠ የጥንታዊ ጽሑፎች፣ ፒዲኤፎችና ማጣቀሻዎች ስብስብ።',
        },
        {
          title: 'በይነተገናኝ ትምህርቶች',
          description:
            'ከታመኑ ሊቃውንት የተገኙ አጫጭር የቪዲዮ ትምህርቶችና ፈተናዎች — በራስዎ ፍጥነት፣ በየትኛውም መሳሪያ፣ በሚስማማዎት ጊዜ ይማሩ።',
        },
        {
          title: 'በQR ኮድ የተረጋገጡ ሰርተፊኬቶች',
          description:
            'እያንዳንዱን ኮርስ ጨርሰው ሊጋሩ የሚችሉ፣ በQR ኮድ የተደገፉና ሊረጋገጡ የሚችሉ ሰርተፊኬቶችን ያግኙ።',
        },
      ],
    },
    stats: {
      badge: 'የባሲራ ተጽዕኖ',
      title: 'በቁጥር የሚታይ እድገት',
      subtitle:
        'እያንዳንዱ ቁጥር አንድ ተማሪን፣ አንድ ትምህርትንና በእውቀት ወደ አላህ የሚቀርብን አንድ ልብን ይወክላል።',
      items: [
        { value: '4', label: 'ዋና ኮርሶች' },
        { value: '5,000+', label: 'ተማሪዎች' },
        { value: '45+', label: 'መጻሕፍትና ትምህርቶች' },
        { value: '1,200+', label: 'የተረጋገጡ ሰርተፊኬቶች' },
      ],
    },
    faq: {
      badge: 'ተደጋጋሚ ጥያቄዎች',
      title: 'ሊጠይቁት የሚፈልጉትን ሁሉ እዚህ ያግኙ',
      subtitle:
        'ከመጀመርዎ በፊት ጥያቄ አለዎት? ተማሪዎቻችን በብዛት የሚጠይቁንን ጥያቄዎች መልስ እዚህ አቅርበናል።',
      items: [
        {
          question: 'የትምህርቱ ክፍያ ስንት ነው?',
          answer:
            'የባሲራ ትምህርቶች ከፍተኛ ጥራት ያላቸው ሆኖ ሳለ፣ የፕላትፎርሙን የቴክኖሎጂ ጥገናና ቀጣይነት ያለው አገልግሎት ለማስቀጠል ሲባል በጣም አነስተኛ እና ምቹ በሆነ የ 200 ብር ብቻ ክፍያ የቀረበ ነው። ይህ ክፍያ ሙሉ የትምህርት ቁሳቁሶችን እና የማጠናቀቂያ ሰርቲፊኬትን ያካትታል።',
        },
        {
          question: 'በስልክ መከታተል ይቻላል?',
          answer:
            'አዎ! ዌብሳይቱ ለሞባይል፣ ለታብሌትና ለኮምፒውተር በጣም ምቹ ሆኖ የተሰራ በመሆኑ በማንኛውም መሳሪያ ቦታ ሳይመርጡ መከታተል ይችላሉ።',
        },
        {
          question: 'የትምህርት ማጠናቀቂያ ሰርቲፊኬት ይሰጣል?',
          answer:
            'አዎ! ኮርሶቹን አጠናቀው የትምህርት ምዘናዎችን ሲያልፉ በ QR-Code የተረጋገጠ ኦፊሴላዊ የዲጂታል ሰርቲፊኬት ይደርስዎታል።',
        },
        {
          question: 'ክፍያውን እንዴት ፈጽሜ መማር መጀመር እችላለሁ?',
          answer:
            '«አሁኑኑ ይጀምሩ» የሚለውን በተን በመጫን ወይም የቴሌግራም ቻናላችንን በመቀላቀል በቀላል የባንክ አማራጮች ክፍያውን ፈጽመው ወዲያውኑ መማር መጀመር ይችላሉ።',
        },
      ],
    },
    cta: {
      badge: 'ዛሬ ይጀምሩ',
      title: 'የጀነት መንገድ በሆነው እውቀት ጉዞዎን ዛሬ ይጀምሩ',
      subtitle:
        'በዚህ በረከት የተሞላ ጉዞ ላይ እርምጃዎን ይጀምሩ። ነጻ አካውንትዎን ይፍጠሩና የተዋቀሩ ኮርሶችን፣ በይነተገናኝ ፈተናዎችንና ዲጂታል ቤተ መጻሕፍትን ይክፈቱ። እያንዳንዱ እርምጃዎ ወደ ጀነት ያቅርብዎ።',
      joinNow: 'አሁን ይቀላቀሉ',
      signIn: 'ይግቡ',
    },
    footer: {
      description:
        'ዘመናዊ የኢስላማዊ ትምህርት መድረክ — ትክክለኛ እውቀትን፣ የተረጋገጠ እድገትንና የተዋቀሩ ኮርሶችን ለሁሉም ተማሪዎች ለአላህ ፈቃድ ያደርሳል።',
      platform: 'መድረክ',
      account: 'አካውንት',
      platformLinks: [
        { href: '/courses', label: 'ኮርሶች' },
        { href: '/quran', label: 'የቁርአን ማዕከል' },
        { href: '/library', label: 'ዲጂታል ቤተ መጻሕፍት' },
        { href: '/about', label: 'ስለ ባሲራ' },
      ],
      accountLinks: [
        { href: '/login', label: 'ይግቡ' },
        { href: '/register', label: 'አካውንት ይፍጠሩ' },
        { href: '/about', label: 'ስለ ባሲራ' },
        { href: '/contact', label: 'አግኙን' },
      ],
      copyright: '© {year} ባሲራ · Basira. መብቱ በህግ የተጠበቀ ነው።',
      privacy: 'ግላዊነት',
      terms: 'ውሎች',
      telegram: 'ቴሌግራም',
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Icon-only data (language-independent)
// ---------------------------------------------------------------------------

const FEATURE_ICONS = [
  { icon: BookOpen, accent: 'from-emerald-500 to-emerald-700' },
  { icon: Library, accent: 'from-amber-500 to-amber-700' },
  { icon: BookMarked, accent: 'from-blue-500 to-blue-700' },
  { icon: Award, accent: 'from-purple-500 to-purple-700' },
];

const STAT_ICONS = [
  { icon: BookOpen, accent: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  { icon: Users, accent: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  { icon: Library, accent: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40' },
  { icon: ShieldCheck, accent: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40' },
];

const SOCIALS = [
  { icon: Send, href: 'https://t.me/Basira_on', label: 'Telegram' },
  { icon: Mail, href: 'mailto:info@basira.et', label: 'Email' },
  { icon: MessageCircle, href: '#', label: 'Chat' },
  { icon: Globe, href: '#', label: 'Website' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('am');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const t = translations[lang];

  const toggleLang = () => setLang((prev) => (prev === 'en' ? 'am' : 'en'));

  const toggleFaq = (index: number) =>
    setOpenFaq((prev) => (prev === index ? null : index));

  const navLinks = [
    { href: '/courses', label: t.nav.courses },
    { href: '/quran', label: t.nav.quran },
    { href: '/library', label: t.nav.library },
    { href: '/about', label: t.nav.about },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* =================================================================== */}
      {/* NAVIGATION HEADER                                                    */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Brand */}
            <Link
              href="/"
              className="flex items-center gap-2.5 flex-shrink-0"
              aria-label="Basira home"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/20">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div className="leading-tight">
                <p className="text-base font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 to-emerald-800 dark:from-emerald-300 dark:to-emerald-500 bg-clip-text text-transparent">
                  ባሲራ
                </p>
                <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Basira
                </p>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-2">
              <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  aria-pressed={lang === 'en'}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    lang === 'en'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang('am')}
                  aria-pressed={lang === 'am'}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    lang === 'am'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  አማርኛ
                </button>
              </div>

              {/* Sign In → /login */}
              <Link
                href="/login"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t.header.signIn}
              </Link>

              {/* Register → /register */}
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 hover:from-emerald-500 hover:to-emerald-600 transition-all"
              >
                {t.header.register}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Mobile actions */}
            <div className="md:hidden flex items-center gap-2">
              {/* Language toggle (mobile) */}
              <button
                type="button"
                onClick={toggleLang}
                aria-label="Toggle language"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                {lang === 'en' ? 'አማርኛ' : 'EN'}
              </button>

              {/* Sign In (mobile, icon-only) → /login */}
              <Link
                href="/login"
                aria-label={t.header.signIn}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <LogIn className="h-4 w-4" />
              </Link>

              {/* Register (mobile) → /register */}
              <Link
                href="/register"
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {t.header.register}
              </Link>

              <button
                type="button"
                aria-label={t.header.menu}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* HERO SECTION                                                         */}
      {/* =================================================================== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-emerald-950/40 dark:via-slate-950 dark:to-amber-950/30" />
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-emerald-300/30 dark:bg-emerald-700/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-amber-300/30 dark:bg-amber-700/20 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                {t.hero.badge}
              </div>

              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                {t.hero.titlePart1}{' '}
                <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-amber-500 dark:from-emerald-400 dark:via-emerald-500 dark:to-amber-400 bg-clip-text text-transparent">
                  {t.hero.titlePart2}
                </span>
              </h1>

              <p className="mt-5 text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
                {t.hero.subtitle}
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                {/* Get Started → /register */}
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-900/20 hover:from-emerald-500 hover:to-emerald-600 transition-all"
                >
                  {t.hero.getStarted}
                  <ArrowRight className="h-4 w-4" />
                </Link>

                {/* Explore Courses → /courses */}
                <Link
                  href="/courses"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-6 py-3.5 text-base font-bold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-900 transition-colors"
                >
                  <PlayCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {t.hero.exploreCourses}
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 justify-center lg:justify-start text-sm text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {t.hero.noCreditCard}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  {t.hero.verifiedCertificates}
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="relative mx-auto max-w-md">
                <div className="relative rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6 shadow-2xl shadow-emerald-950/10">
                  <div className="relative h-56 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900">
                    <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="h-20 w-20 text-emerald-100/90" />
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2">
                      <span className="rounded-full bg-white/20 backdrop-blur px-2.5 py-0.5 text-xs font-semibold text-white">
                        {t.hero.aqeedah}
                      </span>
                      <span className="rounded-full bg-amber-400/90 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                        {t.hero.coursesCount}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-center">
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                        4
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">
                        {t.hero.books}
                      </p>
                    </div>
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-center">
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                        +45
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">
                        {t.hero.lessons}
                      </p>
                    </div>
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-center">
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                        ✓
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700/80 dark:text-blue-300/80">
                        {t.hero.certified}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-6 -left-6 hidden sm:block rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-4 py-3 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
                      <Mic className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">
                        {t.hero.tajweedPractice}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t.hero.audioGuided}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* QURAN & HADITH SCRIPTURE BANNER                                     */}
      {/* =================================================================== */}
      <section className="pb-16 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-8 sm:p-12 lg:p-14 shadow-2xl shadow-emerald-950/40">
            <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

            <div className="relative max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 backdrop-blur px-3 py-1 text-xs font-semibold text-amber-300">
                <BookOpen className="h-3.5 w-3.5" />
                {t.scripture.badge}
              </div>

              <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {t.scripture.title}
              </h2>
              <p className="mt-4 text-emerald-100/80 leading-relaxed max-w-2xl mx-auto">
                {t.scripture.subtitle}
              </p>

              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                <div className="relative rounded-2xl border border-amber-400/20 bg-white/5 backdrop-blur p-6 text-left">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20">
                      <Quote className="h-4 w-4 text-amber-300" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                      {t.scripture.quranLabel}
                    </span>
                  </div>

                  <p
                    dir="rtl"
                    lang="ar"
                    className="text-xl sm:text-2xl leading-loose text-amber-200 font-serif text-right"
                  >
                    {t.scripture.quranArabic}
                  </p>

                  <div className="mt-5 pt-5 border-t border-white/10">
                    <p className="text-sm sm:text-base text-white leading-relaxed italic">
                      {t.scripture.quranTranslation}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-emerald-300/80">
                      {t.scripture.quranSource}
                    </p>
                  </div>
                </div>

                <div className="relative rounded-2xl border border-emerald-400/20 bg-white/5 backdrop-blur p-6 text-left">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/20">
                      <Quote className="h-4 w-4 text-emerald-300" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                      {t.scripture.hadithLabel}
                    </span>
                  </div>

                  <p
                    dir="rtl"
                    lang="ar"
                    className="text-base sm:text-lg leading-loose text-emerald-100 font-serif text-right"
                  >
                    {t.scripture.hadithArabic}
                  </p>

                  <div className="mt-5 pt-5 border-t border-white/10">
                    <p className="text-sm sm:text-base text-white leading-relaxed italic">
                      {t.scripture.hadithTranslation}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-amber-300/80">
                      {t.scripture.hadithSource}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* CORE FEATURES                                                        */}
      {/* =================================================================== */}
      <section className="py-20 sm:py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              {t.features.badge}
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
              {t.features.title}
            </h2>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.features.subtitle}
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.features.items.map((feature, index) => {
              const Icon = FEATURE_ICONS[index].icon;
              const accent = FEATURE_ICONS[index].accent;
              return (
                <div
                  key={feature.title}
                  className="group relative rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} shadow-md shadow-slate-900/10`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* PLATFORM STATS / IMPACT                                             */}
      {/* =================================================================== */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <TrendingUp className="h-3.5 w-3.5" />
              {t.stats.badge}
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
              {t.stats.title}
            </h2>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.stats.subtitle}
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {t.stats.items.map((stat, index) => {
              const Icon = STAT_ICONS[index].icon;
              const accent = STAT_ICONS[index].accent;
              const bg = STAT_ICONS[index].bg;
              return (
                <div
                  key={stat.label}
                  className="relative rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center"
                >
                  <div
                    className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${bg}`}
                  >
                    <Icon className={`h-6 w-6 ${accent}`} />
                  </div>
                  <p className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* FAQ — FREQUENTLY ASKED QUESTIONS                                    */}
      {/* =================================================================== */}
      <section className="py-20 sm:py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <HelpCircle className="h-3.5 w-3.5" />
              {t.faq.badge}
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
              {t.faq.title}
            </h2>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.faq.subtitle}
            </p>
          </div>

          {/* Accordion */}
          <div className="mt-14 max-w-3xl mx-auto space-y-3">
            {t.faq.items.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={item.question}
                  className={`group rounded-2xl border transition-all duration-300 overflow-hidden ${
                    isOpen
                      ? 'border-emerald-400/60 dark:border-emerald-600/60 bg-white dark:bg-slate-900 shadow-lg shadow-emerald-950/10'
                      : 'border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-emerald-300/60 dark:hover:border-emerald-700/60 hover:shadow-md'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 sm:px-6 py-5 text-left"
                  >
                    <span
                      className={`text-base sm:text-lg font-bold leading-snug transition-colors ${
                        isOpen
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {item.question}
                    </span>

                    <span
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                        isOpen
                          ? 'bg-emerald-600 text-white rotate-180'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      <ChevronDown className="h-5 w-5" />
                    </span>
                  </button>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                        <div className="border-t border-slate-200/80 dark:border-slate-800/80 pt-4">
                          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* INSPIRING CTA BANNER                                                */}
      {/* =================================================================== */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 px-6 sm:px-12 py-14 sm:py-16 text-center shadow-2xl shadow-emerald-950/30">
            <div className="absolute -top-32 -left-32 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />

            <div className="relative max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur border border-white/20 px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                {t.cta.badge}
              </div>
              <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {t.cta.title}
              </h2>
              <p className="mt-4 text-emerald-50/90 leading-relaxed">
                {t.cta.subtitle}
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                {/* Join Now → /register */}
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-bold text-emerald-800 shadow-lg hover:bg-emerald-50 transition-colors"
                >
                  {t.cta.joinNow}
                  <ArrowRight className="h-4 w-4" />
                </Link>

                {/* Sign In → /login */}
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 backdrop-blur px-6 py-3.5 text-base font-bold text-white hover:bg-white/20 transition-colors"
                >
                  {t.cta.signIn}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* MODERN FOOTER                                                        */}
      {/* =================================================================== */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="lg:col-span-2">
              <Link href="/" className="inline-flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div className="leading-tight">
                  <p className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                    ባሲራ
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Basira
                  </p>
                </div>
              </Link>
              <p className="mt-4 max-w-md text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.footer.description}
              </p>

              <div className="mt-6 flex items-center gap-2">
                {SOCIALS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <a
                      key={s.label}
                      href={s.href}
                      aria-label={s.label}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-700 transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                {t.footer.platform}
              </h4>
              <ul className="mt-4 space-y-2">
                {t.footer.platformLinks.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                {t.footer.account}
              </h4>
              <ul className="mt-4 space-y-2">
                {t.footer.accountLinks.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.footer.copyright.replace(
                '{year}',
                String(new Date().getFullYear())
              )}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Link
                href="/privacy"
                className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
              >
                {t.footer.privacy}
              </Link>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <Link
                href="/terms"
                className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
              >
                {t.footer.terms}
              </Link>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <a
                href="https://t.me/Basira_on"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
              >
                <Send className="h-3 w-3" />
                {t.footer.telegram}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}