// Aufruf: node tests/lauf.mjs   (braucht Node.js, im Browser geht tests/index.html)
import { ergebnisse } from './alle.js';

ergebnisse.forEach((e) => console.log(e.ok ? `ok      ${e.name}` : `FEHLER  ${e.name}: ${e.fehler}`));
const fehler = ergebnisse.filter((e) => !e.ok).length;
console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Tests bestanden`);
process.exit(fehler ? 1 : 0);
