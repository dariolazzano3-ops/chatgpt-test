// Bestaetigte Kernpreise. Quelle: AURENTARA_PROJECT_MISSION_V1 Owner-Brief
// (2026-10-05). Siehe confirmed-project-inputs.json fuer Herkunft und
// Verifikationsstatus. Nur Werte, die hier stehen, duerfen im Frontend als
// Preis angezeigt werden. Keine erfundenen Becher-Gesamtpreise.

export const KERNPREISE = [
  { key: 'kugel', label: 'Kugel Eis', priceEur: 1.60, display: '1,60 €' },
  { key: 'sahne', label: 'Sahne', priceEur: 1.20, display: '1,20 €' },
  { key: 'sosse', label: 'Sosse', priceEur: 1, display: '1 €' },
  { key: 'creme', label: 'Pistazien-/Haselnusscreme', priceEur: 1.50, display: '1,50 €' },
  { key: 'likoer', label: 'Likoer', priceEur: 1.50, display: '1,50 €' },
  { key: 'streusel', label: 'Streusel', priceEur: 1, display: '1 €' }
];

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
