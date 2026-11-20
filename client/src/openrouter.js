// OpenRouter login (OAuth PKCE) and chat, all in the browser.
// The user's API key is stored in this browser only. Our server never sees the key or the chats.
import { useEffect, useState } from 'react';

const API = 'https://openrouter.ai/api/v1';
const K = { key: 'or_api_key', model: 'or_model', verifier: 'or_pkce_verifier', state: 'or_pkce_state' };

function makeStore(area) {
  return {
    get: (k) => { try { return window[area].getItem(k); } catch { return null; } },
    set: (k, v) => { try { window[area].setItem(k, v); } catch { /* storage blocked */ } },
    del: (k) => { try { window[area].removeItem(k); } catch { /* storage blocked */ } },
  };
}
const local = makeStore('localStorage');
const session = makeStore('sessionStorage');

export const getKey = () => local.get(K.key);
export const getModel = () => local.get(K.model);
export const setModel = (id) => local.set(K.model, id);
export const clearKey = () => local.del(K.key);

function b64url(bytes) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomString(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

// Step 1: send the user to OpenRouter to approve access. We keep a random verifier;
// OpenRouter only gets its SHA-256 hash, so a stolen code is useless without it.
export async function startLogin() {
  const verifier = randomString(64);
  const state = randomString(16);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  session.set(K.verifier, verifier);
  session.set(K.state, state);

  const url = new URL('https://openrouter.ai/auth');
  url.searchParams.set('callback_url', `${window.location.origin}/`);
  url.searchParams.set('code_challenge', b64url(new Uint8Array(digest)));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  window.location.assign(url.toString());
}

export const hasPendingLogin = () => Boolean(session.get(K.verifier));

// Step 2: OpenRouter sends the user back with ?code=... and we trade it for the user's own key.
export async function finishLogin(code, returnedState) {
  const verifier = session.get(K.verifier);
  const state = session.get(K.state);
  session.del(K.verifier);
  session.del(K.state);
  if (!verifier) throw new Error('The login session expired. Click Connect OpenRouter again.');
  if (returnedState && state && returnedState !== state) {
    throw new Error('The login response did not match this browser. Click Connect OpenRouter again.');
  }
  const res = await fetch(`${API}/auth/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.key) {
    throw new Error(data?.error?.message || data?.error || 'OpenRouter did not return a key. Try connecting again.');
  }
  local.set(K.key, data.key);
  return data.key;
}

let exchanging = false; // React StrictMode runs effects twice; a code can only be used once.

export function useOpenRouter() {
  const [key, setKey] = useState(() => getKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code || exchanging || !hasPendingLogin()) return;
    exchanging = true;
    setBusy(true);
    finishLogin(code, params.get('state'))
      .then(setKey)
      .catch((e) => setError(e.message))
      .finally(() => {
        setBusy(false);
        window.history.replaceState({}, '', window.location.pathname);
      });
  }, []);

  return {
    key,
    busy,
    error,
    connect: () => { setError(''); startLogin().catch((e) => setError(e.message)); },
    disconnect: () => { clearKey(); setKey(null); },
  };
}

export async function listModels() {
  const res = await fetch(`${API}/models`);
  if (!res.ok) throw new Error('Could not load models.');
  const { data } = await res.json();
  return data
    .filter((m) => (m.architecture?.output_modalities || ['text']).includes('text'))
    .map((m) => ({
      id: m.id,
      name: m.name || m.id,
      free: m.id.endsWith(':free') || (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0),
    }))
    .sort((a, b) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name));
}

export class OpenRouterError extends Error {
  constructor(status, message) {
    super(message || 'OpenRouter returned an error.');
    this.status = Number(status) || 500;
  }
}

export function friendlyError(e) {
  switch (e.status) {
    case 401: return 'OpenRouter rejected your key. Disconnect and connect again.';
    case 402: return 'Not enough OpenRouter credits for this model. Pick a free model or add credits at openrouter.ai.';
    case 403: return 'OpenRouter blocked that request. Try rephrasing, or pick another model.';
    case 404: return 'That model is not available for your account settings. Pick another model.';
    case 429: return 'Rate limit reached. Free models allow 20 requests a minute and a daily cap. Wait a bit, or pick another model.';
    default: return e.message || 'Something went wrong reaching OpenRouter. Try again.';
  }
}

// Streams an answer. onText receives the whole answer so far.
export async function streamChat({ key, model, messages, signal, onText }) {
  const res = await fetch(`${API}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new OpenRouterError(res.status, data?.error?.message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue; // comments like ": OPENROUTER PROCESSING"
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return text;
      let json;
      try { json = JSON.parse(payload); } catch { continue; }
      if (json.error) throw new OpenRouterError(json.error.code, json.error.message);
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) {
        text += delta;
        onText(text);
      }
    }
  }
  return text;
}
