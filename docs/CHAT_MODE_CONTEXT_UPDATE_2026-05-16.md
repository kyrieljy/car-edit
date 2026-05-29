# Chat Mode Context Update 2026-05-16

Last condensed: 2026-05-29 Asia/Shanghai

This historical note has been merged into `CHAT_MODE_STRATEGY_GUIDE.md`. Keep this file only as a pointer for old references.

Durable decisions from that update:

- Empty text is allowed only when there is a usable vehicle canvas and uploaded part reference intent.
- Empty text remains rejected for text-only, vehicle-only, part-only, or ambiguous existing-session requests.
- After a session has a real generated result, later ready-to-generate requests without a newly uploaded vehicle image must ask whether to use `original` or `latest`.
- If the user uploads a new vehicle image in the current request, that image is treated as the new canvas.

Use `CHAT_MODE_STRATEGY_GUIDE.md` for current maintenance.
