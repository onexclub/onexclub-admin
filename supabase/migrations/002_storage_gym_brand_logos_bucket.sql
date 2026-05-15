-- =============================================================================
-- Storage: public bucket for organization (gym) brand logos
-- =============================================================================
-- App code references bucket id via `GYM_BRAND_LOGOS_BUCKET` in
-- `src/lib/supabase/gym-brand-logos-storage.ts` — keep them in sync.
--
-- Writes: server actions use the **service role** client (bypasses Storage RLS).
-- Reads: bucket is public so `getPublicUrl` URLs work for dashboards / white-label.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gym-brand-logos',
  'gym-brand-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read gym brand logos" ON storage.objects;

CREATE POLICY "Public read gym brand logos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'gym-brand-logos');
