# Content tools

Lesson content lives in `content_src.py`: chapters (title, key points, keywords, narration), reading notes, quiz and practical task for each module.

`build_content.py` turns it into:
- `content/<code>.json`, which the app reads (transcript, search, quiz and so on)
- `assets/media/<code>-lesson.mp4`, the slide-based lesson video, with timestamps that match the transcript exactly
- `assets/media/<code>-poster.jpg`

## Add or edit a module

1. Install once: `pip install pillow`, plus ffmpeg on your PATH.
2. Edit `content_src.py`. The module code must match one in `js/seed.js` (e.g. `AVN-101`).
3. Run `python tools/build_content.py` from the project root.
4. Add the new `content/<code>.json` to the `SHELL` list in `sw.js` and bump `VERSION`.

Videos are **not** in the `SHELL` list on purpose. Trainees download them per module with "Download for offline".

## Real lecture videos (Phase B)

Replace the generated mp4 with a recorded lecture and set each chapter's `start` in the JSON to where that topic begins. Search, transcript sync and confusion flags keep working unchanged.
