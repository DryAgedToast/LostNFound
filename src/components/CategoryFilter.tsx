import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, useColorScheme } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import type { ItemCategory } from '@/types';

interface CategoryFilterProps {
  selected: ItemCategory | 'all';
  onSelect: (cat: ItemCategory | 'all') => void;
}

const CATEGORIES: ItemCategory[] = [
  'electronics',
  'clothing',
  'keys',
  'wallet',
  'id_card',
  'bag',
  'other',
];

const CATEGORY_LABELS: Record<ItemCategory | 'all', string> = {
  all: 'All',
  electronics: 'Electronics',
  clothing: 'Clothing',
  keys: 'Keys',
  wallet: 'Wallet',
  id_card: 'ID Card',
  bag: 'Bag',
  other: 'Other',
};

export default function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const allOptions: (ItemCategory | 'all')[] = ['all', ...CATEGORIES];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {allOptions.map((cat) => {
        const isActive = selected === cat;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onSelect(cat)}
            style={[
              styles.button,
              {
                backgroundColor: isActive ? '#208AEF' : colors.backgroundElement,
              },
            ]}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? '#ffffff' : colors.textSecondary,
                },
              ]}
            >
              {CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
