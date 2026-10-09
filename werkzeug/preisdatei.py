"""Preisdatei für HK Klempner aus dem Materialstamm erzeugen.

Aufruf:  python werkzeug/preisdatei.py --stamm <Materialstamm.xlsx> --ziel <Ordner>
                                       [--dtg <DTG_Liste.xlsx>] [--skripte <Ordner mit stamm.py>]

Bleche, Dicken und Formate kommen aus js/kern/material.js. Je Blech, Dicke und Format gilt
die feste Rangfolge des Materialstamms (festgelegt am 30.09. und 06.10.2026):

  1  aktuell: Rechnung oder Angebot, Preisbindung läuft oder höchstens 12 Monate alt,
     davon der günstigste
  2  Altpreis: Rechnung oder Angebot, älter, davon der jüngste
  3  DTG-Liste (unser Einkauf aus der Datanorm), davon der günstigste
  4  geschätzt: Preis je kg oder m² eines anderen Formats desselben Blechs

Angebote für eine bestimmte Baustelle (Stufe 1a) zählen wie jedes andere Angebot, denn ein
Auftrag im Tool hängt an keinem Händlerangebot. Herstellerlisten (UVP) zählen nie.
Was aktuell, alt oder Herstellerliste ist, entscheidet stamm.py, damit die Regel überall
gleich bleibt.

Schreibt preise-JJJJ-MM-TT.json zum Laden im Tool und preisbericht-JJJJ-MM-TT.txt zum
Nachsehen. Beide enthalten Einkaufspreise: nie ins Repository, nie ins Netz.
"""
import argparse
import importlib.util
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path

HIER = Path(__file__).resolve().parent
MATERIAL_JS = HIER.parent / "js" / "kern" / "material.js"
# Abgleich mit der DTG-Liste wie in pflegen-materialstamm: Ein Altpreis, der mehr als 30 % daneben
# liegt, ist vermutlich überholt. Bei einem aktuellen Preis deutet erst Faktor 2 auf eine falsche
# Preiseinheit hin; dass eine Rechnung deutlich unter der Liste liegt, ist sonst normal.
ABWEICHUNG_ALT = 0.30
ABWEICHUNG_AKTUELL = (-0.5, 1.0)

# Woran ein Artikel als Blech des Tools erkannt wird. Geprüft wird die angeglichene
# Bezeichnung (klein, Komma als Punkt, Umlaute ohne Punkte wie in der DTG-Liste).
# ja: alle Muster müssen passen, nein: keins darf passen. dicke: fest statt aus dem Text
# (beim Folienblech steht dort die Dicke mit Folie).
REGELN = {
    "titanzink": dict(ja=[r"zink"], nein=[r"vorbew|blaugr|schiefer|quartz|anthra|graphit|pigment|patina|loch|verzinkt|feinblech"]),
    "titanzink-vorbewittert": dict(ja=[r"zink", r"vorbew|blaugr|schiefer|quartz|anthra|graphit|prepatina"],
                                   nein=[r"loch|pigment|verzinkt|feinblech"]),
    "kupfer": dict(ja=[r"kupfer"], nein=[r"loch|patina|oxid|tecu|verzinnt|vorbew"]),
    "alu-farbig": dict(ja=[r"prefalz|\bprefa\b"], nein=[r"loch"]),
    "farbalu": dict(ja=[r"farbalu|parbalu"], nein=[r"loch|prefa"]),
    "alu-blank": dict(ja=[r"\balu|alumin"],
                      nein=[r"farb|parbalu|anthrazit|prefa|loch|duofalz|vestis|haushaut|stucco|riffel|tranen|warzen"
                            r"|\bral\b|beschicht|eloxiert|schwarz|grau|braun|weiss|kupfer|zink|folie|verbund"]),
    "eisenblech": dict(ja=[r"verz", r"feinblech|eisenblech|stahlblech"], nein=[r"loch|beschicht|ks-|folie|trapez|farb"]),
    "edelstahl": dict(ja=[r"uginox"], nein=[r"loch"]),
    "folienblech-sika": dict(ja=[r"verbund", r"sikaplan"], nein=[r"rolle|coil"], dicke=0.6),
    "folienblech-evalon": dict(ja=[r"verbund", r"evalon"], nein=[r"evalastic|rolle|coil"], dicke=0.6),
    "folienblech-thermofin": dict(ja=[r"verbund", r"thermofin"], nein=[r"rolle|coil"], dicke=0.6),
    "folienblech-wolfin": dict(ja=[r"verbund", r"wolfin"], nein=[r"edelst|cosmofin|tectofin|everguard|rolle|coil"], dicke=0.6),
    "folienblech-elevate": dict(ja=[r"verbund", r"elevate|ultraply"], nein=[r"rolle|coil"], dicke=0.6),
    "lochblech-alu": dict(ja=[r"loch", r"\balu", r"rv ?5-8"], nein=[]),
    "lochblech-zink": dict(ja=[r"loch", r"zink", r"rv ?5-7"], nein=[r"verzinkt|vorbew|blaugr|schiefer"]),
    "lochblech-kupfer": dict(ja=[r"loch", r"kupfer", r"rv ?5-7"], nein=[]),
}
# Was nie ein glattes Blech ist, egal aus welchem Metall
KEIN_BLECH = re.compile(
    r"rinne|rohr|winkel|profil|halter|haken|bogen|stutzen|schelle|kessel|laub|abzweig|wulst|kappe|endst|rost"
    r"|kiesfang|wasserkasten|durchf|entluft|schacht|kuppel|velux|fenster|spray|scheibe|niet|schraube|nagel|kleb"
    r"|dicht|\blot\b|lotzinn|kehl|first|traufe|ortgang|attika|abdeck|anschl|manschette|ablauf|gully|seil|lock"
    r"|limiter|sieb|ecke|blende|gitter|platte|stoss|verbinder|kompri|butyl|haftstreifen|sicherung|randprofil")
BLECH = re.compile(r"tafel|blech|band\b|coil|rolle|\bbd\b")

STUFEN = {1: "aktuell", 2: "Altpreis", 3: "DTG-Liste", 4: "geschätzt"}


# --- material.js lesen ---

def _zahlen(s):
    return [float(x) for x in re.findall(r"\d+(?:\.\d+)?", s)]


def _formate(s):
    aus = []
    for b, l, c in re.findall(r"tafel\((\d+),\s*(\d+)\)|coil\((\d+)\)", s):
        aus.append(("tafel", int(b), int(l)) if b else ("coil", int(c), None))
    return aus


def _feld(block, name, ersatz=None):
    m = re.search(rf"\b{name}:\s*([\d.]+)", block)
    return float(m.group(1)) if m else ersatz


def materialien_lesen(pfad=MATERIAL_JS):
    """Die Bleche des Tools: [{id, name, dichte, faktor, zusatz, dicken, formate}]."""
    text = pfad.read_text(encoding="utf-8")
    liste = re.search(r"export const MATERIALIEN = \[(.*?)\n\];", text, re.S)
    hilfe = re.search(r"const folienblech = .*?\(\{(.*?)\}\);", text, re.S)
    if not liste or not hilfe:
        raise SystemExit(f"{pfad}: Aufbau nicht erkannt (MATERIALIEN oder folienblech). Skript anpassen.")
    aus = []
    muster = r"\n  \{(.*?)\n  \},|\n  folienblech\('([^']+)', '([^']+)', \[(.*?)\]\),"
    for m in re.finditer(muster, liste.group(1), re.S):
        if m.group(1) is not None:
            block = m.group(1)
            mid = re.search(r"\bid: '([^']+)'", block).group(1)
            name = re.search(r"\bname: '([^']+)'", block).group(1)
            formate = _formate(re.search(r"formate: \[(.*?)\]", block, re.S).group(1))
        else:
            block = hilfe.group(1)
            mid, name, formate = f"folienblech-{m.group(2)}", f"Folienblech {m.group(3)}", _formate(m.group(4))
        aus.append(dict(id=mid, name=name, dichte=_feld(block, "dichte"), faktor=_feld(block, "faktor", 1.0),
                        zusatz=_feld(block, "zusatz", 0.0),
                        dicken=_zahlen(re.search(r"dicken: \[([^\]]*)\]", block).group(1)), formate=formate))
    if len(aus) < 5:
        raise SystemExit(f"{pfad}: nur {len(aus)} Bleche erkannt. Skript anpassen.")
    return aus


# --- Bezeichnungen lesen ---

def angleichen(s):
    s = str(s or "").lower().replace(",", ".").replace("×", "x")
    for a, b in (("ä", "a"), ("ö", "o"), ("ü", "u"), ("ß", "ss")):
        s = s.replace(a, b)
    s = re.sub(r"(\d)\.\s+(\d)", r"\1.\2", s)   # "0. 80mm" aus der Texterkennung
    return re.sub(r"(\d)\s*%\s*(\d)", r"\1x\2", s)  # "0.70% 500mm" ebenso


def format_lesen(t):
    """('tafel', b, l) oder ('coil', b, None) aus der Bezeichnung, sonst None."""
    m = re.search(r"(?<![\d.])(\d{3,4})\s*x\s*(\d{3,4})(?!\d)", t)
    if m:
        b, l = sorted((int(m.group(1)), int(m.group(2))))
        if b >= 300 and l <= 6000:
            return ("tafel", b, l)
    m = re.search(r"(?<![\d.])(\d(?:\.\d{1,2})?)\s*m?\s*x\s*(\d(?:\.\d{1,2})?)\s*m\b", t)  # "1x2m", "1.22 m x 3.05 m"
    if m:
        b, l = sorted((round(float(m.group(1)) * 1000), round(float(m.group(2)) * 1000)))
        if b >= 300:
            return ("tafel", b, l)
    if re.search(r"band\b|coil|rolle|\bbd\b", t):
        m = (re.search(r"[x/]\s*(\d{3,4})\s*(?:mm)?(?![\d.])", t)
             or re.search(r"(?<![\d.])(\d{3,4})\s*(?:mm)?\s*x\s*\d\.\d", t))
        if m and 150 <= int(m.group(1)) <= 1250:
            return ("coil", int(m.group(1)), None)
    return None


def dicke_lesen(t):
    for muster in (r"x\s*(\d\.\d{1,2})\s*mm", r"(?<![\d.])(\d\.\d{1,2})\s*(?:mm)?\s*[x/]\s*\d{3}",
                   r"(?<![\d.])(\d\.\d{1,2})\s*mm", r"x\s*(\d\.\d{1,2})(?!\d)"):
        for m in re.finditer(muster, t):
            d = float(m.group(1))
            if 0.3 <= d <= 2.0:
                return round(d, 2)
    return None


def einheit_lesen(e):
    t = str(e or "").strip().lower().rstrip(".")
    if t == "kg":
        return "kg"
    if t in ("m²", "m2", "qm"):
        return "m²"
    if t in ("stk", "st", "stck", "stück", "stueck", "tafel", "tf", "stick"):
        return "Tafel"
    if t in ("m", "lfm", "lfdm", "mtr"):
        return "m"
    return None


def welches_material(t):
    if KEIN_BLECH.search(t) or not BLECH.search(t):
        return []
    return [mid for mid, r in REGELN.items()
            if all(re.search(p, t) for p in r["ja"]) and not any(re.search(p, t) for p in r["nein"])]


# --- Preise ---

def kg_je_m2(mat, dicke):
    return mat["dichte"] * dicke * mat["faktor"] + mat["zusatz"]


def euro_je_m2(preis, einheit, fmt, mat, dicke):
    if einheit == "kg":
        return preis * kg_je_m2(mat, dicke)
    if einheit == "m²":
        return preis
    if einheit == "Tafel" and fmt[0] == "tafel":
        return preis / (fmt[1] * fmt[2] / 1e6)
    if einheit == "m" and fmt[0] == "coil":
        return preis / (fmt[1] / 1000)
    return None


def format_schluessel(fmt):
    return f"coil-{fmt[1]}" if fmt[0] == "coil" else f"tafel-{fmt[1]}x{fmt[2]}"


def format_name(fmt):
    return f"Coil {fmt[1]} breit" if fmt[0] == "coil" else f"Tafel {fmt[1]} × {fmt[2]}"


def de(x, stellen=2):
    return f"{x:,.{stellen}f}".replace(",", " ").replace(".", ",").replace(" ", ".")


def dicke_txt(d):
    return f"{d:g}".replace(".", ",") + " mm"


def als_datum(v):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    try:
        return datetime.strptime(str(v).strip(), "%d.%m.%Y").date()
    except ValueError:
        return None


def stamm_laden(skripte):
    """stamm.py vom Server, damit aktuell / alt / Herstellerliste überall gleich entschieden wird."""
    pfad = Path(skripte) / "stamm.py"
    if not pfad.exists():
        raise SystemExit(f"stamm.py nicht gefunden: {pfad}  (mit --skripte angeben)")
    # Der DTG-Suchcache gehört auf diesen Rechner, nicht auf den Server (stamm.py schreibt sonst nach \tmp)
    lokal = os.environ.get("LOCALAPPDATA")
    os.environ.setdefault("HK_CACHE", str(Path(lokal) / "hk-kalkulation") if lokal else str(Path.home() / ".cache" / "hk-kalkulation"))
    sys.dont_write_bytecode = True  # kein __pycache__ auf dem Server
    spec = importlib.util.spec_from_file_location("stamm", pfad)
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


def kandidaten_sammeln(stamm, stamm_pfad, dtg_pfad, materialien):
    """{(material, dicke, format): [Kandidat]} für alles, was im Stamm und in der DTG-Liste passt."""
    nach_id = {m["id"]: m for m in materialien}
    sammel = {}

    def nimm(text, preis, einheit, quelle):
        t = angleichen(text)
        fmt = format_lesen(t)
        if not fmt or not (preis and preis > 0) or not einheit:
            return
        for mid in welches_material(t):
            mat = nach_id.get(mid)
            if not mat:
                continue
            dicke = REGELN[mid].get("dicke") or dicke_lesen(t)
            if dicke is None:
                continue
            jem2 = euro_je_m2(preis, einheit, fmt, mat, dicke)
            if jem2 is None:
                continue
            sammel.setdefault((mid, dicke, fmt), []).append({**quelle, "preis": round(preis, 4), "einheit": einheit,
                                                              "eurm2": jem2, "bezeichnung": str(text).strip()})

    from openpyxl import load_workbook
    wb = load_workbook(stamm_pfad, read_only=True, data_only=True)
    zeilen = stamm.preise_lesen(wb["Preise"])
    wb.close()
    for e in zeilen:
        if stamm.ist_herstellerliste(e):
            continue
        herkunft = stamm.herkunft(e)
        stufe = {"DTG Liste": 3, "Altpreis": 2}.get(herkunft, 1)
        beleg = str(e.get("angebot") or "").strip()
        if herkunft == "Rechnung":
            beleg = re.sub(r"^RE\s+", "", beleg)
        nimm(e.get("bezeichnung"), stamm.je_einheit(e), einheit_lesen(e.get("einheit")),
             dict(stufe=stufe, herkunft=herkunft, haendler=str(e.get("haendler") or "").strip(),
                  artikel=str(e.get("artikelnummer") or "").strip(), beleg="" if stufe == 3 else beleg,
                  datum=e.get("datum")))

    dtg_stand, dtg_zeilen = stamm.dtg_lesen(str(dtg_pfad)) if Path(dtg_pfad).exists() else (None, [])
    dtg_datum = als_datum(dtg_stand)
    for w in dtg_zeilen:
        d = dict(zip(stamm.DTG_SPALTEN, w))
        if str(d.get("preisart", "")).startswith("prüfen"):
            continue  # Nettopreis über Liste: erst bei DTG nachfragen
        try:
            preis = float(str(d.get("preis_je_einheit") or "").replace(",", "."))
        except ValueError:
            try:
                preis = float(d["preis"].replace(",", ".")) / (float(d["pe"].replace(",", ".") or 1) or 1)
            except (ValueError, KeyError):
                continue
        nimm(d.get("bezeichnung"), preis, einheit_lesen(d.get("einheit")),
             dict(stufe=3, herkunft="DTG Liste", haendler="DTG", artikel=d.get("artikelnummer", ""), beleg="",
                  datum=dtg_datum))
    return sammel, dtg_stand


def waehle(kandidaten):
    for stufe in (1, 2, 3):
        k = [c for c in kandidaten if c["stufe"] == stufe]
        if not k:
            continue
        if stufe == 2:  # der jüngste, bei gleichem Datum der günstigste
            k.sort(key=lambda c: (-(c["datum"].toordinal() if c["datum"] else 0), c["eurm2"]))
        else:
            k.sort(key=lambda c: c["eurm2"])
        return k[0]
    return None


def preis_txt(c):
    return f"{de(c['preis'])} €/{c['einheit']}"


def beleg_txt(c):
    tag = c["datum"].strftime("%d.%m.%Y") if c.get("datum") else ""
    if c["herkunft"] == "DTG Liste":
        return f"DTG-Liste {c['artikel']}" + (f" vom {tag}" if tag else "")
    teile = [c["herkunft"], c["haendler"], c["beleg"]]
    return " ".join(x for x in teile if x) + (f" vom {tag}" if tag else "")


def erzeugen(materialien, sammel):
    """-> (Einträge für die Preisdatei, Zeilen für den Bericht, Hinweise, Fehlendes)"""
    gewaehlt = {}
    for schl, kand in sammel.items():
        c = waehle(kand)
        dtg = min((x for x in kand if x["stufe"] == 3), key=lambda x: x["eurm2"], default=None)
        c = dict(c)
        if c["stufe"] < 3 and dtg:
            abw = c["eurm2"] / dtg["eurm2"] - 1
            text = f"{abs(abw) * 100:.0f} % {'unter' if abw < 0 else 'über'} der DTG-Liste ({preis_txt(dtg)})"
            if c["stufe"] == 2 and abs(abw) > ABWEICHUNG_ALT:
                c["hinweis"] = text
            elif c["stufe"] == 1 and not ABWEICHUNG_AKTUELL[0] <= abw <= ABWEICHUNG_AKTUELL[1]:
                c["hinweis"] = f"{text}, Preiseinheit im Stamm prüfen"
        c["dtg"] = dtg
        gewaehlt[schl] = c

    eintraege, bericht, hinweise, geschaetzt, fehlt = [], [], [], [], []
    for mat in materialien:
        bericht.append(f"\n{mat['name']}  ({mat['id']})")
        for dicke in mat["dicken"]:
            for fmt in mat["formate"]:
                schl = (mat["id"], dicke, fmt)
                c = gewaehlt.get(schl)
                if not c:
                    c = schaetzen(mat, dicke, fmt, gewaehlt)
                kopf = f"  {dicke_txt(dicke):8} {format_name(fmt):20}"
                if not c:
                    bericht.append(f"{kopf} FEHLT – nichts im Stamm, nichts in der DTG-Liste")
                    fehlt.append(f"{mat['name']} {dicke_txt(dicke)} {format_name(fmt)}")
                    continue
                stufe = c["stufe"]
                bericht.append(f"{kopf} {preis_txt(c):>14} = {de(c['eurm2']):>7} €/m²   {stufe} {beleg_txt(c)}")
                if c.get("bezeichnung"):
                    bericht.append(f"{'':32}{c['bezeichnung'][:90]}")
                if c.get("dtg") and stufe < 3:
                    bericht.append(f"{'':32}zum Vergleich DTG-Liste {preis_txt(c['dtg'])}")
                was = f"{mat['name']} {dicke_txt(dicke)} {format_name(fmt)}: {c.get('hinweis')}"
                if stufe == 4:
                    bericht.append(f"{'':32}geschätzt {c['hinweis']}")
                    geschaetzt.append(was)
                elif c.get("hinweis"):
                    bericht.append(f"{'':32}HINWEIS: {c['hinweis']}")
                    hinweise.append(was)
                eintrag = dict(material=mat["id"], dicke=dicke, format=format_schluessel(fmt), preis=c["preis"],
                               einheit=c["einheit"],
                               herkunft="Schätzung" if stufe == 4 else c["herkunft"],
                               haendler=c.get("haendler", ""), artikel=c.get("artikel", ""), beleg=c.get("beleg", ""),
                               datum=c["datum"].isoformat() if c.get("datum") else "",
                               bezeichnung=c.get("bezeichnung", ""))
                if c.get("hinweis"):
                    eintrag["hinweis"] = c["hinweis"]
                eintraege.append(eintrag)
    return eintraege, bericht, hinweise, geschaetzt, fehlt


def schaetzen(mat, dicke, fmt, gewaehlt):
    """Stufe 4: Preis je kg oder m² eines anderen Formats desselben Blechs übernehmen."""
    gleich = [(f, c) for (m, d, f), c in gewaehlt.items() if m == mat["id"] and d == dicke and c["einheit"] in ("kg", "m²")]
    andere = [(f, c, d) for (m, d, f), c in gewaehlt.items() if m == mat["id"] and d != dicke and c["einheit"] == "kg"]
    if gleich:
        gleich.sort(key=lambda fc: (fc[0][0] != fmt[0], fc[1]["stufe"], fc[1]["eurm2"]))
        quelle, c = gleich[0]
        wie = format_name(quelle)
    elif andere:
        andere.sort(key=lambda fcd: (abs(fcd[2] - dicke), fcd[0][0] != fmt[0], fcd[1]["stufe"]))
        quelle, c, d = andere[0]
        wie = f"{format_name(quelle)} {dicke_txt(d)}"
    else:
        return None
    jem2 = euro_je_m2(c["preis"], c["einheit"], fmt, mat, dicke)
    return dict(stufe=4, herkunft="Schätzung", haendler=c.get("haendler", ""), artikel=c.get("artikel", ""), beleg="",
                datum=c.get("datum"), preis=c["preis"], einheit=c["einheit"], eurm2=jem2, bezeichnung="",
                hinweis=f"wie {wie} ({beleg_txt(c)})")


def main():
    ap = argparse.ArgumentParser(description="Preisdatei für HK Klempner aus dem Materialstamm erzeugen")
    ap.add_argument("--stamm", required=True, help="Materialstamm.xlsx")
    ap.add_argument("--ziel", required=True, help="Ordner für Preisdatei und Bericht")
    ap.add_argument("--dtg", help="DTG_Liste.xlsx (Standard: neben dem Stamm)")
    ap.add_argument("--skripte", help="Ordner mit stamm.py (Standard: ..\\_CLAUDE\\Skripte vom Stamm aus)")
    a = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    stamm_pfad = Path(a.stamm)
    if not stamm_pfad.exists():
        raise SystemExit(f"Materialstamm nicht gefunden: {stamm_pfad}")
    dtg_pfad = Path(a.dtg) if a.dtg else stamm_pfad.parent / "DTG_Liste.xlsx"
    skripte = Path(a.skripte) if a.skripte else stamm_pfad.parent.parent / "_CLAUDE" / "Skripte"
    if (stamm_pfad.parent / f"~${stamm_pfad.name}").exists():
        print("Hinweis: Der Materialstamm ist gerade in Excel offen. Gelesen wird der zuletzt gespeicherte Stand.")

    materialien = materialien_lesen()
    stamm = stamm_laden(skripte)
    print("Lese Materialstamm und DTG-Liste …")
    sammel, dtg_stand = kandidaten_sammeln(stamm, stamm_pfad, dtg_pfad, materialien)
    eintraege, bericht, hinweise, geschaetzt, fehlt = erzeugen(materialien, sammel)

    heute = date.today()
    stamm_stand = datetime.fromtimestamp(stamm_pfad.stat().st_mtime).strftime("%d.%m.%Y")
    quelle = f"Materialstamm vom {stamm_stand}" + (f", DTG-Liste ab {dtg_stand}" if dtg_stand else ", ohne DTG-Liste")
    ziel = Path(a.ziel)
    ziel.mkdir(parents=True, exist_ok=True)
    datei = ziel / f"preise-{heute.isoformat()}.json"
    datei.write_text(json.dumps(dict(art="hk-klempner-preise", version=1, stand=heute.isoformat(), quelle=quelle,
                                     preise=eintraege), ensure_ascii=False, indent=1), encoding="utf-8")

    stufen = {}
    for c in eintraege:
        stufen[c["herkunft"]] = stufen.get(c["herkunft"], 0) + 1
    kopf = [f"Preisdatei HK Klempner, Stand {heute.strftime('%d.%m.%Y')}",
            f"Quelle: {quelle}. Einkauf netto.",
            "Rangfolge: 1 aktuell (günstigster) · 2 Altpreis (jüngster) · 3 DTG-Liste (günstigster) · 4 geschätzt",
            f"{len(eintraege)} Preise: " + ", ".join(f"{n} {k}" for k, n in sorted(stufen.items())),
            f"Datei: {datei.name}"]
    schluss = []
    if hinweise:
        schluss += ["", "HINWEISE (Altpreis mehr als 30 % neben der DTG-Liste: neu anfragen. Aktueller Preis um Faktor 2 daneben: Preiseinheit prüfen)"]
        schluss += [f"  - {h}" for h in hinweise]
    if geschaetzt:
        schluss += ["", "GESCHÄTZT (weder im Stamm noch in der DTG-Liste, Preis je kg oder m² eines anderen Formats)"]
        schluss += [f"  - {g}" for g in geschaetzt]
    if fehlt:
        schluss += ["", "FEHLT (Tool zeigt dort keinen Materialpreis)"] + [f"  - {f}" for f in fehlt]
    text = "\n".join(kopf + bericht + schluss) + "\n"
    (ziel / f"preisbericht-{heute.isoformat()}.txt").write_text(text, encoding="utf-8")
    print(text)
    print(f"Geschrieben: {datei}")


if __name__ == "__main__":
    main()
