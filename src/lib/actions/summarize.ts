'use server'

import OpenAI from 'openai'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type SummarizeState = { error?: string; summary?: string; tags?: string[] } | undefined

export async function summarizePage(
  fieldId: string,
  pageId: string,
  content: string
): Promise<SummarizeState> {
  if (!content.trim()) {
    return { error: 'Write something first.' }
  }

  if (!process.env.OPENAI_API_KEY) {
    return { error: 'OpenAI API key is not configured on the server.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let summary = ''
  let tags: string[] = []

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.5',
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
    return { error: err instanceof Error ? err.message : 'Failed to generate summary.' }
  }

  const { error } = await supabase
    .from('pages')
    .update({ ai_summary: summary, tags })
    .eq('id', pageId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/fields/${fieldId}/pages/${pageId}`)
  return { summary, tags }
}
