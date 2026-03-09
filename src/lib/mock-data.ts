import type { Hotspot, ItemWithPoster } from "@/types";
import { DEV_MODE, MOCK_USER } from "./auth";

const MOCK_HOTSPOT: Hotspot = {
  id: "hotspot-001",
  name: "Main Library Front Desk",
  building_type: "library",
  address: "University Avenue, Kingston",
  latitude: 44.2253,
  longitude: -76.4951,
  staff_contact: "library@university.edu",
  is_active: true,
  created_at: new Date(Date.now() - 3600000).toISOString(),
};

const MOCK_HOTSPOT_2: Hotspot = {
  id: "hotspot-002",
  name: "Student Center Info Desk",
  building_type: "student_center",
  address: "Campus Drive, Kingston",
  latitude: 44.2265,
  longitude: -76.494,
  staff_contact: "studentcenter@university.edu",
  is_active: true,
  created_at: new Date(Date.now() - 7200000).toISOString(),
};

export const MOCK_HOTSPOTS = [MOCK_HOTSPOT, MOCK_HOTSPOT_2];

export const MOCK_ITEMS: ItemWithPoster[] = [
  {
    id: "item-001",
    poster_id: MOCK_USER.id,
    title: "Black iPhone 13",
    description:
      "Found near the library entrance. Has a blue case with stickers.",
    category: "electronics",
    location_found: "Main Library Entrance",
    hotspot_id: "hotspot-001",
    image_url: null,
    status: "at_hotspot",
    custom_questions: [
      { id: "q1", question: "What's your phone number?" },
      { id: "q2", question: "What color is the phone case?" },
    ],
    created_at: new Date(Date.now() - 7200000).toISOString(),
    profiles: MOCK_USER,
    hotspots: MOCK_HOTSPOT,
  },
  {
    id: "item-002",
    poster_id: MOCK_USER.id,
    title: "Student ID Card",
    description: "Found in the computer lab",
    category: "id_card",
    location_found: "Computer Lab B-203",
    hotspot_id: null,
    image_url: null,
    status: "unclaimed",
    custom_questions: [{ id: "q1", question: "What's the student ID number?" }],
    created_at: new Date(Date.now() - 3600000).toISOString(),
    profiles: MOCK_USER,
    hotspots: null,
  },
  {
    id: "item-003",
    poster_id: MOCK_USER.id,
    title: "Keys with Red Keychain",
    description: "Set of 4 keys with a red maple leaf keychain",
    category: "keys",
    location_found: "Gymnasium Locker Room",
    hotspot_id: "hotspot-001",
    image_url: null,
    status: "at_hotspot",
    custom_questions: [
      { id: "q1", question: "Describe the keychain" },
      { id: "q2", question: "How many keys are there?" },
    ],
    created_at: new Date(Date.now() - 10800000).toISOString(),
    profiles: MOCK_USER,
    hotspots: MOCK_HOTSPOT,
  },
  {
    id: "item-004",
    poster_id: MOCK_USER.id,
    title: "Blue Backpack",
    description: "Contains textbooks and a water bottle",
    category: "bag",
    location_found: "Student Center Cafeteria",
    hotspot_id: null,
    image_url: null,
    status: "unclaimed",
    custom_questions: [
      { id: "q1", question: "What brand is the backpack?" },
      { id: "q2", question: "What textbooks are inside?" },
    ],
    created_at: new Date(Date.now() - 14400000).toISOString(),
    profiles: MOCK_USER,
    hotspots: null,
  },
];

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
