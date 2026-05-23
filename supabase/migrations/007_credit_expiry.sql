-- 007_credit_expiry.sql: Credit batch tracking with 30-day expiry, transaction logging

-- ============================================================
-- 1. Credit batches table (tracks each credit addition with expiry)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credit_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  initial_credits integer NOT NULL,
  remaining_credits integer NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('recharge', 'signup_bonus', 'admin_grant')),
  source_id text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_batches_user ON public.credit_batches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_batches_expires ON public.credit_batches(expires_at) WHERE remaining_credits > 0;

-- ============================================================
-- 2. Add 'expiry' to credit_transactions type
-- ============================================================
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN ('subscription_renew', 'purchase', 'bonus', 'usage', 'refund', 'admin_grant', 'signup_bonus', 'expiry'));

-- ============================================================
-- 3. Updated rpc_add_credits — creates credit_batch + records transaction
-- ============================================================
DROP FUNCTION IF EXISTS rpc_add_credits(uuid, integer) CASCADE;
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
  -- Calculate expiry
  IF credit_expires_in_seconds IS NOT NULL THEN
    v_expires_at := now() + (credit_expires_in_seconds || ' seconds')::interval;
  END IF;

  -- Create credit batch
  INSERT INTO public.credit_batches (user_id, initial_credits, remaining_credits, source_type, source_id, expires_at)
  VALUES (credit_user_id, credit_amount, credit_amount, credit_source_type, credit_source_id, v_expires_at);

  -- Update balance
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (credit_user_id, credit_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = public.user_credits.balance + credit_amount;

  -- Record transaction
  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = credit_user_id;
  INSERT INTO public.credit_transactions (user_id, amount, type, reference_type, reference_id, balance_after)
  VALUES (credit_user_id, credit_amount, 'purchase', credit_source_type, credit_source_id, v_balance);
END;
$$;

-- ============================================================
-- 4. Updated rpc_consume_credits — deducts FIFO from batches + records transaction
-- ============================================================
DROP FUNCTION IF EXISTS rpc_consume_credits(uuid, integer) CASCADE;
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
  -- Check total available balance
  SELECT balance INTO v_balance
  FROM public.user_credits
  WHERE user_id = credit_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_balance < credit_amount THEN
    RETURN false;
  END IF;

  -- FIFO deduction from non-expired batches
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

  -- Update total balance
  UPDATE public.user_credits
  SET balance = balance - credit_amount
  WHERE user_id = credit_user_id;

  -- Record transaction
  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = credit_user_id;
  INSERT INTO public.credit_transactions (user_id, amount, type, reference_type, reference_id, balance_after)
  VALUES (credit_user_id, -credit_amount, 'usage', credit_reference_type, credit_reference_id, v_balance);

  RETURN true;
END;
$$;

-- ============================================================
-- 5. rpc_expire_credits — expire old batches, deduct from balance
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_expire_credits()
RETURNS SETOF public.credit_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_batch record;
  v_deduct integer;
  v_balance integer;
  v_tx_id uuid;
BEGIN
  FOR v_batch IN
    SELECT * FROM public.credit_batches
    WHERE remaining_credits > 0
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    ORDER BY expires_at ASC
  LOOP
    -- Don't deduct more than current balance
    SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = v_batch.user_id;
    v_deduct := LEAST(v_batch.remaining_credits, COALESCE(v_balance, 0));

    -- Clear batch remaining
    UPDATE public.credit_batches SET remaining_credits = 0 WHERE id = v_batch.id;

    -- Deduct from balance
    IF v_deduct > 0 THEN
      UPDATE public.user_credits SET balance = balance - v_deduct WHERE user_id = v_batch.user_id;

      -- Record expiry transaction
      SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = v_batch.user_id;
      INSERT INTO public.credit_transactions (user_id, amount, type, reference_type, reference_id, balance_after)
      VALUES (v_batch.user_id, -v_deduct, 'expiry', 'recharge', v_batch.source_id, v_balance)
      RETURNING id INTO v_tx_id;

      RETURN QUERY SELECT * FROM public.credit_transactions WHERE id = v_tx_id;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 6. rpc_get_credit_transactions — paginated transaction history
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_get_credit_transactions(
  p_user_id uuid DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  amount integer,
  type text,
  reference_type text,
  reference_id text,
  balance_after integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only allow users to query their own transactions, admins can query all
  IF auth.uid() != p_user_id AND NOT rpc_is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT t.id, t.user_id, t.amount, t.type, t.reference_type, t.reference_id, t.balance_after, t.created_at
  FROM public.credit_transactions t
  WHERE (p_user_id IS NULL OR t.user_id = p_user_id)
    AND (p_type IS NULL OR t.type = p_type)
  ORDER BY t.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ============================================================
-- 7. RLS for credit_batches
-- ============================================================
ALTER TABLE public.credit_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own batches" ON public.credit_batches;
CREATE POLICY "Users read own batches" ON public.credit_batches
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all batches" ON public.credit_batches;
CREATE POLICY "Admins read all batches" ON public.credit_batches
  FOR SELECT USING (rpc_is_admin());

-- ============================================================
-- 8. RLS for credit_transactions (if not already)
-- ============================================================
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own transactions" ON public.credit_transactions;
CREATE POLICY "Users read own transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all transactions" ON public.credit_transactions;
CREATE POLICY "Admins read all transactions" ON public.credit_transactions
  FOR SELECT USING (rpc_is_admin());
