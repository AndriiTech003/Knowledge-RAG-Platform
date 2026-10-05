from __future__ import annotations

from kb.providers.llms.base import LlmMessage, collect
from kb.providers.llms.fake import FakeLlm, fake_answer, fake_condense


def test_fake_answer_cites_relevant_sentences() -> None:
    prompt = (
        '<sources>\n<source n="1" title="Travel" section="Per diem" page="4">The per diem in Europe is €65 per day. '
        "Meals are included.</source>\n"
        '<source n="2" title="Wifi" section="" page="1">The guest network is NW-Guest.</source>\n</sources>\n'
        "Question: What is the per diem in Europe?"
    )
    answer = fake_answer(prompt)
    assert "€65" in answer
    assert "[1]" in answer
    assert "NW-Guest" not in answer


def test_fake_answer_without_relevant_sources() -> None:
    prompt = (
        '<sources>\n<source n="1" title="X">Cats are cute.</source>\n</sources>\nQuestion: per diem Europe?'
    )
    assert "could not find" in fake_answer(prompt)


def test_fake_condense_rewrites_follow_up_with_history() -> None:
    prompt = (
        "<history>\nuser: What is the daily per diem for business travel in the US?\n"
        "assistant: The US per diem is $75 per day [1].\n</history>\nFollow-up question: And for Europe?"
    )
    condensed = fake_condense(prompt)
    assert "Europe" in condensed
    assert "per diem" in condensed
    assert "US" not in condensed.split()


def test_fake_condense_keeps_standalone_question() -> None:
    prompt = "<history>\nuser: hi\n</history>\nFollow-up question: What is the parental leave policy for fathers in Berlin?"
    assert fake_condense(prompt) == "What is the parental leave policy for fathers in Berlin?"


async def test_fake_llm_streams_tokens_and_usage() -> None:
    llm = FakeLlm(script="Hello world from the fake model.")
    result = await collect(llm.stream("sys", [LlmMessage(role="user", content="hi")], 100))
    assert result.text == "Hello world from the fake model."
    assert result.usage.output_tokens > 0
    assert result.usage.input_tokens > 0
