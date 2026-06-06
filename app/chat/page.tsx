'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'How many hours this month?',
  'Show all PNG flights last 30 days',
  'Which aircraft has the most hours?',
  'How many logs are pending review?',
  'Top clients by flight hours',
  'Flights by Captain Smith',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const userText = (text ?? input).trim()
    if (!userText || loading) return
    setInput('')

    const next: Message[] = [...messages, { role: 'user', content: userText }]
    setMessages(next)
    setLoading(true)

    setMessages(m => [...m, { role: 'assistant', content: '' }])

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: next }),
    })

    if (!res.ok || !res.body) {
      setMessages(m => m.slice(0, -1).concat({ role: 'assistant', content: 'Something went wrong. Please try again.' }))
      setLoading(false)
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
    setLoading(false)
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4 shrink-0">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-gray-900">Air Navigator Group</div>
          <div className="text-xs text-gray-500">Ask</div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-6 pt-16">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 mb-1">Ask about your flights</p>
                <p className="text-sm text-gray-400">Hours, pilots, aircraft, routes — just ask.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-xl">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-left text-sm bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-600 hover:border-[#ee7e2c] hover:text-[#ee7e2c] transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#ee7e2c] text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}>
                    {m.content || <span className="text-gray-300 animate-pulse">Thinking…</span>}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 bg-gray-50 border-t border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-2xl flex items-end gap-2 px-4 py-3 shadow-sm">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask anything about your flight data…"
              rows={1}
              className="flex-1 resize-none text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              style={{ maxHeight: 120 }}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="bg-[#ee7e2c] hover:bg-[#d4691a] text-white text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors disabled:opacity-40">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
