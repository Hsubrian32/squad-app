import { useState, useEffect, useRef, useCallback } from 'react';
import * as ExpoLocation from 'expo-location';
import type { UserLocation, LocationPermissionStatus } from '../constants/mapTypes';

interface UseLocationReturn {
  location: UserLocation | null;
  permissionStatus: LocationPermissionStatus;
  requestPermission: () => Promise<boolean>;
  isTracking: boolean;
  error: string | null;
}

export function useLocation(autoRequest = false): UseLocationReturn {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('undetermined');
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<ExpoLocation.LocationSubscription | null>(null);

  // Check current permission status on mount
  useEffect(() => {
    (async () => {
      const { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionStatus('granted');
        startTracking();
      } else if (status === 'denied') {
        setPermissionStatus('denied');
      }
    })();

    return () => {
      watchRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-request if asked
  useEffect(() => {
    if (autoRequest && permissionStatus === 'undetermined') {
      requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRequest, permissionStatus]);

  const startTracking = useCallback(async () => {
    if (isTracking) return;
    setIsTracking(true);
    setError(null);

    try {
      // Get last known position immediately for instant feedback
      const last = await ExpoLocation.getLastKnownPositionAsync();
      if (last) {
        setLocation({
          lat: last.coords.latitude,
          lng: last.coords.longitude,
          accuracy: last.coords.accuracy,
          timestamp: last.timestamp,
        });
      }

      // Then start watching
      watchRef.current = await ExpoLocation.watchPositionAsync(
        {
          accuracy: ExpoLocation.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pos: any) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          });
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to track location');
      setIsTracking(false);
    }
  }, [isTracking]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermissionStatus('granted');
      await startTracking();
      return true;
    } else {
      setPermissionStatus('denied');
      return false;
    }
  }, [startTracking]);

  return {
    location,
    permissionStatus,
    requestPermission,
    isTracking,
    error,
  };
}
