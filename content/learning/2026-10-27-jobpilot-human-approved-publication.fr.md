+++
title = "Senior Java / IA : pourquoi une offre candidate n’est pas publiée"
date = 2026-10-27
draft = false
summary = "À partir de JobPilot (51 offres candidates, 6 publiques), comprendre la validation humaine et une publication sûre."
tags = ["Java", "AI Agents", "Human-in-the-Loop", "JobPilot", "Architecture", "Testing"]
categories = ["Apprentissage"]
showComments = true
+++

## Le problème concret

Le 27 octobre 2026, scripts/job-candidates.json de JobPilot contient **51 offres candidates** et frontend/public/data/jobs.json contient toujours **6 offres publiques**. La collecte fonctionne, mais la publication est une opération distincte. La documentation scripts/PUBLISHING.md indique que le processus actuel est **limité à la prévisualisation**; prepare-publication.mjs retourne publication_enabled: false.

Dans un magasin, recevoir 51 articles à l'entrepôt ne signifie pas en mettre 51 en rayon. La collecte n'accorde pas le droit de publier.

## 1. Trois étapes et trois responsabilités

**Découverte (Candidate)** : enregistrer les offres possibles, sans les considérer comme vérifiées.

**Approbation (Approval)** : vérifier les sources officielles, l'admissibilité au Québec, le télétravail à 100 % et l'état du recrutement. Une validation humaine fiable place l'identifiant stable job_id dans approved_ids. HIGH et MEDIUM sont des priorités, pas des autorisations.

**Publication (Publication)** : une étape indépendante relit le dernier main, valide le schéma et les identifiants, détecte les conflits et prépare uniquement les offres approuvées. Cette étape n'est pas activée actuellement dans JobPilot.

Un nombre croissant de candidates et un nombre public stable ne prouvent pas, à eux seuls, une panne.

## 2. Exemple Java 17 exécutable

Ce programme est un **modèle pédagogique isolé**, et non une traduction exacte du moteur JavaScript de JobPilot. Il impose volontairement des conditions plus strictes : quebecEligible=true et OPEN. Aucun accès réseau ni écriture de fichier.

~~~java
import java.util.List;
import java.util.Set;

public class ApprovalGateDemo {
    record Job(String id, boolean remote, boolean quebecEligible,
               String recruitingStatus, String tier) {}

    // Educational model: stricter than JobPilot's actual preview logic.
    static boolean canPublish(Job job, Set<String> approvedIds) {
        return approvedIds.contains(job.id())
            && job.remote()
            && job.quebecEligible()
            && "OPEN".equals(job.recruitingStatus())
            && Set.of("HIGH", "MEDIUM").contains(job.tier());
    }

    static List<Job> plan(List<Job> candidates, Set<String> approvedIds) {
        return candidates.stream()
            .filter(job -> canPublish(job, approvedIds))
            .toList(); // Immutable result; no network or file writes.
    }

    public static void main(String[] args) {
        Job approved = new Job("job-1", true, true, "OPEN", "HIGH");
        Job pending  = new Job("job-2", true, true, "OPEN", "HIGH");
        Job excluded = new Job("job-3", true, true, "OPEN", "EXCLUDE");
        Job notQc    = new Job("job-4", true, false, "OPEN", "HIGH");
        var result = plan(List.of(approved, pending, excluded, notQc),
                          Set.of("job-1", "job-3", "job-4"));
        if (result.size() != 1 || !result.get(0).id().equals("job-1")) {
            throw new AssertionError("Approval gate failed");
        }
        if (canPublish(pending, Set.of())) {
            throw new AssertionError("Unapproved job was accepted");
        }
        System.out.println("PASS: only approved eligible job selected");
    }
}
~~~

Run / Exécution / 运行: `javac --release 17 ApprovalGateDemo.java && java ApprovalGateDemo`.

## 3. Limites du modèle et garanties de production

Le filtrage en mémoire ne suffit pas. Avant une publication réelle, il faut vérifier à nouveau les sources et leur fraîcheur, l'unicité des identifiants et des URL, le schéma des données et le SHA actuel de main. Si la branche distante a changé, il faut recalculer le plan ou s'arrêter, et non écraser les données. La documentation de JobPilot interdit le force push et la publication directe sur main.

## 4. Pièges fréquents au niveau Senior

- Confondre la note HIGH donnée par une IA avec une approbation humaine.
- Traiter UNKNOWN ou quebec_eligible=null comme une confirmation.
- Accuser le collecteur parce que le site n'a pas changé.
- Dupliquer une offre lors d'une relance ou écraser une version plus récente.
- Masquer le bouton de publication sans contrôler les permissions du serveur.
- Annoncer une publication alors que publication_enabled vaut false.

## 5. Question d'entretien Senior : répondre d'abord

Cinq nouvelles offres font passer le bassin de 46 à 51, mais le site en affiche toujours 6. Comment distinguer une attente normale d'approbation d'un échec de publication ? Si deux Workers publient simultanément les mêmes offres approuvées, comment éviter les doublons et les mises à jour perdues ? Répondez d'abord : aucune solution n'est donnée ici.

## 6. Exercice de 15 minutes

1. Enregistrez le code dans ApprovalGateDemo.java et exécutez javac --release 17 ApprovalGateDemo.java && java ApprovalGateDemo.
2. Videz approvedIds et vérifiez que le plan est vide.
3. Mettez quebecEligible=false pour job-1 et confirmez le refus.
4. Dessinez Candidate → Reviewed → Approved → Proposed → Published en indiquant la validation humaine. Ne modifiez pas les données publiques de JobPilot.

## En résumé

**Découvrir n'est pas approuver; approuver n'est pas publier.** Une automatisation fiable sépare l'autorisation humaine, le calcul sans effet de bord, la détection des doublons et les droits d'écriture.

Sources vérifiées : qinze2017/JobPilot, scripts/PUBLISHING.md, scripts/prepare-publication.mjs, scripts/job-reviews.json et les fichiers JSON du 27 octobre 2026.

