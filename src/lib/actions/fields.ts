'use server'

import { SpanStatusCode } from '@opentelemetry/api'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTracer, logger } from '@/lib/telemetry'

export type FieldFormState = { error?: string } | undefined

export async function createField(
  _state: FieldFormState,
  formData: FormData
): Promise<FieldFormState> {
  return getTracer().startActiveSpan('create field', async (span) => {
    try {
      const name = String(formData.get('name') ?? '').trim()
      const icon = String(formData.get('icon') ?? '').trim() || null

      if (!name) {
        return { error: 'Name is required.' }
      }

      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        redirect('/login')
      }
      span.setAttribute('user.id', user.id)

      const { data, error } = await supabase
        .from('fields')
        .insert({ user_id: user.id, name, icon })
        .select('id')
        .single()

      if (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `SupabaseError: ${error.message}` })
        logger.error('field.create.failed', { 'user.id': user.id, 'exception.message': error.message })
        return { error: error.message }
      }

      span.setAttribute('field.id', data.id)
      span.setStatus({ code: SpanStatusCode.OK })
      logger.info('field.created', { 'field.id': data.id, 'user.id': user.id })
      revalidatePath('/')
    } finally {
      span.end()
    }
  })
}

export async function deleteField(fieldId: string) {
  return getTracer().startActiveSpan('delete field', async (span) => {
    span.setAttribute('field.id', fieldId)
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        redirect('/login')
      }
      span.setAttribute('user.id', user.id)

      const { error } = await supabase.from('fields').delete().eq('id', fieldId).eq('user_id', user.id)

      if (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `SupabaseError: ${error.message}` })
        logger.error('field.delete.failed', { 'field.id': fieldId, 'exception.message': error.message })
        return
      }

      span.setStatus({ code: SpanStatusCode.OK })
      logger.info('field.deleted', { 'field.id': fieldId, 'user.id': user.id })
      revalidatePath('/')
    } finally {
      span.end()
    }
  })
}
