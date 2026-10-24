# =====================================================================
#  Génère le modèle Word de démonstration : modele\modele-procedure.docx
#
#  Vous n'avez normalement PAS besoin de ce script : il sert seulement à
#  reconstruire le modèle de démonstration. Votre propre modèle se crée
#  directement dans Word (voir docs\guide-modele-word.md).
#
#  Lancement (PowerShell, depuis le dossier du projet) :
#     powershell -ExecutionPolicy Bypass -File outils\creer-modele-demo.ps1
# =====================================================================
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$racine = Split-Path -Parent $PSScriptRoot
$sortie = Join-Path $racine 'modele\modele-procedure.docx'

# ---------- Petites fonctions pour écrire le XML de Word ----------
function Esc([string]$t) { [Security.SecurityElement]::Escape($t) }

# Un "run" = un morceau de texte avec sa mise en forme
function Txt([string]$texte, [switch]$Gras, [string]$Couleur, [int]$Taille) {
  $rpr = ''
  if ($Gras) { $rpr += '<w:b/>' }
  if ($Couleur) { $rpr += "<w:color w:val=`"$Couleur`"/>" }
  if ($Taille) { $rpr += "<w:sz w:val=`"$Taille`"/><w:szCs w:val=`"$Taille`"/>" }
  if ($rpr) { $rpr = "<w:rPr>$rpr</w:rPr>" }
  "<w:r>$rpr<w:t xml:space=`"preserve`">$(Esc $texte)</w:t></w:r>"
}

# Un paragraphe
function Par([string]$runs = '', [string]$Style, [string]$Align, [int]$Apres = -1, [string]$Fond) {
  $ppr = ''
  if ($Style) { $ppr += "<w:pStyle w:val=`"$Style`"/>" }
  if ($Fond) { $ppr += "<w:shd w:val=`"clear`" w:color=`"auto`" w:fill=`"$Fond`"/>" }
  if ($Apres -ge 0) { $ppr += "<w:spacing w:before=`"0`" w:after=`"$Apres`"/>" }
  if ($Align) { $ppr += "<w:jc w:val=`"$Align`"/>" }
  "<w:p><w:pPr>$ppr</w:pPr>$runs</w:p>"
}

# Un paragraphe qui ne contient qu'une balise (commande du modèle)
function Cmd([string]$balise) { Par (Txt $balise) -Apres 0 }

# Une cellule de tableau (largeur en twips : 567 twips = 1 cm)
function Cel([int]$largeur, [string]$contenu, [string]$Fond) {
  $shd = ''
  if ($Fond) { $shd = "<w:shd w:val=`"clear`" w:color=`"auto`" w:fill=`"$Fond`"/>" }
  "<w:tc><w:tcPr><w:tcW w:w=`"$largeur`" w:type=`"dxa`"/>$shd</w:tcPr>$contenu</w:tc>"
}

# Une ligne de tableau
function Lig([string]$cellules, [switch]$Entete, [int]$Hauteur) {
  $trpr = ''
  if ($Hauteur) { $trpr += "<w:trHeight w:val=`"$Hauteur`"/>" }
  if ($Entete) { $trpr += '<w:tblHeader/>' }
  if ($trpr) { $trpr = "<w:trPr>$trpr</w:trPr>" }
  "<w:tr>$trpr$cellules</w:tr>"
}

# Un tableau
function Tab([int[]]$colonnes, [string]$lignes, [string]$Bordure = 'A6A6A6') {
  $total = ($colonnes | Measure-Object -Sum).Sum
  $grille = ($colonnes | ForEach-Object { "<w:gridCol w:w=`"$_`"/>" }) -join ''
  $b = "w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"$Bordure`""
  "<w:tbl><w:tblPr><w:tblW w:w=`"$total`" w:type=`"dxa`"/>" +
  "<w:tblBorders><w:top $b/><w:left $b/><w:bottom $b/><w:right $b/><w:insideH $b/><w:insideV $b/></w:tblBorders>" +
  '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="57" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:bottom w:w="57" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar>' +
  "</w:tblPr><w:tblGrid>$grille</w:tblGrid>$lignes</w:tbl>"
}

$BLEU = '1F3864'; $GRIS = 'F2F2F2'; $ROUGE = 'C00000'; $ROSE = 'FDE2E2'
$NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'

# =====================================================================
#  CORPS DU DOCUMENT
#  Les balises sont entre {{ }}. Attention : dans PowerShell, les
#  balises contenant $ sont écrites entre apostrophes simples.
# =====================================================================
$corps = ''

# ---- Bandeau titre ----
$corps += Tab @(9638) (Lig (Cel 9638 ((Par (Txt 'PROCÉDURE OPÉRATOIRE' -Gras -Couleur 'FFFFFF' -Taille 20) -Apres 60) + (Par (Txt '{{titre}}' -Gras -Couleur 'FFFFFF' -Taille 36) -Apres 60)) -Fond $BLEU)) -Bordure $BLEU
$corps += Par

# ---- Identification ----
$lab = 3000; $val = 6638
function LigneInfo($libelle, $valeur) {
  Lig ((Cel $lab (Par (Txt $libelle -Gras) -Apres 0) -Fond $GRIS) + (Cel $val (Par (Txt $valeur) -Apres 0)))
}
# Ligne de tableau qui ne contient qu'une balise (FOR, IF, END-…) :
# elle disparaît du document final. C'est ainsi qu'on répète ou masque
# des lignes entières.
function LigneCmd([int[]]$colonnes, [string]$balise) {
  $cellules = Cel $colonnes[0] (Cmd $balise)
  foreach ($c in $colonnes[1..($colonnes.Count - 1)]) { $cellules += Cel $c (Par '' -Apres 0) }
  Lig $cellules
}
$lignes  = LigneInfo 'Équipement' '{{equipement}}'
$lignes += LigneInfo 'Rédacteur' '{{auteur}}'
$lignes += LigneInfo 'Date de rédaction' '{{date}}'
$lignes += LigneCmd @($lab, $val) '{{IF afficherOutillage}}'
$lignes += LigneInfo 'Outillage / pièces nécessaires' '{{outillage}}'
$lignes += LigneCmd @($lab, $val) '{{END-IF}}'
$lignes += LigneCmd @($lab, $val) '{{IF afficherDuree}}'
$lignes += LigneInfo 'Durée estimée' '{{duree}}'
$lignes += LigneCmd @($lab, $val) '{{END-IF}}'
$lignes += Lig ((Cel $lab (Par (Txt 'Statut' -Gras) -Apres 0) -Fond $GRIS) + (Cel $val (Par (Txt 'BROUILLON – NON VALIDÉ' -Gras -Couleur $ROUGE) -Apres 0)))
$corps += Tab @($lab, $val) $lignes

# ---- 1. Sécurité ----
$corps += Par (Txt '1. Sécurité') -Style 'Titre1'
$corps += Cmd '{{IF secu.renseignee}}'
$corps += Par (Txt 'Équipements de protection individuelle (EPI) requis' -Gras) -Style 'SousTitre'
$corps += Cmd '{{FOR e IN secu.epi}}'
$corps += Par (Txt '■  {{$e.libelle}}') -Apres 40
$corps += Cmd '{{END-FOR e}}'
$corps += Cmd '{{IF !secu.epi.length}}'
$corps += Par (Txt 'Aucun EPI renseigné.' -Couleur '7F7F7F') -Apres 40
$corps += Cmd '{{END-IF}}'
$corps += Par (Txt 'Conditions de sécurité' -Gras) -Style 'SousTitre'
$corps += Cmd '{{FOR c IN secu.conditions}}'
$corps += Par (Txt '■  {{$c.libelle}}') -Apres 40
$corps += Cmd '{{END-FOR c}}'
$corps += Cmd '{{IF !secu.conditions.length}}'
$corps += Par (Txt 'Aucune condition renseignée.' -Couleur '7F7F7F') -Apres 40
$corps += Cmd '{{END-IF}}'
$corps += Cmd '{{IF secu.autres}}'
$corps += Par (Txt 'Autres risques / précautions' -Gras) -Style 'SousTitre'
$corps += Par (Txt '{{secu.autres}}') -Apres 40
$corps += Cmd '{{END-IF}}'
$corps += Cmd '{{END-IF}}'
$corps += Cmd '{{IF !secu.renseignee}}'
$corps += Par (Txt '⚠ Section sécurité non renseignée – à compléter lors de la validation.' -Gras -Couleur $ROUGE)
$corps += Cmd '{{END-IF}}'

# ---- 2. Mode opératoire (une ligne de tableau par étape) ----
$corps += Par (Txt '2. Mode opératoire') -Style 'Titre1'
$cN = 850; $cP = 4650; $cD = 4138
$entete = Lig ((Cel $cN (Par (Txt 'N°' -Gras -Couleur 'FFFFFF') -Align 'center' -Apres 0) -Fond $BLEU) +
             (Cel $cP (Par (Txt 'Photo(s)' -Gras -Couleur 'FFFFFF') -Apres 0) -Fond $BLEU) +
             (Cel $cD (Par (Txt 'Description / consignes' -Gras -Couleur 'FFFFFF') -Apres 0) -Fond $BLEU)) -Entete
# Colonne photos : une photo par ligne, chacune dans son paragraphe
$photos = (Cmd '{{FOR p IN $et.photos}}') + (Par (Txt '{{IMAGE $p.img}}') -Apres 60) + (Cmd '{{END-FOR p}}') + (Par '' -Apres 0)
$cols = @($cN, $cP, $cD)
# Étape normale
$ligneNormale = Lig ((Cel $cN (Par (Txt '{{$et.numero}}' -Gras -Taille 28) -Align 'center' -Apres 0)) +
                     (Cel $cP $photos) +
                     (Cel $cD (Par (Txt '{{$et.texte}}') -Apres 0)))
# Étape "point critique / danger" : fond rosé, numéro sur fond rouge, bandeau rouge
$ligneCritique = Lig ((Cel $cN ((Par (Txt '⚠' -Gras -Couleur 'FFFFFF' -Taille 36) -Align 'center' -Apres 0) + (Par (Txt '{{$et.numero}}' -Gras -Couleur 'FFFFFF' -Taille 28) -Align 'center' -Apres 0)) -Fond $ROUGE) +
                      (Cel $cP $photos -Fond $ROSE) +
                      (Cel $cD ((Par (Txt '⚠ POINT CRITIQUE / DANGER' -Gras -Couleur 'FFFFFF') -Apres 80 -Fond $ROUGE) + (Par (Txt '{{$et.texte}}' -Gras) -Apres 0)) -Fond $ROSE))
# Boucle sur les étapes ; pour chacune, une seule des deux lignes s'affiche
$lignesEtapes = (LigneCmd $cols '{{FOR et IN etapes}}') +
                (LigneCmd $cols '{{IF !$et.critique}}') + $ligneNormale + (LigneCmd $cols '{{END-IF}}') +
                (LigneCmd $cols '{{IF $et.critique}}') + $ligneCritique + (LigneCmd $cols '{{END-IF}}') +
                (LigneCmd $cols '{{END-FOR et}}')
$corps += Tab $cols ($entete + $lignesEtapes)
$corps += Cmd '{{IF !etapes.length}}'
$corps += Par (Txt 'Aucune étape saisie.' -Couleur '7F7F7F')
$corps += Cmd '{{END-IF}}'

# ---- 3. Validation ----
$corps += Par (Txt '3. Validation') -Style 'Titre1'
$v = @(1900, 2300, 2000, 1500, 1938)
$cellsV = { param($a, $b, $c, $d, $e, $fond, $gras)
  $i = 0; ($a, $b, $c, $d, $e | ForEach-Object { $w = $v[$i]; $i++
    if ($gras) { Cel $w (Par (Txt $_ -Gras) -Apres 0) -Fond $fond } else { Cel $w (Par (Txt $_) -Apres 0) -Fond $fond } }) -join '' }
$lv  = Lig (& $cellsV 'Étape' 'Nom' 'Fonction' 'Date' 'Visa' $GRIS $true)
$lv += Lig (& $cellsV 'Rédaction' '{{auteur}}' '' '{{date}}' '' '' $false) -Hauteur 700
$lv += Lig (& $cellsV 'Vérification' '' '' '' '' '' $false) -Hauteur 700
$lv += Lig (& $cellsV 'Approbation' '' '' '' '' '' $false) -Hauteur 700
$corps += Tab $v $lv

$document = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document $NS><w:body>$corps
<w:sectPr><w:headerReference w:type="default" r:id="rIdEntete"/><w:footerReference w:type="default" r:id="rIdPied"/>
<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>
</w:body></w:document>
"@

# =====================================================================
#  EN-TÊTE : mention BROUILLON + filigrane (sur toutes les pages)
# =====================================================================
$filigrane = @'
<w:p><w:pPr><w:pStyle w:val="EnTete"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:pict>
<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e"><v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/><v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas><v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/><v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles><o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype>
<v:shape id="FiligraneBrouillon" o:spid="_x0000_s2049" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:480pt;height:120pt;rotation:315;z-index:-251657216;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" o:allowincell="f" fillcolor="#ff7c80" stroked="f"><v:fill opacity=".3"/><v:textpath style="font-family:&quot;Calibri&quot;;font-size:1pt" string="BROUILLON"/><w10:wrap anchorx="margin" anchory="margin"/></v:shape>
</w:pict></w:r></w:p>
'@
$entete = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr $NS>
<w:p><w:pPr><w:pStyle w:val="EnTete"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="$ROUGE"/></w:pBdr><w:jc w:val="center"/></w:pPr>$(Txt 'BROUILLON – NON VALIDÉ' -Gras -Couleur $ROUGE -Taille 28)$(Txt '   ·   Ne pas appliquer avant validation' -Couleur '7F7F7F' -Taille 16)</w:p>
$filigrane
</w:hdr>
"@

$pied = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr $NS>
<w:p><w:pPr><w:pStyle w:val="PiedPage"/><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs></w:pPr>$(Txt '{{titre}} – BROUILLON du {{date}}' -Couleur '7F7F7F' -Taille 16)<w:r><w:rPr><w:color w:val="7F7F7F"/><w:sz w:val="16"/></w:rPr><w:tab/><w:t xml:space="preserve">Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:color w:val="7F7F7F"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>$(Txt ' / ' -Couleur '7F7F7F' -Taille 16)<w:fldSimple w:instr=" NUMPAGES "><w:r><w:rPr><w:color w:val="7F7F7F"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p>
</w:ftr>
"@

# =====================================================================
#  STYLES (police, titres)
# =====================================================================
$styles = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Titre1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="$BLEU"/></w:pBdr><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="$BLEU"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="SousTitre"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:color w:val="$BLEU"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="EnTete"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="PiedPage"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr></w:style>
</w:styles>
"@

$settings = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>
'@

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpg" ContentType="image/jpeg"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>
'@

$rels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>
'@

$docRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rIdEntete" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rIdPied" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>
'@

$core = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Modèle de procédure (démonstration)</dc:title><dc:creator>Procédures terrain</dc:creator></cp:coreProperties>
'@

# ---------- Assemblage du fichier .docx (c'est un ZIP) ----------
$parties = [ordered]@{
  '[Content_Types].xml' = $contentTypes; '_rels/.rels' = $rels; 'docProps/core.xml' = $core
  'word/document.xml' = $document; 'word/styles.xml' = $styles; 'word/settings.xml' = $settings
  'word/header1.xml' = $entete; 'word/footer1.xml' = $pied; 'word/_rels/document.xml.rels' = $docRels
}
if (Test-Path $sortie) { Remove-Item $sortie }
$flux = [IO.File]::Open($sortie, 'CreateNew')
$zip = New-Object IO.Compression.ZipArchive($flux, [IO.Compression.ZipArchiveMode]::Create)
$utf8 = New-Object Text.UTF8Encoding($false)
foreach ($nom in $parties.Keys) {
  # Vérifie que chaque partie est un XML valide avant de l'ajouter
  [xml]$null = $parties[$nom]
  $entree = $zip.CreateEntry($nom)
  $w = New-Object IO.StreamWriter($entree.Open(), $utf8)
  $w.Write($parties[$nom].Trim()); $w.Close()
}
$zip.Dispose(); $flux.Close()
Write-Host "Modèle créé : $sortie"
