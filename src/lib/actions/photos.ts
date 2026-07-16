'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type PhotoState = { error?: string } | undefined

export async function uploadPhoto(
  fieldId: string,
  pageId: string,
  _state: PhotoState,
  formData: FormData
): Promise<PhotoState> {
  const file = formData.get('photo')

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a photo first.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${user.id}/${pageId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('journal-photos')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    return { error: uploadError.message }
  }

  const { error: updateError } = await supabase
    .from('pages')
    .update({ photo_path: path })
    .eq('id', pageId)
    .eq('user_id', user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath(`/fields/${fieldId}/pages/${pageId}`)
  return undefined
}

export async function removePhoto(fieldId: string, pageId: string, photoPath: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  await supabase.storage.from('journal-photos').remove([photoPath])
  await supabase
    .from('pages')
    .update({ photo_path: null })
    .eq('id', pageId)
    .eq('user_id', user.id)

  revalidatePath(`/fields/${fieldId}/pages/${pageId}`)
}
