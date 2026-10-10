// Tests für Texte auf dem Druckblatt.

import { folge } from '../js/druck.js';
import { ausVorlage, VORLAGEN } from '../js/kern/vorlagen.js';
import { gleich, test } from './hilfe.js';

const vorlage = (id) => ausVorlage(VORLAGEN.find((v) => v.id === id));

test('Druck: Schenkel von A nach E, der übliche Winkel am Kantenabschluss steckt im Namen', () => {
  gleich(folge(vorlage('traufblech')), 'Umschlag zugedrückt 10 · 70 · 120° · 170');
  gleich(folge(vorlage('ortgangblech')), 'Tropfkante 20 · 110 · 90° · 70');
});

test('Druck: ein anderer Winkel am Kantenabschluss wird genannt', () => {
  // Kappleiste: Tropfkante mit 150° statt der üblichen 135°
  gleich(folge(vorlage('kappleiste')), '15 · 90° · 70 · 150° · Tropfkante 15');
});
