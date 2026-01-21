import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

type VideoViewProps = {
  stream: MediaStream | null;
  mirror?: boolean;
  style?: any;
};

export function VideoView({ stream, mirror = false, style }: VideoViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (Platform.OS !== 'web') {
    return <View style={[styles.placeholder, style]} />;
  }

  return (
    <video
      ref={videoRef as any}
      autoPlay
      playsInline
      muted={mirror}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: 12,
        transform: mirror ? 'scaleX(-1)' : 'none',
        ...style,
      }}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
});
