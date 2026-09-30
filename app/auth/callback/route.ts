// app/auth/callback/route.ts
//
// Google OAuth / Email Magic-Link callback handler.
//
// This route is hit by Supabase Auth after the user consents on Google's
// screen. It receives `?code=...`, exchanges that code for a real session
// (which writes auth cookies), then redirects the user to /dashboard.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// Route Handlers that read/write cookies must be dynamic — never cached.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';

  // -------------------------------------------------------------------------
  // 1. Origin resolution — Vercel / Proxy-aware
  //
  //    On Vercel, `request.url` may point to the internal deployment host
  //    (e.g. *.vercel.app) rather than your public domain. We prefer the
  //    `x-forwarded-host` header when present, falling back to the request
  //    origin for local development.
  // -------------------------------------------------------------------------
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const isLocalEnv = process.env.NODE_ENV === 'development';

  const origin = isLocalEnv
    ? requestUrl.origin
    : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : requestUrl.origin;

  // -------------------------------------------------------------------------
  // 2. Missing `code` — the OAuth provider or email link failed upstream.
  //    This is distinct from an exchange failure, so we use a different
  //    error flag for easier debugging.
  // -------------------------------------------------------------------------
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no-code-provided`);
  }

  // -------------------------------------------------------------------------
  // 3. Sanitize `next` — must be an internal path.
  //    Rejects `//evil.com` (protocol-relative) and absolute URLs.
  // -------------------------------------------------------------------------
  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  // -------------------------------------------------------------------------
  // 4. CRITICAL: Create the redirect response FIRST.
  //
  //    We need a concrete `NextResponse` object to attach the Supabase
  //    session cookies to. If we created the response *after* calling
  //    `exchangeCodeForSession()`, any cookies set via the ambient
  //    `cookieStore` would be lost — because `NextResponse.redirect()`
  //    produces a *brand new* response object that doesn't inherit the
  //    mutations made to the request-scoped cookie store.
  //
  //    That mismatch is the #1 cause of the "Google OAuth redirect loop":
  //    the code exchange succeeds, but the browser never receives the
  //    session cookies, so middleware on /dashboard sees no session and
  //    bounces the user straight back to /login.
  // -------------------------------------------------------------------------
  const response = NextResponse.redirect(`${origin}${safeNext}`);

  // -------------------------------------------------------------------------
  // 5. Read the Next.js cookie store & create the Supabase SSR client.
  //
  //    - `getAll()` reads incoming request cookies (needed for the PKCE
  //      `code_verifier` cookie written by `createBrowserClient` on the
  //      login page).
  //    - `setAll()` writes the *outgoing* session cookies — and we write
  //      them directly onto `response.cookies`, guaranteeing they ride
  //      along with the redirect.
  // -------------------------------------------------------------------------
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Write to the redirect response — NOT the ambient cookie store.
              response.cookies.set(name, value, options);
            });
          } catch (error) {
            // Should never throw in a Route Handler, but we guard anyway so
            // a cookie failure never blocks the user's redirect.
            console.error('[auth/callback] Cookie set error:', error);
          }
        },
      },
    }
  );

  // -------------------------------------------------------------------------
  // 6. Exchange the OAuth / email `code` for a real session.
  //
  //    On success, `setAll` above fires with the new `sb-*-auth-token`
  //    cookies, and they get attached to `response`.
  // -------------------------------------------------------------------------
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // -------------------------------------------------------------------------
  // 7. On failure — send the user back to /login with an error flag.
  //    We log the full error message so you can inspect it in Vercel logs.
  // -------------------------------------------------------------------------
  if (error) {
    console.error(
      '[auth/callback] exchangeCodeForSession failed:',
      error.message,
      error.status,
      error.code
    );
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // -------------------------------------------------------------------------
  // 8. Success — return the redirect response that now carries the session
  //    cookies. The browser stores them, and the next request to
  //    /dashboard passes through middleware with a valid session.
  // -------------------------------------------------------------------------
  return response;
}