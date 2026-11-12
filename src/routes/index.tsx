import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/marketing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Company — Your plans. Your decisions." },
    { name: "description", content: "Company is an AI planning companion for older adults. Say what you would like to do; a team of agents builds one plan, and nothing happens until you say yes." },
    { property: "og:title", content: "Company — Your plans. Your decisions." },
    { property: "og:description", content: "Help with the planning. You choose what happens next." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: LandingPage,
});
