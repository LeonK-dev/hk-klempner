// Preise aus der Preisdatei: Einkauf netto, erzeugt aus dem Materialstamm (werkzeug/preisdatei.py).
// Die Datei wird je Gerät geladen und bleibt dort. Im öffentlichen Programm stehen keine Preise.
//
// Eintrag: { material, dicke, format: 'tafel-1000x2000' | 'coil-600', preis, einheit: 'kg' | 'm²' | 'Tafel' | 'm',
//            herkunft, haendler, artikel, beleg, datum: 'JJJJ-MM-TT', bezeichnung, hinweis }
// einheit 'm' heißt laufender Meter vom Coil.

import { formatSchluessel, gewicht } from './material.js';
import { auswertung } from './zuschnittplan.js';

export const PREISDATEI = { art: 'hk-klempner-preise', version: 1 };

const schluessel = (material, dicke, format) => `${material}|${Number(dicke)}|${format}`;

/** Prüft eine eingelesene Preisdatei. Wirft einen Fehler mit einem Satz für den Bildschirm. */
export function lesePreise(roh) {
  if (!roh || roh.art !== PREISDATEI.art) throw new Error('Das ist keine Preisdatei für HK Klempner.');
  if (roh.version !== PREISDATEI.version) {
    throw new Error('Diese Preisdatei ist für eine andere Fassung von HK Klempner. Bitte die Seite neu laden oder die Datei neu erzeugen.');
  }
  const eintraege = new Map();
  (Array.isArray(roh.preise) ? roh.preise : []).forEach((e) => {
    const preis = Number(e && e.preis);
    if (!e || !e.material || !e.format || !(preis > 0)) return;
    eintraege.set(schluessel(e.material, e.dicke, e.format), { ...e, preis });
  });
  if (!eintraege.size) throw new Error('In der Preisdatei steht kein Preis.');
  return { stand: String(roh.stand || ''), quelle: String(roh.quelle || ''), eintraege };
}

export function preisFuer(preise, materialId, dicke, format) {
  return preise ? preise.eintraege.get(schluessel(materialId, dicke, formatSchluessel(format))) || null : null;
}

/** Euro je m² Blech, null wenn die Einheit nicht zum Format passt. */
export function euroJeM2(eintrag, material, dicke, format) {
  const p = eintrag.preis;
  if (eintrag.einheit === 'kg') return p * gewicht(material, dicke, 1);
  if (eintrag.einheit === 'm²') return p;
  if (eintrag.einheit === 'Tafel' && format.art === 'tafel') return p / ((format.b * format.l) / 1e6);
  if (eintrag.einheit === 'm' && format.art === 'coil') return p / (format.b / 1000);
  return null;
}

/**
 * Materialkosten eines Plans, Einkauf netto.
 * verbrauch: mit Verschnitt, ohne brauchbare Reste. gekauft: alles, was angebrochen wird. reste: der Unterschied.
 * Fehlt für ein Format ein Preis, sind die Beträge null und das Format steht in fehlt.
 * basis: [{ format, eintrag }] je verwendetem Format, zum Anzeigen der Preisherkunft.
 */
export function kosten(bleche, material, dicke, preise) {
  let verbrauch = 0;
  let gekauft = 0;
  const basis = new Map();
  const fehlt = new Map();
  bleche.forEach((blech) => {
    const k = formatSchluessel(blech.format);
    const eintrag = preisFuer(preise, material.id, dicke, blech.format);
    const jeM2 = eintrag ? euroJeM2(eintrag, material, dicke, blech.format) : null;
    if (!(jeM2 > 0)) {
      fehlt.set(k, blech.format);
      return;
    }
    basis.set(k, { format: blech.format, eintrag });
    const s = auswertung([blech]);
    gekauft += (s.gekauft / 1e6) * jeM2;
    verbrauch += (s.verbrauch / 1e6) * jeM2;
  });
  const ok = fehlt.size === 0;
  return {
    verbrauch: ok ? verbrauch : null,
    gekauft: ok ? gekauft : null,
    reste: ok ? gekauft - verbrauch : null,
    basis: [...basis.values()],
    fehlt: [...fehlt.values()],
  };
}

/** Alter der Preisdatei in Tagen, null ohne lesbares Datum. */
export function alterInTagen(preise, heute = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(preise && preise.stand);
  if (!m) return null;
  const stand = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const tag = Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate());
  return Math.round((tag - stand) / 86400000);
}
