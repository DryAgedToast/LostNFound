import { openInMapsAt } from "@/lib/maps";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

type Props = {
  latitude: number;
  longitude: number;
  height?: number;
  linkColor?: string;
};

export default function FoundLocationMap({
  latitude,
  longitude,
  height = 220,
  linkColor = "#1877F2",
}: Props) {
  const region = {
    latitude,
    longitude,
    latitudeDelta: 0.018,
    longitudeDelta: 0.018,
  };

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={styles.map}
        initialRegion={region}
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker coordinate={{ latitude, longitude }} title="Found here" />
      </MapView>
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
          Open in {Platform.OS === "ios" ? "Maps" : "Google Maps"}
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
  map: {
    ...StyleSheet.absoluteFillObject,
    height: "100%",
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
