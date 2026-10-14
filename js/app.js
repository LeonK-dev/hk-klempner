// Eingabemaske für ein Profil: Vorlage wählen, Maße tippen, Schnitt und Zuschnitt sehen.

import {
  ABSCHLUESSE, abschlussAn, aufgehen, ausgerichtet, bewertung, festVon, freiesProfil, gedreht, geklappt,
  gespiegelt, kopie, mitAbschluss, mitFest, mitNeigung, mitSchenkel, neigung, normalisiert,
  ohneSchenkel, pruefe, zahl, zuschnitt,
} from './kern/profil.js';
import { VORLAGEN, ausVorlage, regelZu } from './kern/vorlagen.js';
import { planeKantfolge } from './kern/kantfolge.js';
import { erstelleAuftrag } from './auftrag-ansicht.js';
import {
  UMLEGEN, esc, kantHinweis, lageText, statusKlasse, winkelText,
} from './format.js';
import { zeichne } from './zeichnung.js';

const SPEICHER = {
  entwurf: 'hk-klempner.entwurf',
  profile: 'hk-klempner.profile',
  breite: 'hk-klempner.breite',
};
const BREITEN = [1000, 1250, 670, 650, 600, 500, 400];

const $ = (id) => document.getElementById(id);
const mm = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

function lies(schluessel, ersatz) {
  try {
    const text = localStorage.getItem(schluessel);
    return text ? JSON.parse(text) : ersatz;
  } catch {
    return ersatz;
  }
}

function schreib(schluessel, wert) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    // z. B. privater Modus in Safari: das Tool läuft ohne Speicher weiter
  }
}

let profil = normalisiert(lies(SPEICHER.entwurf, null)) || ausVorlage(VORLAGEN[0]);
let eigene = (lies(SPEICHER.profile, []) || []).map(normalisiert).filter(Boolean);
let breite = BREITEN.includes(lies(SPEICHER.breite, 1000)) ? lies(SPEICHER.breite, 1000) : 1000;
let aktiv = -1;

const KREUZ = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const SCHLOSS = '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

// --- Anzeige ---

function zeigeVorlagen() {
  const gruppen = [...new Set(VORLAGEN.map((v) => v.gruppe))];
  let html = '<option value="">Freies Profil</option>';
  gruppen.forEach((g) => {
    html += `<optgroup label="${g}">`;
    VORLAGEN.filter((v) => v.gruppe === g).forEach((v) => {
      html += `<option value="v:${v.id}">${v.name}</option>`;
    });
    html += '</optgroup>';
  });
  if (eigene.length) {
    html += '<optgroup label="Meine Profile">';
    eigene.forEach((p, i) => {
      html += `<option value="e:${i}"></option>`;
    });
    html += '</optgroup>';
  }
  const auswahl = $('vorlage');
  auswahl.innerHTML = html;
  // Namen eigener Profile als Text setzen, nie als HTML
  eigene.forEach((p, i) => {
    auswahl.querySelector(`option[value="e:${i}"]`).textContent = p.name;
  });
  const eigenIndex = eigene.findIndex((p) => p.name === profil.name);
  auswahl.value = eigenIndex >= 0 ? `e:${eigenIndex}` : profil.vorlage ? `v:${profil.vorlage}` : '';
  $('loeschen').hidden = eigenIndex < 0;
  // Grenzwerte aus den Regeln zur Vorlage, auch wenn das Profil schon abgeändert ist
  const regel = regelZu(profil.vorlage);
  $('vorlage-regel').textContent = regel ? `Regeln: ${regel}` : '';
  $('vorlage-regel').hidden = !regel;
}

function zeigeAbschluesse() {
  ['anfang', 'ende'].forEach((ende) => {
    const auswahl = $(`abschluss-${ende}`);
    auswahl.innerHTML = '<option value="">Kein Abschluss</option>'
      + Object.entries(ABSCHLUESSE).map(([k, a]) => `<option value="${k}">${a.name}</option>`).join('');
    auswahl.value = abschlussAn(profil, ende) || '';
  });
}

function zeigeBreiten() {
  $('breiten').innerHTML = BREITEN.map((b) => (
    `<button type="button" class="chip${b === breite ? ' an' : ''}" data-breite="${b}" aria-pressed="${b === breite}">${b}</button>`
  )).join('');
}

function zeigeSchenkel() {
  const n = profil.schenkel.length;
  const fest = festVon(profil);
  let html = '';
  profil.schenkel.forEach((s, i) => {
    const art = s.art ? `<span class="art">${ABSCHLUESSE[s.art].name}</span>` : '';
    const istFest = i === fest;
    html += `<div class="schenkel" data-i="${i}">
      <span class="nr">${i + 1}</span>
      <label class="feld"><span class="sr">Länge Schenkel ${i + 1} in mm</span>
        <input type="text" inputmode="decimal" autocomplete="off" data-feld="l" value="${mm(s.l)}"><span class="einheit">mm</span></label>
      ${art}
      <button type="button" class="schloss${istFest ? ' an' : ''}" data-aktion="fest" aria-pressed="${istFest}"
        aria-label="Schenkel ${i + 1} in der Zeichnung festhalten" title="In der Zeichnung festhalten">${SCHLOSS}</button>
      <button type="button" class="weg" data-aktion="entfernen" aria-label="Schenkel ${i + 1} entfernen"${n <= 1 ? ' disabled' : ''}>${KREUZ}</button>
    </div>`;
    const k = profil.kantungen[i];
    if (!k) return;
    html += `<div class="kantung" data-i="${i}">
      <span class="kant-name">Kantung</span>
      <label class="feld"><span class="sr">Innenwinkel zwischen Schenkel ${i + 1} und ${i + 2} in Grad</span>
        <input type="text" inputmode="decimal" autocomplete="off" data-feld="w" value="${mm(k.w)}"><span class="einheit">°</span></label>
      <button type="button" class="knopf klein" data-aktion="klappen">umklappen</button>
    </div>`;
  });
  $('schenkel').innerHTML = html;
}

// Kurzes Urteil neben der Kennzahl, darunter ein Satz und wie viel mm am Zuschnitt fehlen oder zu viel sind,
// damit die Breite ganz aufgeht
const AMPEL = {
  passt_nicht: ['Passt nicht', 'schlecht'],
  kein: ['Kein Verschnitt', 'gut'],
  wenig: ['Wenig Verschnitt', 'gut'],
  rest: ['Rest brauchbar', 'gut'],
  mittel: ['Verschnitt', 'mittel'],
  viel: ['Viel Verschnitt', 'schlecht'],
};

function zeigeVerschnitt(b, a) {
  const ampel = $('ampel');
  const satz = $('verschnitt');
  const tipp = $('tipp');
  tipp.hidden = true;
  if (!b) {
    ampel.hidden = true;
    satz.textContent = '';
    return;
  }
  const [wort, farbe] = AMPEL[b.stufe];
  ampel.hidden = false;
  ampel.className = `ampel ${farbe}`;
  ampel.textContent = wort;

  const streifen = `${b.anzahl} Streifen aus ${breite} mm Breite`;
  const anteil = `${mm(b.prozent)} % der Breite`;
  switch (b.stufe) {
    case 'passt_nicht':
      satz.textContent = `Der Zuschnitt ist breiter als ${breite} mm. Bitte eine größere Breite wählen.`;
      break;
    case 'kein':
      satz.textContent = `${streifen}, es bleibt nichts übrig.`;
      break;
    case 'rest':
      satz.textContent = `${streifen}. Übrig bleibt ein Streifen von ${mm(b.rest)} mm, der sich weiterverwenden lässt.`;
      break;
    case 'wenig':
      satz.textContent = `${streifen}. Nur ${mm(b.rest)} mm fallen weg.`;
      break;
    default:
      satz.textContent = `${streifen}. ${mm(b.rest)} mm fallen weg, das sind ${anteil}.`;
  }

  // Ein Streifen mehr ist die Empfehlung, wenn bewertung() sie für lohnend hält
  if (a && (a.weniger || a.mehr)) {
    const zeile = (o, empfohlen) => `<li><b>${o.aenderung > 0 ? '+' : '−'}${mm(Math.abs(o.aenderung))} mm</b>
      <span>auf ${mm(o.zuschnitt)} mm · ${o.anzahl} Streifen${o.rest ? ` · ${mm(o.rest)} mm Rest` : ''}</span>
      ${empfohlen ? '<em>Empfehlung</em>' : ''}</li>`;
    tipp.innerHTML = `<p>So geht die Breite von ${breite} mm ganz auf:</p><ul class="aufgehen">
      ${a.weniger ? zeile(a.weniger, !!b.empfehlung) : ''}${a.mehr ? zeile(a.mehr, false) : ''}</ul>`;
    tipp.hidden = false;
  }
}

function zeigeErgebnis() {
  zeichne($('schnitt'), profil, aktiv);
  const z = zuschnitt(profil);
  $('zuschnitt').textContent = mm(z);

  zeigeVerschnitt(bewertung(z, breite), aufgehen(z, breite));

  const hinweise = pruefe(profil);
  $('hinweise').innerHTML = '';
  hinweise.forEach((h) => {
    const p = document.createElement('p');
    p.className = `hinweis ${h.art}`;
    p.textContent = h.text;
    $('hinweise').append(p);
  });
  document.querySelectorAll('#schenkel .schenkel').forEach((zeile) => {
    const i = Number(zeile.dataset.i);
    zeile.classList.toggle('falsch', hinweise.some((h) => h.schenkel === i));
  });
  document.querySelectorAll('#schenkel .kantung').forEach((zeile) => {
    const i = Number(zeile.dataset.i);
    zeile.classList.toggle('falsch', hinweise.some((h) => h.kantung === i));
  });

  zeigeKantfolge(hinweise.some((h) => h.art === 'fehler'));
  schreib(SPEICHER.entwurf, profil);
}

// Kantfolge an der Maschine: Anschlagtiefe und Biegewinkel groß, weil sie an der ECT eingetippt werden
function zeigeKantfolge(fehlerhaft) {
  const ziel = $('kantfolge');
  if (fehlerhaft) {
    ziel.innerHTML = '<p class="hilfe">Die Kantfolge erscheint, sobald das Profil keine Fehler mehr hat.</p>';
    return;
  }
  const plan = planeKantfolge(profil);
  if (!plan.schritte.length) {
    ziel.innerHTML = '<p class="hilfe">Ein gerades Blech ohne Kantung: nur zuschneiden.</p>';
    return;
  }
  const n = plan.schritte.length;
  const liste = plan.schritte.map((s, i) => {
    const um = s.vorher ? `<li class="kf-umlegen"><b>${UMLEGEN[s.vorher][0]}:</b> ${UMLEGEN[s.vorher][1]}</li>` : '';
    const hinweis = kantHinweis(s);
    return `${um}<li class="kf-schritt ${statusKlasse(s)}">
      <span class="kf-nr">${s.nr}</span>
      <div class="kf-inhalt">
        <div class="kf-werte">
          <span><small>Anschlag</small><b>${mm(s.anschlag)}</b> mm</span>
          <span><small>Biegewinkel</small><b>${winkelText(s)}</b></span>
        </div>
        <p class="kf-text">Kante zwischen ${mm(s.zwischen[0])} und ${mm(s.zwischen[1])} · ${lageText(s)}</p>
        ${hinweis ? `<p class="kf-hinweis">${esc(hinweis)}</p>` : ''}
      </div>
      <div class="kf-knoepfe">
        <button type="button" class="knopf klein" data-hoch="${i}"${i === 0 ? ' disabled' : ''} aria-label="Schritt ${s.nr} früher">↑</button>
        <button type="button" class="knopf klein" data-runter="${i}"${i === n - 1 ? ' disabled' : ''} aria-label="Schritt ${s.nr} später">↓</button>
      </div>
    </li>`;
  }).join('');
  const umlegen = plan.umlegen === 0 ? 'ohne Umlegen' : plan.umlegen === 1 ? 'einmal umlegen' : `${plan.umlegen}-mal umlegen`;
  ziel.innerHTML = `<p class="hilfe">An der ECT zuerst den Zuschnitt <b>${mm(zuschnitt(profil))} mm</b> eingeben, dann je Schritt
      Anschlagtiefe und Biegewinkel. ${n} ${n === 1 ? 'Schritt' : 'Schritte'}, ${umlegen}.</p>
    ${plan.vonHand ? '<p class="kf-hand">Reihenfolge von Hand festgelegt. <button type="button" class="knopf klein" data-automatisch>Wieder automatisch</button></p>' : ''}
    <ol class="kf-liste">${liste}</ol>
    <p class="hilfe klein">Ob etwas an den Wangen anstößt, rechnet das Tool mit den Maßen aus dem Schechtl-Prospekt.
      Mit den Pfeilen lässt sich die Reihenfolge ändern.</p>`;
}

$('kantfolge').addEventListener('click', (e) => {
  const knopf = e.target.closest('button');
  if (!knopf) return;
  if (knopf.hasAttribute('data-automatisch')) {
    delete profil.kantfolge;
  } else {
    const folge = planeKantfolge(profil).schritte.map((s) => s.kantung);
    const i = Number(knopf.dataset.hoch ?? knopf.dataset.runter);
    const j = knopf.dataset.hoch !== undefined ? i - 1 : i + 1;
    if (j < 0 || j >= folge.length) return;
    [folge[i], folge[j]] = [folge[j], folge[i]];
    profil.kantfolge = folge;
  }
  zeigeErgebnis();
});

function zeigeAlles() {
  $('name').value = profil.name;
  $('lage').value = mm(neigung(profil));
  $('lage').closest('.feld').classList.remove('falsch');
  $('fest-titel').textContent = `Schenkel ${festVon(profil) + 1} steht fest`;
  zeigeVorlagen();
  zeigeAbschluesse();
  zeigeBreiten();
  zeigeSchenkel();
  zeigeErgebnis();
}

function melde(text) {
  $('meldung').textContent = text;
}

// --- Bedienung ---

function setze(neu) {
  profil = neu;
  aktiv = -1;
  melde('');
  zeigeAlles();
}

$('vorlage').addEventListener('change', (e) => {
  const wert = e.target.value;
  if (wert.startsWith('v:')) setze(ausVorlage(VORLAGEN.find((v) => v.id === wert.slice(2))));
  else if (wert.startsWith('e:')) setze(kopie(eigene[Number(wert.slice(2))]));
  else setze(freiesProfil());
});

$('lage').addEventListener('input', (e) => {
  const wert = zahl(e.target.value);
  e.target.closest('.feld').classList.toggle('falsch', Number.isNaN(wert));
  if (Number.isNaN(wert)) return;
  profil = mitNeigung(profil, wert);
  zeigeErgebnis();
});

$('name').addEventListener('input', (e) => {
  profil.name = e.target.value;
  schreib(SPEICHER.entwurf, profil);
});

$('schenkel').addEventListener('input', (e) => {
  const feld = e.target.dataset.feld;
  if (!feld) return;
  const i = Number(e.target.closest('[data-i]').dataset.i);
  const wert = zahl(e.target.value);
  if (feld === 'l') profil.schenkel[i].l = wert;
  else profil.kantungen[i].w = wert;
  zeigeErgebnis();
});

$('schenkel').addEventListener('focusin', (e) => {
  const zeile = e.target.closest('.schenkel');
  aktiv = zeile ? Number(zeile.dataset.i) : -1;
  if (e.target.matches('input')) e.target.select();
  zeichne($('schnitt'), profil, aktiv);
});

$('schenkel').addEventListener('focusout', () => {
  aktiv = -1;
  zeichne($('schnitt'), profil, aktiv);
});

$('schenkel').addEventListener('click', (e) => {
  const knopf = e.target.closest('[data-aktion]');
  if (!knopf) return;
  const i = Number(knopf.closest('[data-i]').dataset.i);
  if (knopf.dataset.aktion === 'entfernen') {
    setze(ohneSchenkel(profil, i));
  } else if (knopf.dataset.aktion === 'klappen') {
    profil = geklappt(profil, i);
    zeigeErgebnis();
  } else if (knopf.dataset.aktion === 'fest') {
    setze(mitFest(profil, i));
  }
});

$('schnitt').addEventListener('click', (e) => {
  const griff = e.target.closest('.griff');
  if (!griff) return;
  const feld = document.querySelector(`#schenkel .schenkel[data-i="${griff.dataset.i}"] input`);
  if (feld) feld.focus();
});

$('breiten').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-breite]');
  if (!chip) return;
  breite = Number(chip.dataset.breite);
  schreib(SPEICHER.breite, breite);
  zeigeBreiten();
  zeigeErgebnis();
});

['anfang', 'ende'].forEach((ende) => {
  $(`abschluss-${ende}`).addEventListener('change', (e) => {
    setze(mitAbschluss(profil, ende, e.target.value || null));
  });
});

document.querySelector('.eingabe').addEventListener('click', (e) => {
  const knopf = e.target.closest('[data-aktion]');
  if (!knopf || knopf.closest('#schenkel')) return; // die Zeilen der Liste haben ihren eigenen Griff
  switch (knopf.dataset.aktion) {
    case 'schenkel-anfang': setze(mitSchenkel(profil, 'anfang')); break;
    case 'schenkel-ende': setze(mitSchenkel(profil, 'ende')); break;
    case 'waagerecht': setze(ausgerichtet(profil, 'waagerecht')); break;
    case 'senkrecht': setze(ausgerichtet(profil, 'senkrecht')); break;
    case 'sicht': setze({ ...kopie(profil), sicht: -profil.sicht }); break;
    case 'drehen': setze(gedreht(profil, 90)); break;
    case 'spiegeln': setze(gespiegelt(profil)); break;
    case 'uebernehmen': uebernimm(); break;
    case 'speichern': speichere(); break;
    case 'loeschen': loesche(); break;
    default:
  }
});

function speichere() {
  const name = profil.name.trim();
  if (!name) {
    melde('Bitte erst eine Bezeichnung eintragen.');
    $('name').focus();
    return;
  }
  if (pruefe(profil).some((h) => h.art === 'fehler')) {
    melde('Das Profil hat noch Fehler und wurde nicht gespeichert.');
    return;
  }
  const eintrag = { ...kopie(profil), name };
  const i = eigene.findIndex((p) => p.name === name);
  if (i >= 0) eigene[i] = eintrag;
  else eigene.push(eintrag);
  schreib(SPEICHER.profile, eigene);
  profil.name = name;
  zeigeAlles();
  melde(i >= 0 ? `„${name}“ wurde überschrieben.` : `„${name}“ ist auf diesem Gerät gespeichert.`);
}

function loesche() {
  const i = eigene.findIndex((p) => p.name === profil.name);
  if (i < 0) return;
  const name = eigene[i].name;
  eigene.splice(i, 1);
  schreib(SPEICHER.profile, eigene);
  zeigeAlles();
  melde(`„${name}“ wurde aus den gespeicherten Profilen gelöscht. Die Eingabe bleibt stehen.`);
}

// --- Auftrag: zweite Ansicht neben dem Profil ---

let bearbeiteId = null; // Position, deren Profil gerade geändert wird

const auftrag = erstelleAuftrag({
  beiBearbeiten: (id, p) => {
    profil = p;
    bearbeiteId = id;
    zeigeAnsicht('profil');
    melde(`Du änderst das Profil von Position ${auftrag.nummer(id)}. Unten auf „aktualisieren“ tippen, wenn es passt.`);
  },
  beiAenderung: zeigeWeiter,
});

function zeigeWeiter() {
  $('uebernehmen').textContent = bearbeiteId
    ? `Position ${auftrag.nummer(bearbeiteId)} aktualisieren`
    : 'In den Auftrag übernehmen';
  const n = auftrag.anzahl();
  $('auftrag-zahl').textContent = n ? ` (${n})` : '';
}

function zeigeAnsicht(name) {
  if (name === 'auftrag') bearbeiteId = null; // wer zum Auftrag wechselt, bricht das Ändern ab
  $('ansicht-profil').hidden = name !== 'profil';
  $('ansicht-auftrag').hidden = name !== 'auftrag';
  document.querySelectorAll('.reiter-knopf').forEach((k) => {
    const an = k.dataset.ansicht === name;
    k.classList.toggle('an', an);
    k.setAttribute('aria-pressed', an);
  });
  if (name === 'auftrag') {
    auftrag.zeige();
  } else {
    aktiv = -1;
    melde('');
    zeigeAlles();
  }
  zeigeWeiter();
  window.scrollTo(0, 0);
}

function uebernimm() {
  if (pruefe(profil).some((h) => h.art === 'fehler')) {
    melde('Das Profil hat noch Fehler. Bitte erst die rot markierten Felder ausfüllen.');
    return;
  }
  if (bearbeiteId) auftrag.ersetzeProfil(bearbeiteId, profil);
  else auftrag.fuegeHinzu(profil);
  zeigeAnsicht('auftrag');
}

document.addEventListener('click', (e) => {
  const knopf = e.target.closest('[data-ansicht]');
  if (knopf) zeigeAnsicht(knopf.dataset.ansicht);
});

// iPhone und iPad: Bei offener Tastatur verschiebt Safari den sichtbaren Ausschnitt, ohne dass
// die Seite gescrollt wird. Die oben klebende Zeichnung läge dann außerhalb des Sichtbaren.
// Darum rückt sie um genau dieses Stück nach unten und wird flacher, solange getippt wird.
if (window.visualViewport) {
  const sicht = window.visualViewport;
  const folge = () => {
    document.documentElement.style.setProperty('--sicht-oben', `${Math.max(0, Math.round(sicht.offsetTop))}px`);
    const tastatur = sicht.height < window.innerHeight - 120;
    if (tastatur !== document.body.classList.contains('tastatur')) {
      document.body.classList.toggle('tastatur', tastatur);
      zeichne($('schnitt'), profil, aktiv);
    }
  };
  sicht.addEventListener('resize', folge);
  sicht.addEventListener('scroll', folge);
  folge();
}

// Die Zeichnung rechnet in Bildschirm-Pixeln, also bei neuer Breite neu zeichnen
new ResizeObserver(() => zeichne($('schnitt'), profil, aktiv)).observe($('schnitt'));

zeigeAlles();
zeigeWeiter();
