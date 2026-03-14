import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET_NAME ?? "content-factory-assets";

let s3Client: S3Client | null = null;

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION ?? "us-east-1",
    });
  }
  return s3Client;
}

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const s3 = getS3();
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  console.log(`[s3] Uploaded ${key} (${body.length} bytes)`);
}
