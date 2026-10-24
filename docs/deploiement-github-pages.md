# Mettre l'application en ligne avec GitHub Pages

Durée : environ 20 minutes la première fois. Aucune installation sur le PC, tout se fait dans le navigateur.

GitHub est un site gratuit qui stocke des fichiers. Sa fonction « GitHub Pages » les publie comme un site web en HTTPS. C'est ce qui permet à Android d'installer l'application.

> Rappel : le dépôt est **public**. Le code, `config.json` et le modèle Word sont donc visibles par tous. Les brouillons et les photos, eux, ne quittent jamais les téléphones.

---

## 1. Créer un compte GitHub (une seule fois)

1. Allez sur <https://github.com> → **Sign up**.
2. Saisissez une adresse e-mail, un mot de passe et un **nom d'utilisateur**. Ce nom apparaîtra dans l'adresse de l'application, par exemple `atelier-maintenance`.
3. Validez l'e-mail de confirmation.

## 2. Créer le « dépôt » (le dossier en ligne)

1. En haut à droite, cliquez sur **+** → **New repository**.
2. **Repository name** : `procedures-terrain`.
3. Cochez **Public**.
4. Cliquez sur **Create repository**.

## 3. Déposer les fichiers

1. Sur la page du dépôt, cliquez sur le lien **uploading an existing file**. Vous pouvez aussi passer par **Add file → Upload files**.
2. Ouvrez sur votre PC le dossier de l'application. Sélectionnez **tout son contenu** (`index.html`, `config.json`, `sw.js`, les dossiers `js`, `modele`, `icones`, `docs`…) et faites-le glisser dans la page. Glissez bien le **contenu** du dossier, pas le dossier lui-même : `index.html` doit se trouver à la racine du dépôt.
3. Attendez la fin du chargement, puis cliquez en bas sur **Commit changes**.

## 4. Activer GitHub Pages

1. Dans le dépôt, ouvrez l'onglet **Settings** (roue dentée) → menu de gauche **Pages**.
2. Sous **Build and deployment** :
   - **Source** : *Deploy from a branch* ;
   - **Branch** : `main`, dossier `/ (root)` → **Save**.
3. Attendez une à deux minutes et rechargez la page. L'adresse s'affiche en haut :
   `https://VOTRE-NOM.github.io/procedures-terrain/`

## 5. Créer le QR code pour les opérateurs

1. Ouvrez l'adresse dans **Chrome** ou **Edge** sur votre PC.
2. Faites un clic droit dans la page → **Créer un code QR pour cette page**. Dans Edge, utilisez l'icône de partage de la barre d'adresse.
3. Téléchargez l'image, puis imprimez-la ou affichez-la en atelier.

## 6. Installer sur le téléphone Android

1. Scannez le QR code avec l'appareil photo, ou ouvrez l'adresse dans **Chrome**. Pas dans Samsung Internet ni Firefox.
2. Chrome affiche **« Installer l'application »**. Sinon, passez par le menu **⋮** → **Ajouter à l'écran d'accueil** → **Installer**.
3. L'icône « Procédures » apparaît sur l'écran d'accueil. **Ouvrez-la une fois avec du réseau** : c'est à ce moment que tout est copié pour l'usage hors ligne.

---

## Mettre à jour l'application ou la configuration

1. Dans le dépôt, ouvrez le fichier à changer, par exemple `config.json`. Cliquez sur le crayon ✏ (**Edit**), modifiez, puis cliquez sur **Commit changes**. Pour remplacer un fichier entier (modèle Word, icône), passez par **Add file → Upload files** avec **exactement le même nom** et le même dossier.
2. Attendez une à deux minutes que GitHub Pages republie.
3. Sur les téléphones : ouvrez l'application avec du réseau, fermez-la, puis rouvrez-la. La nouvelle version s'applique à la **deuxième** ouverture.

Si vous **ajoutez** un nouveau fichier à l'application (par exemple une icône), ajoutez aussi son nom dans la liste `FICHIERS` de `sw.js`. Augmentez ensuite le numéro de `VERSION` dans ce même fichier (`'v1'` → `'v2'`).
