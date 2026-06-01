import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'reminder-todos'
const SETTINGS_KEY = 'reminder-settings'
const EMAIL_RECIPIENT = 'b62xu@uwaterloo.ca'

const priorities = {
  high: '高',
  medium: '中',
  low: '低',
}

const filters = {
  all: '全部',
  active: '未完成',
  completed: '已完成',
  due: '已到期',
}

const initialForm = {
  title: '',
  note: '',
  dueAt: '',
  priority: 'medium',
}

function formatDateTime(value) {
  if (!value) return '未设置'

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getStatus(todo, now) {
  if (todo.completed) return '已完成'
  if (!todo.dueAt) return '待安排'

  const dueTime = new Date(todo.dueAt).getTime()
  if (dueTime <= now) return '已到期'
  if (dueTime - now <= 60 * 60 * 1000) return '即将到期'
  return '进行中'
}

function createMailtoHref(todo) {
  const subject = `待办提醒：${todo.title}`
  const body = [
    `事项：${todo.title}`,
    `备注：${todo.note || '无'}`,
    `提醒时间：${todo.dueAt ? formatDateTime(todo.dueAt) : '未设置'}`,
    `优先级：${priorities[todo.priority]}`,
  ].join('\n')

  return `mailto:${EMAIL_RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function App() {
  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_KEY)
    return saved ? JSON.parse(saved).emailReminderEnabled : false
  })
  const [form, setForm] = useState(initialForm)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(Date.now())
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos])

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ emailReminderEnabled }),
    )
  }, [emailReminderEnabled])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (notificationPermission !== 'granted' && !emailReminderEnabled) return

    const dueTodos = todos.filter((todo) => {
      const dueTime = todo.dueAt ? new Date(todo.dueAt).getTime() : 0
      const notificationPending =
        notificationPermission === 'granted' && !todo.notified
      const emailPending = emailReminderEnabled && !todo.emailDrafted

      return (
        !todo.completed &&
        dueTime &&
        dueTime <= now &&
        (notificationPending || emailPending)
      )
    })

    if (dueTodos.length === 0) return

    if (notificationPermission === 'granted') {
      dueTodos.forEach((todo) => {
        new Notification('待办提醒', {
          body: todo.note ? `${todo.title}\n${todo.note}` : todo.title,
        })
      })
    }

    const emailTodo = dueTodos.find((todo) => !todo.emailDrafted)
    if (emailReminderEnabled && emailTodo) {
      window.location.href = createMailtoHref(emailTodo)
    }

    setTodos((current) =>
      current.map((item) => {
        const isDue = dueTodos.some((todo) => todo.id === item.id)
        if (!isDue) return item

        return {
          ...item,
          notified: notificationPermission === 'granted' ? true : item.notified,
          emailDrafted: emailReminderEnabled ? true : item.emailDrafted,
        }
      }),
    )
  }, [emailReminderEnabled, notificationPermission, now, todos])

  const stats = useMemo(() => {
    const active = todos.filter((todo) => !todo.completed).length
    const completed = todos.length - active
    const due = todos.filter(
      (todo) => !todo.completed && todo.dueAt && new Date(todo.dueAt).getTime() <= now,
    ).length

    return { active, completed, due, total: todos.length }
  }, [now, todos])

  const visibleTodos = useMemo(() => {
    const keyword = query.trim().toLowerCase()

    return todos
      .filter((todo) => {
        const matchesQuery =
          !keyword ||
          todo.title.toLowerCase().includes(keyword) ||
          todo.note.toLowerCase().includes(keyword)

        if (!matchesQuery) return false
        if (filter === 'active') return !todo.completed
        if (filter === 'completed') return todo.completed
        if (filter === 'due') {
          return !todo.completed && todo.dueAt && new Date(todo.dueAt).getTime() <= now
        }

        return true
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        if (!a.dueAt) return 1
        if (!b.dueAt) return -1
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      })
  }, [filter, now, query, todos])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function addTodo(event) {
    event.preventDefault()
    const title = form.title.trim()

    if (!title) return

    setTodos((current) => [
      {
        id: crypto.randomUUID(),
        title,
        note: form.note.trim(),
        dueAt: form.dueAt,
        priority: form.priority,
        completed: false,
        notified: false,
        emailDrafted: false,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ])
    setForm(initialForm)
  }

  function toggleTodo(id) {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    )
  }

  function removeTodo(id) {
    setTodos((current) => current.filter((todo) => todo.id !== id))
  }

  async function enableReminders() {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported')
    } else {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
    }

    setEmailReminderEnabled(true)
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Todo Reminder</p>
          <h1>待办事项提醒</h1>
        </div>
        <div className="reminder-action">
          <button className="ghost-button" type="button" onClick={enableReminders}>
            {emailReminderEnabled ? '邮箱提醒已开启' : '开启邮箱提醒'}
          </button>
          <p>到期时生成发送给 {EMAIL_RECIPIENT} 的邮件草稿。</p>
        </div>
      </section>

      <section className="workspace">
        <form className="todo-form" onSubmit={addTodo}>
          <label>
            <span>事项</span>
            <input
              value={form.title}
              onChange={(event) => updateForm('title', event.target.value)}
              placeholder="例如：给客户发周报"
            />
          </label>

          <label>
            <span>备注</span>
            <textarea
              value={form.note}
              onChange={(event) => updateForm('note', event.target.value)}
              placeholder="补充地点、材料或注意点"
              rows="4"
            />
          </label>

          <div className="form-grid">
            <label>
              <span>提醒时间</span>
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) => updateForm('dueAt', event.target.value)}
              />
            </label>

            <label>
              <span>优先级</span>
              <select
                value={form.priority}
                onChange={(event) => updateForm('priority', event.target.value)}
              >
                {Object.entries(priorities).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button className="primary-button" type="submit">
            添加待办
          </button>
        </form>

        <section className="task-panel">
          <div className="summary-grid" aria-label="待办统计">
            <div>
              <span>{stats.total}</span>
              <p>全部</p>
            </div>
            <div>
              <span>{stats.active}</span>
              <p>未完成</p>
            </div>
            <div>
              <span>{stats.due}</span>
              <p>已到期</p>
            </div>
            <div>
              <span>{stats.completed}</span>
              <p>已完成</p>
            </div>
          </div>

          <div className="tools">
            <input
              className="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索待办"
            />
            <div className="segments">
              {Object.entries(filters).map(([value, label]) => (
                <button
                  className={filter === value ? 'active' : ''}
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="todo-list">
            {visibleTodos.length === 0 ? (
              <div className="empty-state">
                <h2>暂无待办</h2>
                <p>添加一条事项，它会保存在本机浏览器中。</p>
              </div>
            ) : (
              visibleTodos.map((todo) => {
                const status = getStatus(todo, now)

                return (
                  <article
                    className={`todo-card ${todo.completed ? 'completed' : ''}`}
                    key={todo.id}
                  >
                    <button
                      className="check-button"
                      type="button"
                      aria-label={todo.completed ? '标记为未完成' : '标记为已完成'}
                      onClick={() => toggleTodo(todo.id)}
                    >
                      {todo.completed ? '✓' : ''}
                    </button>

                    <div className="todo-content">
                      <div className="todo-heading">
                        <h2>{todo.title}</h2>
                        <span className={`priority ${todo.priority}`}>
                          {priorities[todo.priority]}
                        </span>
                      </div>
                      {todo.note && <p>{todo.note}</p>}
                      <div className="todo-meta">
                        <span>{formatDateTime(todo.dueAt)}</span>
                        <span className={`status ${status}`}>{status}</span>
                      </div>
                    </div>

                    <button
                      className="delete-button"
                      type="button"
                      aria-label="删除待办"
                      onClick={() => removeTodo(todo.id)}
                    >
                      删除
                    </button>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
