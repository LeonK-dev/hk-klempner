// Zahlen und Texte für Bildschirm und Druckblatt, damit beide gleich schreiben.

import { formatName, formatSchluessel } from './kern/material.js';

export const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ohne Tausenderpunkt: 2000 mm bleibt 2000, sonst läse die Eingabe "2.000" als 2
export const dez = (x, stellen = 1) => x.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: stellen });
export const mm = (x) => dez(x, 1);
export const euro = (x) => x.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/** "2026-06-16" → "16.06.2026" */
export const datum = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
};

/** "5,22 €/kg, Rechnung Vollmar 7501010143 vom 16.06.2026" */
export function preisText(e) {
  const betrag = `${e.preis.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/${e.einheit}`;
  const tag = datum(e.datum);
  let woher;
  if (e.herkunft === 'DTG Liste') woher = `DTG-Liste${tag ? ` vom ${tag}` : ''}, freibleibend`;
  else if (e.herkunft === 'Schätzung') woher = 'geschätzt';
  else woher = [e.herkunft, e.haendler, e.beleg].filter(Boolean).join(' ') + (tag ? ` vom ${tag}` : '');
  return `${betrag}, ${woher}${e.hinweis ? ` – ${e.hinweis}` : ''}`;
}

/** Preis aus einer Rechnung oder einem Angebot. Altpreis, DTG-Liste und Schätzung werden markiert. */
export const sicher = (e) => e.herkunft === 'Rechnung' || e.herkunft === 'Angebot';

/** "12 Stück: 11 × 2000 mm, 1 × 1550 mm." */
export function stueckText(liste) {
  const summe = liste.reduce((s, x) => s + x.n, 0);
  if (!summe) return 'Menge fehlt.';
  return `${summe} Stück: ${liste.map((x) => `${x.n} × ${mm(x.l)} mm`).join(', ')}.`;
}

/** "2 Tafeln 1000 × 2000, 6 m vom Coil 500 breit (3 Abschnitte)" */
export function bedarfText(bleche) {
  const jeFormat = new Map();
  bleche.forEach((o) => {
    const k = formatSchluessel(o.format);
    const e = jeFormat.get(k) || { format: o.format, anzahl: 0, laenge: 0 };
    e.anzahl += 1;
    e.laenge += o.l;
    jeFormat.set(k, e);
  });
  return [...jeFormat.values()].map((e) => (
    e.format.art === 'coil'
      ? `${dez(e.laenge / 1000, 2)} m vom ${formatName(e.format)} (${e.anzahl} ${e.anzahl === 1 ? 'Abschnitt' : 'Abschnitte'})`
      : `${e.anzahl} ${formatName(e.format, e.anzahl)}`
  )).join(', ');
}

/** "Brauchbare Reste: 1 × 750 × 2000 mm." */
export function resteText(reste) {
  const n = new Map();
  reste.forEach((x) => {
    const k = `${x.b} × ${x.l} mm`;
    n.set(k, (n.get(k) || 0) + 1);
  });
  return n.size ? `Brauchbare Reste: ${[...n].map(([k, z]) => `${z} × ${k}`).join(', ')}.` : 'Keine brauchbaren Reste.';
}

/** Überschrift eines Blechs im Schnittplan */
export const blechName = (o) => (o.format.art === 'coil' ? `${formatName(o.format)}, Abschnitt ${mm(o.l)} mm` : formatName(o.format));

/** Verbrauch, Verschnitt und Reste eines Plans in einem Satz */
export const verbrauchText = (r) => `Verbrauch ${dez(r.verbrauchM2, 2)} m² (${dez(r.verbrauchKg, 1)} kg), davon Verschnitt `
  + `${dez(r.verschnittM2, 2)} m² (${dez(r.verschnittProzent, 1)} %). ${resteText(r.plan.summen.reste)}`;

/** Materialkosten aus kern/preise.js als HTML: Betrag, angebrochen und Herkunft je Format */
export function kostenHtml(k) {
  if (!k) return '';
  if (k.fehlt.length) {
    const was = k.fehlt.map((f) => formatName(f)).join(', ');
    return `<p class="hinweis warnung">Kein Preis für ${esc(was)} in der Preisdatei. Den Materialpreis kann das Tool hier nicht rechnen.</p>`;
  }
  const reste = k.reste >= 0.005
    ? ` Angebrochen wird Blech für ${euro(k.gekauft)}, davon gehen ${euro(k.reste)} als brauchbare Reste ins Lager.` : '';
  const basis = k.basis.map(({ format, eintrag }) => (
    `<li${sicher(eintrag) ? '' : ' class="unsicher"'}>${esc(formatName(format))}: ${esc(preisText(eintrag))}</li>`
  )).join('');
  return `<p class="kosten"><strong>Material ${euro(k.verbrauch)}</strong> netto im Einkauf, mit Verschnitt.${reste}</p>
    <ul class="preisbasis">${basis}</ul>`;
}

/** Urteil zum Verschnitt in Prozent: [Wort, Farbklasse] */
export function urteil(prozent) {
  return prozent < 0.05 ? ['Kein Verschnitt', 'gut']
    : prozent < 5 ? ['Wenig Verschnitt', 'gut']
      : prozent < 10 ? ['Verschnitt', 'mittel'] : ['Viel Verschnitt', 'schlecht'];
}
