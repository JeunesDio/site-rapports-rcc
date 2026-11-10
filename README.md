# Rapports d’activités — Service Jeune RCCC de Cotonou

Ce dépôt public héberge l’accueil, l’archive et les PDF publiés sur GitHub Pages. Le bouton **Créer un rapport** ouvre le formulaire dans le navigateur et demande une connexion au compte GitHub autorisé.

Le formulaire et le serveur de génération sont conservés dans le dépôt privé `JeunesDio/site-rapports-rcc-admin`. Le service prévu est `https://site-rapports-rcc-admin-jeunesdio.onrender.com/#/nouveau`; il doit être déployé et configuré avant que ce lien soit actif.

## Organisation du dépôt public

- `src/App.tsx` : accueil, archive et pages des rapports publiés.
- `src/lib/published-reports.ts` : validation de l’index public.
- `src/data/branding.ts` : mentions institutionnelles et logos.
- `src/data/reports.json` : index versionné des rapports publics, vide au départ.
- `public/rapports/` : PDF publics.
- `public/identite/` : logos institutionnels.

Le modèle de rapport est une création institutionnelle originale, pas un formulaire officiel de l’INH. Le PDF garde l’en-tête institutionnel convenu et place les photos auprès du témoignage correspondant.

## Utilisation et publication

1. Ouvrir le service de création depuis **Créer un rapport**.
2. Se connecter au compte GitHub autorisé `JeunesDio`.
3. Remplir le formulaire et télécharger le PDF généré.
4. Après relecture et validation, publier le rapport séparément en ajoutant le PDF dans `public/rapports/` et sa fiche dans `src/data/reports.json`.

La connexion protège l’API qui génère le PDF; le rapport n’est pas publié automatiquement. Les textes, photos et audios sont traités temporairement par le serveur en mémoire. Le projet ne conserve aucun rapport dans une base de données ou un stockage de fichiers.

## Limites du service gratuit

Render Free dispose de 512 Mo de mémoire et de 0,1 CPU, s’arrête après 15 minutes d’inactivité et peut mettre environ une minute à redémarrer. Render le destine aux essais et projets de loisir, pas aux services de production. Aucune facturation n’est configurée par ce dépôt.

Le code du générateur a déjà figuré dans l’historique public du dépôt. L’authentification protège le service officiel de génération, mais ne peut pas empêcher l’exécution locale d’une ancienne copie publique du code.

## Développement et publication du site public

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test:public
```

Le workflow `.github/workflows/deploy.yml` vérifie et déploie `dist/` sur GitHub Pages lors d’un push sur `main`. La base Vite `/site-rapports-rcc/` correspond à `https://jeunesdio.github.io/site-rapports-rcc/`.
