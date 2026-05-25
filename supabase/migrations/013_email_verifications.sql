-- 013_email_verifications.sql: Email verification codes

CREATE TABLE IF NOT EXISTS public.email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL CHECK (char_length(code) = 6),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Only allow insert by anyone (public, for sending codes)
DROP POLICY IF EXISTS "Anyone can insert codes" ON public.email_verifications;
CREATE POLICY "Anyone can insert codes" ON public.email_verifications
  FOR INSERT WITH CHECK (true);

-- Service role can read/update (handled via service_role key, no RLS)
