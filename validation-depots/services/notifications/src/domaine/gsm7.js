// Encodage des SMS. Un seul caractère hors de l'alphabet GSM-7 (ç, ê, ’, «...) fait passer tout le
// message en UCS-2 : 70 caractères par SMS au lieu de 160, donc souvent 2 ou 3 fois plus cher.
// `versGsm7` remplace ces caractères par leur équivalent le plus proche, sans perte de sens.

const BASE = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const EXTENSION = '^{}\\[~]|€\f'; // comptent pour 2 caractères
const GSM = new Set(BASE);
const GSM_EXT = new Set(EXTENSION);

const REMPLACEMENTS = {
  'ç': 'c', 'â': 'a', 'ê': 'e', 'ë': 'e', 'î': 'i', 'ï': 'i', 'ô': 'o', 'û': 'u', 'ÿ': 'y', 'œ': 'oe', 'æ': 'ae',
  'À': 'A', 'Â': 'A', 'È': 'E', 'Ê': 'E', 'Ë': 'E', 'Î': 'I', 'Ï': 'I', 'Ô': 'O', 'Ù': 'U', 'Û': 'U', 'Œ': 'OE', 'Ÿ': 'Y',
  '’': "'", '‘': "'", '“': '"', '”': '"', '«': '"', '»': '"', '–': '-', '—': '-', '…': '...', ' ': ' ', ' ': ' ',
};

export function versGsm7(texte) {
  return [...texte].map((c) => (GSM.has(c) || GSM_EXT.has(c) ? c : REMPLACEMENTS[c] ?? c)).join('');
}

export const encodage = (texte) => ([...texte].every((c) => GSM.has(c) || GSM_EXT.has(c)) ? 'GSM-7' : 'UCS-2');

// Nombre de SMS facturés pour ce texte (un message long est découpé en segments).
export function segments(texte) {
  if (encodage(texte) === 'GSM-7') {
    const n = [...texte].reduce((s, c) => s + (GSM_EXT.has(c) ? 2 : 1), 0);
    return n <= 160 ? 1 : Math.ceil(n / 153);
  }
  const n = texte.length; // unités UTF-16
  return n <= 70 ? 1 : Math.ceil(n / 67);
}
