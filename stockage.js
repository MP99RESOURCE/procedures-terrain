// =====================================================================
//  stockage.js — Sauvegarde locale dans le téléphone (IndexedDB)
//
//  Trois "tiroirs" :
//   - procedures : le texte de chaque brouillon (titre, étapes, notes…)
//   - photos     : les images, rangées à part pour que la sauvegarde
//                  automatique du texte reste rapide
//   - reglages   : les ajouts manuels de l'opérateur (équipements,
//                  produits…), conservés d'une procédure à l'autre
//  Rien n'est envoyé sur Internet.
// =====================================================================

import { toutesLesPhotos } from './donnees.js';

const NOM_BASE = 'procedures-terrain';
const VERSION_BASE = 2; // 1 = V1 ; 2 = ajout du tiroir "reglages"

let basePromise = null;

// Ouvre la base (et la crée au premier lancement)
function ouvrirBase() {
  if (!basePromise) {
    basePromise = new Promise((resoudre, rejeter) => {
      const requete = indexedDB.open(NOM_BASE, VERSION_BASE);
      requete.onupgradeneeded = () => {
        const base = requete.result;
        if (!base.objectStoreNames.contains('procedures')) base.createObjectStore('procedures', { keyPath: 'id' });
        if (!base.objectStoreNames.contains('photos')) base.createObjectStore('photos', { keyPath: 'id' });
        if (!base.objectStoreNames.contains('reglages')) base.createObjectStore('reglages', { keyPath: 'cle' });
      };
      requete.onsuccess = () => resoudre(requete.result);
      requete.onerror = () => rejeter(requete.error);
    });
  }
  return basePromise;
}

// Exécute une opération sur un tiroir et renvoie son résultat
async function operation(tiroir, mode, action) {
  const base = await ouvrirBase();
  return new Promise((resoudre, rejeter) => {
    const transaction = base.transaction(tiroir, mode);
    const requete = action(transaction.objectStore(tiroir));
    transaction.oncomplete = () => resoudre(requete ? requete.result : undefined);
    transaction.onerror = () => rejeter(transaction.error);
  });
}

// ---------- Procédures ----------
export const listerProcedures = () => operation('procedures', 'readonly', (t) => t.getAll());
export const lireProcedure = (id) => operation('procedures', 'readonly', (t) => t.get(id));
export const enregistrerProcedure = (proc) => operation('procedures', 'readwrite', (t) => t.put(proc));

export async function supprimerProcedure(proc) {
  // On supprime aussi toutes ses photos (étapes et fin d'intervention)
  for (const idPhoto of toutesLesPhotos(proc)) await supprimerPhoto(idPhoto);
  await operation('procedures', 'readwrite', (t) => t.delete(proc.id));
}

// ---------- Photos ----------
// photo = { id, blob, largeur, hauteur }
export const lirePhoto = (id) => operation('photos', 'readonly', (t) => t.get(id));
export const enregistrerPhoto = (photo) => operation('photos', 'readwrite', (t) => t.put(photo));
export const supprimerPhoto = (id) => operation('photos', 'readwrite', (t) => t.delete(id));

// ---------- Ajouts manuels de l'opérateur ----------
// listes = { equipements: [...], produits: [...] }
export async function lireListesPerso() {
  const reglage = await operation('reglages', 'readonly', (t) => t.get('listesPerso'));
  return { equipements: [], produits: [], ...(reglage ? reglage.valeur : {}) };
}
export const enregistrerListesPerso = (listes) =>
  operation('reglages', 'readwrite', (t) => t.put({ cle: 'listesPerso', valeur: listes }));

// ---------- Divers ----------
// Identifiant unique (ex. "k3j9x2-a8f1")
export const nouvelId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

// Demande à Android de ne pas effacer les données de l'application
// quand le téléphone manque de place.
export async function demanderStockagePersistant() {
  if (navigator.storage && navigator.storage.persist) {
    try { return await navigator.storage.persist(); } catch { return false; }
  }
  return false;
}
