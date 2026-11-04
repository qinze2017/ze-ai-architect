+++
title = "Senior Java / IA : orchestration multiagents, concurrence et publication fiable"
date = 2026-11-03
draft = false
summary = "Une leçon pratique sur l'isolation des tâches, les délais, l'idempotence et les validations humaines."
tags = ["Java", "AI", "Agents", "Concurrency", "Orchestration", "Idempotency"]
categories = ["Learning"]
showComments = true
+++

## Contexte de l'apprentissage
Aujourd'hui, nous avons discuté des architectures dites « super-agent » et de leurs différences avec une boucle ReAct exécutée dans une seule session. Le nom d'un projet et les affirmations d'un article ne constituent pas une validation officielle : cette leçon porte sur les principes d'architecture réutilisables.

## Concepts essentiels
Un **orchestrateur** distribue plusieurs tâches à des travailleurs indépendants. Chaque tâche doit posséder son identifiant, son contexte, ses autorisations, son budget et son échéance. La concurrence ne justifie pas le partage d'un état mutable entre agents.

Pour PromoLocal, la reconnaissance d'image, la vérification d'un prix et la rédaction d'un brouillon peuvent être parallélisées. Toutefois, la publication exige une **approbation fiable**. Les résultats peuvent arriver dans le désordre : une version périmée ne doit pas écraser la version courante. Annuler un `Future` n'arrête pas nécessairement une requête distante.

## Exemple Java 17 (extrait pédagogique)
Cet extrait suppose l'existence de `tasks` et `process`. Il illustre les API Java 17, mais **n'est pas un programme autonome compilable**.
~~~java
record Task(String id, String input) {}
record Outcome(String id, String value) {}

ExecutorService pool = Executors.newFixedThreadPool(3);
try {
    List<Callable<Outcome>> work = tasks.stream()
        .<Callable<Outcome>>map(task -> () ->
            new Outcome(task.id(), process(task.input())))
        .toList();
    List<Future<Outcome>> futures = pool.invokeAll(work, 30, TimeUnit.SECONDS);
    for (Future<Outcome> future : futures) {
        if (future.isCancelled()) { /* record timeout; do not publish */ continue; }
        try {
            Outcome result = future.get();
            // Validate ownership/version and persist idempotently before publishing.
        } catch (ExecutionException ex) {
            // Record failure; retry only if safe and within a bounded policy.
        }
    }
} finally {
    pool.shutdownNow();
}
~~~

## Pièges fréquents
- Partager un contexte mutable entre plusieurs agents.
- Limiter les threads sans limiter les jetons, les coûts et les tentatives.
- Supposer que `cancel()` annule forcément l'appel distant.
- Réessayer sans limite ni clé d'idempotence.
- Confondre suggestion de l'IA et autorisation de publier.
- Accepter un résultat simplement parce qu'il est arrivé en dernier.

## Question d'entrevue senior (répondre d'abord)
Trois tâches PromoLocal s'exécutent en parallèle : analyse d'image, validation du prix et rédaction. La validation du prix dépasse son délai et est relancée, mais l'ancien appel retourne après le nouveau. Comment concevoir les identifiants, les délais, les versions, les écritures transactionnelles et l'approbation humaine pour éviter un écrasement ou une publication automatique ? Répondez avant de consulter une solution.

## Exercice de 15 minutes
Dessinez les états `QUEUED → RUNNING → REVIEW_REQUIRED → APPROVED → PUBLISHED`, puis ajoutez `FAILED` et `TIMED_OUT`. Précisez les autorisations et l'idempotence de chaque transition. Imaginez un test où une ancienne réponse arrive en retard.

## Résumé
Une architecture multiagents fiable repose sur **l'isolation, les limites de ressources, la validation des résultats et l'autorisation explicite**, et non uniquement sur la vitesse.
