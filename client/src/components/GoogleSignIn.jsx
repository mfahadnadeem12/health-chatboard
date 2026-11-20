import { useEffect, useRef, useState } from 'react';

const SRC = 'https://accounts.google.com/gsi/client';
let loader;

function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { loader = null; reject(new Error('load failed')); };
      document.head.append(s);
    });
  }
  return loader;
}

// Google draws the button. When the user finishes, we get a signed ID token and hand it to our server.
export default function GoogleSignIn({ clientId, onCredential }) {
  const box = useRef(null);
  const cb = useRef(onCredential);
  const [failed, setFailed] = useState(false);
  cb.current = onCredential;

  useEffect(() => {
    let cancelled = false;
    loadGoogle()
      .then(() => {
        if (cancelled || !box.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => cb.current(r.credential),
          ux_mode: 'popup',
        });
        window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'medium', text: 'signin_with', shape: 'rectangular' });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, [clientId]);

  if (failed) return <span className="hint">Google sign-in could not load. Check your connection or ad blocker.</span>;
  return <div ref={box} className="gbtn" />;
}
