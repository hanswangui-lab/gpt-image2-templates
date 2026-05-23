-- 原子化积分操作函数，使用 FOR UPDATE 消除竞态条件

-- 消费积分
CREATE OR REPLACE FUNCTION rpc_consume_credits(credit_user_id uuid, credit_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_balance integer;
BEGIN
  SELECT balance INTO current_balance
  FROM public.user_credits
  WHERE user_id = credit_user_id
  FOR UPDATE;

  IF NOT FOUND OR current_balance < credit_amount THEN
    RETURN false;
  END IF;

  UPDATE public.user_credits
  SET balance = balance - credit_amount
  WHERE user_id = credit_user_id;

  RETURN true;
END;
$$;

-- 增加积分（注册赠送、充值、订阅续期等）
CREATE OR REPLACE FUNCTION rpc_add_credits(credit_user_id uuid, credit_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (credit_user_id, credit_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = public.user_credits.balance + credit_amount;
END;
$$;
