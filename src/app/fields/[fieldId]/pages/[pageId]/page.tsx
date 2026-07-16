import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PageEditor from '@/components/page-editor'

export default async function PageDetail({
  params,
}: {
  params: Promise<{ fieldId: string; pageId: string }>
}) {
  const { fieldId, pageId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: page } = await supabase
    .from('pages')
    .select('id, title, content, photo_path, ai_summary, tags')
    .eq('id', pageId)
    .eq('field_id', fieldId)
    .single()

  if (!page) {
    notFound()
  }

  let photoUrl: string | null = null
  if (page.photo_path) {
    const { data } = await supabase.storage
      .from('journal-photos')
      .createSignedUrl(page.photo_path, 3600)
    photoUrl = data?.signedUrl ?? null
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href={`/fields/${fieldId}`} className="text-sm text-gray-500 underline">
        ← Back
      </Link>
      <div className="mt-4">
        <PageEditor
          fieldId={fieldId}
          pageId={pageId}
          initialTitle={page.title ?? ''}
          initialContent={page.content ?? ''}
          photoUrl={photoUrl}
          photoPath={page.photo_path}
          initialSummary={page.ai_summary}
          initialTags={page.tags}
        />
      </div>
    </div>
  )
}
