// Kantfolge an der Schwenkbiegemaschine Schechtl MBM 310 mit ECT: in welcher Reihenfolge gekantet wird,
// welche Anschlagtiefe und welcher Biegewinkel an der ECT eingestellt werden, wann das Blech gewendet
// oder gedreht wird und wo es an den Wangen eng wird. Festlegungen in PLAN.md (Maschine und Umkantreihenfolge).
//
// An der ECT wird erst der Zuschnitt eingegeben, dann je Kantung Biegewinkel und Anschlagtiefe
// (Leon, 10.10.2026; Schechtl: „Eingabe von Biegewinkel, Tiefenanschlagmaß, Abhubhöhe, Umschlag und Zuschnitt“).
//
// Koordinaten an der Maschine, Schnitt quer zur Biegekante, in mm: Ursprung an der Biegekante, x zeigt in
// die Maschine (unter die Oberwange, zum Tiefenanschlag), y nach oben. Der eingespannte Teil liegt bei x > 0
// auf dem Tisch, der Teil davor (x < 0) wird von der Biegewange nach oben geschwenkt.

import { MASCHINE } from './material.js';

// Wangen nach der Schnittzeichnung im Schechtl-Prospekt „Motor-Schwenkbiegemaschinen“ (Stand 11.2025, S. 24):
// Oberwange 256 mm tief, 278 mm hoch über 22 mm, Vorderseite unter 53°. Datenblatt MBM 310/ECT:
// Scharfschiene 20° R 1 an der Oberwange, Einsatzschienen 10 und 24 mm an der Biegewange.
// Die Kleinmaße der Schienen sind aus der Zeichnung abgegriffen und nur ungefähr.
export const OBERWANGE = [
  { x: 0, y: 0 }, { x: 22, y: 8 }, { x: 26, y: 18 }, { x: 36, y: 22 }, { x: 36, y: 38 }, { x: 64, y: 40 },
  { x: 246, y: 300 }, { x: 256, y: 290 }, { x: 233, y: 257 }, { x: 233, y: 22 }, { x: 67, y: 22 }, { x: 67, y: 0 },
];
export const UNTERWANGE = [{ x: 0, y: 0 }, { x: 67, y: 0 }, { x: 67, y: -24 }, { x: 337, y: -156 }, { x: 0, y: -156 }];
// Biegewange mit 10-mm-Einsatzschiene, im Bezug des Schenkels davor (schwenkt mit ihm)
export const BIEGEWANGE = [{ x: 0, y: 0 }, { x: -10, y: 0 }, { x: -10, y: -40 }, { x: 0, y: -40 }];

export const SCHIENE = 10; // mm, kürzere Schenkel kann die Biegewange nicht fassen
export const ENG = 5; // mm Luft zu einer Wange, darunter gilt der Schritt als eng
const ANSTOSS = 1; // mm, bis hierhin gilt Berühren noch nicht als Anstoßen
export const UMSCHLAG_AB = 150; // Biegewinkel, ab dem mit der Umschlag-Funktion gebogen und zugedrückt wird
export const UMSCHLAG_MAX = 60; // mm: länger darf das Umgeschlagene nicht sein, es muss zum Zudrücken unter die Oberwange
const MAX_KANTUNGEN = 10; // darüber wird nicht mehr jede Reihenfolge durchgerechnet
const SCHRITT_WINKEL = 15; // Grad, in diesen Schritten wird das Hochschwenken geprüft
const PROBE = 2; // mm Abstand der Prüfpunkte auf dem Blech

const RAD = Math.PI / 180;

/** Biegewinkel an der ECT: so weit schwenkt die Biegewange. 90° innen → 90, 135° innen → 45. */
export const biegewinkel = (w) => 180 - w;
export const istUmschlag = (w) => biegewinkel(w) >= UMSCHLAG_AB;

// --- Geometrie ---

function innen(pt, poly) {
  let drin = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) drin = !drin;
  }
  return drin;
}

function abstandZuStrecke(pt, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l2));
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

function abstandZuRand(pt, poly) {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) min = Math.min(min, abstandZuStrecke(pt, poly[j], poly[i]));
  return min;
}

const rahmen = (poly) => ({
  x0: Math.min(...poly.map((p) => p.x)) - ENG, x1: Math.max(...poly.map((p) => p.x)) + ENG,
  y0: Math.min(...poly.map((p) => p.y)) - ENG, y1: Math.max(...poly.map((p) => p.y)) + ENG,
});
const RAHMEN = new Map([OBERWANGE, UNTERWANGE, BIEGEWANGE].map((p) => [p, rahmen(p)]));

/**
 * Wie nah kommt ein Linienzug einer Wange? luft: kleinster Abstand außerhalb, tief: wie weit er hineinragt.
 * Am Anfang des Linienzugs liegt die Biegekante an der Wange, deshalb zählen die ersten ab mm gar nicht und
 * die ersten abLuft mm nicht für die Luft. nurUnten: nur was unter dem Tisch liegt (y < 0).
 */
function pruefe(linie, poly, { ab = 0, abLuft = 0, nurUnten = false } = {}) {
  const r = RAHMEN.get(poly);
  let luft = Infinity;
  let tief = 0;
  let gelaufen = 0;
  for (let i = 0; i < linie.length - 1; i++) {
    const a = linie[i];
    const b = linie[i + 1];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(l / PROBE));
    for (let s = 0; s <= n; s++) {
      const weg = gelaufen + (l * s) / n;
      if (weg < ab) continue;
      const pt = { x: a.x + ((b.x - a.x) * s) / n, y: a.y + ((b.y - a.y) * s) / n };
      if (nurUnten && pt.y > -0.5) continue;
      if (pt.x < r.x0 || pt.x > r.x1 || pt.y < r.y0 || pt.y > r.y1) continue;
      const d = abstandZuRand(pt, poly);
      if (innen(pt, poly)) tief = Math.max(tief, d);
      else if (weg >= abLuft) luft = Math.min(luft, d);
    }
    gelaufen += l;
  }
  return { luft, tief };
}

/**
 * Lage des Profils an der Maschine, wenn Kantung k gebogen wird.
 * fertig: Bitmaske der schon gebogenen Kantungen. seite: welche Kante ('A' oder 'E') am Anschlag liegt.
 * winkel: so weit ist Kantung k gerade hochgeschwenkt.
 * Ergebnis: hinten (eingespannter Teil, von der Biegekante zum Anschlag), vorn (von der Biegekante nach vorn),
 * oben ('Sichtseite' oder 'Rückseite'), anschlag (mm), lasche (gerades Stück vorn, das die Biegewange fasst),
 * laengeVorn und laengeHinten (Summe der Schenkel auf beiden Seiten).
 */
export function lage(p, fertig, k, seite, winkel = 0) {
  const n = p.schenkel.length;
  const vonA = seite === 'A';
  const L = (i) => {
    const s = p.schenkel[vonA ? i : n - 1 - i];
    return s.l > 0 ? s.l : 0;
  };
  // Kantung zwischen Laufstück i und i + 1, wenn man vom Anschlag nach vorn geht
  const kantungNach = (i) => (vonA ? i : n - 2 - i);
  const q = vonA ? k : n - 2 - k;
  const knick = (j) => p.kantungen[j].r * (180 - p.kantungen[j].w);
  // Die Biegewange biegt immer nach oben. Kantet k in Laufrichtung nach links, liegt das Blech gespiegelt.
  const spiegel = (vonA ? p.kantungen[k].r : -p.kantungen[k].r) === -1 ? 1 : -1;
  const dreht = (i) => {
    const j = kantungNach(i);
    if (!(fertig & (1 << j))) return 0;
    return (vonA ? knick(j) : -knick(j)) * spiegel;
  };

  const richtung = new Array(n);
  richtung[q] = 180;
  for (let i = q - 1; i >= 0; i--) richtung[i] = richtung[i + 1] - dreht(i);
  if (q + 1 < n) richtung[q + 1] = 180 - winkel;
  for (let i = q + 1; i < n - 1; i++) richtung[i + 1] = richtung[i] + dreht(i);

  const hinten = [{ x: 0, y: 0 }];
  for (let i = q; i >= 0; i--) {
    const a = hinten[hinten.length - 1];
    hinten.push({ x: a.x - L(i) * Math.cos(richtung[i] * RAD), y: a.y - L(i) * Math.sin(richtung[i] * RAD) });
  }
  const vorn = [{ x: 0, y: 0 }];
  for (let i = q + 1; i < n; i++) {
    const a = vorn[vorn.length - 1];
    vorn.push({ x: a.x + L(i) * Math.cos(richtung[i] * RAD), y: a.y + L(i) * Math.sin(richtung[i] * RAD) });
  }

  // Anschlag: was hinter der Biegekante noch gerade auf dem Tisch liegt, bis zur Kante am Anschlag
  let anschlag = L(q);
  for (let i = q - 1; i >= 0 && !(fertig & (1 << kantungNach(i))); i--) anschlag += L(i);
  let lasche = q + 1 < n ? L(q + 1) : 0;
  for (let i = q + 1; i < n - 1 && !(fertig & (1 << kantungNach(i))); i++) lasche += L(i + 1);

  let laengeHinten = 0;
  for (let i = 0; i <= q; i++) laengeHinten += L(i);
  let laengeVorn = 0;
  for (let i = q + 1; i < n; i++) laengeVorn += L(i);

  // Links der Laufrichtung (nach vorn, also −x) liegt unten
  const sichtLinks = (vonA ? p.sicht : -p.sicht) * spiegel === 1;
  return { hinten, vorn, oben: sichtLinks ? 'Rückseite' : 'Sichtseite', anschlag, lasche, laengeVorn, laengeHinten };
}

// Teil des eingespannten Linienzugs, der nicht flach auf dem Tisch liegt
function hochstehend(hinten) {
  let i = 1;
  while (i < hinten.length - 1 && Math.abs(hinten[i + 1].y) < 0.5 && Math.abs(hinten[i].y) < 0.5) i++;
  return hinten.slice(i);
}

/**
 * Bewertet einen Schritt: Kantung k biegen, seite am Anschlag, fertig schon gebogen.
 * Ergebnis: { geht, grund, status: 'ok' | 'eng' | 'stoesst', luft, oben, anschlag, abhub }
 */
export function bewerte(p, fertig, k, seite) {
  const w = p.kantungen[k].w;
  const ziel = Math.min(biegewinkel(w), UMSCHLAG_AB);
  const start = lage(p, fertig, k, seite, 0);
  const aus = {
    oben: start.oben, anschlag: start.anschlag, abhub: null, luft: Infinity, tief: 0, geht: true, grund: '',
    anteilVorn: start.laengeVorn / Math.max(start.laengeVorn + start.laengeHinten, 1),
  };

  if (start.lasche < SCHIENE - 1e-6) {
    return { ...aus, geht: false, grund: `Vorn nur ${Math.round(start.lasche)} mm, die Biegewange braucht mindestens ${SCHIENE} mm.` };
  }
  if (istUmschlag(w) && start.laengeVorn > UMSCHLAG_MAX) {
    return { ...aus, geht: false, grund: `Zum Umschlagen klappen vorn ${Math.round(start.laengeVorn)} mm um, das passt zum Zudrücken nicht unter die Oberwange.` };
  }
  if (start.anschlag < MASCHINE.anschlagMin || start.anschlag > MASCHINE.anschlagMax) {
    return { ...aus, geht: false, grund: `Anschlagtiefe ${Math.round(start.anschlag)} mm liegt außerhalb ${MASCHINE.anschlagMin}–${MASCHINE.anschlagMax} mm.` };
  }

  // eingespannter Teil: was nicht flach liegt, darf weder in die Oberwange noch in die Unterwange ragen
  const steht = hochstehend(start.hinten);
  const merke = (e) => {
    aus.luft = Math.min(aus.luft, e.luft);
    aus.tief = Math.max(aus.tief, e.tief);
  };
  if (steht.length > 1) {
    // die Ecke, an der das Blech den Tisch verlässt, liegt zwangsläufig nah an den Schienen
    merke(pruefe(steht, OBERWANGE, { abLuft: 10 }));
    merke(pruefe(steht, UNTERWANGE, { abLuft: 10 }));
    const hoch = Math.max(...steht.map((pt) => pt.y));
    if (hoch > 0.5) aus.abhub = Math.ceil((hoch + 10) / 5) * 5;
    if (hoch + 10 > MASCHINE.oeffnung) {
      return { ...aus, geht: false, grund: `Das schon Gekantete steht ${Math.round(hoch)} mm hoch, die Oberwange öffnet nur ${MASCHINE.oeffnung} mm.` };
    }
  }
  // Teil davor: was nach unten hängt, darf nicht in die Biegewange; beim Hochschwenken nicht in die Wangen
  merke(pruefe(start.vorn, BIEGEWANGE, { nurUnten: true }));
  const nahe = { ab: 3, abLuft: 20 };
  for (let wi = SCHRITT_WINKEL; wi < ziel + SCHRITT_WINKEL; wi += SCHRITT_WINKEL) {
    const v = lage(p, fertig, k, seite, Math.min(wi, ziel)).vorn;
    merke(pruefe(v, OBERWANGE, nahe));
    merke(pruefe(v, UNTERWANGE, nahe));
  }
  aus.status = aus.tief > ANSTOSS ? 'stoesst' : aus.luft < ENG || aus.tief > 0 ? 'eng' : 'ok';
  return aus;
}

// --- Reihenfolge ---

// Umlegen zwischen zwei Schritten. Wenden: über die Längsachse rollen, dann liegt die andere Seite oben und
// die andere Kante am Anschlag. Drehen: auf dem Tisch um 180° drehen, andere Kante am Anschlag, gleiche Seite oben.
export function umlegen(vorher, jetzt) {
  if (!vorher) return '';
  const andereKante = vorher.seite !== jetzt.seite;
  const andereSeite = vorher.oben !== jetzt.oben;
  if (andereKante && andereSeite) return 'wenden';
  if (andereKante) return 'drehen';
  if (andereSeite) return 'wenden und drehen';
  return '';
}

const ZUEGE = { '': 0, wenden: 1, drehen: 1, 'wenden und drehen': 2 };
// Bei gleichem Umlegen lieber den kürzeren Teil biegen und den längeren einspannen (höchstens 0,9 je Schritt)
const kosten = (b, zug) => ZUEGE[zug] * 10 + (!b.geht ? 1000 : b.status === 'stoesst' ? 40 : b.status === 'eng' ? 3 : 0)
  + 0.9 * b.anteilVorn;

function schritt(p, k, seite, b, zug, nr) {
  const w = p.kantungen[k].w;
  return {
    nr,
    kantung: k,
    zwischen: [p.schenkel[k].l, p.schenkel[k + 1].l],
    seite,
    oben: b.oben,
    anschlag: Math.round(b.anschlag * 10) / 10,
    biegewinkel: biegewinkel(w),
    umschlag: istUmschlag(w),
    spalt: istUmschlag(w) && w > 0,
    vorher: zug,
    abhub: b.abhub,
    status: b.geht ? b.status : 'geht nicht',
    luft: Number.isFinite(b.luft) ? Math.round(b.luft) : null,
    grund: b.grund,
  };
}

const gueltigeFolge = (f, m) => Array.isArray(f) && f.length === m
  && [...f].sort((a, b) => a - b).every((x, i) => x === i);

/**
 * Plant die Kantfolge. Mit p.kantfolge (Reihenfolge der Kantungen, von Hand gesetzt) wird nur noch je Schritt
 * die bessere Kante am Anschlag gewählt, sonst sucht das Tool die Reihenfolge mit am wenigsten Umlegen.
 * Ergebnis: { schritte, vonHand, umlegen: Anzahl Wenden/Drehen }
 */
export function planeKantfolge(p) {
  const m = p.kantungen.length;
  if (m === 0) return { schritte: [], vonHand: false, umlegen: 0 };
  const cache = new Map();
  const bew = (fertig, k, seite) => {
    const key = `${fertig}|${k}|${seite}`;
    if (!cache.has(key)) cache.set(key, bewerte(p, fertig, k, seite));
    return cache.get(key);
  };
  const vonHand = gueltigeFolge(p.kantfolge, m);

  // Zustand: schon gebogene Kantungen, Kante am Anschlag und Seite oben nach dem letzten Schritt
  let stufe = new Map([['0', { fertig: 0, lage: null, summe: 0, weg: [] }]]);
  for (let nr = 0; nr < m; nr++) {
    const naechste = new Map();
    stufe.forEach((z) => {
      const auswahl = vonHand ? [p.kantfolge[nr]] : [...Array(m).keys()].filter((k) => !(z.fertig & (1 << k)));
      auswahl.forEach((k) => ['A', 'E'].forEach((seite) => {
        const b = bew(z.fertig, k, seite);
        const jetzt = { seite, oben: b.oben };
        const zug = umlegen(z.lage, jetzt);
        const summe = z.summe + kosten(b, zug);
        const fertig = z.fertig | (1 << k);
        const key = `${fertig}|${seite}|${b.oben}`;
        const alt = naechste.get(key);
        if (!alt || summe < alt.summe - 1e-9) {
          naechste.set(key, { fertig, lage: jetzt, summe, weg: [...z.weg, schritt(p, k, seite, b, zug, nr + 1)] });
        }
      }));
    });
    stufe = naechste;
    // Bei vielen Kantungen nur die besten Zwischenstände weiterverfolgen
    if (m > MAX_KANTUNGEN && stufe.size > 400) {
      stufe = new Map([...stufe].sort((a, b) => a[1].summe - b[1].summe).slice(0, 400));
    }
  }
  const beste = [...stufe.values()].sort((a, b) => a.summe - b.summe)[0];
  return {
    schritte: beste.weg,
    vonHand,
    umlegen: beste.weg.reduce((s, x) => s + ZUEGE[x.vorher], 0),
  };
}
