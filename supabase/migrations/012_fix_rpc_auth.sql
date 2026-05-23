-- 012_fix_rpc_auth.sql: Add auth.uid() checks to prevent IDOR attacks
-- Any authenticated user could previously call these RPCs with an arbitrary user_id
-- to steal/spend other users' credits.

-- Fix rpc_consume_credits: ensure caller can only spend their own credits
DROP FUNCTION IF EXISTS rpc_consume_credits(uuid, integer, text, text) CASCADE;
CREATE FUNCTION rpc_consume_credits(
  credit_user_id uuid,
  credit_amount integer,
  credit_reference_type text DEFAULT 'usage',
  credit_reference_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_remaining integer := credit_amount;
  v_batch record;
  v_deduct integer;
  v_balance integer;
BEGIN
  -- IDOR protection: when called by a user (not service_role), must match
  IF auth.uid() IS NOT NULL AND auth.uid() != credit_user_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT balance INTO v_balance
  FROM public.user_credits
  WHERE user_id = credit_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_balance < credit_amount THEN
    RETURN false;
  END IF;

  FOR v_batch IN
    SELECT * FROM public.credit_batches
    WHERE user_id = credit_user_id
      AND remaining_credits > 0
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at ASC
  LOOP
    v_deduct := LEAST(v_batch.remaining_credits, v_remaining);
    UPDATE public.credit_batches
    SET remaining_credits = remaining_credits - v_deduct
    WHERE id = v_batch.id;
    v_remaining := v_remaining - v_deduct;
    IF v_remaining <= 0 THEN EXIT; END IF;
  END LOOP;

  UPDATE public.user_credits
  SET balance = balance - credit_amount
  WHERE user_id = credit_user_id;

  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = credit_user_id;
  INSERT INTO public.credit_transactions (user_id, amount, type, reference_type, reference_id, balance_after)
  VALUES (credit_user_id, -credit_amount, 'usage', credit_reference_type, credit_reference_id, v_balance);

  RETURN true;
END;
$$;

-- Fix rpc_add_credits: ensure caller can only add credits to their own account
DROP FUNCTION IF EXISTS rpc_add_credits(uuid, integer, text, text, integer) CASCADE;
CREATE FUNCTION rpc_add_credits(
  credit_user_id uuid,
  credit_amount integer,
  credit_source_type text DEFAULT 'admin_grant',
  credit_source_id text DEFAULT NULL,
  credit_expires_in_seconds integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expires_at timestamptz;
  v_balance integer;
BEGIN
  -- IDOR protection: when called by a user (not service_role), must match
  IF auth.uid() IS NOT NULL AND auth.uid() != credit_user_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF credit_expires_in_seconds IS NOT NULL THEN
    v_expires_at := now() + (credit_expires_in_seconds || ' seconds')::interval;
  END IF;

  INSERT INTO public.credit_batches (user_id, initial_credits, remaining_credits, source_type, source_id, expires_at)
  VALUES (credit_user_id, credit_amount, credit_amount, credit_source_type, credit_source_id, v_expires_at);

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (credit_user_id, credit_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = public.user_credits.balance + credit_amount;

  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = credit_user_id;
  INSERT INTO public.credit_transactions (user_id, amount, type, reference_type, reference_id, balance_after)
  VALUES (credit_user_id, credit_amount, 'purchase', credit_source_type, credit_source_id, v_balance);
END;
$$;

-- Fix rpc_refund_credits: same protection
DROP FUNCTION IF EXISTS rpc_refund_credits(uuid, integer, text) CASCADE;
CREATE FUNCTION rpc_refund_credits(
  refund_user_id uuid,
  refund_amount integer,
  refund_reference_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != refund_user_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (refund_user_id, refund_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = public.user_credits.balance + refund_amount;

  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = refund_user_id;
  INSERT INTO public.credit_transactions (user_id, amount, type, reference_type, reference_id, balance_after)
  VALUES (refund_user_id, refund_amount, 'refund', 'refund', refund_reference_id, v_balance);
END;
$$;
