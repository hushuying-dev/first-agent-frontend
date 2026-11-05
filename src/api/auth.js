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

  let data = {}
  try {
    data = await response.json()
  } catch {
    // Some successful endpoints may not return a JSON body.
  }

  if (!response.ok) {
    const error = new Error(typeof data.detail === 'string' ? data.detail : '請稍後再試。')
    error.status = response.status
    throw error
  }
  return data
}

function jsonBody(value) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  }
}

export async function getCurrentUser() {
  try {
    return await request('/auth/me')
  } catch (error) {
    if (error.status === 401) return null
    throw error
  }
}

export function registerUser(username, password) {
  return request('/auth/register', jsonBody({ username, password }))
}

export function loginUser(username, password) {
  return request('/auth/login', jsonBody({ username, password }))
}

export function updateUsername(username) {
  return request('/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
}

export function logoutUser() {
  return request('/auth/logout', { method: 'POST' })
}
