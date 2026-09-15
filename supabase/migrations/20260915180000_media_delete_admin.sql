/*
# Admin can delete media_applications rows (payments + media requests)

- To'lovlar va media so'rovlarni admin paneldan butunlay o'chirish uchun.
- SELECT/UPDATE siyosatlari o'zgarmaydi.
*/

DROP POLICY IF EXISTS "media_delete_admin" ON public.media_applications;
CREATE POLICY "media_delete_admin" ON public.media_applications
  FOR DELETE TO authenticated
  USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
