import { Linking, Platform } from "react-native";

/** Default map center (University of Delaware, Newark). */
export const UD_MAP_CENTER = {
  latitude: 39.6817,
  longitude: -75.7507,
};

export function openInMapsAt(latitude: number, longitude: number, label = "Found here") {
  const q = `${latitude},${longitude}`;
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(label)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  return Linking.openURL(url);
}

export function osmEmbedUrl(latitude: number, longitude: number, pad = 0.012) {
  const bbox = `${longitude - pad},${latitude - pad},${longitude + pad},${latitude + pad}`;
  const marker = `${latitude},${longitude}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
}
