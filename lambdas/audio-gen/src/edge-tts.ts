import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

/**
 * Edge-TTS fallback — unlimited free Microsoft TTS.
 *
 * Uses msedge-tts library (pure Node.js, no CLI, no API key).
 * Works in Lambda.
 */
export async function generateEdgeTTS(
  text: string,
  voice: string
): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  // toStream returns { audioStream, metadataStream } synchronously
  const { audioStream } = tts.toStream(text);

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end", resolve);
    audioStream.on("error", reject);
  });

  return Buffer.concat(chunks);
}
