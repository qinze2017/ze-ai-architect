+++
title = "Senior Java / IA : admission fail-closed et démarrage idempotent dans CorePilot"
date = 2026-11-15
draft = false
summary = "Contrôler les commandes sensibles de CorePilot avec autorisation, garde de sécurité et transitions atomiques."
tags = ["Java", "AI", "CorePilot", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## Contexte pratique
Dans CorePilot, les commandes Start, Stop et Restart sont sensibles. Un résultat de test positif ou une réponse HTTP 200 ne prouve pas qu'un processus est prêt. Cette leçon porte sur la **sécurité du plan de contrôle**, distincte de l'admission mémoire déjà étudiée.

## Concepts essentiels
**Fail-closed** : refuser le démarrage si l'autorisation, la santé du garde ou l'état de l'instance est inconnu. **Clé d'idempotence** : une nouvelle tentative portant le même identifiant ne doit pas lancer une deuxième instance; il faut conserver le résultat dans un stockage durable. **Machine à états** : une transition atomique de STOPPED à STARTING empêche deux demandes concurrentes de gagner. **Observation et exécution** restent deux preuves différentes.

## Exemple Python 3.10+
Cette fonction pure évalue seulement l'admissibilité; elle ne lance aucun processus et ne constitue pas un mécanisme complet d'idempotence.

~~~python
from dataclasses import dataclass

@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str

def admit_start(*, authorized: bool, guard_healthy: bool,
                instance_state: str, request_id: str) -> Decision:
    if not request_id.strip():
        return Decision(False, "MISSING_REQUEST_ID")
    if not authorized:
        return Decision(False, "FORBIDDEN")
    if not guard_healthy:
        return Decision(False, "GUARD_UNAVAILABLE")
    if instance_state != "STOPPED":
        return Decision(False, "INVALID_STATE")
    return Decision(True, "ELIGIBLE_ONLY")

assert not admit_start(authorized=True, guard_healthy=False,
                       instance_state="STOPPED", request_id="r1").allowed
assert admit_start(authorized=True, guard_healthy=True,
                   instance_state="STOPPED", request_id="r1").allowed
~~~

## Pièges fréquents
Se fier au bouton désactivé dans l'interface; autoriser une commande après expiration du garde; conserver les identifiants uniquement en mémoire; confondre HTTP 200 avec READY; relancer Start sans consulter l'état réel.

## Question d'entrevue Senior
Deux clients envoient des demandes Start avec des identifiants distincts pour la même instance STOPPED. Les deux lisent STOPPED, puis le garde devient inaccessible. Comment garantir au plus un démarrage, sans contourner une vérification inconnue?

## Exercice de 15 minutes
Dessiner les transitions STOPPED, STARTING, RUNNING, FAILED et UNKNOWN. Définir quatre tests : accès refusé, délai du garde, même identifiant répété et identifiants différents en concurrence. Ne pas toucher à la production.

## Résumé
La sûreté du plan de contrôle repose sur l'autorisation côté serveur, les transitions atomiques, la déduplication durable et le refus par défaut.
