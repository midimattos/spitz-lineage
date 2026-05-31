// ============================================================
// SIMULATOR PAGE — Ninhada, COI Profundo, PDF Premium, Matchmaker
// ============================================================
import { getDog } from '../firebase.js';
import { simulateLitter, litterStats, inferGenotype as inferBaseGenotype } from '../utils/genetics.js';

export function renderSimulator(container, appState) {
  const myDogs = appState.dogs.filter(d => d.belongsToMe);
  const males   = myDogs.filter(d => d.sex === 'M');
  const females = myDogs.filter(d => d.sex === 'F');

  container.innerHTML = `
    <div class="page-header">
      <h1 class="font-display">Simulador de Ninhada</h1>
      <p>Probabilidades genéticas, consanguinidade e matchmaking</p>
    </div>

    ${myDogs.length < 2 ? `
      <div class="alert alert-warning">
        ⚠️ Você precisa ter pelo menos um macho e uma fêmea em "Meu Canil" para usar o simulador.
      </div>
    ` : ''}

    <div class="tabs" style="margin-bottom:0">
      <button class="tab-btn active" data-sim-tab="manual">🧬 Simular Casal</button>
      <button class="tab-btn" data-sim-tab="matchmaker">✨ Matchmaker</button>
    </div>

    <!-- SIMULAÇÃO MANUAL -->
    <div id="sim-panel-manual">
      <div class="card" style="border-top-left-radius:0;border-top-right-radius:0">
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
        <button class="btn btn-primary btn-full" id="btn-simulate">🧬 Simular Ninhada</button>
      </div>
      <div id="sim-results"></div>
    </div>

    <!-- MATCHMAKER -->
    <div id="sim-panel-matchmaker" style="display:none">
      <div class="card" style="border-top-left-radius:0;border-top-right-radius:0">
        <div class="alert alert-info" style="margin-bottom:14px">
          ✨ <strong>Matchmaker Inteligente</strong><br>
          Diga o que deseja produzir e o sistema encontra o melhor casal do seu canil automaticamente.
        </div>
        <div class="form-group">
          <label class="form-label">🎯 Cor desejada nos filhotes</label>
          <select class="form-select" id="mm-target">
            <option value="">— O que você quer produzir? —</option>
            ${TARGET_COLORS.map(c=>`<option value="${c.value}">${c.label}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary btn-full" id="btn-matchmaker">✨ Encontrar Melhor Casal</button>
      </div>
      <div id="mm-results"></div>
    </div>
  `;

  // Tab switching
  container.querySelectorAll('[data-sim-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-sim-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.simTab;
      document.getElementById('sim-panel-manual').style.display     = tab === 'manual'      ? '' : 'none';
      document.getElementById('sim-panel-matchmaker').style.display = tab === 'matchmaker'  ? '' : 'none';
    });
  });

  document.getElementById('btn-simulate')?.addEventListener('click',   () => runSimulation(appState));
  document.getElementById('btn-matchmaker')?.addEventListener('click', () => runMatchmaker(appState));
}

// ─────────────────────────────────────────────────────────────
// COLOUR SWATCHES
// ─────────────────────────────────────────────────────────────
const SWATCH = {
  preto:'#1a1a1a', chocolate:'#5c3317', beaver:'#8a6040', 'lilás':'#907090',
  azul:'#5a80a8', laranja:'#c06818', sable:'#b87030', creme:'#e8d8a8',
  branco:'#f0ece0', merle:'#6888a8', wolf:'#787858', tricolor:'#1a1a1a', tan:'#1a1a1a'
};
function swatchColor(label) {
  const l = (label || '').toLowerCase();
  for (const [k, v] of Object.entries(SWATCH)) { if (l.includes(k)) return v; }
  return '#888';
}

const TARGET_COLORS = [
  { value:'preto',     label:'⚫ Preto' },
  { value:'chocolate', label:'🟤 Chocolate' },
  { value:'beaver',    label:'🟫 Beaver' },
  { value:'lilás',     label:'💜 Lilás' },
  { value:'azul',      label:'🔵 Azul' },
  { value:'laranja',   label:'🟠 Laranja / Sable' },
  { value:'creme',     label:'🍦 Creme / Branco' },
  { value:'merle',     label:'🌀 Merle' },
  { value:'tricolor',  label:'🔶 Tricolor' },
  { value:'wolf',      label:'🐺 Wolf Sable' },
];

function collectColorEvidence(...sources) {
  const tokens = [];
  const visit = (value) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      visit(value.baseColor);
      visit(value.color);
      visit(value.marking);
      visit(value.merleType);
      visit(value.phenotype?.baseColor);
      visit(value.phenotype?.marking);
      visit(value.phenotype?.merleType);
      return;
    }
    const normalized = String(normalizeColorName(value) || '').toLowerCase().trim();
    if (normalized) tokens.push(normalized);
  };
  sources.forEach(visit);
  return tokens;
}

function isConcreteAllele(allele) {
  return allele !== '?' && allele !== null && allele !== undefined && allele !== '';
}

function isConcretePair(pair) {
  return Array.isArray(pair)
    && pair.length === 2
    && isConcreteAllele(pair[0])
    && isConcreteAllele(pair[1]);
}

function ensureGenotypeFromDog(dog, producedColors) {
  const baseInferred = inferBaseGenotype(dog?.phenotype || {}, {}, producedColors);
  const current = dog?.genotype || {};
  const merged = {};
  for (const [locus, pair] of Object.entries(baseInferred)) {
    const existing = current[locus];
    merged[locus] = isConcretePair(existing) ? [...existing] : [...pair];
  }
  return merged;
}

function inferGenotype(dog) {
  const phenotype = dog?.phenotype || {};
  const baseColor = (phenotype.baseColor || dog?.baseColor || '').toLowerCase();
  const producedColors = [
    ...(Array.isArray(dog?.producedColors) ? dog.producedColors : []),
    ...(Array.isArray(dog?.provenColors) ? dog.provenColors : []),
    ...(Array.isArray(phenotype?.producedColors) ? phenotype.producedColors : []),
  ];
  const producedHistory = collectColorEvidence(producedColors);
  const parentHistory = collectColorEvidence(
    dog?.fatherColor,
    dog?.motherColor,
    dog?.father,
    dog?.mother,
    dog?.sire,
    dog?.dam,
    dog?.pedigree?.father,
    dog?.pedigree?.mother,
    dog?.pedigree?.fatherColor,
    dog?.pedigree?.motherColor,
  );
  const ancestorHistory = collectColorEvidence(
    dog?.ancestorColors,
    dog?.grandparentsColors,
    dog?.ancestors,
    dog?.pedigree?.ancestors,
    phenotype?.ancestorColors,
    phenotype?.grandparentsColors,
  );
  const allHistory = [...producedHistory, ...parentHistory, ...ancestorHistory];
  const hasAnyHistory = (pool, terms) => pool.some(c => terms.some(t => c.includes(t)));

  const g = ensureGenotypeFromDog(dog, producedColors);
  const isVisualChocolate = baseColor.includes('chocolate') || baseColor.includes('beaver');
  const isVisualLilac = baseColor.includes('lilás') || baseColor.includes('lilas') || baseColor.includes('lilac');
  const isVisualOrange = baseColor.includes('laranja') || baseColor.includes('orange') || baseColor.includes('sable');
  const isVisualCreamWhite = baseColor.includes('creme') || baseColor.includes('cream') || baseColor.includes('branco') || baseColor.includes('white');
  const isVisualBlack = baseColor.includes('preto') || baseColor.includes('black');
  const isVisualBlue = baseColor.includes('azul') || baseColor.includes('blue') || baseColor.includes('cinza');
  const isVisualTan = baseColor.includes('tan') || baseColor.includes('tricolor') || baseColor.includes('fogo');
  const isVisualDark = isVisualBlack || isVisualChocolate || isVisualBlue || isVisualLilac;
  const isVisualDense = isVisualBlack || isVisualChocolate || isVisualOrange;
  const isSolidBlack = (isVisualBlack || isVisualBlue) && !baseColor.includes('tricolor');

  // b locus — strict deterministic inference
  if (isVisualChocolate || isVisualLilac) {
    g.Locus_B = ['b', 'b'];
  } else if (isSolidBlack) {
    const hasChocolateProof =
      hasAnyHistory(producedHistory, ['chocolate', 'beaver']) ||
      hasAnyHistory(parentHistory, ['chocolate', 'beaver']);
    g.Locus_B = hasChocolateProof ? ['B', 'b'] : ['B', 'B'];
  }

  // at locus — infer hidden tan from produced colors or ancestors
  if (!isVisualTan && (isSolidBlack || isVisualOrange || isVisualCreamWhite) && hasAnyHistory(allHistory, ['tan points', 'tan', 'fogo'])) {
    g.Locus_A = ['Ay', 'at'];
    if (isSolidBlack) g.Locus_K = ['K', 'k'];
  }

  // e locus — strict deterministic inference
  if (isVisualDark && (hasAnyHistory(producedHistory, ['laranja', 'orange', 'sable', 'creme', 'cream', 'branco', 'white']) || hasAnyHistory(parentHistory, ['laranja', 'orange', 'sable', 'creme', 'cream', 'branco', 'white']))) {
    g.Locus_E = ['E', 'e'];
  } else if (isVisualDark && !isVisualOrange && !isVisualCreamWhite) {
    g.Locus_E = ['E', 'E'];
  }

  // d locus — strict deterministic inference
  if (isVisualBlue || isVisualLilac || isVisualCreamWhite) {
    g.Locus_D = ['d', 'd'];
  } else if (isVisualDense) {
    const hasDiluteProof =
      hasAnyHistory(producedHistory, ['azul', 'blue', 'cinza', 'lilás', 'lilas', 'lilac']) ||
      hasAnyHistory(parentHistory, ['azul', 'blue', 'cinza', 'lilás', 'lilas', 'lilac', 'creme', 'cream']);
    g.Locus_D = hasDiluteProof ? ['D', 'd'] : ['D', 'D'];
  }

  // preserve visual recessive e/e
  if (isVisualOrange || isVisualCreamWhite) {
    g.Locus_E = ['e', 'e'];
  }

  // preserve visual recessive chocolate phenotype
  if (isVisualChocolate || isVisualLilac) {
    g.Locus_B = ['b', 'b'];
  }

  // preserve visual recessive dilute phenotype
  if (isVisualBlue || isVisualLilac || isVisualCreamWhite) {
    g.Locus_D = ['d', 'd'];
  } else if (isVisualDense && g.Locus_D[0] !== 'D') {
    g.Locus_D = ['D', 'D'];
  }

  // M locus — lock to m/m when non-merle with no explicit evidence
  const isMerle = (dog?.phenotype?.marking || '').toLowerCase().includes('merle') || 
                  (dog?.phenotype?.merleType || '').toLowerCase().includes('merle');
  if (isMerle || hasAnyHistory(allHistory, ['merle'])) {
    g.Locus_M = ['M', 'm'];
  } else {
    g.Locus_M = ['m', 'm'];
  }

  const fallbackByLocus = {
    Locus_A: ['Ay', 'Ay'],
    Locus_K: ['k', 'k'],
    Locus_E: ['E', 'E'],
    Locus_B: ['B', 'B'],
    Locus_D: ['D', 'D'],
    Locus_S: ['S', 'S'],
    Locus_M: ['m', 'm'],
    Locus_H: ['h', 'h'],
    Locus_I: ['i', 'i'],
  };

  return Object.fromEntries(
    Object.entries(fallbackByLocus).map(([locus, fallback]) => {
      const pair = Array.isArray(g[locus]) ? g[locus] : fallback;
      const first = isConcreteAllele(pair[0]) ? pair[0] : fallback[0];
      const second = isConcreteAllele(pair[1]) ? pair[1] : first;
      return [locus, [first, second]];
    })
  );
}


// ─────────────────────────────────────────────────────────────
// MANUAL SIMULATION
// ─────────────────────────────────────────────────────────────
async function runSimulation(appState) {
  const maleId   = document.getElementById('sim-male').value;
  const femaleId = document.getElementById('sim-female').value;
  const MONTE_CARLO_N = 1000;
  const btn      = document.getElementById('btn-simulate');

  if (!maleId || !femaleId) { alert('Selecione macho e fêmea.'); return; }
  if (maleId === femaleId)  { alert('Macho e fêmea devem ser diferentes.'); return; }

  btn.disabled = true; btn.textContent = 'Calculando…';
  try {
    const male   = appState.dogs.find(d => d.id === maleId);
    const female = appState.dogs.find(d => d.id === femaleId);
    const uid    = appState.user.uid;
    const maleGenotype = inferGenotype(male);
    const femaleGenotype = inferGenotype(female);
    if (globalThis?.__SPITZ_DEBUG_INFERENCE__) {
      console.debug('Inferência genética:', {
        macho: { nome: male?.name, genotype: maleGenotype },
        femea: { nome: female?.name, genotype: femaleGenotype },
      });
    }

    const coiResult = await deepCOI(uid, maleId, femaleId, appState.dogs);
    const litter    = simulateLitter(maleGenotype, femaleGenotype, MONTE_CARLO_N);
    const stats     = litterStats(litter);

    renderResults(male, female, litter, stats, coiResult, appState);
  } catch(err) {
    alert('Erro na simulação: ' + err.message);
    console.error(err);
  }
  btn.disabled = false; btn.textContent = '🧬 Simular Ninhada';
}

// ─────────────────────────────────────────────────────────────
// DEEP COI — Feature 3
// Coleta ancestrais até 4 gerações e calcula coeficiente via
// aproximação de Wright (0.5^(n+m+1) por ancestral comum)
// ─────────────────────────────────────────────────────────────
async function deepCOI(uid, maleId, femaleId, dogsCache) {
  const dogsMap = Object.fromEntries(dogsCache.map(d => [d.id, d]));

  async function collectAncestors(dogId, gen, visited = new Map()) {
    if (!dogId || gen > 4) return visited;
    if (visited.has(dogId)) {
      visited.get(dogId).generations.push(gen);
      return visited;
    }
    let dog = dogsMap[dogId];
    if (!dog) {
      try { dog = await getDog(uid, dogId); if (dog) dogsMap[dogId] = dog; } catch {}
    }
    if (!dog) return visited;
    visited.set(dogId, { name: dog.name || '(sem nome)', generations: [gen] });
    await Promise.all([
      collectAncestors(dog.pedigree?.fatherId, gen + 1, visited),
      collectAncestors(dog.pedigree?.motherId, gen + 1, visited),
    ]);
    return visited;
  }

  const [mAncs, fAncs] = await Promise.all([
    collectAncestors(maleId,   0),
    collectAncestors(femaleId, 0),
  ]);

  const shared = [];
  for (const [id, mInfo] of mAncs) {
    if (id === maleId || id === femaleId) continue;
    if (fAncs.has(id)) {
      const fInfo     = fAncs.get(id);
      const minGenM   = Math.min(...mInfo.generations);
      const minGenF   = Math.min(...fInfo.generations);
      const coiContrib = Math.pow(0.5, minGenM + minGenF + 1) * 100;
      shared.push({ id, name: mInfo.name, genM: minGenM, genF: minGenF, coiContrib });
    }
  }

  const totalCOI = Math.min(shared.reduce((s, a) => s + a.coiContrib, 0), 50);
  const risk     = totalCOI < 3 ? 'baixo' : totalCOI < 10 ? 'moderado' : 'alto';

  return {
    hasInbreeding:   shared.length > 0,
    shared,
    totalCOI:        Math.round(totalCOI * 10) / 10,
    risk,
    riskPercent:     Math.round(totalCOI * 10) / 10,
    sharedAncestors: shared.map(a => a.name),
  };
}

// ─────────────────────────────────────────────────────────────
// RENDER RESULTS
// ─────────────────────────────────────────────────────────────

/** Creates a deterministic key to identify a unique visual phenotype */
function phenotypeKey(pheno) {
  return [
    pheno.baseColor || '',
    pheno.marking   || '',
    pheno.dilution  || '',
    pheno.doubleMerle ? 'DM' : ''
  ].join('|');
}

/** Infers trufa (nose) color from phenotype data */
function noseColor(pheno) {
  const base = (pheno.baseColor || '').toLowerCase();
  if (base.includes('lilás') || base.includes('lilas')) return 'Lilás';
  if (base.includes('chocolate') || base.includes('beaver')) return 'Marrom';
  if (base.includes('azul') || base.includes('cinza')) return 'Acinzentada';
  return 'Preta';
}

/** Returns a human-readable merle status */
function merleStatus(pheno) {
  if (pheno.doubleMerle) return 'Double Merle (M/M)';
  if ((pheno.marking || '').toLowerCase().includes('merle')) return 'Merle (M/m)';
  return 'Sem Merle';
}

/** Returns true when the phenotype carries the d/d dilution gene (Azul or Lilás) */
function isDiluted(pheno) {
  const base = (pheno.baseColor || '').toLowerCase();
  return base.includes('azul') || base.includes('lilás') || base.includes('lilas');
}

/** Simple portuguese pluralization helper */
function pluralizePT(count, singular, plural) {
  return count !== 1 ? plural : singular;
}

function renderResults(male, female, litter, stats, coiResult, appState) {
  const res   = document.getElementById('sim-results');
  const total = litter.length;

  // ── 1. Build unique phenotype map ────────────────────────
  const uniqueMap = new Map(); // key → { pheno, count }
  for (const pup of litter) {
    const pheno = pup.phenotype || {};
    const key   = phenotypeKey(pheno);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, { pheno, count: 0, sample: pup });
    }
    uniqueMap.get(key).count++;
  }

  // Sort by frequency descending
  const uniqueEntries = [...uniqueMap.values()].sort((a, b) => b.count - a.count);
  const entries       = Object.entries(stats.counts).sort((a, b) => b[1] - a[1]);

  // ── 2. COI banner ─────────────────────────────────────────
  const coiHTML = coiResult.hasInbreeding
    ? `<div class="alert alert-warning">
        <strong>⚠️ Consanguinidade detectada — COI: ${coiResult.totalCOI}% (risco ${coiResult.risk})</strong><br>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
          ${coiResult.shared.slice(0, 5).map(a =>
            `<span style="padding:2px 9px;background:rgba(255,165,0,.15);border:1px solid rgba(255,165,0,.4);
              border-radius:12px;font-size:.74rem">
              ${a.name} · Gen.${a.genM}↔${a.genF} · ~${a.coiContrib.toFixed(1)}%
            </span>`
          ).join('')}
        </div>
       </div>`
    : `<div class="alert alert-success">✅ Nenhuma consanguinidade detectada nas últimas 4 gerações.</div>`;

  // ── 3. Phenotype cards HTML ───────────────────────────────
  const phenoCardsHTML = uniqueEntries.map(({ pheno, count }) => {
    const pct     = Math.round((count / total) * 100);
    const col     = swatchColor(pheno.label || pheno.baseColor || '');
    const nose    = noseColor(pheno);
    const merle   = merleStatus(pheno);
    const dil     = pheno.dilution === 'diluída' ? 'Diluída' : 'Densa';
    const marking = pheno.marking || 'Sólido';

    const healthAlerts = [];
    if (pheno.doubleMerle) {
      healthAlerts.push(`<div class="alert alert-danger" style="margin-top:10px;padding:8px 12px;font-size:.8rem">
        ⚠️ <strong>Double Merle (M/M)</strong> — Risco elevado de surdez e cegueira.
      </div>`);
    }
    if (isDiluted(pheno)) {
      healthAlerts.push(`<div class="alert alert-warning" style="margin-top:10px;padding:8px 12px;font-size:.8rem">
        ⚠️ <strong>Diluição d/d</strong> — Risco de Color Dilution Alopecia (CDA). Monitorar pelagem.
      </div>`);
    }

    return `
      <div class="phenotype-card">
        <div class="phenotype-card-chance">CHANCE: ${pct}%</div>
        <div class="phenotype-card-label">
          <div class="phenotype-card-swatch" style="background:${col}"></div>
          ${pheno.label || pheno.baseColor || '—'}
        </div>
        <div class="phenotype-card-tags">
          <span class="phenotype-tag"><strong>Cor Base:</strong> ${pheno.baseColor || '—'}</span>
          <span class="phenotype-tag"><strong>Marcação:</strong> ${marking}</span>
          <span class="phenotype-tag"><strong>Trufa:</strong> ${nose}</span>
          <span class="phenotype-tag"><strong>Diluição:</strong> ${dil}</span>
          <span class="phenotype-tag"><strong>Merle:</strong> ${merle}</span>
        </div>
        ${healthAlerts.join('')}
      </div>`;
  }).join('');

  res.innerHTML = `
    <div class="card" style="margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div>
          <div style="font-family:var(--font-display);font-size:1.1rem;color:var(--gold)">${male.name} × ${female.name}</div>
          <div class="text-muted text-sm">${uniqueEntries.length} ${pluralizePT(uniqueEntries.length, 'fenótipo possível', 'fenótipos possíveis')}</div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-pdf">📄 Certificado PDF</button>
      </div>

      ${coiHTML}
      ${(stats.alerts || []).map(a => `<div class="alert alert-danger">${a}</div>`).join('')}

      <div class="section-title" style="margin-bottom:12px">Fenótipos Possíveis</div>
      <div class="phenotype-cards">
        ${phenoCardsHTML}
      </div>
    </div>

    <!-- Hidden PDF template rendered here -->
    <div id="pdf-template" style="position:absolute;left:-9999px;top:0;width:794px">
      ${buildPDFTemplate(male, female, entries, total, coiResult, appState)}
    </div>
  `;

  document.getElementById('btn-pdf')?.addEventListener('click', () => generatePDF(male, female, appState));
}

// ─────────────────────────────────────────────────────────────
// PDF TEMPLATE — Feature 1
// ─────────────────────────────────────────────────────────────
function buildPDFTemplate(male, female, entries, total, coiResult, appState) {
  const kennelName = localStorage.getItem(`kennel_name_${appState.user.uid}`) || 'Meu Canil';
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const colorBars = entries.map(([label, count]) => {
    const pct = Math.round((count / total) * 100);
    const col = swatchColor(label);
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:14px;height:14px;border-radius:50%;background:${col};flex-shrink:0;border:2px solid rgba(0,0,0,.1)"></div>
      <div style="flex:1;font-size:11pt;color:#333">${label}</div>
      <div style="width:130px;height:10px;background:#e8e0d8;border-radius:5px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${col};opacity:.9"></div>
      </div>
      <div style="font-size:11pt;font-weight:700;min-width:34px;text-align:right;color:#1a1a1a">${pct}%</div>
    </div>`;
  }).join('');

  const coiSummary = coiResult.hasInbreeding
    ? `<div style="background:#fff8e1;border-left:4px solid #f59e0b;padding:10px 14px;border-radius:4px;margin-top:14px;font-size:10pt;color:#333">
        ⚠️ COI estimado: <strong>${coiResult.totalCOI}% (risco ${coiResult.risk})</strong>
        — Ancestrais comuns: ${coiResult.sharedAncestors.slice(0, 3).join(', ')}
       </div>`
    : `<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:10px 14px;border-radius:4px;margin-top:14px;font-size:10pt;color:#333">
        ✅ Nenhuma consanguinidade detectada nas últimas 4 gerações.
       </div>`;

  const photoBox = (dog, emoji) =>
    dog.photoURL
      ? `<img src="${dog.photoURL}" style="width:110px;height:110px;object-fit:cover;border-radius:8px;display:block;margin:0 auto 8px" crossorigin="anonymous" />`
      : `<div style="width:110px;height:110px;background:#f5f0e8;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:3rem;margin:0 auto 8px">${emoji}</div>`;

  return `
    <div id="pdf-content" style="width:794px;background:#fff;color:#1a1a1a;font-family:Georgia,serif;padding:48px 52px;box-sizing:border-box">

      <!-- Cabeçalho -->
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #c8860a;padding-bottom:16px;margin-bottom:24px">
        <div>
          <div style="font-size:22pt;font-weight:700;color:#1a0e00;letter-spacing:.5px">${kennelName}</div>
          <div style="font-size:10pt;color:#666;margin-top:2px">Certificado de Planejamento Genético</div>
        </div>
        <div style="text-align:right;font-size:9pt;color:#888">
          <div>${today}</div>
          <div style="color:#c8860a;font-weight:600;margin-top:2px">Spitz Lineage Manager</div>
        </div>
      </div>

      <!-- Título -->
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:15pt;font-weight:700;color:#c8860a">Planejamento de Ninhada</div>
        <div style="font-size:12pt;margin-top:4px;color:#333">${male.name} <span style="color:#c8860a">×</span> ${female.name}</div>
      </div>

      <!-- Pais -->
      <div style="display:flex;gap:32px;justify-content:center;margin-bottom:24px">
        <div style="text-align:center">
          ${photoBox(male, '🐕')}
          <div style="font-weight:700;font-size:11pt">${male.name}</div>
          <div style="font-size:9pt;color:#888">♂ Macho · ${male.phenotype?.label || '—'}</div>
        </div>
        <div style="display:flex;align-items:center;padding-bottom:30px;font-size:26pt;color:#c8860a">×</div>
        <div style="text-align:center">
          ${photoBox(female, '🐩')}
          <div style="font-weight:700;font-size:11pt">${female.name}</div>
          <div style="font-size:9pt;color:#888">♀ Fêmea · ${female.phenotype?.label || '—'}</div>
        </div>
      </div>

      <!-- Probabilidades -->
      <div style="background:#fafaf8;border:1px solid #e8e0d4;border-radius:8px;padding:18px 20px;margin-bottom:4px">
        <div style="font-size:12pt;font-weight:700;margin-bottom:14px;color:#1a0e00;border-bottom:1px solid #e8e0d4;padding-bottom:8px">
          Probabilidades de Cor — ${total} filhotes simulados
        </div>
        ${colorBars}
      </div>

      ${coiSummary}

      <!-- Rodapé -->
      <div style="margin-top:32px;border-top:1px solid #e8e0d4;padding-top:14px;display:flex;justify-content:space-between;align-items:flex-end">
        <div style="font-size:8pt;color:#bbb">Gerado por Spitz Lineage Manager · Uso exclusivo do criador</div>
        <div style="text-align:right">
          <div style="border-top:1px solid #999;width:180px;margin-bottom:4px"></div>
          <div style="font-size:9pt;color:#666">${kennelName}</div>
        </div>
      </div>
    </div>`;
}

async function generatePDF(male, female, appState) {
  const btn = document.getElementById('btn-pdf');
  if (btn) { btn.disabled = true; btn.textContent = 'Gerando PDF…'; }

  try {
    const tpl     = document.getElementById('pdf-template');
    const content = document.getElementById('pdf-content');
    if (!content) throw new Error('Template PDF não encontrado.');

    const filename = `Certificado_${male.name}_x_${female.name}.pdf`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    if (typeof html2pdf !== 'undefined') {
      // html2pdf.js available (loaded via CDN in index.html)
      tpl.style.position = 'static';
      tpl.style.left     = '';
      await html2pdf()
        .set({
          margin:      0,
          filename,
          image:       { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, allowTaint: true },
          jsPDF:       { unit: 'px', format: 'a4', orientation: 'portrait' }
        })
        .from(content)
        .save();
      tpl.style.position = 'absolute';
      tpl.style.left     = '-9999px';
    } else {
      // Fallback: open in new tab for manual print-to-PDF
      const win = window.open('', '_blank');
      if (!win) { alert('Permita pop-ups para gerar o PDF.'); return; }
      win.document.write(`<!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <style>body{margin:0;padding:0} @media print{body{margin:0}}</style>
      </head><body>`);
      win.document.write(content.outerHTML);
      win.document.write('</body></html>');
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 600);
    }
  } catch(err) {
    alert('Erro ao gerar PDF: ' + err.message);
    console.error(err);
  }

  if (btn) { btn.disabled = false; btn.textContent = '📄 Certificado PDF'; }
}

// ─────────────────────────────────────────────────────────────
// MATCHMAKER — Feature 5
// ─────────────────────────────────────────────────────────────
async function runMatchmaker(appState) {
  const target = document.getElementById('mm-target').value;
  const btn    = document.getElementById('btn-matchmaker');
  const res    = document.getElementById('mm-results');

  if (!target) { alert('Selecione a cor desejada.'); return; }

  const myDogs  = appState.dogs.filter(d => d.belongsToMe);
  const males   = myDogs.filter(d => d.sex === 'M');
  const females = myDogs.filter(d => d.sex === 'F');

  if (!males.length || !females.length) {
    res.innerHTML = `<div class="alert alert-warning">Você precisa ter machos e fêmeas no seu canil.</div>`;
    return;
  }

  const totalCombos = males.length * females.length;
  btn.disabled = true; btn.textContent = '🔍 Analisando…';
  res.innerHTML = `<div class="card" style="margin-top:12px;text-align:center;padding:28px 16px">
    <div style="font-size:1.6rem;margin-bottom:8px">🔍</div>
    <div class="text-muted">Testando ${totalCombos} combinação${totalCombos>1?'s':''}…</div>
  </div>`;

  try {
    const results = [];
    const dogsById = Object.fromEntries((appState.dogs || []).map(d => [d.id, d]));
    for (const male of males) {
      for (const female of females) {
const maleGenotype = inferGenotype(male);
        const femaleGenotype = inferGenotype(female);
        const litter     = simulateLitter(maleGenotype, femaleGenotype, 100);
        const stats      = litterStats(litter);
        const matchCount = Object.entries(stats.counts)
          .filter(([label]) => label.toLowerCase().includes(target))
          .reduce((s, [, c]) => s + c, 0);
        const pct = Math.round((matchCount / stats.total) * 100);
        if (pct > 0) results.push({ male, female, pct, stats });
      }
    }
    results.sort((a, b) => b.pct - a.pct);
    renderMatchmakerResults(results, target, res);
  } catch(err) {
    res.innerHTML = `<div class="alert alert-danger">Erro: ${err.message}</div>`;
  }

  btn.disabled = false; btn.textContent = '✨ Encontrar Melhor Casal';
}

function renderMatchmakerResults(results, target, container) {
  const targetLabel = TARGET_COLORS.find(c => c.value === target)?.label || target;
  const col         = swatchColor(target);
  const medalha     = ['🥇', '🥈', '🥉'];

  if (!results.length) {
    container.innerHTML = `<div class="card" style="margin-top:12px">
      <div class="text-muted" style="text-align:center;padding:28px 16px">
        Nenhuma combinação no seu canil produz <strong>${targetLabel}</strong> com probabilidade acima de 0%.<br><br>
        Considere adicionar cães portadores ao banco de linhagem.
      </div>
    </div>`;
    return;
  }

  container.innerHTML = `
    <div class="card" style="margin-top:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="width:16px;height:16px;border-radius:50%;background:${col};flex-shrink:0;border:2px solid rgba(0,0,0,.15)"></div>
        <div style="font-family:var(--font-display);font-size:1rem;color:var(--gold)">
          Melhores casais para produzir ${targetLabel}
        </div>
      </div>

      ${results.slice(0, 5).map((r, i) => `
        <div style="padding:12px;background:var(--surface2);border-radius:8px;margin-bottom:8px;
          ${i === 0 ? 'border:1px solid rgba(200,134,10,.45);' : ''}">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:1.2rem">${medalha[i] || '🔹'}</span>
              <div>
                <div style="font-weight:600;font-size:.94rem">${r.male.name} × ${r.female.name}</div>
                <div style="font-size:.74rem;color:var(--text-muted)">
                  ♂ ${r.male.phenotype?.label || '—'} &nbsp;·&nbsp; ♀ ${r.female.phenotype?.label || '—'}
                </div>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:var(--font-display);font-size:1.4rem;
                color:${i === 0 ? 'var(--gold)' : 'var(--text-muted)'}">${r.pct}%</div>
              <div style="font-size:.7rem;color:var(--text-muted)">de chance</div>
            </div>
          </div>
          ${i === 0 ? `
            <button class="btn btn-outline btn-sm" style="margin-top:10px;width:100%"
              id="mm-simulate-best">🧬 Simular este casal</button>` : ''}
        </div>`
      ).join('')}

      <p class="text-muted text-sm" style="margin-top:8px;text-align:center">
        Baseado em simulação de 100 filhotes por combinação
      </p>
    </div>`;

  // Wire up "Simular este casal" button
  if (results.length > 0) {
    document.getElementById('mm-simulate-best')?.addEventListener('click', () => {
      const best = results[0];
      // Switch to manual tab
      document.querySelector('[data-sim-tab="manual"]')?.click();
      setTimeout(() => {
        const maleEl   = document.getElementById('sim-male');
        const femaleEl = document.getElementById('sim-female');
        if (maleEl)   maleEl.value   = best.male.id;
        if (femaleEl) femaleEl.value = best.female.id;
        // Auto-run simulation
        document.getElementById('btn-simulate')?.click();
      }, 120);
    });
  }
}
