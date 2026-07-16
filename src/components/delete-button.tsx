'use client'

import { useTransition } from 'react'

export default function DeleteButton({
  confirmMessage,
  onDelete,
  className,
}: {
  confirmMessage: string
  onDelete: () => Promise<void>
  className?: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm(confirmMessage)) {
          startTransition(() => {
            onDelete()
          })
        }
      }}
      className={className ?? 'text-xs text-gray-400 hover:text-red-600 disabled:opacity-50'}
      aria-label="Delete"
    >
      {isPending ? '…' : '✕'}
    </button>
  )
}
