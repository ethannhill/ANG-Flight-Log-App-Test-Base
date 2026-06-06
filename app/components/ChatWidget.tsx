'use client'
import { useEffect, useRef, useState } from 'react'

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'How many hours this month?',
  'Show all PNG flights last 30 days',
  'Which aircraft has the most hours?',
  'How many logs pending review?',
]

export default function ChatWidget() {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send(text?: string) {
    const userText = (text ?? input).trim()
    if (!userText || loading) return
    setInput('')

    const next: Message[] = [...messages, { role: 'user', content: userText }]
    setMessages(next)
    setLoading(true)
    setMessages(m => [...m, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })

      if (!res.ok || !res.body) {
        setMessages(m => m.slice(0, -1).concat({ role: 'assistant', content: 'Something went wrong.' }))
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setMessages(m => m.slice(0, -1).concat({ role: 'assistant', content: full }))
      }
    } catch {
      setMessages(m => m.slice(0, -1).concat({ role: 'assistant', content: 'Something went wrong.' }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ width: 380, height: 520 }}>

          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ backgroundColor: '#ee7e2c' }}>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-semibold">Ask</span>
              <span className="text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded-full">AI</span>
            </div>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} className="text-xs text-white/70 hover:text-white transition">
                  Clear
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-base leading-none transition">
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-400 mb-1">Try asking…</p>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-left text-xs bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-600 hover:border-[#ee7e2c] hover:text-[#ee7e2c] transition">
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap leading-relaxed ${
                      m.role === 'user'
                        ? 'text-white rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                    }`} style={m.role === 'user' ? { backgroundColor: '#ee7e2c' } : {}}>
                      {m.content || <span className="text-gray-300 animate-pulse">Thinking…</span>}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-gray-100 px-3 py-3 bg-white">
            <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Ask anything about your flights…"
                rows={1}
                className="flex-1 resize-none text-xs text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
                style={{ maxHeight: 80 }}
              />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-40 shrink-0"
                style={{ backgroundColor: '#ee7e2c' }}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ backgroundColor: '#ee7e2c' }}
        title="Ask AI">
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>
    </div>
  )
}
