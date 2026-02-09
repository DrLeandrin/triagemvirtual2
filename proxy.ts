import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { jwtDecode } from 'jwt-decode'

interface JWTPayload {
  user_role?: string
  [key: string]: any
}

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  console.log(`[proxy] ${pathname} | user: ${user?.email ?? 'none'}`)

  // Helper: redirect that preserves refreshed session cookies
  const safeRedirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url))
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value)
    })
    return response
  }

  // Public routes - no protection needed
  const publicRoutes = ['/login', '/signup', '/auth/callback']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  const isStaticAsset = pathname.startsWith('/_next') || pathname === '/favicon.ico'

  if (isPublicRoute || isStaticAsset) {
    return supabaseResponse
  }

  // Helper function to get user role from JWT
  const getUserRole = async (): Promise<string | null> => {
    if (!user) return null

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.log('[proxy] No access_token in session')
        return null
      }

      const decoded = jwtDecode<JWTPayload>(session.access_token)
      console.log('[proxy] JWT decoded role:', decoded.user_role)
      return decoded.user_role || null
    } catch (error) {
      console.error('[proxy] Error decoding JWT:', error)
      return null
    }
  }

  // Root path - redirect based on role
  if (pathname === '/') {
    if (!user) {
      return safeRedirect('/login')
    }

    const role = await getUserRole()
    if (role === 'doctor') {
      return safeRedirect('/doctor/dashboard')
    }
    return safeRedirect('/patient/dashboard')
  }

  // Patient routes - patients only
  if (pathname.startsWith('/patient')) {
    if (!user) {
      return safeRedirect('/login')
    }

    const role = await getUserRole()
    if (role === 'doctor') {
      // Doctors should not access patient area
      return safeRedirect('/doctor/dashboard')
    }

    // Consent gate — skip for consent pages themselves
    const consentExempt = ['/patient/consent']
    const needsConsent = !consentExempt.some(route => pathname.startsWith(route))

    if (needsConsent) {
      const { data: consent } = await supabase
        .from('consent_records')
        .select('id')
        .eq('user_id', user.id)
        .is('withdrawn_at', null)
        .limit(1)
        .maybeSingle()

      if (!consent) {
        return safeRedirect('/patient/consent')
      }
    }

    return supabaseResponse
  }

  // Doctor routes - doctors only
  if (pathname.startsWith('/doctor')) {
    if (!user) {
      return safeRedirect('/login')
    }

    const role = await getUserRole()
    if (role !== 'doctor') {
      // Patients cannot access doctor area
      return safeRedirect('/patient/dashboard')
    }
    return supabaseResponse
  }

  // All other routes - require authentication
  if (!user) {
    return safeRedirect('/login')
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
}
