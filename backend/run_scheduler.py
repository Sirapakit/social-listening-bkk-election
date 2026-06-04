"""Standalone scheduler entrypoint for Docker Compose."""
from __future__ import annotations

import asyncio

import db
import scheduler


async def main() -> None:
    db.init()
    scheduler.start()
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())