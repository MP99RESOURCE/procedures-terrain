# Procédures terrain

Application web installable sur Android (PWA) pour créer des **brouillons de procédures** sur le terrain : photo → note ou dictée → document Word.

- Fonctionne **hors ligne** après la première ouverture.
- **Aucun serveur, aucun compte** : les brouillons et les photos restent dans le téléphone.
- Le Word est généré à partir du modèle `modele/modele-procedure.docx`.

## Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Les écrans de l'application |
| `styles.css` | L'apparence (gros boutons) |
| `config.json` | **Votre configuration** : équipements, champs affichés |
| `modele/modele-procedure.docx` | **Votre modèle Word** avec ses balises |
| `js/app.js` | Fonctionnement des écrans |
| `js/stockage.js` | Sauvegarde automatique dans le téléphone |
| `js/photo.js` | Réduction et rotation des photos |
| `js/dictee.js` | Dictée vocale |
| `js/export.js` | Fabrication du Word et envoi |
| `js/lib/docx-templates.js` | Bibliothèque Word (docx-templates 4.15, licence MIT) |
| `sw.js` | Fonctionnement hors ligne |
| `manifest.webmanifest`, `icones/` | Nom et icône de l'application installée |
| `outils/creer-modele-demo.ps1` | Reconstruit le modèle de démonstration (facultatif) |

## Documentation

- [Mettre en ligne sur GitHub Pages](docs/deploiement-github-pages.md)
- [Utiliser votre propre modèle Word](docs/guide-modele-word.md)
- Guide opérateur et guide de configuration : à venir (dernière étape du développement)
