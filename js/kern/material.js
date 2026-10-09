// Bleche, Dicken und Formate von Hein & Knott sowie die Grenzen der Maschine.
// Stand 08.10.2026: was im Betrieb verarbeitet wird, ergänzt um lieferbare Formate.
// Preise stehen hier bewusst nicht: Das Programm liegt öffentlich im Netz.

export const MASCHINE = {
  name: 'Schechtl MBM 310',
  laenge: 3100, // Arbeitslänge in mm
  anschlagMin: 6,
  anschlagMax: 750,
  oeffnung: 130,
  // größte Blechdicke in mm je Werkstoffgruppe laut Datenblatt
  maxDicke: { stahl: 1.0, edelstahl: 0.6, kupfer: 1.0, alu: 1.5, zink: 2.0 },
};

const tafel = (b, l) => ({ art: 'tafel', b, l });
const coil = (b) => ({ art: 'coil', b });

// Folienblech: Dicke ist das Blech ohne Folie, zusatz die Folie in kg je m² (Annahme).
// Je Hersteller ein Material, weil die Preise weit auseinanderliegen (Festlegung 09.10.2026).
const folienblech = (id, name, formate) => ({
  id: `folienblech-${id}`, name: `Folienblech ${name}`, gruppe: 'stahl', dichte: 7.85, dicken: [0.6], zusatz: 1.5, formate,
});

// dichte in kg je m² und mm Dicke. faktor < 1 bei Lochblech (Anteil Blech ohne Löcher).
export const MATERIALIEN = [
  {
    // id bleibt "titanzink", damit gespeicherte Positionen walzblank bleiben
    id: 'titanzink', name: 'Titanzink walzblank', gruppe: 'zink', dichte: 7.2, dicken: [0.7, 0.8],
    formate: [tafel(1000, 2000), tafel(1000, 3000), coil(1000), coil(670), coil(600), coil(500), coil(400)],
  },
  {
    // blaugrau, schiefergrau, Quartz, Anthra – rund die Hälfte teurer als walzblank
    id: 'titanzink-vorbewittert', name: 'Titanzink vorbewittert', gruppe: 'zink', dichte: 7.2, dicken: [0.7, 0.8],
    formate: [tafel(1000, 2000), tafel(1000, 3000), coil(1000), coil(670), coil(600), coil(500), coil(400)],
  },
  {
    id: 'kupfer', name: 'Kupfer', gruppe: 'kupfer', dichte: 8.9, dicken: [0.7, 0.6],
    formate: [tafel(1000, 2000), tafel(1000, 3000), coil(1000), coil(670), coil(600), coil(500), coil(400), coil(333)],
  },
  {
    id: 'alu-farbig', name: 'Alu farbig (Prefalz)', gruppe: 'alu', dichte: 2.75, dicken: [0.7],
    formate: [tafel(1000, 2000), tafel(1000, 3000), coil(1000), coil(650), coil(500)],
  },
  {
    id: 'farbalu', name: 'Farbaluminium', gruppe: 'alu', dichte: 2.75, dicken: [0.8],
    formate: [tafel(1000, 2000), tafel(1250, 2000)],
  },
  {
    id: 'alu-blank', name: 'Alu blank', gruppe: 'alu', dichte: 2.75, dicken: [0.8, 1.0],
    formate: [tafel(1000, 2000), tafel(1250, 2000), coil(1000)], // 1000 × 2000 laut Stamm gekauft (09.10.2026)
  },
  {
    id: 'eisenblech', name: 'Eisenblech verzinkt', gruppe: 'stahl', dichte: 7.95, dicken: [0.88],
    formate: [tafel(1000, 2000)],
  },
  {
    id: 'edelstahl', name: 'Edelstahl (Uginox)', gruppe: 'edelstahl', dichte: 7.7, dicken: [0.5, 0.4],
    formate: [tafel(1000, 2000)],
  },
  folienblech('sika', 'Sikaplan', [tafel(1000, 2000)]),
  folienblech('evalon', 'Evalon', [tafel(1000, 2000)]),
  folienblech('thermofin', 'Bauder Thermofin', [tafel(1000, 2000)]),
  folienblech('wolfin', 'Wolfin', [tafel(1000, 2000)]),
  folienblech('elevate', 'Elevate', [tafel(1220, 3050)]),
  {
    id: 'lochblech-alu', name: 'Lochblech Alu Rv 5-8', gruppe: 'alu', dichte: 2.75, faktor: 0.65, dicken: [0.8],
    formate: [tafel(1000, 2000)],
  },
  {
    id: 'lochblech-zink', name: 'Lochblech Titanzink Rv 5-7', gruppe: 'zink', dichte: 7.2, faktor: 0.54, dicken: [0.7],
    formate: [tafel(1000, 2000)],
  },
  {
    id: 'lochblech-kupfer', name: 'Lochblech Kupfer Rv 5-7', gruppe: 'kupfer', dichte: 8.9, faktor: 0.54, dicken: [0.7, 0.6],
    formate: [tafel(1000, 2000)],
  },
];

// Bis 09.10.2026 gab es ein gemeinsames Folienblech. Gespeicherte Positionen landen beim ersten Hersteller.
const FRUEHER = { folienblech: 'folienblech-sika' };

export const materialMit = (id) => MATERIALIEN.find((m) => m.id === (FRUEHER[id] || id)) || MATERIALIEN[0];

export const formatSchluessel = (f) => (f.art === 'coil' ? `coil-${f.b}` : `tafel-${f.b}x${f.l}`);

export function formatName(f, anzahl = 1) {
  if (f.art === 'coil') return `Coil ${f.b} breit`;
  return `${anzahl === 1 ? 'Tafel' : 'Tafeln'} ${f.b} × ${f.l}`;
}

/** Gewicht in kg für eine Fläche in m². */
export function gewicht(material, dicke, flaecheM2) {
  const jeM2 = material.dichte * dicke * (material.faktor || 1) + (material.zusatz || 0);
  return jeM2 * flaecheM2;
}

/** Text, wenn die Maschine das Blech nicht mehr schafft, sonst null. */
export function dickenHinweis(material, dicke) {
  const max = MASCHINE.maxDicke[material.gruppe];
  if (dicke <= max + 1e-9) return null;
  const zahl = (x) => String(x).replace('.', ',');
  return `${material.name} ${zahl(dicke)} mm ist für die ${MASCHINE.name} zu dick. Sie schafft hier höchstens ${zahl(max)} mm.`;
}
