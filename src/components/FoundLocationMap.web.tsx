import LeafletMapView from "@/components/LeafletMapView";
import { openInMapsAt } from "@/lib/maps";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  latitude: number;
  longitude: number;
  height?: number;
  linkColor?: string;
};

/** Web: Leaflet + OSM — never import react-native-maps (breaks RN Web). */
export default function FoundLocationMap({
  latitude,
  longitude,
  height = 220,
  linkColor = "#1877F2",
}: Props) {
  return (
    <View style={[styles.wrap, { height }]}>
      <LeafletMapView
        latitude={latitude}
        longitude={longitude}
        height={height}
        interactive={false}
      />
      <Pressable
        style={({ pressed }) => [
          styles.mapsLink,
          { opacity: pressed ? 0.75 : 1 },
        ]}
        onPress={() => {
          void openInMapsAt(latitude, longitude);
        }}
      >
        <Text style={[styles.mapsLinkText, { color: linkColor }]}>
          Open in Google Maps
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "#E4E6EB",
    position: "relative",
  },
  mapsLink: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mapsLinkText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
