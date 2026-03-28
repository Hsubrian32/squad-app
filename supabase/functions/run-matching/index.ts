/**
 * run-matching Edge Function — v2
 *
 * BUG FIX: The previous implementation queried 'user_profiles' (non-existent view)
 * and 'blocked_pairs' (wrong table name — should be 'blocks'). The greedyGroup
 * function correctly capped groups at TARGET_GROUP_SIZE during pairing, but had
 * NO redistribution logic — the docstring promised redistribution but the code
 * was never written. Any user whose pairs were all blocked/full ended up in a
 * 1-person "group" that was just skipped. More critically, dev testing used
 * dev_join_demo_group() which bumps max_members and adds users to the seed group —
 * this is what actually created the group of 10 (8 seed members + 2+ testers).
 * Fix: (1) query matching_pool view for correct schema, (2) add redistribution
 * pass after greedy grouping, (3) hard MAX_GROUP_SIZE = 8 cap enforced everywhere,
 * (4) venue selection is now preference-aware, not random.
 */

import {
  corsHeaders,
  createServiceRoleClient,
  errorResponse,
  handleCors,
  jsonResponse,
} from "../_shared/supabase-client.ts";

// ---------------------------------------------------------------------------
// Group size constants
// ---------------------------------------------------------------------------

const MAX_GROUP_SIZE = 8;
const TARGET_GROUP_SIZE = 6;
const MIN_GROUP_SIZE = 5;

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

const SCORE = {
  // Interests (max 15)
  INTEREST_PER: 3, INTEREST_MAX: 15,
  // Group vibe (max 12)
  VIBE_PER: 4, VIBE_MAX: 12,
  // Social energy (max 8)
  ENERGY_COMPLEMENTARY: 8, ENERGY_AMBIVERT: 6, ENERGY_SAME: 4,
  // Activity preferences (max 10)
  ACTIVITY_PER: 2, ACTIVITY_MAX: 10,
  // Availability overlap (max 10)
  AVAIL_PER: 2, AVAIL_MAX: 10,
  // Drinking compatibility (max 8)
  DRINK_SAME: 8, DRINK_NO_PREF: 5, DRINK_CONFLICT: -5,
  // Budget compatibility (max 6)
  BUDGET_SAME: 6, BUDGET_ADJACENT: 3,
  // Age bracket proximity (max 5)
  AGE_SAME: 5, AGE_ADJACENT: 3,
  // Goal overlap (max 5)
  GOAL_PER: 1, GOAL_MAX: 5,
  // Proximity (max 10, penalty -15)
  PROX_SAME_HOOD: 10, PROX_NEARBY_5KM: 7, PROX_REACHABLE: 4, PROX_TOO_FAR: -15,
  // History bonus
  HISTORY_BONUS: 4,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PoolUser {
  user_id: string;
  city: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  travel_radius_km: number;
  age: number | null;
  cycle_id: string;
  availability: Array<{ day_of_week: number; start_time: string; end_time: string }>;
  questionnaire: Record<string, string>;
}

interface MatchUser {
  id: string;
  lat: number | null;
  lng: number | null;
  travel_radius_km: number;
  neighborhood: string | null;
  age_range: string | null;
  social_energy: string;
  interests: string[];
  group_vibe: string[];
  activity_pref: string[];
  openness: number;
  drinking_pref: string;
  budget_pref: string;
  goals: string[];
  avail_slots: string[]; // "dayOfWeek_period" e.g. "5_evening"
}

interface EnrichedVenue {
  id: string;
  name: string;
  address: string;
  neighborhood: string | null;
  capacity: number;
  lat: number | null;
  lng: number | null;
  venue_type: string | null;
  vibe_tags: string[];
  budget_tier: string;
  is_outdoor: boolean;
  is_alcohol_free: boolean;
  // Quality fields (populated by enrich-venues or migration seed)
  rating: number | null;
  review_count: number | null;
  price_level: number | null;
  operational_status: string;   // 'operational' | 'closed_temporarily' | 'closed_permanently' | 'unknown'
  is_verified: boolean;
  suitability_score: number | null;
  suitability_flags: string[];
  source: string;               // 'google_places' | 'manual'
}

interface GroupProfile {
  social_energy: string;
  interests: string[];
  vibe_tags: string[];
  drinking_pref: string;
  budget_pref: string;
  activity_pref: string[];
}

// Decomposed score components for each venue (all 0–100 unless noted)
interface VenueScoreComponents {
  proximity: number;    // How central the venue is for this group (0–100)
  quality: number;      // Rating + review credibility (0–100)
  suitability: number;  // Group hangout appropriateness (0–100)
  preference: number;   // Drinking/budget/vibe/activity match (0–100)
  operational: number;  // Open and verified (0–100, -1000 = hard exclude)
  total: number;        // Weighted composite
}

interface VenueSelection {
  primary: EnrichedVenue;
  backup: EnrichedVenue | null;
  reasons: string[];            // Human-readable explanation tokens
  meetupArea: string | null;    // Neighborhood/area label
  qualityTierUsed: number;      // 1 = 4.2+ verified, 2 = 4.0+ fallback, 3 = all
}

interface MatchCycle {
  id: string;
  week_start: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Helper: parse JSON array stored as questionnaire answer string
// ---------------------------------------------------------------------------

function parseJsonArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
    return [raw];
  } catch {
    return [raw];
  }
}

// ---------------------------------------------------------------------------
// Helper: haversine distance in km
// ---------------------------------------------------------------------------

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Helper: convert availability slot to a canonical string key
// ---------------------------------------------------------------------------

function availSlotKey(dayOfWeek: number, startTime: string): string {
  // startTime format: "HH:MM:SS"
  const hour = parseInt(startTime.split(":")[0], 10);
  let period: string;
  if (hour < 12) {
    period = "morning";
  } else if (hour < 17) {
    period = "afternoon";
  } else if (hour < 21) {
    period = "evening";
  } else {
    period = "night";
  }
  return `${dayOfWeek}_${period}`;
}

// ---------------------------------------------------------------------------
// Convert a PoolUser (raw view row) into a MatchUser for scoring
// ---------------------------------------------------------------------------

function toMatchUser(p: PoolUser): MatchUser {
  const q = p.questionnaire ?? {};

  const rawInterests = q["interests"] ?? q["interest"] ?? "";
  const rawGroupVibe = q["group_vibe"] ?? q["vibe"] ?? "";
  const rawActivityPref = q["activity_pref"] ?? q["activity"] ?? "";
  const rawGoals = q["goals"] ?? q["goal"] ?? "";

  const avail_slots = (p.availability ?? []).map((slot) =>
    availSlotKey(slot.day_of_week, slot.start_time)
  );
  // Deduplicate slots
  const uniqueSlots = [...new Set(avail_slots)];

  return {
    id: p.user_id,
    lat: p.lat,
    lng: p.lng,
    travel_radius_km: p.travel_radius_km ?? 10,
    neighborhood: p.neighborhood,
    age_range: q["age_range"] ?? null,
    social_energy: q["social_energy"] ?? "ambivert",
    interests: parseJsonArray(rawInterests),
    group_vibe: parseJsonArray(rawGroupVibe),
    activity_pref: parseJsonArray(rawActivityPref),
    openness: parseInt(q["openness"] ?? "3", 10) || 3,
    drinking_pref: q["drinking_pref"] ?? "no_preference",
    budget_pref: q["budget_pref"] ?? "mid_range",
    goals: parseJsonArray(rawGoals),
    avail_slots: uniqueSlots,
  };
}

// ---------------------------------------------------------------------------
// Pairwise scoring functions
// ---------------------------------------------------------------------------

function scoreInterests(a: MatchUser, b: MatchUser): number {
  const setA = new Set(a.interests);
  const shared = b.interests.filter((i) => setA.has(i)).length;
  return Math.min(shared * SCORE.INTEREST_PER, SCORE.INTEREST_MAX);
}

function scoreVibe(a: MatchUser, b: MatchUser): number {
  const setA = new Set(a.group_vibe);
  const shared = b.group_vibe.filter((v) => setA.has(v)).length;
  return Math.min(shared * SCORE.VIBE_PER, SCORE.VIBE_MAX);
}

function scoreSocialEnergy(a: MatchUser, b: MatchUser): number {
  const ea = a.social_energy;
  const eb = b.social_energy;
  if (
    (ea === "introvert" && eb === "extrovert") ||
    (ea === "extrovert" && eb === "introvert")
  ) {
    return SCORE.ENERGY_COMPLEMENTARY;
  }
  if (ea === "ambivert" || eb === "ambivert") {
    return SCORE.ENERGY_AMBIVERT;
  }
  return SCORE.ENERGY_SAME;
}

function scoreActivity(a: MatchUser, b: MatchUser): number {
  const setA = new Set(a.activity_pref);
  const shared = b.activity_pref.filter((act) => setA.has(act)).length;
  return Math.min(shared * SCORE.ACTIVITY_PER, SCORE.ACTIVITY_MAX);
}

function scoreAvailability(a: MatchUser, b: MatchUser): number {
  const setA = new Set(a.avail_slots);
  const shared = b.avail_slots.filter((s) => setA.has(s)).length;
  return Math.min(shared * SCORE.AVAIL_PER, SCORE.AVAIL_MAX);
}

function scoreDrinking(a: MatchUser, b: MatchUser): number {
  const da = a.drinking_pref;
  const db = b.drinking_pref;
  if (da === db) return SCORE.DRINK_SAME;
  if (da === "no_preference" || db === "no_preference") return SCORE.DRINK_NO_PREF;
  // "drinking" vs "sober_friendly"
  return SCORE.DRINK_CONFLICT;
}

function scoreBudget(a: MatchUser, b: MatchUser): number {
  const budgetIndex: Record<string, number> = { budget: 0, mid_range: 1, upscale: 2 };
  const ia = budgetIndex[a.budget_pref] ?? 1;
  const ib = budgetIndex[b.budget_pref] ?? 1;
  const diff = Math.abs(ia - ib);
  if (diff === 0) return SCORE.BUDGET_SAME;
  if (diff === 1) return SCORE.BUDGET_ADJACENT;
  return 0;
}

function scoreAge(a: MatchUser, b: MatchUser): number {
  const ageIndex: Record<string, number> = {
    "18-24": 0,
    "25-30": 1,
    "31-35": 2,
    "36-40": 3,
    "41+": 4,
  };
  if (a.age_range === null || b.age_range === null) return 0;
  const ia = ageIndex[a.age_range];
  const ib = ageIndex[b.age_range];
  if (ia === undefined || ib === undefined) return 0;
  const diff = Math.abs(ia - ib);
  if (diff === 0) return SCORE.AGE_SAME;
  if (diff === 1) return SCORE.AGE_ADJACENT;
  return 0;
}

function scoreGoals(a: MatchUser, b: MatchUser): number {
  const setA = new Set(a.goals);
  const shared = b.goals.filter((g) => setA.has(g)).length;
  return Math.min(shared * SCORE.GOAL_PER, SCORE.GOAL_MAX);
}

function scoreProximity(a: MatchUser, b: MatchUser): number {
  // If either user has no location, return 0 — no penalty, no bonus
  if (
    a.lat === null || a.lng === null ||
    b.lat === null || b.lng === null
  ) {
    return 0;
  }

  const dist = haversineKm(a.lat, a.lng, b.lat, b.lng);

  if (
    a.neighborhood !== null &&
    b.neighborhood !== null &&
    a.neighborhood === b.neighborhood
  ) {
    return SCORE.PROX_SAME_HOOD;
  }

  if (dist <= 3) return SCORE.PROX_NEARBY_5KM;

  if (dist <= Math.min(a.travel_radius_km, b.travel_radius_km)) {
    return SCORE.PROX_REACHABLE;
  }

  return SCORE.PROX_TOO_FAR;
}

function computePairScore(
  a: MatchUser,
  b: MatchUser,
  historyBonus: boolean
): number {
  return (
    scoreInterests(a, b) +
    scoreVibe(a, b) +
    scoreSocialEnergy(a, b) +
    scoreActivity(a, b) +
    scoreAvailability(a, b) +
    scoreDrinking(a, b) +
    scoreBudget(a, b) +
    scoreAge(a, b) +
    scoreGoals(a, b) +
    scoreProximity(a, b) +
    (historyBonus ? SCORE.HISTORY_BONUS : 0)
  );
}

// ---------------------------------------------------------------------------
// Build scored pairs (O(n²))
// ---------------------------------------------------------------------------

function buildScoredPairs(
  users: MatchUser[],
  blockedPairs: Set<string>,
  previousPairs: Set<string>
): Array<{ a: string; b: string; score: number }> {
  const pairs: Array<{ a: string; b: string; score: number }> = [];

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const a = users[i];
      const b = users[j];
      const pairKey = [a.id, b.id].sort().join(":");
      if (blockedPairs.has(pairKey)) continue;
      const historyBonus = !previousPairs.has(pairKey);
      const score = computePairScore(a, b, historyBonus);
      pairs.push({ a: a.id, b: b.id, score });
    }
  }

  pairs.sort((x, y) => y.score - x.score);
  return pairs;
}

// ---------------------------------------------------------------------------
// Greedy grouping via Union-Find
// ---------------------------------------------------------------------------

function greedyGroup(
  users: MatchUser[],
  scoredPairs: Array<{ a: string; b: string; score: number }>,
  sizeCap: number
): string[][] {
  const parent = new Map<string, string>();
  const groupMembers = new Map<string, string[]>();

  function find(id: string): string {
    if (!parent.has(id)) {
      parent.set(id, id);
      groupMembers.set(id, [id]);
    }
    let root = parent.get(id)!;
    if (root !== id) {
      root = find(root);
      parent.set(id, root);
    }
    return root;
  }

  function groupSize(id: string): number {
    return groupMembers.get(find(id))?.length ?? 1;
  }

  function merge(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    const ma = groupMembers.get(ra) ?? [ra];
    const mb = groupMembers.get(rb) ?? [rb];
    if (ma.length >= mb.length) {
      for (const id of mb) parent.set(id, ra);
      groupMembers.set(ra, [...ma, ...mb]);
      groupMembers.delete(rb);
    } else {
      for (const id of ma) parent.set(id, rb);
      groupMembers.set(rb, [...ma, ...mb]);
      groupMembers.delete(ra);
    }
  }

  for (const u of users) find(u.id);

  for (const { a, b } of scoredPairs) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) continue;
    const sizeA = groupSize(a);
    const sizeB = groupSize(b);
    if (sizeA + sizeB > sizeCap) continue;
    merge(a, b);
  }

  const seen = new Set<string>();
  const groups: string[][] = [];

  for (const u of users) {
    const root = find(u.id);
    if (!seen.has(root)) {
      seen.add(root);
      groups.push(groupMembers.get(root) ?? [u.id]);
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Redistribution pass: absorb tiny groups into viable ones
// ---------------------------------------------------------------------------

function redistribute(
  groups: string[][],
  users: MatchUser[],
  scoredPairs: Array<{ a: string; b: string; score: number }>,
  maxSize: number
): { finalGroups: string[][]; unmatched: string[] } {
  const userMap = new Map<string, MatchUser>(users.map((u) => [u.id, u]));

  // Build a fast lookup: pairKey → score
  const pairScoreMap = new Map<string, number>();
  for (const p of scoredPairs) {
    pairScoreMap.set([p.a, p.b].sort().join(":"), p.score);
  }

  function pairScore(a: string, b: string): number {
    return pairScoreMap.get([a, b].sort().join(":")) ?? 0;
  }

  // Separate viable groups from tiny ones
  const viableGroups: string[][] = [];
  const tinyGroups: string[][] = [];

  for (const g of groups) {
    if (g.length >= MIN_GROUP_SIZE) {
      viableGroups.push([...g]);
    } else {
      tinyGroups.push([...g]);
    }
  }

  // Sort tiny groups smallest-first so we absorb the loneliest users first
  tinyGroups.sort((a, b) => a.length - b.length);

  // First pass: try to merge two tiny groups together if they fit within maxSize
  const mergedTiny: string[][] = [];
  const usedTinyIndices = new Set<number>();

  for (let i = 0; i < tinyGroups.length; i++) {
    if (usedTinyIndices.has(i)) continue;
    let merged = false;
    for (let j = i + 1; j < tinyGroups.length; j++) {
      if (usedTinyIndices.has(j)) continue;
      const combined = tinyGroups[i].length + tinyGroups[j].length;
      if (combined >= MIN_GROUP_SIZE && combined <= maxSize) {
        mergedTiny.push([...tinyGroups[i], ...tinyGroups[j]]);
        usedTinyIndices.add(i);
        usedTinyIndices.add(j);
        merged = true;
        break;
      }
    }
    if (!merged) {
      // Leave for member-by-member redistribution
      mergedTiny.push(tinyGroups[i]);
    }
  }

  const unmatched: string[] = [];

  // Second pass: for each still-tiny group, distribute members into viable groups
  for (const tiny of mergedTiny) {
    if (tiny.length >= MIN_GROUP_SIZE) {
      // Merged tiny is now viable
      viableGroups.push(tiny);
      continue;
    }

    for (const memberId of tiny) {
      let bestGroupIdx = -1;
      let bestAvgScore = -Infinity;

      // Sort viable groups by ascending size (prefer smaller so we fill evenly)
      const sortedIndices = viableGroups
        .map((_, idx) => idx)
        .sort((a, b) => viableGroups[a].length - viableGroups[b].length);

      for (const idx of sortedIndices) {
        const group = viableGroups[idx];
        if (group.length >= maxSize) continue;

        const avgScore =
          group.reduce((sum, gm) => sum + pairScore(memberId, gm), 0) /
          group.length;

        if (avgScore > bestAvgScore) {
          bestAvgScore = avgScore;
          bestGroupIdx = idx;
        }
      }

      if (bestGroupIdx !== -1 && viableGroups[bestGroupIdx].length < maxSize) {
        viableGroups[bestGroupIdx].push(memberId);
      } else {
        unmatched.push(memberId);
      }
    }
  }

  return { finalGroups: viableGroups, unmatched };
}

// ---------------------------------------------------------------------------
// Find the best shared time slot for a group
// ---------------------------------------------------------------------------

function bestGroupSlot(
  memberIds: string[],
  userMap: Map<string, MatchUser>
): string | null {
  const slotCounts = new Map<string, number>();

  for (const id of memberIds) {
    const user = userMap.get(id);
    if (!user) continue;
    for (const slot of user.avail_slots) {
      slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
    }
  }

  let bestSlot: string | null = null;
  let bestCount = 0;

  for (const [slot, count] of slotCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestSlot = slot;
    }
  }

  return bestSlot;
}

// ---------------------------------------------------------------------------
// Convert a slot key to an ISO datetime string
// ---------------------------------------------------------------------------

function slotToDatetime(slot: string, weekStart: string): string {
  // dayOfWeek: 0=Mon ... 6=Sun (matches day_of_week column)
  const timeMap: Record<string, string> = {
    morning: "09:00:00",
    afternoon: "14:00:00",
    evening: "19:00:00",
    night: "21:00:00",
  };

  const parts = slot.split("_");
  const dayOfWeek = parseInt(parts[0], 10);
  const period = parts[1] ?? "evening";
  const time = timeMap[period] ?? "19:00:00";

  const base = new Date(weekStart);
  base.setDate(base.getDate() + dayOfWeek);
  const dateStr = base.toISOString().split("T")[0];
  return `${dateStr}T${time}`;
}

// ---------------------------------------------------------------------------
// Build a group preference profile from a set of MatchUsers
// ---------------------------------------------------------------------------

function buildGroupProfile(members: MatchUser[]): GroupProfile {
  // Most common social_energy
  const energyCounts = new Map<string, number>();
  for (const m of members) {
    energyCounts.set(m.social_energy, (energyCounts.get(m.social_energy) ?? 0) + 1);
  }
  const social_energy = [...energyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "ambivert";

  // Combined interests (all, deduplicated)
  const interests = [...new Set(members.flatMap((m) => m.interests))];

  // Combined vibe_tags (all, deduplicated)
  const vibe_tags = [...new Set(members.flatMap((m) => m.group_vibe))];

  // Drinking preference: majority vote, prefer sober_friendly if any member is sober_friendly
  const hasSober = members.some((m) => m.drinking_pref === "sober_friendly");
  let drinking_pref: string;
  if (hasSober) {
    drinking_pref = "sober_friendly";
  } else {
    const drinkCounts = new Map<string, number>();
    for (const m of members) {
      drinkCounts.set(m.drinking_pref, (drinkCounts.get(m.drinking_pref) ?? 0) + 1);
    }
    drinking_pref =
      [...drinkCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "no_preference";
  }

  // Budget preference: median
  const budgetIndex: Record<string, number> = { budget: 0, mid_range: 1, upscale: 2 };
  const budgetValues = members
    .map((m) => budgetIndex[m.budget_pref] ?? 1)
    .sort((a, b) => a - b);
  const medianBudget = budgetValues[Math.floor(budgetValues.length / 2)] ?? 1;
  const indexToBudget: Record<number, string> = { 0: "budget", 1: "mid_range", 2: "upscale" };
  const budget_pref = indexToBudget[medianBudget] ?? "mid_range";

  // Combined activity preferences (all, deduplicated)
  const activity_pref = [...new Set(members.flatMap((m) => m.activity_pref))];

  return { social_energy, interests, vibe_tags, drinking_pref, budget_pref, activity_pref };
}

// ===========================================================================
// VENUE SELECTION — Full ranking model
// ===========================================================================

// ---------------------------------------------------------------------------
// Robust centroid: arithmetic mean with outlier trimming
//
// Problem: a simple mean centroid is pulled toward geographic outliers.
// If 5 members are in Manhattan and 1 is in New Jersey, the mean shifts
// toward New Jersey more than it should.
//
// Solution: trimmed mean — compute initial centroid, find each member's
// distance from it, exclude members beyond 1.8× the median distance, then
// recompute. This preserves the cluster without one outlier dominating.
// ---------------------------------------------------------------------------

function robustCentroid(
  members: MatchUser[]
): { lat: number; lng: number; trimmedCount: number } | null {
  const located = members.filter((m) => m.lat !== null && m.lng !== null);
  if (located.length === 0) return null;
  if (located.length === 1) {
    return { lat: located[0].lat!, lng: located[0].lng!, trimmedCount: 0 };
  }

  // Pass 1: simple mean
  const meanLat = located.reduce((s, m) => s + m.lat!, 0) / located.length;
  const meanLng = located.reduce((s, m) => s + m.lng!, 0) / located.length;

  // Compute each member's distance from the mean centroid
  const distances = located.map((m) =>
    haversineKm(meanLat, meanLng, m.lat!, m.lng!)
  );

  // Median distance
  const sorted = [...distances].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Trim threshold: 1.8× median. At least 2 members must remain.
  const threshold = Math.max(median * 1.8, 0.5); // 500m floor
  const inliers = located.filter(
    (_, i) => distances[i] <= threshold
  );

  const core = inliers.length >= 2 ? inliers : located;
  const trimmedCount = located.length - core.length;

  const lat = core.reduce((s, m) => s + m.lat!, 0) / core.length;
  const lng = core.reduce((s, m) => s + m.lng!, 0) / core.length;

  return { lat, lng, trimmedCount };
}

// ---------------------------------------------------------------------------
// Median of an array (used for travel radius aggregation)
// ---------------------------------------------------------------------------

function medianOf(values: number[]): number {
  if (values.length === 0) return 15; // default 15km
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

// ---------------------------------------------------------------------------
// Proximity score (0–100): how central is the venue for this group?
//
// Uses the robust centroid and the MEDIAN travel radius of all members
// (not minimum — a tight-radius outlier should not block everyone else).
// ---------------------------------------------------------------------------

function proximityScore(
  venue: EnrichedVenue,
  centroid: { lat: number; lng: number },
  medianRadiusKm: number
): number {
  if (venue.lat === null || venue.lng === null) return 40; // No coords → neutral

  const dist = haversineKm(centroid.lat, centroid.lng, venue.lat, venue.lng);

  if (dist <= medianRadiusKm * 0.35) return 100; // Deep core of group's area
  if (dist <= medianRadiusKm * 0.60) return 85;
  if (dist <= medianRadiusKm * 0.85) return 68;
  if (dist <= medianRadiusKm * 1.00) return 50;
  if (dist <= medianRadiusKm * 1.40) return 28;
  return 0; // Outside comfortable reach
}

// ---------------------------------------------------------------------------
// Quality score (0–100): Google rating × review credibility
//
// A 4.8 rating from 3 reviews is not credible.
// Credibility is gated on review_count thresholds.
// Unrated / manual venues receive a neutral mid-score (no penalty).
// ---------------------------------------------------------------------------

function qualityScore(venue: EnrichedVenue): number {
  const r = venue.rating;
  const n = venue.review_count ?? 0;

  if (r === null) {
    // Manual / unenriched venue — neutral, not penalised
    return venue.source === "manual" ? 40 : 30;
  }

  // Hard floor: below 4.0 is not a credible squad venue
  if (r < 4.0) return 0;

  // Credibility tiers based on review count
  if (n >= 200 && r >= 4.5) return 100;
  if (n >= 100 && r >= 4.3) return 88;
  if (n >= 50  && r >= 4.2) return 74;
  if (n >= 20  && r >= 4.0) return 55;
  if (n >= 5   && r >= 4.2) return 42; // Good rating but low review count
  if (n >= 5)               return 30;
  // Very few reviews: trust the rating less
  return Math.max(0, (r - 3.5) * 20);
}

// ---------------------------------------------------------------------------
// Suitability score (0–100): is this a good group hangout spot?
//
// Uses the pre-computed suitability_score from the DB if available.
// Falls back to a type-based heuristic.
//
// Definition of "good group hangout":
//   • Venue type naturally accommodates small social groups
//   • People can realistically talk (not too loud)
//   • Socially natural for a first meetup (not too committal)
//   • Works for 5–8 people (capacity + layout)
//   • Feels safe and public
//   • Fits the intended activity type
// ---------------------------------------------------------------------------

const SUITABILITY_TYPE_BASE: Record<string, number> = {
  arcade_bar:      92,  // Activity-driven, relieves first-meet awkwardness
  lounge:          84,  // Comfortable, conversational, group-oriented
  bar:             80,  // Classic first-meet venue
  brewery:         82,  // Social, relaxed, not too loud
  coffee_shop:     78,  // Conversational, public, low-commitment
  cafe:            75,  // Similar to coffee shop
  activity_center: 80,  // Inherently group-activity-focused
  rooftop:         72,  // Great ambiance; weather-dependent
  restaurant:      64,  // Meal is high commitment for a first meet
  park:            56,  // Public but unstructured
};

function suitabilityScore(venue: EnrichedVenue): number {
  // Use pre-computed score if available and looks reasonable
  if (
    venue.suitability_score !== null &&
    venue.suitability_score >= 0 &&
    venue.suitability_score <= 100
  ) {
    return venue.suitability_score;
  }

  // Heuristic fallback using venue_type
  const base = SUITABILITY_TYPE_BASE[venue.venue_type ?? ""] ?? 62;
  let score = base;

  const flags = new Set(venue.suitability_flags ?? []);
  if (flags.has("conversational"))     score += 5;
  if (flags.has("group_friendly"))     score += 5;
  if (flags.has("loud"))               score -= 12;
  if (flags.has("too_formal"))         score -= 15;
  if (flags.has("public"))             score += 4;
  if (flags.has("first_meet_natural")) score += 6;
  if (venue.is_outdoor)                score -= 3; // Weather dependency
  if (venue.capacity >= 20)            score += 4;

  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Preference score (0–100): drinking / budget / vibe / activity fit
// ---------------------------------------------------------------------------

function preferenceScore(
  venue: EnrichedVenue,
  profile: GroupProfile
): number {
  let score = 0;

  // ── Drinking (max 30, penalty -40 for hard mismatch) ────────────────────
  if (profile.drinking_pref === "drinking" && !venue.is_alcohol_free) {
    score += 30;
  } else if (profile.drinking_pref === "sober_friendly" && venue.is_alcohol_free) {
    score += 30;
  } else if (profile.drinking_pref === "sober_friendly" && !venue.is_alcohol_free) {
    score -= 40; // Sober group at a bar — strong mismatch
  } else {
    score += 15; // no_preference or neutral match
  }

  // ── Budget / price level (max 25, penalty -20 for budget→upscale) ───────
  const priceLevel = venue.price_level;
  const budgetTier = venue.budget_tier;

  if (profile.budget_pref === "budget") {
    if (budgetTier === "budget" || priceLevel === 1)                  score += 25;
    else if (budgetTier === "mid_range" || priceLevel === 2)          score += 12;
    else if (budgetTier === "upscale" || (priceLevel ?? 0) >= 3)      score -= 20;
  } else if (profile.budget_pref === "upscale") {
    if (budgetTier === "upscale" || (priceLevel ?? 0) >= 3)           score += 25;
    else if (budgetTier === "mid_range" || priceLevel === 2)          score += 15;
    else                                                               score += 5;
  } else {
    // mid_range preference
    if (budgetTier === "mid_range" || priceLevel === 2)               score += 25;
    else if (budgetTier === "budget" || priceLevel === 1)             score += 14;
    else                                                               score += 8;
  }

  // ── Vibe tag overlap (max 20 — 5 pts per matching tag) ──────────────────
  const groupVibeSet = new Set(profile.vibe_tags);
  for (const tag of venue.vibe_tags) {
    if (groupVibeSet.has(tag)) score += 5;
  }
  score = Math.min(score, score); // Let vibe contribute; no separate cap here

  // ── Activity type match (max 25) ─────────────────────────────────────────
  const activitySet = new Set(profile.activity_pref);
  const venueType = venue.venue_type ?? "";

  if (activitySet.has("outdoor") && venue.is_outdoor)                     score += 14;
  if (activitySet.has("food_drink") &&
    ["bar","arcade_bar","brewery","rooftop","lounge"].includes(venueType)) score += 14;
  if (activitySet.has("games") && venueType === "arcade_bar")             score += 22;
  if (activitySet.has("indoor") && !venue.is_outdoor)                     score += 8;

  return Math.max(-100, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Operational score (0–100): is the venue open?
// Returns -1000 for permanently closed (hard exclusion signal).
// ---------------------------------------------------------------------------

function operationalScore(venue: EnrichedVenue): number {
  switch (venue.operational_status) {
    case "operational":
      return venue.is_verified ? 100 : 65;
    case "unknown":
      // Manual venues with no status — don't penalise harshly
      return venue.source === "manual" ? 60 : 40;
    case "closed_temporarily":
      return 0;
    case "closed_permanently":
      return -1000; // Hard exclusion
    default:
      return 50;
  }
}

// ---------------------------------------------------------------------------
// Full weighted venue ranking
//
// Weights (must sum to 1.0):
//   proximity    0.22  — centrality for this specific group matters most
//   quality      0.25  — rating + review credibility is the trust signal
//   suitability  0.20  — group hangout appropriateness
//   preference   0.18  — drinking/budget/vibe/activity alignment
//   operational  0.15  — is it actually open?
// ---------------------------------------------------------------------------

const W = {
  proximity:   0.22,
  quality:     0.25,
  suitability: 0.20,
  preference:  0.18,
  operational: 0.15,
} as const;

function rankVenue(
  venue: EnrichedVenue,
  centroid: { lat: number; lng: number } | null,
  medianRadiusKm: number,
  profile: GroupProfile
): VenueScoreComponents {
  const proximity   = centroid ? proximityScore(venue, centroid, medianRadiusKm) : 50;
  const quality     = qualityScore(venue);
  const suitability = suitabilityScore(venue);
  const preference  = preferenceScore(venue, profile);
  const operational = operationalScore(venue);

  // Hard exclusion: permanently closed
  if (operational <= -500) {
    return { proximity, quality, suitability, preference, operational, total: -9999 };
  }

  const total =
    proximity   * W.proximity   +
    quality     * W.quality     +
    suitability * W.suitability +
    preference  * W.preference  +
    operational * W.operational;

  return { proximity, quality, suitability, preference, operational, total };
}

// ---------------------------------------------------------------------------
// Generate human-readable venue reason tokens
// ---------------------------------------------------------------------------

function generateReasons(
  venue: EnrichedVenue,
  components: VenueScoreComponents,
  profile: GroupProfile,
  qualityTier: number
): string[] {
  const reasons: string[] = [];

  if (components.proximity >= 80)  reasons.push("central_for_group");
  if (components.proximity >= 60 && components.proximity < 80) reasons.push("convenient_location");

  if (venue.rating !== null && venue.rating >= 4.5 && (venue.review_count ?? 0) >= 100) {
    reasons.push(`top_rated_${Math.round(venue.rating * 10) / 10}_stars`);
  } else if (venue.rating !== null && venue.rating >= 4.2) {
    reasons.push("highly_rated");
  }
  if ((venue.review_count ?? 0) >= 200) reasons.push("well_reviewed");

  if (components.preference >= 60) {
    if (profile.budget_pref === "budget" && venue.budget_tier === "budget") reasons.push("fits_budget");
    if (profile.drinking_pref === "sober_friendly" && venue.is_alcohol_free) reasons.push("alcohol_free_option");
    if (profile.drinking_pref === "drinking" && !venue.is_alcohol_free) reasons.push("great_for_drinks");
  }

  if (components.suitability >= 85) reasons.push("great_group_hangout_spot");
  else if (components.suitability >= 72) reasons.push("good_for_groups");

  const flags = new Set(venue.suitability_flags ?? []);
  if (flags.has("conversational"))     reasons.push("easy_to_talk");
  if (flags.has("activity_based"))     reasons.push("fun_activity_included");
  if (flags.has("first_meet_natural")) reasons.push("great_for_first_meetup");
  if (venue.is_outdoor)                reasons.push("outdoor_setting");

  if (qualityTier > 1) reasons.push("best_available_for_area");

  return [...new Set(reasons)].slice(0, 5); // Max 5 distinct reasons
}

// ---------------------------------------------------------------------------
// Quality-tier filtering with graceful fallback
//
// Tier 1: rating >= 4.2, review_count >= 50, operational
// Tier 2: rating >= 4.0, review_count >= 20, not permanently closed
// Tier 3: all non-permanently-closed venues (no rating gate)
//
// Each tier is tried in order. The first tier that produces at least 2
// candidates is used. This ensures we always have a primary + backup.
// ---------------------------------------------------------------------------

function filterByQualityTier(
  venues: EnrichedVenue[],
  tierLevel: 1 | 2 | 3
): EnrichedVenue[] {
  return venues.filter((v) => {
    // Always exclude permanently closed
    if (v.operational_status === "closed_permanently") return false;

    if (tierLevel === 1) {
      return (
        v.operational_status === "operational" &&
        v.rating !== null &&
        v.rating >= 4.2 &&
        (v.review_count ?? 0) >= 50
      );
    }
    if (tierLevel === 2) {
      return (
        v.rating === null ||
        (v.rating >= 4.0 && (v.review_count ?? 0) >= 20)
      );
    }
    // Tier 3: everything that isn't permanently closed
    return true;
  });
}

// ---------------------------------------------------------------------------
// Determine meetup area label from the group centroid
// ---------------------------------------------------------------------------

function deriveMeetupArea(
  centroid: { lat: number; lng: number } | null,
  members: MatchUser[],
  selectedVenue: EnrichedVenue
): string | null {
  // Prefer the venue's own neighborhood label if set
  if (selectedVenue.neighborhood) return selectedVenue.neighborhood;

  // Fall back to the most common neighborhood among members near centroid
  if (!centroid) return null;
  const nearby = members
    .filter(
      (m) =>
        m.neighborhood !== null &&
        m.lat !== null &&
        m.lng !== null &&
        haversineKm(centroid.lat, centroid.lng, m.lat!, m.lng!) <= 5
    )
    .map((m) => m.neighborhood!);

  if (nearby.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const n of nearby) counts[n] = (counts[n] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Main venue selection entry point (replaces old selectVenueForGroup)
// ---------------------------------------------------------------------------

function selectVenueForGroup(
  members: MatchUser[],
  venues: EnrichedVenue[],
  _weekStart: string
): VenueSelection {
  // ── 1. Robust centroid (trimmed mean) ────────────────────────────────────
  const centroidResult = robustCentroid(members);
  const centroid = centroidResult
    ? { lat: centroidResult.lat, lng: centroidResult.lng }
    : null;

  if (centroidResult?.trimmedCount) {
    console.log(
      `  Centroid: trimmed ${centroidResult.trimmedCount} outlier member(s) from centroid calculation`
    );
  }

  // ── 2. Effective travel radius: median across all located members ─────────
  //   Using median (not min) so one tight-radius member doesn't over-restrict.
  const located = members.filter((m) => m.lat !== null && m.lng !== null);
  const medianRadiusKm = medianOf(located.map((m) => m.travel_radius_km));

  // ── 3. Capacity filter ───────────────────────────────────────────────────
  let candidates = venues.filter((v) => v.capacity >= members.length);
  if (candidates.length === 0) candidates = venues; // Extreme fallback

  // ── 4. Proximity filter using robust centroid + expanded radius ──────────
  if (centroid !== null) {
    const inRadius = candidates.filter((v) => {
      if (v.lat === null || v.lng === null) return true; // No venue coords → include
      return haversineKm(centroid.lat, centroid.lng, v.lat, v.lng) <= medianRadiusKm * 1.5;
    });
    // Graceful fallback: if radius is too tight, expand 2×
    if (inRadius.length >= 2) {
      candidates = inRadius;
    } else {
      const expanded = candidates.filter((v) => {
        if (v.lat === null || v.lng === null) return true;
        return haversineKm(centroid.lat, centroid.lng, v.lat, v.lng) <= medianRadiusKm * 3;
      });
      if (expanded.length >= 2) candidates = expanded;
      // else: use all capacity-filtered venues (no geography constraint)
    }
  }

  // ── 5. Build group preference profile ────────────────────────────────────
  const profile = buildGroupProfile(members);

  // ── 6. Quality-tier filtering with graceful fallback ─────────────────────
  let tierCandidates: EnrichedVenue[] = [];
  let qualityTierUsed: 1 | 2 | 3 = 3;

  for (const tier of [1, 2, 3] as const) {
    const filtered = filterByQualityTier(candidates, tier);
    if (filtered.length >= 2) {
      tierCandidates = filtered;
      qualityTierUsed = tier;
      break;
    }
  }
  // Last resort: use all candidates even if only 1
  if (tierCandidates.length === 0) tierCandidates = candidates;

  if (qualityTierUsed > 1) {
    console.log(
      `  Venue quality: fell back to tier ${qualityTierUsed} ` +
        `(not enough 4.2+ venues with 50+ reviews in area)`
    );
  }

  // ── 7. Rank all candidates with the full model ───────────────────────────
  const ranked = tierCandidates
    .map((v) => ({
      venue: v,
      components: rankVenue(v, centroid, medianRadiusKm, profile),
    }))
    .filter((x) => x.components.total > -1000) // Drop hard-excluded
    .sort((a, b) => b.components.total - a.components.total);

  const primaryEntry = ranked[0];
  const backupEntry  = ranked[1] ?? null;

  if (!primaryEntry) {
    // Absolute last resort — first active venue in DB
    const fallback = venues.find((v) => v.operational_status !== "closed_permanently") ?? venues[0];
    return {
      primary: fallback,
      backup: null,
      reasons: ["only_venue_available"],
      meetupArea: fallback.neighborhood,
      qualityTierUsed,
    };
  }

  // ── 8. Generate reasons ──────────────────────────────────────────────────
  const reasons = generateReasons(
    primaryEntry.venue,
    primaryEntry.components,
    profile,
    qualityTierUsed
  );

  // ── 9. Derive meetup area label ──────────────────────────────────────────
  const meetupArea = deriveMeetupArea(centroid, members, primaryEntry.venue);

  console.log(
    `  Venue selected: "${primaryEntry.venue.name}" ` +
      `(score=${primaryEntry.components.total.toFixed(1)}, ` +
      `tier=${qualityTierUsed}, ` +
      `reasons=${reasons.join(",")})`
  );
  if (backupEntry) {
    console.log(
      `  Backup: "${backupEntry.venue.name}" (score=${backupEntry.components.total.toFixed(1)})`
    );
  }

  return {
    primary: primaryEntry.venue,
    backup: backupEntry?.venue ?? null,
    reasons,
    meetupArea,
    qualityTierUsed,
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

  const supabase = createServiceRoleClient();

  // Optional: filter by a specific cycle_id in the request body
  let requestedCycleId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    requestedCycleId = body?.cycle_id ?? undefined;
  } catch {
    // no body — that's fine
  }

  try {
    // ------------------------------------------------------------------
    // Step 1: Get current pending match cycle
    // ------------------------------------------------------------------
    const { data: cycle, error: cycleErr } = await supabase
      .from("match_cycles")
      .select("id, cycle_date, status")
      .eq("status", "pending")
      .order("cycle_date", { ascending: false })
      .limit(1)
      .single();

    if (cycleErr || !cycle) {
      console.error("No pending match cycle found:", cycleErr?.message);
      return errorResponse("No pending match cycle found", 404);
    }

    // Normalise: cycle_date is the week_start
    const matchCycle: MatchCycle = {
      id: cycle.id as string,
      week_start: cycle.cycle_date as string,
      status: cycle.status as string,
    };

    console.log(`Running matching for cycle ${matchCycle.id} (${matchCycle.week_start})`);

    // ------------------------------------------------------------------
    // Step 2: Get users from matching_pool view
    // ------------------------------------------------------------------
    let poolQuery = supabase
      .from("matching_pool")
      .select("*");

    if (requestedCycleId) {
      poolQuery = poolQuery.eq("cycle_id", requestedCycleId);
    } else {
      // Default: all waiting_for_match users (view already filters this,
      // but be explicit for readability)
      poolQuery = poolQuery.eq("cycle_id", matchCycle.id);
    }

    const { data: rawPool, error: poolErr } = await poolQuery;

    if (poolErr) {
      console.error("Failed to fetch matching pool:", poolErr.message);
      return errorResponse("Failed to fetch matching pool", 500);
    }

    const poolUsers = (rawPool ?? []) as PoolUser[];

    if (poolUsers.length < 2) {
      console.log(`Not enough eligible users: ${poolUsers.length}`);
      return jsonResponse({
        message: "Not enough users to match",
        cycle_id: matchCycle.id,
        eligible_users: poolUsers.length,
        groups_created: 0,
        unmatched: 0,
      });
    }

    console.log(`Eligible users in pool: ${poolUsers.length}`);

    // ------------------------------------------------------------------
    // Step 3: Get blocked pairs from `blocks` table (not 'blocked_pairs')
    // ------------------------------------------------------------------
    const { data: rawBlocked, error: blockedErr } = await supabase
      .from("blocks")
      .select("blocker_id, blocked_id");

    if (blockedErr) {
      console.error("Failed to fetch blocks:", blockedErr.message);
      return errorResponse("Failed to fetch blocks", 500);
    }

    const blockedPairs = new Set<string>(
      (rawBlocked ?? []).map(
        (row: { blocker_id: string; blocked_id: string }) =>
          [row.blocker_id, row.blocked_id].sort().join(":")
      )
    );

    // ------------------------------------------------------------------
    // Step 4: Get previous group memberships for history bonus
    // ------------------------------------------------------------------
    const { data: rawHistory, error: historyErr } = await supabase
      .from("group_members")
      .select("group_id, user_id");

    if (historyErr) {
      console.error("Failed to fetch group history:", historyErr.message);
      return errorResponse("Failed to fetch group history", 500);
    }

    const groupHistoryMap = new Map<string, string[]>();
    for (const row of rawHistory ?? []) {
      const r = row as { group_id: string; user_id: string };
      const existing = groupHistoryMap.get(r.group_id) ?? [];
      existing.push(r.user_id);
      groupHistoryMap.set(r.group_id, existing);
    }

    const previousPairs = new Set<string>();
    for (const members of groupHistoryMap.values()) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          previousPairs.add([members[i], members[j]].sort().join(":"));
        }
      }
    }

    // ------------------------------------------------------------------
    // Step 5: Fetch venues with all metadata columns
    // ------------------------------------------------------------------
    const { data: rawVenues, error: venuesErr } = await supabase
      .from("venues")
      .select([
        "id", "name", "address", "neighborhood", "capacity",
        "lat", "lng",
        "venue_type", "vibe_tags", "budget_tier", "is_outdoor", "is_alcohol_free",
        // Quality fields added by migration 000012
        "rating", "review_count", "price_level",
        "operational_status", "is_verified", "source",
        "suitability_score", "suitability_flags",
      ].join(", "))
      .eq("active", true)
      .neq("operational_status", "closed_permanently");

    if (venuesErr) {
      console.error("Failed to fetch venues:", venuesErr.message);
      return errorResponse("Failed to fetch venues", 500);
    }

    const venues: EnrichedVenue[] = (rawVenues ?? []).map((v: Record<string, unknown>) => ({
      id: v.id as string,
      name: v.name as string,
      address: v.address as string,
      neighborhood: (v.neighborhood as string | null) ?? null,
      capacity: (v.capacity as number) ?? 20,
      lat: v.lat != null ? Number(v.lat) : null,
      lng: v.lng != null ? Number(v.lng) : null,
      venue_type: (v.venue_type as string | null) ?? null,
      vibe_tags: (v.vibe_tags as string[]) ?? [],
      budget_tier: (v.budget_tier as string) ?? "mid_range",
      is_outdoor: (v.is_outdoor as boolean) ?? false,
      is_alcohol_free: (v.is_alcohol_free as boolean) ?? false,
      // Quality fields
      rating: v.rating != null ? Number(v.rating) : null,
      review_count: v.review_count != null ? Number(v.review_count) : null,
      price_level: v.price_level != null ? Number(v.price_level) : null,
      operational_status: (v.operational_status as string) ?? "unknown",
      is_verified: (v.is_verified as boolean) ?? false,
      source: (v.source as string) ?? "manual",
      suitability_score: v.suitability_score != null ? Number(v.suitability_score) : null,
      suitability_flags: (v.suitability_flags as string[]) ?? [],
    }));

    console.log(`Active venues available: ${venues.length}`);

    if (venues.length === 0) {
      console.error("No active venues found");
      return errorResponse("No active venues available", 500);
    }

    // ------------------------------------------------------------------
    // Step 6: Convert pool users to MatchUser objects
    // ------------------------------------------------------------------
    const matchUsers: MatchUser[] = poolUsers.map(toMatchUser);
    const userMap = new Map<string, MatchUser>(matchUsers.map((u) => [u.id, u]));

    // ------------------------------------------------------------------
    // Step 7: Build scored pairs
    // ------------------------------------------------------------------
    const scoredPairs = buildScoredPairs(matchUsers, blockedPairs, previousPairs);

    // ------------------------------------------------------------------
    // Step 8: Greedy grouping capped at TARGET_GROUP_SIZE
    // ------------------------------------------------------------------
    const rawGroups = greedyGroup(matchUsers, scoredPairs, TARGET_GROUP_SIZE);
    console.log(`Greedy pass produced ${rawGroups.length} initial group(s)`);

    // ------------------------------------------------------------------
    // Step 9: Redistribute small groups (< MIN_GROUP_SIZE)
    // ------------------------------------------------------------------
    const { finalGroups, unmatched } = redistribute(
      rawGroups,
      matchUsers,
      scoredPairs,
      MAX_GROUP_SIZE
    );

    // Log summary
    const sizeDist: Record<number, number> = {};
    for (const g of finalGroups) {
      sizeDist[g.length] = (sizeDist[g.length] ?? 0) + 1;
    }
    console.log(`After redistribution: ${finalGroups.length} group(s)`);
    console.log(`Size distribution: ${JSON.stringify(sizeDist)}`);
    console.log(`Unmatched users: ${unmatched.length}`);

    // ------------------------------------------------------------------
    // Step 10: Insert groups and group_members
    // ------------------------------------------------------------------
    const createdGroups: Array<{
      groupId: string;
      memberIds: string[];
      venueName: string;
      scheduledTime: string;
    }> = [];

    for (const memberIds of finalGroups) {
      const members = memberIds
        .map((id) => userMap.get(id))
        .filter((u): u is MatchUser => u !== undefined);

      if (members.length === 0) continue;

      // Select venue using the full ranking model
      const {
        primary: venue,
        backup: backupVenue,
        reasons: venueReasons,
        meetupArea,
      } = selectVenueForGroup(members, venues, matchCycle.week_start);

      // Find best time slot
      const bestSlot = bestGroupSlot(memberIds, userMap);
      const scheduledTime = bestSlot
        ? slotToDatetime(bestSlot, matchCycle.week_start)
        : slotToDatetime(`4_evening`, matchCycle.week_start); // default Friday evening

      // Insert group row
      const groupName = `Squad ${new Date(matchCycle.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })} #${createdGroups.length + 1}`;

      const { data: groupRow, error: groupErr } = await supabase
        .from("groups")
        .insert({
          cycle_id: matchCycle.id,
          venue_id: venue.id,
          backup_venue_id: backupVenue?.id ?? null,
          venue_selection_reason: venueReasons,
          meetup_area: meetupArea ?? null,
          name: groupName,
          scheduled_time: scheduledTime,
          status: "forming",
        })
        .select("id")
        .single();

      if (groupErr || !groupRow) {
        console.error("Failed to insert group:", groupErr?.message);
        continue;
      }

      const groupId: string = (groupRow as { id: string }).id;

      // Insert group_members rows
      const memberRows = memberIds.map((userId) => ({
        group_id: groupId,
        user_id: userId,
        status: "invited",
        rsvp_status: "pending",
        cycle_id: matchCycle.id,
      }));

      const { error: membersErr } = await supabase
        .from("group_members")
        .insert(memberRows);

      if (membersErr) {
        console.error(
          `Failed to insert members for group ${groupId}:`,
          membersErr.message
        );
      }

      // Update each matched user's matching_status to 'matched'
      const { error: statusErr } = await supabase
        .from("profiles")
        .update({ matching_status: "matched" })
        .in("id", memberIds);

      if (statusErr) {
        console.error(`Failed to update matching_status for group ${groupId}:`, statusErr.message);
      }

      createdGroups.push({
        groupId,
        memberIds,
        venueName: venue.name,
        scheduledTime,
      });

      console.log(
        `Group ${groupId} (${groupName}): ${memberIds.length} members at ${venue.name}` +
          (backupVenue ? ` (backup: ${backupVenue.name})` : "") +
          ` on ${scheduledTime}`
      );
    }

    // ------------------------------------------------------------------
    // Step 11: Update cycle status to 'active'
    // ------------------------------------------------------------------
    const { error: cycleUpdateErr } = await supabase
      .from("match_cycles")
      .update({ status: "active", matched_at: new Date().toISOString() })
      .eq("id", matchCycle.id);

    if (cycleUpdateErr) {
      console.error("Failed to update cycle status:", cycleUpdateErr.message);
      // Non-fatal — groups are created; status update can be retried
    }

    // ------------------------------------------------------------------
    // Step 12: Return stats
    // ------------------------------------------------------------------
    const totalMatched = createdGroups.reduce((s, g) => s + g.memberIds.length, 0);
    const finalSizeDist: Record<number, number> = {};
    for (const g of createdGroups) {
      finalSizeDist[g.memberIds.length] = (finalSizeDist[g.memberIds.length] ?? 0) + 1;
    }

    return jsonResponse({
      success: true,
      cycle_id: matchCycle.id,
      week_start: matchCycle.week_start,
      eligible_users: poolUsers.length,
      groups_created: createdGroups.length,
      total_users_matched: totalMatched,
      unmatched_count: unmatched.length,
      unmatched_user_ids: unmatched,
      size_distribution: finalSizeDist,
      groups: createdGroups.map((g) => ({
        group_id: g.groupId,
        member_count: g.memberIds.length,
        venue: g.venueName,
        scheduled_time: g.scheduledTime,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Unexpected error in run-matching:", message);
    return errorResponse(`Internal server error: ${message}`, 500);
  }
});
