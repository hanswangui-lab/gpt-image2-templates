-- 006_fix_rls_policies.sql: Fix infinite recursion in all admin RLS policies
-- Root cause: "Admins read all roles" on user_roles references user_roles itself.
-- Solution: use rpc_is_admin() (SECURITY DEFINER, bypasses RLS) instead of direct subquery.

-- 1. Fix user_roles: replace recursive "Admins read all roles"
DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT USING (rpc_is_admin());

-- 2. Fix payment_orders (from both 002 and 005)
DROP POLICY IF EXISTS "Admins read all payment orders" ON public.payment_orders;
CREATE POLICY "Admins read all payment orders" ON public.payment_orders
  FOR SELECT USING (rpc_is_admin());

-- 3. Fix recharge_orders
DROP POLICY IF EXISTS "Admins read all recharge orders" ON public.recharge_orders;
CREATE POLICY "Admins read all recharge orders" ON public.recharge_orders
  FOR SELECT USING (rpc_is_admin());

-- 4. Add user_credits RLS policies (using rpc_is_admin to avoid recursion)
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own credits" ON public.user_credits;
CREATE POLICY "Users read own credits" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all credits" ON public.user_credits;
CREATE POLICY "Admins read all credits" ON public.user_credits
  FOR SELECT USING (rpc_is_admin());
