import { View, Text, StyleSheet } from 'react-native';

type SubscriptionBadgeProps = {
  tier: string | null;
  status?: string | null;
  size?: 'small' | 'medium' | 'large';
};

export function SubscriptionBadge({ tier, status, size = 'medium' }: SubscriptionBadgeProps) {
  if (!tier || tier === 'free' || status !== 'active') {
    return null;
  }

  const isPlus = tier === 'plus';
  const isPro = tier === 'pro';

  if (!isPlus && !isPro) {
    return null;
  }

  const sizeStyles = {
    small: styles.badgeSmall,
    medium: styles.badgeMedium,
    large: styles.badgeLarge,
  };

  const textSizeStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge,
  };

  return (
    <View
      style={[
        styles.badge,
        sizeStyles[size],
        isPro ? styles.badgePro : styles.badgePlus,
      ]}
    >
      <Text style={[styles.badgeText, textSizeStyles[size], isPro && styles.proText]}>
        {isPro ? '👑 PRO' : '✨ PLUS'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeMedium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeLarge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  badgePlus: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: '#FFD700',
  },
  badgePro: {
    backgroundColor: 'rgba(138, 43, 226, 0.15)',
    borderColor: '#8A2BE2',
  },
  badgeText: {
    fontWeight: '700',
  },
  textSmall: {
    fontSize: 10,
    color: '#FFD700',
  },
  textMedium: {
    fontSize: 11,
    color: '#FFD700',
  },
  textLarge: {
    fontSize: 12,
    color: '#FFD700',
  },
  proText: {
    color: '#8A2BE2',
  },
});
