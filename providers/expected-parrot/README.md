# Expected Parrot simulated design review

This integration submits a real EDSL survey with three simulated reviewer personas to Expected Parrot hosted execution. It reviews supplied content and the design plan. It does not claim to perform a visual browser audit or to collect feedback from humans.

The Node bridge exports `createExpectedParrotReviewer` and `ExpectedParrotError` from `index.mjs`.

```js
const reviewer = createExpectedParrotReviewer();
reviewer.status(); // configured, runtimeReady, provider, model; no secrets
const result = await reviewer.review({ brief, htmlSummary, plan, references, signal });
// result.reviews: [{persona, critique}], simulated: true, basis, model, reviewedAt
```

Run through an authenticated server endpoint. Do not put provider credentials in browser code or query parameters.

## Setup

The pinned official EDSL revision supports Python 3.10–3.13. Python 3.14 is not supported by its declared package requirements. From the repository root:

```sh
python3.13 -m venv providers/expected-parrot/.venv
providers/expected-parrot/.venv/bin/python -m pip install -r providers/expected-parrot/requirements.txt
providers/expected-parrot/.venv/bin/python providers/expected-parrot/review.py --check
```

The dependency check builds an actual EDSL survey and its three personas without submitting a job or requiring a key.

In the server's ignored `.env`, configure `EXPECTED_PARROT_API_KEY`. Optional settings are `EXPECTED_PARROT_MODEL` (default `gpt-4o-mini`) and `EXPECTED_PARROT_PYTHON` (absolute executable path; defaults to the adjacent `.venv/bin/python`). Model availability and sufficient inference credits must be verified on the user's Expected Parrot account. A key belonging to another service does not automatically grant Expected Parrot access.

Each invocation sends one bounded design scenario to three simulated personas. It may use inference credits. Results remain explicitly labeled as simulated. Missing credentials/runtime, quota failures, malformed results, cancellation and timeouts produce errors rather than substitute reviews.

The bridge never invokes a shell, passes keys on command-line arguments, forwards Python stderr, or returns raw provider errors. Temporary EDSL cache/config files are removed after each job. Cancellation terminates the local client; a hosted job already submitted may continue at Expected Parrot and incur its normal cost.

## Verification

```sh
node --test tests/expected-parrot.test.mjs
```

Official references used for the integration:

- https://docs.expectedparrot.com/llms.txt
- https://docs.expectedparrot.com/en/latest/api_keys.md
- https://docs.expectedparrot.com/en/latest/remote_inference.md
- https://github.com/expectedparrot/edsl

No live paid survey should be reported as verified until an actual configured account successfully returns its three reviews.
