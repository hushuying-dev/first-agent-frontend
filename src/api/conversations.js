const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
const baseUrl = configuredApiBase || '/api'

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      ...options,
    })
  } catch {
    throw new Error('目前無法連線到服務，請確認後端已啟動後再試。')
  }

  let data = null
  if (response.status !== 204) {
    try {
      data = await response.json()
    } catch {
      // Keep successful empty responses usable and report server errors below.
    }
  }

  if (!response.ok) {
    const error = new Error(typeof data?.detail === 'string' ? data.detail : '請稍後再試。')
    error.status = response.status
    throw error
  }
  return data
}

export function listConversations() {
  return request('/conversations')
}

export function createConversation(title = '新對話') {
  return request('/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export function getConversationMessages(conversationId) {
  return request(`/conversations/${encodeURIComponent(conversationId)}/messages`)
}

export function deleteConversation(conversationId) {
  return request(`/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' })
}
