// Winziges Testgerüst, läuft im Browser und mit Node.

export const ergebnisse = [];

export function test(name, fn) {
  try {
    fn();
    ergebnisse.push({ name, ok: true });
  } catch (e) {
    ergebnisse.push({ name, ok: false, fehler: e.message });
  }
}

export function gleich(ist, soll, was = 'Wert') {
  const passt = typeof soll === 'number' ? Math.abs(ist - soll) < 1e-6 : ist === soll;
  if (!passt) throw new Error(`${was}: ist ${ist}, soll ${soll}`);
}
