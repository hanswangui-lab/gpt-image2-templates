import { supabase } from '../lib/supabase'
import { config } from '../lib/config'
import type { AdminUser } from '../types'

function getToken() {
  return supabase.auth.getSession().then(({ data }) => data.session?.access_token)
}

async function adminFetch(path: string, body?: Record<string, unknown>, method?: string) {
  const token = await getToken()
  let res: Response
  try {
    res = await fetch(`${config.vpsApiUrl}${path}`, {
      method: method || (body ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (err: any) {
    throw new Error(`无法连接到 VPS 服务器: ${err.message}`)
  }
  if (!res.ok) {
    const ct = res.headers.get('content-type') || ''
    let errMsg = 'Request failed'
    if (ct.includes('text/html')) {
      errMsg = `服务器返回了网页 (HTTP ${res.status})，请检查 VPS 服务`
    } else {
      const data = await res.json().catch(() => ({}))
      errMsg = data.error || `请求失败 (${res.status})`
    }
    throw new Error(errMsg)
  }
  return res.json().catch(() => { throw new Error('无法解析服务器响应 (非 JSON)') })
}

export async function checkIsAdmin() {
  const { data, error } = await supabase.rpc('rpc_is_admin')
  if (error) return false
  return data as boolean
}

export async function getPendingRecharges() {
  const { data, error } = await supabase.rpc('rpc_get_pending_recharges')
  if (error) throw new Error(error.message)
  return data
}

export async function approveRecharge(orderId: string, approved: boolean, note?: string) {
  const { error } = await supabase.rpc('rpc_admin_approve_recharge', {
    p_order_id: orderId,
    p_approved: approved,
    p_admin_note: note || null,
  })
  if (error) throw new Error(error.message)
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  return adminFetch('/api/admin/users')
}

export async function disableUser(userId: string, disabled: boolean) {
  return adminFetch('/api/admin/disable-user', { userId, disabled })
}

export async function deleteUser(userId: string) {
  return adminFetch('/api/admin/delete-user', { userId })
}

export async function getAdminPaymentOrders(page = 1, pageSize = 10): Promise<{ orders: any[]; total: number }> {
  return adminFetch(`/api/admin/payment-orders?page=${page}&pageSize=${pageSize}`)
}

export async function createAnnouncement(content: string) {
  return adminFetch('/api/admin/announcements', { content })
}

export async function deactivateAnnouncement(id: string) {
  return adminFetch(`/api/admin/announcements/${id}/deactivate`, {})
}

export async function activateAnnouncement(id: string) {
  return adminFetch(`/api/admin/announcements/${id}/activate`, {})
}

export async function getAllAnnouncements() {
  return adminFetch('/api/admin/announcements')
}

export async function deleteAnnouncement(id: string) {
  return adminFetch(`/api/admin/announcements/${id}`, {}, 'DELETE')
}

export async function getSettings(): Promise<Record<string, string>> {
  return adminFetch('/api/admin/settings')
}

export async function updateSettings(settings: Record<string, string>) {
  return adminFetch('/api/admin/settings', { settings }, 'PUT')
}

export async function testApiConnection(): Promise<{ ok: boolean; error?: string; status?: number; latencyMs?: number }> {
  return adminFetch('/api/admin/test-api', {})
}
