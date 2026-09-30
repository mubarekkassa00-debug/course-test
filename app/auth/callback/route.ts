import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  // -------------------------------------------------------------------------
  // 1. Origin resolution
  // -------------------------------------------------------------------------
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const isLocalEnv = process.env.NODE_ENV === 'development'

  const origin = isLocalEnv
    ? requestUrl.origin
    : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : requestUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no-code-provided`)
  }

  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  // -------------------------------------------------------------------------
  // 2. CREATE THE REDIRECT RESPONSE FIRST
  // -------------------------------------------------------------------------
  const response = NextResponse.redirect(`${origin}${safeNext}`)
  const cookieStore = await cookies()

  // -------------------------------------------------------------------------
  // 3. CREATE SUPABASE CLIENT & ATTACH COOKIES DIRECTLY TO THE RESPONSE
  // -------------------------------------------------------------------------
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              // CRITICAL FIX: Attach cookies to the redirect response object!
              response.cookies.set(name, value, options)
            })
          } catch (error) {
            console.error('Cookie set error in auth callback:', error)
          }
        },
      },
    }
  )

  // -------------------------------------------------------------------------
  // 4. Exchange code for session
  // -------------------------------------------------------------------------
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Supabase Auth Callback Error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // -------------------------------------------------------------------------
  // 5. Return the response with cookies properly attached
  // -------------------------------------------------------------------------
  return response
}