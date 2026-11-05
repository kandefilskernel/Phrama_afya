// Fournisseurs d'envoi. Tous respectent le même contrat :
//   envoyer({ telephone, texte }) -> Promise<{ id }>   (id : référence du message chez le fournisseur)
// En cas d'échec, ils lèvent une ErreurFournisseur. `definitif: true` signifie que réessayer ne servira
// à rien pour CE message (numéro invalide, liste noire) ; sinon le service réessaie plus tard.
//
// Les adaptateurs suivent la documentation publique de chaque fournisseur. Validez-les dans leur
// environnement de test (sandbox) avant la production, et confirmez avec eux la couverture des
// opérateurs en RDC et les règles d'identifiant d'expéditeur.

export class ErreurFournisseur extends Error {
  constructor(message, { definitif = false, code = null } = {}) {
    super(message);
    this.definitif = definitif;
    this.code = code;
  }
}

async function poster(url, { entetes, formulaire, delaiMs, nom }) {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', ...entetes },
      body: new URLSearchParams(formulaire),
      signal: AbortSignal.timeout(delaiMs),
    });
  } catch (e) {
    throw new ErreurFournisseur(`${nom} injoignable : ${e.message}`);
  }
}

async function lire(url, { entetes, delaiMs, nom }) {
  try {
    return await fetch(url, { headers: { accept: 'application/json', ...entetes }, signal: AbortSignal.timeout(delaiMs) });
  } catch (e) {
    throw new ErreurFournisseur(`${nom} injoignable : ${e.message}`);
  }
}

// Écrit le SMS dans le journal au lieu de l'envoyer. Pour le développement.
export const journal = {
  async envoyer({ telephone, texte }) {
    console.log(JSON.stringify({ sms: telephone.replace(/\d(?=\d{3})/g, '•'), texte }));
    return { id: null };
  },
};

// Africa's Talking. username 'sandbox' : environnement de test, aucun SMS réel.
// Statuts par destinataire : 100 traité, 101 envoyé, 102 en file = succès.
const AT_SUCCES = [100, 101, 102];
const AT_DEFINITIFS = [403, 404, 406]; // InvalidPhoneNumber, UnsupportedNumberType, UserInBlacklist
export function africasTalking({ username, apiKey, expediteur = null, base = null, delaiMs = 10_000 }) {
  const racine = base ?? (username === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com');
  return {
    async envoyer({ telephone, texte }) {
      const r = await poster(`${racine}/version1/messaging`, {
        nom: "Africa's Talking", delaiMs,
        entetes: { apiKey },
        formulaire: { username, to: telephone, message: texte, ...(expediteur ? { from: expediteur } : {}) },
      });
      const json = await r.json().catch(() => null);
      if (!r.ok) throw new ErreurFournisseur(`Africa's Talking HTTP ${r.status}`, { code: r.status });
      const dest = json?.SMSMessageData?.Recipients?.[0];
      if (!dest) throw new ErreurFournisseur(`Africa's Talking : ${json?.SMSMessageData?.Message ?? 'réponse inattendue'}`);
      if (AT_SUCCES.includes(dest.statusCode)) return { id: dest.messageId ?? null };
      // 401 RiskHold, 402 InvalidSenderId, 405 InsufficientBalance, 407 CouldNotRoute, 5xx : problème de compte
      // ou passager, à corriger côté configuration ; le message est conservé et réessayé.
      throw new ErreurFournisseur(`Africa's Talking ${dest.statusCode} ${dest.status}`, {
        code: dest.statusCode, definitif: AT_DEFINITIFS.includes(dest.statusCode),
      });
    },

    // Contrôle les identifiants sans envoyer de SMS ni rien facturer.
    async verifierCompte() {
      const r = await lire(`${racine}/version1/user?username=${encodeURIComponent(username)}`, { nom: "Africa's Talking", delaiMs, entetes: { apiKey } });
      if (r.status === 401) throw new ErreurFournisseur("Africa's Talking refuse ces identifiants (clé ou nom d'utilisateur incorrects)", { code: 401 });
      if (!r.ok) throw new ErreurFournisseur(`Africa's Talking HTTP ${r.status}`, { code: r.status });
      const json = await r.json().catch(() => null);
      return { identifiants: 'acceptés', solde: json?.UserData?.balance ?? null };
    },
  };
}

// Twilio. expediteur : un numéro (+...) ou un identifiant de service de messagerie (MG...).
// Erreurs liées au numéro du destinataire : 21211 invalide, 21214 injoignable, 21610 désabonné,
// 21612 non joignable par SMS, 21614 pas un mobile.
const TWILIO_DEFINITIFS = [21211, 21214, 21610, 21612, 21614];
export function twilio({ accountSid, authToken, expediteur, base = 'https://api.twilio.com', delaiMs = 10_000 }) {
  const auth = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
  return {
    async envoyer({ telephone, texte }) {
      const r = await poster(`${base}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
        nom: 'Twilio', delaiMs,
        entetes: { authorization: auth },
        formulaire: { To: telephone, Body: texte, ...(expediteur.startsWith('MG') ? { MessagingServiceSid: expediteur } : { From: expediteur }) },
      });
      const json = await r.json().catch(() => null);
      if (r.ok) return { id: json?.sid ?? null };
      throw new ErreurFournisseur(`Twilio HTTP ${r.status} ${json?.code ?? ''} ${json?.message ?? ''}`.trim(), {
        code: json?.code ?? r.status, definitif: r.status === 400 && TWILIO_DEFINITIFS.includes(json?.code),
      });
    },

    // Contrôle les identifiants sans envoyer de SMS ni rien facturer. `type` vaut Trial (essai, envois limités aux
    // numéros vérifiés) ou Full ; `statut` vaut active, suspended ou closed.
    async verifierCompte() {
      const r = await lire(`${base}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`, { nom: 'Twilio', delaiMs, entetes: { authorization: auth } });
      if (r.status === 401) throw new ErreurFournisseur('Twilio refuse ces identifiants (Account SID ou Auth Token incorrects)', { code: 401 });
      if (r.status === 404) throw new ErreurFournisseur('Twilio ne connaît pas cet Account SID', { code: 404 });
      if (!r.ok) throw new ErreurFournisseur(`Twilio HTTP ${r.status}`, { code: r.status });
      const json = await r.json().catch(() => null);
      return { identifiants: 'acceptés', compte: json?.friendly_name ?? null, statut: json?.status ?? null, type: json?.type ?? null };
    },
  };
}

// Choix du fournisseur à partir de l'environnement. Échoue au démarrage s'il manque une variable :
// mieux vaut un service qui ne démarre pas qu'un service qui perd ses SMS en silence.
export function choisirFournisseur(nom, env = process.env) {
  const exiger = (...vars) => {
    const manquantes = vars.filter((v) => !env[v]);
    if (manquantes.length) throw new Error(`Fournisseur ${nom} : variables manquantes ${manquantes.join(', ')}`);
  };
  switch (nom) {
    case 'journal':
      return journal;
    case 'africastalking':
      exiger('AT_USERNAME', 'AT_API_KEY');
      return africasTalking({ username: env.AT_USERNAME, apiKey: env.AT_API_KEY, expediteur: env.SMS_EXPEDITEUR || null });
    case 'twilio':
      exiger('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'SMS_EXPEDITEUR');
      return twilio({ accountSid: env.TWILIO_ACCOUNT_SID, authToken: env.TWILIO_AUTH_TOKEN, expediteur: env.SMS_EXPEDITEUR });
    default:
      throw new Error(`Fournisseur inconnu : ${nom} (journal, africastalking ou twilio)`);
  }
}
