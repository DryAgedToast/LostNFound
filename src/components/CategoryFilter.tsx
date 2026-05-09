import React from "react";
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Platform,
} from "react-native";
import { Spacing } from "@/constants/theme";
import type { ItemCategory } from "@/types";

interface CategoryFilterProps {
  selected: ItemCategory | "all";
  onSelect: (cat: ItemCategory | "all") => void;
}

const BRAND = {
  navy: "#002855",
  blue: "#005BBB",
  blueLight: "#EAF2FF",
  gold: "#FFD200",
  surface: "#FFFFFF",
  border: "#DDE5F0",
  text: "#10233F",
  textMuted: "#66758A",
};

const CATEGORIES: ItemCategory[] = [
  "electronics",
  "clothing",
  "keys",
  "wallet",
  "id_card",
  "bag",
  "other",
];

const CATEGORY_LABELS: Record<ItemCategory | "all", string> = {
  all: "All",
  electronics: "Electronics",
  clothing: "Clothing",
  keys: "Keys",
  wallet: "Wallet",
  id_card: "ID Card",
  bag: "Bag",
  other: "Other",
};

const CATEGORY_ICONS: Record<ItemCategory | "all", string> = {
  all: "",
  electronics: "▣",
  clothing: "◒",
  keys: "⚿",
  wallet: "▤",
  id_card: "▭",
  bag: "▢",
  other: "•••",
};

export default function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  const allOptions: (ItemCategory | "all")[] = ["all", ...CATEGORIES];

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
            style={[styles.button, isActive && styles.buttonActive]}
            activeOpacity={0.78}
          >
            {CATEGORY_ICONS[cat] ? (
              <Text style={[styles.icon, isActive && styles.iconActive]}>
                {CATEGORY_ICONS[cat]}
              </Text>
            ) : null}

            <Text style={[styles.label, isActive && styles.labelActive]}>
              {CATEGORY_LABELS[cat]}
            </Text>

            {isActive ? <View style={styles.activeDot} /> : null}
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
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: BRAND.surface,
    borderWidth: 1,
    borderColor: BRAND.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
    ...Platform.select({
      web: {
        cursor: "pointer" as any,
        transition:
          "background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease" as any,
      },
    }),
  },
  buttonActive: {
    backgroundColor: BRAND.blue,
    borderColor: BRAND.blue,
  },
  icon: {
    fontSize: 14,
    color: BRAND.blue,
    fontWeight: "800",
  },
  iconActive: {
    color: "#FFFFFF",
  },
  label: {
    fontSize: 13,
    fontWeight: "750",
    color: BRAND.text,
  },
  labelActive: {
    color: "#FFFFFF",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND.gold,
  },
});