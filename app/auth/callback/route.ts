import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  // -------------------------------------------------------------------------
  // 1. Vercel / Proxy-aware origin resolution
  //    (On Vercel, `request.url` may point to the internal deployment host,
  //     so we prefer the x-forwarded-host header when available.)
  // -------------------------------------------------------------------------
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const isLocalEnv = process.env.NODE_ENV === 'development'

  const origin = isLocalEnv
    ? requestUrl.origin
    : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : requestUrl.origin

  // -------------------------------------------------------------------------
  // 2. Missing `code` — OAuth provider or email link failed upstream
  // -------------------------------------------------------------------------
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no-code-provided`)
  }

  // -------------------------------------------------------------------------
  // 3. Read the Next.js cookie store & create the Supabase SSR client
  // -------------------------------------------------------------------------
  const cookieStore = await cookies()

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
            })
          } catch (error) {
            // In a Route Handler this normally does not throw, but we guard
            // against it so a cookie failure never blocks the redirect.
            console.error('Cookie set error in auth callback:', error)
          }
        },
      },
    }
  )

  // -------------------------------------------------------------------------
  // 4. Exchange the OAuth / email code for a real session
  // -------------------------------------------------------------------------
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  // -------------------------------------------------------------------------
  // 5. On failure — send the user back to /login with an error flag
  // -------------------------------------------------------------------------
  if (error) {
    console.error('Supabase Auth Callback Error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // -------------------------------------------------------------------------
  // 6. Sanitize `next` — must be an internal path (starts with `/`,
  //    but not `//` which would be treated as a protocol-relative URL)
  // -------------------------------------------------------------------------
  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  // -------------------------------------------------------------------------
  // 7. Success — session cookies are now set on the response,
  //    redirect the user to the dashboard (or the requested `next` path)
  // -------------------------------------------------------------------------
  return NextResponse.redirect(`${origin}${safeNext}`)
}