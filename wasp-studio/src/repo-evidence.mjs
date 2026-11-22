export const snapshot = {
  "repo": "Festyve/iris",
  "commit": "0bf8dd8da52572cad2ee3ea8eacbb628f9304667",
  "rows": [
    {
      "path": "README.md",
      "line": 125,
      "keywords": "command launch run start studio locally",
      "excerpt": "npm start"
    },
    {
      "path": "README.md",
      "line": 128,
      "keywords": "archive server browser port database",
      "excerpt": "For a fresh checkout, run `npm ci` and follow the initial database setup in [the Wasp archive runbook](wasp-studio/README.md). The launcher builds the studio and starts or reuses the local services. The archive API runs on port 3002 and its browser on 3003."
    },
    {
      "path": "README.md",
      "line": 104,
      "keywords": "figma plugin rebuild generated javascript",
      "excerpt": "After editing sources, run `npm run build` to regenerate **plugin.js** and **ui.html**."
    },
    {
      "path": "README.md",
      "line": 134,
      "keywords": "reference vault import markdown screenshots folder",
      "excerpt": "1. Drop Markdown notes and their screenshots together, select a folder, or click **Load design-vault demo**. Open a reference to inspect its original note, linked images and attribution."
    },
    {
      "path": "README.md",
      "line": 140,
      "keywords": "preview verification screen widths failed cancelled",
      "excerpt": "Local planning uses bounded rules, two compositions and a set of subject profiles. Gemini can choose a structured design plan when the server has `GEMINI_API_KEY`. The compiler produces the HTML, checks it, and renders it in isolated frames at 390 and 1024 pixels before saving a version. A failed or cancelled run keeps the previous deliverable."
    },
    {
      "path": "package.json",
      "line": 9,
      "keywords": "test command unit tests suite",
      "excerpt": "\"test\": \"node --test tests/*.cjs tests/*.mjs poster-adapter/tests/*.cjs\","
    },
    {
      "path": "docs/INTEGRATIONS.md",
      "line": 44,
      "keywords": "daily model output token tokens limit budget allowance gemini claude critique",
      "excerpt": "| Model generation | 16,384 requested output tokens per UTC day across Gemini, Iris Claude calls and hosted design critique. Each Claude design attempt reserves 8,192 and a Claude visual critique reserves 1,536. One studio plan or poster edit reserves 1,536, a new editable screen reserves 4,096, and a three-persona review reserves 3 × 384. |"
    },
    {
      "path": "docs/INTEGRATIONS.md",
      "line": 46,
      "keywords": "daily voice transcription speech session limits",
      "excerpt": "| ElevenLabs | 12 transcriptions, 24 speech requests and 4 signed session requests per day. |"
    },
    {
      "path": "docs/INTEGRATIONS.md",
      "line": 13,
      "keywords": "tracing traceroot telemetry span verification",
      "excerpt": "| TraceRoot | Trace typed questions from the studio bridge to Maritime | **Hosted ingestion verified.** The authenticated studio question returned trace ID `9afdee55e5187e9ae72b95311f8f603b`. TraceRoot Cloud returned HTTP 200 for GET `/api/v1/public/traces/9afdee55e5187e9ae72b95311f8f603b` with that ID and the operation `second-cursor.repo-question`. Earlier local export also passed. The decoded OTLP span for the browser request has trace ID `276cc6ab5eea066653801a543c681662`. [Span evidence](evidence/repo-question-trace.json) |"
    },
    {
      "path": "docs/INTEGRATIONS.md",
      "line": 10,
      "keywords": "fiber company research lookup",
      "excerpt": "| Fiber AI | Research the deployment partner and inform verification UI | Codevisor company lookup returned Maritime, YC ID `ycombinator_38061`. This informed the run ID, state and preview/log design. Studio runtime search also returned HTTP 200 for both name and domain filters. Chromium saved the maritime.sh result as a selected reference and confirmed it survived reload. [Lookup](evidence/partner-context.md) |"
    },
    {
      "path": "docs/INTEGRATIONS.md",
      "line": 14,
      "keywords": "expected parrot evaluation simulated personas",
      "excerpt": "| Expected Parrot | Grade answerable, ambiguous and outside-scope repo questions | **3/3 against deployed Wasp.** Local EDSL Survey and deterministic QuestionFunctional graded three real HTTP responses. The authenticated persona-review route also completed hosted EDSL inference with HTTP 200 and three simulated critiques covering purpose clarity, keyboard navigation and visual hierarchy. [Evaluation](evidence/repo-evaluation.json) |"
    }
  ]
};
