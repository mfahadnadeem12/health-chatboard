// Thin wrapper around the Express API. The login cookie is httpOnly, so JavaScript never sees it.
async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  config: () => request('/config'),
  me: () => request('/auth/me'),
  googleLogin: (credential) => request('/auth/google', { method: 'POST', body: { credential } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  threads: (category) => request(`/threads${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  thread: (id) => request(`/threads/${id}`),
  createThread: (data) => request('/threads', { method: 'POST', body: data }),
  createReply: (id, body) => request(`/threads/${id}/replies`, { method: 'POST', body: { body } }),
  deleteThread: (id) => request(`/threads/${id}`, { method: 'DELETE' }),
  deleteReply: (id) => request(`/replies/${id}`, { method: 'DELETE' }),
};
