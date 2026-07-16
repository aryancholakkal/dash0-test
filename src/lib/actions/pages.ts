'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createPage(fieldId: string) {
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

  revalidatePath(`/fields/${fieldId}`)
  redirect(`/fields/${fieldId}/pages/${data.id}`)
}

export async function deletePage(fieldId: string, pageId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  await supabase.from('pages').delete().eq('id', pageId).eq('user_id', user.id)

  revalidatePath(`/fields/${fieldId}`)
}

export type PageFormState = { error?: string; ok?: boolean } | undefined

export async function updatePage(
  fieldId: string,
  pageId: string,
  _state: PageFormState,
  formData: FormData
): Promise<PageFormState> {
  const title = String(formData.get('title') ?? '').trim()
  const content = String(formData.get('content') ?? '')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase
    .from('pages')
    .update({ title, content })
    .eq('id', pageId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/fields/${fieldId}`)
  revalidatePath(`/fields/${fieldId}/pages/${pageId}`)
  return { ok: true }
}
