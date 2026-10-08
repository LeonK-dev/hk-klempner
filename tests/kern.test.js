// Tests für Profil und Vorlagen. Laufen im Browser (tests/index.html) und mit Node (tests/lauf.mjs).

import {
  abschlussAn, ausgerichtet, bewertung, freiesProfil, gedreht, geklappt, gespiegelt, mitAbschluss,
  mitFest, mitNeigung, mitSchenkel, neigung, normalisiert, ohneSchenkel, pruefe, richtung,
  schneidetSich, teiler, verlauf, zahl, zuschnitt,
} from '../js/kern/profil.js';
import { VORLAGEN, ausVorlage } from '../js/kern/vorlagen.js';
import { gleich, test } from './hilfe.js';

const vorlage = (id) => ausVorlage(VORLAGEN.find((v) => v.id === id));
const ende = (p) => verlauf(p, 0).punkte.at(-1);

// --- Zuschnitt ---

const SOLL_ZUSCHNITT = {
  traufblech: 250, rinneneinhang: 333, ortgangblech: 200, lueftungsblech: 100,
  wandanschluss: 285, kaminanschluss: 333, kappleiste: 100, firstblech: 400,
  pultabschluss: 400, kehle: 500, mauerabdeckung: 500, fensterbank: 250,
  vorstoss: 167, haftstreifen: 100, winkel: 100, 'z-winkel': 110,
  'schar-doppelstehfalz': 670, 'schar-winkelstehfalz': 670,
  'schar-leistendeckung': 600, 'schar-aufkantung': 670,
};

test('Jede Vorlage hat einen Soll-Zuschnitt', () => {
  VORLAGEN.forEach((v) => {
    if (!(v.id in SOLL_ZUSCHNITT)) throw new Error(`Soll fehlt für ${v.id}`);
  });
  gleich(VORLAGEN.length, Object.keys(SOLL_ZUSCHNITT).length, 'Anzahl Vorlagen');
});

test('Zuschnitt ist die Summe der Außenmaße', () => {
  VORLAGEN.forEach((v) => gleich(zuschnitt(ausVorlage(v)), SOLL_ZUSCHNITT[v.id], v.id));
});

test('Zuschnitt rechnet Kommamaße auf Zehntel', () => {
  gleich(zuschnitt({ schenkel: [{ l: 12.5 }, { l: 30.25 }], kantungen: [{ w: 90, r: 1 }] }), 42.8);
});

// --- Linienzug ---

test('Winkel 50/50 endet bei 50 / 50', () => {
  const p = ende(vorlage('winkel'));
  gleich(p.x, 50, 'x');
  gleich(p.y, 50, 'y');
});

test('Z-Winkel endet bei 60 / 50', () => {
  const p = ende(vorlage('z-winkel'));
  gleich(p.x, 60, 'x');
  gleich(p.y, 50, 'y');
});

test('Zugedrückter Umschlag läuft auf dem Schenkel zurück', () => {
  const { punkte } = verlauf(vorlage('traufblech'), 0);
  gleich(punkte[1].y, -10, 'Umschlag unten');
  gleich(punkte[2].x, 0, 'Blende x');
  gleich(punkte[2].y, 60, 'Blende oben');
});

test('Innenwinkel 120 kantet um 60 Grad', () => {
  const { punkte } = verlauf(vorlage('traufblech'), 0);
  gleich(punkte[3].x, -170 * Math.cos(Math.PI / 6), 'Auflage x');
  gleich(punkte[3].y, 60 + 170 * Math.sin(Math.PI / 6), 'Auflage y');
});

test('Spalt zieht den zugedrückten Umschlag sichtbar auseinander', () => {
  const { punkte, strecken } = verlauf(vorlage('traufblech'), 4);
  gleich(punkte.length, 5, 'Punkte mit Spalt');
  gleich(punkte[2].x, 4, 'Versatz');
  gleich(strecken[1].von, 2, 'Blende beginnt nach dem Spalt');
});

test('Mauerabdeckung ist symmetrisch', () => {
  const { punkte } = verlauf(vorlage('mauerabdeckung'), 0);
  gleich(punkte.at(-1).y, punkte[0].y, 'beide Tropfkanten gleich tief');
  gleich(punkte.at(-1).x - punkte[4].x, punkte[1].x - punkte[0].x, 'Ausladung der Tropfkanten');
});

test('Firstblech ist symmetrisch', () => {
  const { punkte } = verlauf(vorlage('firstblech'), 0);
  gleich(punkte.at(-1).y, punkte[0].y, 'beide Enden gleich hoch');
});

test('Schar Doppelstehfalz: Fläche liegt waagerecht, Achsmaß 590', () => {
  const { punkte } = verlauf(vorlage('schar-doppelstehfalz'), 0);
  gleich(punkte[3].y, punkte[2].y, 'Fläche waagerecht');
  gleich(punkte[3].x - punkte[2].x, 590, 'Flächenbreite');
  gleich(punkte[4].y - punkte[3].y, 26, 'Überdeckfalz steht nach oben');
});

// --- Teiler ---

test('Teiler: 250 passt 4× in 1000 ohne Rest', () => {
  const t = teiler(250, 1000);
  gleich(t.anzahl, 4);
  gleich(t.rest, 0);
  gleich(t.tipp, null);
});

test('Teiler: 340 passt 2×, 7 mm weniger ergeben 3 Streifen', () => {
  const t = teiler(340, 1000);
  gleich(t.anzahl, 2);
  gleich(t.rest, 320);
  gleich(t.brauchbar, true);
  gleich(t.tipp.abzug, 7);
  gleich(t.tipp.anzahl, 3);
});

test('Teiler: Rest unter 200 mm ist Verschnitt', () => {
  gleich(teiler(285, 1000).brauchbar, false);
  gleich(teiler(285, 1000).rest, 145);
});

test('Teiler: zu breiter Zuschnitt passt 0×', () => {
  const t = teiler(1100, 1000);
  gleich(t.anzahl, 0);
  gleich(t.tipp, null);
});

test('Teiler: 333 passt 3× in 1000', () => {
  gleich(teiler(333, 1000).anzahl, 3);
  gleich(teiler(333, 1000).rest, 1);
});

// --- Urteil zum Verschnitt ---

test('Bewertung: 250 in 1000 ist ohne Verschnitt und ohne Empfehlung', () => {
  const b = bewertung(250, 1000);
  gleich(b.stufe, 'kein');
  gleich(b.anzahl, 4);
  gleich(b.empfehlung, null);
});

test('Bewertung: 285 in 1000 ist viel Verschnitt, Empfehlung 250', () => {
  const b = bewertung(285, 1000);
  gleich(b.stufe, 'viel');
  gleich(b.rest, 145);
  gleich(b.prozent, 14.5);
  gleich(b.empfehlung.zuschnitt, 250);
  gleich(b.empfehlung.abzug, 35);
  gleich(b.empfehlung.anzahl, 4);
  gleich(b.empfehlung.rest, 0);
});

test('Bewertung: Rest ab 200 mm gilt als brauchbar', () => {
  const b = bewertung(265, 1000);
  gleich(b.stufe, 'rest');
  gleich(b.rest, 205);
  gleich(b.empfehlung.zuschnitt, 250);
});

test('Bewertung: Stufen wenig, mittel und passt nicht', () => {
  gleich(bewertung(333, 1000).stufe, 'wenig');
  gleich(bewertung(333, 1000).empfehlung, null);
  gleich(bewertung(310, 1000).stufe, 'mittel');
  gleich(bewertung(1100, 1000).stufe, 'passt_nicht');
});

test('Bewertung: keine Empfehlung, wenn dafür zu viel gekürzt werden müsste', () => {
  const b = bewertung(450, 1000);
  gleich(b.stufe, 'viel');
  gleich(b.empfehlung, null);
});

// --- Lage des ersten Schenkels ---

const punkteGleich = (a, b) => {
  gleich(a.length, b.length, 'Anzahl Punkte');
  a.forEach((p, i) => {
    gleich(p.x, b[i].x, `x von Punkt ${i}`);
    gleich(p.y, b[i].y, `y von Punkt ${i}`);
  });
};

test('Vorlagen: fest ist der längste Schenkel', () => {
  const p = vorlage('traufblech');
  gleich(p.fest, 2);
  gleich(richtung(p, 2), 150);
  gleich(neigung(p), -30, 'Auflage fällt nach rechts');
  gleich(vorlage('mauerabdeckung').fest, 2);
  gleich(neigung(vorlage('mauerabdeckung')), 0);
});

test('Neigung liegt immer zwischen -90 und 90 Grad', () => {
  const p = freiesProfil();
  gleich(neigung({ ...p, lage: 0 }), 0);
  gleich(neigung({ ...p, lage: 270 }), 90);
  gleich(neigung({ ...p, lage: 225 }), 45);
  gleich(neigung({ ...p, lage: -60 }), -60);
  gleich(neigung({ ...p, lage: 150 }), -30);
  gleich(neigung({ ...p, lage: 183 }), 3);
});

test('Neigung einstellen stellt die Zeichnung nicht auf den Kopf', () => {
  const p = vorlage('traufblech'); // Auflage läuft nach links oben, Richtung 150
  gleich(mitNeigung(p, -20).lage, 160);
  gleich(neigung(mitNeigung(p, -20)), -20);
  gleich(ausgerichtet(p, 'waagerecht').lage, 180);
  gleich(ausgerichtet(p, 'senkrecht').lage, 90);
  gleich(mitNeigung(freiesProfil(), 3).lage, 3);
});

test('Freies Profil beginnt mit einem waagerechten Schenkel', () => {
  const p = freiesProfil();
  gleich(p.schenkel.length, 1);
  gleich(p.kantungen.length, 0);
  gleich(neigung(p), 0);
  gleich(pruefe(p).length, 0);
});

test('Schenkel bei A anfügen und umklappen lässt den festen Schenkel stehen', () => {
  let p = mitSchenkel(mitNeigung(freiesProfil(), 3), 'anfang');
  gleich(p.fest, 1, 'der ursprüngliche Schenkel bleibt fest');
  gleich(richtung(p, 1), 3);
  gleich(richtung(p, 0), -87, 'neuer Schenkel steht zuerst nach oben ab');
  p = geklappt(p, 0);
  gleich(richtung(p, 1), 3, 'fester Schenkel unverändert');
  gleich(richtung(p, 0), 93, 'neuer Schenkel hängt jetzt nach unten');
  gleich(neigung(p), 3);
});

test('Winkel vor dem festen Schenkel ändern bewegt nur den Teil davor', () => {
  const p = vorlage('traufblech');
  p.kantungen[1].w = 100;
  gleich(richtung(p, 2), 150, 'Auflage bleibt');
  gleich(richtung(p, 1), 70, 'Blende dreht sich');
  p.kantungen[1].w = NaN; // beim Tippen
  gleich(richtung(p, 2), 150, 'auch bei ungültiger Eingabe');
});

test('Anderen Schenkel festhalten ändert die Zeichnung nicht', () => {
  const p = vorlage('mauerabdeckung');
  const q = mitFest(p, 0);
  gleich(q.fest, 0);
  punkteGleich(verlauf(q, 0).punkte, verlauf(p, 0).punkte);
  gleich(richtung(geklappt(q, 1), 0), richtung(q, 0), 'jetzt bleibt Schenkel 1 beim Umklappen stehen');
});

test('Schenkel entfernen: der feste bleibt, sonst übernimmt der Nachbar', () => {
  const p = vorlage('traufblech'); // fest = 2
  let q = ohneSchenkel(p, 0);
  gleich(q.fest, 1);
  gleich(richtung(q, 1), 150);
  q = ohneSchenkel(p, 2); // der feste selbst
  gleich(q.fest, 1);
  gleich(richtung(q, 1), 90, 'Blende behält ihre Richtung');
  gleich(q.schenkel.length, 2);
});

test('Ältere Profile mit start werden ohne Änderung der Zeichnung übernommen', () => {
  const alt = {
    name: 'alt', start: -90, sicht: -1,
    schenkel: [{ l: 10, art: 'umschlag_zu' }, { l: 70 }, { l: 170 }],
    kantungen: [{ w: 0, r: 1 }, { w: 120, r: 1 }],
  };
  const neu = normalisiert(alt);
  gleich(neu.start, undefined);
  gleich(neu.fest, 2);
  gleich(neu.lage, 150);
  punkteGleich(verlauf(neu, 0).punkte, verlauf(alt, 0).punkte);
  const nochmal = normalisiert(JSON.parse(JSON.stringify(neu)));
  gleich(nochmal.fest, 2);
  gleich(nochmal.lage, 150);
});

// --- Prüfung ---

test('Keine Vorlage hat Fehler oder schneidet sich selbst', () => {
  VORLAGEN.forEach((v) => {
    const h = pruefe(ausVorlage(v));
    if (h.length) throw new Error(`${v.id}: ${h[0].text}`);
  });
});

test('Fehlende Länge und falscher Winkel werden gemeldet', () => {
  const p = vorlage('winkel');
  p.schenkel[0].l = NaN;
  p.kantungen[0].w = 200;
  const h = pruefe(p);
  gleich(h.length, 2);
  gleich(h[0].schenkel, 0);
  gleich(h[1].kantung, 0);
});

test('Selbstschnitt wird erkannt', () => {
  const p = {
    start: 0, sicht: 1,
    schenkel: [{ l: 100 }, { l: 50 }, { l: 50 }, { l: 100 }],
    kantungen: [{ w: 90, r: 1 }, { w: 90, r: 1 }, { w: 90, r: 1 }],
  };
  gleich(schneidetSich(p), true);
  gleich(pruefe(p)[0].art, 'warnung');
});

// --- Änderungen ---

test('Abschluss am Anfang lässt den Rest der Zeichnung stehen', () => {
  const p = vorlage('winkel');
  const q = mitAbschluss(p, 'anfang', 'umschlag_zu');
  gleich(q.schenkel.length, 3);
  gleich(abschlussAn(q, 'anfang'), 'umschlag_zu');
  gleich(zuschnitt(q), 110);
  const a = verlauf(p, 0).punkte;
  const b = verlauf(q, 0).punkte;
  gleich(b[2].x - b[1].x, a[1].x - a[0].x, 'Richtung Schenkel x');
  gleich(b[2].y - b[1].y, a[1].y - a[0].y, 'Richtung Schenkel y');
});

test('Abschluss tauschen und wieder entfernen', () => {
  let p = mitAbschluss(vorlage('winkel'), 'ende', 'tropfkante');
  gleich(zuschnitt(p), 120);
  p = mitAbschluss(p, 'ende', 'rueckkantung');
  gleich(p.schenkel.length, 3);
  gleich(zuschnitt(p), 115);
  p = mitAbschluss(p, 'ende', null);
  gleich(p.schenkel.length, 2);
  gleich(abschlussAn(p, 'ende'), null);
});

test('Umschlag kantet von der Sichtseite weg, Tropfkante zu ihr hin', () => {
  const p = vorlage('winkel');
  gleich(mitAbschluss(p, 'ende', 'umschlag_zu').kantungen.at(-1).r, -p.sicht);
  gleich(mitAbschluss(p, 'ende', 'tropfkante').kantungen.at(-1).r, p.sicht);
});

test('Schenkel anfügen und entfernen hält Kantungen passend', () => {
  let p = mitSchenkel(vorlage('z-winkel'), 'ende');
  gleich(p.schenkel.length, 4);
  gleich(p.kantungen.length, 3);
  p = ohneSchenkel(p, 1);
  gleich(p.schenkel.length, 3);
  gleich(p.kantungen.length, 2);
  p = ohneSchenkel(ohneSchenkel(p, 0), 0);
  gleich(p.schenkel.length, 1);
  gleich(p.kantungen.length, 0);
  gleich(ohneSchenkel(p, 0).schenkel.length, 1, 'ein Schenkel bleibt immer');
});

test('Spiegeln und Drehen ändern den Zuschnitt nicht', () => {
  const p = vorlage('traufblech');
  gleich(zuschnitt(gespiegelt(p)), 250);
  gleich(zuschnitt(gedreht(p)), 250);
  gleich(ende(gespiegelt(p)).x, -ende(p).x, 'gespiegelt x');
  gleich(ende(gespiegelt(p)).y, ende(p).y, 'gespiegelt y');
});

// --- Eingabe und Speicher ---

test('Zahl liest deutsches Komma und weist Unsinn ab', () => {
  gleich(zahl('12,5'), 12.5);
  gleich(zahl(' 80 '), 80);
  gleich(Number.isNaN(zahl('')), true);
  gleich(Number.isNaN(zahl('12a')), true);
});

test('Normalisieren ergänzt fehlende Kantungen und verwirft Unbrauchbares', () => {
  gleich(normalisiert(null), null);
  gleich(normalisiert({ schenkel: [] }), null);
  const p = normalisiert({ schenkel: [{ l: '40' }, { l: 60, art: 'gibtsnicht' }], kantungen: [] });
  gleich(p.kantungen.length, 1);
  gleich(p.kantungen[0].w, 90);
  gleich(p.schenkel[0].l, 40);
  gleich(p.schenkel[1].art, undefined);
});
