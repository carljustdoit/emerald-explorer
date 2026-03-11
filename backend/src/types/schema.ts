import { z } from 'zod';

export const LocationSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
});

export const EmeraldEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string(),
  description: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  is_kid_friendly: z.boolean(),
  vibe_tags: z.array(z.string()),
  location: LocationSchema,
  url: z.string().url(),
  image: z.string().url().optional(),
});

export const EnvironmentDataSchema = z.object({
  snoqualmie_snow_inches: z.number(),
  stevens_pass_snow_inches: z.number(),
  lake_union_temp_f: z.number(),
  cedar_river_flow_cfs: z.number(),
  wind_speed_mph: z.number(),
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
  title: z.string(),
  description: z.string().optional(),
  date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  location_name: z.string().optional(),
  location_address: z.string().optional(),
  url: z.string().optional(),
  image: z.string().optional(),
  source: z.string(),
});

export type RawScrapedEvent = z.infer<typeof RawScrapedEventSchema>;

export const EnrichedEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string(),
  description: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  is_kid_friendly: z.boolean(),
  vibe_tags: z.array(z.string()),
  location: LocationSchema,
  url: z.string(),
  image: z.string().optional(),
});

export type EnrichedEvent = z.infer<typeof EnrichedEventSchema>;
