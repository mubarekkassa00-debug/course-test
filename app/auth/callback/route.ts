import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  // 1. Vercel ላይ ትክክለኛውን ዶሜን (Domain) ለማግኘት
  const forwardedHost = request.headers.get('x-forwarded-host')
  const origin = forwardedHost ? `https://${forwardedHost}` : requestUrl.origin

  // Code ከሌለ በቀጥታ ወደ Login ይመልሰዋል
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no-code-provided`)
  }

  // 2. የ Next.js Cookie Storeን ማንበብ
  const cookieStore = await cookies()

  // 3. Supabase SSR Client መፍጠር እና ኩኪዎችን ማስተካከል
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
            // Route Handler ውስጥ ስለሆነ ይህ ብዙ ጊዜ አይፈጠርም
            console.error("Cookie setting error:", error)
          }
        },
      },
    }
  )

  // 4. Code ወደ Session መቀየር (Auth Code Exchange)
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  // ኤረር ካጋጠመ ወደ ሎጊን ገጽ ከነ ምክኒያቱ ይመልሰዋል
  if (error) {
    console.error('Supabase Auth Callback Error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth-failed`)
  }

  // 5. ያለ ምንም ችግር Session ከተፈጠረ፣ ወደ ዳሽቦርድ (ወይም ወደ ተፈለገው ገጽ) ያስገባዋል
  return NextResponse.redirect(`${origin}${next}`)
}