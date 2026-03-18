import { z } from 'zod';

export const LocationSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  address: z.string().optional(),
});

export const SessionSchema = z.object({
  date: z.string(),
  start_time: z.string().optional(),
  price: z.string().optional(),
});

export const EmeraldEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string(),
  description: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  price: z.string().optional(),
  sessions: z.array(SessionSchema).optional(),
  is_kid_friendly: z.boolean(),
  vibe_tags: z.array(z.string()),
  location: LocationSchema,
  url: z.string().url(),
  image: z.string().url().optional(),
  ticket_url: z.string().url().optional(),
  map_url: z.string().url().optional(),
  video_url: z.string().url().optional(),
});

export const EnvironmentDataSchema = z.object({
  snoqualmie_snow_inches: z.number().optional(),
  stevens_pass_snow_inches: z.number().optional(),
  crystal_mountain_snow_inches: z.number().optional(),
  lake_union_temp_f: z.number().optional(),
  lake_washington_temp_f: z.number().optional(),
  puget_sound_temp_f: z.number().optional(),
  cedar_river_flow_cfs: z.number().optional(),
  wind_speed_mph: z.number().optional(),
  sunset_time: z.string(),
  tide_height_ft: z.number().optional(),
  conditions: z.string(),
});

export const EmeraldFeedMetadataSchema = z.object({
  last_updated: z.string(),
  environment: EnvironmentDataSchema,
});

export const EmeraldFeedSchema = z.object({
  metadata: EmeraldFeedMetadataSchema,
  events: z.array(EmeraldEventSchema),
});

export type Location = z.infer<typeof LocationSchema>;
export type EmeraldEvent = z.infer<typeof EmeraldEventSchema>;
export type EnvironmentData = z.infer<typeof EnvironmentDataSchema>;
export type EmeraldFeedMetadata = z.infer<typeof EmeraldFeedMetadataSchema>;
export type EmeraldFeed = z.infer<typeof EmeraldFeedSchema>;

export const RawScrapedEventSchema = z.object({
  title: z.string().min(3, "Title too short"),
  description: z.string().optional(),
  price: z.string().optional(),
  date: z.string().optional().refine(val => {
    if (!val) return true;
    const cleanStr = val.split('-').map(s => s.trim())[0]; // just check if the first part has some chars
    return cleanStr.length > 3;
  }, "Invalid Date String"),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  sessions: z.array(SessionSchema).optional(),
  location_name: z.string().optional(),
  location_address: z.string().optional(),
  location_lat: z.number().optional(),
  location_lon: z.number().optional(),
  url: z.string().url("Invalid Event URL").optional().or(z.literal('')),
  image: z.string().url("Invalid Image URL").optional().or(z.literal('')),
  ticket_url: z.string().url("Invalid Ticket URL").optional().or(z.literal('')),
  map_url: z.string().url("Invalid Map URL").optional().or(z.literal('')),
  video_url: z.string().url("Invalid Video URL").optional().or(z.literal('')),
  source: z.string().min(1, "Source required"),
});

export type RawScrapedEvent = z.infer<typeof RawScrapedEventSchema>;

export const EnrichedEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string(),
  description: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  price: z.string().optional(),
  sessions: z.array(SessionSchema).optional(),
  is_kid_friendly: z.boolean(),
  vibe_tags: z.array(z.string()),
  location: LocationSchema,
  url: z.string(),
  image: z.string().optional(),
  ticket_url: z.string().optional(),
  map_url: z.string().optional(),
  video_url: z.string().optional(),
});

export type EnrichedEvent = z.infer<typeof EnrichedEventSchema>;
