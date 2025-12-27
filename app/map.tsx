// © 2025 Benjamin Hawk. All rights reserved.

import { Platform } from 'react-native';
import MapWeb from '../components/MapWeb';
import MapNative from '../components/MapNative';

const MapScreen = Platform.select({
  web: MapWeb,
  default: MapNative,
});

export default MapScreen;
