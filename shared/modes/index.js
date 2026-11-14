// Alle Online-Modi. Ein neuer Modus braucht nur eine Datei mit create/onMsg/tick/snapshot/flush/over/results und einen Eintrag hier.
// Kuchenkrieg ist seit V7 der asymmetrische „Käsekuchen-Raub“ (heist.js); V6.1 liegt in der Git-Historie.
import { heist } from './heist.js';
import { royale } from './royale.js';
export const MODES = { kuchenkrieg: heist, royale };
