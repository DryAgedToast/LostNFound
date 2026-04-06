import type { Hotspot, ItemWithPoster } from "@/types";
import { DEV_MODE, MOCK_USER } from "./auth";

export const MOCK_HOTSPOTS: Hotspot[] = [];

export const MOCK_ITEMS: ItemWithPoster[] = [];

/**
 * Returns mock items when in DEV_MODE, otherwise returns empty array
 * Use this in place of Supabase queries for demo purposes
 */
export function getMockItems(): ItemWithPoster[] {
  return DEV_MODE ? MOCK_ITEMS : [];
}

/**
 * Get a single mock item by ID
 */
export function getMockItemById(id: string): ItemWithPoster | undefined {
  return DEV_MODE ? MOCK_ITEMS.find((item) => item.id === id) : undefined;
}

/**
 * Returns mock hotspots when in DEV_MODE
 */
export function getMockHotspots(): Hotspot[] {
  return DEV_MODE ? MOCK_HOTSPOTS : [];
}
