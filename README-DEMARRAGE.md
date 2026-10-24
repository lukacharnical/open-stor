# OpenStore — pack développeur et convertisseurs

Ce pack ajoute les pages séparées à OpenStore et un pipeline GitHub Actions pour les trois modes : site Web → APK, AAB → APK universel de test, projet Android ZIP → APK debug.

## Fichiers
- `index.html` : page d'accueil d'origine, avec liens de rôles ajoutés.
- `admin.html` : point d'entrée réservé aux administrateurs (la gestion existante dans l'accueil n'est pas supprimée).
- `developpeur.html` : accueil des outils, réservé aux rôles `codeur`, `programmeur`, `admin`, `administrateur`.
- `convertisseur.html` : convertisseur séparé, réservé aux mêmes trois rôles.
- `utilisateur.html` : espace du compte connecté.
- `firebase-shared.js` : initialisation Firebase partagée et vérification des rôles.
- `functions/` : fonction serveur qui contrôle le rôle et déclenche le workflow GitHub sans exposer le jeton GitHub au navigateur.
- `.github/workflows/build-apk.yml` : compilation des APK.

## Configuration obligatoire avant utilisation

1. **Vérifie d'abord ton dépôt GitHub exact.** Le lien d'actions affiché dans `developpeur.html` utilise actuellement `lukacharnical/openstore`. Si le dépôt s'appelle autrement, remplace ce lien.
2. Dépose les fichiers du ZIP dans une copie/branche de ton dépôt OpenStore, puis vérifie que `index.html` fonctionne bien avant de fusionner.
3. Installe Firebase CLI sur ton ordinateur : `npm install -g firebase-tools`, puis `firebase login` et `firebase use openstore-be393` (ou `firebase init functions` si le projet n'a pas encore été initialisé localement).
4. Depuis le dossier `functions`, lance `npm install`.
5. Crée un jeton GitHub fine-grained pour **le dépôt exact** avec permission `Contents: read and write` (nécessaire à `repository_dispatch`). Ne le mets jamais dans le HTML ni dans Git.
6. Configure les secrets Firebase Functions :
   - `firebase functions:secrets:set GITHUB_TOKEN`
   - `firebase functions:secrets:set GITHUB_REPOSITORY` puis saisis `proprietaire/nom-du-depot` (ex. `lukacharnical/openstore` si c'est bien le dépôt réel).
7. Déploie la fonction : `firebase deploy --only functions:requestOpenStoreBuild`.
8. Configure les règles Storage pour autoriser un utilisateur connecté à envoyer uniquement dans `build-uploads/{uid}/...`. Le fichier `storage.rules` fourni est un exemple limité à ce dossier.
9. **Ne remplace pas les règles Realtime Database existantes.** OpenStore utilise déjà plusieurs chemins (`apps`, `store_users`, etc.) ; conserve tes règles actuelles et vérifie qu’un utilisateur ne peut pas modifier son propre rôle.
10. Vérifie que les rôles sont exactement enregistrés dans `store_users/{emailKey}/role` : `codeur`, `programmeur`, `admin` ou `administrateur`. Le code normalise en minuscules.
11. Active GitHub Actions dans le dépôt. Après une demande, l'APK sera dans l'onglet **Actions → exécution → Artifacts**.

## Important sur les signatures
- L'APK issu d'un AAB est construit en mode universel et signé avec une clé de test générée temporairement. Il sert aux essais, **pas** à remplacer la signature officielle de l'application sur Google Play.
- L'APK d'un projet ZIP est un `assembleDebug`; le ZIP doit contenir un projet Android Gradle complet et compatible avec les versions Java/Gradle/SDK du runner.
- Le convertisseur Web génère une petite application WebView. Il ne transforme pas magiquement un site en application native et certains sites peuvent refuser l'intégration dans une WebView.
- Un dépôt GitHub Pages seul ne peut pas compiler Android dans le navigateur. La compilation utilise GitHub Actions et la fonction Firebase est le relais sécurisé.

## Contrôle d'accès
L'interface cache les boutons non autorisés et la fonction serveur vérifie à nouveau le rôle. Les droits d'administration restent distincts. Conserve aussi des règles Firebase strictes : cacher un bouton n'est jamais une protection suffisante.
