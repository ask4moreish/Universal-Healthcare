import type {
  ListNotificationsResponse,
  NotificationResponse,
} from '@universal-healthcare/shared'
import { apiFetch, authHeaders } from './api-client'

export function listMyNotifications(
  token: string,
  page: number,
  pageSize: number
): Promise<ListNotificationsResponse> {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return apiFetch<ListNotificationsResponse>(
    `/api/notifications?${qs.toString()}`,
    { headers: authHeaders(token) }
  )
}

export function markNotificationRead(
  token: string,
  id: string
): Promise<NotificationResponse> {
  return apiFetch<NotificationResponse>(
    `/api/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH', headers: authHeaders(token) }
  )
}

// Returns the count of rows flipped to read; the response body is
// `{ updated: number }` per the controller contract.
export function markAllNotificationsRead(
  token: string
): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/api/notifications/read-all', {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export async function deleteNotification(
  token: string,
  id: string
): Promise<void> {
  await apiFetch<void>(`/api/notifications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}
