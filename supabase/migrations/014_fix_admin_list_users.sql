-- 014_fix_admin_list_users.sql: Fix ambiguous column reference

CREATE OR REPLACE FUNCTION rpc_admin_list_users()
RETURNS TABLE(
  row_num bigint,
  user_id uuid,
  username text,
  email text,
  disabled boolean,
  total_recharge_cents bigint,
  balance integer,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT (ur.role = 'admin') INTO v_is_admin
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Permission denied: admin required';
  END IF;

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY au.created_at) - 1 AS row_num,
    au.id AS user_id,
    COALESCE(up.username, split_part(au.email, '@', 1)) AS username,
    au.email::text,
    COALESCE(up.disabled, false) AS disabled,
    COALESCE((
      SELECT SUM(ro.amount_cents)::bigint
      FROM public.recharge_orders ro
      WHERE ro.user_id = au.id AND ro.status = 'approved'
    ), 0) AS total_recharge_cents,
    COALESCE(uc.balance, 0) AS balance,
    au.created_at,
    up.last_sign_in_at
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.user_id = au.id
  LEFT JOIN public.user_credits uc ON uc.user_id = au.id
  ORDER BY au.created_at;
END;
$$;
