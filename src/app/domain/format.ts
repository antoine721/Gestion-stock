const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nombreEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const euro = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

export function fmtNombre(valeur: number): string {
  return nombre.format(Number.isFinite(valeur) ? valeur : 0);
}

export function fmtEntier(valeur: number): string {
  return nombreEntier.format(Number.isFinite(valeur) ? valeur : 0);
}

export function fmtEuro(valeur: number): string {
  return euro.format(Number.isFinite(valeur) ? valeur : 0);
}

/** Millilitres -> l'unite qui se lit le mieux (75 cl, 4,2 L, 300 ml). */
export function fmtVolume(ml: number): string {
  if (!Number.isFinite(ml) || ml === 0) return '0';
  const signe = ml < 0 ? '-' : '';
  const abs = Math.abs(ml);
  if (abs >= 1000) return `${signe}${fmtNombre(abs / 1000)} L`;
  if (abs >= 100) return `${signe}${fmtNombre(abs / 10)} cl`;
  return `${signe}${fmtEntier(abs)} ml`;
}

export function fmtEcart(pct: number): string {
  const signe = pct > 0 ? '+' : '';
  return `${signe}${fmtEntier(pct)} %`;
}
