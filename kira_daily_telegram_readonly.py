#!/usr/bin/env python3
"""Read-only Telegram diary collector for Kira Diary.

- Uses Ivan's explicitly authorized personal session only for this diary job.
- Does not send messages, click buttons, join chats, mark anything intentionally, or modify Telegram state.
- Adds a small random delay so the account is not touched at the exact same minute every day.
- Prints JSON for the Hermes cron agent to turn into a diary entry.
"""

import asyncio
import json
import random
import re
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from telethon import TelegramClient

API_ID = 2040
API_HASH = "b18441a1ff607e10a989891a5462e627"
SESSION = "/root/.hermes/telegram-user.session"
TZ = ZoneInfo("Asia/Yekaterinburg")

# Named core dialogs Ivan requested.
CORE_NAME_PATTERNS = [
    "ксеша", "ксения",
    "полина",
    "саша", "александра",
    "sugar", "mommy", "sugar mommy", "шугар", "вера",
]

# Recent dialogs are included to catch important people/events Ivan chatted with lately.
RECENT_DIALOG_LIMIT = 18
MAX_MESSAGES_PER_DIALOG = 150
MAX_TEXT_CHARS = 1200
# Safety cap for stdout/context size. Keep enough signal without dumping unlimited private chat.
MAX_TOTAL_MESSAGES = 950
# Max concurrent dialog scans to avoid Telegram flood bans.
CONCURRENCY_LIMIT = 5


def norm(s: str | None) -> str:
    s = (s or "").lower().replace("ё", "е")
    s = re.sub(r"[^a-zа-я0-9@_ ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def local_window_for_run(now: datetime):
    """Diary date = previous local day; include 00:00 that day → 04:00 next day."""
    today = now.date()
    target = today - timedelta(days=1)
    start = datetime(target.year, target.month, target.day, 0, 0, tzinfo=TZ)
    end = datetime(today.year, today.month, today.day, 4, 0, tzinfo=TZ)
    return target.isoformat(), start, end


def dialog_identity(dialog):
    ent = dialog.entity
    return " ".join([
        dialog.name or "",
        getattr(ent, "username", None) or "",
        getattr(ent, "first_name", None) or "",
        getattr(ent, "last_name", None) or "",
    ])


def is_core_dialog(dialog):
    txt = norm(dialog_identity(dialog))
    return any(p in txt for p in CORE_NAME_PATTERNS)


async def collect():
    # Random delay: default up to 35 minutes. Set KIRA_TG_NO_DELAY=1 for manual test runs.
    if not any(arg == "--no-delay" for arg in sys.argv):
        await asyncio.sleep(random.randint(90, 35 * 60))

    now = datetime.now(TZ)
    target_date, start, end = local_window_for_run(now)

    client = TelegramClient(
        SESSION,
        API_ID,
        API_HASH,
        device_model="P5K PRO",
        system_version="Windows 11 x64",
        app_version="5.12.3 x64",
        lang_code="en",
        system_lang_code="en-US",
    )
    await client.connect()
    try:
        if not await client.is_user_authorized():
            return {"ok": False, "error": "telegram session is not authorized", "target_date": target_date}

        me = await client.get_me()
        dialogs = []
        recent_count = 0
        seen = set()

        async for d in client.iter_dialogs(limit=None):
            key = getattr(d.entity, "id", None) or d.id
            core = is_core_dialog(d)
            include_recent = recent_count < RECENT_DIALOG_LIMIT
            if core or include_recent:
                if key not in seen:
                    dialogs.append((d, core, include_recent))
                    seen.add(key)
                if include_recent:
                    recent_count += 1
            # Continue a bit past recent dialogs so named archived dialogs are still found.

        out = {
            "ok": True,
            "mode": "read_only_telegram_diary_collect",
            "account": {"id": me.id, "username": me.username, "first_name": me.first_name},
            "target_date": target_date,
            "window": {"start": start.isoformat(), "end": end.isoformat(), "timezone": str(TZ)},
            "selection": {
                "core_patterns": CORE_NAME_PATTERNS,
                "recent_dialog_limit": RECENT_DIALOG_LIMIT,
                "note": "Includes explicitly named dialogs plus recent dialogs; no Telegram writes/actions are performed.",
            },
            "dialogs": [],
            "total_messages": 0,
        }

        # Shared mutable counter for parallel dialog scans.
        msg_counter = {"count": 0}
        sem = asyncio.Semaphore(CONCURRENCY_LIMIT)

        async def scan_dialog(d, core, recent):
            item = {
                "id": d.id,
                "name": d.name,
                "username": getattr(d.entity, "username", None),
                "type": type(d.entity).__name__,
                "selected_as": [x for x, flag in [("core_named", core), ("recent", recent)] if flag],
                "messages": [],
                "errors": [],
            }
            async with sem:
                try:
                    async for msg in client.iter_messages(d.entity, limit=MAX_MESSAGES_PER_DIALOG):
                        if msg_counter["count"] >= MAX_TOTAL_MESSAGES:
                            break
                        if not msg.date:
                            continue
                        local = msg.date.astimezone(TZ)
                        if local >= end:
                            continue
                        if local < start:
                            break
                        text = (msg.message or "").strip()
                        if not text and not msg.media:
                            continue
                        item["messages"].append({
                            "id": msg.id,
                            "date": local.isoformat(),
                            "time": local.strftime("%H:%M"),
                            "out": bool(msg.out),
                            "text": text[:MAX_TEXT_CHARS] if text else "[media]",
                            "has_media": bool(msg.media),
                        })
                        msg_counter["count"] += 1
                    item["messages"].sort(key=lambda x: x["date"])
                except Exception as e:
                    item["errors"].append(type(e).__name__ + ": " + str(e)[:220])
            return item if (item["messages"] or item["errors"] or core) else None

        tasks = [scan_dialog(d, core, recent) for d, core, recent in dialogs]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, dict):
                out["dialogs"].append(r)
        out["total_messages"] = msg_counter["count"]

        return out
    finally:
        await client.disconnect()


if __name__ == "__main__":
    result = asyncio.run(collect())
    print(json.dumps(result, ensure_ascii=False, indent=2))
