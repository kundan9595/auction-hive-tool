
-- Create a storage bucket for item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true);

-- Create policy to allow anyone to view item images (public bucket)
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'item-images');

-- Create policy to allow authenticated users to upload item images
CREATE POLICY "Allow authenticated users to upload item images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'item-images' AND auth.role() = 'authenticated');

-- Create policy to allow users to update their own item images
CREATE POLICY "Allow users to update item images" ON storage.objects
FOR UPDATE USING (bucket_id = 'item-images' AND auth.role() = 'authenticated');

-- Create policy to allow users to delete item images
CREATE POLICY "Allow users to delete item images" ON storage.objects
FOR DELETE USING (bucket_id = 'item-images' AND auth.role() = 'authenticated');

-- Add image_url column to items table
ALTER TABLE public.items 
ADD COLUMN image_url TEXT;
