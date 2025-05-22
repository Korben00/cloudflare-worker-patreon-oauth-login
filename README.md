# cloudflare-worker-patreon-oauth-login

> Un exemple d'authentification OAuth2 avec Patreon via Cloudflare Worker

Le fichier [patreon-oauth-login.js](patreon-oauth-login.js) est un [Cloudflare Worker](https://workers.cloudflare.com/) qui peut être déployé en continu via GitHub Actions.

✨ **Mis à jour le 22 mai 2025** ✨

Ce worker fait 5 choses :

1. Quand vous ouvrez l'URL du worker, il redirige vers la page d'authentification OAuth2 de Patreon
2. Il accepte une requête `POST` avec le `code` OAuth récupéré après la redirection et renvoie un token d'accès en retour
3. Il fournit un endpoint `/identity` qui vérifie le statut de membre et d'administrateur de l'utilisateur connecté
4. Il propose un endpoint `/proxy-image` qui contourne les restrictions CORS sur les images Patreon
5. Il active CORS pour permettre les requêtes cross-origin depuis n'importe quel domaine

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
   - Nom : `PATREON_CAMPAIGN_ID` - Valeur : [l'ID de votre campagne Patreon]
   - Nom : `PATREON_CREATOR_ID` - Valeur : [votre ID créateur Patreon]
7. Assurez-vous que l'option "Encrypt" est cochée pour la variable CLIENT_SECRET (pour des raisons de sécurité)
8. Cliquez sur "Save and Deploy"

#### Méthode 2 : Via la ligne de commande avec wrangler

1. Modifiez le fichier `wrangler.toml` pour ajouter votre CLIENT_ID (qui n'est pas un secret) :

```toml
[vars]
CLIENT_ID = "votre_client_id_patreon"
PATREON_CAMPAIGN_ID = "votre_id_campagne_patreon"
PATREON_CREATOR_ID = "votre_id_createur_patreon"
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

### Étape 5 : Configurer l'URL de redirection

Dans le fichier `patreon-oauth-login.js`, modifiez les URL de redirection qui sont actuellement configurées pour `http://localhost:8000/index.html` :

```javascript
// Remplacez cette ligne dans le code (deux occurrences)
const redirect_uri = "http://localhost:8000/index.html";
// Par l'URL configurée dans votre app Patreon
const redirect_uri = "https://votre-site.com/callback";
```

> ⚠️ **Important** : Cette URL doit correspondre exactement à celle configurée dans votre application Patreon.

### Étape 6 : Intégrer à votre site web

Pour intégrer ce système d'authentification à votre site web :

1. Modifiez le fichier `index.html` pour pointer vers l'URL de votre worker déployé
2. Personnalisez l'apparence et le comportement selon vos besoins
3. Adaptez le traitement des données utilisateur retournées par l'API Patreon

## Fonctionnement technique

### Processus d'authentification OAuth2

Le processus d'authentification OAuth2 avec Patreon se déroule comme suit :

1. L'utilisateur clique sur "Connexion avec Patreon" sur votre site
2. Il est redirigé vers l'URL d'autorisation de Patreon
3. Après authentification et autorisation sur Patreon, il est redirigé vers votre site avec un code temporaire
4. Votre site envoie ce code à votre worker Cloudflare
5. Le worker échange ce code contre un token d'accès auprès de l'API Patreon
6. Le token d'accès est renvoyé à votre site
7. Votre site utilise ce token pour accéder aux informations de l'utilisateur via l'API Patreon

### Endpoint /identity

L'endpoint `/identity` fournit un accès sécurisé à l'API Patreon pour vérifier l'identité de l'utilisateur et son statut de membre :

```javascript
// Exemple d'utilisation de l'endpoint /identity
fetch('https://votre-worker.workers.dev/identity', {
  headers: {
    'Authorization': 'Bearer ' + token_acces
  }
})
.then(response => response.json())
.then(data => {
  console.log('Statut de membre:', data.membership_status);
});
```

Le worker enrichit les données renvoyées avec un objet `membership_status` contenant :
- `is_member` : si l'utilisateur est un membre actif de la campagne
- `is_admin` : si l'utilisateur est le créateur/administrateur de la campagne
- `status` : le statut détaillé (`active_paid_member`, `gift_member`, `trial_member`, etc.)
- `membership` : les données complètes de l'adhésion

### Endpoint /proxy-image

L'endpoint `/proxy-image` permet de contourner les restrictions CORS sur les images hébergées par Patreon :

```javascript
// Exemple d'utilisation du proxy d'images
const proxyUrl = 'https://votre-worker.workers.dev/proxy-image?url=' + 
  encodeURIComponent('https://c10.patreonusercontent.com/3/eyJ3...')

// Utilisation dans une balise img
document.getElementById('avatar').src = proxyUrl;
```

## Aller plus loin

Vous pouvez améliorer ce système en :

- Personnalisant les scopes OAuth demandés (actuellement limité à `identity`)
- Implémentant la gestion du refresh token pour maintenir l'authentification active
- Stockant les tokens dans un KV store de Cloudflare pour une persistance entre les sessions
- Ajoutant plus de vérifications de sécurité (vérification de l'origine, rate limiting)
- Créant des endpoints supplémentaires pour accéder à d'autres ressources de l'API Patreon
- Personnalisant la logique de détection des types de membres selon vos besoins spécifiques

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

## Avantages de cette approche :

- **Sécurité** : Votre client secret n'est jamais exposé côté client
- **Analyse complète** : Détection intelligente des différents types de membres (payants, offerts, essai gratuit)
- **Simplicité** : Cloudflare Workers gère toute la complexité de l'échange de tokens
- **Performance** : Déploiement sur le réseau mondial de Cloudflare pour des temps de réponse minimaux
- **Extensibilité** : Facile à étendre pour ajouter d'autres fonctionnalités liées à Patreon
- **Proxy d'images** : Contourne les restrictions CORS sur les images Patreon pour une meilleure intégration

Profitez de votre nouveau système d'authentification Patreon ! 🎮✨

[ISC](LICENSE)
