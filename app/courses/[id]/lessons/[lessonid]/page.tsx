// app/courses/[id]/lessons/[lessonId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';

interface Lesson {
  id: string;
  lessonNumber: number;
  title: string;
  images: string[];
  audioUrl: string;
}

// ነባሪ የኡሱሉ ሰላሳ የልምምድ ጥያቄዎች (ከ Supabase ዳታ ሳይመጣ ቢቀር እንኳን አፑ እንዳይዘጋ)
const fallbackQuestionsMap: Record<number, any[]> = {
  1: [
    {
      id: 101,
      question_text: 'እያንዳንዱ ሙስሊም ሊማራቸው የሚገቡ ሶስቱ መሰረታዊ ነጥቦች (ኡሱሉ ሰላሳ) የትኞቹ ናቸው?',
      options: [
        'አላህን፣ ዲኑን (እስልምናን) እና ነቢዩን (ሱ.ዐ.ወ) ማወቅ',
        'ሶላት፣ ፆም እና ዘካ ማወቅ',
        'ቁርኣን፣ ሐዲስ እና ፊቅህ ማወቅ',
        'ታሪክ፣ ቋንቋ እና ሂሳብ ማወቅ',
      ],
      correct_answer: 'አላህን፣ ዲኑን (እስልምናን) እና ነቢዩን (ሱ.ዐ.ወ) ማወቅ',
    },
    {
      id: 102,
      question_text: 'በሱረቱል ዐስር ላይ ኢማሙ ሻፊዒይ (ረሒመሁላህ) እንደተናገሩት አላህ በሰዎች ላይ ማስረጃ ያደረገው የትኛውን ሱራ ነው?',
      options: ['ሱረቱል ፋቲሓ', 'ሱረቱል ዐስር', 'ሱረቱል እክላስ', 'ሱረቱል በቀራህ'],
      correct_answer: 'ሱረቱል ዐስር',
    },
  ],
};

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

export default function LessonPage() {
  const params = useParams();

  const courseId = params?.id as string;
  const currentLessonId = (params?.lessonId || params?.lessonid) as string;

  const currentIndex = lessons.findIndex((l) => l.id === currentLessonId);
  const lesson = currentIndex !== -1 ? lessons[currentIndex] : null;

  const [activeTab, setActiveTab] = useState<'lesson' | 'quiz'>('lesson');

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;

    const fetchQuiz = async () => {
      setLoadingQuiz(true);
      setQuizSubmitted(false);
      setScore(null);
      setSelectedAnswers({});

      try {
        const lessonNum = lesson.lessonNumber;

        // 1. በ lessonNumber ፈልግ
        let { data: quizData } = await supabase
          .from('quizzes')
          .select('*')
          .eq('lesson_id', lessonNum)
          .maybeSingle();

        // 2. ካልተገኘ በ lesson.id ፈልግ
        if (!quizData) {
          const { data: byStringId } = await supabase
            .from('quizzes')
            .select('*')
            .eq('lesson_id', lesson.id)
            .maybeSingle();
          quizData = byStringId;
        }

        // 3. አሁንም ካልተገኘ በ kitab_id ፈልግ
        if (!quizData && courseId) {
          const { data: byKitab } = await supabase
            .from('quizzes')
            .select('*')
            .eq('kitab_id', courseId)
            .maybeSingle();
          quizData = byKitab;
        }

        // 4. የመጨረሻ አማራጭ፡ የትኛውንም በቴብሉ ያለ ፈተና ውሰድ
        if (!quizData) {
          const { data: latest } = await supabase
            .from('quizzes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          quizData = latest;
        }

        if (cancelled) return;

        let fetchedQuestions: any[] = [];

        if (quizData) {
          const { data: questionsData } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('quiz_id', quizData.id)
            .order('id', { ascending: true });

          if (questionsData && questionsData.length > 0) {
            fetchedQuestions = questionsData.map((q: any) => ({
              ...q,
              options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
            }));
          }
        }

        // ከ Supabase ጥያቄ ካልመጣ፡ አውቶማቲክ Fallback Questions ን መጠቀም
        if (fetchedQuestions.length === 0) {
          fetchedQuestions = fallbackQuestionsMap[lessonNum] || fallbackQuestionsMap[1];
          quizData = { id: 999, title: `${lesson.title} - ፈተና` };
        }

        if (!cancelled) {
          setQuiz(quizData);
          setQuestions(fetchedQuestions);
        }
      } catch (err) {
        console.error('Quiz fetch error:', err);
        // ኤረር ቢኖር እንኳ ነባሪ ጥያቄዎችን አዘጋጅ
        setQuiz({ id: 999, title: `${lesson.title} - ፈተና` });
        setQuestions(fallbackQuestionsMap[lesson.lessonNumber] || fallbackQuestionsMap[1]);
      } finally {
        if (!cancelled) setLoadingQuiz(false);
      }
    };

    fetchQuiz();
    return () => { cancelled = true; };
  }, [lesson, courseId]);

  const handleOptionSelect = (questionId: number, optionText: string) => {
    if (quizSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionText }));
  };

  const handleSubmitQuiz = () => {
    if (!questions.length) return;
    const correctCount = questions.reduce((acc, q) => {
      const selected = selectedAnswers[q.id];
      return selected === q.correct_answer ? acc + 1 : acc;
    }, 0);
    setScore(correctCount);
    setQuizSubmitted(true);
  };

  const goToQuiz = () => setActiveTab('quiz');
  const goToLesson = () => setActiveTab('lesson');

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">ደርሱ አልተገኘም</h1>
          <p className="text-slate-400">ይቅርታ፣ የጠየቁት ደርስ በስርዓቱ ውስጥ አልተገኘም።</p>
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

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-4 pb-36 space-y-6">
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-3 rounded-xl shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          {activeTab === 'lesson' ? (
            <Link href={`/courses/${courseId}`} className="p-2 bg-slate-800 rounded-lg active:bg-slate-700">
              <ArrowLeft className="h-5 w-5 text-slate-300" />
            </Link>
          ) : (
            <button type="button" onClick={goToLesson} className="p-2 bg-slate-800 rounded-lg active:bg-slate-700">
              <ArrowLeft className="h-5 w-5 text-slate-300" />
            </button>
          )}
          <div>
            <p className="text-xs text-slate-400">{activeTab === 'lesson' ? 'ኡሱሉ ሰላሳ' : 'ፈተና'}</p>
            <h1 className="text-base font-bold text-white">{lesson.title}</h1>
          </div>
        </div>
        <span className="text-xs font-medium text-slate-400">{lesson.lessonNumber}/{lessons.length}</span>
      </header>

      {/* LESSON VIEW */}
      {activeTab === 'lesson' && (
        <div className="space-y-6">
          {/* Images Stacked Top-to-Bottom */}
          <div className="space-y-4">
            {lesson.images.length > 0 ? (
              lesson.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`ገፅ ${i + 1}`}
                  className="w-full h-auto rounded-xl border border-slate-800 shadow-lg"
                />
              ))
            ) : (
              <div className="text-center py-12 text-slate-500">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>ምስሎች ገና አልተጫኑም</p>
              </div>
            )}
          </div>

          {/* Audio Player Card & Inline Quiz Trigger */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-4 shadow-xl">
            {lesson.audioUrl ? (
              <div>
                <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                  የደርሱ ኦዲዮ (ማብራሪያ)
                </p>
                <audio controls className="w-full rounded-lg" src={lesson.audioUrl}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500">
                <Volume2 className="h-8 w-8 mx-auto mb-1 opacity-50" />
                <p className="text-xs">ኦዲዮ አልተገኘም</p>
              </div>
            )}

            {loadingQuiz ? (
              <div className="py-3 bg-slate-800 text-center text-slate-400 text-sm rounded-xl animate-pulse">
                ፈተናውን በመጫን ላይ...
              </div>
            ) : (
              <button
                type="button"
                onClick={goToQuiz}
                className="w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all text-base cursor-pointer"
              >
                <BookOpen className="h-5 w-5" />
                ፈተናውን ጀምር
              </button>
            )}
          </div>
        </div>
      )}

      {/* QUIZ VIEW */}
      {activeTab === 'quiz' && quizAvailable && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={goToLesson}
            className="w-full py-3 bg-slate-800 active:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> ወደ ደርሱ ተመለስ
          </button>

          <h3 className="text-lg font-bold text-white">{quiz?.title || 'የደርሱ ፈተና'}</h3>

          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div key={q.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                <p className="text-sm font-medium text-white">{qIdx + 1}. {q.question_text}</p>
                <div className="space-y-2">
                  {q.options.map((opt: string, optIdx: number) => {
                    const isSelected = selectedAnswers[q.id] === opt;
                    const isCorrectAnswer = q.correct_answer === opt;
                    let optionStyle = 'border-slate-800 bg-slate-950 text-slate-300';
                    if (quizSubmitted) {
                      if (isSelected && isCorrectAnswer) optionStyle = 'border-green-500 bg-green-900/40 text-green-300';
                      else if (isSelected && !isCorrectAnswer) optionStyle = 'border-red-500 bg-red-900/40 text-red-300';
                      else if (isCorrectAnswer) optionStyle = 'border-green-500 bg-green-900/40 text-green-300';
                    } else if (isSelected) {
                      optionStyle = 'border-emerald-500 bg-emerald-950 text-emerald-300';
                    }
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleOptionSelect(q.id, opt)}
                        disabled={quizSubmitted}
                        className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${optionStyle}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {quizSubmitted && (
                  <div className="text-xs mt-2">
                    {selectedAnswers[q.id] === q.correct_answer ? (
                      <span className="text-green-400 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> ትክክል</span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> ስህተት (ትክክለኛው፡ {q.correct_answer})</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!quizSubmitted ? (
            <button
              type="button"
              onClick={handleSubmitQuiz}
              disabled={Object.keys(selectedAnswers).length < questions.length}
              className="w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              ፈተናውን አስገባ
            </button>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-emerald-400 font-bold text-lg">ውጤት፡ {score}/{questions.length}</p>
              <button type="button" onClick={goToLesson} className="w-full py-3 bg-slate-800 active:bg-slate-700 text-white rounded-xl">
                ወደ ደርሱ ተመለስ
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Bar for Mobile Screen - Always Visible */}
      {activeTab === 'lesson' && quizAvailable && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-30 shadow-2xl">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={goToQuiz}
              className="w-full py-3.5 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg text-base cursor-pointer"
            >
              <BookOpen className="h-5 w-5" />
              ፈተናውን ጀምር
            </button>
          </div>
        </div>
      )}
    </div>
  );
}