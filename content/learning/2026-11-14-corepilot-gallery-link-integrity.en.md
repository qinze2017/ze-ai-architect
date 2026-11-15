+++
title = "Senior AI / Backend: CorePilot Task History and Gallery Link Integrity"
date = 2026-11-14
draft = false
summary = "Design reliable media-view actions while retaining creation history after files expire or disappear."
tags = ["AI", "CorePilot", "Backend", "Media"]
categories = ["Learning"]
showComments = true
+++

## Real-world context
CorePilot should retain creation-task history even when an image or video has expired, been deleted, or become unavailable. Show “View generated media” only when the asset is actually locatable in the gallery and authorized. Keep “Remove record” independent.

## Core concepts
**Task record ≠ media asset**: a successful job does not imply its output still exists. **Link eligibility** requires a valid association, READY state, gallery visibility, file availability, and requester authorization. **TOCTOU**: an asset can disappear between listing and click; the server must recheck access and return 404 or 410 according to the API contract.

## Python 3.10+ example (isolated test passed)
Common pitfalls

## Showing a button merely because media_id is non-null; hiding a link in the UI without enforcing server authorization; exposing local filesystem paths; conflating deleting task history with deleting an asset; treating a point-in-time existence check as a permanent guarantee.
Senior interview question

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

## A video job is SUCCEEDED and has a media_id, but the gallery file was removed. How would you design the API, data associations, and UI so history remains, invalid view actions disappear, and concurrent deletion and unauthorized access are handled? Answer before reading any solution.
15-minute exercise

## Draw Task → Media → Gallery. Specify expected UI and HTTP behavior for READY, DELETED, EXPIRED, MISSING, and FORBIDDEN. Write an isolated eligibility test; do not change production.
Summary

## Task history does not prove media availability. The UI should offer only justified actions; the server must remain the authority for access and existence.
undefined

