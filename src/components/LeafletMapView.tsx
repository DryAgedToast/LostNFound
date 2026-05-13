import React from "react";
import { View } from "react-native";

type Props = {
  latitude: number;
  longitude: number;
  height: number;
  interactive: boolean;
  onPick?: (latitude: number, longitude: number) => void;
};

/** Native bundles use `FoundLocationMap.native` / `FoundLocationPostEditor.native`; this stub satisfies resolution if imported. */
export default function LeafletMapView(_props: Props) {
  return <View />;
}
