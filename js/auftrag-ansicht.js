// Auftragsansicht: Positionen mit Material und Menge, darunter je Material der Zuschnittplan.

import { gruppen, planeGruppe, stuecke } from './kern/auftrag.js';
import {
  MASCHINE, MATERIALIEN, dickenHinweis, formatName, formatSchluessel, materialMit,
} from './kern/material.js';
import { kopie, normalisiert, zahl, zuschnitt } from './kern/profil.js';
import { gleicheZusammen } from './kern/zuschnittplan.js';
import { zeichneBlech } from './plan-zeichnung.js';

const SPEICHER = 'hk-klempner.auftrag';
const FARBEN = ['#DCE4F0', '#F6E9E1', '#E3F2E9', '#FBF0DC', '#E9E4F2', '#DDEFF0'];
const KREUZ = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ohne Tausenderpunkt: 2000 mm bleibt 2000, sonst läse die Eingabe "2.000" als 2
const dez = (x, stellen = 1) => x.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: stellen });
const mm = (x) => dez(x, 1);

function lade() {
  let roh = null;
  try {
    roh = JSON.parse(localStorage.getItem(SPEICHER));
  } catch {
    roh = null;
  }
  const kopf = { bauvorhaben: '', bearbeiter: '', bemerkung: '', ...(roh && roh.kopf) };
  const positionen = ((roh && roh.positionen) || []).map((p) => {
    const profil = normalisiert(p.profil);
    if (!profil) return null;
    const material = materialMit(p.material);
    const m = p.menge || {};
    return {
      id: String(p.id),
      profil,
      material: material.id,
      dicke: material.dicken.includes(p.dicke) ? p.dicke : material.dicken[0],
      menge: {
        art: m.art === 'lfm' ? 'lfm' : 'stueck',
        anzahl: Number(m.anzahl) || 0,
        laenge: Number(m.laenge) || 0,
        meter: Number(m.meter) || 0,
        ueberdeckung: Number(m.ueberdeckung) || 0,
      },
    };
  }).filter(Boolean);
  return { kopf, positionen, formateAus: (roh && roh.formateAus) || {} };
}

/**
 * @param {{beiBearbeiten: (id: string, profil: object) => void, beiAenderung: () => void}} rueckrufe
 */
export function erstelleAuftrag({ beiBearbeiten, beiAenderung }) {
  let auftrag = lade();

  const sichere = () => {
    try {
      localStorage.setItem(SPEICHER, JSON.stringify(auftrag));
    } catch {
      // ohne Speicher läuft das Tool weiter, der Auftrag ist dann nach dem Schließen weg
    }
    beiAenderung();
  };
  const nummer = (id) => `P${auftrag.positionen.findIndex((p) => p.id === id) + 1}`;
  const farbeFuer = (pos) => FARBEN[(Number(pos.slice(1)) - 1) % FARBEN.length];

  // --- Positionen ---

  function karte(p, i) {
    const material = materialMit(p.material);
    const pos = `P${i + 1}`;
    const stueck = p.menge.art === 'stueck';
    return `<article class="karte position" data-id="${esc(p.id)}">
      <div class="pos-kopf">
        <span class="nr" style="background:${FARBEN[i % FARBEN.length]};color:var(--hk-navy-900)">${pos}</span>
        <div class="pos-titel"><strong>${esc(p.profil.name)}</strong><span>Zuschnitt ${mm(zuschnitt(p.profil))} mm</span></div>
        <button type="button" class="knopf klein" data-aktion="bearbeiten">Profil ändern</button>
        <button type="button" class="weg" data-aktion="entfernen" aria-label="Position ${pos} entfernen">${KREUZ}</button>
      </div>
      <div class="zeile zwei">
        <label class="block"><span>Material</span>
          <select data-feld="material">${MATERIALIEN.map((m) => `<option value="${m.id}"${m.id === material.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
        </label>
        <label class="block"><span>Dicke</span>
          <select data-feld="dicke">${material.dicken.map((d) => `<option value="${d}"${d === p.dicke ? ' selected' : ''}>${dez(d, 2)} mm</option>`).join('')}</select>
        </label>
      </div>
      <div class="mengenart" role="group" aria-label="Art der Mengenangabe">
        <button type="button" class="chip${stueck ? ' an' : ''}" data-art="stueck" aria-pressed="${stueck}">Stück × Länge</button>
        <button type="button" class="chip${stueck ? '' : ' an'}" data-art="lfm" aria-pressed="${!stueck}">Laufende Meter</button>
      </div>
      <div class="menge"${stueck ? '' : ' hidden'}>
        <label class="feld"><input type="text" inputmode="numeric" autocomplete="off" data-feld="anzahl" value="${mm(p.menge.anzahl)}" aria-label="Stückzahl"><span class="einheit">Stück</span></label>
        <span class="mal">×</span>
        <label class="feld"><input type="text" inputmode="numeric" autocomplete="off" data-feld="laenge" value="${mm(p.menge.laenge)}" aria-label="Länge je Stück in mm"><span class="einheit">mm</span></label>
      </div>
      <div class="menge"${stueck ? ' hidden' : ''}>
        <label class="feld"><input type="text" inputmode="decimal" autocomplete="off" data-feld="meter" value="${mm(p.menge.meter)}" aria-label="Laufende Meter"><span class="einheit">m</span></label>
        <label class="feld"><span class="vor">Überdeckung</span><input type="text" inputmode="numeric" autocomplete="off" data-feld="ueberdeckung" value="${mm(p.menge.ueberdeckung)}" aria-label="Überdeckung am Stoß in mm"><span class="einheit">mm</span></label>
      </div>
      <p class="stueckzeile" data-rolle="stuecke"></p>
      <div data-rolle="warnungen"></div>
    </article>`;
  }

  function zeigePositionen() {
    $('positionen').innerHTML = auftrag.positionen.map(karte).join('');
    $('auftrag-leer').hidden = auftrag.positionen.length > 0;
    $('auftrag-leeren').hidden = auftrag.positionen.length === 0;
  }

  // --- Pläne ---

  const stueckText = (liste) => {
    const summe = liste.reduce((s, x) => s + x.n, 0);
    if (!summe) return 'Menge fehlt.';
    return `${summe} Stück: ${liste.map((x) => `${x.n} × ${mm(x.l)} mm`).join(', ')}.`;
  };

  function bedarfText(bleche) {
    const jeFormat = new Map();
    bleche.forEach((o) => {
      const k = formatSchluessel(o.format);
      const e = jeFormat.get(k) || { format: o.format, anzahl: 0, laenge: 0 };
      e.anzahl += 1;
      e.laenge += o.l;
      jeFormat.set(k, e);
    });
    return [...jeFormat.values()].map((e) => (
      e.format.art === 'coil'
        ? `${dez(e.laenge / 1000, 2)} m vom ${formatName(e.format)} (${e.anzahl} ${e.anzahl === 1 ? 'Abschnitt' : 'Abschnitte'})`
        : `${e.anzahl} ${formatName(e.format, e.anzahl)}`
    )).join(', ');
  }

  function planKarte(g, r, nr) {
    const titel = `${esc(g.material.name)} ${dez(g.dicke, 2)} mm`;
    const formate = g.material.formate.map((f) => {
      const k = formatSchluessel(f);
      const an = !(auftrag.formateAus[g.material.id] || []).includes(k);
      return `<label class="haken"><input type="checkbox" data-material="${g.material.id}" data-format="${k}"${an ? ' checked' : ''}> ${formatName(f)}</label>`;
    }).join('');
    const formatBlock = `<details class="formate"><summary>Vorhandene Formate</summary><div class="haken-liste">${formate}</div></details>`;

    if (!r.plan.moeglich) {
      const wer = r.plan.passtNicht.join(', ');
      return `<section class="karte plan"><h2 class="erste">${titel}</h2>
        <p class="hinweis fehler">${esc(wer)} passt in kein vorhandenes Format. Der Zuschnitt ist zu breit oder das Stück zu lang.</p>
        ${formatBlock}</section>`;
    }
    if (!r.plan.bleche.length) return '';

    const prozent = r.verschnittProzent;
    const [wort, farbe] = prozent < 0.05 ? ['Kein Verschnitt', 'gut']
      : prozent < 5 ? ['Wenig Verschnitt', 'gut']
        : prozent < 10 ? ['Verschnitt', 'mittel'] : ['Viel Verschnitt', 'schlecht'];
    const reste = new Map();
    r.plan.summen.reste.forEach((x) => {
      const k = `${x.b} × ${x.l} mm`;
      reste.set(k, (reste.get(k) || 0) + 1);
    });
    const resteText = reste.size
      ? `Brauchbare Reste: ${[...reste].map(([k, n]) => `${n} × ${k}`).join(', ')}.`
      : 'Keine brauchbaren Reste.';

    const bilder = gleicheZusammen(r.plan.bleche).map((x, i) => {
      const o = x.blech;
      const name = o.format.art === 'coil'
        ? `${formatName(o.format)}, Abschnitt ${mm(o.l)} mm`
        : formatName(o.format);
      return `<figure class="blech"><figcaption><b>${x.anzahl}×</b> ${name}</figcaption>
        <svg class="blech-bild" data-plan="${nr}" data-blech="${i}" role="img" aria-label="Schnittplan ${name}"></svg></figure>`;
    }).join('');

    const zeilen = g.positionen.map((p) => (r.stuecke[p.pos] || []).map((s) => `<tr>
        <td><span class="punkt" style="background:${farbeFuer(p.pos)}"></span>${p.pos}</td>
        <td>${esc(p.profil.name)}</td>
        <td class="zahl">${mm(zuschnitt(p.profil))}</td>
        <td class="zahl">${s.n}</td>
        <td class="zahl">${mm(s.l)}</td>
      </tr>`).join('')).join('');

    return `<section class="karte plan">
      <div class="plan-kopf"><h2 class="erste">${titel}</h2><span class="ampel ${farbe}">${wort}</span></div>
      <p class="verschnitt">Bedarf: ${bedarfText(r.plan.bleche)}.</p>
      <p class="plan-text">Verbrauch ${dez(r.verbrauchM2, 2)} m² (${dez(r.verbrauchKg, 1)} kg), davon Verschnitt ${dez(r.verschnittM2, 2)} m² (${dez(prozent, 1)} %). ${resteText}</p>
      <div class="bleche">${bilder}</div>
      <table class="liste">
        <thead><tr><th>Pos.</th><th>Profil</th><th class="zahl">Zuschnitt mm</th><th class="zahl">Stück</th><th class="zahl">Länge mm</th></tr></thead>
        <tbody>${zeilen}</tbody>
      </table>
      ${formatBlock}
    </section>`;
  }

  let ergebnisse = [];

  function zeichnePlaene() {
    document.querySelectorAll('#plaene .blech-bild').forEach((svg) => {
      const r = ergebnisse[Number(svg.dataset.plan)];
      const x = gleicheZusammen(r.plan.bleche)[Number(svg.dataset.blech)];
      if (x) zeichneBlech(svg, x.blech, farbeFuer, MASCHINE.laenge);
    });
  }

  function zeigePlaene() {
    const gr = gruppen(auftrag.positionen);
    ergebnisse = gr.map((g) => planeGruppe(g, auftrag.formateAus[g.material.id] || []));
    $('plaene').innerHTML = gr.map((g, i) => planKarte(g, ergebnisse[i], i)).join('');
    zeichnePlaene();

    // Stückzeile und Warnungen in den Positionskarten
    gr.forEach((g, i) => g.positionen.forEach((p) => {
      const kartenEl = document.querySelector(`#positionen .position[data-id="${CSS.escape(p.id)}"]`);
      if (!kartenEl) return;
      const liste = ergebnisse[i].stuecke[p.pos] || [];
      const gewaehlt = p.menge.art === 'lfm' && ergebnisse[i].laengen[p.pos]
        ? ` Stücklänge ${mm(ergebnisse[i].laengen[p.pos])} mm vom Tool gewählt.` : '';
      kartenEl.querySelector('[data-rolle="stuecke"]').textContent = stueckText(liste) + gewaehlt;
      const warnungen = [];
      const zuDick = dickenHinweis(g.material, g.dicke);
      if (zuDick) warnungen.push(zuDick);
      if (liste.some((s) => s.l > MASCHINE.laenge)) {
        warnungen.push(`Länger als die Arbeitslänge der Maschine (${mm(MASCHINE.laenge)} mm).`);
      }
      const ziel = kartenEl.querySelector('[data-rolle="warnungen"]');
      ziel.innerHTML = '';
      warnungen.forEach((text) => {
        const el = document.createElement('p');
        el.className = 'hinweis warnung';
        el.textContent = text;
        ziel.append(el);
      });
    }));
  }

  function zeige() {
    $('kopf-bauvorhaben').value = auftrag.kopf.bauvorhaben;
    $('kopf-bearbeiter').value = auftrag.kopf.bearbeiter;
    $('kopf-bemerkung').value = auftrag.kopf.bemerkung;
    zeigePositionen();
    zeigePlaene();
  }

  // --- Bedienung ---

  const positionZu = (ziel) => {
    const kartenEl = ziel.closest('.position');
    return kartenEl ? auftrag.positionen.find((p) => p.id === kartenEl.dataset.id) : null;
  };

  ['bauvorhaben', 'bearbeiter', 'bemerkung'].forEach((feld) => {
    $(`kopf-${feld}`).addEventListener('input', (e) => {
      auftrag.kopf[feld] = e.target.value;
      sichere();
    });
  });

  $('positionen').addEventListener('input', (e) => {
    const p = positionZu(e.target);
    const feld = e.target.dataset.feld;
    if (!p || !feld || e.target.tagName !== 'INPUT') return;
    const wert = zahl(e.target.value);
    e.target.closest('.feld').classList.toggle('falsch', !(wert >= 0));
    p.menge[feld] = wert >= 0 ? wert : 0;
    sichere();
    zeigePlaene();
  });

  $('positionen').addEventListener('change', (e) => {
    const p = positionZu(e.target);
    if (!p || e.target.tagName !== 'SELECT') return;
    if (e.target.dataset.feld === 'material') {
      p.material = e.target.value;
      p.dicke = materialMit(p.material).dicken[0];
    } else {
      p.dicke = Number(e.target.value);
    }
    sichere();
    zeige();
  });

  $('positionen').addEventListener('focusin', (e) => {
    if (e.target.matches('input[type="text"]')) e.target.select();
  });

  $('positionen').addEventListener('click', (e) => {
    const p = positionZu(e.target);
    if (!p) return;
    const art = e.target.closest('[data-art]');
    const knopf = e.target.closest('[data-aktion]');
    if (art) {
      p.menge.art = art.dataset.art;
      sichere();
      zeige();
    } else if (knopf && knopf.dataset.aktion === 'entfernen') {
      auftrag.positionen = auftrag.positionen.filter((x) => x !== p);
      sichere();
      zeige();
    } else if (knopf && knopf.dataset.aktion === 'bearbeiten') {
      beiBearbeiten(p.id, kopie(p.profil));
    }
  });

  $('plaene').addEventListener('change', (e) => {
    const haken = e.target.closest('input[data-format]');
    if (!haken) return;
    const { material, format } = haken.dataset;
    const aus = new Set(auftrag.formateAus[material] || []);
    if (haken.checked) aus.delete(format);
    else aus.add(format);
    auftrag.formateAus[material] = [...aus];
    sichere();
    zeigePlaene();
    const offen = document.querySelector(`#plaene input[data-material="${material}"]`);
    if (offen) offen.closest('details').open = true; // die Liste soll beim Abhaken offen bleiben
  });

  $('auftrag-leeren').addEventListener('click', () => {
    if (!window.confirm('Alle Positionen dieses Auftrags entfernen?')) return;
    auftrag = { kopf: { bauvorhaben: '', bearbeiter: auftrag.kopf.bearbeiter, bemerkung: '' }, positionen: [], formateAus: auftrag.formateAus };
    sichere();
    zeige();
  });

  let warteAufBild = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(warteAufBild);
    warteAufBild = requestAnimationFrame(zeichnePlaene);
  }).observe($('plaene'));

  return {
    zeige,
    nummer,
    anzahl: () => auftrag.positionen.length,
    /** Nimmt ein Profil als neue Position auf. Material und Dicke kommen von der letzten Position. */
    fuegeHinzu(profil) {
      const letzte = auftrag.positionen.at(-1);
      const material = letzte ? materialMit(letzte.material) : MATERIALIEN[0];
      const id = `${Date.now().toString(36)}${Math.round(Math.random() * 1e6).toString(36)}`;
      auftrag.positionen.push({
        id,
        profil: kopie(profil),
        material: material.id,
        dicke: letzte ? letzte.dicke : material.dicken[0],
        menge: { art: 'stueck', anzahl: 1, laenge: 2000, meter: 10, ueberdeckung: profil.ueberdeckung || 0 },
      });
      sichere();
      return id;
    },
    ersetzeProfil(id, profil) {
      const p = auftrag.positionen.find((x) => x.id === id);
      if (p) p.profil = kopie(profil);
      sichere();
    },
  };
}
