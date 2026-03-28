// ---------------------------------------------------------------------------
// Map / location types for the meetup map system
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** The confirmed meetup location for a group */
export interface MeetupLocation {
  id: string;
  group_id: string;
  venue_id: string | null;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  set_by: string;
  is_switch: boolean;
  created_at: string;
  updated_at: string;
}

/** A proposal to move the group to a different location */
export interface VenueSwitchProposal {
  id: string;
  group_id: string;
  proposed_by: string;
  venue_id: string | null;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  reason: string | null;
  status: 'open' | 'accepted' | 'rejected' | 'expired';
  expires_at: string;
  votes_yes: number;
  votes_no: number;
  created_at: string;
  updated_at: string;
}

/** A single vote cast on a proposal */
export interface VenueSwitchVote {
  id: string;
  proposal_id: string;
  user_id: string;
  vote: boolean;
  created_at: string;
}

/** Privacy-safe aggregate of where the group is at */
export interface GroupArrivalStats {
  group_id: string;
  arrived_count: number;
  on_the_way_count: number;
  running_late_count: number;
  cant_make_it_count: number;
  total_count: number;
}

/** Result of a proximity check */
export interface ProximityResult {
  distanceMeters: number;
  withinRadius: boolean;
  bearing: number;       // degrees 0–360
  walkMinutes: number;
}

/** A nearby venue suggestion (from DB or places API) */
export interface NearbyVenue {
  id: string | null;      // null for Places API results not in DB
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string | null;
  distanceMeters: number;
}

/** State of location permission */
export type LocationPermissionStatus =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'unavailable';

/** Current user location */
export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number;
}

/** Check-in eligibility result */
export interface CheckInEligibility {
  eligible: boolean;
  distanceMeters: number;
  reason: 'within_radius' | 'too_far' | 'no_location' | 'already_checked_in';
}
