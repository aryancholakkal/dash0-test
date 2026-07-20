'use server'

import { SpanStatusCode } from '@opentelemetry/api'
import OpenAI from 'openai'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTracer, getMeter, logger } from '@/lib/telemetry'

export type SummarizeState = { error?: string; summary?: string; tags?: string[] } | undefined

const summarizeDuration = getMeter().createHistogram('journal.summarize.duration', {
  description: 'Duration of the OpenAI journal-summary call',
  unit: 'ms',
})

export async function summarizePage(
  fieldId: string,
  pageId: string,
  content: string
): Promise<SummarizeState> {
  return getTracer().startActiveSpan('summarize page', async (span) => {
    const startTime = Date.now()
    span.setAttribute('field.id', fieldId)
    span.setAttribute('page.id', pageId)
    // Only content length is recorded — never the journal text itself (personal data).
    span.setAttribute('content.length', content.length)

    try {
      if (!content.trim()) {
        return { error: 'Write something first.' }
      }

      if (!process.env.OPENAI_API_KEY) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'ConfigError: OPENAI_API_KEY missing' })
        return { error: 'OpenAI API key is not configured on the server.' }
      }

      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        redirect('/login')
      }
      span.setAttribute('user.id', user.id)

      const model = process.env.OPENAI_MODEL || 'gpt-5.5'
      span.setAttribute('openai.model', model)

      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      let summary = ''
      let tags: string[] = []

      try {
        const response = await client.responses.create({
          model,
          instructions:
            'You summarize personal journal entries. Be concise and warm, max 2 sentences. Also suggest 2-4 short lowercase tags.',
          input: content,
          text: {
            format: {
              type: 'json_schema',
              name: 'journal_summary',
              schema: {
                type: 'object',
                properties: {
                  summary: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' }, maxItems: 4 },
                },
                required: ['summary', 'tags'],
                additionalProperties: false,
              },
              strict: true,
            },
          },
        })

        const parsed = JSON.parse(response.output_text)
        summary = typeof parsed.summary === 'string' ? parsed.summary : ''
        tags = Array.isArray(parsed.tags)
          ? parsed.tags.filter((t: unknown): t is string => typeof t === 'string')
          : []
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        span.setStatus({ code: SpanStatusCode.ERROR, message: `OpenAIError: ${error.message}` })
        logger.error('summarize.openai_call.failed', {
          'page.id': pageId,
          'openai.model': model,
          'exception.type': error.name,
          'exception.message': error.message,
        })
        return { error: error.message || 'Failed to generate summary.' }
      }

      span.setAttribute('summary.tag_count', tags.length)

      const { error } = await supabase
        .from('pages')
        .update({ ai_summary: summary, tags })
        .eq('id', pageId)
        .eq('user_id', user.id)

      if (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `SupabaseError: ${error.message}` })
        return { error: error.message }
      }

      span.setStatus({ code: SpanStatusCode.OK })
      logger.info('summarize.completed', { 'page.id': pageId, 'user.id': user.id, 'summary.tag_count': tags.length })

      revalidatePath(`/fields/${fieldId}/pages/${pageId}`)
      return { summary, tags }
    } finally {
      summarizeDuration.record(Date.now() - startTime, { 'openai.model': process.env.OPENAI_MODEL || 'gpt-5.5' })
      span.end()
    }
  })
}
