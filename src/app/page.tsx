import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/lib/actions/auth'
import { deleteField } from '@/lib/actions/fields'
import NewFieldForm from '@/components/new-field-form'
import DeleteButton from '@/components/delete-button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: fields } = await supabase
    .from('fields')
    .select('id, name, icon, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Journal</h1>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 underline">
            Log out
          </button>
        </form>
      </div>

      <NewFieldForm />

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {fields?.map((field) => (
          <div key={field.id} className="relative rounded-lg border border-gray-200 p-4">
            <Link href={`/fields/${field.id}`} className="block">
              <div className="text-2xl">{field.icon || '📁'}</div>
              <div className="mt-2 font-medium">{field.name}</div>
            </Link>
            <div className="absolute right-2 top-2">
              <DeleteButton
                confirmMessage={`Delete "${field.name}" and all its pages?`}
                onDelete={deleteField.bind(null, field.id)}
              />
            </div>
          </div>
        ))}
        {fields?.length === 0 && (
          <p className="col-span-full text-sm text-gray-500">No fields yet — add one above.</p>
        )}
      </div>
    </div>
  )
}
