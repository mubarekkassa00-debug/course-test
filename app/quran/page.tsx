// app/quran/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Search,
  ArrowLeft,
  Home,
  Volume2,
  VolumeX,
  User,
  Music,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Amharic text constants
// ---------------------------------------------------------------------------
const amh = {
  quranCenter: 'የቁርአን ማዕከል',
  backToDashboard: 'ወደ ዳሽቦርድ ተመለስ',
  reciterList: 'የቃሪዎች ዝርዝር',
  searchReciter: 'ቃሪ ይፈልጉ ...',
  searchSurah: 'ሱራ ይፈልጉ (ስም ወይም ቁጥር) ...',
  changeReciter: 'ቃሪይ ቀይር',
  surahIndex: 'የ114 ሱራዎች ማውጫ',
  surahs: 'ሱራዎች',
  verses: 'አያት',
  meccan: 'መካዊ',
  medinan: 'መዲናዊ',
  all114Surahs: '114 ሱራዎች',
  play: 'አጫውት',
  loading: 'በመጫን ላይ...',
};

// ---------------------------------------------------------------------------
// Reciters (10 top Qaris with working base URLs)
// ---------------------------------------------------------------------------
const reciters = [
  {
    id: 'afs',
    name: 'ሚሻሪ ራሺድ አል-ዐፋሲ',
    nameLatin: 'Mishary Rashid Alafasy',
    country: 'ኩዌት',
    style: 'ሙርተታል',
    baseUrl: 'https://server8.mp3quran.net/afs/',
  },
  {
    id: 'abdulbasit',
    name: 'ዐብዱልባሲጥ ዐብዱስ-ሰመድ',
    nameLatin: 'Abdul Basit Abdul Samad',
    country: 'ግብፅ',
    style: 'ሙርተታል',
    baseUrl: 'https://server8.mp3quran.net/abdulbasit/',
  },
  {
    id: 'maher',
    name: 'ማሔር አል-ሙዐይቅሊ',
    nameLatin: 'Maher Al-Muaiqly',
    country: 'ሳዑዲ አረቢያ',
    style: 'ሙርተታል',
    baseUrl: 'https://server8.mp3quran.net/maher/',
  },
  {
    id: 'shuraim',
    name: 'ሰዑድ አል-ሹሬም',
    nameLatin: 'Saud Al-Shuraim',
    country: 'ሳዑዲ አረቢያ',
    style: 'ሙርተታል',
    baseUrl: 'https://server8.mp3quran.net/shur/',
  },
  {
    id: 'ghamdi',
    name: 'ሳዕድ አል-ጋምዲ',
    nameLatin: 'Saad Al-Ghamdi',
    country: 'ሳዑዲ አረቢያ',
    style: 'ሙርተታል',
    baseUrl: 'https://server8.mp3quran.net/saad/',
  },
  {
    id: 'sudais',
    name: 'ዐብዱራሕማን አል-ሱደይስ',
    nameLatin: 'Abdul Rahman Al-Sudais',
    country: 'ሳዑዲ አረቢያ',
    style: 'ሙርተታል',
    baseUrl: 'https://server8.mp3quran.net/sudais/',
  },
  {
    id: 'minshawi',
    name: 'ሙሐመድ ሲድዲቅ አል-ምንሻዊ',
    nameLatin: 'Muhammad Siddiq Al-Minshawi',
    country: 'ግብፅ',
    style: 'ሙርተታል',
    baseUrl: 'https://server8.mp3quran.net/minshawi/',
  },
  {
    id: 'shatri',
    name: 'አቡ በክር አል-ሻጥሪ',
    nameLatin: 'Abu Bakr Al-Shatri',
    country: 'ሳዑዲ አረቢያ',
    style: 'ሙርተታል',
    baseUrl: 'https://server8.mp3quran.net/shatri/',
  },
  {
    id: 'yasser',
    name: 'ያሲር አል-ዶሳሪ',
    nameLatin: 'Yasser Al-Dosari',
    country: 'ሳዑዲ አረቢያ',
    style: 'ሙርተታል',
    baseUrl: 'https://server8.mp3quran.net/yasser/',
  },
  {
    id: 'husary',
    name: 'ማሕሙድ ኻሊል አል-ሑሰሪ',
    nameLatin: 'Mahmoud Khalil Al-Husary',
    country: 'ግብፅ',
    style: 'ሙርተታል',
    baseUrl: 'https://server8.mp3quran.net/husary/',
  },
];

// ---------------------------------------------------------------------------
// 114 Surahs data
// ---------------------------------------------------------------------------
interface Surah {
  number: number;
  arabicName: string;
  amharicName: string;
  revelation: 'Meccan' | 'Medinan';
  versesCount: number;
}

const surahs: Surah[] = [
  { number: 1, arabicName: 'الفاتحة', amharicName: 'አል-ፋቲሓ', revelation: 'Meccan', versesCount: 7 },
  { number: 2, arabicName: 'البقرة', amharicName: 'አል-በቀራ', revelation: 'Medinan', versesCount: 286 },
  { number: 3, arabicName: 'آل عمران', amharicName: 'አሉ ዒምራን', revelation: 'Medinan', versesCount: 200 },
  { number: 4, arabicName: 'النساء', amharicName: 'አን-ኒሳእ', revelation: 'Medinan', versesCount: 176 },
  { number: 5, arabicName: 'المائدة', amharicName: 'አል-ማኢዳ', revelation: 'Medinan', versesCount: 120 },
  { number: 6, arabicName: 'الأنعام', amharicName: 'አል-አንዓም', revelation: 'Meccan', versesCount: 165 },
  { number: 7, arabicName: 'الأعراف', amharicName: 'አል-አዕራፍ', revelation: 'Meccan', versesCount: 206 },
  { number: 8, arabicName: 'الأنفال', amharicName: 'አል-አንፋል', revelation: 'Medinan', versesCount: 75 },
  { number: 9, arabicName: 'التوبة', amharicName: 'አት-ተውባህ', revelation: 'Medinan', versesCount: 129 },
  { number: 10, arabicName: 'يونس', amharicName: 'ዩኑስ', revelation: 'Meccan', versesCount: 109 },
  { number: 11, arabicName: 'هود', amharicName: 'ሁድ', revelation: 'Meccan', versesCount: 123 },
  { number: 12, arabicName: 'يوسف', amharicName: 'ዩሱፍ', revelation: 'Meccan', versesCount: 111 },
  { number: 13, arabicName: 'الرعد', amharicName: 'አር-ረዕድ', revelation: 'Medinan', versesCount: 43 },
  { number: 14, arabicName: 'إبراهيم', amharicName: 'ኢብራሂም', revelation: 'Meccan', versesCount: 52 },
  { number: 15, arabicName: 'الحجر', amharicName: 'አል-ሒጅር', revelation: 'Meccan', versesCount: 99 },
  { number: 16, arabicName: 'النحل', amharicName: 'አን-ነሕል', revelation: 'Meccan', versesCount: 128 },
  { number: 17, arabicName: 'الإسراء', amharicName: 'አል-ኢስራእ', revelation: 'Meccan', versesCount: 111 },
  { number: 18, arabicName: 'الكهف', amharicName: 'አል-ከህፍ', revelation: 'Meccan', versesCount: 110 },
  { number: 19, arabicName: 'مريم', amharicName: 'መርየም', revelation: 'Meccan', versesCount: 98 },
  { number: 20, arabicName: 'طه', amharicName: 'ጣሀ', revelation: 'Meccan', versesCount: 135 },
  { number: 21, arabicName: 'الأنبياء', amharicName: 'አል-አንቢያእ', revelation: 'Meccan', versesCount: 112 },
  { number: 22, arabicName: 'الحج', amharicName: 'አል-ሐጅ', revelation: 'Medinan', versesCount: 78 },
  { number: 23, arabicName: 'المؤمنون', amharicName: 'አል-ሙእሚኑን', revelation: 'Meccan', versesCount: 118 },
  { number: 24, arabicName: 'النور', amharicName: 'አን-ኑር', revelation: 'Medinan', versesCount: 64 },
  { number: 25, arabicName: 'الفرقان', amharicName: 'አል-ፉርቃን', revelation: 'Meccan', versesCount: 77 },
  { number: 26, arabicName: 'الشعراء', amharicName: 'አሽ-ሹዐራእ', revelation: 'Meccan', versesCount: 227 },
  { number: 27, arabicName: 'النمل', amharicName: 'አን-ነምል', revelation: 'Meccan', versesCount: 93 },
  { number: 28, arabicName: 'القصص', amharicName: 'አል-ቀሰስ', revelation: 'Meccan', versesCount: 88 },
  { number: 29, arabicName: 'العنكبوت', amharicName: 'አል-አንከቡት', revelation: 'Meccan', versesCount: 69 },
  { number: 30, arabicName: 'الروم', amharicName: 'አር-ሩም', revelation: 'Meccan', versesCount: 60 },
  { number: 31, arabicName: 'لقمان', amharicName: 'ሉቅማን', revelation: 'Meccan', versesCount: 34 },
  { number: 32, arabicName: 'السجدة', amharicName: 'አስ-ሰጅዳ', revelation: 'Meccan', versesCount: 30 },
  { number: 33, arabicName: 'الأحزاب', amharicName: 'አል-አሕዛብ', revelation: 'Medinan', versesCount: 73 },
  { number: 34, arabicName: 'سبأ', amharicName: 'ሰበእ', revelation: 'Meccan', versesCount: 54 },
  { number: 35, arabicName: 'فاطر', amharicName: 'ፋጢር', revelation: 'Meccan', versesCount: 45 },
  { number: 36, arabicName: 'يس', amharicName: 'ያሲን', revelation: 'Meccan', versesCount: 83 },
  { number: 37, arabicName: 'الصافات', amharicName: 'አስ-ሳፋት', revelation: 'Meccan', versesCount: 182 },
  { number: 38, arabicName: 'ص', amharicName: 'ሷድ', revelation: 'Meccan', versesCount: 88 },
  { number: 39, arabicName: 'الزمر', amharicName: 'አዝ-ዙመር', revelation: 'Meccan', versesCount: 75 },
  { number: 40, arabicName: 'غافر', amharicName: 'ጋፊር', revelation: 'Meccan', versesCount: 85 },
  { number: 41, arabicName: 'فصلت', amharicName: 'ፉሲለት', revelation: 'Meccan', versesCount: 54 },
  { number: 42, arabicName: 'الشورى', amharicName: 'አሽ-ሹራ', revelation: 'Meccan', versesCount: 53 },
  { number: 43, arabicName: 'الزخرف', amharicName: 'አዝ-ዙክሩፍ', revelation: 'Meccan', versesCount: 89 },
  { number: 44, arabicName: 'الدخان', amharicName: 'አድ-ዱኻን', revelation: 'Meccan', versesCount: 59 },
  { number: 45, arabicName: 'الجاثية', amharicName: 'አል-ጃሲያ', revelation: 'Meccan', versesCount: 37 },
  { number: 46, arabicName: 'الأحقاف', amharicName: 'አል-አሕቃፍ', revelation: 'Meccan', versesCount: 35 },
  { number: 47, arabicName: 'محمد', amharicName: 'ሙሐመድ', revelation: 'Medinan', versesCount: 38 },
  { number: 48, arabicName: 'الفتح', amharicName: 'አል-ፈትሕ', revelation: 'Medinan', versesCount: 29 },
  { number: 49, arabicName: 'الحجرات', amharicName: 'አል-ሑጁራት', revelation: 'Medinan', versesCount: 18 },
  { number: 50, arabicName: 'ق', amharicName: 'ቃፍ', revelation: 'Meccan', versesCount: 45 },
  { number: 51, arabicName: 'الذاريات', amharicName: 'አዝ-ዛሪያት', revelation: 'Meccan', versesCount: 60 },
  { number: 52, arabicName: 'الطور', amharicName: 'አት-ጡር', revelation: 'Meccan', versesCount: 49 },
  { number: 53, arabicName: 'النجم', amharicName: 'አን-ነጅም', revelation: 'Meccan', versesCount: 62 },
  { number: 54, arabicName: 'القمر', amharicName: 'አል-ቀመር', revelation: 'Meccan', versesCount: 55 },
  { number: 55, arabicName: 'الرحمن', amharicName: 'አር-ረሕማን', revelation: 'Medinan', versesCount: 78 },
  { number: 56, arabicName: 'الواقعة', amharicName: 'አል-ዋቂዓ', revelation: 'Meccan', versesCount: 96 },
  { number: 57, arabicName: 'الحديد', amharicName: 'አል-ሐዲድ', revelation: 'Medinan', versesCount: 29 },
  { number: 58, arabicName: 'المجادلة', amharicName: 'አል-ሙጃደላ', revelation: 'Medinan', versesCount: 22 },
  { number: 59, arabicName: 'الحشر', amharicName: 'አል-ሀሽር', revelation: 'Medinan', versesCount: 24 },
  { number: 60, arabicName: 'الممتحنة', amharicName: 'አል-ሙምተሀና', revelation: 'Medinan', versesCount: 13 },
  { number: 61, arabicName: 'الصف', amharicName: 'አስ-ሰፍ', revelation: 'Medinan', versesCount: 14 },
  { number: 62, arabicName: 'الجمعة', amharicName: 'አል-ጁሙዓ', revelation: 'Medinan', versesCount: 11 },
  { number: 63, arabicName: 'المنافقون', amharicName: 'አል-ሙናፊቁን', revelation: 'Medinan', versesCount: 11 },
  { number: 64, arabicName: 'التغابن', amharicName: 'አት-ተጋቡን', revelation: 'Medinan', versesCount: 18 },
  { number: 65, arabicName: 'الطلاق', amharicName: 'አት-ጠላቅ', revelation: 'Medinan', versesCount: 12 },
  { number: 66, arabicName: 'التحريم', amharicName: 'አት-ተሕሪም', revelation: 'Medinan', versesCount: 12 },
  { number: 67, arabicName: 'الملك', amharicName: 'አል-ሙልክ', revelation: 'Meccan', versesCount: 30 },
  { number: 68, arabicName: 'القلم', amharicName: 'አል-ቀለም', revelation: 'Meccan', versesCount: 52 },
  { number: 69, arabicName: 'الحاقة', amharicName: 'አል-ሃቅቃ', revelation: 'Meccan', versesCount: 52 },
  { number: 70, arabicName: 'المعارج', amharicName: 'አል-መአሪጅ', revelation: 'Meccan', versesCount: 44 },
  { number: 71, arabicName: 'نوح', amharicName: 'ኑሕ', revelation: 'Meccan', versesCount: 28 },
  { number: 72, arabicName: 'الجن', amharicName: 'አል-ጂን', revelation: 'Meccan', versesCount: 28 },
  { number: 73, arabicName: 'المزمل', amharicName: 'አል-ሙዘሚል', revelation: 'Meccan', versesCount: 20 },
  { number: 74, arabicName: 'المدثر', amharicName: 'አል-ሙደትር', revelation: 'Meccan', versesCount: 56 },
  { number: 75, arabicName: 'القيامة', amharicName: 'አል-ቂያማ', revelation: 'Meccan', versesCount: 40 },
  { number: 76, arabicName: 'الإنسان', amharicName: 'አል-ኢንሳን', revelation: 'Medinan', versesCount: 31 },
  { number: 77, arabicName: 'المرسلات', amharicName: 'አል-ሙርሰላት', revelation: 'Meccan', versesCount: 50 },
  { number: 78, arabicName: 'النبأ', amharicName: 'አን-ነበእ', revelation: 'Meccan', versesCount: 40 },
  { number: 79, arabicName: 'النازعات', amharicName: 'አን-ናዚአት', revelation: 'Meccan', versesCount: 46 },
  { number: 80, arabicName: 'عبس', amharicName: 'ዐበሰ', revelation: 'Meccan', versesCount: 42 },
  { number: 81, arabicName: 'التكوير', amharicName: 'አት-ተክዊር', revelation: 'Meccan', versesCount: 29 },
  { number: 82, arabicName: 'الإنفطار', amharicName: 'አል-ኢንፊጣር', revelation: 'Meccan', versesCount: 19 },
  { number: 83, arabicName: 'المطففين', amharicName: 'አል-ሙጠፊፊን', revelation: 'Meccan', versesCount: 36 },
  { number: 84, arabicName: 'الإنشقاق', amharicName: 'አል-ኢንሺቃቅ', revelation: 'Meccan', versesCount: 25 },
  { number: 85, arabicName: 'البروج', amharicName: 'አል-ቡሩጅ', revelation: 'Meccan', versesCount: 22 },
  { number: 86, arabicName: 'الطارق', amharicName: 'አት-ጣሪቅ', revelation: 'Meccan', versesCount: 17 },
  { number: 87, arabicName: 'الأعلى', amharicName: 'አል-አዕላ', revelation: 'Meccan', versesCount: 19 },
  { number: 88, arabicName: 'الغاشية', amharicName: 'አል-ጋሺያ', revelation: 'Meccan', versesCount: 26 },
  { number: 89, arabicName: 'الفجر', amharicName: 'አል-ፈጅር', revelation: 'Meccan', versesCount: 30 },
  { number: 90, arabicName: 'البلد', amharicName: 'አል-በለድ', revelation: 'Meccan', versesCount: 20 },
  { number: 91, arabicName: 'الشمس', amharicName: 'አሽ-ሸምስ', revelation: 'Meccan', versesCount: 15 },
  { number: 92, arabicName: 'الليل', amharicName: 'አል-ለይል', revelation: 'Meccan', versesCount: 21 },
  { number: 93, arabicName: 'الضحى', amharicName: 'አድ-ዱሃ', revelation: 'Meccan', versesCount: 11 },
  { number: 94, arabicName: 'الشرح', amharicName: 'አሽ-ሸርሕ', revelation: 'Meccan', versesCount: 8 },
  { number: 95, arabicName: 'التين', amharicName: 'አት-ቲን', revelation: 'Meccan', versesCount: 8 },
  { number: 96, arabicName: 'العلق', amharicName: 'አል-ዐለቅ', revelation: 'Meccan', versesCount: 19 },
  { number: 97, arabicName: 'القدر', amharicName: 'አል-ቀድር', revelation: 'Meccan', versesCount: 5 },
  { number: 98, arabicName: 'البينة', amharicName: 'አል-በይና', revelation: 'Medinan', versesCount: 8 },
  { number: 99, arabicName: 'الزلزلة', amharicName: 'አዝ-ዘልዘላ', revelation: 'Medinan', versesCount: 8 },
  { number: 100, arabicName: 'العاديات', amharicName: 'አል-አዲያት', revelation: 'Meccan', versesCount: 11 },
  { number: 101, arabicName: 'القارعة', amharicName: 'አል-ቃሪዓ', revelation: 'Meccan', versesCount: 11 },
  { number: 102, arabicName: 'التكاثر', amharicName: 'አት-ተካሱር', revelation: 'Meccan', versesCount: 8 },
  { number: 103, arabicName: 'العصر', amharicName: 'አል-ዐስር', revelation: 'Meccan', versesCount: 3 },
  { number: 104, arabicName: 'الهمزة', amharicName: 'አል-ሁመዛ', revelation: 'Meccan', versesCount: 9 },
  { number: 105, arabicName: 'الفيل', amharicName: 'አል-ፊል', revelation: 'Meccan', versesCount: 5 },
  { number: 106, arabicName: 'قريش', amharicName: 'ቁረይሽ', revelation: 'Meccan', versesCount: 4 },
  { number: 107, arabicName: 'الماعون', amharicName: 'አል-ማዑን', revelation: 'Meccan', versesCount: 7 },
  { number: 108, arabicName: 'الكوثر', amharicName: 'አል-ከውሰር', revelation: 'Meccan', versesCount: 3 },
  { number: 109, arabicName: 'الكافرون', amharicName: 'አል-ካፊሩን', revelation: 'Meccan', versesCount: 6 },
  { number: 110, arabicName: 'النصر', amharicName: 'አን-ነስር', revelation: 'Medinan', versesCount: 3 },
  { number: 111, arabicName: 'المسد', amharicName: 'አል-መሰድ', revelation: 'Meccan', versesCount: 5 },
  { number: 112, arabicName: 'الإخلاص', amharicName: 'አል-ኢኽላስ', revelation: 'Meccan', versesCount: 4 },
  { number: 113, arabicName: 'الفلق', amharicName: 'አል-ፈለቅ', revelation: 'Meccan', versesCount: 5 },
  { number: 114, arabicName: 'الناس', amharicName: 'አን-ናስ', revelation: 'Meccan', versesCount: 6 },
];

// ---------------------------------------------------------------------------
// Helper: format seconds
// ---------------------------------------------------------------------------
const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '00:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function QuranPage() {
  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // View: reciters or surahs
  const [view, setView] = useState<'reciters' | 'surahs'>('reciters');
  const [selectedReciter, setSelectedReciter] = useState<typeof reciters[0] | null>(null);

  // Search inputs
  const [reciterSearch, setReciterSearch] = useState('');
  const [surahSearch, setSurahSearch] = useState('');

  // Audio player state
  const [currentSurahIndex, setCurrentSurahIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

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

  // Filtered reciters
  const filteredReciters = useMemo(() => {
    if (!reciterSearch.trim()) return reciters;
    const query = reciterSearch.trim().toLowerCase();
    return reciters.filter((r) => r.name.toLowerCase().includes(query));
  }, [reciterSearch]);

  // Filtered surahs
  const filteredSurahs = useMemo(() => {
    if (!surahSearch.trim()) return surahs;
    const query = surahSearch.trim().toLowerCase();
    return surahs.filter(
      (s) =>
        s.amharicName.toLowerCase().includes(query) ||
        s.arabicName.includes(query) ||
        s.number.toString().includes(query)
    );
  }, [surahSearch]);

  // Generate audio URL
  const getAudioUrl = useCallback(
    (reciter: typeof reciters[0], surahNumber: number) =>
      `${reciter.baseUrl}${surahNumber.toString().padStart(3, '0')}.mp3`,
    []
  );

  // Play a surah (by index in array, not surah number)
  const playSurah = useCallback(
    (surahIndex: number) => {
      if (!selectedReciter) return;
      const surah = surahs[surahIndex];
      if (!surah) return;

      setCurrentSurahIndex(surahIndex);
      setLoadingAudio(true);
      setIsPlaying(false);

      if (audioRef.current) {
        audioRef.current.src = getAudioUrl(selectedReciter, surah.number);
        audioRef.current.load();
      }
    },
    [selectedReciter, getAudioUrl]
  );

  const play = useCallback(() => {
    audioRef.current?.play()?.then(() => setIsPlaying(true)).catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const playPause = useCallback(() => {
    isPlaying ? pause() : play();
  }, [isPlaying, play, pause]);

  const nextSurah = useCallback(() => {
    if (currentSurahIndex === null || currentSurahIndex >= 113) return;
    playSurah(currentSurahIndex + 1);
  }, [currentSurahIndex, playSurah]);

  const prevSurah = useCallback(() => {
    if (currentSurahIndex === null || currentSurahIndex <= 0) return;
    playSurah(currentSurahIndex - 1);
  }, [currentSurahIndex, playSurah]);

  // Audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setLoadingAudio(false);
      audio.play()?.then(() => setIsPlaying(true)).catch(() => {});
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      if (currentSurahIndex !== null && currentSurahIndex < 113) {
        playSurah(currentSurahIndex + 1);
      }
    };
    const onVolumeChange = () => {
      setVolume(audio.volume);
      setMuted(audio.muted);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('volumechange', onVolumeChange);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('volumechange', onVolumeChange);
    };
  }, [currentSurahIndex, playSurah]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  // Selection actions
  const selectReciter = (reciter: typeof reciters[0]) => {
    setSelectedReciter(reciter);
    setView('surahs');
    setCurrentSurahIndex(null);
    setIsPlaying(false);
    setLoadingAudio(false);
  };

  const backToReciters = () => {
    setView('reciters');
    setSelectedReciter(null);
    setCurrentSurahIndex(null);
    setIsPlaying(false);
    setLoadingAudio(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  // Render
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
            <Music className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{amh.quranCenter}</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Back to Dashboard */}
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Home className="h-4 w-4" />
              {amh.backToDashboard}
            </Link>

            {/* Dark mode toggle */}
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-32">
        {/* Reciters View */}
        {view === 'reciters' && (
          <section>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{amh.reciterList}</h2>
              {/* Mobile dashboard link */}
              <Link
                href="/dashboard"
                className="sm:hidden mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Home className="h-4 w-4" />
                {amh.backToDashboard}
              </Link>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder={amh.searchReciter}
                value={reciterSearch}
                onChange={(e) => setReciterSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Reciter grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredReciters.map((reciter) => (
                <button
                  key={reciter.id}
                  onClick={() => selectReciter(reciter)}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-left hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-700 transition-all duration-200"
                >
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <User className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">{reciter.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{reciter.country} · {reciter.style}</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full">
                      {amh.all114Surahs}
                    </span>
                  </div>
                </button>
              ))}
              {filteredReciters.length === 0 && (
                <p className="col-span-full text-center text-slate-500 dark:text-slate-400 py-10">
                  ምንም ቃሪ አልተገኘም
                </p>
              )}
            </div>
          </section>
        )}

        {/* Surahs View */}
        {view === 'surahs' && selectedReciter && (
          <section>
            {/* Top banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={backToReciters}
                  className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <ArrowLeft className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{amh.surahIndex}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">{selectedReciter.name}</span>
                    <button
                      onClick={backToReciters}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline ml-2"
                    >
                      ({amh.changeReciter})
                    </button>
                    <Link
                      href="/dashboard"
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 ml-2 underline"
                    >
                      {amh.backToDashboard}
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Surah search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder={amh.searchSurah}
                value={surahSearch}
                onChange={(e) => setSurahSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Surah grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredSurahs.map((surah, idx) => {
                const realIndex = surah.number - 1;
                const isCurrent = currentSurahIndex === realIndex;
                return (
                  <div
                    key={surah.number}
                    className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border ${
                      isCurrent
                        ? 'border-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-900'
                        : 'border-slate-200 dark:border-slate-700'
                    } p-5 flex flex-col justify-between hover:shadow-md transition`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{surah.number}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            surah.revelation === 'Meccan'
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                              : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          }`}
                        >
                          {surah.revelation === 'Meccan' ? amh.meccan : amh.medinan}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 text-right" dir="rtl">
                        {surah.arabicName}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{surah.amharicName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        {surah.versesCount} {amh.verses}
                      </p>
                    </div>
                    <button
                      onClick={() => playSurah(realIndex)}
                      disabled={loadingAudio && isCurrent}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingAudio && isCurrent ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                      {loadingAudio && isCurrent ? amh.loading : amh.play}
                    </button>
                  </div>
                );
              })}
              {filteredSurahs.length === 0 && (
                <p className="col-span-full text-center text-slate-500 dark:text-slate-400 py-10">
                  ምንም ሱራ አልተገኘም
                </p>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Floating Audio Player */}
      {currentSurahIndex !== null && selectedReciter && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-2xl z-40 px-4 py-3">
          <audio ref={audioRef} preload="auto" />
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-4">
            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {surahs[currentSurahIndex].arabicName} - {surahs[currentSurahIndex].amharicName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{selectedReciter.name}</p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={prevSurah}
                disabled={currentSurahIndex === 0}
                className="p-1 text-slate-500 dark:text-slate-400 disabled:opacity-40"
              >
                <SkipBack className="h-5 w-5" />
              </button>
              <button
                onClick={playPause}
                className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button
                onClick={nextSurah}
                disabled={currentSurahIndex >= 113}
                className="p-1 text-slate-500 dark:text-slate-400 disabled:opacity-40"
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </div>

            {/* Progress + time */}
            <div className="flex-1 w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 w-10 text-right">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 1}
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (audioRef.current) audioRef.current.currentTime = val;
                  setCurrentTime(val);
                }}
                className="flex-1 h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-600"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 w-10">{formatTime(duration)}</span>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.muted = !audioRef.current.muted;
                    setMuted(audioRef.current.muted);
                  }
                }}
                className="p-1 text-slate-500 dark:text-slate-400"
              >
                {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (audioRef.current) {
                    audioRef.current.volume = val;
                    audioRef.current.muted = val === 0;
                    setVolume(val);
                    setMuted(val === 0);
                  }
                }}
                className="w-20 h-1 bg-slate-200 dark:bg-slate-600 rounded-lg cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-600"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}