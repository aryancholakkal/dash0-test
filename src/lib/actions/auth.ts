'use server'

import { SpanStatusCode } from '@opentelemetry/api'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTracer, logger } from '@/lib/telemetry'

export type AuthState = { error?: string; message?: string } | undefined

export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  return getTracer().startActiveSpan('login', async (span) => {
    span.setAttribute('auth.method', 'password')
    try {
      const email = String(formData.get('email') ?? '')
      const password = String(formData.get('password') ?? '')

      const supabase = await createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        // Never attach email/password to telemetry — see sensitive-data rules.
        span.setStatus({ code: SpanStatusCode.ERROR, message: `AuthError: ${error.message}` })
        return { error: error.message }
      }

      span.setAttribute('user.id', data.user.id)
      span.setStatus({ code: SpanStatusCode.OK })
      logger.info('user.login', { 'user.id': data.user.id })
    } finally {
      span.end()
    }
    redirect('/')
  })
}

export async function signup(_state: AuthState, formData: FormData): Promise<AuthState> {
  return getTracer().startActiveSpan('signup', async (span) => {
    span.setAttribute('auth.method', 'password')
    let shouldRedirect = false
    try {
      const email = String(formData.get('email') ?? '')
      const password = String(formData.get('password') ?? '')

      const supabase = await createClient()
      const { data, error } = await supabase.auth.signUp({ email, password })

      if (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `AuthError: ${error.message}` })
        return { error: error.message }
      }

      span.setAttribute('user.id', data.user?.id ?? 'unknown')

      if (!data.session) {
        span.setStatus({ code: SpanStatusCode.OK })
        logger.info('user.signup.pending_confirmation', { 'user.id': data.user?.id ?? 'unknown' })
        return { message: 'Check your email to confirm your account, then log in.' }
      }

      span.setStatus({ code: SpanStatusCode.OK })
      logger.info('user.signup', { 'user.id': data.user?.id ?? 'unknown' })
      shouldRedirect = true
    } finally {
      span.end()
    }
    if (shouldRedirect) redirect('/')
  })
}

export async function logout() {
  return getTracer().startActiveSpan('logout', async (span) => {
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) span.setAttribute('user.id', user.id)

      await supabase.auth.signOut()
      span.setStatus({ code: SpanStatusCode.OK })
      logger.info('user.logout', { 'user.id': user?.id ?? 'unknown' })
    } finally {
      span.end()
    }
    redirect('/login')
  })
}
