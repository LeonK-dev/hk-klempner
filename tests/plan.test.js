// Tests für Material, Mengen und Zuschnittplan.

import { gruppen, planeGruppe, stuecke } from '../js/kern/auftrag.js';
import { dickenHinweis, gewicht, materialMit } from '../js/kern/material.js';
import { ausVorlage, VORLAGEN } from '../js/kern/vorlagen.js';
import { gleicheZusammen, plane } from '../js/kern/zuschnittplan.js';
import { gleich, test } from './hilfe.js';

const T2 = { art: 'tafel', b: 1000, l: 2000 };
const T3 = { art: 'tafel', b: 1000, l: 3000 };
const C1000 = { art: 'coil', b: 1000 };
const C600 = { art: 'coil', b: 600 };
const C500 = { art: 'coil', b: 500 };
const m2 = (mm2) => mm2 / 1e6;

// --- Zuschnittplan ---

test('Plan: 12 Streifen 250 × 2000 brauchen 3 Tafeln ohne Verschnitt', () => {
  const p = plane([{ pos: 'P1', b: 250, l: 2000, n: 12 }], [T2]);
  gleich(p.moeglich, true);
  gleich(p.bleche.length, 3);
  gleich(p.summen.verschnitt, 0);
  const g = gleicheZusammen(p.bleche);
  gleich(g.length, 1, 'gleiche Tafeln zusammengefasst');
  gleich(g[0].anzahl, 3);
});

test('Plan: der 13. Streifen bricht eine Tafel an, der Rest bleibt brauchbar', () => {
  const p = plane([{ pos: 'P1', b: 250, l: 2000, n: 13 }], [T2]);
  gleich(p.bleche.length, 4);
  gleich(p.summen.verschnitt, 0);
  gleich(p.summen.reste.length, 1);
  gleich(p.summen.reste[0].b, 750);
  gleich(p.summen.reste[0].l, 2000);
});

test('Plan: 3 × 333 lassen 1 mm Verschnitt', () => {
  const p = plane([{ pos: 'P1', b: 333, l: 2000, n: 3 }], [T2]);
  gleich(p.bleche.length, 1);
  gleich(p.summen.verschnitt, 2000);
});

test('Plan: kurze Teile teilen sich einen Streifen', () => {
  const p = plane([{ pos: 'P1', b: 250, l: 1000, n: 4 }], [T2]);
  gleich(p.bleche.length, 1);
  gleich(p.bleche[0].streifen.length, 2);
  gleich(p.bleche[0].frei, 500);
});

test('Plan: zu breites Teil wird gemeldet', () => {
  const p = plane([{ pos: 'P1', b: 250, l: 2000, n: 1 }, { pos: 'P2', b: 1100, l: 2000, n: 1 }], [T2, C1000]);
  gleich(p.moeglich, false);
  gleich(p.passtNicht.join(), 'P2');
});

test('Plan: 3-m-Stücke gehen aufs Coil, wenn nur 2-m-Tafeln da sind', () => {
  const p = plane([{ pos: 'P1', b: 500, l: 3000, n: 2 }], [T2, C1000]);
  gleich(p.moeglich, true);
  gleich(p.bleche.length, 1);
  gleich(p.bleche[0].format.art, 'coil');
  gleich(p.bleche[0].l, 3000);
  gleich(p.summen.verschnitt, 0);
});

test('Plan: kurzes Teil kommt quer in den Rest und spart eine Tafel', () => {
  const p = plane([{ pos: 'P1', b: 400, l: 2000, n: 2 }, { pos: 'P2', b: 500, l: 150, n: 1 }], [T2]);
  gleich(p.bleche.length, 1);
  const quer = p.bleche[0].streifen.filter((s) => s.quer);
  gleich(quer.length, 1);
  gleich(quer[0].b, 150, 'Querstreifen so breit wie das Teil lang ist');
  gleich(quer[0].belegt, 500);
});

test('Plan: bei gleichem Verbrauch gewinnen weniger angebrochene Bleche', () => {
  const p = plane([{ pos: 'P1', b: 500, l: 2000, n: 6 }], [C500, T2]);
  gleich(p.bleche.length, 3);
  gleich(p.bleche[0].format.art, 'tafel');
});

test('Plan: schmales Coil gewinnt, wenn es weniger Material bindet', () => {
  const p = plane([{ pos: 'P1', b: 600, l: 2000, n: 3 }], [T2, C600]);
  gleich(p.bleche.length, 3);
  gleich(p.bleche[0].format.b, 600);
  gleich(m2(p.summen.gekauft), 3.6);
});

test('Plan: Tafel mit brauchbarem Rest schlägt Coil mit Verschnitt', () => {
  const p = plane([{ pos: 'P1', b: 525, l: 2000, n: 3 }], [T2, C600]);
  gleich(p.bleche[0].format.art, 'tafel');
  gleich(p.summen.verschnitt, 0);
  gleich(p.summen.reste.length, 3);
  gleich(p.summen.reste[0].b, 475);
});

test('Plan: gemischte Breiten füllen die Tafel', () => {
  const p = plane([
    { pos: 'P1', b: 500, l: 2000, n: 2 },
    { pos: 'P2', b: 333, l: 2000, n: 3 },
  ], [T2]);
  gleich(p.bleche.length, 2);
});

test('Plan: lange Teile auf 3-m-Tafel, kurze auf 2-m-Tafel', () => {
  const p = plane([{ pos: 'P1', b: 250, l: 3000, n: 8 }, { pos: 'P1', b: 250, l: 300, n: 1 }], [T2, T3]);
  gleich(p.bleche.length, 3);
  gleich(p.bleche.filter((o) => o.l === 3000).length, 2);
  gleich(p.bleche.filter((o) => o.l === 2000).length, 1);
  gleich(m2(p.summen.verbrauch), 6.075);
});

test('Plan: leerer Auftrag ergibt leeren Plan', () => {
  const p = plane([], [T2]);
  gleich(p.moeglich, true);
  gleich(p.bleche.length, 0);
});

// --- Mengen ---

test('Stück × Länge wird unverändert übernommen', () => {
  const s = stuecke({ art: 'stueck', anzahl: 12, laenge: 2000 }, 0);
  gleich(s.length, 1);
  gleich(s[0].n, 12);
  gleich(s[0].l, 2000);
});

test('Laufende Meter: 23,5 m mit 100 mm Überdeckung in 2-m-Stücken', () => {
  const s = stuecke({ art: 'lfm', meter: 23.5, ueberdeckung: 100 }, 2000);
  gleich(s[0].n, 12);
  gleich(s[0].l, 2000);
  gleich(s[1].n, 1);
  gleich(s[1].l, 700);
});

test('Laufende Meter: 23,5 m in 3-m-Stücken', () => {
  const s = stuecke({ art: 'lfm', meter: 23.5, ueberdeckung: 100 }, 3000);
  gleich(s[0].n, 8);
  gleich(s[1].l, 300);
});

test('Laufende Meter: geht es genau auf, gibt es kein kurzes Stück', () => {
  const s = stuecke({ art: 'lfm', meter: 3.9, ueberdeckung: 100 }, 2000);
  gleich(s.length, 1);
  gleich(s[0].n, 2);
});

test('Laufende Meter: kurze Strecke ergibt ein Stück', () => {
  const s = stuecke({ art: 'lfm', meter: 1.234, ueberdeckung: 100 }, 2000);
  gleich(s.length, 1);
  gleich(s[0].l, 1240);
});

test('Laufende Meter: fast volles letztes Stück bleibt voll', () => {
  const s = stuecke({ art: 'lfm', meter: 3.85, ueberdeckung: 100 }, 2000);
  gleich(s.length, 1);
  gleich(s[0].n, 2);
  gleich(s[0].l, 2000);
});

// --- Auftrag ---

const position = (id, vorlagenId, material, dicke, menge) => ({
  id, profil: ausVorlage(VORLAGEN.find((v) => v.id === vorlagenId)), material, dicke, menge,
});

test('Gruppen trennen nach Material und Dicke und nummerieren durch', () => {
  const g = gruppen([
    position('a', 'traufblech', 'titanzink', 0.7, { art: 'stueck', anzahl: 4, laenge: 2000 }),
    position('b', 'kehle', 'kupfer', 0.7, { art: 'stueck', anzahl: 1, laenge: 2000 }),
    position('c', 'winkel', 'titanzink', 0.7, { art: 'stueck', anzahl: 2, laenge: 2000 }),
  ]);
  gleich(g.length, 2);
  gleich(g[0].positionen.map((p) => p.pos).join(), 'P1,P3');
  gleich(g[1].positionen[0].pos, 'P2');
});

test('Auftrag: bei laufenden Metern wählt das Tool die sparsamere Stücklänge', () => {
  const [g] = gruppen([position('a', 'traufblech', 'titanzink', 0.7, { art: 'lfm', meter: 23.5, ueberdeckung: 100 })]);
  const r = planeGruppe(g);
  gleich(r.plan.moeglich, true);
  gleich(r.laengen.P1, 3000);
  // 4 Abschnitte 3 m vom 500er Coil für 8 Streifen, dazu 300 mm für das kurze Stück
  gleich(r.plan.bleche.every((o) => o.format.art === 'coil' && o.format.b === 500), true, 'alles vom 500er Coil');
  gleich(r.plan.bleche.length, 5);
  gleich(r.verbrauchM2, 6.15);
  gleich(Math.round(r.verschnittM2 * 1000) / 1000, 0.075);
});

test('Auftrag: nur mit Tafeln kommt das kurze Stück auf eine 2-m-Tafel', () => {
  const [g] = gruppen([position('a', 'traufblech', 'titanzink', 0.7, { art: 'lfm', meter: 23.5, ueberdeckung: 100 })]);
  const r = planeGruppe(g, ['coil-1000', 'coil-670', 'coil-600', 'coil-500', 'coil-400']);
  gleich(r.laengen.P1, 3000);
  gleich(r.plan.bleche.filter((o) => o.l === 3000).length, 2);
  gleich(r.plan.bleche.filter((o) => o.l === 2000).length, 1);
  gleich(r.verschnittM2, 0);
});

test('Auftrag: abgewählte Formate werden nicht benutzt', () => {
  const [g] = gruppen([position('a', 'traufblech', 'titanzink', 0.7, { art: 'lfm', meter: 23.5, ueberdeckung: 100 })]);
  const r = planeGruppe(g, ['tafel-1000x3000', 'coil-1000', 'coil-670', 'coil-600', 'coil-500', 'coil-400']);
  gleich(r.laengen.P1, 2000);
  gleich(r.plan.bleche.every((o) => o.l === 2000), true);
});

test('Auftrag: Gewicht stimmt mit der Tafelangabe überein', () => {
  gleich(gewicht(materialMit('titanzink'), 0.7, 2), 10.08);
  gleich(Math.round(gewicht(materialMit('kupfer'), 0.7, 2) * 100) / 100, 12.46);
});

test('Maschinengrenze: zu dickes Blech wird gemeldet', () => {
  gleich(dickenHinweis(materialMit('titanzink'), 0.7), null);
  gleich(typeof dickenHinweis(materialMit('edelstahl'), 0.8), 'string');
});
