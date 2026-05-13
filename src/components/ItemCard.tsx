import { Colors, Spacing } from "@/constants/theme";
import type { ItemCategory, ItemStatus, ItemWithPoster } from "@/types";
import { Image } from "expo-image";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface ItemCardProps {
  item: ItemWithPoster;
  onPress: () => void;
  /** Tighter horizontal margins for percentage-width feed cells */
  compactGrid?: boolean;
}

const STATUS_COLORS: Record<ItemStatus, string> = {
  unclaimed: "#1877F2",
  at_hotspot: "#1877F2",
  claimed: "#42B72A",
  pending: "#65676B",
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  unclaimed: "Unclaimed",
  at_hotspot: "At Hotspot",
  claimed: "Claimed",
  pending: "Pending Pickup",
};

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  electronics: "Electronics",
  clothing: "Clothing",
  keys: "Keys",
  wallet: "Wallet",
  id_card: "ID Card",
  bag: "Bag",
  other: "Other",
};

function getRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return "Just now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

export default function ItemCard({
  item,
  onPress,
  compactGrid = false,
}: ItemCardProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const statusColor = STATUS_COLORS[item.status];
  const locationText =
    item.status === "claimed" || item.status === "pending"
      ? item.hotspots?.name ?? "Claimed from poster"
      : item.location_found;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        compactGrid && styles.cardCompactGrid,
        {
          backgroundColor: colors.backgroundElement,
          shadowColor: colorScheme === "dark" ? "#000" : "#000",
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Image / Placeholder */}
      <View style={styles.imageContainer}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text
              style={[styles.placeholderText, { color: colors.textSecondary }]}
            >
              No Photo
            </Text>
          </View>
        )}
        {/* Status badge overlaid on image */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
        </View>
      </View>

      {/* Card body */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>

        {/* Category tag */}
        <View
          style={[
            styles.categoryTag,
            { backgroundColor: colors.backgroundSelected },
          ]}
        >
          <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
            {CATEGORY_LABELS[item.category]}
          </Text>
        </View>

        {/* Location */}
        <Text
          style={[styles.location, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {locationText}
        </Text>

        {/* Footer: poster + time */}
        <View style={styles.footer}>
          <Text
            style={[styles.poster, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.profiles?.display_name ?? "Unknown"}
          </Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>
            {getRelativeTime(item.created_at)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 0,
    overflow: "hidden",
    margin: Spacing.one,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardCompactGrid: {
    marginHorizontal: 0,
    marginVertical: Spacing.one,
  },
  /** Shorter than square so more room for title/meta in compact 3-column grid */
  imageContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    position: "relative",
    backgroundColor: "#E4E6EB",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E4E6EB",
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: "500",
  },
  statusBadge: {
    position: "absolute",
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 0,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  body: {
    padding: Spacing.two,
    gap: Spacing.one,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  categoryTag: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 0,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "600",
  },
  location: {
    fontSize: 11,
    lineHeight: 15,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.half,
  },
  poster: {
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
    marginRight: Spacing.one,
  },
  time: {
    fontSize: 10,
  },
});
