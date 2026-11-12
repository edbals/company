// Public planner for the /demo page. No sign-in and no account data: the visitor's words and a
// short made-up profile go in, a plan comes out, and nothing is booked, sent or saved.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { DemoInput, DemoResult } from "./demo-plan";
import { runDemoPlan } from "./demo-agents.server";

function clientIp(): string {
  try {
    const headers = getRequest().headers;
    return (
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
    );
  } catch {
    return "unknown";
  }
}

export const planDemo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DemoInput.parse(d))
  .handler(async ({ data }) => DemoResult.parse(await runDemoPlan(data, clientIp())));
