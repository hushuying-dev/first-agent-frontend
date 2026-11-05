import { useEffect, useRef, useState } from 'react'
import AuthPanel from './AuthPanel.jsx'
import { getCurrentUser } from './api/auth.js'
import { sendChatMessage } from './api/chat.js'
import {
  createConversation,
  deleteConversation,
  getConversationMessages,
  listConversations,
} from './api/conversations.js'
import './App.css'

const openingMessage = {
  role: 'assistant',
  text: '有缘人，山水有相逢。老夫陈玉楼，略通命理卦象。你若有心事，不妨坐下慢慢说来。',
}

function titleFromMessage(message) {
  const normalized = message.replace(/\s+/g, ' ').trim().replace(/^[，。！？；：、,.!?;:\s]+|[，。！？；：、,.!?;:\s]+$/g, '')
  return normalized.length > 39 ? `${normalized.slice(0, 39).trimEnd()}…` : normalized || '新对话'
}

function isUntitled(title) {
  return title === '新对话' || title === '新對話'
}

function App() {
  const [messages, setMessages] = useState([openingMessage])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authView, setAuthView] = useState(null)
  const [authNotice, setAuthNotice] = useState('')
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState('')
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const historyRequestRef = useRef(0)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isLoading])

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        setAuthUser(user)
        if (user) await loadConversationList()
      })
      .catch(() => setAuthUser(null))
      .finally(() => setAuthReady(true))
  }, [])

  async function loadConversation(conversationId) {
    const requestId = historyRequestRef.current + 1
    historyRequestRef.current = requestId
    setIsHistoryLoading(true)
    setError('')
    try {
      const savedMessages = await getConversationMessages(conversationId)
      if (historyRequestRef.current !== requestId) return
      setActiveConversationId(conversationId)
      setMessages(savedMessages.length
        ? savedMessages.map((message) => ({
          id: message.message_id,
          role: message.role,
          text: message.content,
          tarotImages: message.metadata?.tarot_images || [],
          createdAt: message.created_at,
        }))
        : [openingMessage])
    } catch (requestError) {
      if (historyRequestRef.current !== requestId) return
      setError(requestError.message || '無法載入這段對話。')
      if (requestError.status === 401) {
        setAuthUser(null)
        setAuthView('login')
      }
    } finally {
      if (historyRequestRef.current === requestId) setIsHistoryLoading(false)
    }
  }

  async function loadConversationList(preferredId = '') {
    let items = await listConversations()
    if (!items.length) items = [await createConversation()]
    setConversations(items)
    const selected = items.find((item) => item.conversation_id === preferredId) || items[0]
    await loadConversation(selected.conversation_id)
  }

  async function handleNewConversation() {
    if (isLoading || isHistoryLoading) return
    setError('')
    try {
      const conversation = await createConversation()
      historyRequestRef.current += 1
      setConversations((current) => [conversation, ...current])
      setActiveConversationId(conversation.conversation_id)
      setMessages([openingMessage])
    } catch (requestError) {
      setError(requestError.message || '無法建立新對話。')
    }
  }

  async function handleDeleteConversation() {
    if (!activeConversationId || isLoading || isHistoryLoading) return
    if (!window.confirm('確定刪除目前這段對話及其歷史消息嗎？')) return
    setError('')
    try {
      await deleteConversation(activeConversationId)
      historyRequestRef.current += 1
      const remaining = conversations.filter((item) => item.conversation_id !== activeConversationId)
      if (remaining.length) {
        setConversations(remaining)
        await loadConversation(remaining[0].conversation_id)
      } else {
        const conversation = await createConversation()
        setConversations([conversation])
        setActiveConversationId(conversation.conversation_id)
        setMessages([openingMessage])
      }
    } catch (requestError) {
      setError(requestError.message || '無法刪除這段對話。')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const text = input.trim()
    if (!text || isLoading || isHistoryLoading || !activeConversationId) return
    setMessages((current) => [...current, { role: 'user', text }])
    const currentConversation = conversations.find((item) => item.conversation_id === activeConversationId)
    if (currentConversation && isUntitled(currentConversation.title)) {
      const firstUserMessage = messages.find((message) => message.role === 'user')?.text || text
      const optimisticTitle = titleFromMessage(firstUserMessage)
      setConversations((current) => current.map((item) => (
        item.conversation_id === activeConversationId ? { ...item, title: optimisticTitle } : item
      )))
    }
    setInput('')
    setError('')
    setIsLoading(true)
    const submittedConversationId = activeConversationId

    try {
      const answer = await sendChatMessage(text, submittedConversationId)
      setMessages((current) => [...current, { role: 'assistant', text: answer.text, tarotImages: answer.tarotImages }])
      setConversations((current) => current.map((conversation) => (
        conversation.conversation_id === submittedConversationId && answer.conversationTitle
          ? { ...conversation, title: answer.conversationTitle }
          : conversation
      )))
      listConversations().then((updated) => setConversations((current) => updated.map((item) => {
        const previous = current.find((candidate) => candidate.conversation_id === item.conversation_id)
        return isUntitled(item.title) && previous && !isUntitled(previous.title)
          ? { ...item, title: previous.title }
          : item
      }))).catch(() => {})
    } catch (requestError) {
      setError(requestError.message || '問卦時遇到問題，請稍後再試。')
      if (requestError.status === 401) {
        setAuthUser(null)
        setAuthView('login')
      }
    } finally {
      setIsLoading(false)
    }
  }

  function handleRegistered() {
    setAuthNotice('註冊成功，請使用剛才的賬號登錄。')
    setAuthView('login')
  }

  function handleAuthenticated(user) {
    setAuthUser(user)
    setAuthView(null)
    setAuthNotice('')
    setError('')
    loadConversationList().catch((requestError) => setError(requestError.message || '無法載入對話列表。'))
  }

  function handleUpdated(user) {
    setAuthUser(user)
    setAuthView(null)
    setAuthNotice('稱呼已更新。')
  }

  function handleLoggedOut() {
    historyRequestRef.current += 1
    setAuthUser(null)
    setAuthView(null)
    setMessages([openingMessage])
    setConversations([])
    setActiveConversationId('')
    setInput('')
    setError('')
    setAuthNotice('')
  }

  const latestTarotReading = [...messages].reverse().find(
    (message) => message.role === 'assistant' && message.tarotImages?.length,
  )
  const tarotCount = latestTarotReading?.tarotImages.length || 0

  function displayMessageTime(value, fallback) {
    if (!value) return fallback
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? fallback
      : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <main className="page-shell">
      <div className="mist mist-one" />
      <div className="mist mist-two" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="陈玉楼问卦首页">
          <span className="brand-seal">陳</span>
          <span className="brand-name">陳玉樓<span>・問卦</span></span>
        </a>
        <button
          className="topbar-note auth-status"
          type="button"
          onClick={() => {
            setAuthNotice('')
            setAuthView(authUser ? 'profile' : 'register')
          }}
          aria-label={authUser ? `已登录：${authUser.username}，打开账户设置` : '未登录，点击注册或登录'}
        >
          <span className={`status-dot ${authUser ? 'is-online' : 'is-offline'}`} />
          {authReady ? authUser?.username || '未登录' : '读取登录状态…'}
        </button>
      </header>

      {authView ? (
        <AuthPanel
          key={authView}
          view={authView}
          currentUser={authUser}
          notice={authNotice}
          onSwitch={(view) => { setAuthNotice(''); setAuthView(view) }}
          onAuthenticated={handleAuthenticated}
          onRegistered={handleRegistered}
          onUpdated={handleUpdated}
          onLoggedOut={handleLoggedOut}
        />
      ) : (
      <section className={`layout ${latestTarotReading ? 'layout-with-tarot' : ''}`} id="top">
        <aside className="intro-panel">
          {latestTarotReading ? (
            <div className="tarot-display">
              <div className="tarot-heading">
                <p className="eyebrow">牌面已現 · 靜心觀之</p>
                <span>{tarotCount} 張</span>
              </div>
              <div className={`tarot-gallery tarot-layout-count-${tarotCount}`}>
                {latestTarotReading.tarotImages.map((imageUrl, index) => (
                  <a className="tarot-card" href={imageUrl} target="_blank" rel="noreferrer" key={`${imageUrl}-${index}`} aria-label={`查看第 ${index + 1} 張塔羅牌`}>
                    <img src={imageUrl} alt={`第 ${index + 1} 張塔羅牌`} loading="lazy" />
                  </a>
                ))}
              </div>
              <div className="panel-foot tarot-foot"><span>牌面依據本次測算結果展示</span><span>✳</span><span>靜觀其象</span></div>
            </div>
          ) : (
            <>
              <p className="eyebrow">湘西秘術 · 緣起於此</p>
              <h1>命途有數，<br /><em>問心</em>則明。</h1>
              <p className="intro-copy">世間萬事皆有跡可循。把你的困惑說與老夫聽，或問流年，或求一卦，且看雲開月明時。</p>
              <div className="ink-stamp" aria-hidden="true">天機<br />可測</div>
              <div className="panel-foot"><span>一念起 · 萬象生</span><span>✳</span><span>聽君一席</span></div>
            </>
          )}
        </aside>

        <section className="chat-card" aria-label="與陳玉樓對話">
          <div className="chat-header">
            <div className="master-avatar" aria-hidden="true">陳</div>
            <div className="master-info"><strong>陳玉樓</strong><span>湘西陳大師 · 在線問卦</span></div>
            <div className="header-mark">陰陽<br />有序</div>
          </div>

          {authUser && <div className="conversation-toolbar">
            <label className="sr-only" htmlFor="conversation-select">選擇對話</label>
            <select
              id="conversation-select"
              value={activeConversationId}
              disabled={isLoading || isHistoryLoading}
              onChange={(event) => loadConversation(event.target.value)}
            >
              {conversations.map((conversation) => (
                <option key={conversation.conversation_id} value={conversation.conversation_id}>
                  {conversation.title}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleNewConversation} disabled={isLoading || isHistoryLoading}>＋ 新對話</button>
            <button className="conversation-delete" type="button" onClick={handleDeleteConversation} disabled={!activeConversationId || isLoading || isHistoryLoading}>刪除</button>
          </div>}

          <div className="chat-body" aria-live="polite">
            <div className="date-divider"><span>{isHistoryLoading ? '正在載入對話' : '對 話 記 錄'}</span></div>
            {messages.map((message, index) => (
              <div className={`message-row ${message.role}`} key={message.id || `${message.role}-${index}`}>
                {message.role === 'assistant' && <span className="message-seal">陳</span>}
                <div className="message-content">
                  {message.role === 'assistant' && <span className="speaker-label">陳大師</span>}
                  <div className="bubble">{message.text}</div>
                  <span className="message-time">{displayMessageTime(message.createdAt, message.role === 'assistant' ? '方才' : '剛剛')}</span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-row assistant" role="status" aria-label="陳大師正在思考">
                <span className="message-seal">陳</span>
                <div className="message-content">
                  <span className="speaker-label">陳大師</span>
                  <div className="bubble thinking"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {authUser ? <form className="composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="message-input">輸入想問的事情</label>
            <textarea
              id="message-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isLoading || isHistoryLoading}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form.requestSubmit()
                }
              }}
              placeholder="寫下你的困惑，陳大師為你解惑……"
              rows="1"
            />
            <div className="composer-bottom">
              <span className="composer-hint">Enter 發送 · Shift + Enter 換行</span>
              <button className="send-button" type="submit" aria-label="發送消息" disabled={!input.trim() || isLoading || isHistoryLoading || !activeConversationId}>
                <span>送 出</span><span aria-hidden="true">↗</span>
              </button>
            </div>
          </form> : <div className="auth-required">
            <span>請先註冊或登錄，再開始與陳大師對話。</span>
            <button type="button" onClick={() => { setAuthNotice(''); setAuthView('login') }}>前往登錄</button>
          </div>}
          {error && <div className="error-notice" role="alert">{error}</div>}
          <p className="privacy-note">所問皆是緣，請勿輸入敏感個人資料</p>
        </section>
      </section>
      )}

      <footer className="footer"><span>陳玉樓 · 觀星辨命，知進退而守本心</span><span>山河遠闊 · 人間煙火</span></footer>
    </main>
  )
}

export default App
