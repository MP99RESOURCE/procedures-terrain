// =====================================================================
//  photo.js — Réduction et rotation des photos
//
//  Les photos d'un téléphone font 4000 px et 3 à 6 Mo. On les réduit à
//  1600 px maximum en JPEG 80 % (environ 200 à 400 Ko) pour que le Word
//  reste léger, même avec 30 photos.
// =====================================================================

const TAILLE_MAX = 1600;   // côté le plus long, en pixels
const QUALITE_JPEG = 0.8;  // 0 à 1

// Dessine une image sur une "toile" à la taille voulue et renvoie un JPEG
function toileVersJpeg(toile) {
  return new Promise((resoudre) => toile.toBlob(resoudre, 'image/jpeg', QUALITE_JPEG));
}

// Réduit une photo (fichier venant de l'appareil photo ou de la galerie)
// Renvoie { blob, largeur, hauteur }
export async function compresserPhoto(fichier) {
  // "from-image" : respecte le sens de prise de vue (portrait / paysage)
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const echelle = Math.min(1, TAILLE_MAX / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * echelle);
  const hauteur = Math.round(image.height * echelle);

  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  toile.getContext('2d').drawImage(image, 0, 0, largeur, hauteur);
  image.close();

  return { blob: await toileVersJpeg(toile), largeur, hauteur };
}

// Tourne une photo d'un quart de tour dans le sens des aiguilles d'une montre
// Renvoie { blob, largeur, hauteur }
export async function tournerPhoto(blob) {
  const image = await createImageBitmap(blob);
  const toile = document.createElement('canvas');
  toile.width = image.height;   // largeur et hauteur s'inversent
  toile.height = image.width;
  const ctx = toile.getContext('2d');
  ctx.translate(toile.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(image, 0, 0);
  image.close();

  return { blob: await toileVersJpeg(toile), largeur: toile.width, hauteur: toile.height };
}
