// middleware.ts
//
// Supabase Auth middleware for Next.js App Router.
//
// Responsibilities:
//   1. Refresh the Supabase session cookies on every request so Server
//      Components always see a fresh, valid session.
//   2. Redirect unauthenticated users away from /dashboard/* → /login.
//   3. Redirect authenticated users away from /login and /register
//      → /dashboard.
//   4. Never intercept /auth/callback, static assets, images, or _next
//      internals — those are excluded in `config.matcher` below.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // -------------------------------------------------------------------------
  // 1. Bootstrap the response object.
  //
  //    This is the response we will mutate as Supabase refreshes cookies.
  //    When we need to redirect, we replace it with a fresh redirect
  //    response and re-attach any cookies Supabase set during refresh.
  // -------------------------------------------------------------------------
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // -------------------------------------------------------------------------
  // 2. Create the Supabase SSR client.
  //
  //    `getAll()` reads incoming cookies (needed so Supabase can see the
  //    current session and the PKCE code_verifier).
  //
  //    `setAll()` writes refreshed cookies — both onto the *incoming*
  //    request (so Server Components downstream see them) and onto the
  //    *outgoing* response (so the browser stores them).
  // -------------------------------------------------------------------------
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update the incoming request cookies first…
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // …then rebuild the response so downstream sees them…
          response = NextResponse.next({
            request,
          });
          // …and finally write them onto the outgoing response.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // -------------------------------------------------------------------------
  // 3. IMPORTANT: Do NOT insert any logic between `createServerClient` and
  //    `getUser()`. A stray `await` or early return here is the classic
  //    cause of "random logout" bugs, because Supabase's cookie refresh
  //    runs as a side effect of `getUser()`.
  //
  //    `getUser()` (not `getSession()`) re-validates the JWT with the
  //    Supabase Auth server. This is the only safe way to trust the user
  //    identity in middleware.
  // -------------------------------------------------------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // -------------------------------------------------------------------------
  // 4. Route classification.
  // -------------------------------------------------------------------------
  const isDashboardRoute =
    pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  const isAuthEntryRoute = pathname === '/login' || pathname === '/register';

  // -------------------------------------------------------------------------
  // 5. Guard /dashboard/* — unauthenticated users go to /login.
  //
  //    We preserve the intended destination in a `redirectedFrom` query
  //    parameter so the login page (or its post-login logic) can send the
  //    user back after they authenticate.
  // -------------------------------------------------------------------------
  if (isDashboardRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('redirectedFrom', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // -------------------------------------------------------------------------
  // 6. Guard /login and /register — authenticated users go to /dashboard.
  //
  //    This prevents an authenticated user from seeing the login form
  //    again and, more importantly, breaks any potential redirect loop
  //    between /login and /dashboard.
  // -------------------------------------------------------------------------
  if (isAuthEntryRoute && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  // -------------------------------------------------------------------------
  // 7. All other routes: return the response carrying refreshed cookies.
  // -------------------------------------------------------------------------
  return response;
}

// ---------------------------------------------------------------------------
// Matcher — run on every route EXCEPT:
//   • _next/static   (build artifacts)
//   • _next/image    (image optimization)
//   • favicon.ico
//   • /auth/callback (must be allowed through to exchange the OAuth code —
//                     if middleware redirects here, PKCE breaks)
//   • common static file extensions
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     *   - _next/static (static files)
     *   - _next/image (image optimization files)
     *   - favicon.ico (favicon file)
     *   - auth/callback (OAuth / magic-link callback — MUST be public)
     *   - files with common static extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|otf)$).*)',
  ],
};