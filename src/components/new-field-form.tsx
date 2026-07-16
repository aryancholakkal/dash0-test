'use client'

import { useActionState } from 'react'
import { createField, type FieldFormState } from '@/lib/actions/fields'

const initialState: FieldFormState = undefined

export default function NewFieldForm() {
  const [state, action, pending] = useActionState(createField, initialState)

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Field name
        </label>
        <input
          id="name"
          name="name"
          placeholder="e.g. Gym"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="icon" className="text-sm font-medium">
          Icon
        </label>
        <input
          id="icon"
          name="icon"
          placeholder="💪"
          maxLength={4}
          className="w-16 rounded border border-gray-300 px-3 py-2"
        />
      </div>
      <button
        disabled={pending}
        type="submit"
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add field'}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  )
}
