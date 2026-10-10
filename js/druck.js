// Druckblatt, A4 hoch: erst die Zuschnittliste mit den Schnittplänen je Material, danach vier Profile
// je Seite mit Schnitt, Maßen und Menge (Festlegung 10.10.2026). Die Werkstatt hakt ab, was geschnitten
// und gekantet ist. Einkaufspreise nur, wenn sie beim Drucken ausdrücklich gewählt sind.
//
// Gebaut wird in #druck. Auf dem Bildschirm ist #druck unsichtbar, beim Drucken nur er (css/hk.css).

import { gruppen, planeGruppe } from './kern/auftrag.js';
import { MASCHINE } from './kern/material.js';
import { kosten } from './kern/preise.js';
import { ABSCHLUESSE, zuschnitt } from './kern/profil.js';
import { gleicheZusammen } from './kern/zuschnittplan.js';
import {
  bedarfText, blechName, datum, dez, esc, euro, kostenHtml, mm, urteil, verbrauchText,
} from './format.js';
import { LOGO } from './logo.js';
import { zeichneBlech } from './plan-zeichnung.js';
import { zeichne } from './zeichnung.js';

const JE_SEITE = 4;
const PROFIL = { breite: 420, hoehe: 350 }; // Zeichenfläche, gedruckt etwa 82 mm breit: Maßzahlen gut 3 mm hoch
// Schnittplan: die volle Arbeitslänge der Maschine ist 560 Einheiten und 120 mm breit, Beschriftung so etwa 7 pt
const BLECH = 560;
const BLECH_MM = 120;
const SCHRIFTEN = ['600 10px "Barlow Condensed"', '700 10px "Barlow Condensed"', '800 10px "Barlow Condensed"',
  '400 10px "Source Sans 3"', '600 10px "Source Sans 3"', '700 10px "Source Sans 3"'];

const heute = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const kasten = '<span class="d-kasten" aria-hidden="true"></span>';

/** "Umschlag zugedrückt 10 · 120 · 90° · 250 · 135° · 80": die Schenkel von A nach E mit den Winkeln */
export function folge(profil) {
  const n = profil.schenkel.length;
  const teile = [];
  profil.schenkel.forEach((s, i) => {
    const abschluss = s.art && ABSCHLUESSE[s.art];
    teile.push(abschluss ? `${abschluss.name} ${mm(s.l)}` : mm(s.l));
    if (i === n - 1) return;
    // Der übliche Winkel eines Kantenabschlusses steckt schon in seinem Namen, nur ein anderer wird genannt
    const w = profil.kantungen[i].w;
    const art = i === 0 ? profil.schenkel[0].art : i === n - 2 ? profil.schenkel[n - 1].art : null;
    if (!(art && ABSCHLUESSE[art] && ABSCHLUESSE[art].w === w)) teile.push(`${mm(w)}°`);
  });
  return teile.join(' · ');
}

function mengeText(p, liste) {
  const stuecke = liste.map((x) => `${x.n} × ${mm(x.l)}`).join(' + ');
  if (!stuecke) return 'Menge fehlt';
  return p.menge.art === 'lfm' ? `${stuecke} mm für ${dez(p.menge.meter, 2)} m` : `${stuecke} mm`;
}

function kopfHtml(kopf, positionen, gr, preise) {
  const info = [['Bauvorhaben', kopf.bauvorhaben], ['Bearbeiter', kopf.bearbeiter], ['Datum', heute()]]
    .map(([lbl, wert]) => `<div><div class="d-lbl">${lbl}</div><div class="d-val">${esc(wert || '')}</div></div>`).join('');
  const n = positionen.length;
  return `<div class="d-first"></div>
    <header class="d-kopf">${LOGO.replace('<svg ', '<svg class="d-logo" role="img" aria-label="Hein &amp; Knott Bedachungen" ')}
      <div class="d-titel"><div class="d-eyebrow">${esc(kopf.bauvorhaben || 'Dachklempnerei')}</div>
        <h1>Zuschnittliste</h1>
        <div class="d-unter">${n} ${n === 1 ? 'Position' : 'Positionen'} · ${gr.length} ${gr.length === 1 ? 'Material' : 'Materialien'}</div></div>
    </header>
    <section class="d-info">${info}</section>
    ${kopf.bemerkung ? `<div class="d-bemerkung"><div class="d-lbl">Bemerkung</div><div class="d-val">${esc(kopf.bemerkung)}</div></div>` : ''}
    ${preise ? `<p class="d-buero">Mit Einkaufspreisen vom ${datum(preise.stand)}. Nur fürs Büro, nicht in die Werkstatt geben.</p>` : ''}`;
}

function materialHtml(g, r, nr, geld, farbeFuer) {
  const titel = `${esc(g.material.name)} <span class="dicke">${dez(g.dicke, 2)} mm</span>`;
  const zeilen = g.positionen.map((p) => (r.stuecke[p.pos] || []).map((s) => `<tr>
      <td class="d-k">${kasten}</td>
      <td><span class="d-punkt" style="background:${farbeFuer(p.pos)}"></span>${p.pos}</td>
      <td>${esc(p.profil.name)}</td>
      <td class="r">${mm(zuschnitt(p.profil))}</td>
      <td class="r">${s.n}</td>
      <td class="r">${mm(s.l)}</td>
    </tr>`).join('')).join('');
  const liste = `<table class="d-liste">
      <thead><tr><th class="d-k">Geschnitten</th><th>Pos.</th><th>Profil</th><th class="r">Zuschnitt mm</th><th class="r">Stück</th><th class="r">Länge mm</th></tr></thead>
      <tbody>${zeilen}</tbody></table>`;

  if (!r.plan.moeglich) {
    return `<section class="d-material"><div class="d-mat-kopf"><h2>${titel}</h2></div>
      <p class="d-fehler">${esc(r.plan.passtNicht.join(', '))} passt in kein vorhandenes Format. Der Zuschnitt ist zu breit oder das Stück zu lang.</p>
      ${liste}</section>`;
  }
  if (!r.plan.bleche.length) return '';
  const [wort, farbe] = urteil(r.verschnittProzent);
  const bilder = gleicheZusammen(r.plan.bleche).map((x, i) => `<figure class="d-blech">
      <figcaption><b>${x.anzahl}×</b> ${blechName(x.blech)}</figcaption>
      <svg class="blech-bild" style="width:${((x.blech.l / MASCHINE.laenge) * BLECH_MM).toFixed(1)}mm" data-plan="${nr}" data-blech="${i}" role="img" aria-label="Schnittplan ${blechName(x.blech)}"></svg>
    </figure>`).join('');
  return `<section class="d-material">
    <div class="d-mat-kopf"><h2>${titel}</h2><span class="d-urteil ${farbe}">${wort}</span></div>
    <p class="d-bedarf"><b>Bedarf:</b> ${bedarfText(r.plan.bleche)}.</p>
    <p>${verbrauchText(r)}</p>
    ${kostenHtml(geld)}
    <div class="d-bleche">${bilder}</div>
    ${liste}
  </section>`;
}

function summeHtml(gr, ergebnisse, kostenListe) {
  const mit = kostenListe.filter((k) => k && k.verbrauch !== null);
  if (mit.length < 2) return '';
  const ohne = gr.filter((g, i) => !ergebnisse[i].plan.moeglich || (kostenListe[i] && kostenListe[i].verbrauch === null))
    .map((g) => `${g.material.name} ${dez(g.dicke, 2)} mm`);
  const summe = mit.reduce((s, k) => s + k.verbrauch, 0);
  return `<p class="d-summe"><b>Material gesamt ${euro(summe)}</b> netto im Einkauf, mit Verschnitt, ohne brauchbare Reste.${
    ohne.length ? ` Nicht enthalten: ${esc(ohne.join(', '))}.` : ''}</p>`;
}

function profilHtml(p, g, r, farbeFuer) {
  return `<article class="d-profil">
    <div class="d-p-kopf"><span class="d-nr" style="background:${farbeFuer(p.pos)}">${p.pos}</span>
      <strong>${esc(p.profil.name)}</strong><span class="d-haken">${kasten} gekantet</span></div>
    <svg class="schnitt d-schnitt" data-pos="${p.pos}" role="img" aria-label="Schnitt ${esc(p.profil.name)}"></svg>
    <div class="d-p-zahlen">
      <div class="d-zuschnitt"><div class="d-lbl">Zuschnitt</div><div class="d-z">${mm(zuschnitt(p.profil))}<small>mm</small></div></div>
      <div><div class="d-lbl">Material</div><div class="d-val">${esc(g.material.name)} ${dez(g.dicke, 2)} mm</div>
        <div class="d-lbl">Menge</div><div class="d-val">${mengeText(p, r.stuecke[p.pos] || [])}</div></div>
    </div>
    <div class="d-folge"><div class="d-lbl">Von A nach E</div>${esc(folge(p.profil))}</div>
  </article>`;
}

/**
 * Baut das Druckblatt in ziel.
 * @param {HTMLElement} ziel
 * @param {{kopf: object, positionen: object[], formateAus: object, preise: object|null, farbeFuer: (pos: string) => string}} daten
 *   preise nur, wenn die Einkaufspreise mitgedruckt werden sollen
 */
export function baueDruck(ziel, { kopf, positionen, formateAus, preise, farbeFuer }) {
  const gr = gruppen(positionen);
  const ergebnisse = gr.map((g) => planeGruppe(g, formateAus[g.material.id] || []));
  const kostenListe = gr.map((g, i) => (preise && ergebnisse[i].plan.moeglich && ergebnisse[i].plan.bleche.length
    ? kosten(ergebnisse[i].plan.bleche, g.material, g.dicke, preise) : null));

  const liste = `<section class="d-blatt">${kopfHtml(kopf, positionen, gr, preise)}
    ${gr.map((g, i) => materialHtml(g, ergebnisse[i], i, kostenListe[i], farbeFuer)).join('')}
    ${preise ? summeHtml(gr, ergebnisse, kostenListe) : ''}</section>`;

  // Profile in der Reihenfolge des Auftrags, je Seite vier
  const zuPos = new Map();
  gr.forEach((g, i) => g.positionen.forEach((p) => zuPos.set(p.pos, { p, g, r: ergebnisse[i] })));
  const alle = positionen.map((x, i) => zuPos.get(`P${i + 1}`)).filter(Boolean);
  const seiten = [];
  for (let i = 0; i < alle.length; i += JE_SEITE) {
    const karten = alle.slice(i, i + JE_SEITE).map(({ p, g, r }) => profilHtml(p, g, r, farbeFuer)).join('');
    seiten.push(`<section class="d-blatt d-profile"><div class="d-first"></div>
      <div class="d-seitenkopf"><b>Profile</b><span>${esc(kopf.bauvorhaben || '')}</span><span>${heute()}</span></div>
      <div class="d-raster">${karten}</div></section>`);
  }
  ziel.innerHTML = liste + seiten.join('');

  ziel.querySelectorAll('.blech-bild').forEach((svg) => {
    const r = ergebnisse[Number(svg.dataset.plan)];
    const x = gleicheZusammen(r.plan.bleche)[Number(svg.dataset.blech)];
    if (x) zeichneBlech(svg, x.blech, farbeFuer, MASCHINE.laenge, BLECH);
  });
  ziel.querySelectorAll('.d-schnitt').forEach((svg) => {
    const x = zuPos.get(svg.dataset.pos);
    if (x) zeichne(svg, x.p.profil, -1, PROFIL);
  });

  // Fußzeile mit Seitenzahl, wo der Browser das kann (Chrome, Edge). Safari lässt sie weg.
  let stil = document.getElementById('druck-seite');
  if (!stil) {
    stil = document.createElement('style');
    stil.id = 'druck-seite';
    document.head.append(stil);
  }
  const fuss = ['Hein & Knott Bedachungen · Zuschnittliste', kopf.bauvorhaben, heute()].filter(Boolean).join(' · ')
    .replace(/["\\\n\r]/g, ' ');
  stil.textContent = `@page { @bottom-left { content: "${fuss}"; } @bottom-right { content: "Seite " counter(page) " von " counter(pages); } }`;
}

/** Baut das Druckblatt und öffnet den Druckdialog. */
export async function drucke(daten) {
  baueDruck(document.getElementById('druck'), daten);
  try {
    await Promise.all(SCHRIFTEN.map((s) => document.fonts.load(s)));
  } catch {
    // ohne die Hausschriften druckt der Browser mit Ersatzschriften
  }
  window.print();
}
