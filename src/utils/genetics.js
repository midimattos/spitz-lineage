// ============================================================
// MOTOR GENÉTICO — Spitz Lineage Manager
// Implementa os 9 Loci com regras de dominância completas
// ============================================================

// ─── Loci Definition ─────────────────────────────────────────────────────────
export const LOCI = ['A', 'K', 'E', 'B', 'D', 'S', 'M', 'H', 'I'];

export const LOCI_LABELS = {
  A: 'Locus A (Padrão)',
  K: 'Locus K (Preto Dom.)',
  E: 'Locus E (Extensão)',
  B: 'Locus B (Pigmento)',
  D: 'Locus D (Diluição)',
  S: 'Locus S (Manchas)',
  M: 'Locus M (Merle)',
  H: 'Locus H (Harlequin)',
  I: 'Locus I (Intensidade)'
};

// Allele dominance order (index 0 = most dominant)
export const DOMINANCE = {
  A: ['Ay', 'Aw', 'at', 'a'],
  K: ['K', 'kbr', 'k'],
  E: ['Em', 'E', 'e'],
  B: ['B', 'b'],
  D: ['D', 'd'],
  S: ['S', 'si', 'sp', 'sw'],
  M: ['M', 'm'],
  H: ['H', 'h'],
  I: ['I', 'i']
};

export const ALLELE_DISPLAY = {
  Ay: 'Sable', Aw: 'Wolf Sable', at: 'Tan Points', a: 'Preto Rec.',
  K: 'Preto Dom.', kbr: 'Brindle', k: 'Permite A',
  Em: 'Máscara', E: 'Normal', e: 'Creme/Branco',
  B: 'Preto', b: 'Chocolate',
  D: 'Denso', d: 'Diluído',
  S: 'Sólido', si: 'Irlandesa', sp: 'Particolor', sw: 'Branco Extremo',
  M: 'Merle', m: 'Não-Merle',
  H: 'Harlequin', h: 'Normal',
  I: 'Intens. Alta', i: 'Intens. Baixa'
};

// ─── Dominant allele of a pair ────────────────────────────────────────────────
export function dominantAllele(locus, pair) {
  const order = DOMINANCE[locus];
  const [a1, a2] = pair;
  const i1 = order.indexOf(a1);
  const i2 = order.indexOf(a2);
  if (i1 === -1) return a2;
  if (i2 === -1) return a1;
  return i1 <= i2 ? a1 : a2;
}

export function isHomozygous(pair) {
  return pair[0] === pair[1];
}

// ─── Genotype → Phenotype translator ─────────────────────────────────────────
export function genotypeToPhenotype(genotype) {
  const g = genotype;
  const result = {
    baseColor: '',
    dilution: '',
    pattern: '',
    mask: false,
    merle: false,
    doubleMerle: false,
    particolor: false,
    creme: false,
    chocolate: false,
    diluted: false,
    nose: 'Preta',
    healthAlerts: []
  };

  // Locus E — check cream/white first (epistatic)
  const eAllele = dominantAllele('E', g.E || ['E', 'E']);
  if (g.E && isHomozygous(g.E) && g.E[0] === 'e') {
    result.creme = true;
    result.baseColor = 'Creme/Branco';
    result.nose = 'Carne';
    return result; // masks all other loci
  }
  if (eAllele === 'Em') result.mask = true;

  // Locus B
  const bAllele = dominantAllele('B', g.B || ['B', 'B']);
  result.chocolate = (bAllele === 'b' && isHomozygous(g.B));

  // Locus D
  const dAllele = dominantAllele('D', g.D || ['D', 'D']);
  result.diluted = (dAllele === 'd' && isHomozygous(g.D));

  // Locus K
  const kAllele = dominantAllele('K', g.K || ['k', 'k']);
  const isSolid = (kAllele === 'K' && (g.K[0] === 'K' || g.K[1] === 'K'));

  // Locus A (only matters if K allows it)
  let aPattern = 'Sable';
  if (!isSolid) {
    const aAllele = dominantAllele('A', g.A || ['Ay', 'ay']);
    if (aAllele === 'Ay') aPattern = 'Sable';
    else if (aAllele === 'Aw') aPattern = 'Wolf Sable';
    else if (aAllele === 'at') aPattern = 'Tan Points';
    else if (aAllele === 'a') aPattern = 'Preto Recessivo';
  }

  // Base color string
  if (result.chocolate) {
    result.baseColor = result.diluted ? 'Beaver/Lilás' : 'Chocolate';
    result.nose = result.diluted ? 'Lilás' : 'Marrom';
  } else {
    result.baseColor = result.diluted ? 'Azul/Cinza' : 'Preto/Laranja';
    result.nose = result.diluted ? 'Azul/Acinzentada' : 'Preta';
  }

  result.pattern = isSolid ? 'Sólido' : aPattern;

  // Locus S
  const sAllele = dominantAllele('S', g.S || ['S', 'S']);
  if (sAllele === 'sp' && isHomozygous(g.S)) {
    result.particolor = true;
    result.pattern += ' Particolor';
  } else if (sAllele === 'sw' && isHomozygous(g.S)) {
    result.pattern += ' Branco Extremo';
  } else if (sAllele === 'si') {
    result.pattern += ' c/ Mancha Irlandesa';
  }

  // Locus M — Merle
  if (g.M) {
    const hasM = g.M.includes('M');
    const countM = g.M.filter(a => a === 'M').length;
    if (countM === 2) {
      result.doubleMerle = true;
      result.merle = true;
      result.healthAlerts.push('⚠️ DOUBLE MERLE — risco alto de cegueira e surdez!');
    } else if (countM === 1) {
      result.merle = true;
      result.pattern += ' Merle';
    }
  }

  // Final label
  result.label = `${result.baseColor} ${result.pattern}${result.mask ? ' c/ Máscara' : ''}${result.merle ? ' (Merle)' : ''}`.trim();

  return result;
}

// ─── Inference Engine (Regra de Ouro) ────────────────────────────────────────
export function inferGenotype(phenotype, pedigree, provenColors) {
  const g = {};

  // Default neutral genotype
  g.A = ['Ay', 'a'];
  g.K = ['k', 'k'];
  g.E = ['E', 'E'];
  g.B = ['B', 'B'];
  g.D = ['D', 'D'];
  g.S = ['S', 'S'];
  g.M = ['m', 'm'];
  g.H = ['h', 'h'];
  g.I = ['I', 'i'];

  // Level 1: Phenotype
  if (phenotype) {
    const bc = phenotype.baseColor?.toLowerCase() || '';
    const marking = phenotype.marking?.toLowerCase() || '';

    if (bc.includes('chocolate')) {
      g.B = ['b', 'b'];
    }
    if (bc.includes('beaver') || bc.includes('lilás') || bc.includes('lilas')) {
      g.B = ['b', 'b'];
      g.D = ['d', 'd'];
    }
    if (bc.includes('azul') || bc.includes('cinza')) {
      g.D = ['d', 'd'];
    }
    if (bc.includes('creme') || bc.includes('branco')) {
      g.E = ['e', 'e'];
    }
    if (marking?.includes('tan') || marking?.includes('fogo')) {
      g.A = ['at', 'at'];
      g.K = ['k', 'k'];
    }
    if (marking?.includes('sable')) {
      g.A = ['Ay', 'a'];
    }
    if (marking?.includes('merle')) {
      g.M = ['M', 'm'];
    }
    if (marking?.includes('particolor')) {
      g.S = ['sp', 'sp'];
    }
  }

  // Level 2: Pedigree
  if (pedigree) {
    if (pedigree.fatherPhenotype?.baseColor?.toLowerCase().includes('chocolate')) {
      if (g.B[0] !== 'b') g.B = ['B', 'b']; // carrier
    }
    if (pedigree.fatherPhenotype?.dilution?.toLowerCase().includes('azul')) {
      if (g.D[0] !== 'd') g.D = ['D', 'd'];
    }
  }

  // Level 3: Proven Colors (HIGHEST PRIORITY — overrides everything)
  if (provenColors && provenColors.length > 0) {
    for (const color of provenColors) {
      const c = color.toLowerCase();
      if (c.includes('chocolate') || c.includes('beaver') || c.includes('lilas')) {
        g.B = ['B', 'b']; // must carry b
      }
      if (c.includes('beaver') || c.includes('lilas') || c.includes('azul')) {
        g.D = ['D', 'd']; // must carry d
      }
      if (c.includes('creme') || c.includes('branco')) {
        if (g.E[0] !== 'e') g.E = ['E', 'e'];
      }
      if (c.includes('merle')) {
        g.M = ['M', 'm'];
      }
    }
  }

  return g;
}

// ─── Punnett Square Simulator ─────────────────────────────────────────────────
export function simulateLitter(maleGenotype, femaleGenotype, count = 20) {
  const litter = [];

  for (let i = 0; i < count; i++) {
    const puppyGenotype = {};
    for (const locus of LOCI) {
      const maleAleles = maleGenotype[locus] || ['k', 'k'];
      const femaleAleles = femaleGenotype[locus] || ['k', 'k'];
      const maleAllele = maleAleles[Math.floor(Math.random() * 2)];
      const femaleAllele = femaleAleles[Math.floor(Math.random() * 2)];
      puppyGenotype[locus] = [maleAllele, femaleAllele];
    }
    const pheno = genotypeToPhenotype(puppyGenotype);
    litter.push({ genotype: puppyGenotype, phenotype: pheno });
  }

  return litter;
}

// ─── Litter Statistics ────────────────────────────────────────────────────────
export function litterStats(litter) {
  const counts = {};
  const alerts = new Set();

  for (const pup of litter) {
    const label = pup.phenotype.label;
    counts[label] = (counts[label] || 0) + 1;
    if (pup.phenotype.doubleMerle) alerts.add('Double Merle detectado na ninhada!');
  }

  return {
    counts,
    alerts: [...alerts],
    total: litter.length
  };
}

// ─── COI Calculator ───────────────────────────────────────────────────────────
export function calculateCOI(maleAncestors, femaleAncestors, allDogsMap) {
  const maleIds = new Set(maleAncestors);
  const femaleIds = new Set(femaleAncestors);
  const shared = [...maleIds].filter(id => femaleIds.has(id));

  const sharedNames = shared.map(id => allDogsMap[id]?.name || id);

  // Simple Wright's coefficient approximation
  // For full COI would need generation depth; this gives a risk estimate
  const riskPercent = Math.round((shared.length / Math.max(maleIds.size, 1)) * 100);

  return {
    hasInbreeding: shared.length > 0,
    sharedAncestors: sharedNames,
    sharedIds: shared,
    riskPercent,
    level: riskPercent === 0 ? 'none' : riskPercent < 10 ? 'low' : riskPercent < 25 ? 'medium' : 'high'
  };
}

// ─── Shortcut presets ─────────────────────────────────────────────────────────
export const COLOR_PRESETS = {
  'Preto Sólido': {
    phenotype: { baseColor: 'preto', marking: 'solido' },
    partial: { K: ['K', 'k'], B: ['B', 'B'], D: ['D', 'D'] }
  },
  'Chocolate': {
    phenotype: { baseColor: 'chocolate', marking: 'solido' },
    partial: { B: ['b', 'b'], D: ['D', 'D'] }
  },
  'Beaver': {
    phenotype: { baseColor: 'beaver', marking: 'solido' },
    partial: { B: ['b', 'b'], D: ['d', 'd'] }
  },
  'Sable': {
    phenotype: { baseColor: 'laranja', marking: 'sable' },
    partial: { A: ['Ay', 'Ay'], K: ['k', 'k'] }
  },
  'Creme/Branco': {
    phenotype: { baseColor: 'creme', marking: 'creme' },
    partial: { E: ['e', 'e'] }
  },
  'Azul': {
    phenotype: { baseColor: 'azul', marking: 'solido' },
    partial: { B: ['B', 'B'], D: ['d', 'd'] }
  },
  'Tan Points': {
    phenotype: { baseColor: 'preto', marking: 'tan_points' },
    partial: { A: ['at', 'at'], K: ['k', 'k'] }
  },
  'Merle': {
    phenotype: { baseColor: 'merle', marking: 'merle' },
    partial: { M: ['M', 'm'] }
  }
};

export const PROVEN_COLOR_OPTIONS = [
  'Preto Sólido', 'Chocolate', 'Beaver/Lilás', 'Sable', 'Wolf Sable',
  'Tan Points', 'Tricolor', 'Creme/Branco', 'Azul/Cinza', 'Merle',
  'Particolor', 'Branco Extremo'
];
