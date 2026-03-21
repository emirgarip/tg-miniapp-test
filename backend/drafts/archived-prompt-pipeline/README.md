# Archived: Full Prompt-Generation Pipeline

**Archived on:** 2026-03-20  
**Status:** Not active — preserved for future reference

## What this was

This directory contains the complete multi-stage AI prompt-generation pipeline that was the
first version of the Telegram Mini App. It accepted free-text model descriptions and produced
structured, production-quality image generation prompts in 5 stages.

## Pipeline stages

| File | Stage | Description |
|---|---|---|
| `prompt-config.js` | Config | Extraction + interpretation system prompts, defaults, negative prompt |
| `extractor.js` | A | LLM call #1: extract explicit attributes from user text (gpt-4.1-mini) |
| `interpreter.js` | B | LLM call #2: map extraction to visual intent categories with confidence |
| `normalizer.js` | B2 | Sync: fill defaults, tag every value with source ("user" / "auto") |
| `planner.js` | C | Sync: deterministic framing / pose / composition decisions |
| `blockBuilder.js` | D | Sync: generate 13 named prompt blocks with tone/realism/detail awareness |
| `assembler.js` | E | Sync: join blocks into final prompt + build UI summary strings |

## Why it was archived

The app pivoted to a simpler **Base Model Creator** phase:
- Only extract and normalize physical model attributes
- Output a structured JSON (no prompt generation)
- Inspect the base model profile before adding pose/environment/scenario layers later

## To reactivate

1. Restore files from this directory to `backend/pipeline/`
2. Restore the original `api/test/openai-prompt.js` endpoint logic
3. Re-link `frontend/app.js` to consume the full pipeline response shape

The Gemini draft is still at `backend/drafts/gemini-prompt.js` and uses the same pipeline.
