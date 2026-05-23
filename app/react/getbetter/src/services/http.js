const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const buildUrl = (path) => `${API_BASE_URL}${path}`

export const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return {}
  try {
    return await response.json()
  } catch {
    return {}
  }
}
