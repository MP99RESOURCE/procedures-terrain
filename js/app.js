// =====================================================================
//  app.js — Fonctionnement des écrans
//
//  Accueil (liste des brouillons)  <->  Procédure (en-tête + étapes)
//  Chaque modification est enregistrée automatiquement dans le téléphone.
// =====================================================================

import * as db from './stockage.js';
import { compresserPhoto, tournerPhoto } from './photo.js';
import { dicteeDisponible, demarrerDictee, arreterDictee } from './dictee.js';
import { genererWord, partageNatifPossible, partager, telecharger, dateFrancaise } from './export.js';

const $ = (selecteur) => document.querySelector(selecteur);

let config = { equipements: [], champs: {} };
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
  appliquerConfig();
  brancherEvenements();

  // Reprend le brouillon ouvert la dernière fois (utile si Android a
  // fermé l'application pendant la prise de photo)
  const derniere = memoire.lire('procedureOuverte');
  if (derniere && await db.lireProcedure(derniere)) await ouvrirProcedure(derniere);
  else await afficherAccueil();
}

async function chargerConfig() {
  try {
    const reponse = await fetch('config.json');
    const donnees = await reponse.json();
    return { equipements: [], champs: {}, ...donnees };
  } catch (erreur) {
    console.error(erreur);
    afficherToast('⚠ Fichier config.json illisible : ' + erreur.message, 8000);
    return { equipements: [], champs: {} };
  }
}

function appliquerConfig() {
  $('#liste-equipements').innerHTML = config.equipements
    .map((nom) => `<option value="${echapper(nom)}"></option>`).join('');
  $('#ligne-outillage').hidden = config.champs.outillage === false;
  $('#ligne-duree').hidden = config.champs.duree === false;
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

  // Champs de l'en-tête : chaque frappe met à jour la procédure
  document.querySelectorAll('[data-champ]').forEach((champ) => {
    champ.addEventListener('input', () => {
      proc[champ.dataset.champ] = champ.value;
      if (champ.dataset.champ === 'auteur') memoire.ecrire('auteur', champ.value);
      planifierSauvegarde();
    });
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
  const procedures = (await db.listerProcedures())
    .sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));

  $('#liste-brouillons').innerHTML = procedures.length
    ? procedures.map((p) => `
        <button class="carte brouillon" data-procedure="${p.id}">
          <strong>${echapper(p.titre) || '(sans titre)'}</strong>
          <span>${echapper(p.equipement || 'Équipement non précisé')} · ${dateFrancaise(p.creeLe)} ·
            ${p.etapes.length} étape${p.etapes.length > 1 ? 's' : ''}</span>
        </button>`).join('')
    : '<p class="aide">Aucun brouillon pour l\'instant.</p>';

  montrerEcran('accueil');
}

async function nouvelleProcedure() {
  const maintenant = new Date().toISOString();
  const nouvelle = {
    id: db.nouvelId(),
    creeLe: maintenant,
    modifieLe: maintenant,
    statut: 'brouillon',
    titre: '',
    equipement: '',
    auteur: memoire.lire('auteur') || '',
    outillage: '',
    duree: '',
    securite: { epi: [], conditions: [], autres: '' },
    etapes: [],
  };
  await db.enregistrerProcedure(nouvelle);
  await ouvrirProcedure(nouvelle.id);
  $('#champ-titre').focus();
}

// =====================================================================
//  ÉCRAN PROCÉDURE
// =====================================================================
async function ouvrirProcedure(id) {
  proc = await db.lireProcedure(id);
  memoire.ecrire('procedureOuverte', id);

  document.querySelectorAll('[data-champ]').forEach((champ) => {
    champ.value = proc[champ.dataset.champ] || '';
  });
  $('#texte-date').textContent = dateFrancaise(proc.creeLe);
  // En-tête replié quand la procédure a déjà des étapes
  $('#bloc-entete').open = proc.etapes.length === 0;
  $('#etat-sauvegarde').textContent = '';

  await afficherEtapes();
  montrerEcran('procedure');
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

// ---------- Affichage des étapes ----------
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
      <label>Note
        <textarea data-note rows="3" placeholder="Décrivez l'action…">${echapper(etape.texte)}</textarea>
      </label>
      <div class="rangee">
        <button class="btn btn-secondaire btn-micro" data-action="dicter">🎤 Dicter</button>
      </div>
      <p class="info-micro"></p>
    </div>`).join('');

  $('#aide-etapes').hidden = proc.etapes.length > 0;
  majMicros();
}

// Retrouve l'étape correspondant à un bouton ou un champ
function etapeDe(element) {
  const id = element.closest('[data-etape]').dataset.etape;
  return proc.etapes.find((e) => e.id === id);
}

// ---------- Actions sur les étapes ----------
function nouvelleEtape() {
  const etape = { id: db.nouvelId(), texte: '', critique: false, photos: [] };
  proc.etapes.push(etape);
  etapeCible = etape.id;
  // L'appareil photo doit s'ouvrir tout de suite, dans le geste de l'utilisateur
  $('#entree-camera').click();
  $('#bloc-entete').open = false;
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
      dicter(bouton, etape);
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

// ---------- Dictée ----------
function majMicros() {
  const possible = dicteeDisponible();
  document.querySelectorAll('.btn-micro').forEach((bouton) => {
    bouton.disabled = !possible;
    const info = bouton.closest('.etape').querySelector('.info-micro');
    info.textContent = possible ? '' : 'Hors ligne : utilisez le micro 🎤 du clavier pour dicter.';
  });
}

function dicter(bouton, etape) {
  if (bouton.classList.contains('ecoute')) { arreterDictee(); return; }
  const zone = bouton.closest('.etape').querySelector('[data-note]');

  bouton.classList.add('ecoute');
  bouton.textContent = '🔴 J\'écoute… (toucher pour arrêter)';
  demarrerDictee({
    surTexte(texte) {
      const phrase = texte.charAt(0).toUpperCase() + texte.slice(1);
      zone.value = zone.value.trim() ? zone.value.trimEnd() + ' ' + phrase : phrase;
      etape.texte = zone.value;
      planifierSauvegarde();
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
    $('#bloc-entete').open = true;
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

// Empêche un texte saisi d'être interprété comme du code HTML
function echapper(texte) {
  return String(texte ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

demarrer();
