const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

export async function sendChatMessage(message, conversationId) {
  const baseUrl = configuredApiBase || '/api'
  const query = new URLSearchParams({ query: message })
  if (conversationId) query.set('conversation_id', conversationId)

  let response
  try {
    response = await fetch(`${baseUrl}/chat?${query}`, { method: 'POST', credentials: 'include' })
  } catch {
    throw new Error('目前無法連線到問卦服務，請確認後端已啟動後再試。')
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error(`服務返回了無法識別的內容（HTTP ${response.status}）。`)
  }

  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : '請稍後再試。'
    const error = new Error(`問卦服務暫時無法回答：${detail}`)
    error.status = response.status
    throw error
  }

  if (typeof data.output !== 'string' || !data.output.trim()) {
    throw new Error('服務已回應，但沒有找到陳大師的文字答覆。')
  }

  const tarotImages = Array.isArray(data.tarot_images)
    ? data.tarot_images.filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url))
    : []

  return {
    text: data.output,
    tarotImages,
    conversationId: data.conversation_id,
    conversationTitle: data.conversation_title,
  }
}
