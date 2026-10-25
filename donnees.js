// =====================================================================
//  donnees.js — Structure d'une procédure et conversion des anciens
//  brouillons
//
//  VERSION_DONNEES augmente à chaque changement de structure. Les
//  brouillons plus anciens sont convertis à leur ouverture : rien n'est
//  perdu.
// =====================================================================

export const VERSION_DONNEES = 2;

const rubriqueVide = () => ({ texte: '', photos: [] });

// Une procédure toute neuve
export function procedureVide(id, auteur = '') {
  const maintenant = new Date().toISOString();
  return {
    versionDonnees: VERSION_DONNEES,
    id,
    creeLe: maintenant,
    modifieLe: maintenant,
    statut: 'brouillon',

    // 1. Identification
    titre: '',
    equipements: [],          // codes, ex. ["A400", "A410"]
    typeIntervention: '',     // id du type (voir config.json)
    typeAutre: '',            // précision si type "autre"
    dureeH: '',
    dureeMin: '',
    dureeTexte: '',           // ancienne durée V1 non convertible
    nbIntervenants: '',
    auteur,

    // 2. Sécurité
    securite: {
      epi: [],                // ids des EPI cochés
      precisionsEpi: {},      // ex. { gants: "nitrile", autre: "…" }
      produits: [],           // noms des produits
      conditions: [],         // ids des conditions cochées
      precisionsConditions: {},
      vigilance: '',          // points de vigilance généraux
    },

    // 3. Prérequis
    prerequis: { outillage: '', pieces: '' },

    // 4. Mode opératoire
    etapes: [],               // { id, texte, critique, photos: [ids] }
    modeOperatoireClos: false,

    // 5. Fin d'intervention
    fin: { controles: rubriqueVide(), remise: rubriqueVide(), nettoyage: rubriqueVide() },
  };
}

// Convertit un brouillon d'une version précédente.
// Renvoie true si le brouillon a été modifié (il faut alors l'enregistrer).
export function migrerProcedure(p) {
  if (p.versionDonnees === VERSION_DONNEES) return false;

  // ----- V1 -> V2 -----
  const neuve = procedureVide(p.id, p.auteur || '');
  const duree = convertirDuree(p.duree);
  const ancienneSecu = p.securite || {};

  Object.assign(neuve, {
    creeLe: p.creeLe,
    modifieLe: p.modifieLe,
    statut: p.statut || 'brouillon',
    titre: p.titre || '',
    equipements: p.equipement && p.equipement.trim() ? [p.equipement.trim()] : [],
    dureeH: duree.h,
    dureeMin: duree.min,
    dureeTexte: duree.texte,
    prerequis: { outillage: p.outillage || '', pieces: '' },
    etapes: (p.etapes || []).map((e) => ({ id: e.id, texte: e.texte || '', critique: Boolean(e.critique), photos: e.photos || [] })),
  });
  neuve.securite.epi = ancienneSecu.epi || [];
  neuve.securite.conditions = ancienneSecu.conditions || [];
  neuve.securite.vigilance = ancienneSecu.autres || '';

  // On remplace le contenu de l'objet en gardant le même objet
  for (const cle of Object.keys(p)) delete p[cle];
  Object.assign(p, neuve);
  return true;
}

// "45 min" -> {h:'', min:'45'} ; "1h30" -> {h:'1', min:'30'} ; "2 h" -> {h:'2'}
// Si le texte n'est pas compris, il est gardé tel quel dans "texte".
export function convertirDuree(texte) {
  const t = (texte || '').trim().toLowerCase();
  if (!t) return { h: '', min: '', texte: '' };
  let m = t.match(/^(\d+)\s*h(?:eures?)?\s*(\d+)?\s*(?:min(?:utes?)?)?$/);
  if (m) return { h: m[1], min: m[2] || '', texte: '' };
  m = t.match(/^(\d+)\s*(?:min|mn|minutes?)$/);
  if (m) return { h: '', min: m[1], texte: '' };
  return { h: '', min: '', texte: texte.trim() };
}

// {dureeH:'1', dureeMin:'30'} -> "1 h 30 min"
export function dureeLisible(p) {
  const morceaux = [];
  if (p.dureeH) morceaux.push(`${p.dureeH} h`);
  if (p.dureeMin) morceaux.push(`${p.dureeMin} min`);
  return morceaux.join(' ') || p.dureeTexte || '';
}

// Identifiants de toutes les photos d'une procédure
export function toutesLesPhotos(p) {
  const rubriques = Object.values(p.fin || {});
  return [...(p.etapes || []), ...rubriques].flatMap((bloc) => bloc.photos || []);
}

// Lit ou écrit un champ par son chemin, ex. "prerequis.outillage"
export function lireChemin(objet, chemin) {
  return chemin.split('.').reduce((o, cle) => (o == null ? undefined : o[cle]), objet);
}
export function ecrireChemin(objet, chemin, valeur) {
  const cles = chemin.split('.');
  const derniere = cles.pop();
  const parent = cles.reduce((o, cle) => (o[cle] ??= {}), objet);
  parent[derniere] = valeur;
}
