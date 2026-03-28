/**
 * useNetworkState — lightweight offline detection.
 *
 * Uses React Native's built-in NetInfo (via @react-native-community/netinfo,
 * which is already bundled with Expo). Returns whether the device currently
 * has an internet connection and whether the state is still loading.
 *
 * Usage:
 *   const { isOnline, isChecking } = useNetworkState();
 *   if (!isOnline) return <OfflineBanner />;
 */

import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkState {
  /** true = connected to the internet (may still have poor quality) */
  isOnline: boolean;
  /** true while the initial check is running */
  isChecking: boolean;
}

export function useNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isOnline: true, // Optimistic default — avoids flashing offline UI on mount
    isChecking: true,
  });

  useEffect(() => {
    // One-time fetch to set initial state
    NetInfo.fetch().then((netState: NetInfoState) => {
      setState({
        isOnline: netState.isConnected === true && netState.isInternetReachable !== false,
        isChecking: false,
      });
    });

    // Subscribe to future changes
    const unsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
      setState({
        isOnline: netState.isConnected === true && netState.isInternetReachable !== false,
        isChecking: false,
      });
    });

    return unsubscribe;
  }, []);

  return state;
}
