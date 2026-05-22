-- Optional audit table for transactional email (Resend). Service role inserts from Next.js;
-- see `appendEmailAuditLog` in `src/lib/email/send-welcome-emails.ts`.

CREATE TABLE IF NOT EXISTS email_logs (
  id BIGSERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  to_name TEXT,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
  related_id UUID,
  status TEXT NOT NULL DEFAULT 'sent',
  resend_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_profile ON email_logs(profile_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_type_sent ON email_logs(email_type, sent_at DESC);

COMMENT ON TABLE email_logs IS
  'Append-only transactional email audit trail; inserts from server using service role — see send-welcome-emails.ts.';
