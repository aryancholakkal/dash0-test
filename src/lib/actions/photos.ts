'use server'

import { SpanStatusCode } from '@opentelemetry/api'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTracer, logger } from '@/lib/telemetry'

export type PhotoState = { error?: string } | undefined

export async function uploadPhoto(
  fieldId: string,
  pageId: string,
  _state: PhotoState,
  formData: FormData
): Promise<PhotoState> {
  return getTracer().startActiveSpan('upload photo', async (span) => {
    span.setAttribute('field.id', fieldId)
    span.setAttribute('page.id', pageId)
    try {
      const file = formData.get('photo')

      if (!(file instanceof File) || file.size === 0) {
        return { error: 'Choose a photo first.' }
      }
      span.setAttribute('photo.size_bytes', file.size)
      span.setAttribute('photo.content_type', file.type)

      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        redirect('/login')
      }
      span.setAttribute('user.id', user.id)

      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/${pageId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('journal-photos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `StorageError: ${uploadError.message}` })
        logger.error('photo.upload.failed', { 'page.id': pageId, 'exception.message': uploadError.message })
        return { error: uploadError.message }
      }

      const { error: updateError } = await supabase
        .from('pages')
        .update({ photo_path: path })
        .eq('id', pageId)
        .eq('user_id', user.id)

      if (updateError) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `SupabaseError: ${updateError.message}` })
        return { error: updateError.message }
      }

      span.setStatus({ code: SpanStatusCode.OK })
      logger.info('photo.uploaded', { 'page.id': pageId, 'user.id': user.id, 'photo.size_bytes': file.size })

      revalidatePath(`/fields/${fieldId}/pages/${pageId}`)
      return undefined
    } finally {
      span.end()
    }
  })
}

export async function removePhoto(fieldId: string, pageId: string, photoPath: string) {
  return getTracer().startActiveSpan('remove photo', async (span) => {
    span.setAttribute('field.id', fieldId)
    span.setAttribute('page.id', pageId)
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        redirect('/login')
      }
      span.setAttribute('user.id', user.id)

      await supabase.storage.from('journal-photos').remove([photoPath])
      await supabase.from('pages').update({ photo_path: null }).eq('id', pageId).eq('user_id', user.id)

      span.setStatus({ code: SpanStatusCode.OK })
      logger.info('photo.removed', { 'page.id': pageId, 'user.id': user.id })
      revalidatePath(`/fields/${fieldId}/pages/${pageId}`)
    } finally {
      span.end()
    }
  })
}
