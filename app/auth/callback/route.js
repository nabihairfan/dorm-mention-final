import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://secure.almostcrackd.ai',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY3VyZSIsImV4cCI6MjI0NzE4MzYwMH0.f-PaHNNbmZqcW1ram1vb3d5ZmJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDc0ODg2MDB9',
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) { cookieStore.set({ name, value, ...options }) },
          remove(name, options) { cookieStore.set({ name, value: '', ...options }) },
        },
      }
    )

    // THIS IS THE KEY STEP: It swaps the code for a real user session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Once logged in, send them to the homepage (protected route)
      return NextResponse.redirect(`${origin}/`)
    }
  }

  // If login fails, send them back to the login page
  return NextResponse.redirect(`${origin}/login?error=could_not_log_in`)
}