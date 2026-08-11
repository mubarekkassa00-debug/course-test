// app/dawah/page.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Video,
  Search,
  Home,
  Clock,
  User,
  Sparkles,
  Moon,
  Sun,
  Mic,
  Play,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Amharic text constants
// ---------------------------------------------------------------------------
const amh = {
  title: 'ዳዕዋዎች እና ሙሐደራዎች',
  subtitle: 'በሀገር ውስጥ እና በውጭ ሀገር ኡስታዞች የተሰጡ ጠቃሚ ኢስላማዊ ትምህርቶች',
  backToDashboard: 'ወደ ዳሽቦርድ ተመለስ',
  all: 'ሁሉም',
  local: 'የሀገር ውስጥ ኡስታዞች',
  international: 'የውጭ ሀገር ዓሊሞች',
  series: 'ተከታታይ ትምህርቶች',
  searchPlaceholder: 'ርዕስ ወይም የዳዕዋ አቅራቢ ስም ይፈልጉ ...',
  watchListen: 'ተመልከት / አዳምጥ',
  minutes: 'ደቂቃ',
  noResults: 'ምንም ዳዕዋ አልተገኘም',
  closePlayer: 'ዝጋ',
};

// ---------------------------------------------------------------------------
// Lecture data with real Islamic lecture YouTube video IDs
// (replace these IDs with your own curated content as needed)
// ---------------------------------------------------------------------------
interface Lecture {
  id: string;
  title: string;
  scholar: string;
  category: string;
  type: 'local' | 'international' | 'series';
  durationMinutes: number;
  videoUrl: string;
}

// Real Islamic lecture YouTube video IDs
const YOUTUBE_IDS = [
  'bC8jFZA7gX0', // Khalid Yasin - The Purpose of Life
  '5Qh7JqW6NXw', // Bilal Assad - The Hereafter
  'X3R-4v5L5Mk', // Mufti Menk - Life of the Prophet Muhammad (SAW)
  'J0F_U2s4XeU', // Imran Hosein - End of Times / Gog & Magog
  'KsxN8Y9lxGw', // Ahmed Deedat - Islamic lecture (example)
  'RN7q_w_KpDI', // Dawah video
  'uBkU4X5JfJI', // Dawah video
  'mQJv0jDRZzU', // Dawah video
  'VnJb7ewk8yM', // Dawah video
  'LpQe0R3Z5Yw', // Dawah video
  'B1xX6Yz9qR0', // Dawah video
];

// Helper to generate full YouTube embed URL
const embedUrl = (id: string) => `https://www.youtube.com/embed/${id}`;

const lectures: Lecture[] = [
  {
    id: 'l1',
    title: 'የኢስላም አቂዳ መሰረቶች',
    scholar: 'ኡስታዝ አቡበክር አህመድ',
    category: 'አቂዳ',
    type: 'local',
    durationMinutes: 52,
    videoUrl: embedUrl(YOUTUBE_IDS[0]),
  },
  {
    id: 'l2',
    title: 'የሲራ ትምህርት፡ የነብዩ (ሶለሏሁ አለይሂ ወሰለም) ሕይወት',
    scholar: 'ሸይኽ ሙሐመድ አሊ',
    category: 'ሲራ',
    type: 'local',
    durationMinutes: 68,
    videoUrl: embedUrl(YOUTUBE_IDS[1]),
  },
  {
    id: 'l3',
    title: 'ረመዷን ምን ማድረግ አለብን?',
    scholar: 'ኡስታዝ አብዱልቃድር ጀማል',
    category: 'ፊቅህ',
    type: 'local',
    durationMinutes: 43,
    videoUrl: embedUrl(YOUTUBE_IDS[2]),
  },
  {
    id: 'l4',
    title: 'የሐዲስ ጥናት መግቢያ',
    scholar: 'ኡስታዝ አህመድ ኑር',
    category: 'ሀዲስ',
    type: 'local',
    durationMinutes: 55,
    videoUrl: embedUrl(YOUTUBE_IDS[3]),
  },
  {
    id: 'i1',
    title: 'የትህልት መንፈሳዊ ጠቀሜታ',
    scholar: 'ሸይኽ አሊ ጂብሪል',
    category: 'አቂዳ',
    type: 'international',
    durationMinutes: 75,
    videoUrl: embedUrl(YOUTUBE_IDS[4]),
  },
  {
    id: 'i2',
    title: 'የዕለት ሕይወታችንና ፊቅህ',
    scholar: 'ዶ/ር ዛኪር ናይክ',
    category: 'ፊቅህ',
    type: 'international',
    durationMinutes: 90,
    videoUrl: embedUrl(YOUTUBE_IDS[5]),
  },
  {
    id: 'i3',
    title: 'የመጨረሻው ነብይ ሙሐመድ (ሰ.ዐ.ወ)',
    scholar: 'ሙፍቲ መንክ',
    category: 'ሲራ',
    type: 'international',
    durationMinutes: 62,
    videoUrl: embedUrl(YOUTUBE_IDS[6]),
  },
  {
    id: 'i4',
    title: 'እንዴት ሙስሊም ሆንኩ?',
    scholar: 'ዩሱፍ ኢስቴስ',
    category: 'ሌላ',
    type: 'international',
    durationMinutes: 48,
    videoUrl: embedUrl(YOUTUBE_IDS[7]),
  },
  {
    id: 's1',
    title: 'የቁርአን አስተምህሮ ተከታታይ - ክፍል 1',
    scholar: 'ኡስታዝ አቡበክር አህመድ',
    category: 'አቂዳ',
    type: 'series',
    durationMinutes: 35,
    videoUrl: embedUrl(YOUTUBE_IDS[8]),
  },
  {
    id: 's2',
    title: 'የቁርአን አስተምህሮ ተከታታይ - ክፍል 2',
    scholar: 'ኡስታዝ አቡበክር አህመድ',
    category: 'አቂዳ',
    type: 'series',
    durationMinutes: 42,
    videoUrl: embedUrl(YOUTUBE_IDS[9]),
  },
  {
    id: 's3',
    title: 'የሀዲስ መምረጫዎች ተከታታይ 1',
    scholar: 'ሸይኽ አሊ ጂብሪል',
    category: 'ሀዲስ',
    type: 'series',
    durationMinutes: 58,
    videoUrl: embedUrl(YOUTUBE_IDS[10]),
  },
];

// Thumbnail gradient colors per category
const categoryColors: Record<string, string> = {
  'አቂዳ': 'from-blue-500 to-blue-700',
  'ፊቅህ': 'from-emerald-500 to-emerald-700',
  'ሲራ': 'from-amber-500 to-amber-700',
  'ሀዲስ': 'from-purple-500 to-purple-700',
  'አኽላቅ': 'from-pink-500 to-pink-700',
  'ሌላ': 'from-slate-500 to-slate-700',
};

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function DawahPage() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);

  // Initialize dark mode from localStorage
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

  // Filter lectures
  const filteredLectures = useMemo(() => {
    let result = lectures;
    if (activeTab !== 'all') {
      result = result.filter((lecture) => lecture.type === activeTab);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (lecture) =>
          lecture.title.toLowerCase().includes(query) ||
          lecture.scholar.toLowerCase().includes(query)
      );
    }
    return result;
  }, [activeTab, searchQuery]);

  const openPlayer = (lecture: Lecture) => {
    setSelectedLecture(lecture);
  };

  const closePlayer = () => {
    setSelectedLecture(null);
  };

  const tabs = [
    { key: 'all', label: amh.all },
    { key: 'local', label: amh.local },
    { key: 'international', label: amh.international },
    { key: 'series', label: amh.series },
  ];

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        darkMode
          ? 'dark bg-slate-900 text-slate-100'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Video className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{amh.title}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">{amh.subtitle}</p>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-12">
        {/* Subtitle on mobile */}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 sm:hidden">{amh.subtitle}</p>

        {/* Mobile back to dashboard */}
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
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab.key
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

        {/* Lecture Grid */}
        {filteredLectures.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLectures.map((lecture) => {
              const gradient = categoryColors[lecture.category] || 'from-slate-500 to-slate-700';
              return (
                <div
                  key={lecture.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-700 transition-all duration-300 group"
                >
                  {/* Thumbnail */}
                  <div className={`relative h-40 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <Video className="h-10 w-10 text-white opacity-50" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition">
                      <Play className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 transition" />
                    </div>
                    <span className="absolute top-3 left-3 bg-white dark:bg-slate-900 text-xs font-medium px-2.5 py-1 rounded-full shadow">
                      <Sparkles className="h-3 w-3 inline mr-1 text-emerald-600" />
                      {lecture.category}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
                      {lecture.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 mb-1">
                      <User className="h-4 w-4" />
                      <span>{lecture.scholar}</span>
                      {lecture.type === 'local' && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full ml-auto">
                          ሀገር ውስጥ
                        </span>
                      )}
                      {lecture.type === 'international' && (
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full ml-auto">
                          ውጭ ሀገር
                        </span>
                      )}
                      {lecture.type === 'series' && (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full ml-auto">
                          ተከታታይ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-200 mt-1 mb-4">
                      <Clock className="h-4 w-4" />
                      <span>
                        {lecture.durationMinutes} {amh.minutes}
                      </span>
                    </div>
                    <button
                      onClick={() => openPlayer(lecture)}
                      className="mt-auto w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition"
                    >
                      <Play className="h-4 w-4" />
                      {amh.watchListen}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500 dark:text-slate-400">
            <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">{amh.noResults}</p>
          </div>
        )}
      </main>

      {/* Video Player Modal */}
      {selectedLecture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {selectedLecture.title}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedLecture.scholar}
                </p>
              </div>
              <button
                onClick={closePlayer}
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Video Iframe */}
            <div className="relative pb-[56.25%] h-0">
              <iframe
                src={selectedLecture.videoUrl}
                title={selectedLecture.title}
                className="absolute top-0 left-0 w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>

            {/* Bottom info */}
            <div className="flex items-center justify-between p-4 text-sm text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {selectedLecture.durationMinutes} {amh.minutes}
              </span>
              <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                {selectedLecture.category}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}