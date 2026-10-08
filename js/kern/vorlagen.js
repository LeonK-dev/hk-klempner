// Vorlagen für die häufigsten Profile.
//
// ACHTUNG: Die Maße sind Startwerte, keine Hausmaße von Hein & Knott. Sie werden noch ersetzt.
// Aufbau wie in profil.js beschrieben. u = Umschlag zugedrückt, o = Umschlag offen / Wasserfalz,
// t = Tropfkante.

import { mitAnker } from './profil.js';

const u = (l = 10) => ({ l, art: 'umschlag_zu' });
const o = (l = 15) => ({ l, art: 'umschlag_offen' });
const t = (l = 20) => ({ l, art: 'tropfkante' });
const s = (l) => ({ l });
const k = (w, r) => ({ w, r });

export const VORLAGEN = [
  // --- Traufe und Ortgang ---
  {
    id: 'traufblech', gruppe: 'Traufe und Ortgang', name: 'Traufblech', ueberdeckung: 100,
    start: -90, sicht: -1,
    schenkel: [u(), s(70), s(170)],
    kantungen: [k(0, 1), k(120, 1)],
  },
  {
    id: 'rinneneinhang', gruppe: 'Traufe und Ortgang', name: 'Rinneneinhang', ueberdeckung: 100,
    start: -30, sicht: 1,
    schenkel: [s(233), s(80), t()],
    kantungen: [k(120, -1), k(135, 1)],
  },
  {
    id: 'ortgangblech', gruppe: 'Traufe und Ortgang', name: 'Ortgangblech', ueberdeckung: 100,
    start: 135, sicht: -1,
    schenkel: [t(), s(110), s(70)],
    kantungen: [k(135, -1), k(90, 1)],
  },
  {
    id: 'lueftungsblech', gruppe: 'Traufe und Ortgang', name: 'Lüftungsblech (Lochblech)', ueberdeckung: 50,
    start: 90, sicht: 1,
    schenkel: [s(40), s(60)],
    kantungen: [k(90, -1)],
  },

  // --- Anschlüsse, First und Kehle ---
  {
    id: 'wandanschluss', gruppe: 'Anschlüsse, First und Kehle', name: 'Wandanschlussblech', ueberdeckung: 100,
    start: -90, sicht: 1,
    schenkel: [s(150), s(120), o()],
    kantungen: [k(90, 1), k(20, 1)],
  },
  {
    id: 'kaminanschluss', gruppe: 'Anschlüsse, First und Kehle', name: 'Kaminanschluss unterliegend', ueberdeckung: 0,
    start: -90, sicht: 1,
    schenkel: [s(150), s(168), o()],
    kantungen: [k(90, 1), k(20, 1)],
  },
  {
    id: 'kappleiste', gruppe: 'Anschlüsse, First und Kehle', name: 'Kappleiste', ueberdeckung: 50,
    start: 0, sicht: 1,
    schenkel: [s(15), s(70), t(15)],
    kantungen: [k(90, -1), k(150, 1)],
  },
  {
    id: 'firstblech', gruppe: 'Anschlüsse, First und Kehle', name: 'Firstblech', ueberdeckung: 100,
    start: -60, sicht: 1,
    schenkel: [u(), s(30), s(160), s(160), s(30), u()],
    kantungen: [k(0, -1), k(90, -1), k(120, -1), k(90, -1), k(0, -1)],
  },
  {
    id: 'pultabschluss', gruppe: 'Anschlüsse, First und Kehle', name: 'Pultabschluss', ueberdeckung: 100,
    start: 225, sicht: 1,
    schenkel: [u(), t(), s(150), s(210), u()],
    kantungen: [k(0, -1), k(135, 1), k(75, -1), k(0, -1)],
  },
  {
    id: 'kehle', gruppe: 'Anschlüsse, First und Kehle', name: 'Kehle', ueberdeckung: 150,
    start: 180, sicht: 1,
    schenkel: [o(), s(235), s(235), o()],
    kantungen: [k(20, 1), k(140, 1), k(20, 1)],
  },

  // --- Abdeckungen und Winkel ---
  {
    id: 'mauerabdeckung', gruppe: 'Abdeckungen und Winkel', name: 'Mauerabdeckung / Attika', ueberdeckung: 0,
    start: 45, sicht: 1,
    schenkel: [t(), s(70), s(320), s(70), t()],
    kantungen: [k(135, 1), k(90, -1), k(90, -1), k(135, 1)],
  },
  {
    id: 'fensterbank', gruppe: 'Abdeckungen und Winkel', name: 'Fensterbank', ueberdeckung: 0,
    start: -90, sicht: 1,
    schenkel: [s(20), s(175), s(40), t(15)],
    kantungen: [k(95, 1), k(95, -1), k(135, 1)],
  },
  {
    id: 'vorstoss', gruppe: 'Abdeckungen und Winkel', name: 'Vorstoßblech', ueberdeckung: 50,
    start: 0, sicht: 1,
    schenkel: [s(102), s(50), t(15)],
    kantungen: [k(90, -1), k(135, 1)],
  },
  {
    id: 'haftstreifen', gruppe: 'Abdeckungen und Winkel', name: 'Haftstreifen', ueberdeckung: 0,
    start: 0, sicht: 1,
    schenkel: [s(70), s(30)],
    kantungen: [k(100, -1)],
  },
  {
    id: 'winkel', gruppe: 'Abdeckungen und Winkel', name: 'Winkel', ueberdeckung: 50,
    start: 90, sicht: 1,
    schenkel: [s(50), s(50)],
    kantungen: [k(90, -1)],
  },
  {
    id: 'z-winkel', gruppe: 'Abdeckungen und Winkel', name: 'Z-Winkel', ueberdeckung: 50,
    start: 0, sicht: 1,
    schenkel: [s(30), s(50), s(30)],
    kantungen: [k(90, 1), k(90, -1)],
  },

  // --- Scharen (Band 670 bzw. 600) ---
  {
    id: 'schar-doppelstehfalz', gruppe: 'Scharen', name: 'Schar Doppelstehfalz', ueberdeckung: 0,
    start: 180, sicht: 1,
    schenkel: [s(10), s(25), s(590), s(26), s(10), s(9)],
    kantungen: [k(90, 1), k(90, 1), k(90, 1), k(90, -1), k(90, -1)],
  },
  {
    id: 'schar-winkelstehfalz', gruppe: 'Scharen', name: 'Schar Winkelstehfalz', ueberdeckung: 0,
    start: 180, sicht: 1,
    schenkel: [s(10), s(25), s(590), s(26), s(10), s(9)],
    kantungen: [k(90, 1), k(90, 1), k(90, 1), k(90, -1), k(90, -1)],
  },
  {
    id: 'schar-leistendeckung', gruppe: 'Scharen', name: 'Schar Leistendeckung', ueberdeckung: 0,
    start: 0, sicht: 1,
    schenkel: [s(10), s(40), s(500), s(40), s(10)],
    kantungen: [k(90, -1), k(90, 1), k(90, 1), k(90, -1)],
  },
  {
    id: 'schar-aufkantung', gruppe: 'Scharen', name: 'Schar nur Aufkantung', ueberdeckung: 0,
    start: -90, sicht: 1,
    schenkel: [s(35), s(590), s(45)],
    kantungen: [k(90, 1), k(90, 1)],
  },
];

// In den Vorlagen steht der Einfachheit halber die Richtung von Schenkel 1 (start).
// Fest ist danach der längste Schenkel, also meist die Fläche, an der man sich orientiert.
export function ausVorlage(v) {
  return mitAnker({
    name: v.name,
    vorlage: v.id,
    ueberdeckung: v.ueberdeckung,
    start: v.start,
    sicht: v.sicht,
    schenkel: v.schenkel.map((x) => ({ ...x })),
    kantungen: v.kantungen.map((x) => ({ ...x })),
  });
}
