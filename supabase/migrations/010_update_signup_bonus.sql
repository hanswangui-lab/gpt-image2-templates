-- 将新用户注册赠送积分从 5 改为 3
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance integer;
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 3)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = NEW.id;
  INSERT INTO public.credit_transactions (user_id, amount, type, balance_after)
  VALUES (NEW.id, 3, 'signup_bonus', v_balance);

  RETURN NEW;
END;
$$;
