// app/courses/[id]/lessons/[lessonId]/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Volume2,
  ImageIcon,
  CheckCircle,
  XCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

interface Lesson {
  id: string;
  lessonNumber: number;
  title: string;
  images: string[];
  audioUrl: string;
}

// ---------------------------------------------------------------------------
// 1) ኡሱሉ ሰላሳ (Usul as-Salasa)
// ---------------------------------------------------------------------------
const lessons: Lesson[] = [
  {
    id: 'lesson-1',
    lessonNumber: 1,
    title: 'ኡሱሉ ሰላሳ - ደርስ 1',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262313/usul_page-0001_ggoscs.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262317/usul_page-0002_gioxtw.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262319/usul_page-0003_ugsaxy.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086041/usul_01_kqsvq9.mp3',
  },
  {
    id: 'lesson-2',
    lessonNumber: 2,
    title: 'ኡሱሉ ሰላሳ - ደርስ 2',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262319/usul_page-0003_ugsaxy.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262318/usul_page-0004_zhpnbr.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0005_qcc0r5.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086861/usul_02_odav3e.mp3',
  },
  {
    id: 'lesson-3',
    lessonNumber: 3,
    title: 'ኡሱሉ ሰላሳ - ደርስ 3',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0005_qcc0r5.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262323/usul_page-0006_xu2dnj.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262320/usul_page-0007_qncmo0.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086248/usul_03_fxeztt.mp3',
  },
  {
    id: 'lesson-4',
    lessonNumber: 4,
    title: 'ኡሱሉ ሰላሳ - ደርስ 4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262320/usul_page-0007_qncmo0.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262321/usul_page-0008_nwrosz.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086354/usul_04_vbsihg.mp3',
  },
  {
    id: 'lesson-5',
    lessonNumber: 5,
    title: 'ኡሱሉ ሰላሳ - ደርስ 5',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262321/usul_page-0009_hpnrur.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262324/usul_page-0010_ijgcx3.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086564/usul_05_kp4dgz.mp3',
  },
  {
    id: 'lesson-6',
    lessonNumber: 6,
    title: 'ኡሱሉ ሰላሳ - ደርስ 6',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262324/usul_page-0010_ijgcx3.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262323/usul_page-0011_a7dyqn.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262323/usul_page-0012_zmekuh.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262324/usul_page-0013_bkkyyu.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262328/usul_page-0014_nark7n.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786087471/usul_06_qfqvwc.mp3',
  },
  {
    id: 'lesson-7',
    lessonNumber: 7,
    title: 'ኡሱሉ ሰላሳ - ደርስ 7',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0015_nkk5rw.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0016_wcn4ot.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0017_fo0bpb.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086388/usul_07_bpdh2m.mp3',
  },
  {
    id: 'lesson-8',
    lessonNumber: 8,
    title: 'ኡሱሉ ሰላሳ - ደርስ 8',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0017_fo0bpb.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262329/usul_page-0018_usotos.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262329/usul_page-0019_imspvj.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086368/usul_08_ihnjwm.mp3',
  },
  {
    id: 'lesson-9',
    lessonNumber: 9,
    title: 'ኡሱሉ ሰላሳ - ደርስ 9',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262329/usul_page-0019_imspvj.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262327/usul_page-0020_lhz2jm.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262329/usul_page-0021_witcu9.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262328/usul_page-0022_jnqqpt.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086184/usul_09_vqwvym.mp3',
  },
  {
    id: 'lesson-10',
    lessonNumber: 10,
    title: 'ኡሱሉ ሰላሳ - ደርስ 10',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262330/usul_page-0023_ikoxoz.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262331/usul_page-0024_l1me8e.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262333/usul_page-0025_imqogl.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262331/usul_page-0026_kqlwsq.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086404/usul_10_avocbi.mp3',
  },
  {
    id: 'lesson-11',
    lessonNumber: 11,
    title: 'ኡሱሉ ሰላሳ - ደርስ 11',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262331/usul_page-0026_kqlwsq.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262332/usul_page-0027_am2v56.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086279/usul_11_zlrzrj.mp3',
  },
];

// ---------------------------------------------------------------------------
// 2) አርባኢን ነወዊ (Arba'in An-Nawawi)
// ---------------------------------------------------------------------------
const lessonsArbaeen: Lesson[] = [
  {
    id: 'arbaeen-lesson-1',
    lessonNumber: 101,
    title: 'አርባኢን ነወዊ - ደርስ 1',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691533/arbain-image_page-0001_soy3pt.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691534/arbain-image_page-0002_stnuky.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691534/arbain-image_page-0003_wsmu9u.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691536/arbain-image_page-0004_msky4g.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691536/arbain-image_page-0005_svoclw.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691536/arbain-image_page-0006_u3nchl.jpg',
    ],
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691144/arbain-01.mp3_spzu5j.mp3',
  },
  {
    id: 'arbaeen-lesson-2',
    lessonNumber: 102,
    title: 'አርባኢን ነወዊ - ደርስ 2',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691536/arbain-image_page-0007_cuo3xl.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691537/arbain-image_page-0008_mz70pw.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691539/arbain-image_page-0009_ug7sc9.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691541/arbain-image_page-0010_yhttnz.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691543/arbain-image_page-0011_ov2joc.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691543/arbain-image_page-0012_u8xr9w.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691543/arbain-image_page-0013_ujralo.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691545/arbain-image_page-0014_ddsk3f.jpg',
    ],
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691150/arbain-02.mp3_mzd2x4.mp3',
  },
  {
    id: 'arbaeen-lesson-3',
    lessonNumber: 103,
    title: 'አርባኢን ነወዊ - ደርስ 3',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691546/arbain-image_page-0015_bkaumo.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691548/arbain-image_page-0016_nwtudl.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691548/arbain-image_page-0017_wdwqnk.jpg',
    ],
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691094/arbain-03.mp3_ios6v6.mp3',
  },
  {
    id: 'arbaeen-lesson-4',
    lessonNumber: 104,
    title: 'አርባኢን ነወዊ - ደርስ 4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691549/arbain-image_page-0018_fewrnd.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691550/arbain-image_page-0019_kll7qy.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691551/arbain-image_page-0020_dleihi.jpg',
    ],
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691039/arbain-04.mp3_ih6yfn.mp3',
  },
  {
    id: 'arbaeen-lesson-5',
    lessonNumber: 105,
    title: 'አርባኢን ነወዊ - ደርስ 5',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691553/arbain-image_page-0021_yhrczu.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691553/arbain-image_page-0022_njihop.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691556/arbain-image_page-0023_tkq3s5.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691557/arbain-image_page-0024_fu20fy.jpg',
    ],
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691044/arbain-05.mp3_jbpdij.mp3',
  },
  {
    id: 'arbaeen-lesson-6',
    lessonNumber: 106,
    title: 'አርባኢን ነወዊ - ደርስ 6',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691558/arbain-image_page-0025_onybqq.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691558/arbain-image_page-0026_vlwrja.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691560/arbain-image_page-0027_dkwgvk.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691561/arbain-image_page-0028_cchx2t.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691562/arbain-image_page-0029_ws7bnl.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691563/arbain-image_page-0030_fjbdft.jpg',
    ],
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691059/arbain-06.mp3_ly19mh.mp3',
  },
  {
    id: 'arbaeen-lesson-7',
    lessonNumber: 107,
    title: 'አርባኢን ነወዊ - ደርስ 7',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691564/arbain-image_page-0031_f6msbw.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691565/arbain-image_page-0032_xxwil6.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691566/arbain-image_page-0033_uiae1n.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691567/arbain-image_page-0034_rnjlm7.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691568/arbain-image_page-0035_e8zw1k.jpg',
    ],
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691130/arbain-07.mp3_mov7y7.mp3',
  },
  {
    id: 'arbaeen-lesson-8',
    lessonNumber: 108,
    title: 'አርባኢን ነወዊ - ደርስ 8',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691569/arbain-image_page-0036_jje1st.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691571/arbain-image_page-0037_vfzent.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691572/arbain-image_page-0038_i0cupy.jpg',
    ],
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691129/arbain-08.mp3_hqf5ej.mp3',
  },
  {
    id: 'arbaeen-lesson-9',
    lessonNumber: 109,
    title: 'አርባኢን ነወዊ - ደርስ 9',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691573/arbain-image_page-0039_ojetbr.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691573/arbain-image_page-0040_yn38z0.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691574/arbain-image_page-0041_adcsco.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691575/arbain-image_page-0042_uvg3hl.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691576/arbain-image_page-0043_cbb0lf.jpg',
    ],
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691166/arbain-09.mp3_w7obpw.mp3',
  },
  {
    id: 'arbaeen-lesson-10',
    lessonNumber: 110,
    title: 'አርባኢን ነወዊ - ደርስ 10',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691577/arbain-image_page-0044_dfvxkb.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691578/arbain-image_page-0045_cdcenh.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691580/arbain-image_page-0046_yawnfs.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691581/arbain-image_page-0047_upy9p5.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691582/arbain-image_page-0048_diknbn.jpg',
    ],
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691168/arbain-10.mp3_vqudpf.mp3',
  },
  {
    id: 'arbaeen-lesson-11',
    lessonNumber: 111,
    title: 'አርባኢን ነወዊ - ደርስ 11',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691584/arbain-image_page-0049_qshxqb.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691585/arbain-image_page-0050_mlahum.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691586/arbain-image_page-0051_eijkab.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691587/arbain-image_page-0052_hzobrt.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691588/arbain-image_page-0053_nxcbhz.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691590/arbain-image_page-0054_vx36su.jpg',
    ],
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691176/arbain-11.mp3_evcigs.mp3',
  },
];

// ---------------------------------------------------------------------------
// 3) ኮርሶችን በ courseId ለይቶ የሚያገኝ ካርታ
// ---------------------------------------------------------------------------
const courseLessonsMap: Record<string, Lesson[]> = {
  '1': lessons,
  '2': lessonsArbaeen,
  'usul': lessons,
  'arbaeen': lessonsArbaeen,
  'arbain': lessonsArbaeen,
};

export default function LessonPage() {
  const params = useParams();

  const courseId = params?.id as string;
  const currentLessonId = (params?.lessonId || params?.lessonid) as string;

  // Select correct lesson array by courseId
  const courseLessons =
    courseLessonsMap[courseId] || [...lessons, ...lessonsArbaeen];

  // Extract number from slug like "lesson-8" or "arbaeen-lesson-8" → 8
  const slugNumberMatch = currentLessonId.match(/(\d+)$/);
  const slugLessonNumber = slugNumberMatch
    ? parseInt(slugNumberMatch[1], 10)
    : null;

  // Find lesson by local number (1–11) or exact ID
  const currentIndex = courseLessons.findIndex((l) => {
    const localNumber = l.lessonNumber % 100;
    if (slugLessonNumber !== null && localNumber === slugLessonNumber) {
      return true;
    }
    return l.id === currentLessonId;
  });

  const lesson = currentIndex !== -1 ? courseLessons[currentIndex] : null;

  const [activeTab, setActiveTab] = useState<'lesson' | 'quiz'>('lesson');
  const [currentImg, setCurrentImg] = useState(0);
  const [audioEnded, setAudioEnded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Reset on lesson change
  useEffect(() => {
    setCurrentImg(0);
    setAudioEnded(false);
  }, [lesson]);

  // Fetch quiz + questions
  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;

    const fetchQuiz = async () => {
      setLoadingQuiz(true);
      setQuizError(null);
      setQuizSubmitted(false);
      setScore(null);
      setSelectedAnswers({});
      setActiveTab('lesson');
      setCurrentStep(0);

      try {
        const localLessonNumber = lesson.lessonNumber % 100;

        // Course-based title pattern
        let courseTitlePattern = '%ኡሱሉ%';
        if (
          courseId === '2' ||
          courseId === 'arbaeen' ||
          courseId === 'arbain'
        ) {
          courseTitlePattern = '%አርባኢን%';
        }

        // 1. Fetch quiz
        let quizData: any = null;
        const { data: quizDataResponse, error: quizFetchError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('lesson_id', localLessonNumber)
          .ilike('title', courseTitlePattern)
          .maybeSingle();

        quizData = quizDataResponse;

        if (cancelled) return;

        if (quizFetchError) {
          setQuizError('ፈተናውን ማምጣት አልተቻለም። እባክዎ ደግመው ይሞክሩ።');
          setQuiz(null);
          setQuestions([]);
          return;
        }

        // Fallback: lesson_id only
        if (!quizData) {
          const { data: fallbackQuiz, error: fallbackQuizError } = await supabase
            .from('quizzes')
            .select('*')
            .eq('lesson_id', localLessonNumber)
            .maybeSingle();

          if (cancelled) return;

          if (fallbackQuizError) {
            setQuizError('ፈተናውን ማምጣት አልተቻለም። እባክዎ ደግመው ይሞክሩ።');
            setQuiz(null);
            setQuestions([]);
            return;
          }
          quizData = fallbackQuiz;
        }

        let questionsData: any[] = [];

        // 2. Questions by quiz_id
        if (quizData) {
          const { data: questionsByQuiz, error: questionsByQuizError } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('quiz_id', quizData.id)
            .order('id', { ascending: true });

          if (cancelled) return;

          if (questionsByQuizError) {
            setQuizError('ጥያቄዎችን ማምጣት አልተቻለም።');
            setQuiz(null);
            setQuestions([]);
            return;
          }

          questionsData = questionsByQuiz || [];
        }

        // 3. Fallback: questions by lesson_id
        if (!questionsData || questionsData.length === 0) {
          const { data: questionsByLesson, error: questionsByLessonError } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('lesson_id', localLessonNumber)
            .order('id', { ascending: true });

          if (cancelled) return;

          if (questionsByLessonError) {
            setQuizError('ጥያቄዎችን ማምጣት አልተቻለም።');
            setQuiz(null);
            setQuestions([]);
            return;
          }

          questionsData = questionsByLesson || [];
        }

        if (!questionsData || questionsData.length === 0) {
          setQuizError('ለዚህ ደርስ እስካሁን ምንም ጥያቄ አልተዘጋጀም');
          setQuiz(quizData);
          setQuestions([]);
          return;
        }

        const parsedQuestions = questionsData.map((q: any) => ({
          ...q,
          options:
            typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        }));

        setQuiz(
          quizData || { id: null, title: `የደርስ ${lesson.lessonNumber} ፈተና` }
        );
        setQuestions(parsedQuestions);
        setQuizError(null);
      } catch (err: any) {
        if (!cancelled) {
          console.error('Quiz fetch error:', err);
          setQuizError('አልተጠበቀ ስህተት ተከስቷል። እባክዎ ደግመው ይሞክሩ።');
          setQuiz(null);
          setQuestions([]);
        }
      } finally {
        if (!cancelled) setLoadingQuiz(false);
      }
    };

    fetchQuiz();
    return () => {
      cancelled = true;
    };
  }, [lesson, courseId]);

  // Audio ended event
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !lesson?.audioUrl) return;

    const handleEnded = () => setAudioEnded(true);
    audio.addEventListener('ended', handleEnded);
    if (audio.ended) setAudioEnded(true);

    return () => audio.removeEventListener('ended', handleEnded);
  }, [lesson?.audioUrl]);

  const handleOptionSelect = (questionId: number, optionText: string) => {
    if (quizSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionText }));
  };

  const handleSubmitQuiz = async () => {
    if (!questions.length || !lesson) return;

    const correctCount = questions.reduce((acc, q) => {
      const selected = selectedAnswers[q.id];
      return selected === q.correct_answer ? acc + 1 : acc;
    }, 0);

    setScore(correctCount);
    setQuizSubmitted(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert('የተጠቃሚ መለያ አልተገኘም። እባክዎ ደግመው ይሞክሩ።');
        return;
      }

      const { error } = await supabase.from('quiz_attempts').insert({
        user_id: user.id,
        quiz_id: quiz?.id || null,
        lesson_id: lesson.lessonNumber % 100,
        score: correctCount,
        total: questions.length,
        answers: selectedAnswers,
        submitted_at: new Date().toISOString(),
      });

      if (error) {
        alert('የመላክ ስህተት፦ ' + error.message);
      } else {
        alert('ውጤትህ በትክክል ተመዝግቧል!');
      }
    } catch (e: any) {
      console.error('Failed to save quiz result', e);
      alert('የመላክ ስህተት፦ ' + (e.message || 'Unknown error'));
    }
  };

  const goToQuiz = () => setActiveTab('quiz');
  const goToLesson = () => setActiveTab('lesson');

  const nextImage = () =>
    lesson &&
    setCurrentImg((prev) => Math.min(prev + 1, lesson.images.length - 1));

  const prevImage = () =>
    lesson && setCurrentImg((prev) => Math.max(prev - 1, 0));

  const nextStep = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  if (!lesson) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">ደርሱ አልተገኘም</h1>
          <p className="text-slate-400">
            ይቅርታ፣ የጠየቁት ደርስ በስርዓቱ ውስጥ አልተገኘም።
          </p>
          <Link
            href={`/courses/${courseId || 1}`}
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            ወደ ኮርሱ ተመለስ
          </Link>
        </div>
      </div>
    );
  }

  const quizAvailable = questions.length > 0;
  const totalImages = lesson.images.length;

  return (
    <div className="h-screen max-h-[100dvh] flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between relative z-30">
        <div className="flex items-center gap-3">
          {activeTab === 'lesson' ? (
            <Link
              href={`/courses/${courseId}`}
              className="p-2 bg-slate-800 rounded-lg active:bg-slate-700"
            >
              <ArrowLeft className="h-5 w-5 text-slate-300" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={goToLesson}
              className="p-2 bg-slate-800 rounded-lg active:bg-slate-700"
            >
              <ArrowLeft className="h-5 w-5 text-slate-300" />
            </button>
          )}
          <div>
            <p className="text-xs text-slate-400">
              {activeTab === 'lesson'
                ? courseId === '2' ||
                  courseId === 'arbaeen' ||
                  courseId === 'arbain'
                  ? 'አርባኢን ነወዊ'
                  : 'ኡሱሉ ሰላሳ'
                : 'ፈተና'}
            </p>
            <h1 className="text-base font-bold text-white truncate">
              {lesson.title}
            </h1>
          </div>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 bg-slate-800 rounded-lg active:bg-slate-700"
        >
          {menuOpen ? (
            <X className="h-5 w-5 text-slate-300" />
          ) : (
            <Menu className="h-5 w-5 text-slate-300" />
          )}
        </button>
      </header>

      {/* Hamburger dropdown */}
      {menuOpen && (
        <div className="absolute top-14 right-2 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 w-48">
          <Link
            href="/dashboard"
            className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg mx-2"
          >
            ወደ ዳሽቦርድ
          </Link>
          <Link
            href="/courses"
            className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg mx-2"
          >
            የእኔ ኮርሶች
          </Link>
          <Link
            href="/profile"
            className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg mx-2"
          >
            ፕሮፋይል
          </Link>
        </div>
      )}

      {/* Lesson view */}
      {activeTab === 'lesson' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 p-3 flex items-center justify-center">
            {totalImages > 0 && lesson.images.some((url) => url.trim() !== '') ? (
              <div className="relative w-full h-full flex items-center justify-center bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
                <img
                  src={lesson.images[currentImg]}
                  alt={`ገፅ ${currentImg + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
                {totalImages > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      disabled={currentImg === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 rounded-full disabled:opacity-30"
                    >
                      <ChevronLeft className="h-5 w-5 text-white" />
                    </button>
                    <button
                      onClick={nextImage}
                      disabled={currentImg === totalImages - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 rounded-full disabled:opacity-30"
                    >
                      <ChevronRight className="h-5 w-5 text-white" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>ምስሎች ገና አልተጫኑም</p>
              </div>
            )}
          </div>
          {totalImages > 1 &&
            lesson.images.some((url) => url.trim() !== '') && (
              <p className="text-center text-xs text-slate-500 py-1">
                ገፅ {currentImg + 1} / {totalImages}
              </p>
            )}

          <div className="flex-shrink-0 p-3 bg-slate-900 border-t border-slate-800">
            {lesson.audioUrl ? (
              <div className="mb-3">
                <audio
                  ref={audioRef}
                  controls
                  className="w-full rounded-lg"
                  src={lesson.audioUrl}
                  preload="metadata"
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
            ) : (
              <div className="text-center py-2 text-slate-500 mb-3">
                <Volume2 className="h-6 w-6 mx-auto opacity-50" />
                <p className="text-xs">ኦዲዮ አልተገኘም</p>
              </div>
            )}

            {loadingQuiz && (
              <div className="py-3 bg-slate-800 text-center text-slate-400 text-sm rounded-xl animate-pulse">
                ፈተናውን በመጫን ላይ...
              </div>
            )}

            {!loadingQuiz && quizError && (
              <div className="py-3 bg-slate-800 text-center text-slate-400 text-sm rounded-xl">
                {quizError}
              </div>
            )}

            {!loadingQuiz && quizAvailable && (audioEnded || !lesson.audioUrl) && (
              <button
                type="button"
                onClick={goToQuiz}
                className="w-full py-3 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"
              >
                <BookOpen className="h-5 w-5" />
                ፈተናውን ጀምር
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Quiz view */
        <div className="flex-1 flex flex-col min-h-0 p-3 overflow-auto">
          <button
            type="button"
            onClick={goToLesson}
            className="mb-3 py-2 bg-slate-800 active:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> ወደ ደርሱ ተመለስ
          </button>

          <h3 className="text-lg font-bold text-white mb-4">
            {quiz?.title || 'የደርሱ ፈተና'}
          </h3>

          {!quizSubmitted ? (
            <>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex-1 min-h-0 overflow-auto">
                <p className="text-sm font-medium text-white mb-3">
                  {currentStep + 1}. {questions[currentStep].question_text}
                </p>
                <div className="space-y-2">
                  {questions[currentStep].options.map(
                    (opt: string, optIdx: number) => {
                      const isSelected =
                        selectedAnswers[questions[currentStep].id] === opt;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() =>
                            handleOptionSelect(
                              questions[currentStep].id,
                              opt
                            )
                          }
                          className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
                              : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 mt-3">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-medium disabled:opacity-40"
                >
                  ወደ ኋላ
                </button>
                {currentStep < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-medium"
                  >
                    ቀጣይ
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitQuiz}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold"
                  >
                    አስረክብ
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
              <p className="text-emerald-400 font-bold text-lg">
                ውጤት፡ {score}/{questions.length}
              </p>
              <button
                type="button"
                onClick={goToLesson}
                className="w-full py-3 bg-slate-800 active:bg-slate-700 text-white rounded-xl"
              >
                ወደ ደርሱ ተመለስ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}