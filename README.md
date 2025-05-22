# cloudflare-worker-patreon-oauth-login

> Un exemple d'authentification OAuth2 avec Patreon via Cloudflare Worker

Le fichier [patreon-oauth-login.js](patreon-oauth-login.js) est un [Cloudflare Worker](https://workers.cloudflare.com/) qui peut être déployé en continu via GitHub Actions.

Ce worker fait 3 choses :

1. Quand vous ouvrez l'URL du worker, il redirige vers la page d'authentification OAuth2 de Patreon
2. Il accepte une requête `POST` avec le `code` OAuth récupéré après la redirection et renvoie un token d'accès en retour
3. Il active CORS pour permettre les requêtes cross-origin

Le fichier [index.html](index.html) est une démo d'une application "Connexion avec Patreon". Vous pouvez examiner son code source pour comprendre comment l'authentification est gérée côté client.

## Instructions pas à pas pour créer votre propre service

### Étape 1 : Créer une application OAuth sur Patreon

1. Connectez-vous à votre compte Patreon
2. Accédez au [portail développeur de Patreon](https://www.patreon.com/portal/registration/register-clients)
3. Cliquez sur "Create Client" pour créer une nouvelle application OAuth
4. Remplissez les informations requises :
   - **Nom** : Le nom de votre application
   - **Description** : Une brève description de votre application
   - **Redirect URIs** : L'URL où Patreon redirigera après l'authentification (par exemple `https://votre-site.com/callback`)
   - **Autres champs** : Complétez selon vos besoins
5. Une fois l'application créée, notez soigneusement le **Client ID** et le **Client Secret**

### Étape 2 : Configurer le projet

1. Clonez ce dépôt
2. [Créez un compte Cloudflare](https://dash.cloudflare.com/) (c'est gratuit !) si vous n'en avez pas encore
3. Installez le CLI `wrangler` et connectez-vous à votre compte

   ```bash
   npm install --global wrangler
   wrangler login
   ```

4. Modifiez le fichier `wrangler.toml`, changez la valeur de `account_id` pour la vôtre ([sélectionnez votre compte](https://dash.cloudflare.com/), puis trouvez votre ID de compte en bas de la barre latérale)

### Étape 3 : Configurer les variables d'environnement

Vous pouvez configurer les identifiants Patreon de deux façons différentes :

#### Méthode 1 : Via l'interface web de Cloudflare (recommandée)

1. Connectez-vous à votre [dashboard Cloudflare](https://dash.cloudflare.com/)
2. Dans le menu de gauche, cliquez sur "Workers & Pages"
3. Sélectionnez votre worker "patreon-oauth-login"
4. Cliquez sur l'onglet "Settings" puis "Variables"
5. Dans la section "Environment Variables", cliquez sur "Add variable"
6. Ajoutez deux variables :
   - Nom : `CLIENT_ID` - Valeur : [votre client ID Patreon]
   - Nom : `CLIENT_SECRET` - Valeur : [votre client secret Patreon]
7. Assurez-vous que l'option "Encrypt" est cochée pour la variable CLIENT_SECRET (pour des raisons de sécurité)
8. Cliquez sur "Save and Deploy"

#### Méthode 2 : Via la ligne de commande avec wrangler

1. Modifiez le fichier `wrangler.toml` pour ajouter votre CLIENT_ID (qui n'est pas un secret) :

```toml
[vars]
CLIENT_ID = "votre_client_id_patreon"
```

2. Utilisez la commande `wrangler secret` pour ajouter votre CLIENT_SECRET (qui est sensible) :

```bash
wrangler secret put CLIENT_SECRET
# Suivez les instructions pour entrer votre secret
```

### Étape 4 : Déployer le worker

Une fois les variables d'environnement configurées, vous pouvez déployer votre worker :

```bash
wrangler publish
```

Votre worker sera déployé sur une URL du type `https://patreon-oauth-login.votre-nom-utilisateur.workers.dev`

### Étape 5 : Intégrer à votre site web

Pour intégrer ce système d'authentification à votre site web :

1. Modifiez le fichier `index.html` pour pointer vers l'URL de votre worker déployé
2. Personnalisez l'apparence et le comportement selon vos besoins
3. Adaptez le traitement des données utilisateur retournées par l'API Patreon

## Fonctionnement technique

Le processus d'authentification OAuth2 avec Patreon se déroule comme suit :

1. L'utilisateur clique sur "Connexion avec Patreon" sur votre site
2. Il est redirigé vers l'URL d'autorisation de Patreon
3. Après authentification et autorisation sur Patreon, il est redirigé vers votre site avec un code temporaire
4. Votre site envoie ce code à votre worker Cloudflare
5. Le worker échange ce code contre un token d'accès auprès de l'API Patreon
6. Le token d'accès est renvoyé à votre site
7. Votre site utilise ce token pour accéder aux informations de l'utilisateur via l'API Patreon

## Aller plus loin

Vous pouvez améliorer ce système en :

- Ajoutant des scopes supplémentaires pour accéder à plus de données utilisateur
- Implémentant la gestion du refresh token pour maintenir l'authentification active
- Stockant les tokens dans un KV store de Cloudflare pour une persistance entre les sessions
- Créant des endpoints supplémentaires pour accéder à d'autres ressources de l'API Patreon

## Ressources utiles

- [Documentation de l'API Patreon](https://docs.patreon.com/)
- [Documentation de Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Guide OAuth2 de Patreon](https://docs.patreon.com/#oauth)

## Note sur le déploiement automatisé

Si vous souhaitez mettre en place un déploiement automatisé via GitHub Actions, vous pouvez créer un token API Cloudflare et le configurer comme secret dans votre dépôt GitHub :

1. [Créez un nouveau token API](https://dash.cloudflare.com/profile/api-tokens) avec le modèle "Edit Cloudflare Workers"
2. Ajoutez ce token comme secret GitHub avec le nom `CF_API_TOKEN`
3. Adaptez le workflow GitHub Actions selon vos besoins

### Personnalisation finale

1. Dans le fichier [index.html](index.html), remplacez l'URL `https://patreon-oauth-login.your-worker.workers.dev` par l'URL de votre propre worker déployé, à la fois dans la variable `WORKER_URL` et dans le tag `<a href="...">` du bouton de connexion.

2. Adaptez le style et le contenu de la page selon vos besoins.

Et voilà ! Vous avez maintenant un système d'authentification OAuth2 avec Patreon complet et prêt à l'emploi. 🎉

## Flux d'authentification complet

Le processus d'authentification se déroule comme suit :

1. Un utilisateur ouvre votre page contenant le bouton "Connexion avec Patreon"
2. Il clique sur ce bouton
3. Il est redirigé vers votre worker Cloudflare
4. Le worker le redirige vers `https://www.patreon.com/oauth2/authorize...`
5. L'utilisateur se connecte sur Patreon et autorise votre application
6. Patreon redirige l'utilisateur vers votre page avec un paramètre `?code=...`
7. Le JavaScript de votre page échange ce code contre un token d'accès via votre worker
8. Vous pouvez maintenant utiliser ce token pour accéder aux données de l'utilisateur via l'API Patreon

## Avantages de cette approche

- **Sécurité** : Votre client secret n'est jamais exposé côté client
- **Simplicité** : Cloudflare Workers gère toute la complexité de l'échange de tokens
- **Performance** : Déploiement sur le réseau mondial de Cloudflare pour des temps de réponse minimaux
- **Extensibilité** : Facile à étendre pour ajouter d'autres fonctionnalités liées à Patreon

Profitez de votre nouveau système d'authentification Patreon ! 🎮✨

[ISC](LICENSE)
