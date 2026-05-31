// ============================================================
// PDF UTILITY — Spitz Lineage Manager
// Exporta generateLitterCertificate (chamado pelo simulator.js)
// ============================================================

export async function generateLitterCertificate({ male, female, litter, stats, coiResult, kennelName }) {
  // This function is kept for backwards compatibility.
  // The main PDF generation logic now lives inside simulator.js (generatePDF).
  // You can use this as a standalone entry point if needed.
  const entries = Object.entries(stats.counts).sort((a,b) => b[1]-a[1]);
  const total   = stats.total;

  const SWATCH = {
    preto:'#1a1a1a', chocolate:'#5c3317', beaver:'#8a6040', 'lilás':'#907090',
    azul:'#5a80a8', laranja:'#c06818', sable:'#b87030', creme:'#e8d8a8',
    branco:'#f0ece0', merle:'#6888a8', wolf:'#787858', tricolor:'#1a1a1a'
  };
  const swatchColor = (label) => {
    const l = (label||'').toLowerCase();
    for (const [k,v] of Object.entries(SWATCH)) { if (l.includes(k)) return v; }
    return '#888';
  };

  const today = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });

  const colorBars = entries.map(([label, count]) => {
    const pct = Math.round((count/total)*100);
    const col = swatchColor(label);
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:14px;height:14px;border-radius:50%;background:${col};flex-shrink:0;border:2px solid rgba(0,0,0,.1)"></div>
      <div style="flex:1;font-size:11pt;color:#333">${label}</div>
      <div style="width:130px;height:10px;background:#e8e0d8;border-radius:5px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${col}"></div>
      </div>
      <div style="font-size:11pt;font-weight:700;min-width:34px;text-align:right">${pct}%</div>
    </div>`;
  }).join('');

  const coiSummary = coiResult.hasInbreeding
    ? `<div style="background:#fff8e1;border-left:4px solid #f59e0b;padding:10px 14px;border-radius:4px;margin-top:14px;font-size:10pt">
        ⚠️ COI: <strong>${coiResult.riskPercent || coiResult.totalCOI}% (risco ${coiResult.risk||'moderado'})</strong>
        — Ancestrais: ${(coiResult.sharedAncestors||[]).slice(0,3).join(', ')}
       </div>`
    : `<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:10pt 14px;border-radius:4px;margin-top:14px;font-size:10pt">
        ✅ Nenhuma consanguinidade detectada nas últimas 4 gerações.
       </div>`;

  const photoBox = (dog, emoji) =>
    dog.photoURL
      ? `<img src="${dog.photoURL}" style="width:110px;height:110px;object-fit:cover;border-radius:8px;display:block;margin:0 auto 8px" crossorigin="anonymous" />`
      : `<div style="width:110px;height:110px;background:#f5f0e8;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:3rem;margin:0 auto 8px">${emoji}</div>`;

  const html = `
    <div id="pdf-content-standalone" style="width:794px;background:#fff;color:#1a1a1a;font-family:Georgia,serif;padding:48px 52px;box-sizing:border-box">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #c8860a;padding-bottom:16px;margin-bottom:24px">
        <div>
          <div style="font-size:22pt;font-weight:700;color:#1a0e00">${kennelName}</div>
          <div style="font-size:10pt;color:#666;margin-top:2px">Certificado de Planejamento Genético</div>
        </div>
        <div style="text-align:right;font-size:9pt;color:#888">
          <div>${today}</div>
          <div style="color:#c8860a;font-weight:600;margin-top:2px">Spitz Lineage Manager</div>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:15pt;font-weight:700;color:#c8860a">Planejamento de Ninhada</div>
        <div style="font-size:12pt;margin-top:4px;color:#333">${male.name} × ${female.name}</div>
      </div>
      <div style="display:flex;gap:32px;justify-content:center;margin-bottom:24px">
        <div style="text-align:center">${photoBox(male,'🐕')}
          <div style="font-weight:700;font-size:11pt">${male.name}</div>
          <div style="font-size:9pt;color:#888">♂ ${male.phenotype?.label||'—'}</div>
        </div>
        <div style="display:flex;align-items:center;padding-bottom:30px;font-size:26pt;color:#c8860a">×</div>
        <div style="text-align:center">${photoBox(female,'🐩')}
          <div style="font-weight:700;font-size:11pt">${female.name}</div>
          <div style="font-size:9pt;color:#888">♀ ${female.phenotype?.label||'—'}</div>
        </div>
      </div>
      <div style="background:#fafaf8;border:1px solid #e8e0d4;border-radius:8px;padding:18px 20px">
        <div style="font-size:12pt;font-weight:700;margin-bottom:14px;color:#1a0e00;border-bottom:1px solid #e8e0d4;padding-bottom:8px">
          Probabilidades — ${total} filhotes simulados
        </div>
        ${colorBars}
      </div>
      ${coiSummary}
      <div style="margin-top:32px;border-top:1px solid #e8e0d4;padding-top:14px;display:flex;justify-content:space-between;align-items:flex-end">
        <div style="font-size:8pt;color:#bbb">Gerado por Spitz Lineage Manager</div>
        <div style="text-align:right">
          <div style="border-top:1px solid #999;width:180px;margin-bottom:4px"></div>
          <div style="font-size:9pt;color:#666">${kennelName}</div>
        </div>
      </div>
    </div>`;

  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px';
  container.innerHTML = html;
  document.body.appendChild(container);

  const filename = `Certificado_${male.name}_x_${female.name}.pdf`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

  try {
    if (typeof html2pdf !== 'undefined') {
      await html2pdf()
        .set({
          margin: 0, filename,
          image:       { type:'jpeg', quality:.95 },
          html2canvas: { scale:2, useCORS:true, allowTaint:true },
          jsPDF:       { unit:'px', format:'a4', orientation:'portrait' }
        })
        .from(container.firstChild)
        .save();
    } else {
      const win = window.open('', '_blank');
      if (!win) { alert('Permita pop-ups para gerar o PDF.'); return; }
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>body{margin:0}@media print{body{margin:0}}</style>
        </head><body>`);
      win.document.write(html);
      win.document.write('</body></html>');
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  } finally {
    document.body.removeChild(container);
  }
}
