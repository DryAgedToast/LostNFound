import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

const delawareLogo = require("./NEWUDLOGO.png");

const BRAND = {
  gold: "#FFD200",
  white: "#FFFFFF",
};

/**
 * Delaware + Lost & Found branding for the native tab header (gold on UD blue header).
 */
export default function FeedHeaderBrand() {
  return (
    <View style={styles.root}>
      <Image
        source={delawareLogo}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.textCol}>
        <Text style={styles.lineDelaware}>DELAWARE</Text>
        <Text style={styles.lineLnf}>LOST & FOUND</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    paddingRight: 8,
  },
  logo: {
    width: 36,
    height: 40,
    borderRadius: 6,
  },
  textCol: {
    justifyContent: "center",
  },
  lineDelaware: {
    color: BRAND.white,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  lineLnf: {
    color: BRAND.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 2,
  },
});
