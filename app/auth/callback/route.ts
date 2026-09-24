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
  const origin = forwardedHost
    ? `${forwardedProto ?? 'https'}://${forwardedHost}`
    : requestUrl.origin

  // ---------------------------------------------------------------------------
  // No code → user landed here without an OAuth/verification payload.
  // Redirect straight to login with an error marker.
  // ---------------------------------------------------------------------------
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth-failed', origin))
  }

  // ---------------------------------------------------------------------------
  // Build the redirect response FIRST.
  //
  // We always return this exact `response` object on success, so that the
  // auth cookies written below are carried on the outgoing redirect.
  // ---------------------------------------------------------------------------
  const cookieStore = await cookies()
  let response = NextResponse.redirect(new URL(next, origin))

  // ---------------------------------------------------------------------------
  // Supabase server client with the correct cookie wiring.
  //
  // The order inside `setAll` is CRITICAL:
  //
  //   1. Write every cookie to `response.cookies` FIRST.
  //      This ALWAYS succeeds and guarantees the browser receives them on
  //      the redirect — the single most important thing for the OAuth flow.
  //
  //   2. THEN attempt to mirror the cookies into Next.js's `cookieStore`
  //      (used by Server Components on subsequent requests).
  //
  //      `cookieStore.set()` throws when invoked from a Server Component
  //      context — the previous implementation had this call BEFORE
  //      `response.cookies.set()`, so a single throw aborted the whole
  //      `forEach` and left the browser without ANY auth cookies. That is
  //      exactly the "auth-failed" symptom we are fixing.
  // ---------------------------------------------------------------------------
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // 1) Response cookies — must always run.
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })

          // 2) Mirror to Next.js cookie store — best-effort only.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Silently ignore: this throws in Server Component contexts.
            // The response cookies above are what the browser needs.
          }
        },
      },
    }
  )

  // ---------------------------------------------------------------------------
  // Exchange the OAuth / email-verification code for a real session.
  //
  // On success, Supabase writes the auth cookies through `setAll` above.
  // We MUST return `response` (not a fresh NextResponse.redirect) so those
  // cookies actually reach the browser.
  // ---------------------------------------------------------------------------
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error(
      '[auth/callback] exchangeCodeForSession failed:',
      error.message,
      error
    )
    return NextResponse.redirect(new URL('/login?error=auth-failed', origin))
  }

  if (!data?.session) {
    console.error(
      '[auth/callback] exchangeCodeForSession returned no session:',
      data
    )
    return NextResponse.redirect(new URL('/login?error=auth-failed', origin))
  }

  return response
}