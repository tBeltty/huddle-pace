import { z } from "zod";

export const envSchema = z
  .object({
    SLACK_BOT_TOKEN: z.string().optional(),
    SLACK_APP_TOKEN: z.string().optional(),
    SLACK_SIGNING_SECRET: z.string().optional(),
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    SLACK_STATE_SECRET: z.string().optional(),
    SOCKET_MODE: z
      .string()
      .default("true")
      .transform((val) => val.toLowerCase() === "true"),
    DATABASE_URL: z.string().default("file:./dev.db"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3000),
  })
  .superRefine((data, ctx) => {
    if (data.SOCKET_MODE) {
      if (!data.SLACK_BOT_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SLACK_BOT_TOKEN is required when SOCKET_MODE is true",
          path: ["SLACK_BOT_TOKEN"],
        });
      }
      if (!data.SLACK_APP_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SLACK_APP_TOKEN is required when SOCKET_MODE is true",
          path: ["SLACK_APP_TOKEN"],
        });
      }
    } else {
      if (!data.SLACK_SIGNING_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SLACK_SIGNING_SECRET is required when SOCKET_MODE is false",
          path: ["SLACK_SIGNING_SECRET"],
        });
      }
      if (!data.SLACK_CLIENT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SLACK_CLIENT_ID is required when SOCKET_MODE is false",
          path: ["SLACK_CLIENT_ID"],
        });
      }
      if (!data.SLACK_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SLACK_CLIENT_SECRET is required when SOCKET_MODE is false",
          path: ["SLACK_CLIENT_SECRET"],
        });
      }
      if (!data.SLACK_STATE_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SLACK_STATE_SECRET is required when SOCKET_MODE is false",
          path: ["SLACK_STATE_SECRET"],
        });
      }
    }
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
