/**
 * Canonical 12-point vehicle inspection checklist.
 *
 * Photo categories: `insp_<id>`
 * Reserved video categories (DB/media only — not wired in API/app yet): `insp_<id>_video`
 *
 * Keep in sync with Flutter: lib/data/constants/inspection_points.dart
 */
export type InspectionPointDef = {
  /** Stable id used in media category slugs */
  id: string;
  /** Display / InspectionItem.systemName */
  label: string;
  /** MediaAsset.category for the required photo */
  photoCategory: string;
  /**
   * Reserved MediaAsset.category for a future per-point video.
   * Do not validate or expose in the app until video capture ships.
   */
  videoCategory: string;
  sortOrder: number;
};

export const INSPECTION_POINTS: readonly InspectionPointDef[] = [
  {
    id: 'brakes',
    label: 'Brakes',
    photoCategory: 'insp_brakes',
    videoCategory: 'insp_brakes_video',
    sortOrder: 1,
  },
  {
    id: 'lights',
    label: 'Lights',
    photoCategory: 'insp_lights',
    videoCategory: 'insp_lights_video',
    sortOrder: 2,
  },
  {
    id: 'steering_suspension',
    label: 'Steering/Suspension',
    photoCategory: 'insp_steering_suspension',
    videoCategory: 'insp_steering_suspension_video',
    sortOrder: 3,
  },
  {
    id: 'exhaust',
    label: 'Exhaust',
    photoCategory: 'insp_exhaust',
    videoCategory: 'insp_exhaust_video',
    sortOrder: 4,
  },
  {
    id: 'fuel_system',
    label: 'Fuel System',
    photoCategory: 'insp_fuel_system',
    videoCategory: 'insp_fuel_system_video',
    sortOrder: 5,
  },
  {
    id: 'tires',
    label: 'Tires',
    photoCategory: 'insp_tires',
    videoCategory: 'insp_tires_video',
    sortOrder: 6,
  },
  {
    id: 'wipers',
    label: 'Wipers',
    photoCategory: 'insp_wipers',
    videoCategory: 'insp_wipers_video',
    sortOrder: 7,
  },
  {
    id: 'doors_mirrors',
    label: 'Doors/Mirrors',
    photoCategory: 'insp_doors_mirrors',
    videoCategory: 'insp_doors_mirrors_video',
    sortOrder: 8,
  },
  {
    id: 'seats_seatbelts',
    label: 'Seats/Seatbelts',
    photoCategory: 'insp_seats_seatbelts',
    videoCategory: 'insp_seats_seatbelts_video',
    sortOrder: 9,
  },
  {
    id: 'horn',
    label: 'Horn',
    photoCategory: 'insp_horn',
    videoCategory: 'insp_horn_video',
    sortOrder: 10,
  },
  {
    id: 'airbag_engine_light',
    label: 'Air bag light/Engine light on?',
    photoCategory: 'insp_airbag_engine_light',
    videoCategory: 'insp_airbag_engine_light_video',
    sortOrder: 11,
  },
  {
    id: 'other',
    label: 'Other',
    photoCategory: 'insp_other',
    videoCategory: 'insp_other_video',
    sortOrder: 12,
  },
  {
    id: 'fluids',
    label: 'Fluids',
    photoCategory: 'insp_fluids',
    videoCategory: 'insp_fluids_video',
    sortOrder: 13,
  },
] as const;

/** User listed 12 names; Fluids is included as the 13th checklist row from the sheet. */
export const INSPECTION_POINT_COUNT = INSPECTION_POINTS.length;

export const INSPECTION_LABELS = new Set(
  INSPECTION_POINTS.map((point) => point.label),
);

export const INSPECTION_PHOTO_CATEGORIES = new Set(
  INSPECTION_POINTS.map((point) => point.photoCategory),
);

/** Reserved only — do not require uploads until video is productized. */
export const INSPECTION_VIDEO_CATEGORIES = new Set(
  INSPECTION_POINTS.map((point) => point.videoCategory),
);

export function isInspectionPhotoCategory(category: string): boolean {
  return INSPECTION_PHOTO_CATEGORIES.has(category);
}

export function labelForPhotoCategory(category: string): string | null {
  const point = INSPECTION_POINTS.find((p) => p.photoCategory === category);
  return point?.label ?? null;
}
