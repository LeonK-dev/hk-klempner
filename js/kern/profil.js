// Rechenkern für Kantprofile. Kennt keinen Bildschirm, damit er sich testen lässt.
//
// Ein Profil ist eine Folge von Schenkeln mit Kantungen dazwischen:
//   schenkel:  [{ l: Länge in mm (Außenmaß), art?: Schlüssel aus ABSCHLUESSE }]
//   kantungen: [{ w: Innenwinkel in Grad, r: +1 | -1 }]  – immer eine weniger als Schenkel
//   start:     Zeichenrichtung des ersten Schenkels in Grad (0 = nach rechts, 90 = nach oben)
//   sicht:     +1 = Sichtseite liegt links der Zeichenrichtung, -1 = rechts
// Innenwinkel: 180 = gerade, 90 = rechtwinklig, 0 = zugedrückter Umschlag.
// r: +1 kantet in Zeichenrichtung gesehen nach links, -1 nach rechts.

export const REST_BRAUCHBAR_AB = 200; // mm, Festlegung vom 08.10.2026
const TIPP_BIS = 20; // mm, bis zu diesem Abzug lohnt der Hinweis auf einen Streifen mehr

// seite: +1 kantet zur Sichtseite hin, -1 von ihr weg
export const ABSCHLUESSE = {
  umschlag_zu: { name: 'Umschlag zugedrückt', l: 10, w: 0, seite: -1 },
  umschlag_offen: { name: 'Umschlag offen / Wasserfalz', l: 10, w: 20, seite: -1 },
  tropfkante: { name: 'Tropfkante', l: 20, w: 135, seite: 1 },
  rueckkantung: { name: 'Rückkantung', l: 15, w: 45, seite: -1 },
};

const GRAD = Math.PI / 180;
const runde = (x) => Math.round(x * 10) / 10;

/** Liest eine Zahl in deutscher Schreibweise ("12,5"). Ungültiges ergibt NaN. */
export function zahl(text) {
  if (typeof text === 'number') return text;
  const t = String(text ?? '').trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN;
}

export function kopie(p) {
  return {
    ...p,
    schenkel: p.schenkel.map((s) => ({ ...s })),
    kantungen: p.kantungen.map((k) => ({ ...k })),
  };
}

/** Bringt ein Profil aus dem Speicher in gültige Form. Unbrauchbares ergibt null. */
export function normalisiert(p) {
  if (!p || !Array.isArray(p.schenkel) || p.schenkel.length === 0) return null;
  const schenkel = p.schenkel.map((s) => {
    const aus = { l: Number(s.l) };
    if (s.art && ABSCHLUESSE[s.art]) aus.art = s.art;
    return aus;
  });
  const kantungen = [];
  for (let i = 0; i < schenkel.length - 1; i++) {
    const k = (p.kantungen || [])[i] || {};
    kantungen.push({ w: k.w === undefined ? 90 : Number(k.w), r: k.r === -1 ? -1 : 1 });
  }
  return {
    name: String(p.name || 'Profil'),
    vorlage: p.vorlage || null,
    ueberdeckung: Number(p.ueberdeckung) || 0,
    start: Number(p.start) || 0,
    sicht: p.sicht === -1 ? -1 : 1,
    schenkel,
    kantungen,
  };
}

/** Zuschnittbreite: Summe der Außenmaße, ohne Abzug je Kantung. */
export function zuschnitt(p) {
  return runde(p.schenkel.reduce((summe, s) => summe + (s.l > 0 ? s.l : 0), 0));
}

/**
 * Rechnet den Linienzug des Profils aus.
 * spalt > 0 zieht zugedrückte Umschläge um dieses Maß auseinander, damit man sie in der
 * Zeichnung sieht. Für Rechnungen spalt = 0 lassen.
 */
export function verlauf(p, spalt = 0) {
  let x = 0;
  let y = 0;
  let h = (p.start || 0) * GRAD;
  const punkte = [{ x, y }];
  const strecken = [];
  const ecken = [];
  p.schenkel.forEach((s, i) => {
    const l = s.l > 0 ? s.l : 0;
    const von = punkte.length - 1;
    x += l * Math.cos(h);
    y += l * Math.sin(h);
    punkte.push({ x, y });
    strecken.push({ schenkel: i, von, bis: punkte.length - 1 });
    const k = p.kantungen[i];
    if (!k) return;
    ecken.push({ kantung: i, punkt: punkte.length - 1 });
    const w = k.w >= 0 && k.w <= 180 ? k.w : 90;
    if (w === 0 && spalt > 0) {
      h += k.r * 90 * GRAD;
      x += spalt * Math.cos(h);
      y += spalt * Math.sin(h);
      punkte.push({ x, y });
      h += k.r * 90 * GRAD;
    } else {
      h += k.r * (180 - w) * GRAD;
    }
  });
  return { punkte, strecken, ecken };
}

export function rahmen(punkte) {
  const xs = punkte.map((p) => p.x);
  const ys = punkte.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, breite: Math.max(...xs) - minX, hoehe: Math.max(...ys) - minY };
}

/**
 * Wie oft passt der Zuschnitt in die Breite von Tafel oder Coil?
 * tipp nennt den Abzug, mit dem ein Streifen mehr herauskäme.
 */
export function teiler(z, breite) {
  if (!(z > 0) || !(breite > 0)) return null;
  const anzahl = Math.floor((breite + 1e-9) / z);
  const rest = runde(breite - anzahl * z);
  const naechster = Math.floor(breite / (anzahl + 1));
  const abzug = runde(z - naechster);
  const tipp = anzahl > 0 && abzug > 0 && abzug <= TIPP_BIS
    ? { abzug, zuschnitt: naechster, anzahl: anzahl + 1 }
    : null;
  return { anzahl, rest, brauchbar: rest >= REST_BRAUCHBAR_AB, tipp };
}

export const VERSCHNITT_WENIG_BIS = 5; // % der Breite, darunter gilt der Verschnitt als gering
export const VERSCHNITT_VIEL_AB = 10; // % der Breite, ab hier wird deutlich gewarnt
const EMPFEHLUNG_BIS = 0.15; // bei viel Verschnitt darf die Empfehlung bis 15 % vom Zuschnitt kürzen

/**
 * Klare Aussage zum Verschnitt in der Breite.
 * stufe: 'passt_nicht' | 'kein' | 'wenig' | 'rest' (Reststreifen brauchbar) | 'mittel' | 'viel'
 * empfehlung: um wie viel der Zuschnitt schmaler sein müsste, damit ein Streifen mehr herauskommt
 */
export function bewertung(z, breite) {
  const t = teiler(z, breite);
  if (!t) return null;
  if (t.anzahl === 0) return { stufe: 'passt_nicht', anzahl: 0, rest: t.rest, prozent: 0, empfehlung: null };
  const prozent = runde((t.rest / breite) * 100);
  let stufe = 'viel';
  if (t.rest === 0) stufe = 'kein';
  else if (t.brauchbar) stufe = 'rest';
  else if (prozent < VERSCHNITT_WENIG_BIS) stufe = 'wenig';
  else if (prozent < VERSCHNITT_VIEL_AB) stufe = 'mittel';

  const naechster = Math.floor(breite / (t.anzahl + 1));
  const abzug = runde(z - naechster);
  const viel = stufe === 'mittel' || stufe === 'viel';
  const lohnt = stufe !== 'kein' && stufe !== 'wenig' && abzug > 0
    && (abzug <= TIPP_BIS || (viel && abzug <= z * EMPFEHLUNG_BIS));
  const empfehlung = lohnt
    ? { abzug, zuschnitt: naechster, anzahl: t.anzahl + 1, rest: runde(breite - (t.anzahl + 1) * naechster) }
    : null;
  return { stufe, anzahl: t.anzahl, rest: t.rest, prozent, empfehlung };
}

function kreuzt(a, b, c, d) {
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const e = 1e-6;
  const o1 = o(a, b, c);
  const o2 = o(a, b, d);
  const o3 = o(c, d, a);
  const o4 = o(c, d, b);
  return ((o1 > e && o2 < -e) || (o1 < -e && o2 > e)) && ((o3 > e && o4 < -e) || (o3 < -e && o4 > e));
}

export function schneidetSich(p) {
  const { punkte } = verlauf(p, 0);
  for (let i = 0; i < punkte.length - 1; i++) {
    for (let j = i + 2; j < punkte.length - 1; j++) {
      if (kreuzt(punkte[i], punkte[i + 1], punkte[j], punkte[j + 1])) return true;
    }
  }
  return false;
}

/** Hinweise zum Profil: [{ art: 'fehler' | 'warnung', text, schenkel?, kantung? }] */
export function pruefe(p) {
  const hinweise = [];
  p.schenkel.forEach((s, i) => {
    if (!(s.l > 0)) hinweise.push({ art: 'fehler', schenkel: i, text: `Schenkel ${i + 1}: Länge fehlt.` });
  });
  p.kantungen.forEach((k, i) => {
    if (!(k.w >= 0 && k.w <= 180)) {
      hinweise.push({ art: 'fehler', kantung: i, text: `Kantung ${i + 1}: Der Winkel muss zwischen 0 und 180° liegen.` });
    }
  });
  if (hinweise.length) return hinweise;
  if (schneidetSich(p)) {
    hinweise.push({ art: 'warnung', text: 'Das Profil schneidet sich selbst. Bitte Winkel und Kantrichtung prüfen.' });
  }
  return hinweise;
}

// --- Änderungen am Profil. Alle geben ein neues Profil zurück. ---

// Kommt vorn ein Schenkel dazu oder weg, soll der Rest der Zeichnung stehen bleiben.
const drehungDer = (k) => k.r * (180 - k.w);

export function mitSchenkel(p, ende, schenkel = { l: 50 }, kantung = { w: 90, r: 1 }) {
  const q = kopie(p);
  if (ende === 'anfang') {
    q.schenkel.unshift({ ...schenkel });
    q.kantungen.unshift({ ...kantung });
    q.start -= drehungDer(kantung);
  } else {
    q.schenkel.push({ ...schenkel });
    q.kantungen.push({ ...kantung });
  }
  return q;
}

export function ohneSchenkel(p, i) {
  if (p.schenkel.length <= 1) return kopie(p);
  const q = kopie(p);
  q.schenkel.splice(i, 1);
  if (i === 0) {
    const [k] = q.kantungen.splice(0, 1);
    q.start += drehungDer(k);
  } else {
    q.kantungen.splice(Math.min(i, q.kantungen.length - 1), 1);
  }
  return q;
}

/** Setzt, tauscht oder entfernt (art = null) den Kantenabschluss an einem Ende. */
export function mitAbschluss(p, ende, art) {
  const vorn = ende === 'anfang';
  let q = kopie(p);
  const i = vorn ? 0 : q.schenkel.length - 1;
  if (q.schenkel.length > 1 && q.schenkel[i].art) q = ohneSchenkel(q, i);
  if (!art) return q;
  const a = ABSCHLUESSE[art];
  return mitSchenkel(q, ende, { l: a.l, art }, { w: a.w, r: a.seite * q.sicht });
}

export function abschlussAn(p, ende) {
  if (p.schenkel.length < 2) return null;
  const s = p.schenkel[ende === 'anfang' ? 0 : p.schenkel.length - 1];
  return s.art || null;
}

export function gespiegelt(p) {
  const q = kopie(p);
  q.start = 180 - q.start;
  q.sicht = -q.sicht;
  q.kantungen.forEach((k) => { k.r = -k.r; });
  return q;
}

export function gedreht(p, grad = 90) {
  const q = kopie(p);
  q.start = (q.start + grad) % 360;
  return q;
}

/** Lage des ersten Schenkels als Winkel zwischen -180 und 180 Grad (0 = waagerecht, 90 = senkrecht). */
export function lage(p) {
  const w = (((p.start || 0) + 180) % 360 + 360) % 360 - 180;
  return w === -180 ? 180 : runde(w);
}

/** Legt den ersten Schenkel waagerecht oder senkrecht, ohne die Zeichnung auf den Kopf zu stellen. */
export function ausgerichtet(p, wie) {
  const q = kopie(p);
  const rad = (p.start || 0) * GRAD;
  if (wie === 'waagerecht') q.start = Math.cos(rad) >= -1e-9 ? 0 : 180;
  else q.start = Math.sin(rad) >= -1e-9 ? 90 : -90;
  return q;
}

export function freiesProfil() {
  return {
    name: 'Freies Profil', vorlage: null, ueberdeckung: 0, start: 0, sicht: 1,
    schenkel: [{ l: 100 }], kantungen: [],
  };
}
