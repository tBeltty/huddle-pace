import { z } from "zod";

export const subtopicInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Please provide a name for this subtopic."),
  percentage: z
    .number({ invalid_type_error: "Percentage must be a positive number." })
    .int("Percentage must be a whole number.")
    .positive("Percentage must be a positive number."),
});

export const scheduleModalInputSchema = z
  .object({
    title: z.string().trim().min(1, "Please provide a title for the meetup."),
    channelId: z.string().trim().min(1, "Please select a target channel."),
    totalMinutes: z
      .number({ invalid_type_error: "Duration must be a positive number." })
      .int("Duration must be a whole number.")
      .positive("Duration must be a positive number."),
    speakerUserId: z.string().min(1, "Speaker is required."),
    threadTs: z.string().nullable(),
    modules: z
      .array(subtopicInputSchema)
      .min(1, "At least one subtopic is required."),
  })
  .superRefine((data, ctx) => {
    const total = data.modules.reduce((sum, m) => sum + m.percentage, 0);
    if (total !== 100) {
      const lastIndex = Math.max(0, data.modules.length - 1);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Total must equal 100%. Currently: ${total}%.`,
        path: ["modules", lastIndex, "percentage"],
      });
    }
  });

export type SubtopicInputDTO = z.infer<typeof subtopicInputSchema>;
export type ScheduleModalInputDTO = z.infer<typeof scheduleModalInputSchema>;
