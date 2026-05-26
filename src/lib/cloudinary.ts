/**
 * Cloudinary Integration for Display Content
 * Handles image/video uploads and provides URLs
 */

// Cloudinary configuration from env
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'orderflow_display'

/**
 * Upload file to Cloudinary
 */
export async function uploadToCloudinary(
    file: File,
    onProgress?: (progress: number) => void
): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

    onProgress?.(10)

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
        {
            method: 'POST',
            body: formData,
        }
    )

    onProgress?.(90)

    if (!response.ok) {
        throw new Error('Upload failed')
    }

    const data = await response.json()

    onProgress?.(100)

    return data.secure_url
}

/**
 * Get optimized image URL from Cloudinary
 */
export function getOptimizedImageUrl(url: string, width?: number, height?: number): string {
    if (!url.includes('cloudinary.com')) return url

    const transforms = ['f_auto', 'q_auto']
    if (width) transforms.push(`w_${width}`)
    if (height) transforms.push(`h_${height}`)
    transforms.push('c_fill')

    return url.replace('/upload/', `/upload/${transforms.join(',')}/`)
}

/**
 * Get video thumbnail from Cloudinary
 */
export function getVideoThumbnail(url: string): string {
    if (!url.includes('cloudinary.com')) return ''
    return url.replace('/upload/', '/upload/so_0,w_400,h_300,c_fill,g_center/')
}
