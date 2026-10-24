// =====================================================================
//  export.js — Fabrication du fichier Word et envoi
//
//  Le modèle modele/modele-procedure.docx contient des balises {{…}}
//  que la bibliothèque docx-templates remplace par le contenu de la
//  procédure. Tout se passe dans le téléphone.
// =====================================================================

import { createReport } from './lib/docx-templates.js';
import { lirePhoto } from './stockage.js';

const CHEMIN_MODELE = 'modele/modele-procedure.docx';
const TYPE_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Taille des photos dans le Word (en cm)
const PHOTO_LARGEUR_MAX = 7.9;
const PHOTO_HAUTEUR_MAX = 10.5;

// Date au format JJ/MM/AAAA
export function dateFrancaise(iso) {
  return new Date(iso).toLocaleDateString('fr-FR');
}

// "Jean-Marc Dupont" -> "JMD"
export function initiales(nom) {
  return (nom || '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((mot) => mot[0].toUpperCase())
    .join('');
}

// Retire accents et caractères interdits dans un nom de fichier
function nettoyer(texte, longueurMax = 40) {
  return (texte || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, longueurMax)
    .replace(/-+$/, '');
}

// AAAA-MM-JJ_Initiales_Equipement_Titre.docx
export function nomDuFichier(proc) {
  const d = new Date(proc.creeLe);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const morceaux = [date, initiales(proc.auteur), nettoyer(proc.equipement, 30), nettoyer(proc.titre)];
  return morceaux.filter(Boolean).join('_') + '.docx';
}

// Prépare une photo pour le Word, en respectant ses proportions
async function photoPourWord(idPhoto) {
  const photo = await lirePhoto(idPhoto);
  if (!photo) return null;
  let largeur = PHOTO_LARGEUR_MAX;
  let hauteur = largeur * photo.hauteur / photo.largeur;
  if (hauteur > PHOTO_HAUTEUR_MAX) {
    hauteur = PHOTO_HAUTEUR_MAX;
    largeur = hauteur * photo.largeur / photo.hauteur;
  }
  return { img: { width: largeur, height: hauteur, data: await photo.blob.arrayBuffer(), extension: '.jpg' } };
}

// Construit les données envoyées au modèle (noms des balises)
async function donneesPourModele(proc, config) {
  const etapes = [];
  for (const [index, etape] of proc.etapes.entries()) {
    const photos = [];
    for (const idPhoto of etape.photos) {
      const photo = await photoPourWord(idPhoto);
      if (photo) photos.push(photo);
    }
    etapes.push({ numero: index + 1, texte: texteOuEspace(etape.texte), critique: Boolean(etape.critique), photos });
  }

  // Encart sécurité (complété à l'étape 2 du développement)
  const secu = proc.securite || {};
  const epi = (secu.epi || []).map((id) => ({ libelle: libelleDe(config.epi, id) }));
  const conditions = (secu.conditions || []).map((id) => ({ libelle: libelleDe(config.conditions, id) }));
  const autres = (secu.autres || '').trim();

  return {
    titre: proc.titre.trim(),
    equipement: texteOuEspace(proc.equipement),
    auteur: texteOuEspace(proc.auteur),
    date: dateFrancaise(proc.creeLe),
    outillage: texteOuEspace(proc.outillage),
    duree: texteOuEspace(proc.duree),
    afficherOutillage: config.champs.outillage !== false,
    afficherDuree: config.champs.duree !== false,
    secu: { renseignee: Boolean(epi.length || conditions.length || autres), epi, conditions, autres },
    etapes,
  };
}

// Un champ vide est remplacé par une espace : sinon Word peut faire
// disparaître la cellule de tableau qui le contient.
function texteOuEspace(texte) {
  return (texte || '').trim() || ' ';
}

function libelleDe(liste, id) {
  const element = (liste || []).find((e) => e.id === id);
  return element ? element.libelle : id;
}

// Fabrique le Word. Renvoie un objet File prêt à partager.
export async function genererWord(proc, config) {
  const modele = await (await fetch(CHEMIN_MODELE)).arrayBuffer();
  const contenu = await createReport({
    template: new Uint8Array(modele),
    data: await donneesPourModele(proc, config),
    cmdDelimiter: ['{{', '}}'],
    noSandbox: true,       // nécessaire dans un navigateur
  });
  return new File([contenu], nomDuFichier(proc), { type: TYPE_DOCX });
}

// Le menu de partage Android accepte-t-il ce fichier ?
// (Chrome Android refuse aujourd'hui les .docx : on garde le test au cas
//  où une future version l'autoriserait.)
export function partageNatifPossible(fichier) {
  return Boolean(navigator.canShare && navigator.canShare({ files: [fichier] }));
}

export async function partager(fichier) {
  await navigator.share({ files: [fichier], title: fichier.name });
}

// Enregistre le fichier dans "Téléchargements" du téléphone
export function telecharger(fichier) {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(fichier);
  lien.download = fichier.name;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 60000);
}
