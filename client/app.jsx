import React, { useEffect, useRef, useState } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8787';

function ChatBubble({ role, children, sub }) {
  const isUser = role === 'user';
  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm text-sm leading-6 whitespace-pre-wrap ${
        isUser ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-zinc-900 rounded-bl-sm'
      }`}>
        {children}
        {sub && <div className={`mt-1 text-xs opacity-70 ${isUser ? 'text-emerald-50' : 'text-zinc-500'}`}>{sub}</div>}
      </div>
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [permission, setPermission] = useState('unknown');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const askPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setPermission('granted');
      return true;
    } catch (e) {
      console.error(e);
      setPermission('denied');
      return false;
    }
  }

  const toggleRecording = async () => {
    if (!recording) {
      const ok = permission === 'granted' || await askPermission();
      if (!ok) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data?.size) chunksRef.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } else {
      const mr = mediaRecorderRef.current;
      if (!mr) return;
      await new Promise(resolve => { mr.onstop = resolve; mr.stop(); });
      setRecording(false);

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setMessages(m => [...m, { role: 'user', content: '🎤 Voice note', sub: 'webm • ' + new Date().toLocaleTimeString(), audioUrl: url }]);

      setBusy(true);
      try {
        const form = new FormData();
        form.append('audio', blob, 'note.webm');
        if (prompt.trim()) form.append('prompt', prompt.trim());

        const r = await fetch(`${SERVER_URL}/api/transcribe`, { method: 'POST', body: form });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.details || data?.error || 'Transcription failed');

        setMessages(m => [...m, { role: 'assistant', content: data.text || '(no text returned)' }]);
      } catch (e) {
        console.error(e);
        setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${e.message}` }]);
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-zinc-200">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
          <div className="size-7 rounded-md bg-emerald-600" />
          <div>
            <div className="text-sm font-semibold">Voice Notes Chat</div>
            <div className="text-xs text-zinc-500">Record, transcribe, and read like ChatGPT</div>
          </div>
          <div className="ml-auto text-xs text-zinc-500">Server: {SERVER_URL}</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pt-6 pb-24">
          {messages.length === 0 && (
            <div className="text-center text-zinc-500 text-sm py-16">
              Tap the mic to start a new voice note.
            </div>
          )}
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} sub={m.sub}>
              {m.audioUrl ? (
                <audio src={m.audioUrl} controls className="w-full" />
              ) : (
                m.content
              )}
            </ChatBubble>
          ))}
          {busy && (
            <ChatBubble role="assistant">
              <span className="inline-flex items-center gap-2">
                <span className="animate-pulse">Transcribing…</span>
                <span className="size-2 rounded-full bg-zinc-400 animate-bounce"></span>
              </span>
            </ChatBubble>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
          <input
            className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Optional prompt (e.g., names, context)…"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
          <button
            onClick={toggleRecording}
            className={`rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition ${
              recording ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
            }`}
            title={recording ? 'Stop recording' : 'Start recording'}
          >
            {recording ? 'Stop' : 'Record'}
          </button>
        </div>
      </div>
    </div>
  )
}
