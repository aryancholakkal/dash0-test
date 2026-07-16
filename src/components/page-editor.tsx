'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePage, type PageFormState } from '@/lib/actions/pages'
import { uploadPhoto, removePhoto, type PhotoState } from '@/lib/actions/photos'
import { summarizePage } from '@/lib/actions/summarize'

const updateInitial: PageFormState = undefined
const photoInitial: PhotoState = undefined

export default function PageEditor({
  fieldId,
  pageId,
  initialTitle,
  initialContent,
  photoUrl,
  photoPath,
  initialSummary,
  initialTags,
}: {
  fieldId: string
  pageId: string
  initialTitle: string
  initialContent: string
  photoUrl: string | null
  photoPath: string | null
  initialSummary: string | null
  initialTags: string[] | null
}) {
  const router = useRouter()
  const boundUpdatePage = updatePage.bind(null, fieldId, pageId)
  const [saveState, saveAction, savePending] = useActionState(boundUpdatePage, updateInitial)

  const boundUploadPhoto = uploadPhoto.bind(null, fieldId, pageId)
  const [photoState, photoAction, photoPending] = useActionState(boundUploadPhoto, photoInitial)

  const [content, setContent] = useState(initialContent)
  const [summary, setSummary] = useState(initialSummary ?? '')
  const [tags, setTags] = useState<string[]>(initialTags ?? [])
  const [summarizeError, setSummarizeError] = useState<string | null>(null)
  const [isSummarizing, startSummarizing] = useTransition()
  const [isRemovingPhoto, startRemovingPhoto] = useTransition()

  return (
    <div className="flex flex-col gap-6">
      <form action={saveAction} className="flex flex-col gap-3">
        <input
          name="title"
          defaultValue={initialTitle}
          placeholder="Title"
          className="rounded border border-gray-300 px-3 py-2 text-lg font-medium"
        />
        <textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          placeholder="Write your entry…"
          className="rounded border border-gray-300 px-3 py-2"
        />
        <div className="flex items-center gap-3">
          <button
            disabled={savePending}
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {savePending ? 'Saving…' : 'Save'}
          </button>
          {saveState?.ok && <span className="text-sm text-green-700">Saved</span>}
          {saveState?.error && <span className="text-sm text-red-600">{saveState.error}</span>}
        </div>
      </form>

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium">Photo</h2>
        {photoUrl && (
          <div className="flex flex-col items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Journal entry" className="max-h-80 rounded border" />
            <button
              type="button"
              disabled={isRemovingPhoto}
              onClick={() =>
                photoPath &&
                startRemovingPhoto(async () => {
                  await removePhoto(fieldId, pageId, photoPath)
                  router.refresh()
                })
              }
              className="text-xs text-gray-500 underline disabled:opacity-50"
            >
              {isRemovingPhoto ? 'Removing…' : 'Remove photo'}
            </button>
          </div>
        )}
        <form action={photoAction} className="flex flex-wrap items-center gap-3">
          <input type="file" name="photo" accept="image/*" capture="environment" className="text-sm" />
          <button
            disabled={photoPending}
            type="submit"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {photoPending ? 'Uploading…' : photoUrl ? 'Replace photo' : 'Upload photo'}
          </button>
        </form>
        {photoState?.error && <p className="text-sm text-red-600">{photoState.error}</p>}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">AI summary</h2>
          <button
            type="button"
            disabled={isSummarizing}
            onClick={() =>
              startSummarizing(async () => {
                setSummarizeError(null)
                const result = await summarizePage(fieldId, pageId, content)
                if (result?.error) {
                  setSummarizeError(result.error)
                } else if (result) {
                  setSummary(result.summary ?? '')
                  setTags(result.tags ?? [])
                }
              })
            }
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {isSummarizing ? 'Generating…' : 'Generate summary'}
          </button>
        </div>
        {summary && <p className="text-sm text-gray-700">{summary}</p>}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {tag}
              </span>
            ))}
          </div>
        )}
        {summarizeError && <p className="text-sm text-red-600">{summarizeError}</p>}
      </div>
    </div>
  )
}
