import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deletePage } from '@/lib/actions/pages'
import DeleteButton from '@/components/delete-button'
import NewPageButton from '@/components/new-page-button'

export default async function FieldPage({
  params,
}: {
  params: Promise<{ fieldId: string }>
}) {
  const { fieldId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: field } = await supabase
    .from('fields')
    .select('id, name, icon')
    .eq('id', fieldId)
    .single()

  if (!field) {
    notFound()
  }

  const { data: pages } = await supabase
    .from('pages')
    .select('id, title, content, photo_path, created_at')
    .eq('field_id', fieldId)
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-gray-500 underline">
        ← All fields
      </Link>
      <div className="mb-8 mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {field.icon} {field.name}
        </h1>
        <NewPageButton fieldId={field.id} />
      </div>

      <div className="flex flex-col gap-3">
        {pages?.map((page) => (
          <div key={page.id} className="relative rounded-lg border border-gray-200 p-4">
            <Link href={`/fields/${fieldId}/pages/${page.id}`} className="block pr-6">
              <div className="font-medium">{page.title || 'Untitled'}</div>
              {page.content && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-500">{page.content}</p>
              )}
              {page.photo_path && <div className="mt-1 text-xs text-gray-400">📷 photo attached</div>}
              <div className="mt-1 text-xs text-gray-400">
                {new Date(page.created_at).toLocaleString()}
              </div>
            </Link>
            <div className="absolute right-2 top-2">
              <DeleteButton
                confirmMessage="Delete this page?"
                onDelete={deletePage.bind(null, fieldId, page.id)}
              />
            </div>
          </div>
        ))}
        {pages?.length === 0 && <p className="text-sm text-gray-500">No pages yet.</p>}
      </div>
    </div>
  )
}
