import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { FLAGS, URGENT } from '../safety.js';

function ago(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Two-click delete, because the browser's confirm() dialog is easy to dismiss by habit.
function DeleteButton({ label, onDelete }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`linkbtn danger${armed ? ' armed' : ''}`} onClick={() => (armed ? onDelete() : setArmed(true))}>
      {armed ? 'Click again to confirm' : label}
    </button>
  );
}

function Composer({ categories, onCreated, onCancel }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const urgent = FLAGS.test(`${title} ${body}`);

  async function submit(e) {
    e.preventDefault();
    if (title.trim().length < 8) return setMsg('Add a short question of at least a few words.');
    if (body.trim().length < 10) return setMsg('Add some details so people can help.');
    setBusy(true);
    setMsg('Posting...');
    try {
      await api.createThread({ title, body, category });
      onCreated();
    } catch (err) {
      setMsg(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <label htmlFor="c-title">Question
        <input id="c-title" className="field" maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How do you manage afternoon energy crashes?" autoComplete="off" />
      </label>
      <label htmlFor="c-cat">Topic
        <select id="c-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label htmlFor="c-body">Details
        <textarea id="c-body" className="field" maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What is going on, how long, and what have you already tried? Leave out anything that identifies you." />
      </label>
      {urgent && <div className="alert" role="alert">{URGENT}</div>}
      <div className="row">
        <button type="submit" className="btn" disabled={busy}>Post question</button>
        <button type="button" className="btn quiet" onClick={onCancel}>Cancel</button>
        <span className="hint" role="status">{msg}</span>
      </div>
    </form>
  );
}

function ThreadView({ id, user, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.thread(id).then(setData).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const mayDelete = (a) => user && (user.role === 'admin' || user.id === a.id);

  async function send(e) {
    e.preventDefault();
    if (reply.trim().length < 3) return setMsg('Write a reply first.');
    setBusy(true);
    setMsg('Posting...');
    try {
      await api.createReply(id, reply);
      setReply('');
      setMsg('');
      await load();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <section>
        <button type="button" className="linkbtn" onClick={onBack}>&larr; All questions</button>
        <p className="alert">{error}</p>
      </section>
    );
  }
  if (!data) return <p className="status">Loading...</p>;
  const { thread, replies } = data;

  return (
    <section>
      <button type="button" className="linkbtn back" onClick={onBack}>&larr; All questions</button>
      <article className="post">
        <div className="meta"><span className="pill">{thread.category}</span><span className="mono">{thread.author.name} · {ago(thread.createdAt)}</span></div>
        <h2>{thread.title}</h2>
        <div className="body">{thread.body}</div>
        {mayDelete(thread.author) && (
          <div className="row"><DeleteButton label="Delete question" onDelete={() => api.deleteThread(id).then(onBack).catch((e) => setMsg(e.message))} /></div>
        )}
      </article>

      <section className="replies">
        <h3>{replies.length ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'No replies yet'}</h3>
        {!replies.length && <p className="hint">Be the first to share what helped you.</p>}
        {replies.map((r) => (
          <div className="reply" key={r.id}>
            <div className="meta">
              <strong>{r.author.name}</strong><span className="mono">{ago(r.createdAt)}</span>
              {mayDelete(r.author) && <DeleteButton label="Delete" onDelete={() => api.deleteReply(r.id).then(load).catch((e) => setMsg(e.message))} />}
            </div>
            <div className="body">{r.body}</div>
          </div>
        ))}
      </section>

      {user ? (
        <form className="reply-form" onSubmit={send}>
          <label htmlFor="r-body">Your reply
            <textarea id="r-body" className="field" maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Share what helped you. Please avoid giving dosing instructions." />
          </label>
          <div className="row">
            <button type="submit" className="btn" disabled={busy}>Post reply</button>
            <span className="hint" role="status">{msg}</span>
          </div>
        </form>
      ) : (
        <p className="hint">Sign in with Google at the top of the page to reply.</p>
      )}
    </section>
  );
}

export default function Board({ user, categories }) {
  const [cat, setCat] = useState('All');
  const [threads, setThreads] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(() => {
    setError('');
    return api.threads(cat === 'All' ? '' : cat).then((r) => setThreads(r.threads)).catch((e) => setError(e.message));
  }, [cat]);
  useEffect(() => { setThreads(null); load(); }, [load]);

  if (openId) return <ThreadView id={openId} user={user} onBack={() => { setOpenId(null); load(); }} />;

  return (
    <section>
      <div className="board-head">
        <h2>Community questions</h2>
        <button type="button" className="btn" disabled={!user} onClick={() => setComposing(true)}>Ask a question</button>
      </div>
      {!user && <p className="hint pad">Anyone can read. Sign in with Google at the top of the page to ask or reply.</p>}

      {composing && user && <Composer categories={categories} onCancel={() => setComposing(false)} onCreated={() => { setComposing(false); load(); }} />}

      <div className="chips" role="group" aria-label="Filter by topic">
        {['All', ...categories].map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      {error && <p className="alert">{error}</p>}
      {!error && threads === null && <p className="status">Loading questions...</p>}
      {threads && !threads.length && (
        <div className="empty">
          <h3>{cat === 'All' ? 'No questions yet' : `No questions in ${cat} yet`}</h3>
          <p>Ask what you have been wondering about. Replies from other people appear here.</p>
        </div>
      )}
      {threads && threads.length > 0 && (
        <ul className="threads">
          {threads.map((t) => (
            <li className="thread" key={t.id}>
              <button type="button" className="open" onClick={() => setOpenId(t.id)}>
                <div className="meta">
                  <span className="pill">{t.category}</span>
                  <span className="mono">{t.replyCount} {t.replyCount === 1 ? 'reply' : 'replies'}</span>
                  <span className="mono">{ago(t.createdAt)}</span>
                </div>
                <h3>{t.title}</h3>
                <p className="snip">{t.body}</p>
                <span className="hint">Asked by {t.author.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
