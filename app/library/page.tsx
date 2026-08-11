// app/library/page.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Search,
  Home,
  X,
  Download,
  FileText,
  Layers,
  Bookmark,
  User,
  Moon,
  Sun,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  List,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Amharic text constants
// ---------------------------------------------------------------------------
const amh = {
  title: 'ዲጂታል ቤተ-መጽሐፍት',
  subtitle: 'የታመኑ ኢስላማዊ መጽሐፍት፣ ድርሳናት እና ምርምሮች ማዕከል',
  backToDashboard: 'ወደ ዳሽቦርድ ተመለስ',
  searchPlaceholder: 'ርዕስ ወይም ደራሲ ስም ይፈልጉ ...',
  allCategories: 'ሁሉም',
  categories: {
    aqeedah: 'አቂዳ',
    fiqh: 'ፊቅህ',
    hadith: 'ሀዲስ',
    tafseer: 'ተፍሲር',
    seerah: 'ሲራ እና ታሪክ',
    other: 'ሌላ',
  },
  pages: 'ገፅ',
  formatPdf: 'PDF',
  read: 'አንብብ',
  download: 'ወርድ',
  closeReader: 'ዝጋ',
  bookOverview: 'የመጽሐፉ አጭር መግለጫ',
  contentsPreview: 'የይዘት ዝርዝር ቅድመ እይታ',
  noBooksFound: 'ምንም መጽሐፍ አልተገኘም',
  openInNewTab: 'በአዲስ ገፅ ክፈት',
  pdfDownload: 'PDF አውርድ',
  chapter: 'ምዕራፍ',
  previousChapter: 'ቀዳሚ ምዕራፍ',
  nextChapter: 'ቀጣይ ምዕራፍ',
  keyTakeaways: 'ቁልፍ መልእክቶች',
  readerPlaceholder: 'የመጽሐፉ ይዘት እዚህ ይታያል።',
};

// ---------------------------------------------------------------------------
// Book data interface (includes chapters for digital reader)
// ---------------------------------------------------------------------------
interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  pages: number;
  pdfUrl: string;
  gradient: string;
}

// Sample public PDF (working)
const SAMPLE_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

// ---------------------------------------------------------------------------
// Dummy book collection
// ---------------------------------------------------------------------------
const books: Book[] = [
  {
    id: 'b1',
    title: 'የኢስላም አቂዳ መሰረቶች',
    author: 'ሸይኽ ሙሐመድ አል-አሚን',
    category: 'aqeedah',
    pages: 280,
    pdfUrl: SAMPLE_PDF,
    gradient: 'from-blue-600 to-blue-800',
  },
  {
    id: 'b2',
    title: 'የፊቅህ አመቻች አቀራረብ',
    author: 'ኡስታዝ አቡበክር አህመድ',
    category: 'fiqh',
    pages: 410,
    pdfUrl: SAMPLE_PDF,
    gradient: 'from-emerald-600 to-emerald-800',
  },
  {
    id: 'b3',
    title: 'ሪያዱ አስ-ሳሊሂን (የሀዲስ ስብስብ)',
    author: 'ኢማም አን-ነወዊ',
    category: 'hadith',
    pages: 650,
    pdfUrl: SAMPLE_PDF,
    gradient: 'from-purple-600 to-purple-800',
  },
  {
    id: 'b4',
    title: 'የቁርአን ተፍሲር ኢብኑ ከሲር (ሙኽተሰር)',
    author: 'ኢማም ኢብኑ ከሲር',
    category: 'tafseer',
    pages: 1120,
    pdfUrl: SAMPLE_PDF,
    gradient: 'from-amber-600 to-amber-800',
  },
  {
    id: 'b5',
    title: 'የነብዩ (ሰ.ዐ.ወ) ሕይወት',
    author: 'ሸይኽ ሶፊዩ አር-ራሕማን',
    category: 'seerah',
    pages: 380,
    pdfUrl: SAMPLE_PDF,
    gradient: 'from-red-600 to-red-800',
  },
  {
    id: 'b6',
    title: 'ዘላለማዊው መንገድ',
    author: 'ኡስታዝ አብዱልቃድር ጀማል',
    category: 'aqeedah',
    pages: 195,
    pdfUrl: SAMPLE_PDF,
    gradient: 'from-indigo-600 to-indigo-800',
  },
  {
    id: 'b7',
    title: 'የረመዷን ፊቅህ',
    author: 'ዶ/ር ዩሱፍ አል-ቀረዷዊ',
    category: 'fiqh',
    pages: 230,
    pdfUrl: SAMPLE_PDF,
    gradient: 'from-teal-600 to-teal-800',
  },
  {
    id: 'b8',
    title: '40 ሀዲስ አስምሮ',
    author: 'ኢማም አን-ነወዊ',
    category: 'hadith',
    pages: 88,
    pdfUrl: SAMPLE_PDF,
    gradient: 'from-pink-600 to-pink-800',
  },
  {
    id: 'b9',
    title: 'ተፍሲር አል-ቀርጠቢ - ጁዝዕ አል-አዝካር',
    author: 'ኢማም አል-ቀርጠቢ',
    category: 'tafseer',
    pages: 540,
    pdfUrl: SAMPLE_PDF,
    gradient: 'from-orange-600 to-orange-800',
  },
  {
    id: 'b10',
    title: 'እስላማዊ ባህልና ስነ-ምግባር',
    author: 'ኡስታዝ ሙሐመድ ኑር',
    category: 'other',
    pages: 160,
    pdfUrl: SAMPLE_PDF,
    gradient: 'from-slate-600 to-slate-800',
  },
];

// ---------------------------------------------------------------------------
// Generate chapters based on category
// ---------------------------------------------------------------------------
const generateChapters = (category: string): string[] => {
  const baseChapters = {
    aqeedah: ['አቂዳ ምንድነው?', 'በአላህ ማመን', 'በመላእክት ማመን', 'በመጻሕፍት ማመን', 'በመልክተኞች ማመን'],
    fiqh: ['ንጽህና', 'ሰላት', 'ዘካ', 'ሶም', 'ሀጅ'],
    hadith: ['የሀዲስ አስፈላጊነት', 'የኒያ ሐዲስ', 'የእምነት ሐዲሶች', 'የስነምግባር ሐዲሶች', 'የዕለታዊ ዱዓዎች'],
    tafseer: ['አል-ፋቲሓ', 'አል-በቀራ', 'አሉ ዒምራን', 'አን-ኒሳእ', 'አል-ማኢዳ'],
    seerah: ['ቅድመ ልደት', 'የነብዩ ልደት', 'የነብዩ ወጣትነት', 'ነብይነት', 'ሂጅራ'],
    other: ['መግቢያ', 'ርዕሰ ጉዳይ 1', 'ርዕሰ ጉዳይ 2', 'ማጠቃለያ'],
  };
  return baseChapters[category as keyof typeof baseChapters] || baseChapters.other;
};

// Sample key takeaways per category
const generateTakeaways = (category: string): string[] => {
  const takeaways: Record<string, string[]> = {
    aqeedah: ['አላህ አንድ ነው', 'መላእክት አሉ', 'ቁርአን የአላህ ቃል ነው'],
    fiqh: ['ሰላት የዕለት ግዴታ ነው', 'ዘካ ንብረትን ያነጻል', 'ሶም እራስን ይገዛል'],
    hadith: ['ኒያ የተግባር መሰረት ነው', 'ሀቅ ንገሩ ምንም ቢከፋ', 'ሙስሊሞች ወንድማማች ናቸው'],
    tafseer: ['አል-ፋቲሓ የቁርአን እናት ናት', 'በቅንነት እንድንኖር ታዛለን', 'አላህ ሩህሩህ ነው'],
    seerah: ['ነብዩ ሞዴል ናቸው', 'በትዕግስት መኖር', 'እውነት ያሸንፋል'],
    other: ['ትምህርት ያግኙ', 'ተግባራዊ ያድርጉ', 'ለሌሎች ያስተምሩ'],
  };
  return takeaways[category] || takeaways.other;
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function LibraryPage() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);

  // Dark mode init
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

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('basira-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('basira-theme', 'light');
      }
      return next;
    });
  }, []);

  const categoryTabs = [
    { key: 'all', label: amh.allCategories },
    { key: 'aqeedah', label: amh.categories.aqeedah },
    { key: 'fiqh', label: amh.categories.fiqh },
    { key: 'hadith', label: amh.categories.hadith },
    { key: 'tafseer', label: amh.categories.tafseer },
    { key: 'seerah', label: amh.categories.seerah },
    { key: 'other', label: amh.categories.other },
  ];

  const filteredBooks = useMemo(() => {
    let result = books;
    if (activeCategory !== 'all') {
      result = result.filter((book) => book.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (book) =>
          book.title.toLowerCase().includes(query) ||
          book.author.toLowerCase().includes(query)
      );
    }
    return result;
  }, [activeCategory, searchQuery]);

  const openReader = (book: Book) => {
    setSelectedBook(book);
    setCurrentChapterIndex(0);
  };

  const closeReader = () => {
    setSelectedBook(null);
  };

  const openPdfInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Chapters and takeaways for selected book
  const selectedBookChapters = selectedBook ? generateChapters(selectedBook.category) : [];
  const selectedBookTakeaways = selectedBook ? generateTakeaways(selectedBook.category) : [];

  const goToChapter = (index: number) => {
    if (index >= 0 && index < selectedBookChapters.length) {
      setCurrentChapterIndex(index);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        darkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{amh.title}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                {amh.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Home className="h-4 w-4" />
              {amh.backToDashboard}
            </Link>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-12">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 sm:hidden">{amh.subtitle}</p>
        <div className="sm:hidden mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Home className="h-4 w-4" />
            {amh.backToDashboard}
          </Link>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categoryTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeCategory === tab.key
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder={amh.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* Books Grid */}
        {filteredBooks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-700 transition-all duration-300 group flex flex-col"
              >
                <div className={`relative h-52 bg-gradient-to-br ${book.gradient} p-6 flex items-center justify-center`}>
                  <BookOpen className="h-20 w-20 text-white/40 absolute top-4 right-4" />
                  <h3 className="text-white font-bold text-xl text-center drop-shadow-lg z-10 leading-tight">
                    {book.title}
                  </h3>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 mb-2">
                    <User className="h-4 w-4" />
                    <span>{book.author}</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                      {book.pages} {amh.pages}
                    </span>
                    <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {amh.formatPdf}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-4">
                    <Bookmark className="h-3 w-3" />
                    <span>{categoryTabs.find((t) => t.key === book.category)?.label || book.category}</span>
                  </div>
                  <div className="mt-auto flex gap-2">
                    <button
                      onClick={() => openReader(book)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition text-sm"
                    >
                      <BookOpen className="h-4 w-4" />
                      {amh.read}
                    </button>
                    <button
                      onClick={() => openPdfInNewTab(book.pdfUrl)}
                      className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                      title={amh.download}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500 dark:text-slate-400">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">{amh.noBooksFound}</p>
          </div>
        )}
      </main>

      {/* Book Reader Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedBook.title}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">{selectedBook.author}</p>
              </div>
              <button
                onClick={closeReader}
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Info */}
                <div className="lg:col-span-1 space-y-6">
                  <div className={`h-40 rounded-xl bg-gradient-to-br ${selectedBook.gradient} flex items-center justify-center`}>
                    <BookOpen className="h-16 w-16 text-white/60" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                      <Layers className="h-5 w-5 text-emerald-600" />
                      {amh.bookOverview}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      ይህ መጽሐፍ በኢስላማዊ አስተምህሮ ውስጥ መሰረታዊ ርዕሰ ጉዳዮችን ያትታል። በቀላል አማርኛ የተዘጋጀ ሲሆን ለአንባቢያን ጠቃሚ ማጣቀሻ ነው።
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">{amh.contentsPreview}</h4>
                    <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
                      {selectedBookChapters.map((ch, i) => (
                        <li key={i} className={i === currentChapterIndex ? 'text-emerald-600 font-medium' : ''}>
                          {ch}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right: Digital Reader */}
                <div className="lg:col-span-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 flex flex-col">
                  {/* Reader Navigation Bar */}
                  <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <button
                      onClick={() => goToChapter(currentChapterIndex - 1)}
                      disabled={currentChapterIndex === 0}
                      className="p-1 rounded text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {amh.chapter} {currentChapterIndex + 1}: {selectedBookChapters[currentChapterIndex]}
                      </span>
                    </div>
                    <button
                      onClick={() => goToChapter(currentChapterIndex + 1)}
                      disabled={currentChapterIndex === selectedBookChapters.length - 1}
                      className="p-1 rounded text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Reading Content Area */}
                  <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-slate-800">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {selectedBookChapters[currentChapterIndex]}
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 mt-4 leading-relaxed">
                        {amh.readerPlaceholder}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-4">
                        የመጽሐፉ ሙሉ ይዘት በፒ.ዲ.ኤፍ (PDF) ቅርጸት ይገኛል። ከዚህ በታች ያሉትን አማራጮች በመጠቀም ፋይሉን ማንበብ እና ማውረድ ይችላሉ።
                      </p>
                    </div>

                    {/* Key Takeaways */}
                    <div className="mt-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-5">
                      <h4 className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 mb-3">
                        <Layers className="h-4 w-4" />
                        {amh.keyTakeaways}
                      </h4>
                      <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 space-y-1">
                        {selectedBookTakeaways.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900 flex flex-wrap gap-3">
                    <button
                      onClick={() => openPdfInNewTab(selectedBook.pdfUrl)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition"
                    >
                      <Download className="h-5 w-5" />
                      {amh.pdfDownload}
                    </button>
                    <button
                      onClick={() => openPdfInNewTab(selectedBook.pdfUrl)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition"
                    >
                      <ExternalLink className="h-5 w-5" />
                      {amh.openInNewTab}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}