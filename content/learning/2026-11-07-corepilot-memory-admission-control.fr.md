+++
title = "Senior Java / IA : contrôle d'admission mémoire dans CorePilot"
date = 2026-11-07
draft = false
summary = "Orchestrer ComfyUI et les services locaux sans surcharger la mémoire du Mac Studio."
tags = ["Java", "AI", "CorePilot", "Scheduling"]
categories = ["Learning"]
showComments = true
+++

## Contexte
Le 7 novembre, le projet CorePilot vise à coordonner ComfyUI et les services locaux sur Mac Studio. Une utilisation élevée du swap ne prouve pas à elle seule une pression mémoire active : il faut aussi observer les tendances et la pression réelle.

## Concepts clés
**Contrôle d'admission** : vérifier la capacité avant de lancer une tâche. **Rétropression** : mettre les tâches en attente quand la capacité manque. **Cycle de vie** : STOPPED → STARTING → RUNNING → DRAINING → STOPPED, avec FAILED en cas d'erreur. Un arrêt coopératif n'est pas équivalent à SIGSTOP : suspendre un processus peut immobiliser des verrous et des ressources GPU.

## Exemple Java 17
~~~java
record Snapshot(long availableMb, long swapUsedMb, boolean pressureHigh) {}
record Workload(long estimatedPeakMb, boolean critical) {}

static boolean mayStart(Snapshot s, Workload w, long reserveMb) {
    if (s.pressureHigh()) return false;
    if (w.estimatedPeakMb() < 0 || reserveMb < 0) return false;
    return s.availableMb() >= w.estimatedPeakMb() + reserveMb;
}
~~~Cette fonction pure illustre une règle de budget. En production, il faut une réservation atomique, des mesures fiables et de l'hystérésis.

## Pièges fréquents
- Déduire l'état du système uniquement du volume de swap.
- Confondre interruption de l'interface et arrêt sûr d'une inférence GPU.
- Autoriser deux démarrages simultanés à partir du même budget (TOCTOU).
- Réutiliser un PID sans vérifier l'identité du processus.

## Question d'entrevue Senior
Deux tâches ComfyUI réclament chacune 20 Go, mais seulement 30 Go sont disponibles selon le budget. Comment réserver atomiquement la capacité et arrêter proprement une tâche en cours ?

## Exercice de 15 minutes
Dessiner les transitions QUEUED, RESERVED, STARTING, RUNNING, DRAINING, STOPPED et FAILED; indiquer les opérations idempotentes. Ne pas toucher aux processus réels.

## Conclusion
La télémétrie informe; le contrôle d'admission décide; la machine à états encadre l'exécution.
