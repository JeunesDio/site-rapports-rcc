# Rapports d’activités — Service Jeune RCCC de Cotonou

Ce dépôt public héberge le site et l’archive des rapports sur GitHub Pages. Le bouton **Créer un rapport** ouvre l’accès administrateur intégré au navigateur. Après connexion, l’administrateur remplit le formulaire, génère le PDF et télécharge aussi sa fiche JSON. La publication reste manuelle : les fichiers sont ajoutés au dépôt après relecture.

## Espace administrateur

Lors de la première ouverture de **Administration**, définir un identifiant et un mot de passe d’au moins 12 caractères. Les identifiants sont enregistrés dans le stockage local du navigateur ; le mot de passe est dérivé avec PBKDF2 via Web Crypto et un sel aléatoire, jamais enregistré en clair dans le dépôt. La session locale expire après quatre heures. Depuis le tableau de bord, il est possible de modifier le mot de passe ou de se déconnecter.

**Limite importante :** GitHub Pages est un hébergement statique. Cette connexion contrôle l’affichage de l’interface, mais ne protège pas réellement l’accès contre un visiteur capable d’inspecter ou de modifier le JavaScript. La première personne qui ouvre l’écran d’initialisation peut créer le compte sur son propre navigateur. N’y saisissez donc pas de données qui exigent un contrôle d’accès serveur. Le rapport, les images et l’audio sont traités dans le navigateur et ne sont pas transmis ni enregistrés par un serveur.

## Fonctions de création

- Informations de l’activité, contexte, objectifs, déroulement, effectif, résultats, témoignages, difficultés et conclusion.
- Photos de couverture, photos complémentaires et plusieurs photos par témoignage, avec aperçu, remplacement, légendes et suppression.
- Gestion séparée des deux logos institutionnels, lien d’album et enregistrement audio facultatif.
- Génération et aperçu du PDF dans le navigateur, téléchargement du PDF et de la fiche JSON.
- Aucun jeton GitHub ni service de génération externe dans le navigateur.

## Publication manuelle

1. Générer puis télécharger le PDF et la fiche JSON.
2. Après validation, ajouter le PDF dans `public/rapports/`.
3. Ajouter l’entrée correspondante dans `src/data/reports.json`.
4. Publier les changements sur GitHub ; le workflow déploie le site sur Pages.

Le formulaire est un modèle institutionnel du Service Jeune RCCC, pas un formulaire officiel de l’INH. L’archive publique existante et les liens GitHub de publication restent indépendants de l’authentification locale.

## Vérifications locales

```powershell
pnpm lint
pnpm typecheck
pnpm test:auth
pnpm test:pdf
pnpm build
pnpm test:pages
git diff --check
```

Le build Vite utilise le préfixe `/site-rapports-rcc/` pour GitHub Pages.
