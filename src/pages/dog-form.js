// ============================================================
// DOG FORM PAGE — Cadastro com Abas, Autocomplete, Inferência
// ============================================================
import { saveDog, getDog, getAllDogs, searchDogsByName } from '../firebase.js';
import { uploadDogPhoto } from '../firebase.js';
import { state } from '../app.js';
import { inferGenotype, genotypeToPhenotype, LOCI } from '../utils/genetics.js';

// ── Atalhos de cor (Presets) ─────────────────────────────────
// Cada preset define: baseColor, marking, nose, dilution
// Regra: Lilás = Chocolate + Diluída + trufa Lilás
//        Beaver = Laranja + Densa + trufa Marrom/Fígado
const LOCAL_PRESETS = {
  'Preto':      { baseColor:'Preto',        marking:'Sólido',    nose:'Preta',                 dilution:'densa'   },
  'Chocolate':  { baseColor:'Chocolate',    marking:'Sólido',    nose:'Marrom/Fígado (Beaver)', dilution:'densa'   },
  'Lilás':      { baseColor:'Lilás',        marking:'Sólido',    nose:'Lilás',                  dilution:'diluída' },
  'Beaver':     { baseColor:'Beaver',       marking:'Sólido',    nose:'Marrom/Fígado (Beaver)', dilution:'densa'   },
  'Laranja':    { baseColor:'Laranja/Sable',marking:'Sable',     nose:'Preta',                  dilution:'densa'   },
  'Azul':       { baseColor:'Azul/Cinza',   marking:'Sólido',    nose:'Azul/Acinzentada',       dilution:'diluída' },
  'Creme':      { baseColor:'Creme/Branco', marking:'Sólido',    nose:'Preta',                  dilution:'densa'   },
  'Wolf Sable': { baseColor:'Wolf Sable',   marking:'Wolf Sable',nose:'Preta',                  dilution:'densa'   },
  'Tricolor':   { baseColor:'Tricolor',     marking:'Tricolor',  nose:'Preta',                  dilution:'densa'   },
  'Merle':      { baseColor:'Merle',        marking:'Merle',     nose:'Preta',                  dilution:'densa'   },
};

// ── Chips de histórico de cores produzidas ───────────────────
// Lilás e Beaver são chips independentes com lógica de inferência distinta
const LOCAL_PROVEN_COLORS = [
  'Preto','Chocolate','Lilás','Beaver',
  'Laranja/Sable','Wolf Sable','Azul/Cinza',
  'Creme/Branco','Merle','Tricolor','Tan Points',
];

let fs = resetFormState();

function resetFormState() {
  return {
    provenColors: [],
    photoURL: null,
    photoFile: null,
    fatherId: null, fatherName: '', fatherPhenotype: null,
    motherId: null, motherName: '', motherPhenotype: null,
    patGrandfatherId: null, patGrandfatherName: '',
    patGrandmotherId: null, patGrandmotherName: '',
    matGrandfatherId: null, matGrandfatherName: '',
    matGrandmotherId: null, matGrandmotherName: ''
  };
}

function normalizeAncestors(source = {}) {
  const fromAncestors = source.ancestors || {};
  const fromPedigree  = source.pedigree  || {};
  return {
    patGrandfatherId:   fromAncestors.paternal?.grandfather?.id   || fromPedigree.patGrandfatherId   || null,
    patGrandfatherName: fromAncestors.paternal?.grandfather?.name || fromPedigree.patGrandfatherName || '',
    patGrandmotherId:   fromAncestors.paternal?.grandmother?.id   || fromPedigree.patGrandmotherId   || null,
    patGrandmotherName: fromAncestors.paternal?.grandmother?.name || fromPedigree.patGrandmotherName || '',
    matGrandfatherId:   fromAncestors.maternal?.grandfather?.id   || fromPedigree.matGrandfatherId   || null,
    matGrandfatherName: fromAncestors.maternal?.grandfather?.name || fromPedigree.matGrandfatherName || '',
    matGrandmotherId:   fromAncestors.maternal?.grandmother?.id   || fromPedigree.matGrandmotherId   || null,
    matGrandmotherName: fromAncestors.maternal?.grandmother?.name || fromPedigree.matGrandmotherName || '',
  };
}

export async function renderDogForm(container, appState) {
  let existing = null;
  fs = resetFormState();

  if (appState.editingDogId) {
    existing = await getDog(appState.user.uid, appState.editingDogId);
    if (existing) {
      const anc = normalizeAncestors(existing);
      fs.provenColors    = existing.provenColors || [];
      fs.photoURL        = existing.photoURL || null;
      fs.fatherId        = existing.pedigree?.fatherId || null;
      fs.fatherName      = existing.pedigree?.fatherName || '';
      fs.motherId        = existing.pedigree?.motherId || null;
      fs.motherName      = existing.pedigree?.motherName || '';
      fs.patGrandfatherId   = anc.patGrandfatherId;
      fs.patGrandfatherName = anc.patGrandfatherName;
      fs.patGrandmotherId   = anc.patGrandmotherId;
      fs.patGrandmotherName = anc.patGrandmotherName;
      fs.matGrandfatherId   = anc.matGrandfatherId;
      fs.matGrandfatherName = anc.matGrandfatherName;
      fs.matGrandmotherId   = anc.matGrandmotherId;
      fs.matGrandmotherName = anc.matGrandmotherName;
    }
  }
  const lineageDogs = (appState.dogs || [])
    .filter(d => d.id !== appState.editingDogId)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

  const BASE_COLORS = [
    'Preto', 'Chocolate', 'Lilás', 'Beaver',
    'Laranja/Sable', 'Wolf Sable', 'Creme/Branco',
    'Azul/Cinza', 'Merle', 'Tricolor'
  ];
  const MARKINGS    = ['Sólido','Sable','Wolf Sable','Tan Points','Tricolor','Particolor','Merle','Branco Extremo','Máscara'];
  // Trufa: Lilás e Marrom/Fígado (Beaver) agora são opções separadas
  const NOSES       = ['Preta','Marrom/Fígado (Beaver)','Lilás','Azul/Acinzentada','Carne'];
  const DILUTIONS   = ['Densa','Diluída'];
  const MERLE_TYPES = ['Não Merle','Merle','Harlequin'];
  const INTENSITIES = ['Alta (Vívida)','Média','Baixa (Pálida)'];

  function opt(arr, val) {
    return arr.map(v=>`<option value="${v.toLowerCase().replace(/\//g,'_').replace(/ /g,'_')}"
      ${existing?.phenotype?.[val]===v.toLowerCase().replace(/\//g,'_').replace(/ /g,'_')?'selected':''}>${v}</option>`).join('');
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="font-display">${appState.editingDogId ? 'Editar Cão' : 'Cadastrar Cão'}</h1>
    </div>

    <div class="tabs" id="form-tabs">
      <button class="tab-btn active" data-tab="basic">1. Ficha</button>
      <button class="tab-btn" data-tab="parents">2. Pais</button>
      <button class="tab-btn" data-tab="grandparents" id="tab-btn-grandparents">3. Avós</button>
      <button class="tab-btn" data-tab="genetics">4. DNA</button>
    </div>

    <form id="dog-form">

      <!-- ── TAB BÁSICO ── -->
      <div class="tab-panel active" id="tab-basic">
        <div class="form-group">
          <label class="form-label">Nome do Cão *</label>
          <input class="form-input" name="name" placeholder="ex: Lord Chocolate von Haus"
            value="${existing?.name||''}" required />
        </div>

        <div class="form-group">
          <label class="form-label">Foto do Cão</label>
          <div class="photo-upload-wrap" id="photo-upload-wrap">
            ${existing?.photoURL
              ? `<img src="${existing.photoURL}" class="photo-preview" id="photo-preview" alt="Foto" />`
              : `<div class="photo-placeholder" id="photo-placeholder">
                  <span style="font-size:2rem">📷</span>
                  <span class="text-muted text-sm">Toque para adicionar foto</span>
                </div>`
            }
            <input type="file" id="photo-file-input" accept="image/*" style="display:none" />
          </div>
          <p class="text-sm text-muted mt-8" id="photo-status">${existing?.photoURL ? '✓ Foto carregada' : 'JPG ou PNG · Máx 5MB'}</p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">Sexo</label>
            <select class="form-select" name="sex">
              <option value="M" ${existing?.sex==='M'?'selected':''}>♂ Macho</option>
              <option value="F" ${existing?.sex==='F'?'selected':''}>♀ Fêmea</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <select class="form-select" name="belongsToMe">
              <option value="true"  ${existing?.belongsToMe!==false?'selected':''}>Meu Canil</option>
              <option value="false" ${existing?.belongsToMe===false ?'selected':''}>Linhagem</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Cor Base</label>
          <select class="form-select" name="baseColor">${opt(BASE_COLORS,'baseColor')}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Marcação / Padrão</label>
          <select class="form-select" name="marking">${opt(MARKINGS,'marking')}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cor da Trufa</label>
          <select class="form-select" name="nose">${opt(NOSES,'nose')}</select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">Diluição</label>
            <select class="form-select" name="dilution">
              ${DILUTIONS.map(v=>`<option value="${v.toLowerCase().split(' ')[0]}"
                ${existing?.phenotype?.dilution===v.toLowerCase().split(' ')[0]?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Merle</label>
            <select class="form-select" name="merleType">
              ${MERLE_TYPES.map(v=>{
                const val = v.toLowerCase().replace(/ã/g,'a').replace(/ /g,'_');
                return `<option value="${val}"
                  ${existing?.phenotype?.merleType===val?'selected':''}>${v}</option>`;
              }).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Intensidade de Cor</label>
          <select class="form-select" name="intensity">
            ${INTENSITIES.map(v=>{
              const val = v.toLowerCase().split(' ')[0];
              return `<option value="${val}"
                ${existing?.phenotype?.intensity===val?'selected':''}>${v}</option>`;
            }).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Atalhos Rápidos de Cor</label>
          <div class="chips-group">
            ${Object.keys(LOCAL_PRESETS).map(p=>`<button type="button" class="chip" data-preset="${p}">${p}</button>`).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Cores Já Produzidas por Este Cão</label>
          <p class="text-sm text-muted" style="margin-bottom:8px">Prioridade máxima na inferência genética.</p>
          <div class="chips-group" id="proven-chips">
            ${LOCAL_PROVEN_COLORS.map(c=>`
              <button type="button" class="chip ${fs.provenColors.includes(c)?'active':''}"
                data-proven="${c}">${c}</button>`).join('')}
          </div>
        </div>
      </div>

      <!-- ── TAB PAIS ── -->
      <div class="tab-panel" id="tab-parents">
        <div class="form-group">
          <label class="form-label">Pai</label>
          <div class="autocomplete-wrap">
            <input class="form-input" id="father-input" placeholder="Digite o nome do pai…"
              value="${fs.fatherName}" autocomplete="off" />
            <div class="autocomplete-dropdown hidden" id="father-dropdown"></div>
          </div>
          <p class="text-sm text-muted mt-8" id="father-status">${fs.fatherId?'✓ Vinculado: '+fs.fatherName:''}</p>
        </div>
        <div class="form-group">
          <label class="form-label">Mãe</label>
          <div class="autocomplete-wrap">
            <input class="form-input" id="mother-input" placeholder="Digite o nome da mãe…"
              value="${fs.motherName}" autocomplete="off" />
            <div class="autocomplete-dropdown hidden" id="mother-dropdown"></div>
          </div>
          <p class="text-sm text-muted mt-8" id="mother-status">${fs.motherId?'✓ Vinculada: '+fs.motherName:''}</p>
        </div>
        <div class="alert alert-info">
          💡 Ao selecionar um pai/mãe, os avós são preenchidos automaticamente na aba Avós.
        </div>
      </div>

      <!-- ── TAB AVÓS ── -->
      <div class="tab-panel" id="tab-grandparents">
        <div class="divider-label">Linha Paterna</div>
        ${ancestorField('Avô Paterno','pat-gf','patGrandfather', lineageDogs)}
        ${ancestorField('Avó Paterna','pat-gm','patGrandmother', lineageDogs)}
        <div class="divider-label">Linha Materna</div>
        ${ancestorField('Avô Materno','mat-gf','matGrandfather', lineageDogs)}
        ${ancestorField('Avó Materna','mat-gm','matGrandmother', lineageDogs)}
      </div>

      <!-- ── TAB DNA ── -->
      <div class="tab-panel" id="tab-genetics">
        <div class="alert alert-info mb-12">
          🧬 Genótipo inferido automaticamente com base na ficha e histórico.
        </div>
        <div id="genotype-preview">
          <p class="text-muted text-sm">Preencha a aba Ficha e clique aqui para ver o DNA inferido.</p>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:24px;padding-bottom:100px">
        <button type="button" class="btn btn-outline" onclick="window._nav('dogs')">Cancelar</button>
        <button type="submit" class="btn btn-primary" style="flex:1">
          ${appState.editingDogId ? 'Salvar Alterações' : 'Cadastrar Cão'}
        </button>
      </div>
    </form>
  `;

  initFormHandlers(container, appState);
}

function ancestorField(label, id, field, lineageDogs = []) {
  const escapeHtml = (v = '') => String(v).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
  const requiredSex = field.toLowerCase().includes('grandfather') ? 'M' : 'F';
  const options = lineageDogs
    .filter(d => !d.sex || d.sex === requiredSex)
    .map(d => {
      const idVal = String(d.id || '');
      const name = escapeHtml(d.name || '');
      const pheno = escapeHtml(d.phenotype?.label || d.phenotype?.baseColor || '—');
      return `<option value="${escapeHtml(idVal)}" ${(fs[field+'Id']===idVal)?'selected':''}>${name} · ${pheno}</option>`;
    })
    .join('');
  return `
    <div class="form-group">
      <label class="form-label">${label}</label>
      <select class="form-select" id="${id}-select" data-field="${field}">
        <option value="">Selecionar do Banco de Linhagem…</option>
        ${options}
      </select>
      <p class="text-sm text-muted mt-8">${requiredSex === 'M' ? 'Selecione um macho já cadastrado ou digite manualmente abaixo.' : 'Selecione uma fêmea já cadastrada ou digite manualmente abaixo.'}</p>
      <div class="autocomplete-wrap">
        <input class="form-input" id="${id}-input" placeholder="${label}…"
          value="${(fs[field+'Name'])||''}" autocomplete="off" data-field="${field}" />
        <div class="autocomplete-dropdown hidden" id="${id}-dropdown"></div>
      </div>
    </div>`;
}

function initFormHandlers(container, appState) {
  const uid = appState.user.uid;
  const dogsById = Object.fromEntries((appState.dogs || []).map(d => [d.id, d]));

  // ── Photo upload
  const photoWrap  = document.getElementById('photo-upload-wrap');
  const photoInput = document.getElementById('photo-file-input');
  photoWrap?.addEventListener('click', () => photoInput?.click());
  photoInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Foto muito grande. Máximo 5MB.'); return; }
    fs.photoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      photoWrap.innerHTML = `<img src="${ev.target.result}" class="photo-preview" id="photo-preview" alt="Foto" />`;
      const status = document.getElementById('photo-status');
      if (status) status.textContent = '✓ Foto selecionada (será enviada ao salvar)';
    };
    reader.readAsDataURL(file);
  });

  // ── Tabs
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      container.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+btn.dataset.tab)?.classList.add('active');
      if (btn.dataset.tab === 'genetics') updateGenotypePreview();
    });
  });

  const refreshDNAIfOpen = () => {
    const dnaTab = document.getElementById('tab-genetics');
    if (dnaTab?.classList.contains('active')) updateGenotypePreview();
  };
  ['baseColor','marking','nose','dilution','merleType','intensity'].forEach(name => {
    const el = document.querySelector(`#dog-form [name="${name}"]`);
    el?.addEventListener('change', refreshDNAIfOpen);
  });

  // ── Presets
  container.querySelectorAll('[data-preset]').forEach(chip => {
    chip.addEventListener('click', () => {
      const p = LOCAL_PRESETS[chip.dataset.preset];
      if (!p) return;
      const form = document.getElementById('dog-form');
      if (!form) return;

      // Helper: set a select by matching text content or value
      function setSelect(fieldName, targetValue) {
        const sel = form[fieldName];
        if (!sel) return;
        const target = targetValue.toLowerCase();
        [...sel.options].forEach(o => {
          o.selected = o.value.toLowerCase() === target ||
                       o.textContent.toLowerCase().includes(target);
        });
      }

      if (p.baseColor) setSelect('baseColor', p.baseColor);
      if (p.marking)   setSelect('marking',   p.marking);
      if (p.nose)      setSelect('nose',       p.nose);
      if (p.dilution)  setSelect('dilution',   p.dilution);

      // Visual feedback on chip
      container.querySelectorAll('[data-preset]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      setTimeout(() => chip.classList.remove('active'), 1500);
    });
  });

  // ── Proven colors
  container.querySelectorAll('[data-proven]').forEach(chip => {
    chip.addEventListener('click', () => {
      const c = chip.dataset.proven;
      if (fs.provenColors.includes(c)) {
        fs.provenColors = fs.provenColors.filter(x=>x!==c);
        chip.classList.remove('active');
      } else {
        fs.provenColors.push(c);
        chip.classList.add('active');
      }
      refreshDNAIfOpen();
    });
  });

  // ── Father autocomplete
  setupAC('father-input','father-dropdown', uid, async (dog) => {
    fs.fatherId = dog.id; fs.fatherName = dog.name; fs.fatherPhenotype = dog.phenotype;
    document.getElementById('father-status').textContent = '✓ Vinculado: ' + dog.name;
    // auto-fill grandparents
    let filledCount = 0;
    if (dog.pedigree?.fatherId) {
      const gf = await getDog(uid, dog.pedigree.fatherId).catch(()=>null);
      if (gf) {
        fs.patGrandfatherId=gf.id; fs.patGrandfatherName=gf.name;
        setVal('pat-gf-input', gf.name);
        markAutoFilled('pat-gf-input');
        filledCount++;
      }
    }
    if (dog.pedigree?.motherId) {
      const gm = await getDog(uid, dog.pedigree.motherId).catch(()=>null);
      if (gm) {
        fs.patGrandmotherId=gm.id; fs.patGrandmotherName=gm.name;
        setVal('pat-gm-input', gm.name);
        markAutoFilled('pat-gm-input');
        filledCount++;
      }
    }
    if (filledCount > 0) {
      showAutoFillToast(`${filledCount} avô(s) paterno(s) preenchido(s) automaticamente ✓`);
      pulseTabButton('tab-btn-grandparents');
    }
  });

  // ── Mother autocomplete
  setupAC('mother-input','mother-dropdown', uid, async (dog) => {
    fs.motherId = dog.id; fs.motherName = dog.name; fs.motherPhenotype = dog.phenotype;
    document.getElementById('mother-status').textContent = '✓ Vinculada: ' + dog.name;
    let filledCount = 0;
    if (dog.pedigree?.fatherId) {
      const gf = await getDog(uid, dog.pedigree.fatherId).catch(()=>null);
      if (gf) {
        fs.matGrandfatherId=gf.id; fs.matGrandfatherName=gf.name;
        setVal('mat-gf-input', gf.name);
        markAutoFilled('mat-gf-input');
        filledCount++;
      }
    }
    if (dog.pedigree?.motherId) {
      const gm = await getDog(uid, dog.pedigree.motherId).catch(()=>null);
      if (gm) {
        fs.matGrandmotherId=gm.id; fs.matGrandmotherName=gm.name;
        setVal('mat-gm-input', gm.name);
        markAutoFilled('mat-gm-input');
        filledCount++;
      }
    }
    if (filledCount > 0) {
      showAutoFillToast(`${filledCount} avô(s) materno(s) preenchido(s) automaticamente ✓`);
      pulseTabButton('tab-btn-grandparents');
    }
  });

  // ── Ancestor autocompletes
  [
    ['pat-gf','patGrandfather'],
    ['pat-gm','patGrandmother'],
    ['mat-gf','matGrandfather'],
    ['mat-gm','matGrandmother']
  ].forEach(([id, field]) => {
    const input = document.getElementById(id + '-input');
    const select = document.getElementById(id + '-select');

    select?.addEventListener('change', () => {
      if (!select.value) {
        fs[field+'Id'] = null;
        fs[field+'Name'] = '';
        if (input) input.value = '';
        refreshDNAIfOpen();
        return;
      }
      const dog = dogsById[select.value];
      if (!dog) return;
      fs[field+'Id'] = dog.id;
      fs[field+'Name'] = dog.name;
      if (input) input.value = dog.name;
      markAutoFilled(id + '-input');
      refreshDNAIfOpen();
    });

    input?.addEventListener('input', () => {
      fs[field+'Name'] = input.value.trim();
      if (fs[field+'Id'] && dogsById[fs[field+'Id']]?.name !== fs[field+'Name']) {
        fs[field+'Id'] = null;
      }
      if (select && fs[field+'Id']) {
        select.value = fs[field+'Id'];
      } else if (select) {
        select.value = '';
      }
      refreshDNAIfOpen();
    });

    setupAC(id+'-input', id+'-dropdown', uid, (dog) => {
      fs[field+'Id'] = dog.id; fs[field+'Name'] = dog.name;
      if (select) select.value = dog.id;
      refreshDNAIfOpen();
    });
  });

  // ── Submit
  document.getElementById('dog-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      // Upload photo if new file selected
      let photoURL = fs.photoURL || null;
      if (fs.photoFile) {
        btn.textContent = 'Enviando foto…';
        try {
          photoURL = await uploadDogPhoto(uid, fs.photoFile, appState.editingDogId || `new_${Date.now()}`);
        } catch(photoErr) {
          console.warn('Falha no upload da foto, continuando sem foto:', photoErr);
        }
      }

      const phenotype = {
        baseColor: form.baseColor.value,
        marking:   form.marking.value,
        nose:      form.nose.value,
        dilution:  form.dilution.value,
        merleType: form.merleType.value,
        intensity: form.intensity.value,
        label:     `${form.baseColor.value} ${form.marking.value}`.trim()
      };
      const genotype = inferGenotype(
        phenotype,
        {
          fatherPhenotype: fs.fatherPhenotype,
          motherPhenotype: fs.motherPhenotype,
          ancestorPhenotypes: [
            dogsById[fs.patGrandfatherId]?.phenotype,
            dogsById[fs.patGrandmotherId]?.phenotype,
            dogsById[fs.matGrandfatherId]?.phenotype,
            dogsById[fs.matGrandmotherId]?.phenotype
          ].filter(Boolean)
        },
        fs.provenColors
      );
      const data = {
        name: form.name.value.trim(),
        sex: form.sex.value,
        belongsToMe: form.belongsToMe.value === 'true',
        photoURL,
        phenotype,
        genotype,
        provenColors: fs.provenColors,
        pedigree: {
          fatherId: fs.fatherId||null, fatherName: fs.fatherName||'',
          motherId: fs.motherId||null, motherName: fs.motherName||'',
          patGrandfatherId:   fs.patGrandfatherId||null,   patGrandfatherName:   fs.patGrandfatherName||'',
          patGrandmotherId:   fs.patGrandmotherId||null,   patGrandmotherName:   fs.patGrandmotherName||'',
          matGrandfatherId:   fs.matGrandfatherId||null,   matGrandfatherName:   fs.matGrandfatherName||'',
          matGrandmotherId:   fs.matGrandmotherId||null,   matGrandmotherName:   fs.matGrandmotherName||''
        },
        ancestors: {
          paternal: {
            grandfather: { id: fs.patGrandfatherId || null, name: fs.patGrandfatherName || '' },
            grandmother: { id: fs.patGrandmotherId || null, name: fs.patGrandmotherName || '' }
          },
          maternal: {
            grandfather: { id: fs.matGrandfatherId || null, name: fs.matGrandfatherName || '' },
            grandmother: { id: fs.matGrandmotherId || null, name: fs.matGrandmotherName || '' }
          }
        }
      };
      await saveDog(uid, data, appState.editingDogId || null);
      state.dogs = await getAllDogs(uid);
      window._nav('dogs');
    } catch(err) {
      alert('Erro ao salvar: ' + err.message);
      btn.disabled = false;
      btn.textContent = appState.editingDogId ? 'Salvar Alterações' : 'Cadastrar Cão';
    }
  });
}

function setupAC(inputId, dropId, uid, onSelect) {
  const input = document.getElementById(inputId);
  const drop  = document.getElementById(dropId);
  if (!input || !drop) return;
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { drop.classList.add('hidden'); return; }
    timer = setTimeout(async () => {
      const res = await searchDogsByName(uid, q);
      if (!res.length) { drop.classList.add('hidden'); return; }
      drop.innerHTML = res.slice(0,8).map(d=>`
        <div class="autocomplete-item" data-id="${d.id}">
          <span>${d.name}</span>
          <small>${d.phenotype?.label||''} · ${d.sex==='M'?'♂':'♀'}</small>
        </div>`).join('');
      drop.classList.remove('hidden');
      drop.querySelectorAll('.autocomplete-item').forEach(item=>{
        item.addEventListener('click', ()=>{
          const dog = res.find(d=>d.id===item.dataset.id);
          input.value = dog.name;
          drop.classList.add('hidden');
          onSelect(dog);
        });
      });
    }, 280);
  });
  document.addEventListener('click', e=>{
    if (!input.contains(e.target) && !drop.contains(e.target)) drop.classList.add('hidden');
  }, { capture: true });
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function markAutoFilled(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.style.borderColor = 'var(--gold)';
  el.style.background  = 'rgba(200,134,10,0.08)';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.background  = '';
  }, 3000);
}

function showAutoFillToast(message) {
  const existing = document.getElementById('autofill-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'autofill-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
    background: var(--gold); color: #1a0e00; font-weight: 600;
    padding: 10px 20px; border-radius: 20px; font-size: .82rem;
    z-index: 9999; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    animation: fadeInUp .25s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function updateGenotypePreview() {
  const form = document.getElementById('dog-form');
  if (!form) return;
  const phenotype = {
    baseColor: form.baseColor?.value || '',
    marking: form.marking?.value || '',
    nose: form.nose?.value || '',
    dilution: form.dilution?.value || ''
  };
  const dogsById = Object.fromEntries((state.dogs || []).map(d => [d.id, d]));
  const genotype  = inferGenotype(
    phenotype,
    {
      fatherPhenotype: fs.fatherPhenotype,
      motherPhenotype: fs.motherPhenotype,
      ancestorPhenotypes: [
        dogsById[fs.patGrandfatherId]?.phenotype,
        dogsById[fs.patGrandmotherId]?.phenotype,
        dogsById[fs.matGrandfatherId]?.phenotype,
        dogsById[fs.matGrandmotherId]?.phenotype
      ].filter(Boolean)
    },
    fs.provenColors
  );
  const pheno     = genotypeToPhenotype(genotype);
  const el        = document.getElementById('genotype-preview');
  if (!el) return;
  el.innerHTML = `
    <div class="card card-gold" style="margin-bottom:14px">
      <div class="section-title" style="margin-bottom:6px">Fenótipo Calculado</div>
      <div style="font-family:var(--font-display);font-size:1.15rem;color:var(--gold)">${pheno.label||'—'}</div>
      ${(pheno.healthAlerts||[]).map(a=>`<div class="alert alert-danger mt-8">${a}</div>`).join('')}
    </div>
    <div class="section-title" style="margin-bottom:10px">Alelos por Locus</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${LOCI.map(l=>{
        const pair = genotype[l]||['?','?'];
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--surface2);border-radius:6px">
          <span style="color:var(--text-muted);font-size:.78rem;min-width:70px">Locus ${l}</span>
          <span style="font-family:monospace;color:var(--gold)">${pair[0]}/${pair[1]}</span>
        </div>`;
      }).join('')}
    </div>`;
}

function pulseTabButton(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.style.transition = 'all .2s ease';
  btn.style.background = 'rgba(80,200,100,0.25)';
  btn.style.color      = '#4caf50';
  btn.style.boxShadow  = '0 0 12px rgba(76,175,80,0.6)';
  // Add a dot indicator
  if (!btn.querySelector('.glow-dot')) {
    const dot = document.createElement('span');
    dot.className = 'glow-dot';
    dot.style.cssText = 'display:inline-block;width:6px;height:6px;background:#4caf50;border-radius:50%;margin-left:5px;vertical-align:middle;';
    btn.appendChild(dot);
  }
  setTimeout(() => {
    btn.style.background = '';
    btn.style.color      = '';
    btn.style.boxShadow  = '';
  }, 3000);
}
