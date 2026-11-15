+++
title = "Senior IA / Backend : intégrité des liens entre tâches CorePilot et galerie"
date = 2026-11-14
draft = false
summary = "Vérifier la disponibilité des médias et les autorisations sans supprimer l’historique des tâches."
tags = ["AI", "CorePilot", "Backend", "Media"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel
Dans CorePilot, l’historique d’une création reste utile même si l’image ou la vidéo a été supprimée ou a expiré. Le lien « Voir la création » ne doit apparaître que si le média est réellement accessible dans la galerie. L’action « Retirer de l’historique » reste indépendante.

## Concepts clés
**Tâche ≠ média** : une tâche terminée ne garantit pas qu’un fichier existe encore. **Admissibilité du lien** : vérifier l’association, l’état READY, la visibilité dans la galerie, l’existence du fichier et les droits du demandeur. **TOCTOU** : entre l’affichage et le clic, le média peut disparaître; le serveur doit refaire la vérification et retourner 404 ou 410 selon le contrat API.

## Exemple Python 3.10+ (testé isolément)
Pièges fréquents

## Afficher le bouton dès qu’un media_id existe; se fier uniquement au masquage côté client; exposer les chemins locaux; supprimer l’historique avec le média; croire qu’une vérification préalable élimine toute course concurrente.
Question d’entrevue senior

~~~python
from dataclasses import dataclass

@dataclass(frozen=True)
class Media:
    id: str
    status: str
    gallery_visible: bool
    file_exists: bool
    owner_id: str

def can_view_generated_media(media: Media | None, requester_id: str) -> bool:
    return (media is not None and media.owner_id == requester_id
            and media.status == "READY" and media.gallery_visible
            and media.file_exists)
~~~

## Une tâche vidéo est marquée SUCCEEDED et possède un media_id, mais son fichier a été supprimé. Comment concevoir l’API, la relation entre les données et l’interface pour conserver l’historique, masquer le lien invalide et empêcher l’accès non autorisé? Répondre avant de consulter une solution.
Exercice de 15 minutes

## Dessiner la relation Task → Media → Gallery. Tester READY, DELETED, EXPIRED, MISSING et FORBIDDEN. Préciser les codes HTTP attendus au clic. Ne rien modifier en production.
Conclusion

## Une tâche conservée n’implique pas un média disponible. La visibilité du bouton améliore l’expérience, mais le contrôle d’accès appartient au serveur.
undefined

