"""Run with providers/expected-parrot/.venv/bin/python providers/expected-parrot/repo_eval.py [--origin URL]."""
import argparse
import json
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path

import requests
from dotenv import dotenv_values
from edsl import Model, QuestionFunctional, Scenario, Survey

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "docs/evidence/repo-evaluation.json"
LIVE = "https://1e4878ee-23cb-40bb-8140-c0ccfc27889f.mtm.sh"
LOCAL = "http://127.0.0.1:3102"
COMMIT = "ce329d24c1163f708ab86a0f5378baee39b899ad"
CASES = {
    "answerable": "Which command starts the studio locally?",
    "ambiguous": "How does it work?",
    "outside": "Which command starts facebook/react?",
}


def grade(scenario, agent_traits):
    body = scenario["response"]
    if scenario["http_status"] != 200 or body.get("repo") != "Festyve/iris":
        return False
    if body.get("commit") != scenario["expected_commit"]:
        return False
    answer = body.get("answer")
    if not isinstance(answer, str):
        return False
    if scenario["case"] == "answerable":
        citation = {"path": "README.md", "line": 10, "commit": scenario["expected_commit"]}
        return (body.get("status") == "answered" and answer == "npm start"
                and body.get("citations") == [citation])
    if body.get("citations") != []:
        return False
    if scenario["case"] == "ambiguous":
        return (body.get("status") == "clarification" and answer.endswith("?")
                and "studio" in answer.lower() and "references" in answer.lower())
    return (body.get("status") == "out_of_scope"
            and "approved second cursor project snapshot only" in answer.lower())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", choices=[LIVE, LOCAL], default=LIVE)
    endpoint = parser.parse_args().origin + "/studio-api/repo/question"
    token = dotenv_values(ROOT / ".env", interpolate=False).get("REPO_QUESTION_TOKEN")
    if not token:
        parser.exit(2, "Missing REPO_QUESTION_TOKEN in the root .env\n")

    cases = []
    scenarios = []
    with requests.Session() as session:
        session.trust_env = False
        session.headers["Authorization"] = "Bearer " + token
        for case, question in CASES.items():
            response = session.post(endpoint, json={"question": question}, timeout=20,
                                    allow_redirects=False)
            if token in response.text:
                raise ValueError("Credential reflected in response")
            try:
                body = response.json()
            except requests.exceptions.JSONDecodeError:
                raise SystemExit(f"{case}: HTTP {response.status_code} returned non-JSON")
            if not isinstance(body, dict):
                raise SystemExit(f"{case}: HTTP {response.status_code} expected a JSON object")
            row = dict(case=case, question=question, http_status=response.status_code, response=body)
            cases.append(row)
            scenarios.append(Scenario(dict(row, expected_commit=COMMIT)))

    rubric = QuestionFunctional(question_name="passes", func=grade)
    results = Survey([rubric]).by(scenarios).by(Model("test")).run(
        disable_remote_inference=True, disable_remote_cache=True, cache=False,
        progress_bar=False, stop_on_exception=True,
    )
    grades = {r.data["scenario"]["case"]: r.data["answer"]["passes"] for r in results}
    if len(results) != len(CASES) or grades.keys() != CASES.keys():
        raise RuntimeError("Incomplete EDSL results")
    for row in cases:
        score = grades[row["case"]]
        if not isinstance(score, bool):
            raise RuntimeError("Expected a boolean EDSL rubric result")
        row["passed"] = score
    passed = sum(grades.values())
    report = {
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "endpoint": endpoint, "method": "POST", "edsl_version": version("edsl"),
        "mechanism": "Local EDSL Survey with one restricted-Python QuestionFunctional "
                     "applied to three HTTP-response Scenarios. Deterministic rubric, "
                     "EDSL test model selected for offline job setup. QuestionFunctional "
                     "computes each grade directly. Remote inference and caches disabled.",
        "passed": passed, "total": len(cases), "cases": cases,
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(f"{passed}/{len(cases)} passed against {endpoint}")
    return int(passed != len(cases))


if __name__ == "__main__":
    raise SystemExit(main())
