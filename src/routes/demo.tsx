import { createFileRoute } from "@tanstack/react-router";
import { DemoPage } from "@/components/demo/DemoPage";
import { DEMO_PATH } from "@/components/marketing/content";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Try Company — A Guided Demo" },
      {
        name: "description",
        content:
          "Play Joe, 78, in a short guided demo of Company, an AI planning companion for older adults. No sign-in. Nothing sent, booked or saved.",
      },
      { property: "og:title", content: "Try Company — A Guided Demo" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: DEMO_PATH }],
  }),
  component: DemoPage,
});
