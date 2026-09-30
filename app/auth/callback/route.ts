// app/auth/callback/route.ts
//
// OAuth / Magic-Link callback handler for Supabase Auth.
//
// Flow:
//   1. Google (or email link) redirects here with `?code=...`.
//   2. We exchange that code for a real Supabase session.
//   3. Supabase writes `sb-*-auth-token` cookies via our setAll adapter.
//   4. We redirect the browser to /dashboard (or `?next=...`).
//
// The single most important detail: session cookies MUST be attached to
// the SAME response object that we return. Writing them to `cookieStore`
// alone is not enough — the browser only stores cookies that arrive on
// the final HTTP response, and a redirect is a brand-new response.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// Route Handlers that mutate auth state must never be statically cached.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next');

  // -------------------------------------------------------------------------
  // 1. Resolve the public origin.
  //
  //    On Vercel, `request.url` may report the internal *.vercel.app host
  //    instead of your custom domain. We prefer the forwarded headers when
  //    they're present, and fall back to the request origin for local dev.
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
  // 2. Guard against a missing `code` — this happens when the OAuth
  //    provider or email link redirected the user to the wrong URL, or
  //    when Supabase couldn't match the redirectTo against its allowlist.
  // -------------------------------------------------------------------------
  if (!code) {
    console.error('[auth/callback] Missing `code` query parameter.');
    return NextResponse.redirect(`${origin}/login?error=no-code-provided`);
  }

  // -------------------------------------------------------------------------
  // 3. Sanitize `next` — must be an internal path. Rejects absolute URLs
  //    and protocol-relative URLs like `//evil.com`.
  // -------------------------------------------------------------------------
  const safeNext =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/dashboard';

  // -------------------------------------------------------------------------
  // 4. Create the success redirect response FIRST.
  //
  //    This is the response whose `.cookies.set()` calls Supabase will use
  //    to attach the session cookies. We must build it before running the
  //    exchange, so that when `setAll` fires inside `exchangeCodeForSession`
  //    there is already a concrete response to write to.
  // -------------------------------------------------------------------------
  const successResponse = NextResponse.redirect(`${origin}${safeNext}`);

  // -------------------------------------------------------------------------
  // 5. Build the Supabase SSR client.
  //
  //    `getAll` reads the incoming request cookies — importantly, this
  //    includes the PKCE `code_verifier` cookie that the browser client
  //    wrote before redirecting the user to Google.
  //
  //    `setAll` writes the outgoing session cookies. We attach them
  //    directly to `successResponse.cookies`, NOT to the ambient cookie
  //    store. Anything written to `cookieStore.set()` in a Route Handler
  //    is discarded the moment we return a fresh NextResponse.
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
              successResponse.cookies.set(name, value, options);
            });
          } catch (err) {
            // Defensive: a cookie failure should never block the redirect.
            console.error('[auth/callback] setAll failed:', err);
          }
        },
      },
    }
  );

  // -------------------------------------------------------------------------
  // 6. Exchange the OAuth code for a session.
  //
  //    On success, `setAll` fires with the `sb-*-auth-token` cookies, and
  //    they land on `successResponse`.
  // -------------------------------------------------------------------------
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // -------------------------------------------------------------------------
  // 7. On failure, redirect back to /login with a diagnostic flag and log
  //    the error to your server logs (Vercel → Functions → Logs).
  // -------------------------------------------------------------------------
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession failed:', {
      message: error.message,
      status: error.status,
      code: error.code,
    });
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed`
    );
  }

  // -------------------------------------------------------------------------
  // 8. Success — return the redirect that already carries the session
  //    cookies. The browser stores them, and the next request to
  //    /dashboard passes through middleware with a valid session.
  // -------------------------------------------------------------------------
  return successResponse;
}