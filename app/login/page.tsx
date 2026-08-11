'use client';

import { useState, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Mail,
  Lock,
  LogIn,
  Eye,
  EyeOff,
  Loader2,
  GraduationCap,
  BookOpen,
  Library,
  AlertCircle,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErrorMessage(null);

      // Basic validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        setErrorMessage('ትክክለኛ የኢሜይል አድራሻ ያስገቡ');
        return;
      }
      if (!password) {
        setErrorMessage('የይለፍ ቃል ያስገቡ');
        return;
      }

      try {
        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setErrorMessage('ኢሜይል ወይም የይለፍ ቃል ትክክል አይደለም');
          } else {
            setErrorMessage(error.message);
          }
          return;
        }

        // Redirect to dashboard on success
        router.push('/dashboard');
        router.refresh(); // ensure fresh server state
      } catch (err) {
        setErrorMessage('ያልተጠበቀ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ');
        console.error('Login error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, router]
  );

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left panel – Branding (hidden on mobile) */}
          <div className="relative hidden lg:flex flex-col justify-center bg-gradient-to-br from-emerald-700 to-emerald-900 text-white p-10 lg:p-12">
            <div className="mb-8">
              <h1 className="text-4xl font-extrabold tracking-tight">
                በሲራ <span className="font-light">(Basira)</span>
              </h1>
              <p className="mt-4 text-emerald-100 text-lg leading-relaxed">
                የእርስዎ የተቀናጀ የእውቀት እና የትምህርት ማዕከል
              </p>
            </div>

            <div className="space-y-5 mt-4">
              <div className="flex items-center gap-3">
                <GraduationCap className="h-6 w-6 text-emerald-200" />
                <span className="text-lg font-medium">Premium Academy</span>
              </div>
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-emerald-200" />
                <span className="text-lg font-medium">Quran Center</span>
              </div>
              <div className="flex items-center gap-3">
                <Library className="h-6 w-6 text-emerald-200" />
                <span className="text-lg font-medium">Digital Library</span>
              </div>
            </div>

            <div className="mt-10 text-emerald-200 text-sm opacity-80">
              © {new Date().getFullYear()} Basira. All rights reserved.
            </div>
          </div>

          {/* Right panel – Login form */}
          <div className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center">
            {/* Mobile branding (visible only on small screens) */}
            <div className="lg:hidden text-center mb-8">
              <h1 className="text-3xl font-extrabold text-emerald-800">
                በሲራ <span className="font-light text-slate-600">(Basira)</span>
              </h1>
              <p className="mt-2 text-slate-500 text-sm">
                Premium Academy • Quran Center • Digital Library
              </p>
            </div>

            <h2 className="text-2xl font-bold text-slate-800 mb-2">ወደ መለያዎ ይግቡ</h2>
            <p className="text-slate-500 text-sm mb-6">
              ለመቀጠል የእርስዎን ኢሜይል እና የይለፍ ቃል ያስገቡ
            </p>

            {/* Error alert */}
            {errorMessage && (
              <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  ኢሜይል አድራሻ
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  የይለፍ ቃል
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    በመግባት ላይ...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    ይግቡ
                  </>
                )}
              </button>
            </form>

            {/* Register link */}
            <p className="mt-6 text-center text-sm text-slate-500">
              መለያ የሎትም?{' '}
              <a
                href="/register"
                className="font-semibold text-emerald-600 hover:text-emerald-500 transition-colors"
              >
                አዲስ መለያ ይፍጠሩ
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}