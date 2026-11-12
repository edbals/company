import { createFileRoute } from "@tanstack/react-router";
import { RationalePage } from "@/components/marketing/rationale/RationalePage";

export const Route = createFileRoute("/rationale")({
  head: () => ({
    meta: [
      { title: "Why We're Building Company — Design Rationale" },
      {
        name: "description",
        content:
          "Design rationale for Company, an AI planning companion for older adults: the problem, our users, our solution, key interaction choices and the outcome.",
      },
      { property: "og:title", content: "Why We're Building Company" },
      { property: "og:type", content: "article" },
    ],
  }),
  component: RationalePage,
});
