// Zeichnet eine Tafel oder einen Coil-Abschnitt mit ihren Streifen als SVG.
// Länge läuft waagerecht, Breite senkrecht. Alle Bleche haben denselben Maßstab.

import { REST_BREITE, REST_LAENGE } from './kern/zuschnittplan.js';

const NS = 'http://www.w3.org/2000/svg';
const ZEICHEN = 6.6; // ungefähre Breite eines Zeichens bei 12 px

function el(name, attribute = {}, text) {
  const e = document.createElementNS(NS, name);
  Object.entries(attribute).forEach(([k, v]) => e.setAttribute(k, v));
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * @param {SVGSVGElement} svg
 * @param {object} blech         aus zuschnittplan.js
 * @param {(pos: string) => string} farbeFuer  Füllfarbe je Position
 * @param {number} laengeMax     Länge, die die volle Breite der Zeichnung füllt
 */
export function zeichneBlech(svg, blech, farbeFuer, laengeMax = 3100) {
  const breitePx = Math.max(svg.clientWidth || 600, 240);
  const m = (breitePx - 2) / laengeMax;
  const w = blech.l * m;
  const h = blech.format.b * m;
  svg.setAttribute('viewBox', `0 0 ${breitePx} ${(h + 2).toFixed(1)}`);
  svg.replaceChildren();
  const g = el('g', { transform: 'translate(1,1)' });
  svg.append(g);

  const feld = (x, y, b, hoehe, klasse, zeilen, farbe) => {
    if (b <= 0.5 || hoehe <= 0.5) return;
    const attribute = { class: klasse, x: x.toFixed(1), y: y.toFixed(1), width: b.toFixed(1), height: hoehe.toFixed(1) };
    if (farbe) attribute.fill = farbe;
    g.append(el('rect', attribute));
    // so viel Text, wie hineinpasst: erst alles, dann nur die erste Angabe
    const passend = [zeilen.join('  '), zeilen[0]].find((t) => t && t.length * ZEICHEN + 6 <= b);
    if (!passend || hoehe < 13) return;
    g.append(el('text', {
      class: klasse,
      x: (x + b / 2).toFixed(1),
      y: (y + hoehe / 2).toFixed(1),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    }, passend));
  };
  const rest = (x, y, b, hoehe, breiteMm, laengeMm) => {
    const brauchbar = breiteMm >= REST_BREITE && laengeMm >= REST_LAENGE;
    feld(x, y, b, hoehe, brauchbar ? 'rest' : 'abfall', brauchbar ? [`Rest ${breiteMm} × ${laengeMm}`] : ['Verschnitt']);
  };

  g.append(el('rect', { class: 'tafel', x: 0, y: 0, width: w.toFixed(1), height: h.toFixed(1) }));
  let y = 0;
  blech.streifen.forEach((s) => {
    let x = 0;
    s.teile.forEach((e) => {
      if (s.quer) {
        feld(x, y, e.b * m, e.l * m, 'teil', [e.pos, 'quer'], farbeFuer(e.pos));
        rest(x, y + e.l * m, e.b * m, (s.b - e.l) * m, 0, 0);
        x += e.b * m;
      } else {
        feld(x, y, e.l * m, s.b * m, 'teil', [e.pos, `${e.b} × ${e.l}`], farbeFuer(e.pos));
        x += e.l * m;
      }
    });
    rest(x, y, w - x, s.b * m, s.b, blech.l - s.belegt);
    y += s.b * m;
  });
  rest(0, y, w, h - y, blech.frei, blech.l);
  g.append(el('rect', { class: 'rand', x: 0, y: 0, width: w.toFixed(1), height: h.toFixed(1) }));
}
