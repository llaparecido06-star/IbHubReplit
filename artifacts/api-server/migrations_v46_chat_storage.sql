-- Migration v46: Create chat-attachments storage bucket
-- Run this in the Supabase SQL Editor

-- Create the chat-attachments storage bucket (public so URLs are accessible)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  52428800, -- 50 MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: allow authenticated users to upload to their own folder
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (string_to_array(name, '/'))[2]
);

-- RLS policy: allow public read access to chat attachments
CREATE POLICY "Anyone can view chat attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chat-attachments');

-- RLS policy: allow users to delete their own attachments
CREATE POLICY "Users can delete own chat attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (string_to_array(name, '/'))[2]
);
