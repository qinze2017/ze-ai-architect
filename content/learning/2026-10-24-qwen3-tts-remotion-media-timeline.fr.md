+++
title = "Ingénierie vidéo IA : de Qwen3-TTS à la timeline Remotion"
date = 2026-10-24
draft = false
summary = "Construire une timeline fiable à partir d'essais de voix française, avec sous-titres synchronisés et rendu reproductible."
tags = ["AI", "Qwen3-TTS", "Remotion", "TypeScript", "Java", "Media Pipeline", "Architecture"]
categories = ["Apprentissage"]
showComments = true
+++

## Le cas réel

Aujourd'hui, les essais Qwen3-TTS VoiceDesign pour la narration française de PromoLocal ont mené au choix B (voix masculine adulte). Les paramètres MPS, SDPA et `bfloat16` ont été mentionnés, et l'intégration Remotion a été envisagée. Une erreur `NameError: name 'model' is not defined` est apparue. **Ce cours ne prétend pas qu'un rendu complet a été vérifié.**

Question : **pourquoi ne pas fixer la durée vidéo et les sous-titres à l'avance?** Les pauses et le débit varient : il faut inspecter le vrai fichier audio.

## 1. Quatre étapes simples

1. **TTS** : texte français, description VoiceDesign, configuration du modèle → `voice.wav`; conserver les versions et le choix d'écoute.
2. **Inspection** : mesurer durée, fréquence d'échantillonnage et canaux; ne pas deviner à partir du nombre de mots.
3. **Alignement** : produire des temps de début et de fin à partir de l'audio réel, ou d'annotations vérifiées.
4. **Rendu** : Remotion utilise la timeline; valider la vidéo avant de déclarer la tâche terminée.

## 2. Durée audio → nombre d'images

~~~bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.wav
~~~

Exemple **fictif** : 12,34 secondes à 30 images/s → `ceil(12,34 × 30) = 371` images. Cette durée ne provient pas des essais enregistrés aujourd'hui. Éviter de couper la fin de la narration.

## 3. Java 17 : calcul fiable

~~~java
public class RenderPlanDemo {
    record AudioInfo(long durationMs, int fps) {
        AudioInfo {
            if (durationMs <= 0 || fps <= 0) {
                throw new IllegalArgumentException("positive duration and fps required");
            }
        }
        long frames() {
            long scaled = Math.multiplyExact(durationMs, (long) fps);
            return Math.floorDiv(Math.addExact(scaled, 999L), 1000L);
        }
    }
    public static void main(String[] args) {
        AudioInfo audio = new AudioInfo(12_340, 30);
        if (audio.frames() != 371L) throw new AssertionError("frame count");
        System.out.println("PASS: " + audio.frames() + " frames");
    }
}
~~~

Le calcul entier arrondi vers le haut évite une image manquante. `multiplyExact` et `addExact` détectent les débordements. Le programme a été compilé et exécuté localement.

## 4. TypeScript : timeline des sous-titres

~~~typescript
type Caption = { startMs: number; endMs: number; text: string };

function makeTimeline(durationMs: number, fps: number, captions: Caption[]) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 ||
      !Number.isInteger(fps) || fps <= 0) throw new Error("invalid media metadata");
  const durationInFrames = Math.ceil(durationMs * fps / 1000);
  const segments = captions.map(c => {
    if (c.startMs < 0 || c.endMs <= c.startMs || c.endMs > durationMs) {
      throw new Error("invalid caption interval");
    }
    const from = Math.floor(c.startMs * fps / 1000);
    const until = Math.ceil(c.endMs * fps / 1000);
    return { from, durationInFrames: until - from, text: c.text };
  });
  return { durationInFrames, segments };
}

const plan = makeTimeline(12_340, 30, [
  { startMs: 0, endMs: 1200, text: "Un bon prix à Sherbrooke" }
]);
if (plan.durationInFrames !== 371 || plan.segments[0].durationInFrames !== 36) {
  throw new Error("timeline test failed");
}
console.log("PASS: timeline", plan.durationInFrames);
~~~

Le code autonome a passé la compilation TypeScript stricte et un test Node. Remotion peut consommer `durationInFrames` et `segments`, mais **l'intégration Remotion n'a pas été exécutée**. Les horodatages doivent provenir d'un alignement réel.

## 5. Lien avec les Workers Spring Boot

États possibles : `TTS_PENDING → TTS_DONE → TIMELINE_READY → RENDERING → DONE`, plus `FAILED` avec une cause. Vérifier les artefacts, le code de sortie et les métadonnées avant toute transition. Garder la synthèse et le rendu **hors des transactions SQL courtes**. Enregistrer les empreintes d'entrée, les versions du modèle et du code, la durée et les chemins de fichiers afin de réutiliser une voix déjà approuvée.

## 6. Pièges fréquents pour un développeur senior

- `NameError` indique une variable Python absente du processus courant : initialiser le modèle ou le passer en paramètre.
- Une description VoiceDesign ne garantit pas exactement le même accent ni la même durée.
- MPS, SDPA et `bfloat16` ne prouvent pas qu'une vidéo a été rendue.
- Le texte et la durée totale ne suffisent pas à synchroniser chaque sous-titre.
- Un fichier existant peut être corrompu : vérifier code de sortie, métadonnées et lecture.
- Une nouvelle tentative ne doit pas écraser une voix approuvée.

## 7. Question d'entretien senior (répondre d'abord)

Le TTS a créé `voice.wav`, puis le processus de rendu Remotion a planté. L'utilisateur demande une nouvelle tentative. **Comment gérer les états, la réutilisation des artefacts et la validation afin d'éviter une nouvelle synthèse inutile et de ne jamais déclarer réussie une vidéo corrompue?**

## 8. Exercice de 15 minutes

1. Mesurer un WAV existant avec `ffprobe`, ou utiliser l'exemple fictif de 12,34 s.
2. Exécuter le Java 17 et vérifier 371 images.
3. Exécuter le TypeScript pour une phrase française.
4. Définir trois critères : durée cohérente, intervalles valides, aucun DONE après un rendu échoué.

## Conclusion

**Qwen3-TTS produit le son, l'inspection donne la durée, l'alignement situe les paroles, Remotion rend les images.** Chaque étape doit posséder une sortie vérifiée et un état récupérable.
