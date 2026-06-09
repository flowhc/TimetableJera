# Jera On Air Timetable

Statische Timetable-App fuer Jera On Air 2026.

## Funktionen

- Gesamtplan fuer THU, FRI und SAT
- Suche nach Artist oder Buehne
- Buehnenfilter
- Artists per Stern favorisieren
- separate Ansicht fuer den persoenlichen Favoriten-Timetable
- Favoriten werden lokal im Browser gespeichert

## Lokal starten

```sh
python3 -m http.server 4174 --bind 127.0.0.1
```

Danach im Browser oeffnen:

```text
http://127.0.0.1:4174/
```

## Daten

Die Timetable-Daten wurden aus der offiziellen Seite extrahiert:

```text
https://www.jeraonair.nl/de/timetable/
```

Aktueller Datenstand: 2026-06-09.

Falls der offizielle Plan aktualisiert wird, koennen die HTML-Dateien erneut geladen und das Datenmodul neu erzeugt werden:

```sh
curl -L 'https://www.jeraonair.nl/de/timetable/?day=THU' -o /private/tmp/jera_THU.html
curl -L 'https://www.jeraonair.nl/de/timetable/?day=FRI' -o /private/tmp/jera_FRI.html
curl -L 'https://www.jeraonair.nl/de/timetable/?day=SAT' -o /private/tmp/jera_SAT.html
node scripts/export-timetable-data.cjs
```

Zum Abgleich der App-Daten mit den frisch geladenen HTML-Dateien:

```sh
node scripts/check-timetable-data.cjs
```

Hinweis: Im offiziellen HTML ist aktuell ein doppelter `End It`-Eintrag fuer `SAT / Buzzard / 17:00-17:50` enthalten, der exakt mit `Doodseskader` kollidiert. Dieser bekannte CMS-Duplikat-Datensatz wird beim Export ignoriert; `End It` bleibt mit dem Slot `19:00-19:50` enthalten.
