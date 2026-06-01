// ============================================================
// SPITZ LINEAGE MANAGER — Main App
// ============================================================
import { auth, onAuth, logout, getAllDogs } from './firebase.js';

export const state = {
  user: null,
  dogs: [],
  currentPage: 'dogs',
  editingDogId: null,
  kennelName: ''
};

export async function navigate(page, params = {}) {
  state.currentPage = page;
  Object.assign(state, params);
  await renderPage();
}

export async function renderApp() {
  const app = document.getElementById('app');
  if (!state.user) {
    const { renderLogin } = await import('./pages/login.js');
    app.innerHTML = renderLogin();
    initLoginHandlers();
    return;
  }
  app.innerHTML = `
    <div id="app-shell">
      ${renderTopbar()}
      <main class="main-content" id="page-content"></main>
      ${renderBottomNav()}
    </div>
  `;
  document.getElementById('btn-logout')?.addEventListener('click', async () => await logout());
  await renderPage();
}

async function renderPage() {
  const container = document.getElementById('page-content');
  if (!container) return;
  switch (state.currentPage) {
    case 'dogs': { const { renderDogs } = await import('./pages/dogs.js'); renderDogs(container, state); break; }
    case 'dog-form': { const { renderDogForm } = await import('./pages/dog-form.js'); await renderDogForm(container, state); break; }
    case 'simulator': { const { renderSimulator } = await import('./pages/simulator.js'); renderSimulator(container, state); break; }
    case 'profile': { const { renderProfile } = await import('./pages/profile.js'); renderProfile(container, state); break; }
    default: { const { renderDogs } = await import('./pages/dogs.js'); renderDogs(container, state); }
  }
  // Update active nav
  const oldNav = document.getElementById('bottom-nav');
  if (oldNav) {
    const tmp = document.createElement('div');
    tmp.innerHTML = renderBottomNav();
    oldNav.replaceWith(tmp.firstChild);
  }
}

function renderTopbar() {
  return `<header class="topbar">
    <a class="topbar-logo" href="#" onclick="window._nav('dogs');return false;">
      <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" fill="rgba(200,134,10,.15)"/>
        <circle cx="24" cy="24" r="10" fill="rgba(200,134,10,.3)"/>
        <circle cx="24" cy="24" r="4" fill="#c8860a"/>
      </svg>
      Spitz Lineage
    </a>
    <button class="btn btn-ghost btn-sm" id="btn-logout">Sair</button>
  </header>`;
}

function renderBottomNav() {
  const pages = [
    { id:'dogs', label:'Meu Canil', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M8 8C6 6 4 7 4 9s2 3 4 2m8-3c2-2 4-1 4 1s-2 3-4 2"/></svg>' },
    { id:'dog-form', label:'Cadastrar', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>' },
    { id:'simulator', label:'Simulador', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3c0 4 8 4 8 8s-8 4-8 8"/><path d="M16 3c0 4-8 4-8 8s8 4 8 8"/><path d="M6 7h12M6 17h12"/></svg>' },
    { id:'profile', label:'Perfil', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>' }
  ];
  return `<nav class="bottom-nav" id="bottom-nav">
    ${pages.map(p=>`<button class="bottom-nav-item ${state.currentPage===p.id?'active':''}" onclick="window._nav('${p.id}')">${p.icon}<span>${p.label}</span></button>`).join('')}
  </nav>`;
}

function initLoginHandlers() {
  const form = document.getElementById('login-form');
  const errEl = document.getElementById('login-error');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      const { login } = await import('./firebase.js');
      await login(form.email.value.trim(), form.password.value);
    } catch {
      errEl.textContent = 'E-mail ou senha incorretos.';
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  });
}

window._nav = (page, params) => navigate(page, params || {});
window.navigate = window._nav;

onAuth(async (user) => {
  document.getElementById('loading-screen')?.remove();
  state.user = user;
  if (user) {
    state.kennelName = localStorage.getItem(`kennel_name_${user.uid}`) || 'Meu Canil';
    try { state.dogs = await getAllDogs(user.uid); } catch { state.dogs = []; }
  }
  await renderApp();
});
