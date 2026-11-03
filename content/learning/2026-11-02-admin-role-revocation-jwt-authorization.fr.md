+++
title = "Senior Java / Sécurité : pourquoi un ancien JWT peut survivre à la révocation d'un rôle admin"
date = 2026-11-02
draft = false
summary = "Cas PromoLocal : autorisation actuelle, jetons JWT périmés, concurrence et tests de non-régression après révocation."
tags = ["Java", "Spring Security", "JWT", "Authorization", "Security", "Concurrency"]
categories = ["Learning"]
showComments = true
+++

## Problème concret
L'audit de sécurité de PromoLocal a corrigé le contournement initial avec un JWT ordinaire. Toutefois, la mise à jour `PATCH /admin/users/{id}` qui retire simplement le rôle administrateur laisse une lacune de révocation. Verdict : **NO-GO**. Cet article présente une approche de conception; il ne prétend pas corriger l'application en production.

## Concepts essentiels
L'**authentification** confirme l'identité; l'**autorisation** vérifie les droits **au moment de la requête**. Un rôle inclus dans un JWT représente un instantané à l'émission. Après une révocation, ce rôle peut être périmé. Une authentification multifacteur réussie ne garantit pas que le rôle admin demeure valide.

Pour les opérations privilégiées, consulter un état d'autorisation fiable côté serveur, prévoir l'invalidation des caches et protéger également les points d'entrée d'écriture. Définir les garanties de concurrence entre révocation et modification administrative.

## Exemple Java / Spring Boot (illustratif, non testé dans PromoLocal)
~~~java
// Spring Security: illustrative service-layer guard, not a drop-in patch.
@Transactional
public void updateUserRole(long targetId, Role newRole, long actorId) {
    User actor = users.findByIdForUpdate(actorId).orElseThrow();
    User target = users.findByIdForUpdate(targetId).orElseThrow();
    if (actor.getRole() != Role.ADMIN || !actor.isActive()) {
        throw new AccessDeniedException("Admin role revoked");
    }
    // Check business rules (e.g. cannot remove the last admin) here.
    target.setRole(newRole);
}
// Every privileged request must re-check authoritative server-side state;
// a JWT claim alone must not be treated as current role authorization.
~~~
Il faut aussi traiter l'ordre de verrouillage, l'acteur identique à la cible, le dernier administrateur, les journaux d'audit et les contrôles Spring Security à l'entrée. Ce fragment ne garantit pas, à lui seul, l'arrêt immédiat des requêtes déjà en cours.

## Pièges fréquents
1. Se fier uniquement à la signature et à l'expiration du JWT.
2. Corriger un GET sans sécuriser les PATCH/POST.
3. Confondre MFA et autorisation actuelle.
4. Lire le rôle avant une opération longue : risque de concurrence.
5. Vérifier seulement HTTP 403 sans vérifier l'absence d'effet en base.
6. Oublier l'invalidation du cache de permissions.

## Question d'entrevue Senior (répondre avant de lire une solution)
À 10 h, A obtient un JWT avec `admin`; à 10 h 05, on lui retire ce rôle; à 10 h 06, il appelle `PATCH /admin/users/{id}`. Comment empêcher cette écriture avec Spring Security et la base de données? Quelle garantie définissez-vous si la révocation et la mise à jour sont concurrentes?

## Exercice pratique — 15 minutes
Inventorier les routes `/admin/**`, puis noter pour chacune l'authentification, la vérification du rôle actuel, l'exigence MFA et les effets d'écriture. Concevoir des tests avec un ancien JWT, une révocation concurrente et une vérification de l'absence d'effets. Utiliser un environnement isolé.

## Résumé
**Un JWT valide ne prouve pas qu'un privilège est encore valide.** Une révocation fiable doit couvrir toutes les routes, les caches et les transactions concurrentes. Sans preuve de bout en bout, maintenir NO-GO.
