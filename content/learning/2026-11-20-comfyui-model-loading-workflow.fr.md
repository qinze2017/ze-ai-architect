+++
title = "Architecture IA senior : contrats de types et chargement des modèles dans ComfyUI"
summary = "Valider les connexions UNET, CLIP, VAE et KSampler sans confondre types de ports et compatibilité réelle des modèles."
date = 2026-11-20
draft = false
tags = ["Java", "AI Architecture", "ComfyUI", "Workflow Validation"]
categories = ["Learning"]
showComments = true
+++

## Contexte pratique

La séance d'aujourd'hui portait sur un graphe texte-vers-image de ComfyUI : UNETLoader, CLIPLoader, VAELoader, ModelSamplingAuraFlow, CLIPTextEncode, EmptySD3LatentImage, KSampler, VAEDecode et SaveImage. Les paramètres et les noeuds exacts dépendent du modèle et de sa version.

## Concepts essentiels

**Graphe orienté acyclique typé (Typed DAG)** : chaque connexion doit respecter les types d'entrée et de sortie; il faut également vérifier les cycles et les entrées obligatoires.

**Compatibilité des modèles (Model Compatibility)** : une connexion MODEL, CLIP ou VAE valide ne garantit pas que les architectures, les encodeurs, les dimensions latentes et l'échantillonneur soient compatibles.

**Reproductibilité (Reproducibility)** : la graine et les paramètres d'échantillonnage ne suffisent pas pour garantir un résultat identique sur tous les appareils. Il faut aussi enregistrer les empreintes des modèles et les versions des composants.

## Exemple Java 17

~~~java
import java.util.*;
public class WorkflowCheck {
  record Edge(String from, String outputType, String to, String inputType) {}
  static List<String> validate(List<Edge> edges) {
    List<String> errors = new ArrayList<>();
    for (Edge e : edges)
      if (!e.outputType().equals(e.inputType()))
        errors.add(e.from() + " -> " + e.to() + ": type mismatch");
    return errors;
  }
  public static void main(String[] args) {
    var ok = List.of(new Edge("UNETLoader", "MODEL", "KSampler", "MODEL"));
    var bad = List.of(new Edge("VAELoader", "VAE", "KSampler", "MODEL"));
    if (!validate(ok).isEmpty() || validate(bad).size() != 1)
      throw new AssertionError("validation failed");
    System.out.println("PASS");
  }
}
~~~

Cet exemple autonome ne vérifie que les types déclarés des arêtes. Il ne valide ni un graphe ComfyUI complet ni la compatibilité réelle des modèles.

## Pièges fréquents

- Confondre MODEL, CLIP et VAE.
- Supposer qu'un graphe bien typé s'exécutera nécessairement.
- Croire qu'une graine fixe garantit un résultat identique sur tous les GPU.
- Réutiliser des paramètres d'un autre modèle sans consulter sa documentation.
- Oublier la mémoire disponible pendant le chargement simultané des modèles.

## Question d'entrevue senior

Toutes les connexions sont bien typées, mais KSampler échoue. Comment distinguer un problème d'architecture, d'encodeur CLIP, de VAE, de forme latente, d'échantillonneur ou de mémoire? Quelles validations statiques et dynamiques proposeriez-vous?

## Exercice de 15 minutes

Dessinez le chemin UNETLoader → ModelSamplingAuraFlow → KSampler → VAEDecode → SaveImage, puis ajoutez les connexions CLIP, VAE et latent. Indiquez le type de chaque connexion et trois erreurs que la validation statique ne détecterait pas.

## Conclusion

Le contrôle des types est indispensable, mais il ne remplace pas les tests de compatibilité et d'exécution.
