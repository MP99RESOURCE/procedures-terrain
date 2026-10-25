// =====================================================================
//  grille.js — Grilles de gros boutons à cocher (équipements, type
//  d'intervention, EPI, produits…)
//
//  Chaque bouton porte data-valeur ; la grille porte data-grille (son
//  nom). Les clics sont traités dans app.js.
// =====================================================================

// options : [{ valeur, libelle, perso, image }]
//   perso : ajout manuel de l'opérateur -> petit bouton ✕ pour le retirer
//   image : chemin d'un pictogramme (facultatif)
// selection : liste des valeurs cochées
export function grilleChoix(nom, options, selection) {
  const boutons = options.map((o) => {
    const coche = selection.includes(o.valeur);
    return `
      <span class="puce-groupe">
        <button type="button" class="puce${coche ? ' cochee' : ''}${o.perso ? ' perso' : ''}${o.image ? ' avec-image' : ''}"
                data-valeur="${echapper(o.valeur)}" aria-pressed="${coche}">
          ${o.image ? `<img src="${echapper(o.image)}" alt="">` : ''}
          <span>${echapper(o.libelle)}</span>
        </button>
        ${o.perso ? `<button type="button" class="puce-retirer" data-retirer="${echapper(o.valeur)}" aria-label="Retirer ${echapper(o.libelle)} de ma liste">✕</button>` : ''}
      </span>`;
  }).join('');
  return `<div class="grille" data-grille="${nom}">${boutons}</div>`;
}

// Empêche un texte saisi d'être interprété comme du code HTML
export function echapper(texte) {
  return String(texte ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
