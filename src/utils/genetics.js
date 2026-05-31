// ============================================================
// GENETICS PATCH — Spitz Lineage Manager
// Cole este conteúdo em: src/utils/genetics.js
//
// Principais mudanças desta versão:
//  - Beaver e Lilás são classes genéticas distintas
//  - genotypeToPhenotype retorna "Lilás" apenas com b/b + d/d
//  - genotypeToPhenotype retorna "Beaver" com b/b + pelo laranja (sem d/d)
//  - inferGenotype trata chips "Lilás" e "Beaver" de forma independente
// ============================================================

export const LOCI = ['A','K','E','B','D','S','M','H','I'];

// ─────────────────────────────────────────────────────────────
// GENOTYPE → PHENOTYPE  (o motor de tradução)
// ─────────────────────────────────────────────────────────────
export function genotypeToPhenotype(genotype) {
  const g = genotype || {};
  const get  = (locus) => g[`Locus_${locus}`] || ['?','?'];
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
    return alleles[0] || '?';
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

  // ── Locus M — Merle ──────────────────────────────────────
  const merleCount = get('M').filter(a => a === 'M').length;
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

  // ── Merle sobrepõe ───────────────────────────────────────
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
// INFER GENOTYPE — Regra de Ouro em 3 níveis
//  Nível 1: Fenótipo visual
//  Nível 2: Pedigree (pais)
//  Nível 3: Histórico de Cores Produzidas (prioridade máxima)
// ─────────────────────────────────────────────────────────────
export function inferGenotype(phenotype, pedigree = {}, provenColors = []) {
  const g = {
    Locus_A: ['Ay','Ay'],
    Locus_K: ['k','k'],
    Locus_E: ['E','E'],
    Locus_B: ['?','?'],
    Locus_D: ['D','D'],
    Locus_S: ['S','S'],
    Locus_M: ['m','m'],
    Locus_H: ['h','h'],
    Locus_I: ['i','i'],
  };

  const inferredColors = Array.isArray(provenColors) ? [...provenColors] : [];
  const producedColors = Array.isArray(pedigree?.producedColors) ? pedigree.producedColors : [];
  if (producedColors.length) inferredColors.push(...producedColors);

  const ancestorBases = (pedigree?.ancestorPhenotypes || [])
    .map(p => (p?.baseColor || '').toLowerCase())
    .filter(Boolean);

  const base = (phenotype?.baseColor || '').toLowerCase();
  const nose = (phenotype?.nose || '').toLowerCase();

  // ────────────────────────────────────────────────────────
  // NÍVEL 1 — Fenótipo
  // ────────────────────────────────────────────────────────
  if (base.includes('preto')) {
    g.Locus_K = ['K','k'];
    g.Locus_B = ['B','?'];
    g.Locus_D = ['D','D'];
  }
  else if (base.includes('chocolate')) {
    g.Locus_K = ['K','k'];
    g.Locus_B = ['b','b'];
    g.Locus_D = ['D','D'];
  }
  // ── LILÁS: chocolate + diluído ──────────────────────────
  else if (base.includes('lilás') || base.includes('lilas')) {
    g.Locus_K = ['K','k'];
    g.Locus_B = ['b','b'];   // chocolate obrigatório
    g.Locus_D = ['d','d'];   // diluição obrigatória
  }
  // ── BEAVER: laranja/biscoito com pigmento marrom ─────────
  else if (base.includes('beaver')) {
    g.Locus_K = ['k','k'];
    g.Locus_A = ['Ay','Ay']; // sable / laranja
    g.Locus_B = ['b','b'];   // b/b → trufa marrom (o que define beaver)
    g.Locus_D = ['D','D'];   // NÃO exige diluição
  }
  else if (base.includes('azul') || base.includes('cinza')) {
    g.Locus_K = ['K','k'];
    g.Locus_B = ['B','?'];
    g.Locus_D = ['d','d'];
  }
  else if (base.includes('laranja') || base.includes('sable')) {
    g.Locus_K = ['k','k'];
    g.Locus_A = ['Ay','Ay'];
  }
  else if (base.includes('wolf')) {
    g.Locus_K = ['k','k'];
    g.Locus_A = ['Aw','Aw'];
  }
  else if (base.includes('creme') || base.includes('branco')) {
    g.Locus_E = ['e','e'];
  }
  else if (base.includes('tricolor')) {
    g.Locus_K = ['k','k'];
    g.Locus_A = ['at','at'];
    g.Locus_S = ['sp','sp'];
  }
  else if (base.includes('tan') || base.includes('fogo')) {
    g.Locus_K = ['k','k'];
    g.Locus_A = ['at','at'];
  }
  else if (base.includes('merle')) {
    g.Locus_M = ['M','m'];
  }

  // Trufa Lilás → confirma b/b + d/d
  if (nose.includes('lilás') || nose.includes('lilas')) {
    g.Locus_B = ['b','b'];
    g.Locus_D = ['d','d'];
  }
  // Trufa Marrom/Fígado (Beaver) → confirma b/b mas NÃO força d/d
  if (nose.includes('marrom') || nose.includes('fígado') || nose.includes('figado')) {
    g.Locus_B = ['b','b'];
    // Não altera Locus_D — pode ser densa ou diluída conforme fenótipo
  }

  // ────────────────────────────────────────────────────────
  // NÍVEL 2 — Pedigree (pais)
  // ────────────────────────────────────────────────────────
  const fatherBase = (pedigree?.fatherPhenotype?.baseColor || '').toLowerCase();
  const motherBase = (pedigree?.motherPhenotype?.baseColor || '').toLowerCase();

  // Se qualquer pai é chocolate/lilás/beaver → cão é portador B/b
  const parentHasB = [fatherBase, motherBase].some(b =>
    b.includes('chocolate') || b.includes('lilás') || b.includes('lilas') || b.includes('beaver')
  );
  const ancestorHasB = ancestorBases.some(b =>
    b.includes('chocolate') || b.includes('lilás') || b.includes('lilas') || b.includes('beaver')
  );
  if ((parentHasB || ancestorHasB) && g.Locus_B[0] === 'B') g.Locus_B = ['B','b'];

  // Se qualquer pai é azul/lilás → cão é portador D/d
  const parentHasD = [fatherBase, motherBase].some(b =>
    b.includes('azul') || b.includes('cinza') || b.includes('lilás') || b.includes('lilas')
  );
  if (parentHasD && g.Locus_D[0] === 'D') g.Locus_D = ['D','d'];

  // ────────────────────────────────────────────────────────
  // NÍVEL 3 — Histórico de Cores Produzidas (prioridade máxima)
  // ────────────────────────────────────────────────────────
  if (inferredColors.includes('Chocolate') || inferredColors.includes('Beaver')) {
    // Produziu chocolate OU beaver → necessariamente porta alelo b
    if (g.Locus_B[0] !== 'b') g.Locus_B = ['B','b'];
  }

  if (inferredColors.includes('Lilás')) {
    // Lilás = b/b + d/d nos filhotes → pai deve ser ao menos B/b e D/d
    if (g.Locus_B[0] !== 'b') g.Locus_B = ['B','b'];
    if (g.Locus_D[0] !== 'd') g.Locus_D = ['D','d'];
    // Se o cão já é b/b (chocolate/lilás/beaver), então é D/d portador
    // A regra real: para produzir lilás precisa de b e d em ambos os pais
  }

  if (inferredColors.includes('Beaver')) {
    // Beaver exige b/b no filhote com pelo laranja
    // → pai porta b, mas NÃO necessariamente d
    if (g.Locus_B[0] !== 'b') g.Locus_B = ['B','b'];
    // Locus_D permanece como inferido pelo fenótipo — beaver não implica diluição
  }

  if (inferredColors.includes('Azul/Cinza')) {
    if (g.Locus_D[0] !== 'd') g.Locus_D = ['D','d'];
  }

  if (inferredColors.includes('Creme/Branco')) {
    if (g.Locus_E[0] !== 'e') g.Locus_E = ['E','e'];
  }

  if (inferredColors.includes('Merle')) {
    if (!g.Locus_M.includes('M')) g.Locus_M = ['M','m'];
  }

  if (g.Locus_B[0] === '?' && g.Locus_B[1] === '?') {
    g.Locus_B = ['B','?'];
  }

  return g;
}

// ─────────────────────────────────────────────────────────────
// SIMULADOR DE NINHADA — Quadrado de Punnett
// ─────────────────────────────────────────────────────────────
export function simulateLitter(maleGenotype, femaleGenotype, size = 20) {
  const litter = [];
  for (let i = 0; i < size; i++) {
    const pupGenotype = {};
    for (const locus of LOCI) {
      const key   = `Locus_${locus}`;
      const male  = maleGenotype[key]   || ['?','?'];
      const fem   = femaleGenotype[key] || ['?','?'];
      const combo = [
        [male[0], fem[0]],
        [male[0], fem[1]],
        [male[1], fem[0]],
        [male[1], fem[1]],
      ];
      pupGenotype[key] = combo[Math.floor(Math.random() * 4)];
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
