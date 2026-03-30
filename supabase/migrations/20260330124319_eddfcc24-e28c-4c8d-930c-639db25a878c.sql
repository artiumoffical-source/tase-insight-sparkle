-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('superadmin', 'admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS on user_roles: only the user can see their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Update news_articles RLS: replace permissive "all" policy with admin-only
DROP POLICY IF EXISTS "Authenticated users can manage articles" ON public.news_articles;

CREATE POLICY "Admins can manage articles"
  ON public.news_articles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- 6. Seed current user as superadmin
INSERT INTO public.user_roles (user_id, role)
VALUES ('49161f16-2d22-4c5e-af64-61f8c5451e0f', 'superadmin')
ON CONFLICT (user_id, role) DO NOTHING;