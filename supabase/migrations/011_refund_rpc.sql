-- 011_refund_rpc.sql: Atomic refund function (fixes race condition in server-side refundCredits)

CREATE OR REPLACE FUNCTION rpc_refund_credits(
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
  -- Atomically update balance
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (refund_user_id, refund_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = public.user_credits.balance + refund_amount;

  -- Record transaction
  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = refund_user_id;
  INSERT INTO public.credit_transactions (user_id, amount, type, reference_type, reference_id, balance_after)
  VALUES (refund_user_id, refund_amount, 'refund', 'refund', refund_reference_id, v_balance);
END;
$$;
