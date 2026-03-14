import { z } from "zod";

/**
 * Standard Lambda response wrapper.
 * Every Lambda returns { statusCode, body } where body is JSON-stringified.
 * The body always contains { success, data?, error? }.
 */
export const LambdaResponse = z.object({
  statusCode: z.number(),
  body: z.string(),
});

export type LambdaResponseType = z.infer<typeof LambdaResponse>;

/**
 * Parse a Lambda response body into typed data.
 */
export function parseLambdaBody<T>(body: string): {
  success: boolean;
  data?: T;
  error?: string;
} {
  return JSON.parse(body);
}
