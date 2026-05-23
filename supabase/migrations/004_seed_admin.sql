-- 004_seed_admin.sql: 初始化管理员
-- 使用方法：将下方的 UUID 替换为实际管理员的 auth.users.id
-- 可通过 Supabase Dashboard → Authentication → Users 查找用户 ID

-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('<你的用户UUID>', 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
