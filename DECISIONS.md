# Decisions and problems log

Append entries as the build proceeds (see CLAUDE.md). This file feeds docs/DESIGN_DECISIONS.md at sign-off.

## 2026-10-21: Free-tier LLM providers behind one interface
**Context:** No budget for paid LLM APIs; free tiers are rate-limited and free models are less reliable at structured JSON.
**Decision:** One `LLMProvider` interface over OpenAI-compatible endpoints (Groq, OpenRouter, Gemini) with ordered fallback.
**Alternatives:** Single provider; local Ollama only.
**Consequence:** Swappable providers and resilience to rate limits, at the cost of extra code and provider-specific quirks.
