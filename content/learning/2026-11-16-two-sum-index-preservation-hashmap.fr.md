+++
title = "Entrevue Java senior : Two Sum, indices d’origine et HashMap"
date = 2026-11-16
draft = false
summary = "Comparer le tri avec conservation des indices à une HashMap en un passage, y compris les doublons et le débordement d'entiers."
tags = ["Java", "Algorithms", "Interview", "Data Structures"]
categories = ["Learning"]
showComments = true
+++

## Contexte d'apprentissage
Dans l'exercice Two Sum de Blind 75 / NeetCode 150, une piste était de conserver les indices, de trier les valeurs, puis de retrouver les positions initiales. C'est faisable, mais trier les nombres seuls fait perdre leur position d'origine; avec des doublons, une recherche par valeur peut réutiliser le même élément.

## Concepts essentiels
**Contrat** : retourner les indices **originaux** de deux éléments distincts dont la somme vaut `target` (la variante habituelle garantit une solution unique).

**Tri et deux pointeurs** : conserver des paires `(valeur, indiceOriginal)`, trier, puis chercher avec deux pointeurs. Temps `O(n log n)` et mémoire supplémentaire `O(n)` pour les paires.

**HashMap en un passage** : rechercher d'abord le complément parmi les valeurs déjà vues, puis enregistrer l'élément courant. Temps moyen `O(n)`, mémoire `O(n)`; le pire cas dépend du comportement de la table de hachage.

**Débordement** : calculer le complément avec `long`, puis vérifier qu'il entre dans un `int`.

## Exemple Java 17
Exemple pédagogique d'une approche en un passage :
~~~java
import java.util.*;
public class TwoSumLesson {
  static int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
      long needed = (long) target - nums[i];
      if (needed >= Integer.MIN_VALUE && needed <= Integer.MAX_VALUE) {
        Integer j = seen.get((int) needed);
        if (j != null) return new int[]{j, i};
      }
      seen.putIfAbsent(nums[i], i);
    }
    throw new IllegalArgumentException("No solution");
  }
}
~~~

## Pièges fréquents
Confondre les indices triés avec les indices d'origine; mal gérer `[3,3]`; insérer avant de chercher et réutiliser un élément; présenter la complexité moyenne comme une garantie absolue; ignorer le débordement des entiers; ne pas préciser le comportement sans solution.

## Question d'entrevue senior (répondre avant de consulter une solution)
Comment représenter les paires valeur-indice pour faire un tri suivi de deux pointeurs? Comparez les complexités avec la HashMap. Pourquoi faut-il retourner deux indices distincts pour `[3,3]` et `target=6`?

## Exercice pratique de 15 minutes
Expliquez les deux algorithmes à voix haute, puis écrivez votre propre version avec HashMap. Testez `[2,7,11,15]`, `[3,3]` et `[-3,4,3,90]`. Justifiez l'ordre « chercher, puis insérer ».

## Validation et conclusion
Le code pédagogique a été compilé avec `javac --release 17` et exécuté avec trois scénarios d'assertion en environnement isolé; aucun test d'intégration en production. En entrevue senior, explicitez toujours le contrat, les cas limites et les compromis.
