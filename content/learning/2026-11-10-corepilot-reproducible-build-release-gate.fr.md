+++
title = "Senior Java / IA : builds reproductibles et critères de mise en production pour CorePilot"
date = 2026-11-10
draft = false
summary = "Comprendre la reproductibilité, les preuves de validation et la décision NO-GO à partir de RB.2."
tags = ["Java", "AI", "CorePilot", "Release Engineering"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel
Le 10 novembre, la validation isolée RB.2 de CorePilot a réussi 60 vérifications, mais la mise en production reste **NO-GO**. Le wheel Python est reproductible octet pour octet; la compilation Web échoue lorsqu'on change de répertoire. Dans un chemin fixe, 103 fichiers correspondent. Les essais sur un véritable iPhone/Safari, le trousseau de clés de production et la compatibilité de déploiement restent à faire.

## Concepts essentiels
La **justesse fonctionnelle** vérifie le comportement. Un **build reproductible** produit les mêmes octets à partir d'entrées et d'un environnement maîtrisés. Une **barrière de publication** exige des preuves suffisantes avant le déploiement. Une différence entre répertoires peut provenir de chemins absolus, d'horodatages, de l'ordre des fichiers ou des outils; la cause n'est pas encore démontrée. Il faut consigner les versions, les dépendances verrouillées, les paramètres et les empreintes des entrées.

## Java 17 : empreinte d'un arbre de fichiers
~~~java
import java.nio.file.*;
import java.security.*;
import java.util.*;
public class TreeDigest {
  static String digest(Path root) throws Exception {
    MessageDigest md = MessageDigest.getInstance("SHA-256");
    try (var paths = Files.walk(root)) {
      for (Path p : paths.filter(Files::isRegularFile)
          .sorted(Comparator.comparing(x -> root.relativize(x).toString())).toList()) {
        md.update(root.relativize(p).toString().replace('\\','/')
            .getBytes(java.nio.charset.StandardCharsets.UTF_8));
        md.update((byte) 0);
        md.update(Files.readAllBytes(p));
      }
    }
    return HexFormat.of().formatHex(md.digest());
  }
  public static void main(String[] args) throws Exception {
    if (args.length != 2) throw new IllegalArgumentException("two directories required");
    String a = digest(Path.of(args[0])), b = digest(Path.of(args[1]));
    System.out.println(a.equals(b) ? "PASS identical trees" : "FAIL different trees");
    if (!a.equals(b)) System.exit(1);
  }
}
~~~

Compile with `javac --release 17 TreeDigest.java` and run with `java TreeDigest buildA buildB`. This educational example hashes relative paths and bytes, not metadata, permissions or symlink semantics; it is not a complete supply-chain attestation.

## Pièges fréquents
- Confondre l'égalité dans un chemin fixe avec la reproductibilité entre répertoires.
- Assimiler 60 tests réussis à une autorisation de déployer.
- Ignorer les chemins relatifs, permissions ou liens symboliques.
- Exclure arbitrairement des artefacts divergents pour obtenir PASS.
- Modifier la production avant d'avoir compris la différence.

## Question d'entrevue Senior
Le wheel Python est reproductible, mais le Web ne l'est pas entre deux répertoires. Les tests fonctionnels réussissent. Autoriseriez-vous le déploiement? Décrivez vos expériences de diagnostic et vos critères GO/NO-GO sans donner tout de suite la solution.

## Exercice de 15 minutes
Créez deux dossiers temporaires avec le même fichier, exécutez TreeDigest (PASS), puis modifiez un fichier (FAIL, code de sortie 1). Dressez ensuite la liste des preuves manquantes pour Safari sur iPhone et le trousseau de production. Ne touchez pas à la production.

## Résumé
Tests réussis, reproductibilité et autorisation de déploiement sont trois décisions distinctes. Les écarts inexpliqués et les validations manquantes imposent NO-GO.
