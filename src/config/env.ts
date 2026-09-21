import { z } from "zod";

export const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string().min(1, "SLACK_BOT_TOKEN is required"),
  SLACK_APP_TOKEN: z.string().min(1, "SLACK_APP_TOKEN is required"),
  SLACK_SIGNING_SECRET: z.string().optional(),
  DATABASE_URL: z.string().default("file:./dev.db"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().optional().default(3000),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => ` - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${errorDetails}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}
