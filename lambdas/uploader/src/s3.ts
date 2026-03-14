import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

const BUCKET = process.env.S3_BUCKET_NAME ?? "content-factory-assets";

let s3Client: S3Client | null = null;

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
  }
  return s3Client;
}

/**
 * Get a readable stream from S3 — for direct upload to YouTube without
 * downloading the entire file to Lambda's /tmp first.
 */
export function getS3Stream(key: string): Readable {
  const s3 = getS3();

  // Create a passthrough stream that pulls from S3
  const passthrough = new Readable({
    read() {},
  });

  s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    .then((response) => {
      const body = response.Body as Readable;
      body.on("data", (chunk: Buffer) => passthrough.push(chunk));
      body.on("end", () => passthrough.push(null));
      body.on("error", (err: Error) => passthrough.destroy(err));
    })
    .catch((err: Error) => passthrough.destroy(err));

  return passthrough;
}
