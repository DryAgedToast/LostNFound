import { UD_MAP_CENTER } from "@/lib/maps";
import React, { createElement, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

/** Metro cannot reliably bundle `leaflet/dist/leaflet.css` as a dynamic import; load from CDN once. */
const LEAFLET_CSS_ID = "lnf-leaflet-css";
const LEAFLET_CSS_HREF = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

function ensureLeafletCssLoaded(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (document.getElementById(LEAFLET_CSS_ID)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.id = LEAFLET_CSS_ID;
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS_HREF;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error("Failed to load Leaflet stylesheet"));
    document.head.appendChild(link);
  });
}

type Props = {
  latitude: number;
  longitude: number;
  height: number;
  interactive: boolean;
  onPick?: (latitude: number, longitude: number) => void;
};

/**
 * Web-only map (Leaflet + OSM tiles). Click to set pin when `interactive`.
 * Uses a real DOM `div` for Leaflet; nested inside RN `View` for layout.
 */
export default function LeafletMapView({
  latitude,
  longitude,
  height,
  interactive,
  onPick,
}: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const latLngRef = useRef({ latitude, longitude });
  latLngRef.current = { latitude, longitude };

  useEffect(() => {
    const el = mapDivRef.current;
    if (!el) return;

    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    let marker: import("leaflet").CircleMarker | null = null;
    let clickHandler: ((e: import("leaflet").LeafletMouseEvent) => void) | null = null;

    (async () => {
      try {
        await ensureLeafletCssLoaded();
      } catch {
        if (!cancelled) console.warn("[LeafletMapView] Leaflet CSS failed to load");
      }
      const L = (await import("leaflet")).default;
      if (cancelled || !mapDivRef.current) return;

      const { latitude: la, longitude: lo } = latLngRef.current;
      const lat = Number.isFinite(la) ? la : UD_MAP_CENTER.latitude;
      const lng = Number.isFinite(lo) ? lo : UD_MAP_CENTER.longitude;

      map = L.map(el, {
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        doubleClickZoom: interactive,
        boxZoom: false,
        keyboard: false,
      }).setView([lat, lng], 16);
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      marker = L.circleMarker([lat, lng], {
        radius: 10,
        color: "#1877F2",
        weight: 2,
        fillColor: "#1877F2",
        fillOpacity: 0.95,
      }).addTo(map);
      markerRef.current = marker;

      if (interactive) {
        clickHandler = (e: import("leaflet").LeafletMouseEvent) => {
          const { lat: nlat, lng: nlng } = e.latlng;
          marker?.setLatLng([nlat, nlng]);
          onPickRef.current?.(nlat, nlng);
        };
        map.on("click", clickHandler);
      }

      requestAnimationFrame(() => map?.invalidateSize());
    })();

    return () => {
      cancelled = true;
      if (map && clickHandler) map.off("click", clickHandler);
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [interactive, height]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const lat = Number.isFinite(latitude) ? latitude : UD_MAP_CENTER.latitude;
    const lng = Number.isFinite(longitude) ? longitude : UD_MAP_CENTER.longitude;
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], map.getZoom());
    requestAnimationFrame(() => map.invalidateSize());
  }, [latitude, longitude]);

  return (
    <View style={[styles.outer, { height }]} collapsable={false}>
      {createElement("div", {
        ref: mapDivRef,
        style: { height: "100%", width: "100%", minHeight: height },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: "100%",
    alignSelf: "stretch",
    overflow: "hidden",
  },
});
