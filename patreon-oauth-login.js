addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});

// Utilisation des secrets
const client_id = CLIENT_ID;
const client_secret = CLIENT_SECRET;

async function handle(request) {
  // Gérer la requête CORS pre-flight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  
  // Préparer les en-têtes CORS pour toutes les réponses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  };
  
  // Récupérer l'URL de la requête
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Proxy pour l'API d'identité Patreon
  if (path === "/identity" && request.method === "GET") {
    const token = request.headers.get("Authorization");
    if (!token) {
      return new Response(JSON.stringify({ error: "Token d'autorisation manquant" }), {
        status: 401,
        headers: corsHeaders
      });
    }
    
    try {
      // Transmettre la requête à l'API Patreon avec le token
      const response = await fetch("https://www.patreon.com/api/oauth2/v2/identity?include=memberships&fields[user]=about,created,email,full_name,image_url,url", {
        headers: {
          "Authorization": token,
          "Accept": "application/json"
        }
      });
      
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: corsHeaders
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
  
  // Proxy pour les images (pour contourner les restrictions CORS)
  if (path === "/proxy-image" && request.method === "GET") {
    // Récupérer l'URL de l'image depuis le paramètre
    const imageUrl = url.searchParams.get("url");
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "URL d'image manquante" }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    try {
      // Récupérer l'image
      const imageResponse = await fetch(imageUrl);
      
      // Vérifier si l'image a été récupérée avec succès
      if (!imageResponse.ok) {
        return new Response(JSON.stringify({ error: `Erreur lors de la récupération de l'image: ${imageResponse.status}` }), {
          status: imageResponse.status,
          headers: corsHeaders
        });
      }
      
      // Récupérer les données binaires de l'image
      const imageData = await imageResponse.arrayBuffer();
      
      // Détecter le type de contenu (MIME type)
      const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
      
      // Renvoyer l'image avec les en-têtes CORS appropriés
      return new Response(imageData, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400" // Mettre en cache pendant 24h
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }

  // Redirection vers la page d'authentification OAuth de Patreon
  if (request.method === "GET" && path === "/") {
    // URL de redirection explicite - doit correspondre exactement à celle configurée dans l'app Patreon
    const redirect_uri = "http://localhost:8000/index.html";
    
    // Par défaut, on demande les scopes: users pledges-to-me my-campaign
    return Response.redirect(
      `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${client_id}&scope=identity&redirect_uri=${encodeURIComponent(redirect_uri)}`,
      302
    );
  }

  try {
    const { code } = await request.json();
    
    // URL de redirection explicite - doit être la même que celle utilisée pour l'autorisation
    const redirect_uri = "http://localhost:8000/index.html";

    // Échange du code contre un token d'accès
    const response = await fetch(
      "https://www.patreon.com/api/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "cloudflare-worker-patreon-oauth-login",
        },
        body: new URLSearchParams({
          code: code,
          grant_type: "authorization_code",
          client_id: client_id,
          client_secret: client_secret,
          redirect_uri: redirect_uri, // Utilisation de l'URL explicite au lieu du Referer
        }).toString(),
      }
    );
    
    const result = await response.json();

    if (result.error) {
      return new Response(JSON.stringify(result), { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Retourne le token d'accès au client
    return new Response(JSON.stringify({ 
      token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
      scope: result.scope
    }), {
      status: 201,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
