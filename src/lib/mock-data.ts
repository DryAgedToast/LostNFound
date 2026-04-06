import type { Hotspot, ItemWithPoster } from "@/types";
import { DEMO_MODE, MOCK_USER } from "./auth";

export const MOCK_HOTSPOTS: Hotspot[] = [];

export const MOCK_ITEMS: ItemWithPoster[] = [];

export function getMockItems(): ItemWithPoster[] {
  return DEMO_MODE ? MOCK_ITEMS : [];
}

export function getMockItemById(id: string): ItemWithPoster | undefined {
  return DEMO_MODE ? MOCK_ITEMS.find((item) => item.id === id) : undefined;
}

export function getMockHotspots(): Hotspot[] {
  return DEMO_MODE ? MOCK_HOTSPOTS : [];
}
