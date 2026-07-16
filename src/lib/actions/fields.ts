'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type FieldFormState = { error?: string } | undefined

export async function createField(
  _state: FieldFormState,
  formData: FormData
): Promise<FieldFormState> {
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

  const { error } = await supabase.from('fields').insert({
    user_id: user.id,
    name,
    icon,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
}

export async function deleteField(fieldId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  await supabase.from('fields').delete().eq('id', fieldId).eq('user_id', user.id)

  revalidatePath('/')
}
