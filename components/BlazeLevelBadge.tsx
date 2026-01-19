import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';

interface BlazeLevelBadgeProps {
  level: number;
  activityPoints?: number;
  showProgress?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function getLevelColor(level: number): string {
  if (level >= 10) return '#FF4500';
  if (level >= 7) return '#FF6B35';
  if (level >= 5) return '#FF8C42';
  if (level >= 3) return '#FFA500';
  return '#FFB84D';
}

export function getLevelTitle(level: number): string {
  if (level >= 10) return 'Blaze Legend 👑';
  if (level >= 7) return 'Sesh Master';
  if (level >= 4) return 'Daily Toker';
  return 'Rookie';
}

export function BlazeLevelBadge({
  level,
  activityPoints,
  showProgress = false,
  size = 'medium',
}: BlazeLevelBadgeProps) {
  const getNextLevelPoints = (currentLevel: number): number => {
    return Math.pow(currentLevel, 2) * 50;
  };

  const getCurrentLevelPoints = (currentLevel: number): number => {
    if (currentLevel <= 1) return 0;
    return Math.pow(currentLevel - 1, 2) * 50;
  };

  const calculateProgress = (): number => {
    if (!activityPoints || !showProgress) return 0;
    const currentLevelMin = getCurrentLevelPoints(level);
    const nextLevelMin = getNextLevelPoints(level);
    const pointsIntoLevel = activityPoints - currentLevelMin;
    const pointsNeeded = nextLevelMin - currentLevelMin;
    return Math.min((pointsIntoLevel / pointsNeeded) * 100, 100);
  };

  const levelColor = getLevelColor(level);
  const levelTitle = getLevelTitle(level);
  const progress = calculateProgress();

  const sizeStyles = {
    small: { iconSize: 14, fontSize: 12, padding: 6, borderRadius: 12 },
    medium: { iconSize: 18, fontSize: 14, padding: 8, borderRadius: 16 },
    large: { iconSize: 24, fontSize: 18, padding: 10, borderRadius: 20 },
  };

  const currentSize = sizeStyles[size];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: `${levelColor}20`,
            borderColor: levelColor,
            padding: currentSize.padding,
            borderRadius: currentSize.borderRadius,
          },
        ]}
      >
        <Flame size={currentSize.iconSize} color={levelColor} />
        <Text
          style={[
            styles.levelText,
            { color: levelColor, fontSize: currentSize.fontSize },
          ]}
        >
          {level}
        </Text>
      </View>
      {showProgress && activityPoints !== undefined && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: levelColor },
              ]}
            />
          </View>
          <Text style={styles.levelTitle}>{levelTitle}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
  },
  levelText: {
    fontWeight: '700',
  },
  progressContainer: {
    width: 100,
    marginTop: 8,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  levelTitle: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    fontWeight: '600',
  },
});
