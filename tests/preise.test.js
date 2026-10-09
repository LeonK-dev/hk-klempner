// Tests für die Preisdatei und die Materialkosten.

import { materialMit } from '../js/kern/material.js';
import {
  PREISDATEI, alterInTagen, euroJeM2, kosten, lesePreise, preisFuer,
} from '../js/kern/preise.js';
import { plane } from '../js/kern/zuschnittplan.js';
import { gleich, test } from './hilfe.js';

const T2 = { art: 'tafel', b: 1000, l: 2000 };
const T3 = { art: 'tafel', b: 1000, l: 3000 };
const C500 = { art: 'coil', b: 500 };
const zink = materialMit('titanzink');

const datei = (preise, extra = {}) => ({ ...PREISDATEI, stand: '2026-10-09', quelle: 'Test', preise, ...extra });
const eintrag = (format, preis, einheit, extra = {}) => ({
  material: 'titanzink', dicke: 0.7, format, preis, einheit, herkunft: 'Rechnung', ...extra,
});

function fehlerText(fn) {
  try {
    fn();
  } catch (e) {
    return e.message;
  }
  return '';
}

test('Preisdatei: fremde Datei, alte Fassung und leere Datei werden abgelehnt', () => {
  gleich(fehlerText(() => lesePreise({ art: 'etwas anderes' })), 'Das ist keine Preisdatei für HK Klempner.');
  gleich(fehlerText(() => lesePreise(null)), 'Das ist keine Preisdatei für HK Klempner.');
  gleich(fehlerText(() => lesePreise(datei([eintrag('tafel-1000x2000', 5, 'kg')], { version: 99 }))).startsWith('Diese Preisdatei'), true);
  gleich(fehlerText(() => lesePreise(datei([]))), 'In der Preisdatei steht kein Preis.');
  gleich(fehlerText(() => lesePreise(datei([eintrag('tafel-1000x2000', 0, 'kg')]))), 'In der Preisdatei steht kein Preis.');
});

test('Preisdatei: Eintrag wird über Material, Dicke und Format gefunden', () => {
  const p = lesePreise(datei([eintrag('tafel-1000x2000', 5, 'kg'), eintrag('coil-500', 6, 'kg')]));
  gleich(p.stand, '2026-10-09');
  gleich(preisFuer(p, 'titanzink', 0.7, T2).preis, 5);
  gleich(preisFuer(p, 'titanzink', 0.7, C500).preis, 6);
  gleich(preisFuer(p, 'titanzink', 0.8, T2), null, 'andere Dicke');
  gleich(preisFuer(p, 'kupfer', 0.7, T2), null, 'anderes Material');
  gleich(preisFuer(null, 'titanzink', 0.7, T2), null, 'ohne Preisdatei');
});

test('Preis je m²: je kg über das Gewicht, je Tafel über die Fläche, je Meter über die Coilbreite', () => {
  gleich(euroJeM2({ preis: 5, einheit: 'kg' }, zink, 0.7, T2), 5 * 5.04);
  gleich(euroJeM2({ preis: 30, einheit: 'Tafel' }, zink, 0.7, T2), 15);
  gleich(euroJeM2({ preis: 22.5, einheit: 'm²' }, zink, 0.7, T2), 22.5);
  gleich(euroJeM2({ preis: 10, einheit: 'm' }, zink, 0.7, C500), 20);
  gleich(euroJeM2({ preis: 30, einheit: 'Tafel' }, zink, 0.7, C500), null, 'Tafelpreis passt nicht zum Coil');
  gleich(euroJeM2({ preis: 10, einheit: 'm' }, zink, 0.7, T2), null, 'Meterpreis passt nicht zur Tafel');
  // Lochblech: das Gewicht kennt den Anteil ohne Löcher
  gleich(euroJeM2({ preis: 10, einheit: 'kg' }, materialMit('lochblech-alu'), 0.8, T2), 10 * 2.75 * 0.8 * 0.65);
});

test('Kosten: Verbrauch ohne brauchbaren Rest, angebrochen mit Rest', () => {
  // 13 Streifen 250 × 2000: 4 Tafeln, ein Rest 750 × 2000 bleibt brauchbar
  const plan = plane([{ pos: 'P1', b: 250, l: 2000, n: 13 }], [T2]);
  const p = lesePreise(datei([eintrag('tafel-1000x2000', 5, 'kg')]));
  const k = kosten(plan.bleche, zink, 0.7, p);
  const jeM2 = 5 * 5.04;
  gleich(k.fehlt.length, 0);
  gleich(k.gekauft, 8 * jeM2);
  gleich(k.verbrauch, 6.5 * jeM2);
  gleich(k.reste, 1.5 * jeM2);
  gleich(k.basis.length, 1);
  gleich(k.basis[0].eintrag.preis, 5);
});

test('Kosten: jedes Format mit seinem Preis', () => {
  const plan = plane([{ pos: 'P1', b: 500, l: 2000, n: 2 }, { pos: 'P2', b: 500, l: 3000, n: 2 }], [T2, T3]);
  const p = lesePreise(datei([eintrag('tafel-1000x2000', 30, 'Tafel'), eintrag('tafel-1000x3000', 60, 'Tafel')]));
  const k = kosten(plan.bleche, zink, 0.7, p);
  gleich(k.gekauft, 90, 'eine Tafel 2 m und eine Tafel 3 m');
  gleich(k.verbrauch, 90);
  gleich(k.basis.length, 2);
});

test('Kosten: fehlt ein Preis, gibt es keinen Betrag, aber den Namen des Formats', () => {
  const plan = plane([{ pos: 'P1', b: 500, l: 3000, n: 2 }], [T3]);
  const p = lesePreise(datei([eintrag('tafel-1000x2000', 5, 'kg')]));
  const k = kosten(plan.bleche, zink, 0.7, p);
  gleich(k.verbrauch, null);
  gleich(k.gekauft, null);
  gleich(k.fehlt.length, 1);
  gleich(k.fehlt[0].l, 3000);
});

test('Preisdatei: Alter in Tagen', () => {
  const p = lesePreise(datei([eintrag('tafel-1000x2000', 5, 'kg')]));
  gleich(alterInTagen(p, new Date(2026, 9, 9)), 0);
  gleich(alterInTagen(p, new Date(2027, 0, 7)), 90);
  gleich(alterInTagen({ stand: 'irgendwann' }), null);
});

test('Material: altes Folienblech wird zu Sikaplan, Titanzink bleibt walzblank', () => {
  gleich(materialMit('folienblech').id, 'folienblech-sika');
  gleich(materialMit('titanzink').name, 'Titanzink walzblank');
  gleich(materialMit('titanzink-vorbewittert').dichte, 7.2);
});
