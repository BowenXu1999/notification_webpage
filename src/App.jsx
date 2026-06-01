import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'reminder-todos'

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

function App() {
  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
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
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (notificationPermission !== 'granted') return

    todos.forEach((todo) => {
      const dueTime = todo.dueAt ? new Date(todo.dueAt).getTime() : 0
      if (todo.completed || todo.notified || !dueTime || dueTime > now) return

      new Notification('待办提醒', {
        body: todo.title,
      })

      setTodos((current) =>
        current.map((item) =>
          item.id === todo.id ? { ...item, notified: true } : item,
        ),
      )
    })
  }, [notificationPermission, now, todos])

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

  async function requestNotifications() {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Todo Reminder</p>
          <h1>待办事项提醒</h1>
        </div>
        <button className="ghost-button" type="button" onClick={requestNotifications}>
          {notificationPermission === 'granted' ? '通知已开启' : '开启提醒通知'}
        </button>
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
