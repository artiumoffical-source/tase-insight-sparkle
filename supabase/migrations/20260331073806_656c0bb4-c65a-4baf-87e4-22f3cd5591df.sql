
CREATE TABLE public.stock_audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL UNIQUE,
  health text NOT NULL DEFAULT 'red',
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_by_admin boolean NOT NULL DEFAULT false,
  last_audited timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_audit_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audit results" ON public.stock_audit_results
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Superadmins can manage audit results" ON public.stock_audit_results
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TABLE public.data_issue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  reporter_email text,
  message text NOT NULL DEFAULT '',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_issue_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can report issues" ON public.data_issue_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Superadmins can manage reports" ON public.data_issue_reports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
