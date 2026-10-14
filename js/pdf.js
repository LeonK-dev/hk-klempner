// PDF direkt aus dem Druckblatt, ohne Druckdialog (Wunsch von Leon, 14.10.2026). Das Druckblatt wird wie beim
// Drucken gebaut, unsichtbar hinter der Seite in A4-Seiten aufgeteilt und Seite für Seite als Bild in ein PDF
// gelegt. Die Fußzeile mit Seitenzahl schreibt jsPDF als Text dazu, das klappt auch am iPhone.
//
// html2canvas und jsPDF kommen erst beim ersten Tippen auf „PDF“ von cdnjs, darum geht das nur mit Internet.

import { baueDruck, dateiname, fusszeile, schriftenLaden } from './druck.js';

const BIBLIOTHEKEN = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];
// A4 mit denselben Rändern wie @page in css/hk.css
const SEITE = { breite: 210, hoehe: 297, oben: 12, seite: 14, unten: 13 };
const INHALT_MM = SEITE.hoehe - SEITE.oben - SEITE.unten;
const PX_JE_MM = 96 / 25.4;
const SKALA = 3; // etwa 290 dpi, scharf genug für 7-pt-Schrift
const SCHRIFT_DATEIEN = [
  ['Source Sans 3', '200 900', '../schriften/SourceSans3-var-latin.woff2'],
  ['Barlow Condensed', '700', '../schriften/BarlowCondensed-700-latin.woff2'],
];
// Diese Angaben stehen bei den Zeichnungen im Stylesheet und müssen ins Bild mitwandern
const SVG_STILE = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'opacity', 'font-family', 'font-size', 'font-weight', 'font-variant-numeric', 'letter-spacing'];

const geladen = new Map();
function ladeSkript(src) {
  if (!geladen.has(src)) {
    geladen.set(src, new Promise((ok, fehler) => {
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = ok;
      s.onerror = () => {
        geladen.delete(src);
        s.remove();
        fehler(new Error('offline'));
      };
      document.head.append(s);
    }));
  }
  return geladen.get(src);
}

let schriftStil = null;
async function schriftenAlsCss() {
  if (!schriftStil) {
    schriftStil = Promise.all(SCHRIFT_DATEIEN.map(async ([name, gewicht, pfad]) => {
      const daten = new Uint8Array(await (await fetch(new URL(pfad, import.meta.url))).arrayBuffer());
      let roh = '';
      for (let i = 0; i < daten.length; i += 0x8000) roh += String.fromCharCode(...daten.subarray(i, i + 0x8000));
      return `@font-face { font-family: "${name}"; font-weight: ${gewicht}; src: url(data:font/woff2;base64,${btoa(roh)}) format("woff2"); }`;
    })).then((teile) => teile.join('\n')).catch(() => '');
  }
  return schriftStil;
}

// Eine Zeichnung als Bild in dreifacher Auflösung. Die Hausschriften stecken im Bild, sonst fielen die Maßzahlen
// auf eine Ersatzschrift zurück.
async function svgAlsBild(svg, css) {
  const kasten = svg.getBoundingClientRect();
  const kopie = svg.cloneNode(true);
  const quellen = [svg, ...svg.querySelectorAll('*')];
  const ziele = [kopie, ...kopie.querySelectorAll('*')];
  quellen.forEach((q, i) => {
    const cs = getComputedStyle(q);
    ziele[i].setAttribute('style', SVG_STILE.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
  });
  kopie.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  kopie.setAttribute('width', String(kasten.width * SKALA));
  kopie.setAttribute('height', String(kasten.height * SKALA));
  if (css) {
    const stil = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    stil.textContent = css;
    kopie.prepend(stil);
  }
  const bild = new Image();
  bild.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(kopie))}`;
  bild.className = svg.getAttribute('class') || '';
  bild.style.cssText = `display:block;width:${kasten.width}px;height:${kasten.height}px;max-width:none`;
  await bild.decode();
  svg.replaceWith(bild);
}

// Versalien selbst setzen: html2canvas stolpert, wenn aus „ß“ in Versalien „SS“ wird und der Text dadurch länger ist
function versalienSetzen(wurzel) {
  const gross = [...wurzel.querySelectorAll('*')].filter((el) => getComputedStyle(el).textTransform === 'uppercase');
  gross.forEach((el) => {
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) n.data = n.data.toLocaleUpperCase('de-DE');
    });
    el.style.textTransform = 'none';
  });
}

// Höhe eines Elements samt Außenabstand, in px
function hoehe(el) {
  const cs = getComputedStyle(el);
  return el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
}

// Ein Stück ist, was nicht über eine Seitengrenze gehen soll. Ist ein Material länger als eine Seite,
// wird es in Kopf, Reihen von Schnittplänen und Tabellenzeilen zerlegt.
function stueckeVon(blatt, max) {
  const stuecke = [];
  [...blatt.children].forEach((el) => {
    const h = hoehe(el);
    if (h <= max || !el.classList.contains('d-material')) {
      stuecke.push({ knoten: [el], hoehe: h });
      return;
    }
    const kopf = [];
    const teile = [];
    [...el.children].forEach((kind) => {
      if (kind.classList.contains('d-bleche')) {
        // Schnittpläne reihenweise, so wie sie umbrechen
        const reihen = new Map();
        [...kind.children].forEach((fig) => {
          const top = Math.round(fig.getBoundingClientRect().top);
          if (!reihen.has(top)) reihen.set(top, []);
          reihen.get(top).push(fig);
        });
        [...reihen.values()].forEach((figuren) => {
          teile.push({ huelle: el, knoten: figuren, rahmen: kind, hoehe: Math.max(...figuren.map(hoehe)) + 4 * PX_JE_MM });
        });
      } else if (kind.tagName === 'TABLE') {
        [...kind.tBodies[0].rows].forEach((zeile) => {
          teile.push({ huelle: el, knoten: [zeile], tabelle: kind, kopf: kind.tHead, hoehe: zeile.getBoundingClientRect().height });
        });
      } else {
        kopf.push(kind); // Überschrift, Bedarf, Verbrauch, Kosten
      }
    });
    const kopfHoehe = kopf.reduce((sum, k) => sum + hoehe(k), 0) + parseFloat(getComputedStyle(el).marginTop);
    stuecke.push({ huelle: el, knoten: kopf, hoehe: kopfHoehe, mitNaechstem: teile.length > 0, beginn: true }, ...teile);
  });
  return stuecke;
}

// Verteilt die Stücke auf Seiten
function seitenVon(stuecke, max) {
  const seiten = [];
  let seite = [];
  let frei = max;
  // Beginnt eine Tabelle auf der Seite, kommt ihr Tabellenkopf dazu
  const kopfDazu = (st) => (st.tabelle && !seite.some((x) => x.tabelle === st.tabelle)
    ? st.kopf.getBoundingClientRect().height : 0);
  stuecke.forEach((st, i) => {
    const naechstes = st.mitNaechstem && stuecke[i + 1] ? stuecke[i + 1].hoehe : 0;
    if (seite.length && st.hoehe + kopfDazu(st) + naechstes > frei) {
      seiten.push(seite);
      seite = [];
      frei = max;
    }
    frei -= st.hoehe + kopfDazu(st);
    seite.push(st);
  });
  if (seite.length) seiten.push(seite);
  return seiten;
}

// Baut eine Seite aus Kopien der Stücke. Was zu einem zerlegten Material gehört, kommt wieder in eine Hülle.
function seiteBauen(stuecke) {
  const seite = document.createElement('div');
  seite.className = 'druck pdf-seite';
  let huelle = null;
  let tabelle = null;
  let rahmen = null;
  stuecke.forEach((st) => {
    if (!st.huelle) {
      seite.append(st.knoten[0].cloneNode(true));
      huelle = null;
      return;
    }
    if (!huelle || huelle.dataset.quelle !== st.huelle.dataset.pdfNr) {
      huelle = st.huelle.cloneNode(false);
      huelle.dataset.quelle = st.huelle.dataset.pdfNr;
      if (!st.beginn) huelle.style.marginTop = '0';
      seite.append(huelle);
      tabelle = null;
      rahmen = null;
    }
    if (st.tabelle) {
      if (!tabelle) {
        tabelle = st.tabelle.cloneNode(false);
        tabelle.append(st.kopf.cloneNode(true), document.createElement('tbody'));
        huelle.append(tabelle);
      }
      tabelle.tBodies[0].append(st.knoten[0].cloneNode(true));
    } else if (st.rahmen) {
      if (!rahmen) {
        rahmen = st.rahmen.cloneNode(false);
        huelle.append(rahmen);
      }
      st.knoten.forEach((k) => rahmen.append(k.cloneNode(true)));
    } else {
      st.knoten.forEach((k) => huelle.append(k.cloneNode(true)));
      tabelle = null;
      rahmen = null;
    }
  });
  // oben auf der Seite kein Abstand, wie beim Drucken
  const erstes = [...seite.children].find((el) => !el.classList.contains('d-first'));
  if (erstes) erstes.style.marginTop = '0';
  return seite;
}

/**
 * Baut das Druckblatt als PDF und gibt die Datei zurück.
 * @param {object} daten  wie bei drucke() in druck.js
 * @param {(text: string) => void} [fortschritt]
 * @returns {Promise<File>}
 */
export async function erstellePdf(daten, fortschritt = () => {}) {
  fortschritt('Lädt …');
  await Promise.all(BIBLIOTHEKEN.map(ladeSkript));
  const { jsPDF } = window.jspdf;

  // Arbeitsfläche hinter der Seite: sichtbar für den Browser, damit er das Layout rechnet, verdeckt für den Nutzer
  const arbeit = document.createElement('div');
  arbeit.className = 'pdf-arbeit';
  const quelle = document.createElement('div');
  quelle.className = 'druck';
  arbeit.append(quelle);
  document.body.append(arbeit);
  try {
    baueDruck(quelle, daten);
    await schriftenLaden();
    const css = await schriftenAlsCss();
    await Promise.all([...quelle.querySelectorAll('svg')].map((svg) => svgAlsBild(svg, css)));
    versalienSetzen(quelle);
    quelle.querySelectorAll('.d-material').forEach((el, i) => { el.dataset.pdfNr = String(i); });

    const max = INHALT_MM * PX_JE_MM;
    const seiten = [...quelle.querySelectorAll(':scope > .d-blatt')]
      .flatMap((blatt) => seitenVon(stueckeVon(blatt, max), max));

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    pdf.setProperties({ title: dateiname(daten.kopf).replace(/\.pdf$/, ''), author: 'Hein & Knott Bedachungen' });
    const links = fusszeile(daten.kopf);
    for (let i = 0; i < seiten.length; i++) {
      fortschritt(`Seite ${i + 1} von ${seiten.length} …`);
      const seite = seiteBauen(seiten[i]);
      arbeit.append(seite);
      // eslint-disable-next-line no-await-in-loop
      const leinwand = await window.html2canvas(seite, {
        // Fenster breiter als die Seite, damit am Handy nichts umbricht
        scale: SKALA, backgroundColor: '#ffffff', logging: false, windowWidth: 1000, windowHeight: Math.ceil(max) + 200,
      });
      seite.remove();
      if (i > 0) pdf.addPage();
      const breite = SEITE.breite - 2 * SEITE.seite;
      pdf.addImage(leinwand.toDataURL('image/jpeg', 0.9), 'JPEG', SEITE.seite, SEITE.oben, breite,
        (leinwand.height / leinwand.width) * breite);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(91, 104, 121);
      const y = SEITE.hoehe - SEITE.unten + 6;
      pdf.text(links, SEITE.seite, y);
      pdf.text(`Seite ${i + 1} von ${seiten.length}`, SEITE.breite - SEITE.seite, y, { align: 'right' });
    }
    return new File([pdf.output('blob')], dateiname(daten.kopf), { type: 'application/pdf' });
  } finally {
    arbeit.remove();
  }
}

/**
 * Am Handy über das Teilen-Menü (in Dateien sichern, Mail, WhatsApp), am PC als Download.
 * @returns {Promise<'geteilt'|'abgebrochen'|'geladen'|'tippen'>} 'tippen': Safari will dafür noch einmal getippt werden
 */
export async function gibWeiter(datei) {
  const handy = window.matchMedia('(pointer: coarse)').matches;
  if (handy && navigator.canShare && navigator.canShare({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: datei.name });
      return 'geteilt';
    } catch (e) {
      if (e.name === 'AbortError') return 'abgebrochen';
      if (e.name === 'NotAllowedError') return 'tippen'; // das Tippen liegt zu lange zurück
    }
  }
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = datei.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'geladen';
}
