'use client';

// app/about/page.tsx
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Globe,
  BookOpen,
  Target,
  Award,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Heart,
  Users,
  ShieldCheck,
  Quote,
  HandHeart,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Translations — Amharic (default) / English
// ---------------------------------------------------------------------------

type Lang = 'am' | 'en';

const translations = {
  am: {
    header: {
      back: 'ወደ መነሻ ገጽ',
      langToggle: 'EN',
    },
    hero: {
      badge: 'ስለ ባሲራ',
      title: 'ባሲራ — የብርሃንና የእውቀት ማዕከል',
      subtitle:
        'እውቀት ብርሃን ነው፤ ልብን የሚያበራ፣ መንገድን የሚያቀርብና ባሪያን ወደ ጌታው የሚያቀርብ የሱና ሀብት ነው። ባሲራ ይህን ብርሃን ለእያንዳንዱ ሙስሊም ቤት በጥራት፣ በጥበብና በፍቅር ለማድረስ የተቋቋመ የመስመር ላይ መድረክ ነው።',
      backHome: 'ወደ መነሻ ገጽ ይመለሱ',
      register: 'ይመዝገቡ',
    },
    quranBox: {
      badge: 'የቁርአንና የሐዲስ ማስረጃ',
      title: 'የእውቀት ቦታ በኢስላም ውስጥ',
      subtitle:
        'እውቀት በኢስላም ከፍተኛ ደረጃ የተሰጠው አምልኮ ነው። ሁለንተናችንን ወደ አላህ የሚያቀርብ፣ ልባችንን የሚያበራና እርሱን እንድንፈራ የሚያደርግ መንገድ ነው።',
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
    mission: {
      badge: 'ተልዕኮአችን',
      title: 'ተልዕኮ',
      description:
        'ትክክለኛውን የቁርአንና የሱና እውቀት በጥራት፣ በጥበብና በዘመናዊ የቴክኖሎጂ አቀራረብ እያንዳንዱ ሙስሊም ቤት ማድረስ።',
      quote: '«የተጠራጠሩትን ጠይቁ የእውቀት ሰዎችን»',
    },
    vision: {
      badge: 'ራዕያችን',
      title: 'ራዕይ',
      description:
        'በአላህ ፈቃድ፣ በትክክለኛ እውቀትና መልካም ሥነ-ምግባር የታነጸ፣ አላህን የሚፈራና ኡማውን የሚያገለግል ዲጂታል የማህበረሰብ ማዕከል መሆን።',
      quote: '«አላህ ከእናንተ ውስጥ ያመኑትንና እውቀት የተሰጡትን ደረጃ ከፍ ያደርጋል»',
    },
    values: {
      badge: 'የእኛ እሴቶች',
      title: 'በእነዚህ ዘላለማዊ እሴቶች ላይ ተመስርተናል',
      subtitle:
        'ባሲራ በቁርአንና በሱና መሠረት የተገነቡ ጽኑ እሴቶችን ተሸክሞ ይጓዛል — እያንዳንዱ ትምህርት፣ እያንዳንዱ ግንኙነትና እያንዳንዱ ጥረታችን እነዚህን መርሆች ያካትታል።',
      items: [
        {
          title: 'ኢክላስ',
          subtitle: 'ቅን ልቦና',
          description:
            'እውቀትን ለአላህ ፈቃድ ብቻ ለማስተማርና ለመማር እንተጋለን። ሥራችን ሁሉ ለአላህ ፊት የሚደረግ ቅን አምልኮ ነው — ከሰው ዘንድ ውዳሴ ሳንፈልግ፣ የጌታን ውዴታ ብቻ እንሻለን።',
        },
        {
          title: 'ትክክለኛነት',
          subtitle: 'በቁርአንና በሱና ላይ የተመሠረተ',
          description:
            'እያንዳንዱ ትምህርታችን ከታመኑ ሊቃውንትና ከጥንታዊ ምንጮች የተገኘ ነው። ከቁርአንና ከሱና ውጪ የሆነ ነገር አናስተምርም — የነቢዩ (ሰ.ዐ.ወ) ዱካ ብቻ ይከተላል።',
        },
        {
          title: 'እህሳን',
          subtitle: 'ላቀ ጥራት',
          description:
            '«አላህ ሁሉንም ነገር በእህሳን እንድትሠሩ አዘዘ» — በዚህ መሠረት፣ በእያንዳንዱ ዝርዝር ላይ ላቀ ጥራትንና ምርጥነትን እናሳያለን። አላህ እያየን እንደሆነ እያወቅን እንሠራለን።',
        },
        {
          title: 'ሶብር',
          subtitle: 'ጽናትና ትዕግስት',
          description:
            '«አላህ ከታጋሾች ጋር ነው» — የእውቀት ጉዞ ረጅምና ፈታኝ ነው። በዚህ መንገድ ላይ ጽናትን፣ ትዕግስትንና የማያቋርጥ ጥረትን እንለማመዳለን።',
        },
      ],
    },
    features: {
      badge: 'የባሲራ ጠቀሜታዎች',
      title: 'ባሲራን ለምን ይመርጣሉ?',
      subtitle:
        'ለዘመናዊ ተማሪዎች የተነደፉ ጠንካራ ባህሪያት — ትክክለኛ እውቀትን በቀላሉ፣ በራስዎ ፍጥነትና በየትኛውም ቦታ ማግኘት እንዲችሉ።',
      items: [
        {
          title: 'ታመኑ ሊቃውንት',
          description:
            'ትምህርቶቻችን ከታመኑ ሊቃውንትና ከጥንታዊ ምንጮች የተገኙ ናቸው — እያንዳንዱ ትምህርት ለትክክለኛነቱ ተረጋግጧል።',
        },
        {
          title: 'በራስ ፍጥነት መማር',
          description:
            'የጊዜ ገደብ የለም፣ ጫና የለም። በራስዎ መርሐግብር ያጠኑ እና ካቆሙበት በትክክል ይቀጥሉ።',
        },
        {
          title: 'ዲጂታል የኢስላማዊ ቤተ መጻሕፍት',
          description:
            'የተመረጡ ጥንታዊ ጽሑፎች፣ ፒዲኤፎችና ማጣቀሻዎች — በአንድ ቦታ ተሰብስበው ለጥናትዎ ዝግጁ ናቸው።',
        },
        {
          title: 'የተረጋገጡ ሰርተፊኬቶች',
          description:
            'እያንዳንዱን ኮርስ ጨርሰው ሊጋሩ የሚችሉ፣ በQR ኮድ የተደገፉና ሊረጋገጡ የሚችሉ ሰርተፊኬቶችን ያግኙ።',
        },
      ],
    },
    cta: {
      badge: 'ዛሬ ይጀምሩ',
      title: 'የጀነት መንገድ በሆነው እውቀት ጉዞዎን ዛሬ ይጀምሩ',
      subtitle:
        'ነጻ አካውንትዎን ይፍጠሩና የተዋቀሩ ኮርሶችን፣ በይነተገናኝ ፈተናዎችንና ዲጂታል ቤተ መጻሕፍትን ይክፈቱ — ሁሉም በአንድ ቦታ። እያንዳንዱ የሚረግጡት እርምጃ ወደ ጀነት የሚያቀርብ መንገድ ይሁን።',
      register: 'ይመዝገቡ',
      backHome: 'ወደ መነሻ ገጽ',
    },
    footer: {
      tagline: 'የብርሃንና የእውቀት ማዕከል',
      rights: 'መብቱ በህግ የተጠበቀ ነው።',
      backHome: 'ወደ መነሻ ገጽ',
      register: 'ይመዝገቡ',
    },
  },
  en: {
    header: {
      back: 'Back to Home',
      langToggle: 'አማርኛ',
    },
    hero: {
      badge: 'About Basira',
      title: 'Basira — A Center of Light and Knowledge',
      subtitle:
        'Knowledge is light — it illuminates the heart, straightens the path, and draws the servant closer to his Lord. Basira is an online platform established to deliver this light to every Muslim home with excellence, wisdom, and love.',
      backHome: 'Back to Home',
      register: 'Register',
    },
    quranBox: {
      badge: 'Quran & Hadith Evidence',
      title: 'The Station of Knowledge in Islam',
      subtitle:
        'Knowledge holds one of the highest stations of worship in Islam. It is the path that brings us closer to Allah, illuminates our hearts, and instills within us a deep reverence for our Lord.',
      quranLabel: 'Quran',
      quranArabic: 'وَقُل رَّبِّ زِدْنِي عِلْمًا',
      quranTranslation:
        '"And say: My Lord, increase me in knowledge."',
      quranSource: '— Surah Taha: 114',
      hadithLabel: 'Hadith',
      hadithArabic:
        'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ',
      hadithTranslation:
        '"Whoever treads a path in search of knowledge, Allah will make easy for him the path to Paradise."',
      hadithSource: '— Sahih Muslim',
    },
    mission: {
      badge: 'Our Mission',
      title: 'Mission',
      description:
        'To deliver the authentic knowledge of the Quran and Sunnah — with excellence, wisdom, and a modern technological approach — to every Muslim home.',
      quote: '"Ask the people of knowledge if you do not know."',
    },
    vision: {
      badge: 'Our Vision',
      title: 'Vision',
      description:
        'By Allah’s will, to become a digital community center built upon authentic knowledge and noble character — one that fears Allah and serves the Ummah.',
      quote: '"Allah will raise those who believe among you and those who were given knowledge, by degrees."',
    },
    values: {
      badge: 'Our Core Values',
      title: 'Built upon timeless principles',
      subtitle:
        'Basira carries firm values rooted in the Quran and Sunnah — every lesson, every interaction, and every effort we make embodies these principles.',
      items: [
        {
          title: 'Ikhlas',
          subtitle: 'Sincerity',
          description:
            'We strive to teach and learn knowledge solely for the sake of Allah. Every deed we perform is sincere worship offered to Allah alone — seeking His pleasure, not the praise of people.',
        },
        {
          title: 'Authenticity',
          subtitle: 'Grounded in Quran & Sunnah',
          description:
            'Every lesson is drawn from trusted scholars and classical sources. We do not teach anything outside the Quran and Sunnah — we follow only the path of the Prophet ﷺ.',
        },
        {
          title: 'Ihsan',
          subtitle: 'Excellence',
          description:
            '"Allah has prescribed excellence in all things." In that spirit, we pursue the highest quality and mastery in every detail — working as though we see Allah, knowing He sees us.',
        },
        {
          title: 'Sabr',
          subtitle: 'Patience & Perseverance',
          description:
            '"Allah is with the patient." The journey of knowledge is long and demanding. On this path we cultivate steadfastness, patience, and unwavering perseverance.',
        },
      ],
    },
    features: {
      badge: 'Why Basira',
      title: 'Why choose Basira?',
      subtitle:
        'Powerful features designed for the modern student — so you can access authentic knowledge easily, at your own pace, from anywhere.',
      items: [
        {
          title: 'Trusted Scholars',
          description:
            'Our lessons are drawn from trusted scholars and classical sources — every lesson is verified for authenticity.',
        },
        {
          title: 'Self-Paced Learning',
          description:
            'No deadlines, no pressure. Study on your schedule and pick up exactly where you left off.',
        },
        {
          title: 'Digital Islamic Library',
          description:
            'A curated collection of classical texts, PDFs, and references — gathered in one place and ready for your study.',
        },
        {
          title: 'Verified Certificates',
          description:
            'Finish each course and earn shareable, QR-coded, and verifiable certificates.',
        },
      ],
    },
    cta: {
      badge: 'Start Today',
      title: 'Begin your journey on the path of knowledge — the path to Paradise',
      subtitle:
        'Create your free account and unlock structured courses, interactive quizzes, and a digital library — all in one place. May every step you take lead you closer to Jannah.',
      register: 'Register',
      backHome: 'Back to Home',
    },
    footer: {
      tagline: 'A center of light and knowledge',
      rights: 'All rights reserved.',
      backHome: 'Back to Home',
      register: 'Register',
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Icon-only data (language independent)
// ---------------------------------------------------------------------------

const VALUE_ICONS = [
  { icon: Heart, accent: 'from-emerald-500 to-emerald-700' },
  { icon: ShieldCheck, accent: 'from-blue-500 to-blue-700' },
  { icon: Award, accent: 'from-amber-500 to-amber-700' },
  { icon: HandHeart, accent: 'from-purple-500 to-purple-700' },
];

const FEATURE_ICONS = [
  { icon: BookOpen, accent: 'from-emerald-500 to-emerald-700' },
  { icon: Target, accent: 'from-amber-500 to-amber-700' },
  { icon: GraduationCap, accent: 'from-blue-500 to-blue-700' },
  { icon: CheckCircle2, accent: 'from-purple-500 to-purple-700' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AboutPage() {
  const [lang, setLang] = useState<Lang>('am');
  const t = translations[lang];

  const toggleLang = () => setLang((prev) => (prev === 'am' ? 'en' : 'am'));

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* =================================================================== */}
      {/* HEADER                                                              */}
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

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {t.header.back}
              </Link>

              <button
                type="button"
                onClick={toggleLang}
                aria-label="Toggle language"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {t.header.langToggle}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* HERO SECTION                                                        */}
      {/* =================================================================== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-emerald-950/40 dark:via-slate-950 dark:to-amber-950/30" />
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-emerald-300/30 dark:bg-emerald-700/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-amber-300/30 dark:bg-amber-700/20 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              {t.hero.badge}
            </div>

            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              {t.hero.title}
            </h1>

            <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.hero.subtitle}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/auth"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-900/20 hover:from-emerald-500 hover:to-emerald-600 transition-all"
              >
                {t.hero.register}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-6 py-3.5 text-base font-bold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {t.hero.backHome}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* QURAN & HADITH HIGHLIGHT BOX                                        */}
      {/* =================================================================== */}
      <section className="pb-16 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-8 sm:p-12 lg:p-14 shadow-2xl shadow-emerald-950/40">
            {/* Decorative glows */}
            <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

            <div className="relative max-w-4xl mx-auto text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 backdrop-blur px-3 py-1 text-xs font-semibold text-amber-300">
                <BookOpen className="h-3.5 w-3.5" />
                {t.quranBox.badge}
              </div>

              {/* Title */}
              <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {t.quranBox.title}
              </h2>
              <p className="mt-4 text-emerald-100/80 leading-relaxed max-w-2xl mx-auto">
                {t.quranBox.subtitle}
              </p>

              {/* Quran & Hadith grid */}
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                {/* Quran card */}
                <div className="relative rounded-2xl border border-amber-400/20 bg-white/5 backdrop-blur p-6 text-left">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20">
                      <Quote className="h-4 w-4 text-amber-300" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                      {t.quranBox.quranLabel}
                    </span>
                  </div>

                  <p
                    dir="rtl"
                    lang="ar"
                    className="text-xl sm:text-2xl leading-loose text-amber-200 font-serif text-right"
                  >
                    {t.quranBox.quranArabic}
                  </p>

                  <div className="mt-5 pt-5 border-t border-white/10">
                    <p className="text-sm sm:text-base text-white leading-relaxed italic">
                      {t.quranBox.quranTranslation}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-emerald-300/80">
                      {t.quranBox.quranSource}
                    </p>
                  </div>
                </div>

                {/* Hadith card */}
                <div className="relative rounded-2xl border border-emerald-400/20 bg-white/5 backdrop-blur p-6 text-left">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/20">
                      <Quote className="h-4 w-4 text-emerald-300" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                      {t.quranBox.hadithLabel}
                    </span>
                  </div>

                  <p
                    dir="rtl"
                    lang="ar"
                    className="text-base sm:text-lg leading-loose text-emerald-100 font-serif text-right"
                  >
                    {t.quranBox.hadithArabic}
                  </p>

                  <div className="mt-5 pt-5 border-t border-white/10">
                    <p className="text-sm sm:text-base text-white leading-relaxed italic">
                      {t.quranBox.hadithTranslation}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-amber-300/80">
                      {t.quranBox.hadithSource}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* MISSION & VISION                                                    */}
      {/* =================================================================== */}
      <section className="py-16 sm:py-20 bg-slate-50 dark:bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {/* Mission card */}
            <div className="relative rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-100/60 dark:bg-emerald-900/30 blur-3xl" />
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md shadow-emerald-900/20">
                  <Target className="h-7 w-7 text-white" />
                </div>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {t.mission.badge}
                </div>
                <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {t.mission.title}
                </h2>
                <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t.mission.description}
                </p>
                <p className="mt-6 border-l-4 border-emerald-500 pl-4 text-sm italic text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t.mission.quote}
                </p>
              </div>
            </div>

            {/* Vision card */}
            <div className="relative rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-100/60 dark:bg-amber-900/30 blur-3xl" />
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-md shadow-amber-900/20">
                  <Heart className="h-7 w-7 text-white" />
                </div>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {t.vision.badge}
                </div>
                <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {t.vision.title}
                </h2>
                <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t.vision.description}
                </p>
                <p className="mt-6 border-l-4 border-amber-500 pl-4 text-sm italic text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t.vision.quote}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* CORE VALUES                                                         */}
      {/* =================================================================== */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              {t.values.badge}
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
              {t.values.title}
            </h2>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.values.subtitle}
            </p>
          </div>

          {/* Values grid */}
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.values.items.map((value, index) => {
              const Icon = VALUE_ICONS[index].icon;
              const accent = VALUE_ICONS[index].accent;
              return (
                <div
                  key={value.title}
                  className="group relative rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} shadow-md shadow-slate-900/10`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold text-slate-900 dark:text-white">
                    {value.title}
                  </h3>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    {value.subtitle}
                  </p>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* FEATURES GRID                                                       */}
      {/* =================================================================== */}
      <section className="py-20 sm:py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Users className="h-3.5 w-3.5" />
              {t.features.badge}
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
              {t.features.title}
            </h2>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.features.subtitle}
            </p>
          </div>

          {/* Feature grid */}
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
      {/* CALL-TO-ACTION BANNER                                               */}
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
                <Link
                  href="/auth"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-bold text-emerald-800 shadow-lg hover:bg-emerald-50 transition-colors"
                >
                  {t.cta.register}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 backdrop-blur px-6 py-3.5 text-base font-bold text-white hover:bg-white/20 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t.cta.backHome}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* FOOTER                                                              */}
      {/* =================================================================== */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                  ባሲራ
                </p>
                <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {t.footer.tagline}
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-4 text-sm">
              <Link
                href="/"
                className="text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
              >
                {t.footer.backHome}
              </Link>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <Link
                href="/auth"
                className="text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
              >
                {t.footer.register}
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              © {new Date().getFullYear()} Basira · ባሲራ. {t.footer.rights}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}