+++
title = "Java senior et React : éviter les réponses périmées après la reprise de PromoLocal"
date = 2026-10-31
draft = false
summary = "Un cas concret de PromoLocal sur les courses entre requêtes, le regroupement des rafraîchissements et la pagination fiable."
tags = ["Java", "React", "Concurrence", "PromoLocal", "Architecture", "Asynchrone"]
categories = ["Apprentissage"]
showComments = true
+++

## Contexte réel — 31 octobre 2026

La révision de **R2.1.2** de PromoLocal a révélé deux risques : au retour d'un onglet inactif, une requête déjà en cours pouvait empêcher le chargement des rabais actifs à jour; un rafraîchissement de la carte pouvait aussi réinitialiser la pagination sans résultat fiable. Verdict : **NO-GO**. La révision de R2.1.3 a ensuite relevé que des événements de reprise séparés d'environ 5 ms pouvaient déclencher 3 requêtes et 2 annulations. Selon le compte rendu du projet, R2.1.4 utilise une fenêtre commune de regroupement de 75 ms (attente maximale de 500 ms) et a réussi 53 tests, ainsi que les vérifications de build, lint et TypeScript. Cette version **n'était pas encore poussée ni déployée** au moment du compte rendu. Il ne s'agit pas de tests d'intégration refaits pour cet article.

Le sujet est la **cohérence asynchrone**, distinct du filtrage des prix étudié le 30 octobre. Le code ci-dessous est pédagogique, pas une copie du code de production.

## Concepts essentiels : trois protections complémentaires

**1. Regrouper les déclencheurs (coalescing).** visibilitychange et focus peuvent survenir presque ensemble. On regroupe les demandes rapprochées pour éviter les appels redondants. Cette optimisation ne garantit pas, à elle seule, la fraîcheur des données.

**2. Annuler l'ancienne requête (AbortController).** L'annulation réduit le travail inutile, mais ne remplace pas la vérification d'un résultat : une continuation asynchrone peut déjà être prête à s'exécuter.

**3. Vérifier la génération de requête.** À chaque nouvelle requête de référence, on incrémente un identifiant. Seule la réponse réussie de la génération courante peut modifier la liste et la pagination. Un changement de filtre doit invalider les résultats précédents.

**Règle de pagination :** corriger la page uniquement après une réponse réussie qui correspond aux filtres courants et fournit un totalPages fiable. Une erreur, une annulation ou une réponse périmée ne doit pas ramener arbitrairement la personne de la page 3 à la page 1. L'exemple suppose des pages numérotées à partir de 1; vérifier la convention réelle de l'API.

## Exemple Java 17 vérifié

Le programme transpose la règle « seule la dernière requête peut modifier l'état » dans une petite classe Java. Il simule des réponses qui arrivent dans le désordre, sans navigateur ni base de données. Enregistrer sous StaleResponseGateDemo.java, puis exécuter :

~~~bash
javac --release 17 StaleResponseGateDemo.java
java StaleResponseGateDemo
~~~

~~~java
public final class StaleResponseGateDemo {
    private long latestRequestId = 0;
    private int page = 3;
    private String data = "existing";

    long beginRequest() { return ++latestRequestId; }

    boolean accept(long requestId, boolean succeeded,
                   int totalPages, String responseData) {
        if (!succeeded || requestId != latestRequestId) return false;
        data = responseData;
        page = Math.min(page, Math.max(1, totalPages)); // 1-based pages
        return true;
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        StaleResponseGateDemo gate = new StaleResponseGateDemo();
        long oldRequest = gate.beginRequest();
        long currentRequest = gate.beginRequest();
        check(!gate.accept(oldRequest, true, 1, "stale"), "reject old response");
        check(gate.page == 3, "old response must not reset page");
        check(gate.accept(currentRequest, true, 2, "fresh"), "accept latest response");
        check(gate.page == 2 && gate.data.equals("fresh"), "clamp after success");
        long failedRequest = gate.beginRequest();
        check(!gate.accept(failedRequest, false, 1, "failed"), "reject failure");
        check(gate.page == 2 && gate.data.equals("fresh"), "preserve state on failure");
        System.out.println("PASS: 6 stale-response and pagination assertions");
    }
}
~~~

Sortie attendue : **PASS: 6 stale-response and pagination assertions**. Compilation et exécution vérifiées localement avec javac --release 17. Dans React, il faut aussi gérer l'annulation, le nettoyage des effets, le regroupement des événements et la clé associée aux filtres.

## Pièges fréquents

1. **Seulement un debounce :** moins de requêtes, mais une vieille réponse peut encore écraser la nouvelle.
2. **Seulement abort() :** on oublie les continuations déjà planifiées.
3. **Remettre la page à 1 à chaque réponse :** la navigation devient instable.
4. **Traiter un échec comme une liste vide réussie :** on efface les données et on corrige mal la pagination.
5. **Ne pas invalider les requêtes quand les filtres changent :** un ancien résultat contamine la nouvelle recherche.
6. **Confondre tests et déploiement :** tests locaux, commit, CI et site public sont quatre étapes distinctes.

## Question d'entrevue senior — à résoudre d'abord

Une personne consulte la page 3 des rabais, quitte l'onglet puis revient. La requête A est encore en cours; deux événements rapprochés déclenchent B et C. A répond en dernier, B est annulée, C réussit et le serveur indique seulement 2 pages. **Comment regrouper les événements, annuler les anciennes requêtes, accepter la bonne réponse et ajuster la pagination? Que faire si C échoue?** Aucune solution n'est donnée ici : répondez d'abord par vous-même.

## Exercice de 15 minutes

1. Compiler et exécuter le programme Java; vérifier les 6 assertions.
2. Déplacer l'appel de validation de l'ancienne réponse après la réponse courante et constater qu'il reste rejeté.
3. En environnement de développement, mesurer les événements visibilitychange/focus, les requêtes et les annulations; ne pas utiliser d'API d'écriture en production.
4. Vérifier que la pagination ne change qu'après une réponse réussie correspondant aux filtres courants. Aucun push ni déploiement sans révision.

## À retenir

**Le regroupement réduit les appels; l'annulation économise les ressources; la génération empêche les résultats périmés d'écraser l'état; la pagination dépend d'une réponse fiable.** Le principe s'applique aussi aux traitements asynchrones Java et aux workers d'IA. Seul l'exemple Java autonome a été vérifié pour cet article.
