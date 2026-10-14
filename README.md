# HK Klempner

Web-App für Kantprofile der Dachklempnerei von Hein & Knott Bedachungen: Profil im Schnitt
eingeben, Zuschnitt mit wenig Verschnitt planen, Zuschnittliste für die Werkstatt.

Reines HTML und JavaScript ohne Build. Alle Eingaben bleiben im Browser des Geräts,
es gibt keinen Server und keine Anmeldung.

## Starten am eigenen Rechner

```
python werkzeug/server.py --oeffnen
```

Unter Windows genügt ein Doppelklick auf `HK Klempner starten.bat`.

## Preise

Im Programm stehen keine Preise. Die Einkaufspreise kommen aus einer Preisdatei, die
`werkzeug/preisdatei.py` aus dem Materialstamm erzeugt. Sie wird auf jedem Gerät einzeln
geladen (Reiter „Auftrag“, ganz unten), bleibt im Browser dieses Geräts und geht nie ins Netz.
Ohne Preisdatei zeigt das Tool Fläche und Gewicht.

## Drucken

Im Reiter „Auftrag“ druckt „Drucken“ die Zuschnittliste mit den Schnittplänen und danach die
Profile als Streifen, links die Zeichnung, rechts Zuschnitt und Kantfolge, meist vier je Seite (A4 hoch). Zur Durchsicht ohne Drucker: `tests/druck.html` über den Server öffnen.

„PDF“ daneben macht aus demselben Druckblatt direkt eine PDF-Datei, ohne Druckdialog. Am Handy öffnet
sich danach das Teilen-Menü, am PC wird die Datei heruntergeladen. Dafür lädt das Tool beim ersten Mal
html2canvas und jsPDF von cdnjs nach, das geht nur mit Internet.

## Tests

Im Browser `tests/index.html` über den Server öffnen, oder mit Node.js:

```
node tests/lauf.mjs
```

## Aufbau

| Ordner | Inhalt |
|---|---|
| `js/kern/` | Rechenkern: Profil, Vorlagen, Material, Auftrag, Zuschnittplan, Preise |
| `js/` | Bildschirm: Eingabemaske, Auftragsansicht, Zeichnungen |
| `css/`, `schriften/` | Design |
| `tests/` | Tests des Rechenkerns und eine Übersicht aller Vorlagen |
| `werkzeug/` | kleiner Server für die Entwicklung, Erzeugen der Preisdatei |
