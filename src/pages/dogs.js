// ============================================================
// DOGS LIST PAGE
// ============================================================
import { deleteDog, getAllDogs, fetchAncestors } from '../firebase.js';
import { state } from '../app.js';

export function renderDogs(container, appState) {
  const myDogs  = appState.dogs.filter(d => d.belongsToMe);
  const pedDogs = appState.dogs.filter(d => !d.belongsToMe);

  container.innerHTML = `
    <div class="page-header">
      <h1 class="font-display">Meu Canil</h1>
      <p>${myDogs.length} ${myDogs.length===1?'cão cadastrado':'cães cadastrados'}</p>
    </div>

    <div class="section-header">
      <span class="section-title">Cães Ativos</span>
      <button class="btn btn-primary btn-sm" onclick="window._nav('dog-form',{editingDogId:null})">+ Novo Cão</button>
    </div>

    <div class="dog-list">
      ${myDogs.length === 0
        ? `<div class="empty-state"><div class="icon">🐾</div><p>Nenhum cão cadastrado ainda.<br>Clique em "Novo Cão" para começar.</p></div>`
        : myDogs.map(d => dogCard(d)).join('')
      }
    </div>

    ${pedDogs.length > 0 ? `
      <div class="divider-label" style="margin-top:24px">Banco de Linhagem (${pedDogs.length})</div>
      <div class="dog-list">${pedDogs.map(d => dogCard(d, true)).join('')}</div>
    ` : ''}

    <div class="modal-overlay" id="tree-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">🌳 Árvore Genealógica</span>
          <button class="btn btn-ghost btn-sm" id="close-tree">✕</button>
        </div>
        <div id="tree-content" style="min-height:120px"></div>
      </div>
    </div>
  `;

  // Event bindings
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Remover este cão permanentemente?')) return;
      await deleteDog(appState.user.uid, btn.dataset.delete);
      state.dogs = await getAllDogs(appState.user.uid);
      renderDogs(container, state);
    });
  });

  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window._nav('dog-form', { editingDogId: btn.dataset.edit });
    });
  });

  container.querySelectorAll('[data-tree]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await openTree(btn.dataset.tree, appState.user.uid);
    });
  });

  document.getElementById('close-tree')?.addEventListener('click', () => {
    document.getElementById('tree-modal').classList.remove('open');
  });
  document.getElementById('tree-modal')?.addEventListener('click', e => {
    if (e.target.id === 'tree-modal') document.getElementById('tree-modal').classList.remove('open');
  });
}

function dogCard(dog, isPedigree = false) {
  const emoji = dog.sex === 'M' ? '🐕' : '🐩';
  const label = dog.phenotype?.label || dog.phenotype?.baseColor || 'Cor desconhecida';
  return `
    <div class="dog-card">
      <div class="dog-avatar">${emoji}</div>
      <div class="dog-info">
        <div class="dog-name">${dog.name}</div>
        <div class="dog-breed-tag">${label}</div>
      </div>
      <span class="dog-sex-badge ${(dog.sex||'m').toLowerCase()}">${dog.sex==='M'?'♂':'♀'}</span>
      ${isPedigree?'<span class="badge badge-gold" style="font-size:.68rem">Linhagem</span>':''}
      <div class="dog-actions">
        <button class="btn btn-ghost btn-sm" data-tree="${dog.id}" title="Ver Árvore">🌳</button>
        <button class="btn btn-ghost btn-sm" data-edit="${dog.id}" title="Editar">✏️</button>
        <button class="btn btn-ghost btn-sm" data-delete="${dog.id}" title="Remover">🗑</button>
      </div>
    </div>`;
}

async function openTree(dogId, uid) {
  const modal   = document.getElementById('tree-modal');
  const content = document.getElementById('tree-content');
  modal.classList.add('open');
  content.innerHTML = '<p style="color:var(--text-muted);padding:20px;text-align:center">Carregando…</p>';

  try {
    const tree = await fetchAncestors(uid, dogId, 3);
    if (!tree) { content.innerHTML = '<p class="text-muted" style="padding:16px">Cão não encontrado.</p>'; return; }

    if (detectCircular(tree, new Set())) {
      content.innerHTML = `<div class="alert alert-danger">
        ⚠️ Referência circular detectada na árvore genealógica! Verifique os ancestrais cadastrados.
      </div>`; return;
    }
    content.innerHTML = buildTreeHTML(tree);
  } catch(err) {
    content.innerHTML = `<div class="alert alert-danger">Erro: ${err.message}</div>`;
  }
}

function detectCircular(node, seen) {
  if (!node) return false;
  if (seen.has(node.id)) return true;
  const next = new Set(seen); next.add(node.id);
  return detectCircular(node.father, next) || detectCircular(node.mother, next);
}

function nodeEl(dog, focal=false) {
  if (!dog) return `<div class="tree-node" style="opacity:.3;min-width:100px"><div class="node-name">—</div></div>`;
  const label = dog.phenotype?.label || dog.phenotype?.baseColor || '';
  return `<div class="tree-node ${focal?'focal':''}">
    <div class="node-name">${dog.name}</div>
    <div class="node-pheno">${label}</div>
    <div class="node-pheno" style="color:var(--gold-dim)">${dog.sex==='M'?'♂':'♀'}</div>
  </div>`;
}

function buildTreeHTML(tree) {
  const gps = [
    tree.father?.father, tree.father?.mother,
    tree.mother?.father, tree.mother?.mother
  ];
  return `<div class="tree-wrap" style="padding:4px 0">
    <p class="text-muted text-sm" style="text-align:center;margin-bottom:14px;font-size:.78rem">
      Avós Paternos · Pai ← ${tree.name} → Mãe · Avós Maternos
    </p>
    <div class="tree-gen">${gps.slice(0,2).map(g=>nodeEl(g)).join('')}
      <span style="width:16px"></span>
      ${gps.slice(2).map(g=>nodeEl(g)).join('')}
    </div>
    <div class="tree-gen" style="margin:10px 0">
      ${nodeEl(tree.father)}
      <span class="tree-connector" style="font-size:1.8rem;line-height:1">×</span>
      ${nodeEl(tree.mother)}
    </div>
    <div class="tree-gen">${nodeEl(tree, true)}</div>
  </div>`;
}
