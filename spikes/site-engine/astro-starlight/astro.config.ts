import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "yom site-engine spike",
      components: {
        MarkdownContent: "./src/components/MarkdownContent.astro",
        Sidebar: "./src/components/Sidebar.astro"
      }
    })
  ]
});
