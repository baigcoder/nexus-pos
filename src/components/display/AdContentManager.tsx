'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Film, ImageIcon, Link2, Monitor, Play, Plus, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { withStaffAuthHeaders } from '@/lib/staff-api'
import { ReviewDialog } from '@/components/service/ServiceOrder'
import work from '@/components/service/service-order.module.css'
import type { AdContent, AdContentType, Display } from '@/types/display'
import { httpsUrl, SignageArtwork, youtubeId } from './SignageArtwork'
import styles from './signage.module.css'

type Screen = Pick<Display, 'id' | 'name' | 'slug' | 'is_active'>
type AdDraft = Pick<AdContent, 'display_id' | 'title' | 'description' | 'media_url' | 'media_type' | 'duration_seconds' |
    'background_color' | 'text_color' | 'cta_text' | 'cta_url' | 'is_active' | 'schedule_start' | 'schedule_end'>
const formats = { image: 'Image', video: 'Video', youtube: 'YouTube', url: 'Linked image' }
const library = 'library'

function status(item: AdContent, screens: Screen[], now: number) {
    if (!item.is_active) return 'Paused'
    if (item.display_id && !screens.some(screen => screen.id === item.display_id && screen.is_active)) return 'Screen disabled'
    if (item.schedule_end && Date.parse(item.schedule_end) <= now) return 'Ended'
    if (item.schedule_start && Date.parse(item.schedule_start) > now) return 'Scheduled'
    return 'Eligible'
}

export function AdContentManager({ restaurantId, displayId, canManage = false }: { restaurantId: string; displayId?: string; canManage?: boolean }) {
    const db = createClient()
    const [contents, setContents] = useState<AdContent[]>([])
    const [screens, setScreens] = useState<Screen[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [scope, setScope] = useState(displayId || library)
    const [selectedId, setSelectedId] = useState<string>()
    const [playing, setPlaying] = useState(false)
    const [editor, setEditor] = useState<AdContent | 'new'>()
    const [deleting, setDeleting] = useState<AdContent>()
    const [bulk, setBulk] = useState(false)
    const [bulkUrls, setBulkUrls] = useState('')
    const [busy, setBusy] = useState(false)
    const [actionError, setActionError] = useState('')
    const [now, setNow] = useState(0)
    const lock = useRef(false)

    const load = useCallback(async (signal?: AbortSignal) => {
        try {
            const ads = db.from('ad_content').select('*').eq('restaurant_id', restaurantId).order('display_order').order('id')
            const targets = db.from('displays').select('id, name, slug, is_active').eq('restaurant_id', restaurantId)
                .in('type', ['advertisement', 'waiting']).order('name')
            const [items, locations] = await Promise.all([signal ? ads.abortSignal(signal) : ads, signal ? targets.abortSignal(signal) : targets])
            if (signal?.aborted) return
            if (items.error || locations.error) throw new Error('The signage library could not load. Try refreshing.')
            setContents((items.data || []) as AdContent[])
            setScreens((locations.data || []) as Screen[])
            setError('')
            setNow(Date.now())
        } catch (failure) {
            if (!signal?.aborted) setError(failure instanceof Error ? failure.message : 'Could not load signage.')
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [db, restaurantId])

    useEffect(() => {
        const request = new AbortController()
        void load(request.signal)
        const timer = window.setInterval(() => setNow(Date.now()), 30_000)
        return () => { request.abort(); window.clearInterval(timer) }
    }, [load])

    const screen = screens.find(item => item.id === scope)
    const queue = scope === library ? contents : contents.filter(item => !item.display_id || item.display_id === scope)
    const selected = queue.find(item => item.id === selectedId) || queue[0]
    const target = screen?.id || null
    const last = Math.max(-1, ...contents.map(item => item.display_order)) + 1
    const mediaPreview = selected?.media_type === 'video' || selected?.media_type === 'youtube'

    async function mutate(action: () => Promise<void>, message: string, after?: () => void) {
        if (!canManage || lock.current || error) return
        lock.current = true
        setBusy(true)
        setActionError('')
        setNotice('')
        try {
            await action()
            after?.()
            await load()
            setNotice(message)
        } catch (failure) {
            setActionError(failure instanceof Error ? failure.message : 'The change could not be saved.')
        } finally {
            lock.current = false
            setBusy(false)
        }
    }

    async function update(id: string, changes: Partial<AdContent>) {
        const { data, error } = await db.from('ad_content').update(changes).eq('id', id).eq('restaurant_id', restaurantId).select('id').maybeSingle()
        if (error || !data) throw new Error(error?.message || 'The slide is no longer available.')
    }

    function save(values: AdDraft, upload?: () => Promise<string>) {
        const existing = editor && editor !== 'new' ? editor : undefined
        return mutate(async () => {
            const draft = upload ? { ...values, media_url: await upload() } : values
            if (existing) await update(existing.id, draft)
            else {
                const { data, error } = await db.from('ad_content')
                    .insert({ ...draft, display_order: last, restaurant_id: restaurantId }).select('id').single()
                if (error || !data) throw new Error(error?.message || 'Could not save the slide.')
                setSelectedId(data.id)
            }
            if (scope !== library && draft.display_id && draft.display_id !== scope) setScope(draft.display_id)
        }, existing ? 'Slide updated.' : 'Slide added to the playlist.', () => { setEditor(undefined); setPlaying(false) })
    }

    function duplicate(item: AdContent) {
        const { display_id, description, media_url, media_type, duration_seconds, background_color, text_color, cta_text, cta_url, schedule_start, schedule_end } = item
        void mutate(async () => {
            const { data, error } = await db.from('ad_content').insert({
                restaurant_id: restaurantId, display_id, description, media_url, media_type, duration_seconds, background_color,
                text_color, cta_text, cta_url, schedule_start, schedule_end, display_order: last, title: `${item.title} (copy)`, is_active: false,
            }).select('id').single()
            if (error || !data) throw new Error(error?.message || 'Could not duplicate the slide.')
            setSelectedId(data.id)
        }, 'A paused copy was added.')
    }

    function remove(item: AdContent) {
        return mutate(async () => {
            const response = await fetch(`/api/display/ad-content/${encodeURIComponent(item.id)}?restaurantId=${encodeURIComponent(restaurantId)}`, {
                method: 'DELETE', headers: withStaffAuthHeaders(),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok || !data?.success) throw new Error(data?.error || 'Could not remove the slide.')
        }, 'Slide removed.', () => { setDeleting(undefined); setPlaying(false) })
    }

    function importLinks() {
        const urls = bulkUrls.split('\n').map(value => value.trim()).filter(Boolean)
        return mutate(async () => {
            if (!urls.length || urls.length > 50 || urls.some(url => !httpsUrl(url))) throw new Error('Enter 1–50 HTTPS links, one on each line.')
            const { error } = await db.from('ad_content').insert(urls.map((url, index) => ({
                title: `Ad ${contents.length + index + 1}`, media_url: httpsUrl(url), restaurant_id: restaurantId, display_id: target,
                duration_seconds: 8, display_order: last + index, is_active: true,
                media_type: youtubeId(url) ? 'youtube' : /\.(mp4|webm|mov)(?:[?#]|$)/i.test(url) ? 'video' : 'image',
            })))
            if (error) throw new Error(error.message)
        }, 'Links added to the playlist.', () => { setBulk(false); setBulkUrls('') })
    }

    function openEditor(value: AdContent | 'new') {
        setActionError('')
        setEditor(value)
    }

    return <div className={styles.stack}>
        {error && <p className={styles.notice} role="alert">{error} <button className={work.secondary} onClick={() => void load()}>Refresh</button></p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {!editor && !deleting && !bulk && actionError && <p className={styles.notice} role="alert">{actionError}</p>}
        <div className={styles.board}>
            <section className={`${work.panel} ${styles.stack}`} aria-label="Screen playlist">
                <header className={work.panelHead}><div><h2>Screen playlist</h2><p>{loading ? 'Loading…' : `${queue.length} slides · ${screens.length} screens`}{!canManage && ' · View only'}</p></div></header>
                <div className={styles.screenPicker}>
                    <label className={work.field}>Screen
                        <select value={scope} disabled={loading || busy} onChange={event => { setScope(event.target.value); setSelectedId(undefined); setPlaying(false) }}>
                            <option value={library}>All media</option>
                            {screens.map(item => <option key={item.id} value={item.id}>{item.name}{!item.is_active && ' (disabled)'}</option>)}
                        </select>
                    </label>
                    <p className={styles.note}>{screen ? 'Includes slides shared with all ad screens.' : 'Choose a screen to see its playlist and shared slides.'}</p>
                    {!loading && !error && screens.length === 0 && <p className={styles.note}>Create an Advertisement or Waiting Area screen in Manage screens to start playing media.</p>}
                    {canManage && <div className={styles.actions}>
                        <button className={work.primary} type="button" disabled={loading || busy || !!error} onClick={() => openEditor('new')}><Plus size={17} aria-hidden="true" /> Add media</button>
                        <button className={work.secondary} type="button" disabled={loading || busy || !!error} onClick={() => { setActionError(''); setBulk(true) }}><Upload size={15} aria-hidden="true" /> Import links</button>
                    </div>}
                </div>
                {queue.length > 0 ? <ol className={styles.playlist}>
                    {queue.map((item, index) => {
                        const state = status(item, screens, now)
                        const MediaIcon = item.media_type === 'video' || item.media_type === 'youtube' ? Film : ImageIcon
                        const destination = item.display_id ? screens.find(screen => screen.id === item.display_id)?.name || 'Unavailable screen' : 'All ad screens'
                        return <li key={item.id} className={styles.row} data-selected={selected?.id === item.id}>
                            <button type="button" className={styles.rowMain} aria-pressed={selected?.id === item.id} onClick={() => { setSelectedId(item.id); setPlaying(false) }}>
                                <span className={styles.index} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                                <span className={styles.mediaMark} data-type={item.media_type}><MediaIcon size={18} aria-hidden="true" /></span>
                                <span className={styles.rowCopy}><strong>{item.title}</strong><small>{formats[item.media_type]} · {item.duration_seconds}s · {destination}</small>
                                    <span className={styles.badge} data-state={state}>{state}</span></span>
                            </button>
                            {canManage && <div className={styles.rowSide}><button className={work.secondary} type="button" disabled={busy || !!error} aria-label={`Edit ${item.title}`} onClick={() => openEditor(item)}>Edit</button></div>}
                        </li>
                    })}
                </ol> : !loading && !error && <p className={`${work.panelBody} ${styles.note}`}>This playlist is empty. {canManage && 'Add an image, video, or media link.'}</p>}
            </section>
            <section className={styles.preview} aria-label="TV preview">
                <div className={styles.stage}>
                    <header className={styles.stageHead}><span>TV preview</span><small>{screen ? screen.name : '16:9 landscape'}</small></header>
                    <div className={styles.frame}>
                        {selected ? <SignageArtwork key={selected.id} slide={selected} playing={playing} loop /> : <div className={styles.frameEmpty}><Monitor size={29} aria-hidden="true" /><p>Choose or add media to preview it here.</p></div>}
                    </div>
                    <div className={styles.stageFoot}>
                        <p>{selected ? `${selected.title} · ${selected.duration_seconds}s` : 'Screen preview'}</p>
                        <div className={styles.actions}>
                            {mediaPreview && <button type="button" className={work.secondary} onClick={() => setPlaying(!playing)}><Play size={15} aria-hidden="true" /> {playing ? 'Pause preview' : 'Play preview'}</button>}
                            {screen?.is_active && <Link className={work.secondary} href={`/display/${encodeURIComponent(screen.slug)}?preview=1`} target="_blank" rel="noopener noreferrer">Open TV player <ArrowUpRight size={16} aria-hidden="true" /></Link>}
                        </div>
                    </div>
                </div>
                {selected && canManage && <div className={`${work.panelBody} ${styles.actions}`}>
                    <button type="button" className={work.secondary} disabled={busy || !!error} onClick={() => void mutate(() => update(selected.id, { is_active: !selected.is_active }), selected.is_active ? 'Slide paused.' : 'Slide enabled.')}>{selected.is_active ? 'Pause slide' : 'Enable slide'}</button>
                    <button type="button" className={work.secondary} disabled={busy || !!error} onClick={() => duplicate(selected)}>Duplicate</button>
                    {queue.length > 1 && <button type="button" className={work.secondary} disabled={busy || !!error || queue[0]?.id === selected.id} onClick={() => void mutate(() => update(selected.id, {
                        display_order: Math.min(...contents.map(item => item.display_order)) - 1,
                    }), 'Slide moved to the start.')}>Play first</button>}
                    {queue.length > 1 && <button type="button" className={work.secondary} disabled={busy || !!error || queue.at(-1)?.id === selected.id} onClick={() => void mutate(() => update(selected.id, { display_order: last }), 'Slide moved to the end.')}>Play last</button>}
                    <button type="button" className={work.secondary} disabled={busy || !!error} onClick={() => { setActionError(''); setDeleting(selected) }}>Remove</button>
                </div>}
            </section>
        </div>
        {editor && <AdEditor item={editor === 'new' ? undefined : editor} screens={screens} target={target} busy={busy} error={actionError}
            onClose={() => setEditor(undefined)} onSave={save} />}
        {deleting && <ReviewDialog title="Remove this slide?" subtitle={deleting.title} busy={busy} onClose={() => setDeleting(undefined)}>
            <div className={styles.stack}><p>This removes the slide from every playlist that includes it.</p>
                {actionError && <p className={styles.notice} role="alert">{actionError}</p>}
                <button type="button" className={work.primary} disabled={busy} onClick={() => void remove(deleting)}>{busy ? 'Removing…' : 'Remove slide'}</button>
            </div>
        </ReviewDialog>}
        {bulk && <ReviewDialog title="Import media links" subtitle={screen?.name || 'All ad screens'} busy={busy} onClose={() => { setBulk(false); setBulkUrls('') }}>
            <form className={styles.stack} onSubmit={event => { event.preventDefault(); void importLinks() }}>
                <label className={work.field}>One HTTPS link per line<textarea value={bulkUrls} onChange={event => setBulkUrls(event.target.value)} rows={5} required disabled={busy} /></label>
                {actionError && <p className={styles.notice} role="alert">{actionError}</p>}
                <button className={work.primary} disabled={busy} type="submit"><Link2 size={16} aria-hidden="true" /> Import links</button>
            </form>
        </ReviewDialog>}
    </div>
}

function localTime(value?: string | null) {
    const date = new Date(value || '')
    return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ''
}

function AdEditor({ item, screens, target, busy, error, onClose, onSave }: {
    item?: AdContent; screens: Screen[]; target: string | null; busy: boolean; error: string;
    onClose: () => void; onSave: (draft: AdDraft, upload?: () => Promise<string>) => Promise<void>
}) {
    const [draft, setDraft] = useState<AdDraft>({
        title: item?.title || '', description: item?.description || '', display_id: item ? item.display_id : target ?? '',
        media_url: item?.media_url || '', media_type: item?.media_type || 'image', duration_seconds: item?.duration_seconds || 8,
        background_color: item?.background_color || '#171a15', text_color: item?.text_color || '#ffffff',
        cta_text: item?.cta_text || '', cta_url: item?.cta_url || '', is_active: item?.is_active ?? true,
        schedule_start: localTime(item?.schedule_start), schedule_end: localTime(item?.schedule_end),
    })
    const [file, setFile] = useState<File>()
    const fileInput = useRef<HTMLInputElement>(null)
    const [issue, setIssue] = useState('')
    const uploadCache = useRef<{ file: File; url: string } | null>(null)
    const change = <Key extends keyof AdDraft>(key: Key, value: AdDraft[Key]) => setDraft(previous => ({ ...previous, [key]: value }))

    function chooseFile(chosen?: File) {
        if (!chosen) return
        if (!/^(image|video)\//.test(chosen.type)) { setIssue('Choose an image or a video file.'); return }
        setFile(chosen)
        change('media_type', chosen.type.startsWith('video/') ? 'video' : 'image')
        setIssue('')
    }

    async function submit(event: FormEvent) {
        event.preventDefault()
        if (busy) return
        setIssue('')
        const media = httpsUrl(draft.media_url)
        if (draft.display_id === '') { setIssue('Choose where this slide should play.'); return }
        if (!draft.title.trim()) { setIssue('Give the slide a title.'); return }
        if (draft.media_url && !media && !file) { setIssue('Use an HTTPS media link.'); return }
        if (draft.media_type === 'youtube' && (!media || !youtubeId(media))) { setIssue('Enter a valid YouTube video link.'); return }
        if (draft.cta_url && !httpsUrl(draft.cta_url)) { setIssue('Use an HTTPS link for the call to action.'); return }
        const start = draft.schedule_start ? new Date(draft.schedule_start).toISOString() : null
        const end = draft.schedule_end ? new Date(draft.schedule_end).toISOString() : null
        if (start && end && end <= start) { setIssue('The end must be after the start.'); return }
        await onSave({ ...draft, title: draft.title.trim(), media_url: media || null, cta_url: httpsUrl(draft.cta_url) || null,
            description: draft.description?.trim() || null, cta_text: draft.cta_text?.trim() || null, schedule_start: start, schedule_end: end,
        }, file ? async () => {
            if (uploadCache.current?.file === file) return uploadCache.current.url
            const ext = file.name.match(/\.([a-z0-9]{1,8})$/i)?.[1] || (file.type.startsWith('video/') ? 'mp4' : 'png')
            const path = `ad-content/${crypto.randomUUID()}.${ext.toLowerCase()}`
            const storage = createClient().storage.from('media')
            const { error } = await storage.upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
            if (error) throw new Error(`Upload failed. ${error.message}`)
            const url = storage.getPublicUrl(path).data.publicUrl
            uploadCache.current = { file, url }
            return url
        } : undefined)
    }

    return <ReviewDialog title={item ? 'Edit slide' : 'Add media'} subtitle="Choose the artwork, then where and when it should play." busy={busy} onClose={onClose}>
        <form onSubmit={submit} className={styles.stack}>
            <fieldset className={styles.stack} disabled={busy}>
                <label className={work.field}>Slide title<input value={draft.title} onChange={event => change('title', event.target.value)} required maxLength={120} /></label>
                <label className={styles.upload} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) chooseFile(event.dataTransfer.files[0]) }}>
                    <strong>Upload an image or video</strong><small>Drag a file here or browse. Landscape 16:9 fills most TVs.</small>
                    <input ref={fileInput} type="file" accept="image/*,video/*" onChange={event => chooseFile(event.target.files?.[0])} />
                    {file && <small>Selected {file.name}</small>}
                </label>
                <div className={styles.editorRow}>
                    <label className={work.field}>Media type<select value={draft.media_type} onChange={event => { setFile(undefined); if (fileInput.current) fileInput.current.value = ''; change('media_type', event.target.value as AdContentType) }}>
                        {Object.entries(formats).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select></label>
                    <label className={work.field}>Seconds on screen<input type="number" min={1} max={300} step={1} required value={draft.duration_seconds} onChange={event => change('duration_seconds', event.target.valueAsNumber || 0)} /></label>
                </div>
                <label className={work.field}>Media link <input type="url" value={draft.media_url || ''} disabled={!!file} placeholder="https://…" onChange={event => change('media_url', event.target.value)} /></label>
                <label className={work.field}>Play on
                    <select value={draft.display_id ?? 'all'} required onChange={event => change('display_id', event.target.value === 'all' ? null : event.target.value)}>
                        <option value="" disabled>Choose a destination</option>
                        <option value="all">All ad screens</option>
                        {draft.display_id && !screens.some(screen => screen.id === draft.display_id) && <option value={draft.display_id}>Unavailable screen</option>}
                        {screens.map(screen => <option key={screen.id} value={screen.id}>{screen.name}{!screen.is_active && ' (disabled)'}</option>)}
                    </select>
                </label>
                <label className={styles.check}><input type="checkbox" checked={draft.is_active} onChange={event => change('is_active', event.target.checked)} /> Enable this slide</label>
                <details className={styles.fieldset}><summary>Text, colors and schedule</summary>
                    <div className={styles.stack}>
                        <label className={work.field}>Description<textarea rows={2} value={draft.description || ''} maxLength={240} onChange={event => change('description', event.target.value)} /></label>
                        <div className={styles.editorRow}>
                            <label className={work.field}>Background color<input type="color" value={draft.background_color} onChange={event => change('background_color', event.target.value)} /></label>
                            <label className={work.field}>Text color<input type="color" value={draft.text_color} onChange={event => change('text_color', event.target.value)} /></label>
                            <label className={work.field}>Call to action text<input value={draft.cta_text || ''} maxLength={55} onChange={event => change('cta_text', event.target.value)} /></label>
                            <label className={work.field}>Call to action link<input type="url" value={draft.cta_url || ''} onChange={event => change('cta_url', event.target.value)} /></label>
                            <label className={work.field}>Starts (local time)<input type="datetime-local" value={draft.schedule_start || ''} onChange={event => change('schedule_start', event.target.value)} /></label>
                            <label className={work.field}>Ends (local time)<input type="datetime-local" value={draft.schedule_end || ''} onChange={event => change('schedule_end', event.target.value)} /></label>
                        </div>
                    </div>
                </details>
            </fieldset>
            {(issue || error) && <p className={styles.notice} role="alert">{issue || error}</p>}
            <div className={styles.editorActions}><p className={styles.note}>Video plays muted by default.</p><button type="submit" className={work.primary} disabled={busy}>{busy ? 'Saving…' : 'Save slide'}</button></div>
        </form>
    </ReviewDialog>
}
