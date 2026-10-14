// Tests für die Kantfolge an der MBM 310.

import {
  biegewinkel, istUmschlag, planeKantfolge, umlegen,
} from '../js/kern/kantfolge.js';
import { normalisiert } from '../js/kern/profil.js';
import { ausVorlage, VORLAGEN } from '../js/kern/vorlagen.js';
import { gleich, test } from './hilfe.js';

const vorlage = (id) => ausVorlage(VORLAGEN.find((v) => v.id === id));
const profil = (schenkel, kantungen, extra = {}) => normalisiert({
  name: 'Test', sicht: 1, fest: 0, lage: 0,
  schenkel: schenkel.map((l) => ({ l })), kantungen: kantungen.map(([w, r]) => ({ w, r })), ...extra,
});

test('Kantfolge: Biegewinkel an der ECT ist 180 minus Innenwinkel, Umschlag ab 150', () => {
  gleich(biegewinkel(90), 90);
  gleich(biegewinkel(135), 45);
  gleich(istUmschlag(0), true);
  gleich(istUmschlag(20), true, 'Wasserfalz');
  gleich(istUmschlag(45), false, 'Rückkantung');
});

test('Kantfolge: Winkel 50/50 in einem Schritt, 50 mm Anschlag', () => {
  const { schritte } = planeKantfolge(vorlage('winkel'));
  gleich(schritte.length, 1);
  gleich(schritte[0].biegewinkel, 90);
  gleich(schritte[0].anschlag, 50);
  gleich(schritte[0].status, 'ok');
  gleich(schritte[0].vorher, '');
});

test('Kantfolge: Traufblech erst Umschlag, dann 55°, ohne Umlegen', () => {
  const r = planeKantfolge(vorlage('traufblech'));
  gleich(r.umlegen, 0);
  gleich(r.schritte[0].kantung, 0);
  gleich(r.schritte[0].umschlag, true);
  gleich(r.schritte[0].anschlag, 240, 'Zuschnitt 250 minus Umschlag 10');
  gleich(r.schritte[1].biegewinkel, 55);
  gleich(r.schritte[1].anschlag, 190);
  gleich(r.schritte[1].seite, r.schritte[0].seite);
});

test('Kantfolge: Z-Winkel braucht einmal Wenden', () => {
  const r = planeKantfolge(vorlage('z-winkel'));
  gleich(r.umlegen, 1);
  gleich(r.schritte[1].vorher, 'wenden');
  gleich(r.schritte[0].oben === r.schritte[1].oben, false, 'nach dem Wenden liegt die andere Seite oben');
});

test('Kantfolge: enges tiefes U stößt an der Oberwange an, breites nicht', () => {
  const eng = planeKantfolge(profil([150, 60, 150], [[90, 1], [90, 1]]));
  gleich(eng.schritte.some((s) => s.status === 'stoesst'), true);
  const breit = planeKantfolge(profil([50, 300, 50], [[90, 1], [90, 1]]));
  gleich(breit.schritte.every((s) => s.status === 'ok'), true);
});

test('Kantfolge: über 750 mm Anschlag kommt die andere Kante an den Anschlag', () => {
  const { schritte } = planeKantfolge(profil([30, 800], [[90, 1]]));
  gleich(schritte[0].anschlag, 30);
});

test('Kantfolge: zu kurze Schenkel auf beiden Seiten gehen nicht', () => {
  // 5 mm einspannen geht nicht (Anschlag ab 6), 5 mm vorn fasst die 10-mm-Schiene nicht
  const { schritte } = planeKantfolge(profil([5, 100], [[90, 1]]));
  gleich(schritte[0].status, 'geht nicht');
  gleich(schritte[0].grund.length > 0, true);
});

test('Kantfolge: Umschlag nur mit dem langen Teil eingespannt', () => {
  const { schritte } = planeKantfolge(vorlage('pultabschluss'));
  const umschlaege = schritte.filter((s) => s.umschlag);
  gleich(umschlaege.length, 2);
  gleich(umschlaege.every((s) => s.anschlag > 300), true);
  gleich(schritte.every((s) => s.status !== 'geht nicht'), true);
});

test('Kantfolge: Reihenfolge von Hand wird eingehalten, ungültige nicht', () => {
  const z = (kantfolge) => profil([30, 50, 30], [[90, 1], [90, -1]], { kantfolge });
  const hand = planeKantfolge(z([1, 0]));
  gleich(hand.vonHand, true);
  gleich(hand.schritte[0].kantung, 1);
  gleich(z([0, 0]).kantfolge, undefined, 'normalisiert verwirft die doppelte Kantung');
  gleich(planeKantfolge({ ...z(), kantfolge: [0, 0] }).vonHand, false);
});

test('Kantfolge: Umlegen zwischen zwei Schritten', () => {
  const a = { seite: 'A', oben: 'Sichtseite' };
  gleich(umlegen(null, a), '');
  gleich(umlegen(a, { seite: 'A', oben: 'Sichtseite' }), '');
  gleich(umlegen(a, { seite: 'E', oben: 'Rückseite' }), 'wenden');
  gleich(umlegen(a, { seite: 'E', oben: 'Sichtseite' }), 'drehen');
  gleich(umlegen(a, { seite: 'A', oben: 'Rückseite' }), 'wenden und drehen');
});

test('Kantfolge: jede Vorlage hat eine Folge, in der jede Kantung genau einmal vorkommt', () => {
  VORLAGEN.forEach((v) => {
    const p = ausVorlage(v);
    const { schritte } = planeKantfolge(p);
    gleich(schritte.length, p.kantungen.length, v.name);
    gleich(new Set(schritte.map((s) => s.kantung)).size, p.kantungen.length, v.name);
  });
});
