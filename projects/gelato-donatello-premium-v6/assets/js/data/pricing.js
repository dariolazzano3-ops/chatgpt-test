// Owner-bestaetigte Preise und Produktlisten.
// Quelle: aktuelle Gelato-Donatello-Owner-Baseline, 2026-10-05.
// Keine Preise oder Eigenschaften ausserhalb dieser Daten erfinden.

export const KERNPREISE = [
  { key: 'kugel', label: 'Kugel Eis', priceEur: 1.60, display: '1,60 €' },
  { key: 'sahne', label: 'Sahne', priceEur: 1.20, display: '1,20 €' },
  { key: 'sosse', label: 'Soße', priceEur: 1, display: '1,00 €' },
  { key: 'creme', label: 'Pistazien-/Haselnusscreme', priceEur: 1.50, display: '1,50 €' },
  { key: 'likoer', label: 'Likör', priceEur: 1.50, display: '1,50 €' },
  { key: 'streusel', label: 'Streusel', priceEur: 1, display: '1,00 €' }
];

const cup = (label, priceEur, note = '', sourceDuplicate = false) => ({
  label,
  priceEur,
  display: priceEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
  ...(note ? { note } : {}),
  ...(sourceDuplicate ? { sourceDuplicate: true } : {})
});

export const EISBECHER_KATEGORIEN = [
  {
    key: 'kleine-gaeste',
    label: 'Für kleine Gäste',
    items: [
      cup('Smarties', 4.90), cup('Pinocchio', 4.90), cup('Mickey Mouse', 4.90),
      cup('Spaghetti', 4.90), cup('Gummibären', 4.90), cup('Biene Maja', 4.90)
    ]
  },
  {
    key: 'frisch-fruchtig',
    label: 'Frisch & fruchtig',
    items: [
      cup('Kiwi', 7.50), cup('Erdbeer', 7.50), cup('Früchte', 8.50), cup('Coppa Italia', 8.50),
      cup('Mango', 7.50), cup('Ananas', 7.50), cup('Himbeer', 8.50), cup('Waldbeer', 8.50)
    ]
  },
  {
    key: 'nussig-schokoladig',
    label: 'Nussig & schokoladig',
    items: [
      cup('Schoko', 7.00), cup('Stracciatella', 7.00), cup('Karamell', 7.00),
      cup('Cookies', 7.00), cup('Krokant', 7.50), cup('Walnuss', 7.50),
      cup('Haselnuss', 7.50), cup('Nutella', 7.50), cup('Crumble Becher', 7.50),
      cup('Giotto', 8.00), cup('Toffifee', 8.00), cup('Pistazien', 9.00), cup('Mozart Becher', 9.00)
    ]
  },
  {
    key: 'mit-alkohol',
    label: 'Mit Alkohol',
    items: [
      cup('Eierlikör', 7.50), cup('Malaga', 7.50), cup('Tartufo', 8.50),
      cup('Amaretto', 7.50), cup('Banana Cup', 7.50), cup('Schwarzwald', 7.50)
    ]
  },
  {
    key: 'suesse-versuchungen',
    label: 'Süße Versuchungen',
    items: [
      cup('Rocher', 8.50), cup('After Eight', 8.00, 'mit Likör'),
      cup('Raffaello', 8.00), cup('Tartufo', 8.50, 'mit Likör'),
      cup('Banana Split', 8.00), cup('Köllerbacher', 8.50, 'mit Likör'),
      cup('Erdbeer', 7.50), cup('Ananas', 7.50), cup('Früchte', 8.50),
      cup('Nusstraum', 8.50, 'mit Likör')
    ]
  },
  {
    key: 'spaghetti-becher',
    label: 'Spaghetti-Becher',
    items: [
      cup('Spaghettieis', 7.00), cup('Spaghettieis XL', 10.50), cup('Tricolore', 7.00),
      cup('Neri', 7.00), cup('Joghurt', 7.00), cup('Erdbeer', 7.50), cup('Kiwi', 7.50),
      cup('Italia', 8.50), cup('Bonito', 7.50), cup('Amarena', 7.50),
      cup('Carbonara', 7.50), cup('Melone', 7.50), cup('Waldbeer', 8.50)
    ]
  },
  {
    key: 'joghurtbecher',
    label: 'Joghurtbecher',
    sourceNote: 'Waldbeer ist in der aktuellen Owner-Quelle zweimal aufgeführt. Beide Einträge bleiben bis zur finalen Bereinigung erhalten.',
    items: [
      cup('Melone', 7.50), cup('Erdbeer', 7.50), cup('Früchte', 8.50),
      cup('Amarena', 7.50), cup('Ananas', 7.50), cup('Himbeer', 8.50),
      cup('Waldbeer', 8.50), cup('Mango', 7.50), cup('Kiwi', 7.50),
      cup('Italia', 8.50), cup('Banane', 7.50),
      cup('Waldbeer', 8.50, 'erneut in aktueller Quelle', true)
    ]
  }
];

export const EISBECHER_ENTRY_COUNT = EISBECHER_KATEGORIEN.reduce((sum, group) => sum + group.items.length, 0);

const extra = (label, priceEur) => ({
  label,
  priceEur,
  display: priceEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
});

export const EXTRAS_KATEGORIEN = [
  {
    key: 'sossen',
    label: 'Soßen',
    items: ['Schoko', 'Nutella', 'Karamell', 'Mocca', 'Walnuss', 'Amaretto', 'Amarena', 'Erdbeer', 'Himbeer', 'Waldbeer', 'Melone', 'Mango', 'Kiwi'].map((label) => extra(label, 1))
  },
  {
    key: 'cremes',
    label: 'Cremes',
    items: ['Pistaziencreme', 'Haselnusscreme'].map((label) => extra(label, 1.50))
  },
  {
    key: 'likoere',
    label: 'Liköre',
    items: ['Amaretto', 'Eierlikör', 'Nougatlikör', 'Baileys', 'Schokolikör', 'Batida de Coco', 'Kirschwasser', 'Kirschlikör', 'Pfefferminzlikör'].map((label) => extra(label, 1.50))
  },
  {
    key: 'toppings',
    label: 'Streusel & Toppings',
    items: ['dunkle Schokolade', 'weiße Schokolade', 'Nuss Streusel', 'Krokant Streusel', 'Karamell Crumble', 'Butter Crumble', 'Gummibärchen', 'Smarties', 'Marshmallows'].map((label) => extra(label, 1))
  }
];

export const EXTRAS_ENTRY_COUNT = EXTRAS_KATEGORIEN.reduce((sum, group) => sum + group.items.length, 0);

export const EISTORTEN = {
  sizes: [
    { sizeCm: 18, priceEur: 65, display: '65 €' },
    { sizeCm: 20, priceEur: 75, display: '75 €' },
    { sizeCm: 24, priceEur: 95, display: '95 €' },
    { sizeCm: 26, priceEur: 109, display: '109 €' }
  ],
  includedFlavors: 2,
  premiumSurchargeEur: 5,
  premiumSurchargeDisplay: '+5 €'
};

export const EISBOMBEN = {
  sizes: [
    { kugeln: 40, priceEur: 75, display: '75 €' },
    { kugeln: 60, priceEur: 109, display: '109 €' }
  ],
  maxFlavors: 6,
  premiumSurchargeEur: 5,
  premiumSurchargeDisplay: '+5 €'
};

export const EISVITRINE = {
  mieteEur: 250,
  mieteDisplay: '250 €',
  kautionEur: 100,
  kautionDisplay: '100 €',
  eisLiter: 5,
  sorten: 4,
  zubehoerInklusive: true,
  dimensionsCm: 'ca. 90 x 75 x 45'
};
