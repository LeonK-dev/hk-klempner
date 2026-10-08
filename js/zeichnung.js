// Zeichnet ein Profil im Schnitt als SVG. Maße und Winkel stehen direkt an der Linie.

import { verlauf, rahmen } from './kern/profil.js';

const NS = 'http://www.w3.org/2000/svg';
const RAND = 48; // Platz für die Maßzahlen
const RAND_SCHMAL = 30;
const WINKEL_AB = 34; // px, kürzere Schenkel bekommen keine Winkelzahl an die Ecke
const MARKE_ABSTAND = 18; // px vom Blechende bis zur Mitte von A bzw. E
const SPALT = 6; // so weit steht ein zugedrückter Umschlag in der Zeichnung auf, in px
const SICHT_ABSTAND = 2.4; // Abstand der Sichtseiten-Linie von der Blechmitte, in px
const MASSSTAB_MAX = 8; // px je mm, damit kleine Profile nicht riesig werden

function el(name, attribute = {}, text) {
  const e = document.createElementNS(NS, name);
  Object.entries(attribute).forEach(([k, v]) => e.setAttribute(k, v));
  if (text !== undefined) e.textContent = text;
  return e;
}

const alsPunkte = (pts) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const mm = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

// Parallele zum Linienzug im Abstand d (Bildschirmkoordinaten, d > 0 = links der Zeichenrichtung)
function versetzt(pts, d) {
  const linien = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const c = pts[i + 1];
    const l = Math.hypot(c.x - a.x, c.y - a.y);
    if (l < 1e-6) continue;
    const dx = (c.x - a.x) / l;
    const dy = (c.y - a.y) / l;
    const nx = dy * d;
    const ny = -dx * d;
    linien.push({ a: { x: a.x + nx, y: a.y + ny }, c: { x: c.x + nx, y: c.y + ny }, dx, dy, ecke: c });
  }
  const aus = [];
  linien.forEach((s, i) => {
    if (i === 0) aus.push(s.a);
    const n = linien[i + 1];
    if (!n) {
      aus.push(s.c);
      return;
    }
    const kreuz = s.dx * n.dy - s.dy * n.dx;
    if (Math.abs(kreuz) > 1e-3) {
      const weg = ((n.a.x - s.a.x) * n.dy - (n.a.y - s.a.y) * n.dx) / kreuz;
      const p = { x: s.a.x + s.dx * weg, y: s.a.y + s.dy * weg };
      // spitze Ecken nicht zu einer langen Nadel ausziehen
      if (Math.hypot(p.x - s.ecke.x, p.y - s.ecke.y) <= Math.abs(d) * 3) {
        aus.push(p);
        return;
      }
    }
    aus.push(s.c, n.a);
  });
  return aus;
}

/**
 * @param {SVGSVGElement} svg
 * @param {object} profil
 * @param {number} aktiv  Index des hervorgehobenen Schenkels, -1 für keinen
 */
export function zeichne(svg, profil, aktiv = -1) {
  const b = Math.max(svg.clientWidth || 600, 240);
  // Am Handy bleibt die Zeichnung flach, damit unter ihr noch Platz zum Tippen ist.
  // Am PC steht die Zeichnung neben der Eingabe und darf hoch sein, auch wenn die Spalte schmal ist.
  const schmal = b < 480 && !window.matchMedia('(min-width: 880px)').matches;
  const h = Math.round(schmal ? Math.min(Math.max(b * 0.5, 160), 220) : Math.min(Math.max(b * 0.7, 260), 460));
  const rand = schmal ? RAND_SCHMAL : RAND;
  svg.setAttribute('viewBox', `0 0 ${b} ${h}`);
  svg.replaceChildren();

  // erst ohne Spalt den Maßstab bestimmen, dann mit sichtbarem Spalt zeichnen
  let v = verlauf(profil, 0);
  let r = rahmen(v.punkte);
  const massstab = Math.min(
    (b - 2 * rand) / Math.max(r.breite, 1),
    (h - 2 * rand) / Math.max(r.hoehe, 1),
    MASSSTAB_MAX,
  );
  v = verlauf(profil, SPALT / massstab);
  r = rahmen(v.punkte);
  const mx = r.minX + r.breite / 2;
  const my = r.minY + r.hoehe / 2;
  const pts = v.punkte.map((p) => ({ x: b / 2 + (p.x - mx) * massstab, y: h / 2 - (p.y - my) * massstab }));
  const schwerX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const schwerY = pts.reduce((s, p) => s + p.y, 0) / pts.length;

  svg.append(el('polyline', { class: 'sicht', points: alsPunkte(versetzt(pts, SICHT_ABSTAND * profil.sicht)) }));
  svg.append(el('polyline', { class: 'blech', points: alsPunkte(pts) }));

  // Schon gesetzte Zahlen merken, damit sich keine überdecken
  const belegt = [];
  const kasten = (x, y, text, anker, groesse) => {
    const breite = text.length * groesse * 0.6 + 4;
    const x0 = anker === 'start' ? x : anker === 'end' ? x - breite : x - breite / 2;
    return { x0, y0: y - groesse / 2 - 1, x1: x0 + breite, y1: y + groesse / 2 + 1 };
  };
  const trifft = (k) => belegt.some((o) => k.x0 < o.x1 && k.x1 > o.x0 && k.y0 < o.y1 && k.y1 > o.y0);

  const laengen = v.strecken
    .map((s) => ({ s, a: pts[s.von], c: pts[s.bis] }))
    .map((e) => ({ ...e, l: Math.hypot(e.c.x - e.a.x, e.c.y - e.a.y) }))
    .filter((e) => e.l > 1e-6);

  laengen.filter((e) => e.s.schenkel === aktiv).forEach(({ a, c }) => {
    svg.append(el('line', { class: 'aktiv', x1: a.x, y1: a.y, x2: c.x, y2: c.y }));
  });

  // lange Schenkel zuerst, die kurzen weichen aus
  [...laengen].sort((e, f) => f.l - e.l).forEach(({ s, a, c, l }) => {
    // Maßzahl auf die Seite, die vom Profil wegzeigt
    let nx = (c.y - a.y) / l;
    let ny = -(c.x - a.x) / l;
    const mitteX = (a.x + c.x) / 2;
    const mitteY = (a.y + c.y) / 2;
    if (nx * (mitteX - schwerX) + ny * (mitteY - schwerY) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const anker = nx > 0.3 ? 'start' : nx < -0.3 ? 'end' : 'middle';
    const text = mm(profil.schenkel[s.schenkel].l);
    let abstand = anker === 'middle' ? 17 : 11;
    let platz = kasten(mitteX + nx * abstand, mitteY + ny * abstand, text, anker, 15);
    for (let versuch = 0; versuch < 6 && trifft(platz); versuch++) {
      abstand += 8;
      platz = kasten(mitteX + nx * abstand, mitteY + ny * abstand, text, anker, 15);
    }
    belegt.push(platz);
    svg.append(el('text', {
      class: s.schenkel === aktiv ? 'mass aktiv' : 'mass',
      x: (mitteX + nx * abstand).toFixed(1),
      y: (mitteY + ny * abstand).toFixed(1),
      'text-anchor': anker,
      'dominant-baseline': 'central',
    }, text));
  });

  // A und E an den beiden Enden, dort wo am meisten Platz zum Blech ist
  const abstandZumBlech = (x, y) => {
    let min = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const c = pts[i + 1];
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const l2 = dx * dx + dy * dy;
      const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
      min = Math.min(min, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
    }
    return min;
  };
  const setzeMarke = (p, buchstabe) => {
    let beste = null;
    for (let grad = 0; grad < 360; grad += 30) {
      const x = p.x + Math.cos((grad * Math.PI) / 180) * MARKE_ABSTAND;
      const y = p.y + Math.sin((grad * Math.PI) / 180) * MARKE_ABSTAND;
      const platz = { x0: x - 10, y0: y - 10, x1: x + 10, y1: y + 10 };
      if (trifft(platz)) continue;
      const frei = abstandZumBlech(x, y);
      if (!beste || frei > beste.frei + 0.01) beste = { x, y, frei, platz };
    }
    if (!beste) {
      const x = p.x;
      const y = p.y - MARKE_ABSTAND;
      beste = { x, y, platz: { x0: x - 10, y0: y - 10, x1: x + 10, y1: y + 10 } };
    }
    belegt.push(beste.platz);
    svg.append(el('circle', { class: 'ende-punkt', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 3.5 }));
    svg.append(el('circle', { class: 'marke', cx: beste.x.toFixed(1), cy: beste.y.toFixed(1), r: 9 }));
    svg.append(el('text', {
      class: 'marke-text',
      x: beste.x.toFixed(1),
      y: beste.y.toFixed(1),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    }, buchstabe));
  };
  setzeMarke(pts[0], 'A');
  setzeMarke(pts[pts.length - 1], 'E');

  v.ecken.forEach((e) => {
    const w = profil.kantungen[e.kantung].w;
    if (!(w >= 30 && w < 180)) return; // Umschläge und gerade Stöße brauchen keine Winkelzahl
    const p = pts[e.punkt];
    const vor = pts[e.punkt - 1];
    const nach = pts[e.punkt + 1];
    const l1 = Math.hypot(vor.x - p.x, vor.y - p.y);
    const l2 = Math.hypot(nach.x - p.x, nach.y - p.y);
    // an kurzen Schenkeln ist kein Platz, der Winkel steht dann nur in der Eingabe
    if (l1 < WINKEL_AB || l2 < WINKEL_AB) return;
    const hx = (vor.x - p.x) / l1 + (nach.x - p.x) / l2;
    const hy = (vor.y - p.y) / l1 + (nach.y - p.y) / l2;
    const hl = Math.hypot(hx, hy);
    if (hl < 1e-6) return;
    const text = `${mm(w)}°`;
    const x = p.x + (hx / hl) * 24;
    const y = p.y + (hy / hl) * 24;
    const platz = kasten(x, y, text, 'middle', 12);
    if (trifft(platz)) return;
    belegt.push(platz);
    svg.append(el('text', {
      class: 'winkel',
      x: x.toFixed(1),
      y: y.toFixed(1),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    }, text));
  });

  // breite, unsichtbare Griffe, damit man einen Schenkel mit dem Finger trifft
  v.strecken.forEach((s) => {
    const a = pts[s.von];
    const c = pts[s.bis];
    svg.append(el('line', { class: 'griff', 'data-i': s.schenkel, x1: a.x, y1: a.y, x2: c.x, y2: c.y }));
  });

  svg.append(el('line', { class: 'sicht', x1: 12, y1: h - 14, x2: 36, y2: h - 14 }));
  svg.append(el('text', { class: 'legende', x: 42, y: h - 14, 'dominant-baseline': 'central' }, 'Sichtseite'));
}
