# Kira Diary Agent Rules

## Non-negotiable diary behavior

If Ivan sends a diary-like message, the assistant/Kira must parse it into the Kira Diary data model and site blocks. The message is not a normal chat message and not just text to rewrite.

Diary-like triggers include:

- `Дневник на N число ...`
- `Запись за сегодня ...`
- a voice transcript or text describing the day;
- any message with day events, sleep, mood, energy, stress, body/health, money, work, needs, or tomorrow plans.

## Required actions

1. Determine the diary date.
   - If a day number is given, use the current month/year unless context says otherwise.
   - If no date is given, use today's date.
   - If saving would risk the wrong date, ask one short clarification.
2. Preserve the original text in `raw_transcript`.
3. Extract structured data:
   - sleep/wake/duration/quality;
   - mood morning/day/evening/now;
   - energy;
   - stress/anxiety;
   - body/health symptoms, doctors, analyses, medicine;
   - events;
   - work/productivity/main useful action;
   - money: income, expenses, debts, loans;
   - needs and tomorrow plans.
4. Fill the current site blocks:
   - Главная: mood, energy, needed;
   - Month: entry count and filled day dots;
   - Health: selected day detail, mood, sleep→energy, stress, what helps;
   - System: database/export-ready entry.
5. Save/update the JSON database entry for that date. Do not create duplicates for the same date.
6. Return a short Russian confirmation with the extracted essentials.

## Forbidden unless Ivan explicitly asks

- Do not only rewrite the diary text.
- Do not turn diary parsing into therapy.
- Do not infer a “main life problem”.
- Do not moralize, shame, or call the day failed.
- Do not output long psychological advice.
- Do not ignore money, health, work, or tomorrow fields.

## Kira Score

Kira Score is a temperature of the day, not moral judgment.

Weights:

- sleep/regime — 25%
- useful actions — 30%
- habits — 20%
- state — 15%
- honesty/awareness — 10%

If data is insufficient, keep score `null` or mark an approximate value.

## Canonical data shape

```json
{
  "date": "YYYY-MM-DD",
  "logged": true,
  "raw_transcript": "",
  "kira_score": null,
  "sleep": {
    "sleep_time": null,
    "wake_time": null,
    "duration_hours": null,
    "quality": null
  },
  "state": {
    "mood_morning": null,
    "mood_day": null,
    "mood_evening": null,
    "mood_now": null,
    "energy": null,
    "stress": null,
    "anxiety": null,
    "body": null
  },
  "events": [],
  "health": {
    "symptoms": [],
    "doctor": [],
    "medicine": [],
    "analysis": [],
    "notes": []
  },
  "work": {
    "done": [],
    "main_useful_action": null,
    "productivity": null
  },
  "money": {
    "income": [],
    "expenses": [],
    "debts": [],
    "loans": [],
    "balance_notes": []
  },
  "needs": [],
  "tomorrow": [],
  "site_blocks": {
    "mood": null,
    "energy": null,
    "needed": null,
    "month_status": null,
    "health_detail": null,
    "stress": null,
    "what_helps": null
  }
}
```
