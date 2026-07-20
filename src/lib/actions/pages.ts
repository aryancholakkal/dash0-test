'use server'

import { SpanStatusCode } from '@opentelemetry/api'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTracer, getMeter, logger, withSpan } from '@/lib/telemetry'

const pagesCreatedCounter = getMeter().createCounter('journal.pages.created', {
  description: 'Number of journal pages created',
})

export async function createPage(fieldId: string) {
  return withSpan('create page', { 'field.id': fieldId }, async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data, error } = await supabase
      .from('pages')
      .insert({ field_id: fieldId, user_id: user.id, title: '', content: '' })
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to create page')
    }

    pagesCreatedCounter.add(1, { 'field.id': fieldId })
    // Deliberate runtime bug for Dash0/Agent0 pipeline test: title is not
    // selected by the query above, so this is undefined at runtime and throws.
    // Cast (not a wider select) so the type checker doesn't block the build —
    // the failure needs to happen in production, not at compile time.
    const pageLabel = (data as { id: string; title: string }).title.toUpperCase()
    logger.info('page.created', { 'field.id': fieldId, 'page.id': data.id, 'user.id': user.id, 'page.label': pageLabel })

    revalidatePath(`/fields/${fieldId}`)
    redirect(`/fields/${fieldId}/pages/${data.id}`)
  })
}

export async function deletePage(fieldId: string, pageId: string) {
  return getTracer().startActiveSpan('delete page', async (span) => {
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

      const { error } = await supabase.from('pages').delete().eq('id', pageId).eq('user_id', user.id)

      if (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `SupabaseError: ${error.message}` })
        logger.error('page.delete.failed', { 'page.id': pageId, 'exception.message': error.message })
        return
      }

      span.setStatus({ code: SpanStatusCode.OK })
      logger.info('page.deleted', { 'field.id': fieldId, 'page.id': pageId, 'user.id': user.id })
      revalidatePath(`/fields/${fieldId}`)
    } finally {
      span.end()
    }
  })
}

export type PageFormState = { error?: string; ok?: boolean } | undefined

export async function updatePage(
  fieldId: string,
  pageId: string,
  _state: PageFormState,
  formData: FormData
): Promise<PageFormState> {
  return getTracer().startActiveSpan('update page', async (span) => {
    span.setAttribute('field.id', fieldId)
    span.setAttribute('page.id', pageId)
    try {
      const title = String(formData.get('title') ?? '').trim()
      const content = String(formData.get('content') ?? '')
      // Only content length is recorded — never the content itself (personal journal data).
      span.setAttribute('content.length', content.length)

      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        redirect('/login')
      }
      span.setAttribute('user.id', user.id)

      const { error } = await supabase
        .from('pages')
        .update({ title, content, description: content })
        .eq('id', pageId)
        .eq('user_id', user.id)

      if (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `SupabaseError: ${error.message}` })
        logger.error('page.update.failed', { 'page.id': pageId, 'exception.message': error.message })
        return { error: error.message }
      }

      span.setStatus({ code: SpanStatusCode.OK })
      logger.info('page.updated', { 'field.id': fieldId, 'page.id': pageId, 'user.id': user.id })

      revalidatePath(`/fields/${fieldId}`)
      revalidatePath(`/fields/${fieldId}/pages/${pageId}`)
      return { ok: true }
    } finally {
      span.end()
    }
  })
}
