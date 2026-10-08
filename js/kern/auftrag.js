// Auftrag: aus Positionen (Profil, Material, Menge) werden Stücke und je Material ein Zuschnittplan.
//
// Position: { id, profil, material: Material-ID, dicke, menge }
// menge:    { art: 'stueck', anzahl, laenge }  oder  { art: 'lfm', meter, ueberdeckung }

import { zuschnitt } from './profil.js';
import { MASCHINE, formatSchluessel, gewicht, materialMit } from './material.js';
import { besser, plane } from './zuschnittplan.js';

export const STUECKLAENGEN = [2000, 3000]; // zwischen diesen wählt das Tool bei laufenden Metern
const RASTER = 50; // mm, das letzte Stück wird auf dieses Maß aufgerundet
const VERSUCHE_MAX = 64; // so viele Kombinationen von Stücklängen werden höchstens durchgerechnet

const auf = (x, raster) => Math.ceil((x - 1e-6) / raster) * raster;

/**
 * Stücke für eine Menge: [{ l, n }]
 * Bei laufenden Metern überdecken sich die Stücke am Stoß, das letzte wird kürzer.
 */
export function stuecke(menge, stuecklaenge) {
  if (menge.art === 'stueck') {
    return menge.anzahl > 0 && menge.laenge > 0 ? [{ l: menge.laenge, n: Math.round(menge.anzahl) }] : [];
  }
  const strecke = menge.meter * 1000;
  const ue = menge.ueberdeckung > 0 ? menge.ueberdeckung : 0;
  if (!(strecke > 0) || !(stuecklaenge > ue)) return [];
  if (strecke <= stuecklaenge) return [{ l: Math.min(auf(strecke, 10), stuecklaenge), n: 1 }];
  const anzahl = Math.ceil((strecke - ue - 1e-6) / (stuecklaenge - ue));
  let letztes = auf(strecke - (anzahl - 1) * (stuecklaenge - ue), RASTER);
  if (letztes >= stuecklaenge - 2 * RASTER) letztes = stuecklaenge; // fast volle Länge: gleich voll lassen
  if (letztes === stuecklaenge) return [{ l: stuecklaenge, n: anzahl }];
  return [{ l: stuecklaenge, n: anzahl - 1 }, { l: letztes, n: 1 }];
}

export const gruppenSchluessel = (p) => `${p.material}|${p.dicke}`;

/** Fasst Positionen nach Material und Dicke zusammen und nummeriert sie P1, P2 … */
export function gruppen(positionen) {
  const map = new Map();
  positionen.forEach((p, i) => {
    const k = gruppenSchluessel(p);
    if (!map.has(k)) map.set(k, { schluessel: k, material: materialMit(p.material), dicke: p.dicke, positionen: [] });
    map.get(k).positionen.push({ ...p, pos: `P${i + 1}` });
  });
  return [...map.values()];
}

// alle Kombinationen, höchstens VERSUCHE_MAX
function kombinationen(listen) {
  let aus = [[]];
  listen.forEach((liste) => {
    const neu = [];
    aus.forEach((bisher) => liste.forEach((x) => {
      if (neu.length < VERSUCHE_MAX) neu.push([...bisher, x]);
    }));
    aus = neu;
  });
  return aus;
}

/**
 * Plant eine Gruppe (ein Material, eine Dicke).
 * formateAus: Schlüssel der Formate, die nicht vorhanden sind.
 * Ergebnis: { plan, stuecke: { P1: [{l, n}] }, laengen: { P1: gewählte Stücklänge }, formate, flaechen in m², kg }
 */
export function planeGruppe(gruppe, formateAus = []) {
  const formate = gruppe.material.formate.filter((f) => !formateAus.includes(formatSchluessel(f)));
  const lmax = MASCHINE.laenge;
  const laengste = Math.max(0, ...formate.map((f) => (f.art === 'coil' ? lmax : f.l)));
  const moegliche = STUECKLAENGEN.filter((s) => s <= Math.min(laengste, lmax));
  const wahl = gruppe.positionen.map((p) => (p.menge.art === 'lfm' && moegliche.length ? moegliche : [0]));

  let beste = null;
  kombinationen(wahl).forEach((laengen) => {
    const teile = [];
    const jePos = {};
    gruppe.positionen.forEach((p, i) => {
      const liste = stuecke(p.menge, laengen[i]);
      jePos[p.pos] = liste;
      const b = zuschnitt(p.profil);
      liste.forEach((s) => teile.push({ pos: p.pos, b, l: s.l, n: s.n }));
    });
    const plan = plane(teile, formate, lmax);
    const kandidat = { plan, stuecke: jePos, laengen: Object.fromEntries(gruppe.positionen.map((p, i) => [p.pos, laengen[i]])) };
    if (!beste
      || (plan.moeglich && !beste.plan.moeglich)
      || (plan.moeglich === beste.plan.moeglich && besser(plan.summen, beste.plan.summen))) beste = kandidat;
  });

  const m2 = (mm2) => mm2 / 1e6;
  const s = beste.plan.summen;
  return {
    ...beste,
    formate,
    gekauftM2: m2(s.gekauft),
    verbrauchM2: m2(s.verbrauch),
    genutztM2: m2(s.genutzt),
    verschnittM2: m2(s.verschnitt),
    verschnittProzent: s.verbrauch > 0 ? (s.verschnitt / s.verbrauch) * 100 : 0,
    verbrauchKg: gewicht(gruppe.material, gruppe.dicke, m2(s.verbrauch)),
  };
}
