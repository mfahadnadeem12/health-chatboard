import { useEffect, useState } from 'react';
import { api } from './api.js';
import { useOpenRouter } from './openrouter.js';
import GoogleSignIn from './components/GoogleSignIn.jsx';
import Board from './components/Board.jsx';
import Assistant from './components/Assistant.jsx';

export default function App() {
  const [config, setConfig] = useState(null);
  const [fatal, setFatal] = useState('');
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState(() => (window.location.hash === '#assistant' ? 'assistant' : 'board'));
  const or = useOpenRouter();

  useEffect(() => {
    api.config().then(setConfig).catch(() => setFatal('The server is not reachable. Start it and reload this page.'));
    api.me().then((r) => setUser(r.user)).catch(() => {});
  }, []);

  // Coming back from OpenRouter: show the assistant straight away.
  useEffect(() => { if (or.key) setTab('assistant'); }, [or.busy]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onCredential(credential) {
    setAuthError('');
    try {
      const r = await api.googleLogin(credential);
      setUser(r.user);
    } catch (e) {
      setAuthError(e.message);
    }
  }

  async function signOut() {
    await api.logout().catch(() => {});
    setUser(null);
  }

  return (
    <div className="wrap" data-tab={tab}>
      <header className="mast">
        <div>
          <h1>Health Chatboard</h1>
          <p>Ask a question and hear from other people. Use the assistant when you want a plain-language explanation right now.</p>
        </div>
        <div className="accounts">
          <div className="acct">
            <span className="mono">Board</span>
            {user ? (
              <span className="who">{user.name}{user.role === 'admin' ? ' (moderator)' : ''} <button type="button" className="linkbtn" onClick={signOut}>Sign out</button></span>
            ) : config ? (
              <GoogleSignIn clientId={config.googleClientId} onCredential={onCredential} />
            ) : null}
          </div>
          <div className="acct">
            <span className="mono">Assistant</span>
            {or.key ? (
              <span className="who">OpenRouter connected <button type="button" className="linkbtn" onClick={or.disconnect}>Disconnect</button></span>
            ) : (
              <button type="button" className="btn small" onClick={or.connect} disabled={or.busy}>{or.busy ? 'Connecting...' : 'Connect OpenRouter'}</button>
            )}
          </div>
        </div>
      </header>

      {authError && <div className="alert" role="alert">{authError}</div>}
      {fatal && <div className="alert" role="alert">{fatal}</div>}

      <div className="safety" role="note">
        <strong>Not medical advice</strong>
        <span>This board shares general information and personal experience. It cannot diagnose you. In an emergency, call your local emergency number or go to the nearest emergency department. Please do not post names, phone numbers or test results that identify you.</span>
      </div>

      <nav className="tabs" aria-label="Sections">
        <button type="button" aria-pressed={tab === 'board'} onClick={() => setTab('board')}>Community board</button>
        <button type="button" aria-pressed={tab === 'assistant'} onClick={() => setTab('assistant')}>Ask the assistant</button>
      </nav>

      <div className="desk">
        <main className="panel-board">
          {config ? <Board user={user} categories={config.categories} /> : !fatal && <p className="status">Loading...</p>}
        </main>
        <Assistant
          orKey={or.key}
          connecting={or.busy}
          connectError={or.error}
          onConnect={or.connect}
          onKeyRejected={or.disconnect}
        />
      </div>
    </div>
  );
}
