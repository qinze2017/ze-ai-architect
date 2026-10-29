+++
title = "Senior Java / IA : 139 tests réussis, pourquoi le MCP reste-t-il bloqué ?"
date = 2026-10-28
draft = false
summary = "À partir de l’audit de PromoLocal Photo Deal : preuves par étape, portes de livraison et refus par défaut."
tags = ["Java", "AI Agents", "MCP", "Security", "Release Gates", "Architecture", "Testing"]
categories = ["Apprentissage"]
showComments = true
+++

## Le problème réel du jour

Le résumé d’audit de **PromoLocal Photo Deal**, daté du 28 octobre 2026, indique que l’empreinte SHA-256 du ZIP correspond à celle attendue. Les tests existants comptent **101 réussites, 0 échec**; les nouveaux cas de sécurité indépendants, **38 réussites, 0 échec**, soit **139 tests réussis**. Pourtant, la décision reste : **GO pour l’audit hors ligne de phase 1; NO-GO pour l’intégration MCP réelle en lecture seule; NO-GO pour la création d’offres**.

Ce n’est pas contradictoire : **un test valide uniquement ce qu’il a réellement vérifié**. Le présent article s’appuie sur le résumé d’audit; nous n’avons ni relancé le ZIP d’origine ni connecté un serveur MCP réel pour cette leçon.

## 1. Trois niveaux de preuve

**Audit hors ligne.** Vérifier l’empreinte de l’artefact, les tests unitaires, les simulations HTTP et les cas de refus. Ce niveau ne valide pas une authentification réelle sur la plateforme.

**MCP réel en lecture seule.** Vérifier le transport et la négociation du protocole MCP pris en charge, l’identité du propriétaire, les jetons expirés, l’audience et les portées. Pour une requête refusée, le nombre d’appels à l’API en amont doit rester à **zéro**. Conserver les preuves des essais réels.

**Création avec écriture.** En plus des garanties précédentes : approbation humaine fiable liée à la requête complète, clé d’idempotence, rapprochement après une réponse incertaine, nettoyage des pièces jointes et isolation des identifiants d’écriture. Tant que ces points ne sont pas validés, l’outil de création ne doit pas être exposé.

Le nombre **139** ne remplace pas les preuves propres à chaque niveau.

## 2. Java 17 : une porte de livraison qui refuse par défaut

Ce programme est un **modèle pédagogique en mémoire** : il ne met en œuvre ni OAuth, ni MCP, ni déploiement. Les booléens doivent provenir de résultats de vérification fiables, jamais de déclarations du modèle. `eligible` signifie que les preuves exigées sont réunies; ce n’est pas un déclencheur de déploiement.

~~~java
import java.util.Objects;

public class McpReleaseGateDemo {
    enum Gate { OFFLINE_AUDIT, LIVE_READ_ONLY, CREATE_WRITE }

    record Evidence(boolean digestMatched,
                    boolean offlineTestsPassed,
                    boolean ownerAuthVerified,
                    boolean protocolVerified,
                    boolean liveReadOnlyVerified,
                    boolean trustedApprovalVerified,
                    boolean idempotencyVerified,
                    boolean writeIsolationVerified) {}

    static boolean eligible(Gate gate, Evidence e) {
        Objects.requireNonNull(gate);
        Objects.requireNonNull(e);
        boolean offline = e.digestMatched() && e.offlineTestsPassed();
        boolean readOnly = offline && e.ownerAuthVerified()
            && e.protocolVerified() && e.liveReadOnlyVerified();
        return switch (gate) {
            case OFFLINE_AUDIT -> offline;
            case LIVE_READ_ONLY -> readOnly;
            case CREATE_WRITE -> readOnly && e.trustedApprovalVerified()
                && e.idempotencyVerified() && e.writeIsolationVerified();
        };
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        Evidence offlineOnly = new Evidence(true, true, false, false,
                                            false, false, false, false);
        check(eligible(Gate.OFFLINE_AUDIT, offlineOnly), "offline audit");
        check(!eligible(Gate.LIVE_READ_ONLY, offlineOnly), "read-only blocked");
        check(!eligible(Gate.CREATE_WRITE, offlineOnly), "write blocked");

        Evidence readOnly = new Evidence(true, true, true, true,
                                         true, false, false, false);
        check(eligible(Gate.LIVE_READ_ONLY, readOnly), "read-only eligible");
        check(!eligible(Gate.CREATE_WRITE, readOnly), "write still blocked");

        Evidence missingOwnerAuth = new Evidence(true, true, false, true,
                                                 true, true, true, true);
        check(!eligible(Gate.CREATE_WRITE, missingOwnerAuth), "fail closed");
        System.out.println("PASS: release gates fail closed");
    }
}
~~~

Exécution : `javac --release 17 McpReleaseGateDemo.java && java McpReleaseGateDemo`. Sortie attendue : `PASS: release gates fail closed`.

## 3. Pièges fréquents au niveau senior

- Confondre tests simulés et authentification OAuth/MCP vérifiée en conditions réelles.
- Vérifier seulement le code HTTP 401, sans confirmer **zéro appel en amont**.
- Traiter un jeton Bearer partagé du backend comme l’identité de l’utilisateur, ou faire confiance au `user_id` fourni par l’agent.
- Confondre la lecture des catégories et l’autorisation de créer une offre.
- Réessayer aveuglément un POST après un délai d’attente, ou oublier les fichiers orphelins après annulation.
- N’avoir qu’un seul indicateur GO/NO-GO sans distinguer les preuves manquantes.

## 4. Question d’entrevue senior — à résoudre avant la correction

Un audit indépendant indique **139/139 tests hors ligne réussis**, mais l’identité *owner-only* et la négociation du protocole MCP **n’ont pas encore été vérifiées dans une vraie intégration**. On vous demande d’activer la création d’offres demain. Comment définiriez-vous les trois portes (hors ligne, lecture seule, écriture) et quelles preuves manquantes imposeraient un refus ? Répondez d’abord; la solution n’est pas donnée ici.

## 5. Exercice pratique de 15 minutes

1. Enregistrer le programme dans `McpReleaseGateDemo.java`, puis le compiler et l’exécuter.
2. Passer `digestMatched` à `false` dans `offlineOnly` et constater que même la première porte se ferme.
3. Construire trois colonnes de preuves : hors ligne, lecture seule réelle et création. Indiquer `verified / missing`.
4. Décrire un test qui prouve **zéro appel en amont après un refus**. Ne pas utiliser de jeton de production ni appeler le POST de création.

## Résumé

**Une livraison sûre dépend de preuves vérifiées pour chaque étape, pas du nombre total de tests.** Audit hors ligne, validation réelle en lecture seule, puis seulement écriture sous approbation fiable et idempotence. En cas de doute : refus par défaut.

Portée des sources : les 139 tests sont rapportés dans le résumé d’audit du 28 octobre; ce n’est pas le nombre de tests du programme Java présenté ici.
