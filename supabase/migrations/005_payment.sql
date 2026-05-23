-- 005_payment.sql: Epay/FM payment integration
-- Run via Supabase SQL Editor

-- 1. Payment orders table
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_no text NOT NULL UNIQUE,
  credits integer NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  raw_callback jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_trade_no ON public.payment_orders(trade_no);

-- 2. RLS: payment_orders
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own payment orders" ON public.payment_orders;
CREATE POLICY "Users read own payment orders" ON public.payment_orders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all payment orders" ON public.payment_orders;
CREATE POLICY "Admins read all payment orders" ON public.payment_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 3. RPC: Admin process payment (manual fallback)
CREATE OR REPLACE FUNCTION rpc_admin_process_payment(
  p_trade_no text,
  p_approved boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_is_admin boolean;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.user_roles
  WHERE user_id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Permission denied: admin required';
  END IF;

  SELECT * INTO v_order FROM public.payment_orders WHERE trade_no = p_trade_no;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status != 'pending' THEN
    RAISE EXCEPTION 'Order already processed';
  END IF;

  IF p_approved THEN
    UPDATE public.payment_orders
    SET status = 'paid', paid_at = now()
    WHERE trade_no = p_trade_no;

    PERFORM rpc_add_credits(v_order.user_id, v_order.credits);
  ELSE
    UPDATE public.payment_orders
    SET status = 'failed'
    WHERE trade_no = p_trade_no;
  END IF;
END;
$$;
