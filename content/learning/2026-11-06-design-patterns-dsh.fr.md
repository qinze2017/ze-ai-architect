+++
title = "Design patterns et DeepSeek Harness : SOLID et architecture des agents"
date = 2026-11-06T20:00:00-05:00
draft = false
description = "Design patterns et DeepSeek Harness : SOLID et architecture des agents"
tags = ["Design Patterns", "SOLID", "DeepSeek Harness", "AI Agent"]
categories = ["AI Architecture"]
+++

## Objectif

Étudier les design patterns appliqués aux agents IA, les principes SOLID et l'architecture extensible de DeepSeek Harness (DSH).

## Les 23 patterns GoF

Les patterns classiques se répartissent en **5 créationnels, 7 structurels et 11 comportementaux**. Pour les agents : Strategy, Factory Method, Adapter, Observer, Command, State, Chain of Responsibility et Decorator sont prioritaires. L'injection de dépendances et l'architecture de plugins ne font pas partie des 23 patterns GoF.

## Strategy, Adapter et injection de dépendances

Un agent dépend d'une interface `LLMProvider` plutôt que d'un SDK spécifique. Chaque adaptateur traduit les requêtes et réponses du fournisseur. Le choix du fournisseur peut être injecté à l'exécution.

```java
public interface LLMProvider {
    LLMResponse generate(LLMRequest request);
}
public record LLMRequest(String prompt, String model) {}
public record LLMResponse(String content, int inputTokens, int outputTokens) {}
```

Cet exemple pédagogique ne couvre pas encore le streaming, les appels d'outils, l'annulation ou les délais d'attente.

## SOLID

- **SRP** : séparer orchestration, modèles et outils.
- **OCP** : ajouter un fournisseur sans modifier le cœur.
- **LSP** : respecter les garanties de l'interface.
- **ISP** : séparer génération de texte et appels d'outils.
- **DIP** : dépendre d'abstractions, non de SDK concrets.

Un modèle sans support d'appels d'outils ne doit pas ignorer silencieusement cette capacité.

## Étude de DSH

Examiner le runtime de plugins, Agent Registry, Agent Factory, Agent Loop, Tool Registry et les mécanismes de session et de sandbox. La création via une fabrique réduit le couplage. Un handle doté de `dispose()` explicite la responsabilité de libérer les ressources. Ces observations architecturales doivent être confirmées dans un commit précis du dépôt.

## Sécurité et compromis

Une chaîne de contrôles peut gérer autorisation, approbation humaine et audit, mais ne remplace pas l'isolation du système d'exploitation. Les plugins améliorent l'extensibilité au prix d'une complexité accrue de cycle de vie, de compatibilité et de diagnostic.

## Exercices

1. Concevoir un adaptateur Ollama sans modifier l'orchestrateur.
2. Décrire le retrait sûr d'un plugin pendant une exécution de 30 secondes : arrêter les nouvelles tâches, annuler ou terminer les tâches actives, puis libérer les ressources.

## Sources and verification

- [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)
- [Agent registry](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/core/agent)
- [Agent loop](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/core/agent-loop)

> Architecture notes are based on the concepts discussed in class; individual implementation claims should be checked against a pinned commit before treating them as source-code evidence.
