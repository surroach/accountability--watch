
CREATE POLICY "anyone can upload evidence" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'evidence');

CREATE POLICY "staff can read evidence" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence' AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'legal_partner')
    )
  );

CREATE POLICY "admins can delete evidence" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'evidence' AND public.has_role(auth.uid(), 'admin'));
