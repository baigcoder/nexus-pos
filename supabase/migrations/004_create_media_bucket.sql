-- Storage bucket for ad content media
-- Run this in Supabase SQL Editor

-- Create storage bucket for ad content images and videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view media files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "Only owners can delete media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND auth.uid() IN (SELECT owner_id FROM restaurants));
