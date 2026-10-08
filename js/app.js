let pendingResolve = null;

function toast(message, type) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = document.createElement('div');
  node.className = 'toast' + (type ? ' ' + type : '');
  node.textContent = message;
  host.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .3s, transform .3s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(10px)';
    setTimeout(() => node.remove(), 320);
  }, 3200);
}

function openModal(html, onReady) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  root.hidden = false;
  root.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', closeModal));
  document.body.style.overflow = 'hidden';
  if (typeof onReady === 'function') onReady(root.querySelector('.modal'));
}

function closeModal() {
  const root = document.getElementById('modalRoot');
  root.hidden = true;
  root.innerHTML = '';
  document.body.style.overflow = '';
  if (pendingResolve) {
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve(false);
  }
}

function confirmDialog(message, title, confirmLabel) {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    openModal(`
      <div class="modal-head">
        <div class="modal-title">${esc(title || t('confirm'))}</div>
        <button class="btn btn-ghost btn-sm btn-icon" data-close>✕</button>
      </div>
      <p style="font-weight:600; color:var(--muted); margin-block-end:20px">${esc(message)}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cfNo">${esc(t('cancel'))}</button>
        <button class="btn btn-primary" id="cfYes">${esc(confirmLabel || t('confirm'))}</button>
      </div>`, (modal) => {
      modal.querySelector('#cfNo').addEventListener('click', () => {
        pendingResolve = null;
        closeModal();
        resolve(false);
      });
      modal.querySelector('#cfYes').addEventListener('click', () => {
        pendingResolve = null;
        closeModal();
        resolve(true);
      });
    });
  });
}

function setTheme(mode) {
  document.documentElement.dataset.theme = mode;
  localStorage.setItem('qp_theme', mode);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = mode === 'dark' ? '☀' : '☾';
}

function initTheme() {
  const saved = localStorage.getItem('qp_theme');
  const preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(saved || preferred);
}

function refreshHeader() {
  const link = document.getElementById('authLink');
  if (!link) return;
  const loggedIn = typeof isStudent === 'function' && isStudent();
  const me = typeof meCache === 'function' ? meCache() : null;
  if (loggedIn && me) {
    link.classList.add('user-chip');
    link.innerHTML = `👤 <span>${esc(me.displayName || me.username || '')}</span>`;
    link.setAttribute('href', '#/');
    link.setAttribute('title', t('signed_in_as'));
  } else {
    link.classList.remove('user-chip');
    link.textContent = '👤 ' + t('auth_login_tab');
    link.setAttribute('href', '#/auth');
    link.setAttribute('title', t('go_login'));
  }
}

function router() {
  const hash = location.hash || '#/';
  if (hash.indexOf('#/quiz/') === 0) {
    renderQuizRoute(decodeURIComponent(hash.slice('#/quiz/'.length)));
    refreshHeader();
    return;
  }
  if (hash.indexOf('#/review/') === 0) {
    renderReview(decodeURIComponent(hash.slice('#/review/'.length)));
    refreshHeader();
    return;
  }
  if (hash.indexOf('#/auth') === 0) {
    renderAuth();
    refreshHeader();
    return;
  }
  if (hash.indexOf('#/admin') === 0) {
    renderAdmin();
    refreshHeader();
    return;
  }
  renderHome();
  refreshHeader();
}

function initApp() {
  initTheme();

  document.getElementById('themeBtn').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.addEventListener('click', (e) => {
    if (e.target === modalRoot) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalRoot.hidden) closeModal();
  });

  window.addEventListener('hashchange', router);
  router();
}

document.addEventListener('DOMContentLoaded', initApp);
