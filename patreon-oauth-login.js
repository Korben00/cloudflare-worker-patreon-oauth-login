addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});

// Utilisation des secrets et des variables d'environnement
const client_id = CLIENT_ID;
const client_secret = CLIENT_SECRET;
const patreon_campaign_id = PATREON_CAMPAIGN_ID;
const patreon_creator_id = PATREON_CREATOR_ID;

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
  
  // Proxy pour l'API d'identité Patreon avec vérification du statut de membre et d'admin
  if (path === "/identity" && request.method === "GET") {
    const token = request.headers.get("Authorization");
    if (!token) {
      return new Response(JSON.stringify({ error: "Token d'autorisation manquant" }), {
        status: 401,
        headers: corsHeaders
      });
    }
    
    try {
      // Transmettre la requête à l'API Patreon avec le token en incluant les données de membre
      // Requête avec inclusion des membres, des avantages, et des données de campagne
      const response = await fetch(
        `https://www.patreon.com/api/oauth2/v2/identity?` + 
        `include=memberships,memberships.campaign,memberships.currently_entitled_tiers,campaign.benefits` + 
        `&fields[user]=about,created,email,full_name,image_url,url,is_email_verified` + 
        `&fields[member]=patron_status,is_follower,last_charge_date,last_charge_status,lifetime_support_cents,currently_entitled_amount_cents,pledge_relationship_start,campaign_lifetime_support_cents,pledge_cadence,is_free_trial,will_pay_amount_cents,next_charge_date,note,pledge_cadence,pledge_relationship_start,will_pay_amount_cents` + 
        `&fields[campaign]=creation_name,is_monthly,one_liner,patron_count,pay_per_name,pledge_url` + 
        `&fields[tier]=amount_cents,description,discord_role_ids,edited_at,image_url,patron_count,published,published_at,requires_shipping,title,url`, 
        {
          headers: {
            "Authorization": token,
            "Accept": "application/json"
          }
        }
      );
      
      const data = await response.json();
      
      // Analyser les données pour déterminer le statut du membre
      let isMember = false;
      let isAdmin = false;
      let memberStatus = "non_member";
      let membershipData = null;
      
      // Vérifier si l'utilisateur est l'administrateur (créateur) de la campagne
      if (data.data && data.data.id === patreon_creator_id) {
        isAdmin = true;
        memberStatus = "admin";
      }
      
      // Vérifier les relations de membre
      if (data.included) {
        // Rechercher les adhésions correspondant à notre campagne
        const memberships = data.included.filter(item => 
          item.type === "member" && 
          item.relationships && 
          item.relationships.campaign && 
          item.relationships.campaign.data && 
          item.relationships.campaign.data.id === patreon_campaign_id
        );
        
        if (memberships.length > 0) {
          const membership = memberships[0];
          membershipData = membership;
          
          // Vérifier si c'est un membre actif payant
          if (membership.attributes) {
            // Valeurs possibles: active_patron, declined_patron, former_patron
            const patronStatus = membership.attributes.patron_status;
            // Vérifier si c'est un membre payant ou gratuit
            const entitledAmountCents = membership.attributes.currently_entitled_amount_cents || 0;
            
            // Détecter si c'est un abonnement offert (gift membership)
            // On peut le détecter par plusieurs moyens:
            // 1. La présence d'une note spécifique "Gift" dans le champ note
            // 2. Le patron a un montant actuel mais ne paiera pas pour le prochain cycle (will_pay_amount_cents = 0)
            const memberNote = membership.attributes.note || '';
            const willPayAmountCents = membership.attributes.will_pay_amount_cents || 0;
            const isFreeTrial = membership.attributes.is_free_trial || false;
            
            const isGiftMembership = 
              (memberNote.toLowerCase().includes('gift') || 
              (entitledAmountCents > 0 && willPayAmountCents === 0 && !isFreeTrial));
            
            // Indiquer si c'est un membre payant ou gratuit
            const isPaidMember = entitledAmountCents > 0;
            
            // Stocker le montant dans les données de membre
            membershipData.entitled_amount_cents = entitledAmountCents;
            membershipData.is_paid_member = isPaidMember;
            membershipData.is_gift_membership = isGiftMembership;
            membershipData.will_pay_amount_cents = willPayAmountCents;
            membershipData.is_free_trial = isFreeTrial;
            
            if (patronStatus === "active_patron") {
              // Vérifier le type de membre
              if (isPaidMember) {
                isMember = true;
                
                if (isGiftMembership) {
                  // Membre avec abonnement offert
                  memberStatus = "gift_member";
                } else if (isFreeTrial) {
                  // Membre en période d'essai gratuite
                  memberStatus = "trial_member";
                } else {
                  // Membre payant standard
                  memberStatus = "active_paid_member";
                }
              } else {
                // Membre actif mais gratuit
                memberStatus = "active_free_member";
              }
              
              // Ajouter les niveaux auxquels le membre a droit
              if (membership.relationships && 
                  membership.relationships.currently_entitled_tiers && 
                  membership.relationships.currently_entitled_tiers.data) {
                
                const entitledTierIds = membership.relationships.currently_entitled_tiers.data.map(tier => tier.id);
                
                // Trouver les détails complets des niveaux
                const tiers = data.included.filter(item => 
                  item.type === "tier" && entitledTierIds.includes(item.id)
                );
                
                membershipData.entitled_tiers = tiers;
              }
            } else if (patronStatus === "declined_patron") {
              memberStatus = "declined_member";
            } else if (patronStatus === "former_patron") {
              memberStatus = "former_member";
            }
          }
        }
      }
      
      // Ajouter les informations de statut aux données de réponse
      const enhancedData = {
        ...data,
        membership_status: {
          is_member: isMember,
          is_admin: isAdmin,
          status: memberStatus,
          membership: membershipData
        }
      };
      
      return new Response(JSON.stringify(enhancedData), {
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
