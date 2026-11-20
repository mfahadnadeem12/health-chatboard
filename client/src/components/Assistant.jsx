import { useEffect, useRef, useState } from 'react';
import { listModels, streamChat, friendlyError, getModel, setModel } from '../openrouter.js';
import { RULES, FLAGS, URGENT, SUGGESTIONS } from '../safety.js';

export default function Assistant({ orKey, connecting, connectError, onConnect, onKeyRejected }) {
  const [models, setModels] = useState([]);
  const [modelsError, setModelsError] = useState('');
  const [model, setModelState] = useState(getModel() || '');
  const [turns, setTurns] = useState([]); // {kind: 'user' | 'assistant' | 'urgent' | 'error', content}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [partial, setPartial] = useState(null);
  const ctl = useRef(null);
  const latest = useRef('');
  const chat = useRef(null);

  useEffect(() => {
    let on = true;
    listModels()
      .then((m) => {
        if (!on) return;
        setModels(m);
        setModelState((cur) => (cur && m.some((x) => x.id === cur) ? cur : m.find((x) => x.free)?.id || m[0]?.id || ''));
      })
      .catch(() => on && setModelsError('Could not load the model list. Reload to try again.'));
    return () => { on = false; };
  }, []);

  useEffect(() => { if (chat.current) chat.current.scrollTop = chat.current.scrollHeight; }, [turns, partial]);

  const free = models.filter((m) => m.free);
  const paid = models.filter((m) => !m.free);
  const picked = models.find((m) => m.id === model);

  function pickModel(id) {
    setModelState(id);
    setModel(id);
  }

  async function send(raw) {
    const text = raw.trim();
    if (!text || busy || !model) return;
    const next = [...turns, { kind: 'user', content: text }];
    if (FLAGS.test(text)) next.push({ kind: 'urgent' });
    setTurns(next);
    setInput('');
    setBusy(true);
    setPartial('');
    latest.current = '';

    const history = next.filter((t) => t.kind === 'user' || t.kind === 'assistant').slice(-12).map((t) => ({ role: t.kind, content: t.content }));
    while (history[0]?.role === 'assistant') history.shift();

    ctl.current = new AbortController();
    try {
      const out = await streamChat({
        key: orKey,
        model,
        messages: [{ role: 'system', content: RULES }, ...history],
        signal: ctl.current.signal,
        onText: (t) => { latest.current = t; setPartial(t); },
      });
      setTurns((t) => [...t, { kind: 'assistant', content: out || 'No answer came back. Try rephrasing the question.' }]);
    } catch (e) {
      if (e.name === 'AbortError') {
        if (latest.current) setTurns((t) => [...t, { kind: 'assistant', content: latest.current }]);
      } else {
        if (e.status === 401) onKeyRejected();
        setTurns((t) => [...t, { kind: 'error', content: friendlyError(e) }]);
      }
    } finally {
      setBusy(false);
      setPartial(null);
    }
  }

  if (!orKey) {
    return (
      <aside className="panel-assist" aria-label="Health assistant">
        <div className="assist-head"><span className="mono">Assistant</span><h2>Ask a health question</h2></div>
        <div className="connect">
          <p>The assistant runs on your own OpenRouter account, so your usage is yours and nothing is billed to this site.</p>
          <ul>
            <li>Free models need no payment. They allow 20 requests a minute and a daily cap.</li>
            <li>Paid models use credits you add on openrouter.ai.</li>
            <li>Your key stays in this browser. This site's server never sees it or your chats.</li>
          </ul>
          <button type="button" className="btn" onClick={onConnect} disabled={connecting}>{connecting ? 'Connecting...' : 'Connect OpenRouter'}</button>
          {connectError && <p className="alert" role="alert">{connectError}</p>}
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel-assist" aria-label="Health assistant">
      <div className="assist-head">
        <span className="mono">Assistant</span>
        <h2>Ask a health question</h2>
        <label className="modelpick" htmlFor="model">Model
          <select id="model" className="field" value={model} onChange={(e) => pickModel(e.target.value)} disabled={busy || !models.length}>
            {!models.length && <option value="">Loading models...</option>}
            {free.length > 0 && <optgroup label="Free">{free.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>}
            {paid.length > 0 && <optgroup label="Paid (uses your credits)">{paid.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>}
          </select>
        </label>
        {modelsError && <p className="hint">{modelsError}</p>}
        {picked?.free && <p className="hint">Some free models may keep prompts to improve them. Leave out anything that identifies you.</p>}
      </div>

      <div className="chat" ref={chat} aria-live="polite">
        <div className="bubble bot">Hi. I can explain symptoms, tests, medicines and healthy habits in plain language. I cannot diagnose you or tell you what dose to take. What would you like to know?</div>
        {!turns.length && (
          <div className="suggest">
            {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)} disabled={!model}>{s}</button>)}
          </div>
        )}
        {turns.map((t, i) => {
          if (t.kind === 'urgent') return <div className="urgent" role="alert" key={i}>{URGENT}</div>;
          if (t.kind === 'error') return <div className="bubble err" key={i}>{t.content}</div>;
          return <div className={`bubble ${t.kind === 'user' ? 'user' : 'bot'}`} key={i}>{t.content}</div>;
        })}
        {partial !== null && <div className={`bubble bot${partial ? '' : ' pending'}`}>{partial || 'Thinking...'}</div>}
      </div>

      <form className="ask" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <label className="mono" htmlFor="q">Your question</label>
        <textarea
          id="q"
          className="field"
          maxLength={1500}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }}
          placeholder="Type a question. Enter sends, Shift+Enter adds a line."
        />
        <div className="row end">
          {turns.length > 0 && !busy && <button type="button" className="btn quiet small" onClick={() => setTurns([])}>Clear chat</button>}
          {busy && <button type="button" className="btn quiet small" onClick={() => ctl.current?.abort()}>Stop</button>}
          <button type="submit" className="btn" disabled={busy || !model}>Send</button>
        </div>
      </form>
    </aside>
  );
}
