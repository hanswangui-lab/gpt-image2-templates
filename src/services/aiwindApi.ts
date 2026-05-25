import { config } from '../lib/config'
import type { TemplateItem } from '../types'

export interface AiwindTemplatesResponse {
  items: TemplateItem[]
  total: number
  page: number
  pageSize: number
}

export async function fetchAiwindTemplates(params: {
  page?: number
  pageSize?: number
  search?: string
  category?: string
} = {}): Promise<AiwindTemplatesResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.search) query.set('search', params.search)
  if (params.category) query.set('category', params.category)

  const res = await fetch(`${config.vpsApiUrl}/api/aiwind-templates?${query}`)
  if (!res.ok) throw new Error(`Failed to fetch aiwind templates: ${res.status}`)
  return res.json()
}
