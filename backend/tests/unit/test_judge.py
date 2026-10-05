from __future__ import annotations

from kb.evaluation.judge import FakeJudge, claims_of, is_refusal
from kb.generation.answerer import NO_ANSWER_TEXT


async def test_fake_judge_scores_key_facts_and_faithfulness() -> None:
    judge = FakeJudge()
    sources = ["The approved Q3 marketing budget is $420,000, approved on July 2 by the CFO."]
    good = await judge.judge(
        "q",
        "$420,000 on July 2",
        ["420,000", "July 2"],
        "According to the sources: The approved Q3 marketing budget is $420,000, approved on July 2 [1].",
        sources,
    )
    assert good.correctness == 5
    assert good.faithfulness == 1.0
    partial = await judge.judge("q", None, ["420,000", "July 2"], "The budget is $420,000 [1].", sources)
    assert partial.correctness == 3
    unsupported = await judge.judge(
        "q",
        None,
        ["420,000"],
        "The budget is $420,000 and covers yachts in Monaco [1].",
        ["Something unrelated entirely about parking."],
    )
    assert unsupported.faithfulness < 1.0


async def test_refusal_gets_lowest_correctness() -> None:
    verdict = await FakeJudge().judge("q", "x", ["x"], NO_ANSWER_TEXT, [])
    assert verdict.correctness == 1
    assert is_refusal(NO_ANSWER_TEXT)


def test_claims_ignore_boilerplate_and_citations() -> None:
    assert claims_of("According to the sources: The budget is large [1]. Ok.") == ["The budget is large"]
