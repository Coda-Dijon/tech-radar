---
title: Vite
ring: adopt
quadrant: tools
tags: [build, frontend, bundler, hmr]
date: 2024-02-10
description: Outil de build frontend ultra-rapide basé sur les ES modules natifs
---

## Pourquoi Vite ?

Vite utilise les modules ES natifs du navigateur en développement : pas de bundling, démarrage quasi-instantané et HMR en millisecondes. En production, il utilise Rollup pour un bundle optimisé.

## Retour d'expérience

Nous avons migré tous nos projets React/Vue de webpack vers Vite. Le temps de démarrage dev est passé de 45s à 1s. La DX est transformée.

## Recommandation

**Standard** pour tous les nouveaux projets frontend. Remplace webpack dans la totalité de nos usages.
