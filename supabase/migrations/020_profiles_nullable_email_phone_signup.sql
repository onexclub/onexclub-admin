-- -----------------------------------------------------------------------------
-- Phone-primary customers (and future Auth phone signups) may have no email on
-- auth.users. Relax profiles.email NOT NULL and teach handle_new_user to copy
-- phone from Auth into profiles.
--
-- App/doc reference: docs/auth-by-role.md, src/lib/auth/role-sign-in-policy.ts
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN public.profiles.email IS
  'Nullable when the member is phone-OTP-only; see docs/auth-by-role.md.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, phone)
  VALUES (
    NEW.id,
    NULLIF(btrim(COALESCE(NEW.email::text, '')), ''),
    COALESCE(
      NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
      NULLIF(btrim(COALESCE(NEW.email::text, '')), ''),
      NULLIF(btrim(COALESCE(NEW.phone::text, '')), ''),
      'Member'
    ),
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')), ''),
    NULLIF(btrim(COALESCE(NEW.phone::text, '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
