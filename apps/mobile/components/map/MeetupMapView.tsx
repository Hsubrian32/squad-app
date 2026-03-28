import React, { useRef, useEffect, Component } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MeetupLocation, UserLocation, LatLng } from '../../constants/mapTypes';
import { fitRegion, CHECK_IN_RADIUS_METERS } from '../../lib/utils/location';

// ---------------------------------------------------------------------------
// Dark map style for Google Maps
// ---------------------------------------------------------------------------
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0c0c1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0c0c1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#13132b' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'poi.park', elementType: 'labels.text.stroke', stylers: [{ color: '#1b1b1b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c1c2e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c2c42' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#06060f' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  meetupLocation: MeetupLocation;
  userLocation: UserLocation | null;
  pinnedLocation: LatLng | null;
  isPinDropMode: boolean;
  onMapPress?: (coord: LatLng) => void;
  onMapReady?: () => void;
}

// ---------------------------------------------------------------------------
// Static fallback — shown when the native map module is unavailable
// (e.g. running in Expo Go without a dev build)
// ---------------------------------------------------------------------------
function StaticVenueCard({ meetupLocation }: { meetupLocation: MeetupLocation }) {
  function openInMaps() {
    const { lat, lng, name } = meetupLocation;
    const query = encodeURIComponent(name);
    const url = Platform.OS === 'ios'
      ? `maps://?ll=${lat},${lng}&q=${query}`
      : `geo:${lat},${lng}?q=${query}`;
    Linking.openURL(url).catch(() => {
      // Fall back to Google Maps web
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
    });
  }

  return (
    <View style={fb.container}>
      {/* Map placeholder */}
      <View style={fb.mapPlaceholder}>
        <View style={fb.pin}>
          <Ionicons name="location" size={32} color="#7B6CF6" />
        </View>
        <Text style={fb.placeholderLabel}>Map requires a dev build</Text>
        <Text style={fb.placeholderSub}>
          Run{' '}
          <Text style={fb.code}>npx expo run:ios</Text>
          {' '}or{' '}
          <Text style={fb.code}>npx expo run:android</Text>
          {' '}to see the live map.
        </Text>
      </View>

      {/* Venue info card */}
      <View style={fb.card}>
        <View style={fb.cardIcon}>
          <Ionicons name="location" size={20} color="#7B6CF6" />
        </View>
        <View style={fb.cardBody}>
          <Text style={fb.venueName}>{meetupLocation.name}</Text>
          {meetupLocation.address && (
            <Text style={fb.venueAddress}>{meetupLocation.address}</Text>
          )}
          <Text style={fb.coords}>
            {meetupLocation.lat.toFixed(5)}, {meetupLocation.lng.toFixed(5)}
          </Text>
        </View>
        <TouchableOpacity style={fb.mapsBtn} onPress={openInMaps} activeOpacity={0.8}>
          <Ionicons name="navigate-outline" size={16} color="#7B6CF6" />
          <Text style={fb.mapsBtnText}>Open</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Error boundary — catches the native module crash from react-native-maps
// when running in Expo Go and renders the static fallback instead.
// ---------------------------------------------------------------------------
interface BoundaryState { hasError: boolean }

class MapErrorBoundary extends Component<
  Props & { children: React.ReactNode },
  BoundaryState
> {
  constructor(props: Props & { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Swallow all native map module errors — the static venue card fallback
    // is shown instead, which is a better beta experience than a crash.
    // Log so it's visible in the Expo console during development.
    console.warn('[MeetupMapView] Native map unavailable, showing static fallback.', error.message);
  }

  render() {
    if (this.state.hasError) {
      return <StaticVenueCard meetupLocation={this.props.meetupLocation} />;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Native map inner component — only rendered inside the error boundary
// ---------------------------------------------------------------------------
function NativeMapView(props: Props) {
  // Lazy-require so the import error is caught by the boundary at render time,
  // not at module load time (which would crash before the boundary is mounted).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { default: MapView, Marker, Circle, PROVIDER_GOOGLE } = require('react-native-maps');

  const mapRef = useRef<InstanceType<typeof MapView>>(null);

  useEffect(() => {
    if (!props.userLocation) return;
    const venue: LatLng = { lat: props.meetupLocation.lat, lng: props.meetupLocation.lng };
    const user: LatLng = { lat: props.userLocation.lat, lng: props.userLocation.lng };
    const region = fitRegion(venue, user);
    mapRef.current?.animateToRegion(region, 600);
  }, [props.userLocation, props.meetupLocation]);

  useEffect(() => {
    if (!props.pinnedLocation) return;
    mapRef.current?.animateToRegion(
      {
        latitude: props.pinnedLocation.lat,
        longitude: props.pinnedLocation.lng,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      400,
    );
  }, [props.pinnedLocation]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_GOOGLE}
      customMapStyle={DARK_MAP_STYLE}
      initialRegion={{
        latitude: props.meetupLocation.lat,
        longitude: props.meetupLocation.lng,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      onPress={(e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
        if (props.isPinDropMode && props.onMapPress) {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          props.onMapPress({ lat: latitude, lng: longitude });
        }
      }}
      onMapReady={props.onMapReady}
    >
      {/* Venue marker */}
      <Marker
        coordinate={{ latitude: props.meetupLocation.lat, longitude: props.meetupLocation.lng }}
        title={props.meetupLocation.name}
        description={props.meetupLocation.address ?? undefined}
        pinColor="#7B6CF6"
      />

      {/* Check-in proximity circle (200m) */}
      <Circle
        center={{ latitude: props.meetupLocation.lat, longitude: props.meetupLocation.lng }}
        radius={CHECK_IN_RADIUS_METERS}
        strokeColor="rgba(123,108,246,0.5)"
        fillColor="rgba(123,108,246,0.08)"
        strokeWidth={1.5}
      />

      {/* User location dot */}
      {props.userLocation && (
        <>
          <Marker
            coordinate={{ latitude: props.userLocation.lat, longitude: props.userLocation.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userDotOuter}>
              <View style={styles.userDotInner} />
            </View>
          </Marker>
          {props.userLocation.accuracy != null && props.userLocation.accuracy < 200 && (
            <Circle
              center={{ latitude: props.userLocation.lat, longitude: props.userLocation.lng }}
              radius={props.userLocation.accuracy}
              strokeColor="rgba(96,165,250,0.3)"
              fillColor="rgba(96,165,250,0.06)"
              strokeWidth={1}
            />
          )}
        </>
      )}

      {/* Dropped pin */}
      {props.pinnedLocation && (
        <Marker
          coordinate={{ latitude: props.pinnedLocation.lat, longitude: props.pinnedLocation.lng }}
          pinColor="#F472B6"
          title="Proposed location"
        />
      )}
    </MapView>
  );
}

// ---------------------------------------------------------------------------
// Public export — wraps native map in an error boundary.
// In Expo Go: renders StaticVenueCard.
// In a dev/production build: renders the full Google Maps view.
// ---------------------------------------------------------------------------
export function MeetupMapView(props: Props) {
  return (
    <MapErrorBoundary {...props}>
      <NativeMapView {...props} />
    </MapErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  userDotOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(96,165,250,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(96,165,250,0.5)',
  },
  userDotInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#60A5FA',
  },
});

// Fallback styles
const fb = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C1A',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  pin: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(123,108,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123,108,246,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  placeholderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  placeholderSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#7B6CF6',
    fontSize: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16162A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 260, // leave room for the bottom sheet
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(123,108,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123,108,246,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  venueName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F3F4F6',
  },
  venueAddress: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  coords: {
    fontSize: 11,
    color: '#4B5563',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(123,108,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123,108,246,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
  },
  mapsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7B6CF6',
  },
});
