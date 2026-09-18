-- ============================================================================
-- SILEX 2.0 MIGRATION: Auto-provision public.users from auth.users
-- Migration Tag: 20260914000000_auto_provision_users
-- Target Engine: PostgreSQL 15+ / Supabase PostgreSQL
-- ============================================================================

-- Function to handle auto-provisioning new users into public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_full_name text;
  v_avatar_url text;
BEGIN
  -- Extract full_name from metadata or fallback to email local part
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  v_avatar_url := new.raw_user_meta_data->>'avatar_url';

  INSERT INTO public.users (
    id,
    email,
    full_name,
    avatar_url,
    email_verified_at,
    is_active,
    is_super_admin,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    v_full_name,
    v_avatar_url,
    new.email_confirmed_at,
    true,
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = coalesce(EXCLUDED.avatar_url, public.users.avatar_url),
    email_verified_at = coalesce(EXCLUDED.email_verified_at, public.users.email_verified_at),
    updated_at = now();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Grant execution rights to authenticated and service roles
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;

-- Idempotent trigger declaration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
