/*
  # Create Storage Bucket for Post Images

  ## Changes
  
  ### 1. Create Storage Bucket
  - Create `post-images` bucket for storing user-uploaded post images
  
  ### 2. Security
  - Enable RLS on storage.objects
  - Allow authenticated users to upload their own images
  - Allow everyone to view images (public read access)
  - Restrict deletion to file owners only
*/

-- Create the storage bucket for post images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload images to their own folder
CREATE POLICY "Users can upload post images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post-images' AND
    (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

-- Policy: Allow public read access to all post images
CREATE POLICY "Anyone can view post images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'post-images');

-- Policy: Allow users to update their own post images
CREATE POLICY "Users can update own post images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'post-images' AND
    (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'post-images' AND
    (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

-- Policy: Allow users to delete their own post images
CREATE POLICY "Users can delete own post images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'post-images' AND
    (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );
