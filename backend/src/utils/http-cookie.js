const REFRESH_COOKIE_NAME = 'refreshToken'
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60

const getCookie = (req, name) => {
  const header = String(req.headers?.cookie || '')
  const pair = header
    .split(';')
    .map(item => item.trim())
    .find(item => item.startsWith(`${name}=`))

  if (!pair) return ''

  try {
    return decodeURIComponent(pair.slice(name.length + 1))
  } catch {
    return ''
  }
}

const serializeCookie = (name, value, options = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`)
  parts.push(`Path=${options.path || '/'}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  parts.push(`SameSite=${options.sameSite || 'Strict'}`)
  return parts.join('; ')
}

const setRefreshCookie = (res, token) => {
  res.setHeader('Set-Cookie', serializeCookie(REFRESH_COOKIE_NAME, token, {
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/api/auth',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict'
  }))
}

const clearRefreshCookie = (res) => {
  res.setHeader('Set-Cookie', serializeCookie(REFRESH_COOKIE_NAME, '', {
    maxAge: 0,
    path: '/api/auth',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict'
  }))
}

module.exports = {
  REFRESH_COOKIE_NAME,
  getCookie,
  setRefreshCookie,
  clearRefreshCookie
}
