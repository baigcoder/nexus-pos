'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { withStaffAuthHeaders } from '@/lib/staff-api'
import {
  Plus, Trash2, Edit2, Copy, GripVertical, X,
  Image as LucideImage, Video, Youtube, Link as LinkIcon, Clock,
  Check, ChevronUp, ChevronDown, ToggleLeft, ToggleRight,
  Upload, ExternalLink, Eye, EyeOff
} from 'lucide-react'
import type { AdContent, AdContentType } from '@/types/display'
import Image from 'next/image'

interface AdContentManagerProps {
  restaurantId: string
  displayId?: string
  canManage?: boolean
}

export function AdContentManager({ restaurantId, displayId, canManage = false }: AdContentManagerProps) {
  const [contents, setContents] = useState<AdContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdContent | null>(null)
  const [isBulkImport, setIsBulkImport] = useState(false)
  const [bulkUrls, setBulkUrls] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AdContent | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { success, error: showError, warning } = useToast()

  const supabase = createClient()

  const loadContent = useCallback(async () => {
    setIsLoading(true)
    let query = supabase
      .from('ad_content')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true })

    if (displayId) {
      query = query.eq('display_id', displayId)
    }

    const { data, error } = await query
    if (error) {
      showError('Load Failed', error.message)
    }
    if (data) setContents(data)
    setIsLoading(false)
  }, [restaurantId, displayId, supabase, showError])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  const handleSave = async (item: Partial<AdContent>) => {
    if (!canManage) {
      warning('Owner Required', 'Only the restaurant owner can change advertisement content.')
      return
    }

    let result
    if (editingItem) {
      result = await supabase
        .from('ad_content')
        .update(item)
        .eq('id', editingItem.id)
        .eq('restaurant_id', restaurantId)
    } else {
      result = await supabase.from('ad_content').insert({ ...item, restaurant_id: restaurantId })
    }

    if (result.error) {
      showError(editingItem ? 'Update Failed' : 'Create Failed', result.error.message)
      return
    }

    await loadContent()
    setIsModalOpen(false)
    setEditingItem(null)
    success(editingItem ? 'Slide Updated' : 'Slide Added')
  }

  const handleDelete = async (item: AdContent) => {
    if (!canManage) {
      warning('Owner Required', 'Only the restaurant owner can delete advertisement content.')
      return
    }

    setDeleteTarget(item)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/display/ad-content/${deleteTarget.id}?restaurantId=${restaurantId}`, {
        method: 'DELETE',
        headers: withStaffAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete advertisement content')
      }

      setContents(prev => prev.filter(item => item.id !== deleteTarget.id))
      success('Advertisement Deleted', `"${deleteTarget.title}" was removed from the slideshow.`)
      setDeleteTarget(null)
    } catch (err: unknown) {
      showError('Delete Failed', err instanceof Error ? err.message : 'Failed to delete advertisement content')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDuplicate = async (item: AdContent) => {
    if (!canManage) {
      warning('Owner Required', 'Only the restaurant owner can duplicate advertisement content.')
      return
    }

    const { error } = await supabase.from('ad_content').insert({
      restaurant_id: item.restaurant_id,
      display_id: item.display_id,
      title: `${item.title} (Copy)`,
      description: item.description,
      media_url: item.media_url,
      media_type: item.media_type,
      duration_seconds: item.duration_seconds,
      display_order: item.display_order + 1,
      background_color: item.background_color,
      text_color: item.text_color,
      cta_text: item.cta_text,
      cta_url: item.cta_url,
      is_active: item.is_active,
    })
    if (error) {
      showError('Duplicate Failed', error.message)
      return
    }
    await loadContent()
    success('Slide Duplicated')
  }

  const handleToggleActive = async (item: AdContent) => {
    if (!canManage) {
      warning('Owner Required', 'Only the restaurant owner can change advertisement visibility.')
      return
    }

    const { error } = await supabase
      .from('ad_content')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
      .eq('restaurant_id', restaurantId)
    if (error) {
      showError('Update Failed', error.message)
      return
    }
    await loadContent()
  }

  const handleMoveUp = async (index: number) => {
    if (!canManage) {
      warning('Owner Required', 'Only the restaurant owner can reorder advertisement content.')
      return
    }
    if (index === 0) return
    const newContents = [...contents]
    const temp = newContents[index].display_order
    newContents[index].display_order = newContents[index - 1].display_order
    newContents[index - 1].display_order = temp
    const first = await supabase.from('ad_content').update({ display_order: newContents[index].display_order }).eq('id', newContents[index].id).eq('restaurant_id', restaurantId)
    const second = await supabase.from('ad_content').update({ display_order: newContents[index - 1].display_order }).eq('id', newContents[index - 1].id).eq('restaurant_id', restaurantId)
    if (first.error || second.error) {
      showError('Reorder Failed', first.error?.message || second.error?.message || 'Could not reorder slides')
      return
    }
    await loadContent()
  }

  const handleMoveDown = async (index: number) => {
    if (!canManage) {
      warning('Owner Required', 'Only the restaurant owner can reorder advertisement content.')
      return
    }
    if (index === contents.length - 1) return
    const newContents = [...contents]
    const temp = newContents[index].display_order
    newContents[index].display_order = newContents[index + 1].display_order
    newContents[index + 1].display_order = temp
    const first = await supabase.from('ad_content').update({ display_order: newContents[index].display_order }).eq('id', newContents[index].id).eq('restaurant_id', restaurantId)
    const second = await supabase.from('ad_content').update({ display_order: newContents[index + 1].display_order }).eq('id', newContents[index + 1].id).eq('restaurant_id', restaurantId)
    if (first.error || second.error) {
      showError('Reorder Failed', first.error?.message || second.error?.message || 'Could not reorder slides')
      return
    }
    await loadContent()
  }

  const handleBulkImport = async () => {
    if (!canManage) {
      warning('Owner Required', 'Only the restaurant owner can import advertisement content.')
      return
    }

    const urls = bulkUrls.split('\n').filter(url => url.trim())
    const items = urls.map((url, index) => {
      const trimmedUrl = url.trim()
      let media_type: AdContentType = 'image'
      if (trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be')) {
        media_type = 'youtube'
      } else if (trimmedUrl.match(/\.(mp4|webm|mov)$/i)) {
        media_type = 'video'
      }
      return {
        restaurant_id: restaurantId,
        display_id: displayId || null,
        title: `Ad ${contents.length + index + 1}`,
        media_url: trimmedUrl,
        media_type,
        duration_seconds: 8,
        display_order: contents.length + index,
        background_color: '#000000',
        text_color: '#ffffff',
        is_active: true,
      }
    })
    const { error } = await supabase.from('ad_content').insert(items)
    if (error) {
      showError('Import Failed', error.message)
      return
    }
    setBulkUrls('')
    setIsBulkImport(false)
    await loadContent()
    success('Slides Imported', `${items.length} advertisement slide${items.length === 1 ? '' : 's'} added.`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Advertisement Content</h2>
          <p className="text-sm text-neutral-500">
            {contents.length} slides
            {!canManage && ' · view only'}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsBulkImport(true)}
              className="px-4 py-2 rounded-xl font-bold bg-neutral-800 hover:bg-neutral-700 text-white transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Bulk Import
            </button>
            <button
              onClick={() => { setEditingItem(null); setIsModalOpen(true) }}
              className="px-4 py-2 rounded-xl font-bold bg-pink-600 hover:bg-pink-700 text-white transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Slide
            </button>
          </div>
        )}
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="aspect-video bg-neutral-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : contents.length === 0 ? (
        <div className="text-center py-12 bg-neutral-900/50 rounded-xl border-2 border-dashed border-neutral-800">
          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <LucideImage className="w-8 h-8 text-neutral-600" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Content Yet</h3>
          <p className="text-sm text-neutral-500 mb-4">Add images, videos, or YouTube links</p>
          {canManage && (
            <button
              onClick={() => { setEditingItem(null); setIsModalOpen(true) }}
              className="px-4 py-2 rounded-xl font-bold bg-pink-600 hover:bg-pink-700 text-white transition-colors"
            >
              Add Your First Slide
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {contents.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "relative aspect-video bg-neutral-900 rounded-xl overflow-hidden border-2 transition-colors",
                item.is_active ? 'border-neutral-700' : 'border-neutral-800 opacity-50'
              )}
            >
              {/* Preview */}
              {item.media_url && (
                item.media_type === 'youtube' ? (
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                    <Youtube className="w-8 h-8 text-red-500" />
                  </div>
                ) : item.media_type === 'video' ? (
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                    <Video className="w-8 h-8 text-neutral-500" />
                  </div>
                ) : (
                  <div className="relative w-full h-32 mb-2">
                    <Image src={item.media_url} alt={item.title} fill className="object-cover rounded-lg" />
                  </div>
                )
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="font-bold text-white text-sm truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  {item.media_type === 'image' && <LucideImage className="w-3 h-3 text-neutral-400" />}
                  {item.media_type === 'video' && <Video className="w-3 h-3 text-neutral-400" />}
                  {item.media_type === 'youtube' && <Youtube className="w-3 h-3 text-red-400" />}
                  <span className="text-xs text-neutral-400">{item.duration_seconds}s</span>
                </div>
              </div>

              {/* Actions */}
              {canManage && (
                <>
                  <div className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/70 p-1 shadow-lg ring-1 ring-white/10">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      title="Move up"
                      className="p-1.5 rounded-md text-white hover:bg-white/15 transition-colors disabled:opacity-30"
                    >
                      <ChevronUp className="w-3 h-3 text-white" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === contents.length - 1}
                      title="Move down"
                      className="p-1.5 rounded-md text-white hover:bg-white/15 transition-colors disabled:opacity-30"
                    >
                      <ChevronDown className="w-3 h-3 text-white" />
                    </button>
                  </div>

                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(item)}
                      title={item.is_active ? 'Hide slide' : 'Show slide'}
                      className="p-1.5 rounded-md bg-black/70 hover:bg-black/90 ring-1 ring-white/10 transition-colors"
                    >
                      {item.is_active ? (
                        <Eye className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-neutral-500" />
                      )}
                    </button>
                  </div>

                  <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/75 p-1 shadow-lg ring-1 ring-white/10">
                    <button
                      onClick={() => handleDuplicate(item)}
                      title="Duplicate slide"
                      className="p-1.5 rounded-md text-white hover:bg-white/15 transition-colors"
                    >
                      <Copy className="w-3 h-3 text-white" />
                    </button>
                    <button
                      onClick={() => { setEditingItem(item); setIsModalOpen(true) }}
                      title="Edit slide"
                      className="p-1.5 rounded-md text-white hover:bg-white/15 transition-colors"
                    >
                      <Edit2 className="w-3 h-3 text-white" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      title="Delete slide"
                      aria-label={`Delete ${item.title}`}
                      className="p-1.5 rounded-md bg-rose-600/90 text-white hover:bg-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <AdContentModal
            item={editingItem}
            onClose={() => { setIsModalOpen(false); setEditingItem(null) }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      {/* Bulk Import Modal */}
      <AnimatePresence>
        {isBulkImport && (
          <BulkImportModal
            urls={bulkUrls}
            onUrlsChange={setBulkUrls}
            onClose={() => { setIsBulkImport(false); setBulkUrls('') }}
            onImport={handleBulkImport}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Advertisement"
        message={`Delete "${deleteTarget?.title || 'this advertisement'}" from the slideshow? This cannot be undone.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={isDeleting ? () => {} : confirmDelete}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null)
        }}
      />
    </div>
  )
}

// Add/Edit Modal
function AdContentModal({
  item,
  onClose,
  onSave,
}: {
  item: AdContent | null
  onClose: () => void
  onSave: (item: Partial<AdContent>) => void
}) {
  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    media_url: item?.media_url || '',
    media_type: item?.media_type || 'image' as AdContentType,
    duration_seconds: item?.duration_seconds || 8,
    background_color: item?.background_color || '#000000',
    text_color: item?.text_color || '#ffffff',
    cta_text: item?.cta_text || '',
    cta_url: item?.cta_url || '',
    is_active: item?.is_active ?? true,
  })
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(item?.media_url || '')
  const supabase = createClient()

  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `ad-content/${fileName}`

      const { data, error } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath)

      setForm(prev => ({ ...prev, media_url: urlData.publicUrl }))
      setPreviewUrl(urlData.publicUrl)

      // Auto-detect media type
      if (file.type.startsWith('video/')) {
        setForm(prev => ({ ...prev, media_type: 'video' }))
      } else {
        setForm(prev => ({ ...prev, media_type: 'image' }))
      }
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload file. Please try again.')
    }
    setIsUploading(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleSave = () => {
    onSave({
      id: item?.id,
      display_order: item?.display_order || 0,
      ...form,
    })
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl"
      >
        <div className="bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl">
          <div className="flex items-center justify-between p-6 border-b border-neutral-800">
            <h2 className="text-2xl font-black">{item ? 'Edit Slide' : 'Add New Slide'}</h2>
            <button onClick={onClose} className="p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-bold text-neutral-300 mb-2">Upload Image/Video</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={cn(
                  "relative border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                  dragActive ? "border-pink-500 bg-pink-500/10" : "border-neutral-700 hover:border-neutral-600",
                  isUploading && "opacity-50 pointer-events-none"
                )}
              >
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-sm text-neutral-400">Uploading...</p>
                  </div>
                ) : previewUrl ? (
                  <div className="flex flex-col items-center">
                    {form.media_type === 'video' ? (
                      <video src={previewUrl} className="h-32 object-cover rounded-lg mb-2" />
                    ) : (
                      <img src={previewUrl} alt="Preview" className="h-32 object-cover rounded-lg mb-2" />
                    )}
                    <p className="text-sm text-pink-400">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center mb-3 mx-auto">
                      <Upload className="w-6 h-6 text-neutral-500" />
                    </div>
                    <p className="font-bold text-white mb-1">Drop image or video here</p>
                    <p className="text-sm text-neutral-500">or click to browse</p>
                    <p className="text-xs text-neutral-600 mt-2">JPG, PNG, GIF, MP4, WebM - Max 10MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* OR Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-neutral-800" />
              <span className="text-sm text-neutral-500">OR</span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>

            {/* Media URL */}
            <div>
              <label className="block text-sm font-bold text-neutral-300 mb-2">Media URL</label>
              <input
                type="url"
                value={form.media_url}
                onChange={e => {
                  setForm(prev => ({ ...prev, media_url: e.target.value }))
                  setPreviewUrl(e.target.value)
                }}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 outline-none focus:border-pink-500"
              />
            </div>

            {/* Media Type */}
            <div>
              <label className="block text-sm font-bold text-neutral-300 mb-2">Media Type</label>
              <div className="flex gap-2">
                {(['image', 'video', 'youtube'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setForm(prev => ({ ...prev, media_type: type }))}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-xl border-2 font-bold text-sm capitalize transition-colors",
                      form.media_type === type
                        ? "border-pink-500 bg-pink-500/10 text-pink-400"
                        : "border-neutral-800 text-neutral-500 hover:border-neutral-700"
                    )}
                  >
                    {type === 'youtube' ? 'YouTube' : type}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-bold text-neutral-300 mb-2">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Special Offer!"
                className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 outline-none focus:border-pink-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold text-neutral-300 mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="50% off on all beverages today only!"
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 outline-none focus:border-pink-500 resize-none"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-bold text-neutral-300 mb-2">Duration (seconds)</label>
              <input
                type="number"
                value={form.duration_seconds}
                onChange={e => setForm(prev => ({ ...prev, duration_seconds: parseInt(e.target.value) || 8 }))}
                min={1}
                max={300}
                className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white outline-none focus:border-pink-500"
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-neutral-300 mb-2">Background Color</label>
                <input
                  type="color"
                  value={form.background_color}
                  onChange={e => setForm(prev => ({ ...prev, background_color: e.target.value }))}
                  className="w-full h-12 rounded-xl cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-300 mb-2">Text Color</label>
                <input
                  type="color"
                  value={form.text_color}
                  onChange={e => setForm(prev => ({ ...prev, text_color: e.target.value }))}
                  className="w-full h-12 rounded-xl cursor-pointer"
                />
              </div>
            </div>

            {/* CTA */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-neutral-300 mb-2">CTA Text</label>
                <input
                  type="text"
                  value={form.cta_text}
                  onChange={e => setForm(prev => ({ ...prev, cta_text: e.target.value }))}
                  placeholder="Order Now"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 outline-none focus:border-pink-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-300 mb-2">CTA URL</label>
                <input
                  type="url"
                  value={form.cta_url}
                  onChange={e => setForm(prev => ({ ...prev, cta_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 outline-none focus:border-pink-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 p-6 border-t border-neutral-800">
            <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-neutral-400 hover:text-white">
              Cancel
            </button>
            <button onClick={handleSave} className="px-8 py-3 rounded-xl font-bold bg-pink-600 hover:bg-pink-700">
              {item ? 'Save Changes' : 'Add Slide'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// Bulk Import Modal
function BulkImportModal({
  urls,
  onUrlsChange,
  onClose,
  onImport,
}: {
  urls: string
  onUrlsChange: (urls: string) => void
  onClose: () => void
  onImport: () => void
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl"
      >
        <div className="bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl">
          <div className="flex items-center justify-between p-6 border-b border-neutral-800">
            <div>
              <h2 className="text-2xl font-black">Bulk Import</h2>
              <p className="text-sm text-neutral-500">Paste multiple image/video URLs (one per line)</p>
            </div>
            <button onClick={onClose} className="p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <textarea
              value={urls}
              onChange={e => onUrlsChange(e.target.value)}
              placeholder={`https://example.com/image1.jpg\nhttps://example.com/image2.jpg\nhttps://youtube.com/watch?v=...`}
              rows={10}
              className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 outline-none focus:border-pink-500 font-mono text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-4 p-6 border-t border-neutral-800">
            <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-neutral-400 hover:text-white">
              Cancel
            </button>
            <button
              onClick={onImport}
              disabled={!urls.trim()}
              className="px-8 py-3 rounded-xl font-bold bg-pink-600 hover:bg-pink-700 disabled:opacity-50"
            >
              Import {urls.split('\n').filter(u => u.trim()).length} Items
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
