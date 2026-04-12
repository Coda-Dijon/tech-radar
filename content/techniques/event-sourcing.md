---
title: Event Sourcing
ring: can-use
quadrant: techniques
tags: [architecture, cqrs, event-driven, ddd]
date: 2024-03-01
description: Stocker les changements d'état comme une séquence d'événements immuables
---

## Pourquoi Event Sourcing ?

L'event sourcing offre un audit complet, la possibilité de rejouer l'historique et une séparation naturelle entre lecture et écriture (CQRS). Particulièrement adapté aux domaines financiers et aux workflows complexes.

## Expérimentation

Un domaine pilote (suivi de commandes) utilise event sourcing depuis 6 mois. Les résultats sont positifs mais la complexité opérationnelle est réelle (snapshots, migrations d'events).

## Recommandation

**À adopter sélectivement** pour les domaines avec forte contrainte d'audit ou d'historique.
