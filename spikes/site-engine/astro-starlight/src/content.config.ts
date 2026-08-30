import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { docsSchema } from "@astrojs/starlight/schema";
import { externalDocsLoader } from "./external-docs-loader";

export const collections = {
  docs: defineCollection({
    loader: externalDocsLoader({
      root: process.env.EXTERNAL_DOCS_ROOT ?? "fixtures/external-docs"
    }),
    schema: docsSchema({
      extend: z.object({
        language: z.string(),
        rawSource: z.string()
      })
    })
  })
};
