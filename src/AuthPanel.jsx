import { useState } from 'react'
import { loginUser, logoutUser, registerUser, updateUsername } from './api/auth.js'

function AuthPanel({ view, currentUser, notice, onSwitch, onAuthenticated, onRegistered, onUpdated, onLoggedOut }) {
  const [username, setUsername] = useState(view === 'profile' ? currentUser?.username || '' : '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isRegister = view === 'register'
  const isProfile = view === 'profile'
  const title = isRegister ? '結一段新緣' : isProfile ? '帳戶與稱謂' : '重逢於此'

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return
    setError('')
    setIsSubmitting(true)
    try {
      if (isRegister) {
        await registerUser(username.trim(), password)
        onRegistered()
      } else if (isProfile) {
        const updatedUser = await updateUsername(username.trim())
        onUpdated(updatedUser)
      } else {
        const user = await loginUser(username.trim(), password)
        onAuthenticated(user)
      }
    } catch (requestError) {
      setError(requestError.message || '操作未能完成，請稍後再試。')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLogout() {
    setError('')
    setIsSubmitting(true)
    try {
      await logoutUser()
      onLoggedOut()
    } catch (requestError) {
      setError(requestError.message || '退出失敗，請稍後再試。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-wrap" aria-labelledby="auth-title">
      <div className="auth-card">
        <p className="eyebrow">湘西秘術 · 緣起於此</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-intro">
          {isProfile ? '你的身份標識固定不變，這裡可以修改展示的稱呼。' : '留下稱呼，方能為你保存獨立的對話記憶。'}
        </p>

        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-username">{isProfile ? '新稱呼' : '用戶名'}</label>
          <input
            id="auth-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            maxLength={50}
            required
          />
          {!isProfile && (
            <>
              <label htmlFor="auth-password">密碼</label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                minLength={8}
                maxLength={128}
                required
              />
              {isRegister && <span className="auth-hint">密碼至少 8 個字符</span>}
            </>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '请稍候…' : isRegister ? '注册' : isProfile ? '保存称呼' : '登录'}
          </button>
        </form>

        {isRegister && <p className="auth-switch">已有账号？<button type="button" onClick={() => onSwitch('login')}>去登录</button></p>}
        {view === 'login' && <p className="auth-switch">还没有账号？<button type="button" onClick={() => onSwitch('register')}>去注册</button></p>}
        {isProfile && <button className="auth-logout" type="button" onClick={handleLogout} disabled={isSubmitting}>退出登录</button>}
        <button className="auth-back" type="button" onClick={() => onSwitch(null)}>返回問卦</button>
      </div>
    </section>
  )
}

export default AuthPanel
