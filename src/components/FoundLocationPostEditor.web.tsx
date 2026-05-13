import LeafletMapView from "@/components/LeafletMapView";
import { Colors } from "@/constants/theme";
import { UD_MAP_CENTER } from "@/lib/maps";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type ColorsT = typeof Colors.light;

type Props = {
  foundLatitude: number | null;
  foundLongitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  colors: ColorsT;
};

const MODAL_MAP_HEIGHT = Math.max(
  260,
  Math.min(520, Dimensions.get("window").height - 220),
);

/** Web: Leaflet map — tap to set pin (no react-native-maps). */
export default function FoundLocationPostEditor({
  foundLatitude,
  foundLongitude,
  onChange,
  colors,
}: Props) {
  const [mapOpen, setMapOpen] = useState(false);
  const [mapSession, setMapSession] = useState(0);
  const [draftLat, setDraftLat] = useState(UD_MAP_CENTER.latitude);
  const [draftLng, setDraftLng] = useState(UD_MAP_CENTER.longitude);
  const [loadingGps, setLoadingGps] = useState(false);

  const accent = "#1877F2";

  const openMapModal = () => {
    const lat = foundLatitude ?? UD_MAP_CENTER.latitude;
    const lng = foundLongitude ?? UD_MAP_CENTER.longitude;
    setDraftLat(lat);
    setDraftLng(lng);
    setMapSession((s) => s + 1);
    setMapOpen(true);
  };

  const useWebLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      Alert.alert("Not supported", "This browser cannot access location.");
      return;
    }
    setLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onChange(p.coords.latitude, p.coords.longitude);
        setLoadingGps(false);
      },
      () => {
        setLoadingGps(false);
        Alert.alert("Location", "Could not read your location.");
      },
      { enableHighAccuracy: true, timeout: 20000 },
    );
  };

  const saveMapPin = () => {
    onChange(draftLat, draftLng);
    setMapOpen(false);
  };

  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, { borderColor: accent }]}
          onPress={useWebLocation}
          disabled={loadingGps}
        >
          {loadingGps ? (
            <ActivityIndicator color={accent} />
          ) : (
            <Text style={[styles.btnText, { color: accent }]}>
              Use my location
            </Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.btn, { borderColor: accent }]}
          onPress={openMapModal}
        >
          <Text style={[styles.btnText, { color: accent }]}>Place on map</Text>
        </Pressable>
      </View>
      {foundLatitude != null && foundLongitude != null ? (
        <View style={styles.pinRow}>
          <Text style={[styles.pinText, { color: colors.textSecondary }]}>
            Map pin: {foundLatitude.toFixed(5)}, {foundLongitude.toFixed(5)}
          </Text>
          <Pressable onPress={() => onChange(null, null)} hitSlop={8}>
            <Text style={[styles.clearText, { color: accent }]}>Clear pin</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Optional — helps others see where on campus the item was found.
        </Text>
      )}

      <Modal
        visible={mapOpen}
        animationType="slide"
        onRequestClose={() => setMapOpen(false)}
      >
        {mapOpen ? (
          <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Tap map to set pin
            </Text>
            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
              Tap where you found the item, then save.
            </Text>
            <View style={styles.mapBox}>
              <LeafletMapView
                key={mapSession}
                latitude={draftLat}
                longitude={draftLng}
                height={MODAL_MAP_HEIGHT}
                interactive
                onPick={(lat, lng) => {
                  setDraftLat(lat);
                  setDraftLng(lng);
                }}
              />
            </View>
            <Text style={[styles.coordsPreview, { color: colors.textSecondary }]}>
              {draftLat.toFixed(5)}, {draftLng.toFixed(5)}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.backgroundSelected }]}
                onPress={() => setMapOpen(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: accent }]}
                onPress={saveMapPin}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>Save pin</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  btn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 130,
    alignItems: "center",
  },
  btnText: { fontSize: 14, fontWeight: "600" },
  pinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  pinText: { fontSize: 13, flex: 1 },
  clearText: { fontSize: 14, fontWeight: "700" },
  hint: { fontSize: 13, lineHeight: 18 },
  modalRoot: { flex: 1, padding: 16, paddingTop: 48 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  modalHint: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  mapBox: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  coordsPreview: { fontSize: 12, marginBottom: 8 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: { fontSize: 16, fontWeight: "700" },
});
