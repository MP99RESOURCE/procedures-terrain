# Utiliser votre propre modèle Word

L'application remplit le fichier `modele/modele-procedure.docx`. Ce modèle est un document Word ordinaire, mis en forme comme vous le souhaitez (logo, cartouche, polices). Il contient des **balises** entre doubles accolades `{{…}}`.

Le plus simple : **partez du modèle de démonstration**. Ouvrez-le dans Word, changez la mise en page et gardez les balises.

## Les balises disponibles

### Informations simples
| Balise | Contenu |
|---|---|
| `{{titre}}` | Titre de la procédure |
| `{{equipement}}` | Équipement concerné |
| `{{auteur}}` | Nom de l'auteur |
| `{{date}}` | Date de création (JJ/MM/AAAA) |
| `{{outillage}}` | Outillage / pièces nécessaires |
| `{{duree}}` | Durée estimée |

Ces balises fonctionnent aussi dans l'en-tête et le pied de page.

### Étapes (boucle)
Tout ce qui se trouve entre `{{FOR et IN etapes}}` et `{{END-FOR et}}` est répété pour chaque étape. À l'intérieur, on écrit `$et.` devant le nom :

| Balise | Contenu |
|---|---|
| `{{$et.numero}}` | Numéro de l'étape (1, 2, 3…) |
| `{{$et.texte}}` | Note de l'étape |
| `{{IF $et.critique}}` … `{{END-IF}}` | Affiché seulement si l'étape est un point critique |
| `{{IF !$et.critique}}` … `{{END-IF}}` | Affiché seulement si l'étape n'est **pas** critique |

### Photos d'une étape (boucle dans la boucle)
```
{{FOR p IN $et.photos}}
{{IMAGE $p.img}}
{{END-FOR p}}
```
Placez chaque balise **dans son propre paragraphe** pour avoir une photo par ligne. Les photos font 7,9 cm de large au maximum (réglable dans `js/export.js`).

### Sécurité
| Balise | Contenu |
|---|---|
| `{{IF secu.renseignee}}` … `{{END-IF}}` | Affiché si au moins un EPI, une condition ou un risque est saisi |
| `{{FOR e IN secu.epi}}` `{{$e.libelle}}` `{{END-FOR e}}` | Liste des EPI cochés |
| `{{FOR c IN secu.conditions}}` `{{$c.libelle}}` `{{END-FOR c}}` | Liste des conditions cochées |
| `{{secu.autres}}` | Texte « Autres risques / précautions » |

### Champs facultatifs
`{{IF afficherOutillage}}` … `{{END-IF}}` et `{{IF afficherDuree}}` … `{{END-IF}}` masquent ces lignes quand elles sont désactivées dans `config.json`.

## ⚠ Les 4 règles à respecter

1. **Tapez chaque balise d'un seul trait**, sans changer la mise en forme au milieu. Ne copiez-collez pas une balise d'un autre document : Word la découpe parfois en morceaux invisibles. En cas de doute, sélectionnez la balise, supprimez-la et retapez-la.
2. **Dans un tableau**, pour répéter ou masquer des **lignes entières**, mettez `{{FOR …}}`, `{{IF …}}`, `{{END-IF}}` et `{{END-FOR …}}` **chacune seule dans sa propre ligne de tableau**. Ces lignes disparaissent du document final. Regardez le tableau « Mode opératoire » du modèle de démonstration.
3. Chaque `FOR` doit avoir son `END-FOR` et chaque `IF` son `END-IF`.
4. **Gardez la mention « BROUILLON – NON VALIDÉ »** dans l'en-tête de page et/ou en filigrane (Word : **Création › Filigrane**). C'est le modèle qui la porte.

## Remplacer le modèle dans l'application

1. Enregistrez votre modèle sous le nom exact **`modele-procedure.docx`** (format Word .docx).
2. Testez-le d'abord sur votre téléphone : si une balise est fautive, l'application affiche « Le document n'a pas pu être créé » avec le nom de la balise en cause.
3. Déposez-le dans le dossier `modele` du dépôt GitHub (**Add file → Upload files**, même nom). Voir [deploiement-github-pages.md](deploiement-github-pages.md).
