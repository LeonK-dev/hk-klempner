// Rechenkern für Kantprofile. Kennt keinen Bildschirm, damit er sich testen lässt.
//
// Ein Profil ist eine Folge von Schenkeln mit Kantungen dazwischen:
//   schenkel:  [{ l: Länge in mm (Außenmaß), art?: Schlüssel aus ABSCHLUESSE }]
//   kantungen: [{ w: Innenwinkel in Grad, r: +1 | -1 }]  – immer eine weniger als Schenkel
//   fest:      Index des Schenkels, der in der Zeichnung stehen bleibt
//   lage:      Zeichenrichtung dieses festen Schenkels in Grad (0 = nach rechts, 90 = nach oben)
//   sicht:     +1 = Sichtseite liegt links der Zeichenrichtung, -1 = rechts
// Alle anderen Richtungen ergeben sich vom festen Schenkel aus. Wird davor oder dahinter ein
// Winkel geändert oder umgeklappt, bewegt sich nur der Teil auf der anderen Seite der Kantung.
// Ältere Profile haben statt fest/lage ein start (Richtung von Schenkel 1), das wird noch gelesen.
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

// Ungültige Winkel (beim Tippen) zählen vorläufig als 90°, damit die Zeichnung nicht springt
function gueltig(w) {
  return w >= 0 && w <= 180 ? w : 90;
}

function drehung(k) {
  return k.r * (180 - gueltig(k.w));
}

export function festVon(p) {
  return Number.isInteger(p.fest) && p.fest >= 0 && p.fest < p.schenkel.length ? p.fest : 0;
}

/** Index des längsten Schenkels. Er ist der feste Schenkel, solange nichts anderes gewählt ist. */
export function laengster(p) {
  let bester = 0;
  p.schenkel.forEach((s, i) => {
    if ((s.l > 0 ? s.l : 0) > (p.schenkel[bester].l > 0 ? p.schenkel[bester].l : 0)) bester = i;
  });
  return bester;
}

/** Zeichenrichtung von Schenkel i in Grad. */
export function richtung(p, i) {
  if (p.lage === undefined) { // älteres Profil: start ist die Richtung von Schenkel 1
    let h = p.start || 0;
    for (let k = 0; k < i; k++) h += drehung(p.kantungen[k]);
    return h;
  }
  const f = festVon(p);
  let h = p.lage;
  for (let k = f; k < i; k++) h += drehung(p.kantungen[k]);
  for (let k = i; k < f; k++) h -= drehung(p.kantungen[k]);
  return h;
}

/** Macht aus einem älteren Profil mit start eines mit festem Schenkel, ohne die Zeichnung zu ändern. */
export function mitAnker(p) {
  if (p.lage !== undefined) return { ...kopie(p), fest: festVon(p) };
  const q = kopie(p);
  q.fest = laengster(q);
  q.lage = richtung(p, q.fest);
  delete q.start;
  return q;
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
  const neu = Number.isFinite(Number(p.lage)) && p.lage !== null && p.lage !== undefined;
  return mitAnker({
    name: String(p.name || 'Profil'),
    vorlage: p.vorlage || null,
    ueberdeckung: Number(p.ueberdeckung) || 0,
    sicht: p.sicht === -1 ? -1 : 1,
    schenkel,
    kantungen,
    ...(neu
      ? { fest: festVon({ fest: p.fest, schenkel }), lage: Number(p.lage) }
      : { start: Number(p.start) || 0 }),
  });
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
  let h = richtung(p, 0) * GRAD;
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
    const w = gueltig(k.w);
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
// Der feste Schenkel behält dabei seine Richtung, der Rest richtet sich nach ihm.

export function mitSchenkel(p, ende, schenkel = { l: 50 }, kantung = { w: 90, r: 1 }) {
  const q = mitAnker(p);
  if (ende === 'anfang') {
    q.schenkel.unshift({ ...schenkel });
    q.kantungen.unshift({ ...kantung });
    q.fest += 1;
  } else {
    q.schenkel.push({ ...schenkel });
    q.kantungen.push({ ...kantung });
  }
  return q;
}

export function ohneSchenkel(p, i) {
  const q = mitAnker(p);
  const n = q.schenkel.length;
  if (n <= 1) return q;
  if (i === q.fest) { // der Nachbar wird fest und behält seine jetzige Richtung
    const nachbar = i === n - 1 ? i - 1 : i + 1;
    const lageNachbar = richtung(q, nachbar);
    q.fest = nachbar > i ? nachbar - 1 : nachbar;
    q.lage = lageNachbar;
  } else if (i < q.fest) {
    q.fest -= 1;
  }
  q.schenkel.splice(i, 1);
  q.kantungen.splice(i === 0 ? 0 : Math.min(i, q.kantungen.length - 1), 1);
  return q;
}

/** Setzt, tauscht oder entfernt (art = null) den Kantenabschluss an einem Ende. */
export function mitAbschluss(p, ende, art) {
  const vorn = ende === 'anfang';
  let q = mitAnker(p);
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

/** Klappt Kantung k um. Es bewegt sich der Teil, der nicht den festen Schenkel enthält. */
export function geklappt(p, k) {
  const q = mitAnker(p);
  q.kantungen[k].r = -q.kantungen[k].r;
  return q;
}

/** Macht Schenkel i zum festen Schenkel. Die Zeichnung bleibt dabei, wie sie ist. */
export function mitFest(p, i) {
  const q = mitAnker(p);
  const lageNeu = richtung(q, i);
  q.fest = i;
  q.lage = lageNeu;
  return q;
}

export function gespiegelt(p) {
  const q = mitAnker(p);
  q.lage = 180 - q.lage;
  q.sicht = -q.sicht;
  q.kantungen.forEach((k) => { k.r = -k.r; });
  return q;
}

export function gedreht(p, grad = 90) {
  const q = mitAnker(p);
  q.lage = (q.lage + grad) % 360;
  return q;
}

/**
 * Neigung des festen Schenkels zwischen -90 und 90 Grad: 0 = waagerecht, 90 = senkrecht,
 * positiv = steigt nach rechts an. In welche Richtung das Profil läuft, spielt dafür keine Rolle.
 */
export function neigung(p) {
  const q = mitAnker(p);
  const w = ((q.lage % 180) + 180) % 180;
  return runde(w > 90 ? w - 180 : w);
}

/** Stellt die Neigung des festen Schenkels ein, ohne die Zeichnung auf den Kopf zu stellen. */
export function mitNeigung(p, grad) {
  const q = mitAnker(p);
  const abstand = (a) => Math.abs(((((a - q.lage) % 360) + 540) % 360) - 180);
  q.lage = abstand(grad) <= abstand(grad + 180) ? grad : grad + 180;
  return q;
}

export function ausgerichtet(p, wie) {
  return mitNeigung(p, wie === 'waagerecht' ? 0 : 90);
}

export function freiesProfil() {
  return {
    name: 'Freies Profil', vorlage: null, ueberdeckung: 0, fest: 0, lage: 0, sicht: 1,
    schenkel: [{ l: 100 }], kantungen: [],
  };
}
