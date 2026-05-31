// ============================================================
// GENETICS PATCH — Spitz Lineage Manager
// Cole este conteúdo em: src/utils/genetics.js
//
// Principais mudanças desta versão:
//  - Beaver e Lilás são classes genéticas distintas
//  - genotypeToPhenotype retorna "Lilás" apenas com b/b + d/d
//  - genotypeToPhenotype retorna "Beaver" com b/b + pelo laranja (sem d/d)
//  - inferGenotype trata chips "Lilás" e "Beaver" de forma independente
//  - NOVO: Política determinística rigorosa — ZERO alelos wildcard
//  - NOVO: Helper centralizado para inferência de evidências
//  - NOVO: Trava biológica absoluta contra Double Merle em simulateLitter
// ============================================================

export const LOCI = ['A','K','E','B','D','S','M','H','I'];
const LOCUS_FALLBACK = {
  A: ['Ay', 'Ay'],
  K: ['k', 'k'],
  E: ['E', 'E'],
  B: ['B', 'B'],
  D: ['D', 'D'],
  S: ['S', 'S'],
  M: ['m', 'm'],
  H: ['h', 'h'],
  I: ['i', 'i'],
};

// ──────────��──────────────────────────────────────────────────
// HELPER: Centralizado para coleta de evidências
// ─────────────────────────────────────────────────────────────
function collectEvidenceForRecessives(pedigree = {}, provenColors = []) {
  const evidence = {
    hasChocolateHistory: false,
    hasTanHistory: false,
    hasOrangeCreamHistory: false,
    hasDilueHistory: false,
    hasMerleHistory: false,
  };

  // Cores já produzidas
  const producedColors = Array.isArray(pedigree?.producedColors) ? pedigree.producedColors : [];
  const normalizedProduced = producedColors
    .map(c => String(c || '').toLowerCase())
    .filter(Boolean);

  // Cores comprovadas pelo usuário
  const normalizedProven = Array.isArray(provenColors)
    ? provenColors.map(c => String(c || '').toLowerCase()).filter(Boolean)
    : [];

  const allHistory = [...normalizedProduced, ...normalizedProven];

  // Cores dos ancestrais
  const ancestorPhenotypes = pedigree?.ancestorPhenotypes || [];
  const ancestorColors = ancestorPhenotypes
    .map(p => (p?.baseColor || '').toLowerCase())
    .filter(Boolean);

  // Fenótipos dos pais
  const fatherColor = (pedigree?.fatherPhenotype?.baseColor || '').toLowerCase();
  const motherColor = (pedigree?.motherPhenotype?.baseColor || '').toLowerCase();

  // Verificar prova de Chocolate
  evidence.hasChocolateHistory = 
    allHistory.some(c => c.includes('chocolate') || c.includes('beaver'))
    || ancestorColors.some(c => c.includes('chocolate') || c.includes('beaver'))
    || fatherColor.includes('chocolate') || fatherColor.includes('beaver')
    || motherColor.includes('chocolate') || motherColor.includes('beaver')
    || fatherColor.includes('lilás') || motherColor.includes('lilás');

  // Verificar prova de Tan
  evidence.hasTanHistory = 
    allHistory.some(c => c.includes('tan') || c.includes('fogo') || c.includes('points'))
    || ancestorColors.some(c => c.includes('tan') || c.includes('fogo') || c.includes('points'));

  // Verificar prova de Orange/Cream
  evidence.hasOrangeCreamHistory = 
    allHistory.some(c => c.includes('laranja') || c.includes('sable') || c.includes('creme') || c.includes('branco'))
    || ancestorColors.some(c => c.includes('laranja') || c.includes('sable') || c.includes('creme') || c.includes('branco'))
    || fatherColor.includes('laranja') || fatherColor.includes('sable') || fatherColor.includes('creme')
    || motherColor.includes('laranja') || motherColor.includes('sable') || motherColor.includes('creme');

  // Verificar prova de Diluição
  evidence.hasDilueHistory = 
    allHistory.some(c => c.includes('azul') || c.includes('cinza') || c.includes('lilás'))
    || ancestorColors.some(c => c.includes('azul') || c.includes('cinza') || c.includes('lilás'))
    || fatherColor.includes('azul') || fatherColor.includes('cinza') || fatherColor.includes('lilás')
    || motherColor.includes('azul') || motherColor.includes('cinza') || motherColor.includes('lilás');

  // Verificar prova de Merle
  evidence.hasMerleHistory = 
    allHistory.some(c => c.includes('merle'))
    || ancestorColors.some(c => c.includes('merle'))
    || fatherColor.includes('merle')
    || motherColor.includes('merle');

  return evidence;
}

// ─────────────────────────────────────────────────────────────
// GENOTYPE → PHENOTYPE  (o motor de tradução)
// ─────────────────────────────────────────────────────────────
export function genotypeToPhenotype(genotype) {
  const g = genotype || {};
  // Nunca retorna '?' — se o alelo for desconhecido usa homozigose dominante visual
  const get  = (locus) => {
    const pair = g[`Locus_${locus}`];
    if (!Array.isArray(pair) || pair.length !== 2) return LOCUS_FALLBACK[locus];
    return pair.map((a, i) => (!a || a === '?' || a === null) ? LOCUS_FALLBACK[locus][i] : a);
  };
  const has  = (locus, allele) => get(locus).includes(allele);
  const homo = (locus, allele) => get(locus).every(a => a === allele);

  const result = {
    label: '',
    baseColor: '',
    marking: '',
    dilution: '',
    doubleMerle: false,
    alerts: []
  };

  // ── Locus E — Extensão / Creme ────────────────────────────
  const isCremeWhite = homo('E', 'e');  // e/e → perde toda pigmentação preta/marrom

  // ── Locus K — Preto Dominante ────────────────────────────
  const isSolidBlack = has('K', 'K');   // K/_ → ignora Locus A

  // ── Locus B — Pigmento marrom ────────────────────────────
  const isChocolateBase = homo('B', 'b');   // b/b → pigmento marrom

  // ── Locus D — Diluição ───────────────────────────────────
  const isDilute = homo('D', 'd');          // d/d → diluído

  // ── Locus A — Padrão ─────────────────────────────────────
  const locusA = get('A');
  function dominantA(alleles) {
    const order = ['Ay','Aw','at','a'];
    for (const a of order) { if (alleles.includes(a)) return a; }
    return alleles[0] || LOCUS_FALLBACK.A[0]; // fallback: Ay (dominante padrão)
  }
  const topA = dominantA(locusA);

  // ── Locus S — Manchas ────────────────────────────────────
  const locusS = get('S');
  function dominantS(alleles) {
    const order = ['S','si','sp','sw'];
    for (const s of order) { if (alleles.includes(s)) return s; }
    return alleles[0] || 'S';
  }
  const topS = dominantS(locusS);

  // ── Locus M — Merle (com trava rigorosa)──────────────────────────────────
  const locusM = get('M');
  const merleCount = locusM.filter(a => a === 'M').length;
  
  // TRAVA BIOLÓGICA ABSOLUTA: Double Merle só se ambos alelos forem 'M'
  if (merleCount === 2) {
    result.doubleMerle = true;
    result.alerts.push('⚠️ Double Merle detectado! Risco elevado de surdez e cegueira.');
  }
  const isMerle = merleCount >= 1;

  // ────────────────────────────────────────────────────────
  // REGRA PRINCIPAL: determinar cor base
  // ────────────────────────────────────────────────────────
  let baseColor = '';

  if (isCremeWhite) {
    // e/e mascara tudo → Creme/Branco independente de B e D
    baseColor = 'Creme/Branco';
  } else if (isSolidBlack) {
    // K/_ → cor sólida
    if (isChocolateBase && isDilute) {
      // b/b + d/d = Lilás (chocolate diluído)
      baseColor = 'Lilás';
    } else if (isChocolateBase) {
      // b/b + D/_ = Chocolate
      baseColor = 'Chocolate';
    } else if (isDilute) {
      // B/_ + d/d = Azul
      baseColor = 'Azul/Cinza';
    } else {
      baseColor = 'Preto';
    }
  } else {
    // Locus K = k/k → Locus A determina o padrão
    if (topA === 'Ay') {
      // Sable / Laranja
      if (isChocolateBase) {
        // b/b + Laranja (Ay) = Beaver (trufa marrom, pelo laranja/biscoito)
        // Não exige d/d — apenas que o pigmento seja marrom
        baseColor = 'Beaver';
      } else if (isDilute) {
        baseColor = 'Laranja/Sable'; // diluído leve, mantém categoria
      } else {
        baseColor = 'Laranja/Sable';
      }
    } else if (topA === 'Aw') {
      baseColor = 'Wolf Sable';
    } else if (topA === 'at') {
      if (topS === 'sp' || homo('S','sp')) {
        baseColor = 'Tricolor';
      } else {
        baseColor = 'Tan Points';
      }
    } else {
      // a/a recessivo com k/k: raro, trata como Preto
      if (isChocolateBase && isDilute) baseColor = 'Lilás';
      else if (isChocolateBase)        baseColor = 'Chocolate';
      else if (isDilute)               baseColor = 'Azul/Cinza';
      else                             baseColor = 'Preto';
    }
  }

  // ── Merle sobrepõe (somente se isMerle = true, i.e. merleCount >= 1) ───────────────────────────────────
  let marking = '';
  if (isMerle && baseColor !== 'Creme/Branco') {
    marking = 'Merle';
  } else if (topS === 'sp') {
    marking = 'Particolor';
  } else if (topA === 'at' && !['Tricolor','Tan Points'].includes(baseColor)) {
    marking = 'Tan Points';
  }

  result.baseColor = baseColor;
  result.marking   = marking;
  result.dilution  = isDilute ? 'diluída' : 'densa';
  result.label     = [baseColor, marking].filter(Boolean).join(' ').trim();

  return result;
}

// ─────────────────────────────────────────────────────────────
// INFER GENOTYPE — Política Determinística Rigorosa
// Nível 1: Fenótipo visual → determina base + dominantes
// Nível 2: Pedigree + Histórico → prova de recessivos ocultos
// Nível 3: ZERO alelos em aberto — Homozigose Dominante se sem prova
// ─────────────────────────────────────────────────────────────
export function inferGenotype(phenotype, pedigree = {}, provenColors = []) {
  const g = {
    Locus_A: ['Ay','Ay'],
    Locus_K: ['k','k'],
    Locus_E: ['E','E'],
    Locus_B: ['B','B'],
    Locus_D: ['D','D'],
    Locus_S: ['S','S'],
    Locus_M: ['m','m'],
    Locus_H: ['h','h'],
    Locus_I: ['i','i'],
  };

  const base = (phenotype?.baseColor || '').toLowerCase();
  const nose = (phenotype?.nose || '').toLowerCase();

  // Coleta centralizada de evidências
  const evidence = collectEvidenceForRecessives(pedigree, provenColors);

  // ────────────────────────────────────────────────────────
  // NÍVEL 1 — Fenótipo visual determina alelos dominantes
  // ────────────────────────────────────────────────────────
  if (base.includes('preto')) {
    g.Locus_K = ['K','k'];
    // Locus B: determinístico, sem wildcard
    g.Locus_B = evidence.hasChocolateHistory ? ['B', 'b'] : ['B', 'B'];
    // Locus D: determinístico
    g.Locus_D = evidence.hasDilueHistory ? ['D', 'd'] : ['D', 'D'];
    // Locus E: determinístico
    g.Locus_E = evidence.hasOrangeCreamHistory ? ['E', 'e'] : ['E', 'E'];
  }
  else if (base.includes('chocolate')) {
    g.Locus_K = ['K','k'];
    g.Locus_B = ['b','b']; // chocolate visual → sempre b/b
    g.Locus_D = evidence.hasDilueHistory ? ['D', 'd'] : ['D', 'D'];
    g.Locus_E = evidence.hasOrangeCreamHistory ? ['E', 'e'] : ['E', 'E'];
  }
  // ── LILÁS: chocolate + diluído ──────────────────────────
  else if (base.includes('lilás') || base.includes('lilas')) {
    g.Locus_K = ['K','k'];
    g.Locus_B = ['b','b'];   // chocolate obrigatório
    g.Locus_D = ['d','d'];   // diluição obrigatória
    g.Locus_E = evidence.hasOrangeCreamHistory ? ['E', 'e'] : ['E', 'E'];
  }
  // ── BEAVER: laranja/biscoito com pigmento marrom ─────────
  else if (base.includes('beaver')) {
    g.Locus_K = ['k','k'];
    g.Locus_A = ['Ay','Ay']; // sable / laranja
    g.Locus_B = ['b','b'];   // b/b → trufa marrom (o que define beaver)
    g.Locus_D = evidence.hasDilueHistory ? ['D', 'd'] : ['D', 'D'];
    g.Locus_E = evidence.hasOrangeCreamHistory ? ['E', 'e'] : ['E', 'E'];
  }
  else if (base.includes('azul') || base.includes('cinza')) {
    g.Locus_K = ['K','k'];
    g.Locus_B = evidence.hasChocolateHistory ? ['B', 'b'] : ['B', 'B'];
    g.Locus_D = ['d','d']; // diluição visual obrigatória
    g.Locus_E = evidence.hasOrangeCreamHistory ? ['E', 'e'] : ['E', 'E'];
  }
  else if (base.includes('laranja') || base.includes('sable')) {
    g.Locus_K = ['k','k'];
    g.Locus_A = ['Ay','Ay'];
    g.Locus_B = evidence.hasChocolateHistory ? ['B', 'b'] : ['B', 'B'];
    g.Locus_D = evidence.hasDilueHistory ? ['D', 'd'] : ['D', 'D'];
    g.Locus_E = ['E', 'E']; // laranja visual = E/_ (não pode ser e/e)
  }
  else if (base.includes('wolf')) {
    g.Locus_K = ['k','k'];
    g.Locus_A = ['Aw','Aw'];
    g.Locus_B = evidence.hasChocolateHistory ? ['B', 'b'] : ['B', 'B'];
    g.Locus_D = evidence.hasDilueHistory ? ['D', 'd'] : ['D', 'D'];
    g.Locus_E = evidence.hasOrangeCreamHistory ? ['E', 'e'] : ['E', 'E'];
  }
  else if (base.includes('creme') || base.includes('branco')) {
    g.Locus_E = ['e','e']; // creme/branco visual = e/e sempre
  }
  else if (base.includes('tricolor')) {
    g.Locus_K = ['k','k'];
    g.Locus_A = ['at','at'];
    g.Locus_S = ['sp','sp'];
    g.Locus_B = evidence.hasChocolateHistory ? ['B', 'b'] : ['B', 'B'];
    g.Locus_D = evidence.hasDilueHistory ? ['D', 'd'] : ['D', 'D'];
    g.Locus_E = evidence.hasOrangeCreamHistory ? ['E', 'e'] : ['E', 'E'];
  }
  else if (base.includes('tan') || base.includes('fogo')) {
    g.Locus_K = ['k','k'];
    g.Locus_A = ['at','at'];
    g.Locus_B = evidence.hasChocolateHistory ? ['B', 'b'] : ['B', 'B'];
    g.Locus_D = evidence.hasDilueHistory ? ['D', 'd'] : ['D', 'D'];
    g.Locus_E = evidence.hasOrangeCreamHistory ? ['E', 'e'] : ['E', 'E'];
  }
  else if (base.includes('merle')) {
    g.Locus_M = ['M','m'];
  }

  // ────────────────────────────────────────────────────────
  // TRUFA — sobrescreve apenas B/D quando explícito
  // ────────────────────────────────────────────────────────
  if (nose.includes('lilás') || nose.includes('lilas')) {
    g.Locus_B = ['b','b'];
    g.Locus_D = ['d','d'];
  } else if (nose.includes('marrom') || nose.includes('fígado') || nose.includes('figado')) {
    g.Locus_B = ['b','b'];
    // NÃO altera Locus_D — respeita fenótipo
  }

  // ────────────────────────────────────────────────────────
  // LOCUS M — Política Rigorosa Determinística
  // ────────────────────────────────────────────────────────
  const isVisualMerle =
    base.includes('merle')
    || (phenotype?.marking || '').toLowerCase().includes('merle')
    || (phenotype?.merleType || '').toLowerCase().includes('merle');

  if (isVisualMerle) {
    g.Locus_M = ['M', 'm'];
  } else if (evidence.hasMerleHistory) {
    g.Locus_M = ['M', 'm'];
  } else {
    // SEM merle visual e SEM prova = homozigose recessivo (ZERO wildcard)
    g.Locus_M = ['m', 'm'];
  }

  // ────────────────────────────────────────────────────────
  // GARANTIA FINAL: Nenhum alelo pode ser '?', null ou vazio.
  // Regra: segundo alelo desconhecido = primeiro alelo (homozigose dominante visual).
  // ────────────────────────────────────────────────────────
  for (const locus of LOCI) {
    const key = `Locus_${locus}`;
    const pair = g[key];
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(a => !a || a === '?' || a === null || a === undefined)) {
      g[key] = LOCUS_FALLBACK[locus];
    } else {
      // Segundo alelo individual inválido → assume homozigose dominante
      const first  = (!pair[0] || pair[0] === '?') ? LOCUS_FALLBACK[locus][0] : pair[0];
      const second = (!pair[1] || pair[1] === '?') ? first : pair[1];
      g[key] = [first, second];
    }
  }

  return g;
}

// ─────────────────────────────────────────────────────────────
// SIMULADOR DE NINHADA — Quadrado de Punnett com Trava Biológica
// ─────────────────────────────────────────────────────────────
export function simulateLitter(maleGenotype, femaleGenotype, size = 20) {
  // TRAVA BIOLÓGICA ABSOLUTA: Verificar presença do alelo M em pais
  const paiTemM = (maleGenotype?.Locus_M || []).includes('M');
  const maeTemM = (femaleGenotype?.Locus_M || []).includes('M');

  const sanitizePair = (pair, locus) => {
    const fallback = LOCUS_FALLBACK[locus] || ['Ay', 'Ay'];
    const source = Array.isArray(pair) && pair.length === 2 ? pair : fallback;
    // Regra: alelo desconhecido assume homozigose dominante visual (ZERO wildcards)
    const first  = (source[0] == null || source[0] === '?' || source[0] === '') ? fallback[0] : source[0];
    const second = (source[1] == null || source[1] === '?' || source[1] === '') ? first       : source[1];
    return [first, second];
  };

  const litter = [];
  for (let i = 0; i < size; i++) {
    const pupGenotype = {};
    for (const locus of LOCI) {
      const key   = `Locus_${locus}`;
      const male  = sanitizePair(maleGenotype[key], locus);
      const fem   = sanitizePair(femaleGenotype[key], locus);
      
      // ─────────────────────────────────────────────────────
      // BLOQUEIO DE DOUBLE MERLE FANTASMA
      // Se nenhum dos pais tem M, filhote NUNCA pode ser Merle
      // ─────────────────────────────────────────────────────
      if (locus === 'M' && !paiTemM && !maeTemM) {
        // Força Locus M do filhote para ['m', 'm']
        pupGenotype[key] = ['m', 'm'];
      } else {
        // Para outros loci (ou M se pelo menos um pai tem), usa Punnett normal
        const combo = [
          [male[0], fem[0]],
          [male[0], fem[1]],
          [male[1], fem[0]],
          [male[1], fem[1]],
        ];
        pupGenotype[key] = combo[Math.floor(Math.random() * 4)];
      }
    }
    const phenotype = genotypeToPhenotype(pupGenotype);
    litter.push({ genotype: pupGenotype, phenotype });
  }
  return litter;
}

export function litterStats(litter) {
  const counts = {};
  const alerts = [];
  for (const pup of litter) {
    const label = pup.phenotype.label || 'Desconhecido';
    counts[label] = (counts[label] || 0) + 1;
    if (pup.phenotype.doubleMerle) {
      if (!alerts.includes('⚠️ Double Merle detectado na ninhada! Risco de surdez e cegueira.')) {
        alerts.push('⚠️ Double Merle detectado na ninhada! Risco de surdez e cegueira.');
      }
    }
  }
  return { counts, total: litter.length, alerts };
}

// ─────────────────────────────────────────────────────────────
// COI HELPER (usado pelo simulator.js via collectAncestorIds)
// ─────────────────────────────────────────────────────────────
export function calculateCOI(mAncestors, fAncestors, dogsMap) {
  const mSet = new Set(mAncestors);
  const fSet = new Set(fAncestors);
  const shared = [...mSet].filter(id => fSet.has(id));
  const sharedAncestors = shared.map(id => dogsMap[id]?.name || id);
  const riskPercent = Math.min(Math.round((shared.length / Math.max(mSet.size, 1)) * 50), 50);
  return {
    hasInbreeding:   shared.length > 0,
    sharedAncestors,
    riskPercent,
    shared,
  };
}
