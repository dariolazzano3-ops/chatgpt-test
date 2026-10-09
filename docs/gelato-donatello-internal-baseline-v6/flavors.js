// Strukturdaten fuer die 41 bestaetigten Eissorten von Gelato Donatello.
// Quelle: AURENTARA_PROJECT_MISSION_V1 Owner-Brief (2026-10-05). Alle 41 Namen
// wurden woertlich im Brief genannt (30 Regular + 11 Specials) und sind daher
// als 'confirmed' gefuehrt - keine Platzhalter. Keine Ernaehrungs-, Allergen-
// oder Alkoholmerkmale ergaenzt, da im Brief nicht belegt.

function slugify(label) {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const REGULAR_LABELS = [
  'After Eight', 'Amarena Kirsch', 'Banane', 'Blauer Engel', 'Buttermilch-Sanddorn',
  'Cookies', 'Dark Chocolate', 'Dubai Eis', 'Erdbeere', 'Haselnuss',
  'Himbeer', 'Joghurt', 'Lemon Crumble', 'Malaga', 'Mango',
  'Mascarpone Pistazien', 'Melone', 'Mocca', 'Mozart Praline', 'Nutella',
  'Oreo Keks', 'Pistazie', 'Raffaello', 'Schokolade', 'Siciliano',
  'Snickers', 'Stracciatella', 'Vanille', 'Yogo Twist', 'Zitrone'
];

const SPECIAL_LABELS = [
  'Açaí', 'Amarena Crunchy', 'Blond Brownie', 'Cointreau', 'Dragon Summer',
  'Guapa', 'Orange Minze', 'Pokémon Party', 'Quark Orange', 'Strawberry Matcha',
  'Zuppa Inglese'
];

function buildFlavors(labels, category) {
  return labels.map((label) => {
    const slug = slugify(label);
    return {
      id: slug,
      slug,
      label,
      category,
      status: 'confirmed'
    };
  });
}

export const FLAVOR_COUNT_CONFIRMED = 41;

export const FLAVORS = [
  ...buildFlavors(REGULAR_LABELS, 'regular'),
  ...buildFlavors(SPECIAL_LABELS, 'special')
];

export function flavorImagePath(slug) {
  return `/assets/images/flavors/${slug}.webp`;
}
