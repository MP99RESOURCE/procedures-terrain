// =====================================================================
//  app.js — Fonctionnement des écrans
//
//  Accueil (liste des brouillons)  <->  Procédure (4 onglets :
//  Infos · Sécurité · Étapes · Fin)
//  Chaque modification est enregistrée automatiquement dans le téléphone.
// =====================================================================

import * as db from './stockage.js';
import { procedureVide, migrerProcedure, lireChemin, ecrireChemin } from './donnees.js';
import { grilleChoix, echapper } from './grille.js';
import { compresserPhoto, tournerPhoto } from './photo.js';
import { dicteeDisponible, demarrerDictee, arreterDictee } from './dictee.js';
import { genererWord, partageNatifPossible, partager, telecharger, dateFrancaise } from './export.js';

const $ = (selecteur) => document.querySelector(selecteur);

let config = null;
let listesPerso = { equipements: [], produits: [] }; // ajouts manuels de l'opérateur
let proc = null;            // procédure actuellement ouverte
let etapeCible = null;      // étape qui recevra la prochaine photo
let fichierExporte = null;  // dernier Word fabriqué
const adressesPhotos = new Map(); // id photo -> adresse d'affichage

// Petite mémoire du navigateur (auteur, dernier brouillon ouvert).
// Protégée : si elle est indisponible, l'appli fonctionne quand même.
const memoire = {
  lire(cle) { try { return localStorage.getItem(cle); } catch { return null; } },
  ecrire(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch { /* sans importance */ } },
  effacer(cle) { try { localStorage.removeItem(cle); } catch { /* sans importance */ } },
};

// =====================================================================
//  DÉMARRAGE
// =====================================================================
async function demarrer() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  db.demanderStockagePersistant();
  config = await chargerConfig();
  listesPerso = await db.lireListesPerso();
  appliquerConfig();
  brancherEvenements();

  // Reprend le brouillon ouvert la dernière fois (utile si Android a
  // fermé l'application pendant la prise de photo)
  const derniere = memoire.lire('procedureOuverte');
  if (derniere && await db.lireProcedure(derniere)) await ouvrirProcedure(derniere);
  else await afficherAccueil();
}

const CONFIG_VIDE = { equipements: [], typesIntervention: [], epi: [], produits: [], conditions: [], champs: {} };

async function chargerConfig() {
  try {
    const reponse = await fetch('config.json');
    const donnees = await reponse.json();
    return { ...CONFIG_VIDE, ...donnees, champs: { ...donnees.champs } };
  } catch (erreur) {
    console.error(erreur);
    afficherToast('⚠ Fichier config.json illisible : ' + erreur.message, 8000);
    return CONFIG_VIDE;
  }
}

// Masque les champs désactivés dans config.json
function appliquerConfig() {
  const champs = config.champs;
  $('#ligne-duree').hidden = champs.duree === false;
  $('#ligne-intervenants').hidden = champs.intervenants === false;
  $('#ligne-outillage').hidden = champs.outillage === false;
  $('#ligne-pieces').hidden = champs.pieces === false;
}

function brancherEvenements() {
  $('#btn-nouvelle-procedure').addEventListener('click', nouvelleProcedure);
  $('#liste-brouillons').addEventListener('click', (e) => {
    const carte = e.target.closest('[data-procedure]');
    if (carte) ouvrirProcedure(carte.dataset.procedure);
  });

  $('#btn-retour').addEventListener('click', retourAccueil);
  $('#btn-supprimer-procedure').addEventListener('click', supprimerProcedureOuverte);
  $('#btn-nouvelle-etape').addEventListener('click', nouvelleEtape);
  $('#btn-exporter').addEventListener('click', exporter);

  // Onglets
  document.querySelectorAll('[data-onglet]').forEach((bouton) => {
    bouton.addEventListener('click', () => afficherOnglet(bouton.dataset.onglet));
  });

  // Champs simples (data-champ = chemin dans la procédure, ex. "prerequis.pieces")
  $('#ecran-procedure').addEventListener('input', (e) => {
    const champ = e.target.closest('[data-champ]');
    if (!champ) return;
    ecrireChemin(proc, champ.dataset.champ, champ.value);
    if (champ.dataset.champ === 'auteur') memoire.ecrire('auteur', champ.value);
    planifierSauvegarde();
  });

  // Grilles de choix (équipements, type d'intervention…)
  $('#ecran-procedure').addEventListener('click', clicGrille);
  $('#btn-ajouter-equipement').addEventListener('click', ajouterEquipement);
  $('#saisie-equipement').addEventListener('keydown', (e) => { if (e.key === 'Enter') ajouterEquipement(); });

  // Compteur d'intervenants − / +
  document.querySelectorAll('[data-pas]').forEach((bouton) => {
    bouton.addEventListener('click', () => {
      const valeur = Math.max(0, (parseInt(proc.nbIntervenants, 10) || 0) + Number(bouton.dataset.pas));
      proc.nbIntervenants = valeur ? String(valeur) : '';
      $('[data-champ="nbIntervenants"]').value = proc.nbIntervenants;
      planifierSauvegarde();
    });
  });

  // Micros des champs de l'onglet Infos (ceux des étapes sont gérés plus bas)
  $('#onglet-infos').addEventListener('click', (e) => {
    const bouton = e.target.closest('.btn-micro');
    if (bouton) dicter(bouton, bouton.closest('.zone-dictee').querySelector('textarea'));
  });

  // Boutons et notes des étapes (un seul "écouteur" pour toute la liste)
  $('#liste-etapes').addEventListener('click', actionEtape);
  $('#liste-etapes').addEventListener('input', (e) => {
    if (!e.target.matches('[data-note]')) return;
    etapeDe(e.target).texte = e.target.value;
    planifierSauvegarde();
  });

  $('#entree-camera').addEventListener('change', photosRecues);
  $('#entree-galerie').addEventListener('change', photosRecues);

  $('#btn-telecharger').addEventListener('click', () => telecharger(fichierExporte));
  $('#btn-partager').addEventListener('click', partagerExport);
  $('#btn-fermer-export').addEventListener('click', () => { $('#fenetre-export').hidden = true; });

  // Le micro dépend du réseau
  window.addEventListener('online', majMicros);
  window.addEventListener('offline', majMicros);

  // Sauvegarde immédiate quand l'appli passe en arrière-plan
  // (par exemple quand l'appareil photo s'ouvre)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && proc) sauverMaintenant();
  });
}

// =====================================================================
//  ÉCRAN ACCUEIL
// =====================================================================
async function afficherAccueil() {
  proc = null;
  const procedures = await db.listerProcedures();
  for (const p of procedures) {
    if (migrerProcedure(p)) await db.enregistrerProcedure(p);
  }
  procedures.sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));

  $('#liste-brouillons').innerHTML = procedures.length
    ? procedures.map((p) => `
        <button class="carte brouillon" data-procedure="${p.id}">
          <strong>${echapper(p.titre) || '(sans titre)'}</strong>
          <span>${echapper(p.equipements.join(', ') || 'Équipement non précisé')} · ${dateFrancaise(p.creeLe)} ·
            ${p.etapes.length} étape${p.etapes.length > 1 ? 's' : ''}</span>
        </button>`).join('')
    : '<p class="aide">Aucun brouillon pour l\'instant.</p>';

  montrerEcran('accueil');
}

async function nouvelleProcedure() {
  const nouvelle = procedureVide(db.nouvelId(), memoire.lire('auteur') || '');
  await db.enregistrerProcedure(nouvelle);
  await ouvrirProcedure(nouvelle.id);
  $('#champ-titre').focus();
}

// =====================================================================
//  ÉCRAN PROCÉDURE
// =====================================================================
async function ouvrirProcedure(id) {
  proc = await db.lireProcedure(id);
  if (migrerProcedure(proc)) await db.enregistrerProcedure(proc);
  memoire.ecrire('procedureOuverte', id);

  // Un équipement saisi à la main dans un ancien brouillon rejoint la
  // liste personnelle, pour qu'il apparaisse dans la grille
  for (const code of proc.equipements) await memoriserPerso('equipements', code);

  document.querySelectorAll('[data-champ]').forEach((champ) => {
    champ.value = lireChemin(proc, champ.dataset.champ) ?? '';
  });
  $('#texte-date').textContent = dateFrancaise(proc.creeLe);
  $('#etat-sauvegarde').textContent = '';

  const ancienneDuree = $('#duree-ancienne');
  ancienneDuree.hidden = !proc.dureeTexte;
  ancienneDuree.textContent = `Durée saisie dans l'ancienne version : « ${proc.dureeTexte} »`;

  afficherGrillesInfos();
  await afficherEtapes();
  montrerEcran('procedure');
  afficherOnglet(proc.etapes.length ? 'etapes' : 'infos');
}

function afficherOnglet(nom) {
  document.querySelectorAll('[data-onglet]').forEach((bouton) => {
    bouton.setAttribute('aria-selected', String(bouton.dataset.onglet === nom));
  });
  document.querySelectorAll('.onglet').forEach((zone) => {
    zone.hidden = zone.id !== 'onglet-' + nom;
  });
  window.scrollTo(0, 0);
}

async function retourAccueil() {
  arreterDictee();
  await sauverMaintenant();
  memoire.effacer('procedureOuverte');
  await afficherAccueil();
}

async function supprimerProcedureOuverte() {
  if (!confirm('Supprimer définitivement ce brouillon et ses photos ?')) return;
  await db.supprimerProcedure(proc);
  memoire.effacer('procedureOuverte');
  await afficherAccueil();
}

// ---------- Onglet Infos : grilles équipements et type ----------
function afficherGrillesInfos() {
  const equipements = [
    ...config.equipements.map((code) => ({ valeur: code, libelle: code })),
    ...listesPerso.equipements
      .filter((code) => !config.equipements.includes(code))
      .map((code) => ({ valeur: code, libelle: code, perso: true })),
  ];
  $('#zone-equipements').innerHTML = grilleChoix('equipements', equipements, proc.equipements);

  const types = config.typesIntervention.map((t) => ({ valeur: t.id, libelle: t.libelle }));
  $('#zone-type').innerHTML = grilleChoix('type', types, [proc.typeIntervention]);

  // Champ "Préciser" si le type choisi le demande (ex. Autre)
  const type = config.typesIntervention.find((t) => t.id === proc.typeIntervention);
  $('#ligne-type-precision').hidden = !(type && type.precision);
  if (type && type.precision) $('#texte-type-precision').textContent = type.precision;
}

// Clic sur un bouton d'une grille
async function clicGrille(evenement) {
  const retirer = evenement.target.closest('[data-retirer]');
  const bouton = evenement.target.closest('.puce[data-valeur]');
  const grille = evenement.target.closest('[data-grille]');
  if (!grille || (!retirer && !bouton)) return;
  const nom = grille.dataset.grille;

  if (retirer) {
    await retirerPerso(nom, retirer.dataset.retirer);
    return;
  }

  const valeur = bouton.dataset.valeur;
  if (nom === 'equipements') {
    basculer(proc.equipements, valeur);
  } else if (nom === 'type') {
    // Choix unique : un second appui désélectionne
    proc.typeIntervention = proc.typeIntervention === valeur ? '' : valeur;
  }
  afficherGrillesInfos();
  planifierSauvegarde();
}

// Ajoute ou retire une valeur d'une liste
function basculer(liste, valeur) {
  const index = liste.indexOf(valeur);
  if (index >= 0) liste.splice(index, 1);
  else liste.push(valeur);
}

async function ajouterEquipement() {
  const saisie = $('#saisie-equipement');
  const code = saisie.value.trim();
  if (!code) return;
  await memoriserPerso('equipements', code);
  if (!proc.equipements.includes(code)) proc.equipements.push(code);
  saisie.value = '';
  afficherGrillesInfos();
  planifierSauvegarde();
}

// Ajoute un élément à la liste personnelle (s'il n'est pas déjà connu)
async function memoriserPerso(liste, valeur) {
  const connus = liste === 'equipements' ? config.equipements : config.produits;
  if (connus.includes(valeur) || listesPerso[liste].includes(valeur)) return;
  listesPerso[liste].push(valeur);
  await db.enregistrerListesPerso(listesPerso);
}

// Retire un ajout manuel de la liste personnelle (et de la procédure)
async function retirerPerso(nomGrille, valeur) {
  if (!confirm(`Retirer « ${valeur} » de votre liste ?`)) return;
  if (nomGrille === 'equipements') {
    listesPerso.equipements = listesPerso.equipements.filter((v) => v !== valeur);
    proc.equipements = proc.equipements.filter((v) => v !== valeur);
    afficherGrillesInfos();
  }
  await db.enregistrerListesPerso(listesPerso);
  planifierSauvegarde();
}

// ---------- Onglet Étapes ----------
async function afficherEtapes() {
  // Prépare l'affichage des photos qui ne le sont pas encore
  for (const etape of proc.etapes) {
    for (const idPhoto of etape.photos) {
      if (!adressesPhotos.has(idPhoto)) {
        const photo = await db.lirePhoto(idPhoto);
        if (photo) adressesPhotos.set(idPhoto, URL.createObjectURL(photo.blob));
      }
    }
  }

  $('#liste-etapes').innerHTML = proc.etapes.map((etape, index) => `
    <div class="carte etape" data-etape="${etape.id}">
      <div class="etape-entete">
        <h3>Étape ${index + 1}</h3>
        <button class="btn btn-secondaire" data-action="supprimer-etape" aria-label="Supprimer l'étape">🗑</button>
      </div>
      <div class="photos">
        ${etape.photos.map((idPhoto) => `
          <div class="photo" data-photo="${idPhoto}">
            <img src="${adressesPhotos.get(idPhoto) || ''}" alt="Photo de l'étape ${index + 1}">
            <div class="photo-actions">
              <button class="btn btn-rond" data-action="tourner-photo" aria-label="Tourner">⟳</button>
              <button class="btn btn-rond" data-action="supprimer-photo" aria-label="Supprimer la photo">✕</button>
            </div>
          </div>`).join('')}
      </div>
      <div class="rangee">
        <button class="btn btn-secondaire" data-action="photo-camera">📷 Photo</button>
        <button class="btn btn-secondaire" data-action="photo-galerie">🖼 Galerie</button>
      </div>
      <div class="zone-dictee">
        <label>Note
          <textarea data-note rows="3" placeholder="Décrivez l'action…">${echapper(etape.texte)}</textarea>
        </label>
        <button class="btn btn-secondaire btn-micro" data-action="dicter">🎤 Dicter</button>
        <p class="info-micro"></p>
      </div>
    </div>`).join('');

  $('#aide-etapes').hidden = proc.etapes.length > 0;
  majMicros();
}

// Retrouve l'étape correspondant à un bouton ou un champ
function etapeDe(element) {
  const id = element.closest('[data-etape]').dataset.etape;
  return proc.etapes.find((e) => e.id === id);
}

function nouvelleEtape() {
  const etape = { id: db.nouvelId(), texte: '', critique: false, photos: [] };
  proc.etapes.push(etape);
  etapeCible = etape.id;
  // L'appareil photo doit s'ouvrir tout de suite, dans le geste de l'utilisateur
  $('#entree-camera').click();
  afficherOnglet('etapes');
  sauverMaintenant();
  afficherEtapes().then(() => faireDefilerVers(etape.id));
}

async function actionEtape(evenement) {
  const bouton = evenement.target.closest('[data-action]');
  if (!bouton) return;
  const etape = etapeDe(bouton);
  const numero = proc.etapes.indexOf(etape) + 1;

  switch (bouton.dataset.action) {
    case 'photo-camera':
      etapeCible = etape.id;
      $('#entree-camera').click();
      break;

    case 'photo-galerie':
      etapeCible = etape.id;
      $('#entree-galerie').click();
      break;

    case 'tourner-photo': {
      const idPhoto = bouton.closest('[data-photo]').dataset.photo;
      const photo = await db.lirePhoto(idPhoto);
      const tournee = await tournerPhoto(photo.blob);
      await db.enregistrerPhoto({ id: idPhoto, ...tournee });
      URL.revokeObjectURL(adressesPhotos.get(idPhoto));
      adressesPhotos.set(idPhoto, URL.createObjectURL(tournee.blob));
      bouton.closest('[data-photo]').querySelector('img').src = adressesPhotos.get(idPhoto);
      break;
    }

    case 'supprimer-photo': {
      if (!confirm('Supprimer cette photo ?')) return;
      const idPhoto = bouton.closest('[data-photo]').dataset.photo;
      etape.photos = etape.photos.filter((id) => id !== idPhoto);
      await db.supprimerPhoto(idPhoto);
      await sauverMaintenant();
      await afficherEtapes();
      break;
    }

    case 'supprimer-etape': {
      if (!confirm(`Supprimer l'étape ${numero} et ses photos ?`)) return;
      arreterDictee();
      for (const idPhoto of etape.photos) await db.supprimerPhoto(idPhoto);
      proc.etapes = proc.etapes.filter((e) => e !== etape);
      await sauverMaintenant();
      await afficherEtapes();
      break;
    }

    case 'dicter':
      dicter(bouton, bouton.closest('.zone-dictee').querySelector('textarea'));
      break;
  }
}

// ---------- Photos reçues de l'appareil photo ou de la galerie ----------
async function photosRecues(evenement) {
  const fichiers = [...evenement.target.files];
  evenement.target.value = ''; // permet de reprendre la même photo
  if (!fichiers.length || !proc) return;

  const etape = proc.etapes.find((e) => e.id === etapeCible) || proc.etapes.at(-1);
  if (!etape) return;

  afficherToast(fichiers.length > 1 ? `Préparation de ${fichiers.length} photos…` : 'Préparation de la photo…');
  for (const fichier of fichiers) {
    try {
      const photo = await compresserPhoto(fichier);
      const id = db.nouvelId();
      await db.enregistrerPhoto({ id, ...photo });
      etape.photos.push(id);
    } catch (erreur) {
      console.error(erreur);
      afficherToast('⚠ Une photo n\'a pas pu être lue');
    }
  }
  await sauverMaintenant();
  await afficherEtapes();
  faireDefilerVers(etape.id);
  masquerToast();
}

// ---------- Dictée (pour n'importe quelle zone de texte) ----------
function majMicros() {
  const possible = dicteeDisponible();
  document.querySelectorAll('.btn-micro').forEach((bouton) => {
    bouton.disabled = !possible;
    const info = bouton.closest('.zone-dictee').querySelector('.info-micro');
    info.textContent = possible ? '' : 'Hors ligne : utilisez le micro 🎤 du clavier pour dicter.';
  });
}

// Ajoute le texte dicté à la fin de la zone, puis signale la saisie
// (le texte est alors enregistré comme si on l'avait tapé)
function dicter(bouton, zone) {
  if (bouton.classList.contains('ecoute')) { arreterDictee(); return; }

  bouton.classList.add('ecoute');
  bouton.textContent = '🔴 J\'écoute… (toucher pour arrêter)';
  demarrerDictee({
    surTexte(texte) {
      const phrase = texte.charAt(0).toUpperCase() + texte.slice(1);
      zone.value = zone.value.trim() ? zone.value.trimEnd() + ' ' + phrase : phrase;
      zone.dispatchEvent(new Event('input', { bubbles: true }));
    },
    surFin() {
      bouton.classList.remove('ecoute');
      bouton.textContent = '🎤 Dicter';
    },
    surErreur(code) {
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        afficherToast('Micro refusé : autorisez le micro pour cette application dans les réglages de Chrome.', 6000);
      } else if (code === 'network') {
        afficherToast('Pas de réseau : utilisez le micro du clavier.', 5000);
      } else {
        afficherToast('Dictée interrompue (' + code + ')');
      }
    },
  });
}

// =====================================================================
//  EXPORT WORD
// =====================================================================
async function exporter() {
  if (!proc.titre.trim()) {
    afficherOnglet('infos');
    $('#champ-titre').focus();
    afficherToast('Indiquez d\'abord un titre.');
    return;
  }
  arreterDictee();

  $('#fenetre-export').hidden = false;
  $('#export-en-cours').hidden = false;
  $('#export-pret').hidden = true;
  $('#export-erreur').hidden = true;

  try {
    await sauverMaintenant();
    fichierExporte = await genererWord(proc, config);
    $('#export-nom').textContent = fichierExporte.name;
    // Le bouton "Partager" n'apparaît que si Android accepte le fichier
    const partageOk = partageNatifPossible(fichierExporte);
    $('#btn-partager').hidden = !partageOk;
    $('#export-aide').hidden = partageOk;
    $('#btn-telecharger').className = partageOk ? 'btn btn-secondaire' : 'btn btn-principal';
    $('#export-pret').hidden = false;
  } catch (erreur) {
    console.error(erreur);
    $('#export-message').textContent = erreur.message || String(erreur);
    $('#export-erreur').hidden = false;
  } finally {
    $('#export-en-cours').hidden = true;
  }
}

async function partagerExport() {
  try {
    await partager(fichierExporte);
  } catch (erreur) {
    if (erreur.name === 'AbortError') return; // l'utilisateur a annulé
    afficherToast('Partage impossible : le fichier est enregistré à la place.');
    telecharger(fichierExporte);
  }
}

// =====================================================================
//  SAUVEGARDE AUTOMATIQUE
// =====================================================================
let minuterieSauvegarde = null;

// Attend une courte pause dans la frappe avant d'enregistrer
function planifierSauvegarde() {
  $('#etat-sauvegarde').textContent = '…';
  clearTimeout(minuterieSauvegarde);
  minuterieSauvegarde = setTimeout(sauverMaintenant, 600);
}

async function sauverMaintenant() {
  clearTimeout(minuterieSauvegarde);
  if (!proc) return;
  proc.modifieLe = new Date().toISOString();
  try {
    await db.enregistrerProcedure(proc);
    $('#etat-sauvegarde').textContent = '✓ Enregistré';
  } catch (erreur) {
    console.error(erreur);
    $('#etat-sauvegarde').textContent = '⚠ Non enregistré';
  }
}

// =====================================================================
//  OUTILS D'AFFICHAGE
// =====================================================================
function montrerEcran(nom) {
  $('#ecran-accueil').hidden = nom !== 'accueil';
  $('#ecran-procedure').hidden = nom !== 'procedure';
  window.scrollTo(0, 0);
}

function faireDefilerVers(idEtape) {
  const carte = document.querySelector(`[data-etape="${idEtape}"]`);
  if (carte) carte.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

let minuterieToast = null;
function afficherToast(message, duree = 3000) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(masquerToast, duree);
}
function masquerToast() { $('#toast').hidden = true; }

demarrer();
