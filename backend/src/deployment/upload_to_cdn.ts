import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { EmeraldFeed } from '../types/schema.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function uploadToCDN(feed: EmeraldFeed): Promise<string | null> {
  const bucket = process.env.CDN_BUCKET;
  const region = process.env.AWS_REGION || 'us-west-2';
  const endpoint = process.env.CDN_ENDPOINT;
  const publicUrl = process.env.CDN_PUBLIC_URL;

  if (!bucket) {
    console.warn('[CDN] No bucket configured. Writing locally only.');
    return writeFeedLocally(feed);
  }

  console.log(`[CDN] Uploading to ${bucket}...`);

  try {
    const s3Config: any = {
      region,
    };

    if (endpoint) {
      s3Config.endpoint = endpoint;
      s3Config.forcePathStyle = true;
    }

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      s3Config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    const s3Client = new S3Client(s3Config);

    const jsonContent = JSON.stringify(feed, null, 2);
    const key = 'seattle_master_feed.json';

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: jsonContent,
        ContentType: 'application/json',
        CacheControl: 'max-age=3600',
      },
    });

    await upload.done();

    const url = publicUrl 
      ? `${publicUrl}/${key}` 
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    console.log(`[CDN] Uploaded to: ${url}`);
    return url;
  } catch (error) {
    console.error('[CDN] Upload failed:', error);
    console.log('[CDN] Falling back to local write...');
    return writeFeedLocally(feed);
  }
}

async function writeFeedLocally(feed: EmeraldFeed): Promise<string> {
  const outputDir = process.env.OUTPUT_DIR || join(process.cwd(), '..', 'public');
  const outputPath = join(outputDir, 'seattle_master_feed.json');

  try {
    const jsonContent = JSON.stringify(feed, null, 2);
    await writeFile(outputPath, jsonContent, 'utf-8');
    console.log(`[CDN] Written to local file: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('[CDN] Failed to write local file:', error);
    throw error;
  }
}

export async function generateFeedJSON(feed: EmeraldFeed): Promise<string> {
  return JSON.stringify(feed, null, 2);
}
