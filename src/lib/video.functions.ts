import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VideoInput = z.object({
    prompt: z.string().min(3),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
    duration: z.union([z.literal(5), z.literal(10)]).default(5),
});

export const generateVideo = createServerFn({ method: "POST" })
    .inputValidator((input: unknown) => VideoInput.parse(input))
    .handler(async ({ data }) => {
        void data;
        return {
            ok: false as const,
            error:
                "Runtime video generation isn't wired up yet. Connect the Replicate integration (Veo, Kling, or Luma models) to enable prompt-to-video in this app.",
        };
    });
