# Partner evidence · Waterloo hackathon · 22 November 2026

## Organizer list

Page 1 of the organizer’s *Hacker Package.pdf*, distributed in the Luma announcement titled “Hacker Package,” lists twelve partners. They are ElevenLabs, Maritime, Fiber AI, Expected Parrot, TraceRoot AI, Alter, assistant-ui, Wasp, Codevisor, Ploid, Rowboat Labs and **Keike**. The package separately identifies Waterloo Venture Group and Front Row Ventures as supporters.

The public Luma sponsor list and page 2 of the event-day *Partner Guide — YC Startups × ElevenLabs Hackathon.pdf* list the other eleven. The hacker package establishes Keike’s partner status. Keike’s product, access and use in Second Cursor remain unverified. [Public organizer listing](https://luma.com/4ho86pj0)

## Fiber company lookup and design decision

Codevisor’s Fiber AI plugin ran `companySearch_tool` with `{"searchParams":{"domains":["maritime.sh"]},"pageSize":1}`. Fiber returned HTTP 200 and one row. The row’s `linkedin_id` was `-73307920`. Its accelerator entry identified Maritime, domain `maritime.sh`, slug `maritime`, record ID `ycombinator_38061`, Fall 2026. Fiber described a managed service that gives each agent its own persistent computer. Maritime’s YC profile corroborates the domain and execution model. [Maritime at YC](https://www.ycombinator.com/companies/maritime)

**Design decision for the build review screen.** Give each remote verification run its own row with the task, execution state and returned run ID. Link the resulting preview or log from that row, so a reviewer can tell which isolated worker produced it. Keep a queued task visibly queued until the dispatcher receives a run ID. This is a design decision informed by a live authoring-time lookup. The lookup itself launched zero Maritime jobs.

## Ploid and Rowboat retrieval checks

The organizer’s partner guide describes Ploid’s description-based audience search on page 3 and Rowboat’s editable Markdown memory on page 5. These are organizer-provided descriptions. The checks below exercised the repository adapters with the project’s ignored `.env` loaded. Codevisor plugin searches for each provider returned zero matches.

| Provider | Read operation attempted | Observed result |
| --- | --- | --- |
| Ploid | `audienceSearch` for “Founders building developer tools”, limited to one result | Adapter returned `unavailable` before sending a request. Missing `PLOID_API_KEY`. The event offers a $10 credit, but the local search requires an API credential. Zero audience records retrieved. |
| Rowboat | `readMemory` for project `second-cursor`, scoped to `second-cursor/second-cursor/decisions.md` | Adapter returned `unavailable` before opening an MCP session. Missing `ROWBOAT_MCP_URL`, `ROWBOAT_MCP_TOKEN` and `ROWBOAT_SPACE_ID`. Project memory contents remain unknown. |

Both checks were read-only. No one was contacted.
