// ============================================================
// SIMULATOR PAGE — Ninhada, COI, PDF
// ============================================================
import { collectAncestorIds, getDog } from '../firebase.js';
import { simulateLitter, litterStats, calculateCOI } from '../utils/genetics.js';
import { generateLitterCertificate } from '../utils/pdf.js';

export function renderSimulator(container, appState) {
  const myDogs = appState.dogs.filter(d => d.belongsToMe);
  const males   = myDogs.filter(d => d.sex === 'M');
  const females = myDogs.filter(d => d.sex === 'F');

  container.innerHTML = `
    <div class="page-header">
      <h1 class="font-display">Simulador de Ninhada</h1>
      <p>Probabilidades genéticas e análise de consanguinidade</p>
    </div>

    ${myDogs.length < 2 ? `
      <div class="alert alert-warning">
        ⚠️ Você precisa ter pelo menos um macho e uma fêmea cadastrados em "Meu Canil" para usar o simulador.
      </div>
    ` : ''}

    <div class="card">
      <div class="form-group">
        <label class="form-label">♂ Macho</label>
        <select class="form-select" id="sim-male">
          <option value="">— Selecione —</option>
          ${males.map(d=>`<option value="${d.id}">${d.name} · ${d.phenotype?.label||''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">♀ Fêmea</label>
        <select class="form-select" id="sim-female">
          <option value="">— Selecione —</option>
          ${females.map(d=>`<option value="${d.id}">${d.name} · ${d.phenotype?.label||''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Filhotes na Simulação</label>
        <select class="form-select" id="sim-size">
          <option value="20">20 filhotes (padrão)</option>
          <option value="50">50 filhotes</option>
          <option value="100">100 filhotes (alta precisão)</option>
        </select>
      </div>
      <button class="btn btn-primary btn-full" id="btn-simulate">🧬 Simular Ninhada</button>
    </div>

    <div id="sim-results"></div>
  `;

  document.getElementById('btn-simulate')?.addEventListener('click', () => runSimulation(appState));
}

async function runSimulation(appState) {
  const maleId   = document.getElementById('sim-male').value;
  const femaleId = document.getElementById('sim-female').value;
  const size     = parseInt(document.getElementById('sim-size').value) || 20;
  const btn      = document.getElementById('btn-simulate');

  if (!maleId || !femaleId) { alert('Selecione macho e fêmea.'); return; }
  if (maleId === femaleId)  { alert('Macho e fêmea devem ser diferentes.'); return; }

  btn.disabled = true; btn.textContent = 'Calculando…';

  try {
    const male   = appState.dogs.find(d => d.id === maleId);
    const female = appState.dogs.find(d => d.id === femaleId);
    const uid    = appState.user.uid;

    // COI
    const [mAncs, fAncs] = await Promise.all([
      collectAncestorIds(uid, maleId),
      collectAncestorIds(uid, femaleId)
    ]);
    const dogsMap = Object.fromEntries(appState.dogs.map(d=>[d.id,d]));
    const coiResult = calculateCOI([...mAncs], [...fAncs], dogsMap);

    // Simulate
    const litter = simulateLitter(male.genotype || {}, female.genotype || {}, size);
    const stats  = litterStats(litter);

    renderResults(male, female, litter, stats, coiResult, appState);
  } catch(err) {
    alert('Erro na simulação: ' + err.message);
  }
  btn.disabled = false; btn.textContent = '🧬 Simular Ninhada';
}

const SWATCH = {
  preto:'#222', chocolate:'#5c3317', beaver:'#8a6040', 'lilás':'#907090',
  azul:'#5a80a8', laranja:'#c06818', sable:'#b87030', creme:'#e8d8a8',
  branco:'#f0ece0', merle:'#6888a8', wolf:'#787858', tricolor:'#2a2a2a', tan:'#2a2a2a'
};
function swatchColor(label) {
  const l = label.toLowerCase();
  for (const [k,v] of Object.entries(SWATCH)) { if (l.includes(k)) return v; }
  return '#888';
}

function renderResults(male, female, litter, stats, coiResult, appState) {
  const res = document.getElementById('sim-results');
  const entries = Object.entries(stats.counts).sort((a,b)=>b[1]-a[1]);
  const total = stats.total;

  res.innerHTML = `
    <div class="card" style="margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div style="font-family:var(--font-display);font-size:1.1rem;color:var(--gold)">
          ${male.name} × ${female.name}
        </div>
        <button class="btn btn-outline btn-sm" id="btn-pdf">📄 Certificado PDF</button>
      </div>

      ${coiResult.hasInbreeding
        ? `<div class="alert alert-warning">⚠️ <strong>Consanguinidade detectada — COI estimado: ${coiResult.riskPercent}%</strong><br>
            Ancestrais em comum: ${coiResult.sharedAncestors.slice(0,5).join(', ')||'(sem nome)'}
           </div>`
        : `<div class="alert alert-success">✅ Nenhuma consanguinidade detectada nas últimas gerações.</div>`
      }
      ${stats.alerts.map(a=>`<div class="alert alert-danger">${a}</div>`).join('')}

      <div class="section-title" style="margin-bottom:12px">Probabilidades — ${total} filhotes simulados</div>
      <div class="result-grid">
        ${entries.map(([label, count]) => {
          const pct = Math.round((count/total)*100);
          return `<div class="result-row">
            <div class="result-swatch" style="background:${swatchColor(label)}"></div>
            <div class="result-label">${label}</div>
            <div class="result-bar-wrap"><div class="result-bar" style="width:${pct}%"></div></div>
            <div class="result-pct">${pct}%</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card" style="margin-top:10px">
      <div class="section-title" style="margin-bottom:10px">Amostra — Primeiros 16 Filhotes</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${litter.slice(0,16).map(pup=>`
          <div style="padding:5px 10px;background:var(--surface2);border-radius:6px;font-size:.78rem;
            display:flex;align-items:center;gap:6px">
            <div style="width:8px;height:8px;border-radius:50%;
              background:${swatchColor(pup.phenotype.label||'')};flex-shrink:0"></div>
            <span>${pup.phenotype.label}</span>
            ${pup.phenotype.doubleMerle?'<span style="color:var(--red);font-size:.7rem">⚠DM</span>':''}
          </div>`).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-pdf')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-pdf');
    btn.disabled = true; btn.textContent = 'Gerando…';
    try {
      await generateLitterCertificate({
        male, female, litter, stats, coiResult,
        kennelName: localStorage.getItem(`kennel_name_${appState.user.uid}`) || 'Meu Canil'
      });
    } catch(err) { alert('Erro ao gerar PDF: ' + err.message); }
    btn.disabled = false; btn.textContent = '📄 Certificado PDF';
  });
}
