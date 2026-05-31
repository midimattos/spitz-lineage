import { logout } from '../firebase.js';
import { state } from '../app.js';

export function renderProfile(container, appState) {
  const kennelName = localStorage.getItem(`kennel_name_${appState.user.uid}`) || '';
  container.innerHTML = `
    <div class="page-header">
      <h1 class="font-display">Perfil & Configurações</h1>
    </div>
    <div class="card">
      <div class="section-title" style="margin-bottom:12px">Informações do Canil</div>
      <div class="form-group">
        <label class="form-label">Nome do Canil</label>
        <input class="form-input" id="kennel-name" placeholder="ex: Canil Von Haus" value="${kennelName}" />
        <p class="text-sm text-muted mt-8">Aparece no cabeçalho dos certificados PDF.</p>
      </div>
      <button class="btn btn-primary" id="btn-save-kennel">Salvar Nome</button>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="section-title" style="margin-bottom:12px">Conta</div>
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface2);border-radius:8px;margin-bottom:14px">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--surface3);
          display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">👤</div>
        <div>
          <div style="font-weight:600">${appState.user.email}</div>
          <div class="text-muted text-sm">Assinante ativo</div>
        </div>
      </div>
      <button class="btn btn-outline btn-full" id="btn-logout-p">Sair da conta</button>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="section-title" style="margin-bottom:10px">Estatísticas</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="padding:14px;background:var(--surface2);border-radius:8px;text-align:center">
          <div style="font-size:2rem;font-family:var(--font-display);color:var(--gold)">
            ${appState.dogs.filter(d=>d.belongsToMe).length}</div>
          <div class="text-muted text-sm">Cães no Canil</div>
        </div>
        <div style="padding:14px;background:var(--surface2);border-radius:8px;text-align:center">
          <div style="font-size:2rem;font-family:var(--font-display);color:var(--gold)">
            ${appState.dogs.filter(d=>!d.belongsToMe).length}</div>
          <div class="text-muted text-sm">Banco de Linhagem</div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('btn-save-kennel')?.addEventListener('click', () => {
    const name = document.getElementById('kennel-name').value.trim();
    localStorage.setItem(`kennel_name_${appState.user.uid}`, name);
    state.kennelName = name;
    const btn = document.getElementById('btn-save-kennel');
    btn.textContent = '✓ Salvo!'; setTimeout(()=>btn.textContent='Salvar Nome', 2000);
  });
  document.getElementById('btn-logout-p')?.addEventListener('click', async () => { await logout(); });
}
