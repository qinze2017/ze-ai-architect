+++
title = "Senior Java / IA : contrats d'outils MCP et gestion des erreurs dans OpenCode"
summary = "Comprendre l'enregistrement des outils, la validation de session_id, CallToolResult et les tests de contrat à partir d'un pont MCP OpenCode."
date = 2026-11-21
draft = false
tags = ["Java", "AI Architecture", "MCP", "OpenCode", "Contract Testing"]
categories = ["Learning"]
showComments = true
+++

## Contexte pratique

Aujourd'hui, le pont MCP OpenCode a nécessité une vérification de la signature de registerTool, de l'extraction de session_id et du format des réponses. La syntaxe Node et la découverte des outils avec MCP Inspector ont été vérifiées. L'exemple Java ci-dessous illustre uniquement la validation métier : il ne constitue pas un serveur MCP.

## Concepts essentiels

**Contrat d'outil (Tool Contract)** : nom, schéma d'entrée, structure de sortie et sémantique des erreurs.

**Frontière protocolaire (Protocol Boundary)** : un adaptateur transforme le résultat métier en CallToolResult conforme au SDK utilisé.

**Test de contrat (Contract Test)** : vérifier séparément tools/list, tools/call, les paramètres manquants, les erreurs en aval et la structure de réponse.

**Refus par défaut (Fail-Closed)** : une session absente ou non autorisée ne doit jamais entraîner la lecture d'une session de rechange.

## Exemple Java 17

Cet exemple simplifié **ne sérialise pas** les messages MCP :

~~~java
import java.util.*;
public class McpToolResultCheck {
  record Result(List<String> content, boolean isError) {}
  static Result validate(Object sessionId, List<String> messages) {
    if (!(sessionId instanceof String id) || id.isBlank())
      return new Result(List.of("session_id is required"), true);
    if (messages == null) return new Result(List.of("messages unavailable"), true);
    return new Result(List.of("messages=" + messages.size()), false);
  }
  public static void main(String[] args) {
    if (!validate("s1", List.of("hello")).content().equals(List.of("messages=1"))) throw new AssertionError();
    if (!validate(null, List.of()).isError()) throw new AssertionError();
    if (!validate("s1", null).isError()) throw new AssertionError();
    System.out.println("PASS");
  }
}
~~~

Compilation et exécution vérifiées avec javac --release 17 : PASS. En production, le SDK MCP doit fournir les blocs content et le champ isError appropriés, ainsi qu'un contrôle d'accès réel à la session.

## Pièges fréquents

- Confondre découverte de l'outil et réussite de son invocation.
- Utiliser une signature de handler incompatible avec la version du SDK.
- Lire session_id au mauvais niveau de l'objet d'arguments.
- Retourner une chaîne brute au lieu d'une réponse conforme.
- Masquer une erreur métier sous une réponse de succès.
- Journaliser des données sensibles ou ignorer les autorisations.

## Question d'entrevue Senior (répondre avant de consulter une solution)

tools/list fonctionne, mais getSessionMessages échoue à l'appel. Comment distinguer les erreurs de protocole, de validation, d'autorisation et de service en aval, puis bâtir une suite de tests de contrat?

## Exercice de 15 minutes

Dans un environnement isolé, essayer une session valide, un identifiant absent, une session non autorisée et une panne en aval. Comparer les structures de réponses et les indicateurs d'erreur. Aucune écriture en production.

## Conclusion

Découvrir un outil, l'appeler, réussir l'opération métier et respecter le protocole sont quatre vérifications distinctes.