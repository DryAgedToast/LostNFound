import { Colors } from "@/constants/theme";
import { UD_MAP_CENTER } from "@/lib/maps";
import * as Location from "expo-location";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

type ColorsT = typeof Colors.light;

type Props = {
  foundLatitude: number | null;
  foundLongitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  colors: ColorsT;
};

export default function FoundLocationPostEditor({
  foundLatitude,
  foundLongitude,
  onChange,
  colors,
}: Props) {
  const [mapOpen, setMapOpen] = useState(false);
  const [draftLat, setDraftLat] = useState(UD_MAP_CENTER.latitude);
  const [draftLng, setDraftLng] = useState(UD_MAP_CENTER.longitude);
  const [loadingGps, setLoadingGps] = useState(false);

  const accent = "#1877F2";

  const openMapModal = () => {
    const lat = foundLatitude ?? UD_MAP_CENTER.latitude;
    const lng = foundLongitude ?? UD_MAP_CENTER.longitude;
    setDraftLat(lat);
    setDraftLng(lng);
    setMapOpen(true);
  };

  const useNativeLocation = useCallback(async () => {
    setLoadingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow location to drop a pin where you found the item.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onChange(pos.coords.latitude, pos.coords.longitude);
    } catch {
      Alert.alert(
        "Location",
        "Could not read GPS. Try “Place on map” or describe the location in the text field.",
      );
    } finally {
      setLoadingGps(false);
    }
  }, [onChange]);

  const saveMapPin = () => {
    onChange(draftLat, draftLng);
    setMapOpen(false);
  };

  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, { borderColor: accent }]}
          onPress={useNativeLocation}
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
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Tap map to set pin
          </Text>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: draftLat,
              longitude: draftLng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            onPress={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setDraftLat(latitude);
              setDraftLng(longitude);
            }}
          >
            <Marker coordinate={{ latitude: draftLat, longitude: draftLng }} />
          </MapView>
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
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  map: { flex: 1, minHeight: 240, borderRadius: 12, marginBottom: 12 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 12 },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: { fontSize: 16, fontWeight: "700" },
});
