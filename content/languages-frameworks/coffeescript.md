---
title: CoffeeScript
ring: hold
quadrant: languages-frameworks
tags: [javascript, legacy]
date: 2023-06-01
description: Transpileur vers JavaScript, remplacé par les fonctionnalités modernes d'ES6+
---

## Contexte

CoffeeScript a été pionnier de plusieurs patterns (arrow functions, destructuring) avant qu'ES6 les intègre nativement. Aujourd'hui, ces fonctionnalités sont disponibles directement en JavaScript/TypeScript.

## Situation actuelle

Nous avons quelques modules legacy en CoffeeScript. Ils fonctionnent mais ne bénéficient pas du tooling moderne.

## Recommandation

**Ne pas adopter** de nouveaux modules. Migrer progressivement les modules existants vers TypeScript lors des prochaines refontes.
