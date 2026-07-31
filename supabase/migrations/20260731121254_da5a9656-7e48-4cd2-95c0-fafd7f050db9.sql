CREATE POLICY "product images readable" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'produtos');
CREATE POLICY "owners upload product images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'produtos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "owners update product images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'produtos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "owners delete product images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'produtos' AND (storage.foldername(name))[1] = auth.uid()::text);