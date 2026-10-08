// Verschnittoptimierung: verteilt Teile (Zuschnittbreite × Stücklänge) auf Tafeln und Coil-Abschnitte.
//
// Es gibt nur durchgehende Schnitte (Tafelschere): erst Streifen längs, dann jeden Streifen
// quer auf Länge. Ein Blech im Plan sieht so aus:
//   { format, l: Länge der Tafel bzw. des Coil-Abschnitts,
//     streifen: [{ b: Streifenbreite, quer, teile: [{ pos, b, l }], belegt: verbrauchte Länge }],
//     frei: unbenutzte Breite }
// quer = true: Die Teile liegen um 90° gedreht im Streifen (kurze Teile quer aus der Tafel).

export const REST_BREITE = 200; // mm, ab hier gilt ein Rest als brauchbar (Festlegung 08.10.2026)
export const REST_LAENGE = 1000; // mm, Annahme: kürzere Reststücke zählen als Verschnitt
// Annahme: Beim Vergleich zweier Pläne zählt ein brauchbarer Rest zu 90 % als gespart.
// Bei 100 % würde das Tool lieber eine zweite Tafel anbrechen, als ein kleines Teil quer
// einzupassen. Deutlich weniger würde Coil-Abschnitte mit Verschnitt einer Tafel vorziehen,
// deren Rest man weiterverwenden kann.
export const REST_WERT = 0.9;
const GLEICH = 1000; // mm², darunter gelten zwei Flächen als gleich

function auseinander(teile) {
  const einheiten = [];
  teile.forEach((t) => {
    for (let i = 0; i < t.n; i++) einheiten.push({ pos: t.pos, b: t.b, l: t.l });
  });
  return einheiten;
}

// Streifen über die Breite verteilen, die breiten zuerst
function verteile(streifen, format, l) {
  const bleche = [];
  [...streifen].sort((x, y) => y.b - x.b || y.belegt - x.belegt).forEach((s) => {
    let blech = bleche.find((o) => o.frei >= s.b);
    if (!blech) {
      blech = { format, l, streifen: [], frei: format.b };
      bleche.push(blech);
    }
    blech.streifen.push(s);
    blech.frei -= s.b;
  });
  return bleche;
}

// Tafel: Teile gleicher Breite hintereinander in Streifen der Tafellänge, lange zuerst
function packeTafel(einheiten, format) {
  const uebrig = [];
  const streifen = [];
  const breiten = [...new Set(einheiten.map((e) => e.b))].sort((x, y) => y - x);
  breiten.forEach((b) => {
    const offen = [];
    einheiten.filter((e) => e.b === b).sort((x, y) => y.l - x.l).forEach((e) => {
      if (e.l > format.l || e.b > format.b) {
        uebrig.push(e);
        return;
      }
      let s = offen.find((o) => o.belegt + e.l <= format.l);
      if (!s) {
        s = { b, quer: false, teile: [], belegt: 0 };
        offen.push(s);
      }
      s.teile.push(e);
      s.belegt += e.l;
    });
    streifen.push(...offen);
  });
  return { bleche: verteile(streifen, format, format.l), uebrig };
}

// Coil: je Stücklänge eigene Abschnitte, so fällt in der Länge nichts weg
function packeCoil(einheiten, format, lmax) {
  const uebrig = [];
  const bleche = [];
  const laengen = [...new Set(einheiten.map((e) => e.l))].sort((x, y) => y - x);
  laengen.forEach((l) => {
    const streifen = [];
    einheiten.filter((e) => e.l === l).forEach((e) => {
      if (e.l > lmax || e.b > format.b) uebrig.push(e);
      else streifen.push({ b: e.b, quer: false, teile: [e], belegt: e.l });
    });
    bleche.push(...verteile(streifen, format, l));
  });
  return { bleche, uebrig };
}

const packe = (einheiten, format, lmax) => (
  format.art === 'coil' ? packeCoil(einheiten, format, lmax) : packeTafel(einheiten, format)
);

/**
 * Flächen in mm². verbrauch = gekauft minus brauchbare Reste, verschnitt = verbrauch minus Teile.
 * reste: brauchbare Reststücke [{ b, l }]
 */
export function auswertung(bleche) {
  let gekauft = 0;
  let genutzt = 0;
  let brauchbar = 0;
  const reste = [];
  const merke = (b, l) => {
    if (b >= REST_BREITE && l >= REST_LAENGE) {
      brauchbar += b * l;
      reste.push({ b, l });
    }
  };
  bleche.forEach((blech) => {
    gekauft += blech.format.b * blech.l;
    merke(blech.frei, blech.l);
    blech.streifen.forEach((s) => {
      s.teile.forEach((e) => { genutzt += e.b * e.l; });
      merke(s.b, blech.l - s.belegt);
    });
  });
  const verbrauch = gekauft - brauchbar;
  return {
    gekauft, genutzt, brauchbar, verbrauch,
    verschnitt: verbrauch - genutzt,
    kosten: gekauft - REST_WERT * brauchbar, // nur zum Vergleichen von Plänen
    anzahl: bleche.length,
    reste,
  };
}

/** Ist a der bessere Plan? Erst weniger Material, dann weniger angebrochene Bleche. */
export function besser(a, b) {
  if (Math.abs(a.kosten - b.kosten) > GLEICH) return a.kosten < b.kosten;
  if (a.anzahl !== b.anzahl) return a.anzahl < b.anzahl;
  return a.gekauft < b.gekauft - GLEICH;
}

const kopiere = (blech) => ({
  ...blech,
  streifen: blech.streifen.map((s) => ({ ...s, teile: [...s.teile] })),
});

// Sucht für ein einzelnes Teil einen freien Platz in den vorhandenen Blechen
function setzeEin(bleche, e) {
  for (const blech of bleche) {
    for (const s of blech.streifen) {
      if (!s.quer && s.b === e.b && s.belegt + e.l <= blech.l) {
        s.teile.push(e);
        s.belegt += e.l;
        return true;
      }
      if (s.quer && e.l <= s.b && s.belegt + e.b <= blech.l) {
        s.teile.push(e);
        s.belegt += e.b;
        return true;
      }
    }
  }
  const knappstes = (passt) => bleche.filter(passt).sort((x, y) => x.frei - y.frei)[0];
  let ziel = knappstes((o) => o.frei >= e.b && e.l <= o.l);
  if (ziel) {
    ziel.streifen.push({ b: e.b, quer: false, teile: [e], belegt: e.l });
    ziel.frei -= e.b;
    return true;
  }
  ziel = knappstes((o) => o.frei >= e.l && e.b <= o.l);
  if (ziel) {
    ziel.streifen.push({ b: e.l, quer: true, teile: [e], belegt: e.b });
    ziel.frei -= e.l;
    return true;
  }
  return false;
}

// Löst schwach belegte Bleche auf, wenn ihre Teile in den Resten der anderen unterkommen
function verdichte(bleche) {
  let liste = bleche;
  let geaendert = true;
  const belegung = (blech) => blech.streifen.reduce((s, x) => s + x.teile.reduce((t, e) => t + e.b * e.l, 0), 0);
  while (geaendert && liste.length > 1) {
    geaendert = false;
    const reihenfolge = [...liste].sort((x, y) => belegung(x) - belegung(y));
    for (const quelle of reihenfolge) {
      const rest = liste.filter((o) => o !== quelle).map(kopiere);
      const teile = quelle.streifen.flatMap((s) => s.teile).sort((x, y) => y.b * y.l - x.b * x.l);
      if (teile.every((e) => setzeEin(rest, e)) && besser(auswertung(rest), auswertung(liste))) {
        liste = rest;
        geaendert = true;
        break;
      }
    }
  }
  return liste;
}

const passtIn = (e, f, lmax) => {
  const laenge = f.art === 'coil' ? lmax : f.l;
  return e.b <= f.b && e.l <= laenge;
};

/**
 * @param {{pos: string, b: number, l: number, n: number}[]} teile
 * @param {{art: 'tafel'|'coil', b: number, l?: number}[]} formate
 * @param {number} lmax  längster Coil-Abschnitt (Arbeitslänge der Maschine)
 * @returns {{moeglich: boolean, passtNicht: string[], bleche: object[], summen: object}}
 */
export function plane(teile, formate, lmax = 3100) {
  const einheiten = auseinander(teile);
  const leer = { moeglich: true, passtNicht: [], bleche: [], summen: auswertung([]) };
  if (!einheiten.length) return leer;

  const passtNicht = [...new Set(
    einheiten.filter((e) => !formate.some((f) => passtIn(e, f, lmax))).map((e) => e.pos),
  )];
  if (passtNicht.length || !formate.length) return { ...leer, moeglich: false, passtNicht };

  const kandidaten = [];
  const nimm = (bleche) => kandidaten.push(verdichte(bleche));

  // 1. alles aus einem Format
  formate.forEach((f) => {
    const r = packe(einheiten, f, lmax);
    if (!r.uebrig.length) nimm(r.bleche);
  });

  // 2. je Zuschnittbreite das günstigste Format, gleiche Formate teilen sich die Bleche
  const wahl = new Map();
  [...new Set(einheiten.map((e) => e.b))].forEach((b) => {
    const menge = einheiten.filter((e) => e.b === b);
    let beste = null;
    formate.forEach((f) => {
      const r = packe(menge, f, lmax);
      if (r.uebrig.length) return;
      const a = auswertung(r.bleche);
      if (!beste || besser(a, beste.a)) beste = { f, a };
    });
    if (beste) wahl.set(beste.f, [...(wahl.get(beste.f) || []), ...menge]);
  });
  if ([...wahl.values()].reduce((s, m) => s + m.length, 0) === einheiten.length) {
    const bleche = [];
    wahl.forEach((menge, f) => bleche.push(...packe(menge, f, lmax).bleche));
    nimm(bleche);
  }

  // 3. kurze Teile auf die kürzere Tafel, lange auf das längere Format
  formate.forEach((kurz) => formate.forEach((lang) => {
    if (kurz.art === 'coil') return;
    const laengeLang = lang.art === 'coil' ? lmax : lang.l;
    if (kurz.l >= laengeLang) return;
    const a = packe(einheiten.filter((e) => e.l <= kurz.l), kurz, lmax);
    const b = packe(einheiten.filter((e) => e.l > kurz.l), lang, lmax);
    if (!a.uebrig.length && !b.uebrig.length && a.bleche.length && b.bleche.length) nimm([...a.bleche, ...b.bleche]);
  }));

  let beste = null;
  kandidaten.forEach((bleche) => {
    const summen = auswertung(bleche);
    if (!beste || besser(summen, beste.summen)) beste = { bleche, summen };
  });
  if (!beste) return { ...leer, moeglich: false, passtNicht: [...new Set(einheiten.map((e) => e.pos))] };

  beste.bleche.forEach((blech) => {
    blech.streifen.sort((x, y) => Number(x.quer) - Number(y.quer) || y.b - x.b || y.belegt - x.belegt);
  });
  return { moeglich: true, passtNicht: [], bleche: beste.bleche, summen: beste.summen };
}

/** Fasst gleiche Bleche zusammen: [{ blech, anzahl }] */
export function gleicheZusammen(bleche) {
  const gruppen = new Map();
  bleche.forEach((blech) => {
    const schluessel = JSON.stringify([
      blech.format, blech.l,
      blech.streifen.map((s) => [s.b, s.quer, s.teile.map((e) => [e.pos, e.b, e.l])]),
    ]);
    const g = gruppen.get(schluessel);
    if (g) g.anzahl += 1;
    else gruppen.set(schluessel, { blech, anzahl: 1 });
  });
  return [...gruppen.values()];
}
