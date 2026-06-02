import type { AccountAvatarPreset } from "./types"

export const DEFAULT_AVATAR_ID = "person_default"

export const SEEDED_AVATAR_PRESETS: Array<Omit<AccountAvatarPreset, "createdAt" | "updatedAt">> = [
  {
    id: DEFAULT_AVATAR_ID,
    label: "默认头像",
    imageUrl: "/assets/avatars/person_default.png",
    active: true,
    sortOrder: 10,
    builtIn: true,
  },
  {
    id: "carbon_helmet",
    label: "碳纤头盔",
    imageUrl: "/assets/avatars/carbon_helmet.png",
    active: true,
    sortOrder: 20,
    builtIn: true,
  },
  {
    id: "forged_wheel",
    label: "锻造轮毂",
    imageUrl: "/assets/avatars/forged_wheel.png",
    active: true,
    sortOrder: 30,
    builtIn: true,
  },
  {
    id: "turbo_core",
    label: "涡轮核心",
    imageUrl: "/assets/avatars/turbo_core.png",
    active: true,
    sortOrder: 40,
    builtIn: true,
  },
  {
    id: "garage_key",
    label: "车库钥匙",
    imageUrl: "/assets/avatars/garage_key.png",
    active: true,
    sortOrder: 50,
    builtIn: true,
  },
  {
    id: "aero_front",
    label: "空力前唇",
    imageUrl: "/assets/avatars/aero_front.png",
    active: true,
    sortOrder: 60,
    builtIn: true,
  },
  {
    id: "track_marker",
    label: "赛道标记",
    imageUrl: "/assets/avatars/track_marker.png",
    active: true,
    sortOrder: 70,
    builtIn: true,
  },
  {
    id: "neon_speed",
    label: "霓虹速度",
    imageUrl: "/assets/avatars/neon_speed.png",
    active: true,
    sortOrder: 80,
    builtIn: true,
  },
]

export function normalizeAvatarPresetId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
}
