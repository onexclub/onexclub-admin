-- =============================================================================
-- Storage: public bucket for profile avatars (staff roster + member profiles)
-- =============================================================================
-- App code: `PROFILE_AVATARS_BUCKET` in `src/lib/supabase/profile-avatars-storage.ts`
-- Writes: service role from dashboard staff actions.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read profile avatars" ON storage.objects;

CREATE POLICY "Public read profile avatars"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'profile-avatars');
