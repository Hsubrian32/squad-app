/**
 * enrich-venues Edge Function
 *
 * Discovers and enriches venues from Google Places API for a given
 * geographic area. Called periodically (daily/weekly via cron) or
 * on-demand from admin tooling — never during live match runs.
 *
 * Workflow:
 *  1. Accept a center point (lat/lng) + radius + city name
 *  2. Search Google Places for each of our desired venue types
 *  3. Filter by rating >= 4.0 and review_count >= 20
 *  4. Upsert into venues table (keyed on google_place_id)
 *  5. Refresh existing venues with updated rating/hours/status
 *  6. Compute suitability_score for each venue
 *
 * Environment variables required:
 *   GOOGLE_PLACES_API_KEY — Google Places API key with Places API enabled
 *
 * Request body (JSON):
 *   {
 *     lat: number,
 *     lng: number,
 *     radius_m: number,       // Search radius in metres (default 3000)
 *     city: string,           // Human-readable city label, e.g. "New York"
 *     neighborhood?: string,  // Optional sub-area label, e.g. "Lower East Side"
 *     dry_run?: boolean       // If true, return results without writing to DB
 *   }
 */

import {
  corsHeaders,
  createServiceRoleClient,
  errorResponse,
  handleCors,
  jsonResponse,
} from "../_shared/supabase-client.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnrichRequest {
  lat: number;
  lng: number;
  radius_m?: number;
  city: string;
  neighborhood?: string;
  dry_run?: boolean;
}

interface GooglePlaceResult {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types: string[];
  geometry: { location: { lat: number; lng: number } };
  business_status?: string;
  opening_hours?: { open_now: boolean; weekday_text?: string[] };
}

interface GoogleDetailsResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  business_status?: string;
  opening_hours?: {
    open_now?: boolean;
    periods?: unknown[];
    weekday_text?: string[];
  };
  geometry?: { location: { lat: number; lng: number } };
  types?: string[];
}

interface NormalizedVenue {
  google_place_id: string;
  name: string;
  address: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  rating: number | null;
  review_count: number | null;
  price_level: number | null;
  operational_status: string;
  source: string;
  is_verified: boolean;
  hours_json: unknown | null;
  phone: string | null;
  website: string | null;
  // Derived from Google types
  venue_type: string | null;
  budget_tier: string;
  is_outdoor: boolean;
  is_alcohol_free: boolean;
  vibe_tags: string[];
  capacity: number;
  active: boolean;
  category: string;
  suitability_score: number;
  suitability_flags: string[];
  last_enriched_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";

// Google Place types → our venue_type mapping
const GOOGLE_TYPE_MAP: Record<string, string> = {
  bar: "bar",
  night_club: "bar",
  liquor_store: "bar",
  brewery: "brewery",
  cafe: "coffee_shop",
  coffee: "coffee_shop",
  restaurant: "restaurant",
  food: "restaurant",
  meal_takeaway: "restaurant",
  meal_delivery: "restaurant",
  bowling_alley: "activity_center",
  amusement_park: "activity_center",
  park: "park",
  rooftop_bar: "rooftop",
};

// Google types that suggest a bar/drinking venue
const DRINKING_TYPES = new Set(["bar", "night_club", "brewery", "liquor_store"]);

// Venue types we want to discover from Google Places
const TARGET_GOOGLE_TYPES = [
  "bar",
  "cafe",
  "restaurant",
  "night_club",
  "bowling_alley",
];

// Minimum quality thresholds for importing a venue
const MIN_RATING = 4.0;
const MIN_REVIEW_COUNT = 20;

// ---------------------------------------------------------------------------
// Suitability scoring
// ---------------------------------------------------------------------------

// Base suitability score by venue_type for group meetups (0–100)
const SUITABILITY_BASE: Record<string, number> = {
  arcade_bar: 92,
  lounge: 84,
  bar: 80,
  brewery: 82,
  coffee_shop: 78,
  cafe: 75,
  activity_center: 80,
  rooftop: 72,
  restaurant: 65,
  park: 58,
};

function computeSuitabilityScore(
  venue_type: string | null,
  is_outdoor: boolean,
  is_alcohol_free: boolean,
  price_level: number | null,
  googleTypes: string[]
): { score: number; flags: string[] } {
  const baseType = venue_type ?? "restaurant";
  let score = SUITABILITY_BASE[baseType] ?? 65;
  const flags: string[] = [];

  // Venue type flags
  if (
    ["bar", "lounge", "brewery", "arcade_bar"].includes(baseType)
  ) {
    flags.push("casual");
    flags.push("first_meet_natural");
  }
  if (["coffee_shop", "cafe"].includes(baseType)) {
    flags.push("conversational");
    flags.push("quiet_enough");
    flags.push("daytime_friendly");
  }
  if (baseType === "arcade_bar" || baseType === "activity_center") {
    flags.push("activity_based");
    flags.push("group_friendly");
  }
  if (baseType === "restaurant") {
    flags.push("conversational");
  }

  // Modifiers
  if (is_outdoor) {
    score -= 4;
    flags.push("outdoor_available");
  } else {
    score += 3;
  }
  if (is_alcohol_free) {
    score += 2;
    flags.push("alcohol_free");
  }

  // Price level checks
  if (price_level !== null) {
    if (price_level >= 3) {
      score -= 8;
      flags.push("upscale");
    } else if (price_level <= 1) {
      flags.push("budget_friendly");
    }
  }

  // Google type signals
  if (googleTypes.includes("night_club")) {
    score -= 12;
    flags.push("loud");
  }
  if (
    googleTypes.some((t) => ["bar", "cafe", "restaurant"].includes(t))
  ) {
    flags.push("public");
  }

  // Always flag as group_friendly if suitability > 75
  if (score > 75 && !flags.includes("group_friendly")) {
    flags.push("group_friendly");
  }

  return { score: Math.max(0, Math.min(100, score)), flags };
}

// ---------------------------------------------------------------------------
// Google type → our venue type + derived fields
// ---------------------------------------------------------------------------

function deriveVenueAttributes(
  googleTypes: string[],
  priceLevel: number | null
): {
  venue_type: string | null;
  budget_tier: string;
  is_outdoor: boolean;
  is_alcohol_free: boolean;
  vibe_tags: string[];
  category: string;
} {
  // Map the first recognized Google type
  let venue_type: string | null = null;
  for (const t of googleTypes) {
    if (GOOGLE_TYPE_MAP[t]) {
      venue_type = GOOGLE_TYPE_MAP[t];
      break;
    }
  }

  // Budget tier from price_level
  let budget_tier: string;
  if (priceLevel === null || priceLevel === undefined) {
    budget_tier = "mid_range";
  } else if (priceLevel <= 1) {
    budget_tier = "budget";
  } else if (priceLevel === 2) {
    budget_tier = "mid_range";
  } else {
    budget_tier = "upscale";
  }

  // is_outdoor: parks are assumed outdoor; others default false
  const is_outdoor =
    googleTypes.includes("park") || googleTypes.includes("amusement_park");

  // is_alcohol_free: cafes/coffee/parks are typically alcohol-free
  const is_alcohol_free =
    !googleTypes.some((t) => DRINKING_TYPES.has(t)) &&
    (googleTypes.includes("cafe") ||
      googleTypes.includes("park") ||
      googleTypes.includes("coffee"));

  // Derive vibe_tags from type combos
  const vibe_tags: string[] = [];
  if (googleTypes.some((t) => DRINKING_TYPES.has(t))) vibe_tags.push("lively");
  if (googleTypes.includes("cafe")) vibe_tags.push("chill", "intellectual");
  if (googleTypes.includes("bowling_alley")) vibe_tags.push("adventurous", "games");
  if (budget_tier === "upscale") vibe_tags.push("refined");
  if (budget_tier === "budget") vibe_tags.push("casual");

  // Category (legacy field)
  const category =
    venue_type?.replace("_", " ") ??
    googleTypes[0]?.replace(/_/g, " ") ??
    "venue";

  return {
    venue_type,
    budget_tier,
    is_outdoor,
    is_alcohol_free,
    vibe_tags: [...new Set(vibe_tags)],
    category,
  };
}

// ---------------------------------------------------------------------------
// Operational status from Google business_status
// ---------------------------------------------------------------------------

function toOperationalStatus(googleStatus?: string): string {
  switch (googleStatus) {
    case "OPERATIONAL":
      return "operational";
    case "CLOSED_TEMPORARILY":
      return "closed_temporarily";
    case "CLOSED_PERMANENTLY":
      return "closed_permanently";
    default:
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Google Places API calls
// ---------------------------------------------------------------------------

async function searchNearby(
  lat: number,
  lng: number,
  radius: number,
  type: string,
  apiKey: string
): Promise<GooglePlaceResult[]> {
  const url =
    `${PLACES_API_BASE}/nearbysearch/json` +
    `?location=${lat},${lng}` +
    `&radius=${radius}` +
    `&type=${type}` +
    `&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Places API error for type ${type}:`, res.status, res.statusText);
    return [];
  }

  const json = await res.json();
  if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    console.warn(`Places API non-OK status for type ${type}:`, json.status, json.error_message);
    return [];
  }

  return (json.results ?? []) as GooglePlaceResult[];
}

async function getPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<GoogleDetailsResult | null> {
  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "formatted_phone_number",
    "website",
    "rating",
    "user_ratings_total",
    "price_level",
    "business_status",
    "opening_hours",
    "geometry",
    "types",
  ].join(",");

  const url =
    `${PLACES_API_BASE}/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=${fields}` +
    `&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Details API error for ${placeId}:`, res.status);
    return null;
  }

  const json = await res.json();
  if (json.status !== "OK") {
    console.warn(`Details API non-OK for ${placeId}:`, json.status);
    return null;
  }

  return json.result as GoogleDetailsResult;
}

// ---------------------------------------------------------------------------
// Normalize a Google Details result into our venue shape
// ---------------------------------------------------------------------------

function normalizeVenue(
  details: GoogleDetailsResult,
  neighborhood: string | null,
  city: string
): NormalizedVenue | null {
  const lat = details.geometry?.location.lat;
  const lng = details.geometry?.location.lng;
  if (lat === undefined || lng === undefined) return null;

  const rating = details.rating ?? null;
  const review_count = details.user_ratings_total ?? null;

  // Quality gate: skip venues below threshold
  if (rating !== null && rating < MIN_RATING) return null;
  if (review_count !== null && review_count < MIN_REVIEW_COUNT) return null;

  const googleTypes = details.types ?? [];
  const priceLevel = details.price_level ?? null;

  const attrs = deriveVenueAttributes(googleTypes, priceLevel);
  const operationalStatus = toOperationalStatus(details.business_status);

  // Skip permanently closed venues
  if (operationalStatus === "closed_permanently") return null;

  const { score, flags } = computeSuitabilityScore(
    attrs.venue_type,
    attrs.is_outdoor,
    attrs.is_alcohol_free,
    priceLevel,
    googleTypes
  );

  // Use neighborhood if provided, else city
  const areaLabel = neighborhood ?? city;

  return {
    google_place_id: details.place_id,
    name: details.name,
    address: details.formatted_address ?? "",
    neighborhood: areaLabel,
    lat,
    lng,
    rating,
    review_count,
    price_level: priceLevel,
    operational_status: operationalStatus,
    source: "google_places",
    is_verified: true,
    hours_json: details.opening_hours ?? null,
    phone: details.formatted_phone_number ?? null,
    website: details.website ?? null,
    ...attrs,
    capacity: 30, // Conservative default; can be overridden manually
    active: operationalStatus === "operational",
    suitability_score: score,
    suitability_flags: flags,
    last_enriched_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) {
    return errorResponse(
      "GOOGLE_PLACES_API_KEY environment variable is not set. " +
        "Set it via: supabase secrets set GOOGLE_PLACES_API_KEY=<key>",
      500
    );
  }

  let body: EnrichRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { lat, lng, city, neighborhood = null } = body;
  const radius = body.radius_m ?? 3000;
  const dryRun = body.dry_run ?? false;

  if (!lat || !lng || !city) {
    return errorResponse("lat, lng, and city are required", 400);
  }

  const supabase = createServiceRoleClient();
  const discovered: NormalizedVenue[] = [];
  const placeIdsSeen = new Set<string>();

  console.log(
    `Enriching venues near (${lat}, ${lng}) radius=${radius}m city="${city}"` +
      (neighborhood ? ` neighborhood="${neighborhood}"` : "") +
      (dryRun ? " [DRY RUN]" : "")
  );

  // ------------------------------------------------------------------
  // Step 1: Search for each target type
  // ------------------------------------------------------------------
  for (const type of TARGET_GOOGLE_TYPES) {
    const results = await searchNearby(lat, lng, radius, type, apiKey);
    console.log(`  ${type}: ${results.length} raw results`);

    for (const place of results) {
      if (placeIdsSeen.has(place.place_id)) continue;
      placeIdsSeen.add(place.place_id);

      // Quick filter before fetching details
      if ((place.rating ?? 0) < MIN_RATING) continue;
      if ((place.user_ratings_total ?? 0) < MIN_REVIEW_COUNT) continue;
      if (place.business_status === "CLOSED_PERMANENTLY") continue;

      // Fetch full details for enrichment
      const details = await getPlaceDetails(place.place_id, apiKey);
      if (!details) continue;

      const normalized = normalizeVenue(details, neighborhood, city);
      if (!normalized) continue;

      discovered.push(normalized);
    }
  }

  console.log(`Discovered ${discovered.length} qualifying venues`);

  if (dryRun) {
    return jsonResponse({
      dry_run: true,
      city,
      neighborhood,
      total_discovered: discovered.length,
      venues: discovered.map((v) => ({
        name: v.name,
        address: v.address,
        rating: v.rating,
        review_count: v.review_count,
        venue_type: v.venue_type,
        suitability_score: v.suitability_score,
        suitability_flags: v.suitability_flags,
        operational_status: v.operational_status,
      })),
    });
  }

  // ------------------------------------------------------------------
  // Step 2: Upsert into DB, keyed on google_place_id
  // ------------------------------------------------------------------
  let upserted = 0;
  let errors = 0;

  for (const v of discovered) {
    const { error } = await supabase.from("venues").upsert(
      {
        // Use google_place_id as the external key; Postgres will match on it
        // if we have a unique constraint (we do — see migration).
        google_place_id: v.google_place_id,
        name: v.name,
        address: v.address,
        neighborhood: v.neighborhood,
        lat: v.lat,
        lng: v.lng,
        rating: v.rating,
        review_count: v.review_count,
        price_level: v.price_level,
        operational_status: v.operational_status,
        source: v.source,
        is_verified: v.is_verified,
        hours_json: v.hours_json,
        phone: v.phone,
        website: v.website,
        venue_type: v.venue_type,
        budget_tier: v.budget_tier,
        is_outdoor: v.is_outdoor,
        is_alcohol_free: v.is_alcohol_free,
        vibe_tags: v.vibe_tags,
        capacity: v.capacity,
        active: v.active,
        category: v.category,
        suitability_score: v.suitability_score,
        suitability_flags: v.suitability_flags,
        last_enriched_at: v.last_enriched_at,
      },
      { onConflict: "google_place_id", ignoreDuplicates: false }
    );

    if (error) {
      console.error(`Failed to upsert ${v.name}:`, error.message);
      errors++;
    } else {
      upserted++;
    }
  }

  // ------------------------------------------------------------------
  // Step 3: Refresh existing verified venues that haven't been updated
  //         recently (> 7 days old) — just fetch their place details again
  // ------------------------------------------------------------------
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: staleVenues } = await supabase
    .from("venues")
    .select("id, google_place_id, name")
    .eq("source", "google_places")
    .eq("active", true)
    .or(`last_enriched_at.is.null,last_enriched_at.lt.${sevenDaysAgo}`)
    .not("google_place_id", "is", null)
    .limit(20); // Batch limit to avoid rate-limit issues

  if (staleVenues && staleVenues.length > 0) {
    console.log(`Refreshing ${staleVenues.length} stale venue(s)...`);
    for (const sv of staleVenues) {
      if (!sv.google_place_id) continue;
      const details = await getPlaceDetails(sv.google_place_id, apiKey);
      if (!details) continue;

      const opStatus = toOperationalStatus(details.business_status);
      const { error } = await supabase
        .from("venues")
        .update({
          rating: details.rating ?? null,
          review_count: details.user_ratings_total ?? null,
          operational_status: opStatus,
          active: opStatus === "operational",
          hours_json: details.opening_hours ?? null,
          last_enriched_at: new Date().toISOString(),
          is_verified: true,
        })
        .eq("id", sv.id);

      if (error) {
        console.error(`Failed to refresh ${sv.name}:`, error.message);
      }
    }
  }

  return jsonResponse({
    city,
    neighborhood,
    total_discovered: discovered.length,
    upserted,
    errors,
    stale_refreshed: staleVenues?.length ?? 0,
  });
});
