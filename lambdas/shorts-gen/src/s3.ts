import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { writeFile } from "fs/promises";

const BUCKET = process.env.S3_BUCKET_NAME ?? "content-factory-assets";

let s3Client: S3Client | null = null;

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
  }
  return s3Client;
}

export async function downloadFromS3(key: string, localPath: string): Promise<void> {
  const s3 = getS3();
  const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!response.Body) throw new Error(`S3 object ${key} has no body`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  await writeFile(localPath, Buffer.concat(chunks));
}

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<void> {
  const s3 = getS3();
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  console.log(`[s3] Uploaded ${key} (${body.length} bytes)`);
}

export async function getFileSize(filePath: string): Promise<number> {
  const { stat } = await import("fs/promises");
  return (await stat(filePath)).size;
}
