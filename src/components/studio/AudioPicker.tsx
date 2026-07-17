/**
 * AudioPicker — the site-wide ElevenLabs audio experience.
 *
 * Three tabs first: No voiceover / AI voiceover / Upload audio.
 *   - AI voiceover browses the FULL merged voice list (the account's own
 *     voices + ElevenLabs' featured shared library, ~100+). Gender comes
 *     first — voices only appear after a gender is picked — then accent and
 *     age narrow further, with text search on top.
 *   - Upload audio takes the user's own MP3/WAV/M4A and replaces the ad's
 *     audio track at assembly.
 * Below the tabs, an ElevenLabs Music section (works with ANY tab): a prompt
 * for a background track generated to match the ad's length and mixed under
 * the voice at reduced volume.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { listVoices, type ElevenVoice } from '../../lib/api'
import { Check, PlayIcon, Upload, X } from '../icons'

export type AudioSelection = {
  mode: 'none' | 'ai' | 'upload'
  voiceId?: string
  voiceOwnerId?: string
  voiceName?: string
  uploadDataUrl?: string
  uploadName?: string
  musicEnabled?: boolean
  musicPrompt?: string
}

export const EMPTY_AUDIO: AudioSelection = { mode: 'none' }

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

const TABS: Array<{ id: AudioSelection['mode']; label: string; hint: string }> = [
  { id: 'none', label: 'No voiceover', hint: 'Lip-synced native audio' },
  { id: 'ai', label: 'AI voiceover', hint: 'ElevenLabs voices' },
  { id: 'upload', label: 'Upload audio', hint: 'Your own track' },
]

const GENDERS = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'neutral', label: 'Neutral / NB' },
  { id: 'any', label: 'Any' },
]

const AGES = [
  { id: 'any', label: 'Any age' },
  { id: 'young', label: 'Young' },
  { id: 'middle_aged', label: 'Middle-aged' },
  { id: 'old', label: 'Older' },
]

function chipCls(selected: boolean) {
  return `rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
    selected
      ? 'border-fire-start bg-fire-start/[0.08] text-ink'
      : 'border-white/[0.10] bg-void-800 text-ink-muted hover:border-white/20'
  }`
}

export default function AudioPicker({
  value,
  onChange,
  disabled,
}: {
  value: AudioSelection
  onChange: (next: AudioSelection) => void
  disabled?: boolean
}) {
  const set = (patch: Partial<AudioSelection>) => onChange({ ...value, ...patch })

  // ── Voice library (self-contained; fetched once when the AI tab first opens)
  const [voices, setVoices] = useState<ElevenVoice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voicesError, setVoicesError] = useState('')
  const loadedRef = useRef(false)
  useEffect(() => {
    if (value.mode !== 'ai' || loadedRef.current) return
    loadedRef.current = true
    setVoicesLoading(true)
    listVoices()
      .then(({ voices: v }) => setVoices(v))
      .catch(e => setVoicesError(e instanceof Error ? e.message : 'Could not load voices.'))
      .finally(() => setVoicesLoading(false))
  }, [value.mode])

  // ── Filters — gender first, then accent/age/search
  const [gender, setGender] = useState('')
  const [accent, setAccent] = useState('any')
  const [age, setAge] = useState('any')
  const [search, setSearch] = useState('')

  const genderCounts = useMemo(() => {
    const c: Record<string, number> = { female: 0, male: 0, neutral: 0, any: voices.length }
    for (const v of voices) if (v.gender && c[v.gender] !== undefined) c[v.gender]++
    return c
  }, [voices])

  const genderPool = useMemo(
    () => (gender && gender !== 'any' ? voices.filter(v => v.gender === gender) : voices),
    [voices, gender],
  )

  // Accent options come from the data itself (top accents in this gender pool).
  const accents = useMemo(() => {
    const c = new Map<string, number>()
    for (const v of genderPool) if (v.accent) c.set(v.accent, (c.get(v.accent) ?? 0) + 1)
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a]) => a)
  }, [genderPool])

  const filtered = useMemo(() => {
    let list = genderPool
    if (accent !== 'any') list = list.filter(v => v.accent === accent)
    if (age !== 'any') list = list.filter(v => (v.age ?? '').replace(/[\s-]/g, '_') === age)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(v => `${v.name} ${v.description ?? ''} ${v.useCase ?? ''}`.toLowerCase().includes(q))
    return list
  }, [genderPool, accent, age, search])

  // ── Preview playback (one shared element)
  const previewRef = useRef<HTMLAudioElement | null>(null)
  const [previewingId, setPreviewingId] = useState('')
  function preview(v: ElevenVoice) {
    if (!v.previewUrl) return
    if (previewingId === v.voiceId) {
      previewRef.current?.pause()
      setPreviewingId('')
      return
    }
    previewRef.current?.pause()
    const audio = new Audio(v.previewUrl)
    previewRef.current = audio
    audio.play().then(() => setPreviewingId(v.voiceId)).catch(() => setPreviewingId(''))
    audio.onended = () => setPreviewingId('')
  }

  // ── Upload handling
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState('')
  function handleFile(file?: File) {
    if (!file) return
    setUploadError('')
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('That file is over 15MB — trim or compress it first.')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setUploadError('Could not read that file.')
    reader.onload = () => set({ uploadDataUrl: reader.result as string, uploadName: file.name })
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4">
      {/* ── The three tabs ── */}
      <div className="grid grid-cols-3 gap-2">
        {TABS.map(t => {
          const selected = value.mode === t.id
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => set({ mode: t.id })}
              className={`rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50 ${
                selected
                  ? 'border-fire-start bg-fire-start/[0.08]'
                  : 'border-white/[0.10] bg-void-800 hover:border-white/20'
              }`}
            >
              <span className={`block text-sm font-semibold ${selected ? 'text-ink' : 'text-ink-muted'}`}>{t.label}</span>
              <span className="block text-[10px] text-ink-faint">{t.hint}</span>
            </button>
          )
        })}
      </div>

      {/* ── AI voiceover: gender first, then the library ── */}
      {value.mode === 'ai' && (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Voice gender</p>
            <div className="flex flex-wrap gap-2">
              {GENDERS.map(g => (
                <button
                  key={g.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => { setGender(g.id); setAccent('any'); setAge('any') }}
                  className={chipCls(gender === g.id)}
                >
                  {g.label}
                  {voices.length > 0 && <span className="ml-1 text-ink-faint">{genderCounts[g.id] ?? 0}</span>}
                </button>
              ))}
            </div>
          </div>

          {!gender && (
            <p className="rounded-xl border border-dashed border-white/[0.12] px-4 py-3 text-xs text-ink-faint">
              Pick a voice gender to browse {voices.length > 0 ? `${voices.length} ElevenLabs voices` : 'the ElevenLabs voice library'}.
            </p>
          )}

          {gender && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {AGES.map(a => (
                  <button key={a.id} type="button" disabled={disabled} onClick={() => setAge(a.id)} className={chipCls(age === a.id)}>
                    {a.label}
                  </button>
                ))}
              </div>
              {accents.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={disabled} onClick={() => setAccent('any')} className={chipCls(accent === 'any')}>Any accent</button>
                  {accents.map(a => (
                    <button key={a} type="button" disabled={disabled} onClick={() => setAccent(a)} className={`${chipCls(accent === a)} capitalize`}>
                      {a}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search voices by name or style"
                className="w-full rounded-xl border border-white/[0.10] bg-void-900 px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none"
              />

              {voicesLoading && <p className="text-sm text-ink-muted">Loading the voice library…</p>}
              {voicesError && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs text-ink-muted">{voicesError}</div>
              )}

              {!voicesLoading && !voicesError && (
                <>
                  <p className="text-[11px] text-ink-faint">{filtered.length} voice{filtered.length === 1 ? '' : 's'} match</p>
                  <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {filtered.map(v => {
                      const selected = value.voiceId === v.voiceId
                      return (
                        <div
                          key={v.voiceId}
                          className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition ${
                            selected ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30' : 'border-white/[0.08] bg-void-800 hover:border-white/20'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => preview(v)}
                            disabled={!v.previewUrl || disabled}
                            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-void-700 text-fire-start hover:bg-void-600 disabled:opacity-30"
                            aria-label={`Preview ${v.name}`}
                          >
                            {previewingId === v.voiceId ? <span className="h-2.5 w-2.5 rounded-sm bg-fire-start" /> : <PlayIcon className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => set({ voiceId: v.voiceId, voiceOwnerId: v.ownerId, voiceName: v.name })}
                            className="min-w-0 flex-1 text-left disabled:opacity-50"
                          >
                            <p className="truncate text-sm font-semibold text-ink">{v.name}</p>
                            <p className="truncate text-[11px] capitalize text-ink-faint">
                              {[v.accent, v.age?.replace(/_/g, ' '), v.useCase].filter(Boolean).join(' · ') || v.category}
                            </p>
                          </button>
                          {selected && <Check className="h-4 w-4 flex-shrink-0 text-fire-start" />}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Upload audio ── */}
      {value.mode === 'upload' && (
        <div className="space-y-2">
          {value.uploadDataUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.10] bg-void-800 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{value.uploadName || 'Uploaded audio'}</p>
                <audio src={value.uploadDataUrl} controls className="mt-1.5 h-8 w-full" />
              </div>
              <button
                type="button"
                onClick={() => set({ uploadDataUrl: undefined, uploadName: undefined })}
                aria-label="Remove audio"
                className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-void-700 text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-white/[0.14] py-6 text-ink-faint transition-colors hover:border-fire-start/40 hover:text-ink-muted disabled:opacity-50"
            >
              <Upload className="h-5 w-5" />
              <span className="text-xs font-medium">Upload MP3, WAV, or M4A (max 15MB)</span>
              <span className="text-[10px]">Replaces the ad's audio track — voiceover, music, anything.</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          {uploadError && <p className="text-[11px] text-rose-400">{uploadError}</p>}
        </div>
      )}

      {/* ── Background music (ElevenLabs Music) — works with any tab ── */}
      <div className={`rounded-xl border p-3.5 transition ${value.musicEnabled ? 'border-fire-start/40 bg-fire-start/[0.04]' : 'border-white/[0.08] bg-void-800/60'}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => set({ musicEnabled: !value.musicEnabled })}
          className="flex w-full items-center justify-between gap-3 text-left disabled:opacity-50"
        >
          <span>
            <span className="block text-sm font-semibold text-ink">Background music</span>
            <span className="block text-[11px] text-ink-faint">ElevenLabs Music — generated to match your ad's length, mixed under the voice.</span>
          </span>
          <span className={`grid h-5 w-9 flex-shrink-0 place-items-center rounded-full border transition ${value.musicEnabled ? 'border-fire-start bg-fire-start/30' : 'border-white/20 bg-void-700'}`}>
            <span className={`h-3.5 w-3.5 rounded-full transition-transform ${value.musicEnabled ? 'translate-x-2 bg-fire-start' : '-translate-x-2 bg-white/40'}`} />
          </span>
        </button>
        {value.musicEnabled && (
          <textarea
            value={value.musicPrompt ?? ''}
            onChange={e => set({ musicPrompt: e.target.value })}
            disabled={disabled}
            rows={2}
            placeholder="e.g. Upbeat lo-fi with warm bass and light percussion, optimistic, no vocals"
            className="mt-2.5 w-full resize-none rounded-lg border border-white/[0.10] bg-void-900 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none disabled:opacity-50"
          />
        )}
      </div>
    </div>
  )
}
