// =====================================================================
//  sw.js — Service worker : fonctionnement hors ligne
//
//  Au premier lancement, tous les fichiers ci-dessous sont copiés dans
//  le téléphone. Ensuite l'application s'ouvre depuis cette copie,
//  même en mode avion.
//
//  Mises à jour : quand le téléphone a du réseau, chaque fichier est
//  re-téléchargé en arrière-plan. La nouvelle version (config.json,
//  modèle Word, code) est donc utilisée à l'ouverture SUIVANTE.
//
//  Si vous ajoutez un fichier à l'application (ex. une icône),
//  ajoutez-le à la liste FICHIERS et augmentez le numéro de VERSION.
// =====================================================================

const VERSION = 'v1';
const CACHE = 'procedures-terrain-' + VERSION;

const FICHIERS = [
  './',
  'index.html',
  'styles.css',
  'config.json',
  'manifest.webmanifest',
  'js/app.js',
  'js/stockage.js',
  'js/photo.js',
  'js/dictee.js',
  'js/export.js',
  'js/lib/docx-templates.js',
  'modele/modele-procedure.docx',
  'icones/app-192.png',
  'icones/app-512.png',
];

// Installation : copie de tous les fichiers
self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Activation : suppression des anciennes copies
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Chaque demande de fichier : on répond avec la copie locale tout de
// suite, et on rafraîchit la copie en arrière-plan si le réseau répond.
self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET' || new URL(requete.url).origin !== self.location.origin) return;

  evenement.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const copie = await cache.match(requete, { ignoreSearch: true });

    const miseAJour = fetch(requete, { cache: 'no-cache' })
      .then((reponse) => {
        if (reponse.ok) cache.put(requete, reponse.clone());
        return reponse;
      })
      .catch(() => null);

    if (copie) {
      evenement.waitUntil(miseAJour);
      return copie;
    }
    return (await miseAJour) || new Response('Hors ligne', { status: 503 });
  })());
});
