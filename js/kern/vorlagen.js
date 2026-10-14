// Vorlagen für die häufigsten Profile.
//
// ACHTUNG: Die Maße sind Startwerte, keine Hausmaße von Hein & Knott. Am 14.10.2026 mit einer Recherche
// abgeglichen (Fachregel Metallarbeiten, Klempnerfachregeln, DIN 18339, Flachdachrichtlinie, Datenblätter
// von Rheinzink, SAREI und alwitra, Quellen in PLAN.md). regel nennt die wichtigsten Grenzwerte dazu.
// Aufbau wie in profil.js beschrieben. u = Umschlag zugedrückt, o = Umschlag offen / Wasserfalz,
// t = Tropfkante, rk = Rückkantung. Winkel an der Dachneigung gelten für die genannte Neigung.

import { mitAnker } from './profil.js';

const u = (l = 10) => ({ l, art: 'umschlag_zu' });
const o = (l = 15) => ({ l, art: 'umschlag_offen' });
const t = (l = 20) => ({ l, art: 'tropfkante' });
const rk = (l = 15) => ({ l, art: 'rueckkantung' });
const s = (l) => ({ l });
const k = (w, r) => ({ w, r });

// Wiederkehrende Grenzwerte
const ABKANTUNG = 'Abkantung unter Oberkante Bauteil ≥ 50 mm bis 8 m Gebäudehöhe, ≥ 80 mm bis 20 m, ≥ 100 mm darüber.';
const TROPFABSTAND = 'Tropfkante ≥ 20 mm vor dem Bauteil, vor Putz oder WDVS ≥ 40 mm.';
const UEBERDECKUNG = 'Die Deckung überdeckt ≥ 100 mm ab 22° Dachneigung, ≥ 150 mm darunter, ≥ 200 mm unter 15°.';
const ANSCHLUSS_FLACH = 'Anschlusshöhe über Belag ≥ 150 mm bis 5° Dachneigung, ≥ 100 mm darüber (Flachdachrichtlinie 4.3).';

export const VORLAGEN = [
  // --- Traufe und Ortgang ---
  {
    id: 'traufblech', gruppe: 'Traufe und Ortgang', name: 'Traufblech', ueberdeckung: 100,
    start: -90, sicht: -1,
    schenkel: [u(), s(50), s(190)],
    kantungen: [k(0, 1), k(125, 1)],
    regel: `${UEBERDECKUNG} Stöße 50 mm (ab 22°) bzw. 100 mm überlappen. Titanzink bis 250 mm Zuschnitt 0,7 mm, `
      + 'darüber 0,8 mm. Maße wie Rheinzink-Traufstreifen, Nenngröße 250.',
  },
  {
    id: 'tropfblech', gruppe: 'Traufe und Ortgang', name: 'Tropfblech (Unterdeckbahn)', ueberdeckung: 100,
    start: 135, sicht: -1,
    schenkel: [t(15), s(25), s(127)],
    kantungen: [k(135, -1), k(125, 1)],
    regel: 'Führt die Unterdeckbahn an der Traufe in die Rinne. Maße wie Rheinzink-Tropfblech, Zuschnitt 167. '
      + 'Winkel an die Dachneigung anpassen.',
  },
  {
    id: 'rinneneinhang', gruppe: 'Traufe und Ortgang', name: 'Rinneneinhang', ueberdeckung: 100,
    start: -30, sicht: 1,
    schenkel: [s(150), s(85), t(15)],
    kantungen: [k(115, -1), k(135, 1)],
    regel: 'Nötig, wenn die Deckung weniger als 50 mm über die Rinne ragt. Rinnenrücken ≥ 8 mm höher als die '
      + 'Vorderkante. Maße wie SAREI-Rinneneinhang, Zuschnitt 250 (auch 168 und 200).',
  },
  {
    id: 'rinneneinhang-wf', gruppe: 'Traufe und Ortgang', name: 'Rinneneinhang mit Wasserfalz', ueberdeckung: 100,
    start: 170, sicht: 1,
    schenkel: [o(15), s(135), s(85), t(15)],
    kantungen: [k(20, 1), k(115, -1), k(135, 1)],
    regel: 'Wie der Rinneneinhang, oben mit Wasserfalz ≥ 15 mm gegen Rückstau.',
  },
  {
    id: 'ortgangblech', gruppe: 'Traufe und Ortgang', name: 'Ortgangblech', ueberdeckung: 100,
    start: 135, sicht: -1,
    schenkel: [t(), s(110), s(70)],
    kantungen: [k(135, -1), k(90, 1)],
    regel: `${ABKANTUNG} ${TROPFABSTAND} Dachseitig wie ein seitlicher Anschluss (Fachregel Metallarbeiten 6.3.1).`,
  },
  {
    id: 'ortblech-wf', gruppe: 'Traufe und Ortgang', name: 'Ortblech mit Wasserfalz (Dachrand)', ueberdeckung: 100,
    start: 135, sicht: -1,
    schenkel: [t(15), s(85), s(25), s(60), o(15)],
    kantungen: [k(135, -1), k(0, 1), k(90, -1), k(20, -1)],
    regel: `Doppelt gelegte Aufkantung 25 mm über der Dachfläche. ${ABKANTUNG} ${TROPFABSTAND} `
      + 'Maße wie SAREI-Ortblech mit Wasserfalz, Zuschnitt 200 (250: 15 · 104 · 35 · 80 · 15).',
  },
  {
    id: 'lueftungsblech', gruppe: 'Traufe und Ortgang', name: 'Lüftungsblech (Lochblech)', ueberdeckung: 50,
    start: 90, sicht: 1,
    schenkel: [s(70), s(25)],
    kantungen: [k(90, -1)],
    regel: 'Aus Lochblech. Maße wie das handelsübliche Lochblechprofil 70/25.',
  },

  // --- Anschlüsse, First und Kehle ---
  {
    id: 'wandanschluss', gruppe: 'Anschlüsse, First und Kehle', name: 'Wandanschlussblech', ueberdeckung: 100,
    start: -90, sicht: 1,
    schenkel: [s(160), s(155), o(18)],
    kantungen: [k(90, 1), k(20, 1)],
    regel: 'Anschlusshöhe über Oberkante Deckung: seitlich ≥ 80 mm ab 22° Dachneigung, ≥ 100 mm darunter, '
      + '≥ 150 mm unter 5°. Wasserfalz ≥ 15 mm, freier Wasserlauf ≥ 40 mm. Einteilig bis 3 m Länge.',
  },
  {
    id: 'kaminanschluss', gruppe: 'Anschlüsse, First und Kehle', name: 'Kaminanschluss unterliegend', ueberdeckung: 0,
    start: -90, sicht: 1,
    schenkel: [s(150), s(168), o()],
    kantungen: [k(90, 1), k(20, 1)],
    regel: 'Seitenteil: Höhe wie beim seitlichen Anschluss (≥ 80 mm ab 22°, sonst ≥ 100 mm), Wasserfalz ≥ 15 mm.',
  },
  {
    id: 'kamin-brustblech', gruppe: 'Anschlüsse, First und Kehle', name: 'Kamin Brustblech', ueberdeckung: 0,
    start: -90, sicht: 1,
    schenkel: [s(150), s(173), u()],
    kantungen: [k(120, 1), k(0, -1)],
    regel: `Traufseitig ≥ 80 mm (ab 22°) bzw. ≥ 100 mm Anschlusshöhe. ${UEBERDECKUNG.replace('Die Deckung überdeckt', 'Überdeckt die Deckung')} `
      + 'Winkel = 90° + Dachneigung, hier für 30°.',
  },
  {
    id: 'kamin-nackenkehle', gruppe: 'Anschlüsse, First und Kehle', name: 'Kamin Nackenkehle', ueberdeckung: 0,
    start: -90, sicht: 1,
    schenkel: [s(180), s(202), o(18)],
    kantungen: [k(60, 1), k(20, 1)],
    regel: 'Firstseitig immer ≥ 150 mm Anschlusshöhe. Die Ziegel überdecken ≥ 150 mm, unter 15° ≥ 200 mm. '
      + 'Ab etwa 1 m Breite Sattel oder Keil. Winkel = 90° − Dachneigung, hier für 30°.',
  },
  {
    id: 'kappleiste', gruppe: 'Anschlüsse, First und Kehle', name: 'Kappleiste', ueberdeckung: 50,
    start: 0, sicht: 1,
    schenkel: [s(15), s(70), t(15)],
    kantungen: [k(90, -1), k(150, 1)],
    regel: 'Aufgesetzt, oben mit Dichtstofffuge. Überdeckt das Anschlussblech ≥ 40 mm. Befestigung alle ≤ 250 mm.',
  },
  {
    id: 'ueberhangstreifen', gruppe: 'Anschlüsse, First und Kehle', name: 'Überhangstreifen eingelassen', ueberdeckung: 50,
    start: 225, sicht: 1,
    schenkel: [rk(10), s(25), s(75), t(15)],
    kantungen: [k(45, 1), k(90, -1), k(135, 1)],
    regel: 'In die Fuge eingelassen ≥ 20 mm tief mit Rückkantung, überdeckt das Anschlussblech ≥ 40 mm '
      + '(Fachregel Metallarbeiten 5.6).',
  },
  {
    id: 'firstblech', gruppe: 'Anschlüsse, First und Kehle', name: 'Firstblech', ueberdeckung: 100,
    start: -60, sicht: 1,
    schenkel: [u(), s(30), s(160), s(160), s(30), u()],
    kantungen: [k(0, -1), k(90, -1), k(120, -1), k(90, -1), k(0, -1)],
    regel: 'Mittelwinkel = 180° − 2 × Dachneigung, hier für 30°.',
  },
  {
    id: 'pultabschluss', gruppe: 'Anschlüsse, First und Kehle', name: 'Pultabschluss', ueberdeckung: 100,
    start: 225, sicht: 1,
    schenkel: [u(), t(), s(150), s(210), u()],
    kantungen: [k(0, -1), k(135, 1), k(75, -1), k(0, -1)],
    regel: `Dachwinkel = 90° − Dachneigung, hier für 15°. ${ABKANTUNG} ${TROPFABSTAND}`,
  },
  {
    id: 'kehle', gruppe: 'Anschlüsse, First und Kehle', name: 'Kehle', ueberdeckung: 150,
    start: 180, sicht: 1,
    schenkel: [o(), s(235), s(235), o()],
    kantungen: [k(20, 1), k(140, 1), k(20, 1)],
    regel: `Zuschnitt ≥ 400 mm, Wasserfalz ≥ 15 mm. ${UEBERDECKUNG} Kehlbleche überlappen 100 mm ab 22°, `
      + '150 mm darunter, unter 15° wasserdicht verbinden.',
  },

  // --- Abdeckungen und Winkel ---
  {
    id: 'mauerabdeckung', gruppe: 'Abdeckungen und Winkel', name: 'Mauerabdeckung / Attika', ueberdeckung: 0,
    start: 45, sicht: 1,
    schenkel: [t(), s(70), s(320), s(70), t()],
    kantungen: [k(135, 1), k(90, -1), k(90, -1), k(135, 1)],
    regel: `${ABKANTUNG} ${TROPFABSTAND} Gefälle zur Dachseite ≥ 3° (Rheinzink). Stücke ≤ 3 m, `
      + 'Bewegungsausgleich spätestens alle 8 m.',
  },
  {
    id: 'fensterbank', gruppe: 'Abdeckungen und Winkel', name: 'Fensterbank', ueberdeckung: 0,
    start: 90, sicht: 1,
    schenkel: [u(), s(28), s(250), s(30), rk(15)],
    kantungen: [k(0, 1), k(95, 1), k(95, -1), k(45, -1)],
    regel: `Gefälle ≥ 5° (RAL-Leitfaden), hier 5°. Aufkantung an Rahmen und Laibung ≥ 20 mm. ${TROPFABSTAND} `
      + 'Vorn mit der Rückkantung in den Haftstreifen eingehängt (Haftstreifen ≥ 1,0 mm).',
  },
  {
    id: 'vorstoss', gruppe: 'Abdeckungen und Winkel', name: 'Vorstoßblech', ueberdeckung: 50,
    start: 0, sicht: 1,
    schenkel: [s(102), s(50), t(15)],
    kantungen: [k(90, -1), k(135, 1)],
    regel: 'Haftstreifen für Dachrand und Ortgang. Nägel versetzt, Abstand unter 100 mm.',
  },
  {
    id: 'haftstreifen', gruppe: 'Abdeckungen und Winkel', name: 'Haftstreifen', ueberdeckung: 0,
    start: 0, sicht: 1,
    schenkel: [s(70), s(30)],
    kantungen: [k(100, -1)],
    regel: 'Verzinkter Stahl ≥ 1,0 mm.',
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

  // --- Flachdach (meist aus Verbundblech) ---
  {
    id: 'traufblech-flachdach', gruppe: 'Flachdach', name: 'Traufblech Flachdach', ueberdeckung: 0,
    start: 0, sicht: 1,
    schenkel: [s(130), s(60), s(60)],
    kantungen: [k(90, -1), k(135, 1)],
    regel: 'Aus Verbundblech, zweireihig befestigt. Naht ≥ 20 mm (Warmgas). Stöße mit 3–5 mm Fuge, darüber ein '
      + 'Streifen geschweißt. Bei Bitumen Klebefläche ≥ 120 mm. Zuschnitt etwa 250 (alwitra).',
  },
  {
    id: 'dachrandwinkel', gruppe: 'Flachdach', name: 'Dachrandwinkel Flachdach', ueberdeckung: 0,
    start: 0, sicht: 1,
    schenkel: [s(80), s(100), t(20)],
    kantungen: [k(90, -1), k(135, 1)],
    regel: `Abdichtung am Dachrand ≥ 100 mm über Belag bis 5° Dachneigung, ≥ 50 mm darüber (Flachdachrichtlinie 4.6). `
      + `${ABKANTUNG} ${TROPFABSTAND}`,
  },
  {
    id: 'wandanschluss-flachdach', gruppe: 'Flachdach', name: 'Wandanschluss Flachdach', ueberdeckung: 0,
    start: 0, sicht: 1,
    schenkel: [s(70), s(165), s(15)],
    kantungen: [k(90, 1), k(135, 1)],
    regel: `${ANSCHLUSS_FLACH} Mit Kies oder Begrünung entsprechend höher. Oben eine Flanke ≥ 10 mm für die `
      + 'Dichtstofffuge. Befestigung alle ≤ 200 mm.',
  },
  {
    id: 'wandanschluss-klebeflansch', gruppe: 'Flachdach', name: 'Wandanschluss mit Klebeflansch', ueberdeckung: 100,
    start: 0, sicht: 1,
    schenkel: [s(150), s(173), u()],
    kantungen: [k(90, 1), k(0, -1)],
    regel: `Klebeflansch ≥ 120 mm (DIN 18339), nach Klempnerfachregeln 150 mm. ${ANSCHLUSS_FLACH}`,
  },
  {
    id: 'kehlwinkel', gruppe: 'Flachdach', name: 'Kehlwinkel 50/50', ueberdeckung: 0,
    start: 0, sicht: 1,
    schenkel: [s(50), s(50)],
    kantungen: [k(100, 1)],
    regel: 'Randbefestigung in der Innenecke, alle ≤ 200 mm. 10–15° weiter öffnen als die Ecke (alwitra).',
  },
  {
    id: 'kiesleiste', gruppe: 'Flachdach', name: 'Kiesfangleiste (Lochblech)', ueberdeckung: 0,
    start: 0, sicht: 1,
    schenkel: [s(100), s(80)],
    kantungen: [k(90, 1)],
    regel: 'Gelochter Schenkel 80 oder 100 mm hoch, Kiesschicht ≥ 50 mm. Der Flansch liegt auf der Abdichtung.',
  },

  // --- Scharen (Band 670 bzw. 600) ---
  {
    id: 'schar-doppelstehfalz', gruppe: 'Scharen', name: 'Schar Doppelstehfalz', ueberdeckung: 0,
    start: 180, sicht: 1,
    schenkel: [s(10), s(25), s(590), s(26), s(10), s(9)],
    kantungen: [k(90, 1), k(90, 1), k(90, 1), k(90, -1), k(90, -1)],
    regel: 'Falz fertig ≥ 23 mm hoch (DIN 18339). Scharbreite 520 / 590 / 620 / 720 mm aus Band 600 / 670 / 700 / 800, '
      + 'je nach Gebäudehöhe. Dachneigung ≥ 3°, Regel 7°.',
  },
  {
    id: 'schar-winkelstehfalz', gruppe: 'Scharen', name: 'Schar Winkelstehfalz', ueberdeckung: 0,
    start: 180, sicht: 1,
    schenkel: [s(10), s(25), s(590), s(26), s(10), s(9)],
    kantungen: [k(90, 1), k(90, 1), k(90, 1), k(90, -1), k(90, -1)],
    regel: 'Ab 25° Dachneigung, Regel 35°. Scharbreiten wie beim Doppelstehfalz.',
  },
  {
    id: 'schar-leistendeckung', gruppe: 'Scharen', name: 'Schar Leistendeckung', ueberdeckung: 0,
    start: 0, sicht: 1,
    schenkel: [s(10), s(40), s(500), s(40), s(10)],
    kantungen: [k(90, -1), k(90, 1), k(90, 1), k(90, -1)],
    regel: 'Leiste ≥ 40 × 40 mm, Streifenhafte ≥ 100 mm breit.',
  },
  {
    id: 'schar-aufkantung', gruppe: 'Scharen', name: 'Schar nur Aufkantung', ueberdeckung: 0,
    start: -90, sicht: 1,
    schenkel: [s(35), s(590), s(45)],
    kantungen: [k(90, 1), k(90, 1)],
    regel: 'Aufkantungen 35 und 45 mm für den Doppelstehfalz.',
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

/** Regelhinweis zur Vorlage, aus der ein Profil stammt, sonst '' */
export function regelZu(vorlageId) {
  const v = VORLAGEN.find((x) => x.id === vorlageId);
  return (v && v.regel) || '';
}
