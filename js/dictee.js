// =====================================================================
//  dictee.js — Transformation de la parole en texte
//
//  Utilise la reconnaissance vocale de Chrome (elle a besoin d'Internet).
//  Une phrase par appui : l'écoute s'arrête toute seule après un silence.
//  L'audio n'est pas conservé.
// =====================================================================

const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;

// La dictée est-elle possible sur ce téléphone, maintenant ?
export function dicteeDisponible() {
  return Boolean(Reconnaissance) && navigator.onLine;
}

let ecouteEnCours = null;

// Lance l'écoute.
//  surTexte(texte) : appelé avec la phrase reconnue
//  surFin()        : appelé quand l'écoute s'arrête
//  surErreur(code) : 'network' (pas de réseau), 'not-allowed' (micro refusé), …
export function demarrerDictee({ surTexte, surFin, surErreur }) {
  arreterDictee();
  const reco = new Reconnaissance();
  reco.lang = 'fr-FR';
  reco.interimResults = false;
  reco.continuous = false;
  reco.maxAlternatives = 1;

  reco.onresult = (evenement) => {
    for (let i = evenement.resultIndex; i < evenement.results.length; i++) {
      if (evenement.results[i].isFinal) surTexte(evenement.results[i][0].transcript.trim());
    }
  };
  reco.onerror = (evenement) => {
    // 'no-speech' et 'aborted' ne sont pas de vraies erreurs
    if (!['no-speech', 'aborted'].includes(evenement.error)) surErreur(evenement.error);
  };
  reco.onend = () => {
    ecouteEnCours = null;
    surFin();
  };

  ecouteEnCours = reco;
  reco.start();
}

export function arreterDictee() {
  if (ecouteEnCours) ecouteEnCours.stop();
}
