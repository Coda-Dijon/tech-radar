---
title: Infrastructure as Code
ring: adopt
quadrant: techniques
tags: [devops, terraform, pulumi, automation]
date: 2024-01-25
description: Gérer l'infrastructure via du code versionné plutôt que des configurations manuelles
---

## Pourquoi IaC ?

L'IaC élimine la dérive de configuration, permet la revue de code pour les changements d'infrastructure et rend les environnements reproductibles. Avec Terraform ou Pulumi, tout changement d'infra passe par une PR.

## Retour d'expérience

100% de notre infrastructure est codée. La récupération après incident est passée de heures à minutes.

## Recommandation

**Obligatoire** pour toute nouvelle infrastructure. Aucune ressource cloud créée manuellement.
