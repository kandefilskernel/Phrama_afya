// Outils HTTP communs aux services : appels internes authentifiés, lecture et envoi de JSON.
import { timingSafeEqual } from 'node:crypto';

export const ENTETE_JETON = 'x-jeton-interne';

// Comparaison à temps constant du jeton partagé entre services.
export function jetonValide(recu, attendu) {
  if (typeof recu !== 'string' || !attendu) return false;
  const a = Buffer.from(recu);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Client vers un autre service. Lève une erreur portant `statut` (0 si injoignable).
export function clientInterne({ base, jeton, delaiMs = 5000 }) {
  return async function appeler(methode, chemin, corps) {
    let r;
    try {
      r = await fetch(base + chemin, {
        method: methode,
        headers: { [ENTETE_JETON]: jeton, 'content-type': 'application/json' },
        body: corps === undefined ? undefined : JSON.stringify(corps),
        signal: AbortSignal.timeout(delaiMs),
      });
    } catch (e) {
      throw Object.assign(new Error(`${methode} ${chemin} : injoignable (${e.message})`), { statut: 0 });
    }
    const json = await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error(`${methode} ${chemin} : ${r.status} ${json?.erreur ?? ''}`), { statut: r.status });
    return json;
  };
}

export const lireJson = (req, max = 100_000) => new Promise((ok, ko) => {
  let brut = '';
  req.on('data', (c) => {
    brut += c;
    if (brut.length > max) { ko(Object.assign(new Error('Corps trop gros'), { statut: 400 })); req.destroy(); }
  });
  req.on('end', () => {
    if (!brut) return ok({});
    try { ok(JSON.parse(brut)); } catch { ko(Object.assign(new Error('JSON invalide'), { statut: 400 })); }
  });
});

export function envoyerJson(res, code, corps) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corps));
}

// Répète `tache` toutes les `intervalleMs`, sans jamais chevaucher deux exécutions.
export function boucle(tache, intervalleMs, nom) {
  let enCours = false;
  return setInterval(async () => {
    if (enCours) return;
    enCours = true;
    try { await tache(); } catch (e) { console.error(`[${nom}]`, e.message); } finally { enCours = false; }
  }, intervalleMs);
}
