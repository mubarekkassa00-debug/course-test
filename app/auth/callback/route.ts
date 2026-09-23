// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  // ---------------------------------------------------------------------------
  // Sanitise the `next` param to prevent open-redirects.
  //
  // Only allow paths that start with a single `/` and are NOT protocol-
  // relative (`//evil.com`). Anything else falls back to `/dashboard`.
  // ---------------------------------------------------------------------------
  const rawNext = requestUrl.searchParams.get('next') ?? '/dashboard'
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/dashboard'

  // ---------------------------------------------------------------------------
  // Resolve the true origin.
  //
  // On Vercel (and most reverse proxies) `requestUrl.origin` points at the
  // internal deployment host, not the public domain. `x-forwarded-host` (and
  // `x-forwarded-proto`) give us the correct external URL. We fall back to
  // the request origin for local development.
  // ---------------------------------------------------------------------------
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const origin =
    forwardedHost
      ? `${forwardedProto ?? 'https'}://${forwardedHost}`
      : requestUrl.origin

  // ---------------------------------------------------------------------------
  // No code → user landed here without an OAuth/verification payload.
  // Redirect straight to login with an error marker.
  // ---------------------------------------------------------------------------
  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=auth-failed', origin)
    )
  }

  // ---------------------------------------------------------------------------
  // Build a Supabase server client with Next.js's cookie store.
  //
  // The `setAll` callback writes cookies to BOTH:
  //   • `cookieStore`  → so Server Components on the next request can read them
  //   • `response`     → so the browser receives them on this redirect
  //
  // Skipping either side breaks the session — the safest implementation
  // writes to both.
  // ---------------------------------------------------------------------------
  const cookieStore = await cookies()
  let response = NextResponse.redirect(new URL(next, origin))

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
              response.cookies.set(name, value, options)
            })
          } catch {
            // `cookieStore.set` throws when called from a Server Component
            // context. The `response.cookies.set` calls above still ensure the
            // browser receives the cookies, so we can safely ignore this.
          }
        },
      },
    }
  )

  // ---------------------------------------------------------------------------
  // Exchange the OAuth / email-verification code for a real session.
  // On success, Supabase writes the auth cookies via `setAll` above.
  // ---------------------------------------------------------------------------
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession failed:', error)
    return NextResponse.redirect(
      new URL('/login?error=auth-failed', origin)
    )
  }

  return response
}