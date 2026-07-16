'use client'

import { useTransition } from 'react'
import { createPage } from '@/lib/actions/pages'

export default function NewPageButton({ fieldId }: { fieldId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => createPage(fieldId))}
      className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {isPending ? 'Creating…' : '+ New page'}
    </button>
  )
}
