# Tech Radar

Générateur de site statique pour un radar technologique basé sur Markdown.

## Ajouter un item en 5 minutes

1. Créer un fichier dans `content/<quadrant>/nom-technologie.md`
2. Remplir le frontmatter YAML
3. Écrire le contenu Markdown
4. Ouvrir une Pull Request

```
content/
├── languages-frameworks/   # TypeScript, Go, Rust…
├── platforms/              # Kubernetes, AWS, Cloudflare…
├── techniques/             # TDD, Event Sourcing, IaC…
└── tools/                  # GitHub Actions, Vite, Bun…
```

## Format d'un item

```yaml
---
title: Nom de la technologie
ring: adopt          # adopt | trial | assess | hold
quadrant: tools      # languages-frameworks | platforms | techniques | tools
tags: [tag1, tag2]
date: 2024-01-15     # YYYY-MM-DD
description: Courte description (1 ligne, ~100 caractères)
---

## Contenu en Markdown

Corps libre de l'article...
```

### Définition des rings

| Ring | Signification |
|------|--------------|
| **adopt** | Nous l'utilisons en production, nous le recommandons |
| **trial** | Nous testons activement, résultats prometteurs |
| **assess** | À surveiller, mérite une évaluation approfondie |
| **hold** | À éviter pour de nouveaux projets |

## Développement local

```bash
npm install
npm run build   # génère le site dans dist/
npm run dev     # build + serveur local sur http://localhost:3000
```

## Validation

```bash
npm run validate   # vérifie tous les frontmatters, fail si erreur
```