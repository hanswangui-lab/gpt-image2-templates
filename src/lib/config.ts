export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  vpsApiUrl: import.meta.env.VITE_VPS_API_URL as string,
  afdian: {
    url: import.meta.env.VITE_AFDIAN_URL as string,
  },
  resolutions: [
    { label: '1K·3积分/次', model: 'gpt-image-2', cost: 3 },
    { label: '2K·5积分/次', model: 'gpt-image-2-2K', cost: 5 },
    { label: '4K·10积分/次', model: 'gpt-image-2-4K', cost: 10 },
  ] as const,
  creditPacks: [
    { id: 'gold', name: '黄金卡', credits: 200, priceCents: 200, perImage: '0.06', popular: false },
    { id: 'platinum', name: '铂金卡', credits: 1000, priceCents: 1000, bonusCredits: 100, perImage: '0.05', popular: true },
    { id: 'diamond', name: '钻石卡', credits: 9900, priceCents: 9900, bonusCredits: 600, perImage: '0.02', popular: false },
  ],
} as const
