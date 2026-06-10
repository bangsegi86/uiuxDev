import { useState, type FormEvent } from 'react'
import { useAuth } from '../state/authStore'
import { useI18n } from '../i18n/I18nContext'

export function AuthScreen() {
  const { t } = useI18n()
  const login = useAuth((s) => s.login)
  const register = useAuth((s) => s.register)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
    } catch {
      setErr(mode === 'login' ? t.loginFailed : t.registerFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-logo">◳ {t.appTitle}</div>
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            {t.login}
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            {t.register}
          </button>
        </div>
        <label className="field">
          <span>{t.email}</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>{t.password}</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {err && <div className="auth-error">{err}</div>}
        <button className="primary auth-submit" type="submit" disabled={busy}>
          {busy ? '…' : mode === 'login' ? t.login : t.register}
        </button>
      </form>
    </div>
  )
}
