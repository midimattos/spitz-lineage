// ============================================================
// PDF GENERATOR — Certificado de Simulação de Ninhada
// ============================================================

export async function generateLitterCertificate({ male, female, litter, stats, coiResult, kennelName, kennelLogo }) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210;
  const pageH = 297;
  const margin = 18;
  let y = margin;

  // ─── Colors ──────────────────────────────────────────────
  const GOLD = [200, 134, 10];
  const DARK = [26, 14, 0];
  const GRAY = [90, 80, 70];
  const LIGHT = [245, 238, 225];

  // ─── Background ──────────────────────────────────────────
  pdf.setFillColor(...LIGHT);
  pdf.rect(0, 0, W, pageH, 'F');

  // ─── Border ──────────────────────────────────────────────
  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(0.8);
  pdf.rect(8, 8, W - 16, pageH - 16, 'S');
  pdf.setLineWidth(0.3);
  pdf.rect(10, 10, W - 20, pageH - 20, 'S');

  // ─── Header ──────────────────────────────────────────────
  pdf.setFillColor(...GOLD);
  pdf.rect(margin, y, W - margin * 2, 28, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(kennelName || 'Canil Premium', W / 2, y + 10, { align: 'center' });
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('CERTIFICADO DE PREVISÃO GENÉTICA DE NINHADA', W / 2, y + 20, { align: 'center' });
  y += 36;

  // ─── Date ────────────────────────────────────────────────
  pdf.setTextColor(...GRAY);
  pdf.setFontSize(9);
  pdf.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, W - margin, y, { align: 'right' });
  y += 8;

  // ─── Parents section ─────────────────────────────────────
  const colW = (W - margin * 2 - 6) / 2;

  // Male box
  pdf.setFillColor(240, 235, 220);
  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(0.4);
  pdf.rect(margin, y, colW, 36, 'FD');

  pdf.setTextColor(...GOLD);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('♂ MACHO', margin + 4, y + 7);
  pdf.setTextColor(...DARK);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.text(male?.name || '—', margin + 4, y + 16);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...GRAY);
  pdf.text(male?.phenotype?.label || '', margin + 4, y + 23, { maxWidth: colW - 8 });

  // Female box
  const fx = margin + colW + 6;
  pdf.setFillColor(240, 235, 220);
  pdf.rect(fx, y, colW, 36, 'FD');
  pdf.setTextColor(...GOLD);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('♀ FÊMEA', fx + 4, y + 7);
  pdf.setTextColor(...DARK);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.text(female?.name || '—', fx + 4, y + 16);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...GRAY);
  pdf.text(female?.phenotype?.label || '', fx + 4, y + 23, { maxWidth: colW - 8 });
  y += 44;

  // ─── COI Alert ───────────────────────────────────────────
  if (coiResult?.hasInbreeding) {
    pdf.setFillColor(255, 240, 200);
    pdf.setDrawColor(200, 100, 0);
    pdf.setLineWidth(0.4);
    pdf.rect(margin, y, W - margin * 2, 14, 'FD');
    pdf.setTextColor(160, 60, 0);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`⚠ Consanguinidade: ${coiResult.riskPercent}% — Ancestrais comuns: ${coiResult.sharedAncestors.slice(0, 3).join(', ')}`, margin + 4, y + 9);
    y += 20;
  }

  // ─── Results title ────────────────────────────────────────
  pdf.setTextColor(...GOLD);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('PROBABILIDADES DA NINHADA', margin, y);
  y += 2;
  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, W - margin, y);
  y += 6;

  // ─── Probability bars ────────────────────────────────────
  const total = stats.total;
  const entries = Object.entries(stats.counts).sort((a, b) => b[1] - a[1]);

  for (const [label, count] of entries) {
    const pct = Math.round((count / total) * 100);
    const barW = ((W - margin * 2 - 40) * pct) / 100;

    pdf.setTextColor(...DARK);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text(label, margin, y + 4);

    pdf.setFillColor(...GOLD);
    pdf.rect(margin, y + 6, barW, 4, 'F');
    pdf.setFillColor(210, 200, 185);
    pdf.rect(margin + barW, y + 6, (W - margin * 2 - 40) - barW, 4, 'F');

    pdf.setTextColor(...GRAY);
    pdf.setFontSize(8);
    pdf.text(`${pct}% (${count}/${total})`, W - margin, y + 9, { align: 'right' });

    y += 16;
    if (y > pageH - 40) {
      pdf.addPage();
      pdf.setFillColor(...LIGHT);
      pdf.rect(0, 0, W, pageH, 'F');
      y = margin;
    }
  }

  // ─── Health alerts ────────────────────────────────────────
  if (stats.alerts?.length > 0) {
    y += 4;
    pdf.setFillColor(255, 220, 220);
    pdf.setDrawColor(180, 0, 0);
    pdf.setLineWidth(0.4);
    pdf.rect(margin, y, W - margin * 2, 14, 'FD');
    pdf.setTextColor(180, 0, 0);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(stats.alerts.join(' | '), margin + 4, y + 9, { maxWidth: W - margin * 2 - 8 });
    y += 20;
  }

  // ─── Footer ───────────────────────────────────────────────
  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(0.3);
  pdf.line(margin, pageH - 22, W - margin, pageH - 22);
  pdf.setTextColor(...GRAY);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'italic');
  pdf.text('Este certificado é uma previsão probabilística baseada no genótipo inferido dos genitores.', W / 2, pageH - 16, { align: 'center' });
  pdf.text('Spitz Lineage Manager — Gestão Genética de Elite', W / 2, pageH - 11, { align: 'center' });

  pdf.save(`ninhada-${male?.name || 'macho'}-x-${female?.name || 'femea'}-${Date.now()}.pdf`);
}
