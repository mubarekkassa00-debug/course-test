// app/courses/[id]/page.tsx
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  BookOpen,
  PlayCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Amharic text constants
// ---------------------------------------------------------------------------
const amh = {
  backToCourses: 'ወደ ኮርሶች ተመለስ',
  progress: 'አጠቃላይ እድገት',
  certificateBadge: 'ሰርተፊኬት ያለው',
  dailyLessons: 'ዕለታዊ ደርሶች',
  weeklyQuiz: 'ሳምንታዊ ፈተና',
  finalExam: 'የመጨረሻ ፈተና (ሰርተፊኬት)',
  startLesson: 'ደርሱን ጀምር',
  question: 'ጥያቄ',
  of: 'ከ',
  submitAnswer: 'መልስ አስገባ',
  correct: 'ትክክል ነው!',
  incorrect: 'ስህተት ነው፣ እንደገና ሞክር',
  nextQuestion: 'ቀጣይ ጥያቄ',
  finish: 'ጨርስ',
  quizCompleted: 'ፈተናውን አጠናቅቀዋል',
  close: 'ዝጋ',
  lessons: 'ትምህርቶች',
};

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------
interface Question {
  questionText: string;
  options: string[];
  correctIndex: number;
}

interface Quiz {
  title: string;
  questions: Question[];
}

interface Lesson {
  id: string;        // e.g. "lesson-1"
  title: string;
  content?: string;
  quiz: Quiz;
}

interface Course {
  id: number;
  title: string;
  category: string;
  gradient: string;
  lessonsCount: number;
  progress: number;
  lessons: Lesson[];
  weeklyQuizzes: Quiz[];
  finalExam: Quiz;
}

// ---------------------------------------------------------------------------
// Mock course data (lesson id as strings)
// ---------------------------------------------------------------------------
const courses: Record<number, Course> = {
  1: {
    id: 1,
    title: 'ሦስቱ መሠረቶች (አል-ኡሱል አል-ሰላሳ)',
    category: 'አቂዳ',
    gradient: 'from-blue-600 to-blue-800',
    lessonsCount: 12,
    progress: 0,
    lessons: Array.from({ length: 11 }, (_, i) => ({
      id: `lesson-${i + 1}`,
      title: `ደርስ ${i + 1}`,
      quiz: {
        title: `የደርስ ${i + 1} ጥያቄ`,
        questions: [
          {
            questionText: `የደርስ ${i + 1} ጥያቄ 1?`,
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 0,
          },
        ],
      },
    })),
    weeklyQuizzes: [
      {
        title: 'የሳምንት 1 ፈተና',
        questions: [
          {
            questionText: 'ሳምንታዊ ጥያቄ 1?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 1,
          },
          {
            questionText: 'ሳምንታዊ ጥያቄ 2?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 2,
          },
        ],
      },
    ],
    finalExam: {
      title: 'የመጨረሻ ፈተና',
      questions: [
        {
          questionText: 'የመጨረሻ ጥያቄ 1?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 0,
        },
        {
          questionText: 'የመጨረሻ ጥያቄ 2?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 3,
        },
      ],
    },
  },
  2: {
    id: 2,
    title: '40ሩ የነወዊ ሀዲሶች (አል-አርባዒን)',
    category: 'ሀዲስ',
    gradient: 'from-purple-600 to-purple-800',
    lessonsCount: 15,
    progress: 0,
    lessons: Array.from({ length: 11 }, (_, i) => ({
      id: `lesson-${i + 1}`,
      title: `ደርስ ${i + 1}`,
      quiz: {
        title: `የደርስ ${i + 1} ጥያቄ`,
        questions: [
          {
            questionText: `የደርስ ${i + 1} ጥያቄ 1?`,
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 0,
          },
        ],
      },
    })),
    weeklyQuizzes: [
      {
        title: 'የሳምንት 1 ፈተና',
        questions: [
          {
            questionText: 'ሳምንታዊ ጥያቄ 1?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 1,
          },
        ],
      },
    ],
    finalExam: {
      title: 'የመጨረሻ ፈተና',
      questions: [
        {
          questionText: 'የመጨረሻ ጥያቄ 1?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 0,
        },
      ],
    },
  },
  3: {
    id: 3,
    title: 'የሶላትና የዉዱእ ህጎች (ሹሩጡ ሶላት)',
    category: 'ፊቅህ',
    gradient: 'from-emerald-600 to-emerald-800',
    lessonsCount: 10,
    progress: 0,
    lessons: Array.from({ length: 10 }, (_, i) => ({
      id: `lesson-${i + 1}`,
      title: `ደርስ ${i + 1}`,
      quiz: {
        title: `የደርስ ${i + 1} ጥያቄ`,
        questions: [
          {
            questionText: `የደርስ ${i + 1} ጥያቄ 1?`,
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 0,
          },
        ],
      },
    })),
    weeklyQuizzes: [
      {
        title: 'የሳምንት 1 ፈተና',
        questions: [
          {
            questionText: 'ሳምንታዊ ጥያቄ 1?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 1,
          },
        ],
      },
    ],
    finalExam: {
      title: 'የመጨረሻ ፈተና',
      questions: [
        {
          questionText: 'የመጨረሻ ጥያቄ 1?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 0,
        },
      ],
    },
  },
  4: {
    id: 4,
    title: 'አጭሩ የነቢዩ (ﷺ) ታሪክ (ኡርጁዘቱል ሚኢያህ)',
    category: 'ሲራ',
    gradient: 'from-red-600 to-red-800',
    lessonsCount: 14,
    progress: 0,
    lessons: Array.from({ length: 14 }, (_, i) => ({
      id: `lesson-${i + 1}`,
      title: `ደርስ ${i + 1}`,
      quiz: {
        title: `የደርስ ${i + 1} ጥያቄ`,
        questions: [
          {
            questionText: `የደርስ ${i + 1} ጥያቄ 1?`,
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 0,
          },
        ],
      },
    })),
    weeklyQuizzes: [
      {
        title: 'የሳምንት 1 ፈተና',
        questions: [
          {
            questionText: 'ሳምንታዊ ጥያቄ 1?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 1,
          },
        ],
      },
    ],
    finalExam: {
      title: 'የመጨረሻ ፈተና',
      questions: [
        {
          questionText: 'የመጨረሻ ጥያቄ 1?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 0,
        },
      ],
    },
  },
  5: {
    id: 5,
    title: 'መሰረታዊ የአረብኛ ሰዋሰው (አል-አጅሩሚያህ)',
    category: 'ቋንቋ',
    gradient: 'from-amber-600 to-amber-800',
    lessonsCount: 18,
    progress: 0,
    lessons: Array.from({ length: 18 }, (_, i) => ({
      id: `lesson-${i + 1}`,
      title: `ደርስ ${i + 1}`,
      quiz: {
        title: `የደርስ ${i + 1} ጥያቄ`,
        questions: [
          {
            questionText: `የደርስ ${i + 1} ጥያቄ 1?`,
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 0,
          },
        ],
      },
    })),
    weeklyQuizzes: [
      {
        title: 'የሳምንት 1 ፈተና',
        questions: [
          {
            questionText: 'ሳምንታዊ ጥያቄ 1?',
            options: ['ሀ', 'ለ', 'ሐ', 'መ'],
            correctIndex: 1,
          },
        ],
      },
    ],
    finalExam: {
      title: 'የመጨረሻ ፈተና',
      questions: [
        {
          questionText: 'የመጨረሻ ጥያቄ 1?',
          options: ['ሀ', 'ለ', 'ሐ', 'መ'],
          correctIndex: 0,
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Quiz Overlay Component (unchanged)
// ---------------------------------------------------------------------------
function QuizOverlay({ quiz, onClose }: { quiz: Quiz; onClose: () => void }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [completed, setCompleted] = useState(false);

  const question = quiz.questions[currentQuestion];

  const handleSubmit = () => {
    if (selectedOption === null) return;
    const correct = selectedOption === question.correctIndex;
    setIsCorrect(correct);
    setSubmitted(true);
  };

  const handleNext = () => {
    if (currentQuestion + 1 < quiz.questions.length) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedOption(null);
      setSubmitted(false);
      setIsCorrect(null);
    } else {
      setCompleted(true);
    }
  };

  if (completed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-lg font-bold text-slate-900 dark:text-white">{amh.quizCompleted}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 px-6 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
          >
            {amh.close}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{quiz.title}</h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {amh.question} {currentQuestion + 1} {amh.of} {quiz.questions.length}
          </span>
        </div>
        <p className="text-slate-700 dark:text-slate-300 mb-4">{question.questionText}</p>
        <div className="space-y-3">
          {question.options.map((opt, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => !submitted && setSelectedOption(idx)}
              disabled={submitted}
              className={`w-full text-right px-4 py-3 rounded-xl border ${
                submitted && idx === question.correctIndex
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : submitted && idx === selectedOption && !isCorrect
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : selectedOption === idx
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
              } transition`}
            >
              {opt}
            </button>
          ))}
        </div>
        {submitted && (
          <p className={`mt-3 text-sm ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
            {isCorrect ? amh.correct : amh.incorrect}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          {!submitted ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedOption === null}
              className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {amh.submitAnswer}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
            >
              {currentQuestion < quiz.questions.length - 1 ? amh.nextQuestion : amh.finish}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Course Page Component
// ---------------------------------------------------------------------------
export default function CoursePage() {
  const params = useParams();
  const courseId = Number(params.id);
  const course: Course = courses[courseId] || courses[1];

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  const progressPercent = course.progress;

  // Composite list: lessons + weekly quizzes + final exam
  const timelineItems = useMemo(() => {
    const items: { type: 'lesson' | 'weeklyQuiz' | 'finalExam'; data: any; id: string }[] = [];
    course.lessons.forEach((lesson, idx) => {
      items.push({ type: 'lesson', data: lesson, id: lesson.id });
      if ((idx + 1 === 7 || idx + 1 === 14) && course.weeklyQuizzes.length > 0) {
        const quizIndex = idx + 1 === 7 ? 0 : 1;
        if (course.weeklyQuizzes[quizIndex]) {
          items.push({ type: 'weeklyQuiz', data: course.weeklyQuizzes[quizIndex], id: `weekly-${idx + 1}` });
        }
      }
    });
    items.push({ type: 'finalExam', data: course.finalExam, id: 'final' });
    return items;
  }, [course]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-300 font-sans">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <Link href="/courses" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">{course.title}</h1>
        </div>
      </header>

      {/* Course Banner */}
      <section className={`relative bg-gradient-to-r ${course.gradient} p-6 sm:p-8 text-white`}>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="bg-white/20 backdrop-blur text-xs px-3 py-1 rounded-full">{course.category}</span>
            <span className="bg-yellow-400/90 text-yellow-900 text-xs px-3 py-1 rounded-full flex items-center gap-1">
              <Award className="h-3 w-3" /> {amh.certificateBadge}
            </span>
          </div>
          <h2 className="text-2xl font-bold mb-2">{course.title}</h2>
          <div className="flex items-center gap-4 text-sm mt-4">
            <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" />{course.lessonsCount} {amh.lessons}</span>
          </div>
          <div className="mt-4">
            <div className="w-full bg-white/30 rounded-full h-2">
              <div className="bg-white h-2 rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-xs text-white/80 mt-1">{amh.progress}: {progressPercent}%</p>
          </div>
        </div>
      </section>

      {/* Timeline List */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
          <PlayCircle className="h-6 w-6 text-emerald-600" />
          {amh.dailyLessons}
        </h3>
        <div className="space-y-4">
          {timelineItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md transition"
            >
              <div className="flex-shrink-0">
                {item.type === 'lesson' ? (
                  <BookOpen className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                ) : item.type === 'weeklyQuiz' ? (
                  <HelpCircle className="h-6 w-6 text-amber-500" />
                ) : (
                  <Award className="h-6 w-6 text-yellow-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {item.type === 'lesson' ? item.data.title : item.data.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.type === 'lesson'
                    ? 'የደርሱ ጥያቄ ይጠብቃል'
                    : item.type === 'weeklyQuiz'
                    ? amh.weeklyQuiz
                    : amh.finalExam}
                </p>
              </div>
              {item.type === 'lesson' ? (
                <Link
                  href={`/courses/${courseId}/lessons/${item.data.id}`}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition flex items-center gap-1"
                >
                  <PlayCircle className="h-4 w-4" />
                  {amh.startLesson}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveQuiz(item.data)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition flex items-center gap-1"
                >
                  <PlayCircle className="h-4 w-4" />
                  ጀምር
                </button>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Quiz Overlay */}
      {activeQuiz && (
        <QuizOverlay
          quiz={activeQuiz}
          onClose={() => setActiveQuiz(null)}
        />
      )}
    </div>
  );
}