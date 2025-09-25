-- Create storage bucket for user uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('user-uploads', 'user-uploads', true);

-- Create policies for user uploads
CREATE POLICY "Allow authenticated users to upload files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow public read access to user uploads" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'user-uploads');

CREATE POLICY "Allow users to update their own files" 
ON storage.objects 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow users to delete their own files" 
ON storage.objects 
FOR DELETE 
USING (auth.uid() IS NOT NULL);