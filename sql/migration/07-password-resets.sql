-- 07: Password reset tokens table
-- Used by forgot-password flow. Only accessed via service role (admin client).

CREATE TABLE password_resets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
-- No RLS policies needed — only accessed via admin client (service role)
