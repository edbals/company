<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- The real app lives under `/app` (older adult) and `/family`.
- Server commands are in `src/lib/app.functions.ts` and `src/lib/agents.functions.ts`, all behind `requireSupabaseAuth`; row security limits users to their own rows, and anything crossing a household (invites, requests, family view, commits) goes through security-definer SQL functions that check membership.
- Family views are built only by the `family_overview()` SQL function, which filters by the older adult's live sharing settings and the member's pace; never add chats, memory or reminders to it.
- Confirmed choices are `decisions` rows committed by `commit_decision()` (Undo window, quote re-check, idempotent); costs, clashes and limits come from `src/lib/plan-logic.ts`, never from the model.
- External ride/delivery providers are not connected; offer family or own-way options and say "Not connected" rather than simulating a booking.
- `src/test/household.integration.test.ts` runs against the real backend with throwaway users when backend credentials are present.
- Household rows (alerts, requests, updates) are pinned to their owner household by the `guard_household_row` trigger; `commit_decision` checks an allowlist of choices before running `commit_decision_core`, and internal helpers such as `check_escalations` cannot be called directly.
