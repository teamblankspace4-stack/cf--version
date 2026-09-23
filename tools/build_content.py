import json, os, subprocess, math, shutil, tempfile
from PIL import Image, ImageDraw, ImageFont
from content_src import CONTENT

import pathlib
HERE = pathlib.Path(__file__).resolve().parent
APP = str(HERE.parent)
os.makedirs(f"{APP}/content", exist_ok=True)
os.makedirs(f"{APP}/assets/media", exist_ok=True)
W, H = 1280, 720
NAVY=(14,42,71); TEAL=(31,163,163); MUTED=(169,188,207); SOFT=(221,231,240); WHITE=(255,255,255)
F = lambda w, s: ImageFont.truetype(str(HERE / f"plex-{w}.ttf"), s)

def wrap(draw, text, font, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= width: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def mmss(s): return f"{int(s)//60}:{int(s)%60:02d}"

def slide(code, vtitle, i, n, ch, starts, total, path):
    im = Image.new("RGB", (W, H), NAVY); d = ImageDraw.Draw(im)
    # faint isobars
    for k, r in enumerate([420, 330, 240, 150]):
        cx, cy = 1180 - k*10, 700 + k*8
        d.ellipse([cx-r, cy-int(r*.88), cx+r, cy+int(r*.88)], outline=(24,76,98), width=2)
    d.text((80, 60), f"{code}  |  {vtitle}", font=F(400, 24), fill=MUTED)
    t = f"Part {i+1} of {n}"; d.text((W-80-d.textlength(t, font=F(600,24)), 60), t, font=F(600, 24), fill=TEAL)
    y = 170
    for line in wrap(d, ch["title"], F(700, 58), 1000):
        d.text((80, y), line, font=F(700, 58), fill=WHITE); y += 72
    d.rectangle([80, y+18, 200, y+24], fill=TEAL); y += 70
    for p in ch["points"]:
        lines = wrap(d, p, F(400, 34), 980)
        d.rectangle([80, y+22, 104, y+26], fill=TEAL)
        for j, line in enumerate(lines):
            d.text((128, y), line, font=F(400, 34), fill=SOFT); y += 46
        y += 18
    # chapter progress bar
    bx, by, bw = 80, 640, W-160
    d.rectangle([bx, by, bx+bw, by+6], fill=(36,70,107))
    x0 = bx + bw*starts[i]/total; x1 = bx + bw*(starts[i+1] if i+1 < len(starts) else total)/total
    d.rectangle([x0, by, x1, by+6], fill=TEAL)
    d.text((80, 660), "Capacity Connect  |  IMD training", font=F(400, 20), fill=MUTED)
    tt = f"{mmss(starts[i])}"; d.text((W-80-d.textlength(tt, font=F(400,20)), 660), tt, font=F(400, 20), fill=MUTED)
    im.save(path, quality=92)

manifest = {}
for code, c in CONTENT.items():
    slug = code.lower()
    chs = c["chapters"]
    durs = [max(18, round(len(ch["text"].split()) / 2.4) + 3) for ch in chs]
    starts = [sum(durs[:i]) for i in range(len(durs))]; total = sum(durs)
    tmp = pathlib.Path(tempfile.gettempdir(), f"slides-{slug}").as_posix(); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    lines = []
    for i, ch in enumerate(chs):
        p = f"{tmp}/s{i}.png"; slide(code, c["video_title"], i, len(chs), ch, starts, total, p)
        lines += [f"file '{p}'", f"duration {durs[i]}"]
    lines.append(f"file '{tmp}/s{len(chs)-1}.png'")
    open(f"{tmp}/list.txt", "w").write("\n".join(lines))
    out = f"{APP}/assets/media/{slug}-lesson.mp4"
    subprocess.run(["ffmpeg","-y","-loglevel","error","-f","concat","-safe","0","-i",f"{tmp}/list.txt",
        "-vf","fps=2,scale=960:540,format=yuv420p","-c:v","libx264","-preset","veryslow","-tune","stillimage","-crf","30",
        "-g","20","-movflags","+faststart","-an", out], check=True)
    Image.open(f"{tmp}/s0.png").convert("RGB").resize((960,540)).save(f"{APP}/assets/media/{slug}-poster.jpg", quality=70)

    units = [{"order": 1, "type": "video", "title": f"{code}: core lesson",
              "video": f"assets/media/{slug}-lesson.mp4", "poster": f"assets/media/{slug}-poster.jpg",
              "duration": total,
              "chapters": [{"start": starts[i], "end": starts[i]+durs[i], **{k: ch[k] for k in ("title","points","keywords","text")}} for i, ch in enumerate(chs)]},
             {"order": 2, "type": "reading", "title": c["reading"]["title"], "html": c["reading"]["html"]},
             {"order": 3, "type": "quiz", "title": "Check your understanding", "passMark": 70, "questions": c["quiz"]}]
    if c["practical"]:
        units.append({"order": 4, "type": "practical", **c["practical"]})
    json.dump({"code": code, "units": units}, open(f"{APP}/content/{slug}.json", "w"), ensure_ascii=False, indent=1)
    size = os.path.getsize(out)
    manifest[code] = {"file": f"content/{slug}.json", "media": [f"assets/media/{slug}-lesson.mp4", f"assets/media/{slug}-poster.jpg"], "videoBytes": size}
    print(f"{code}: {len(chs)} chapters, {total}s ({mmss(total)}), video {size/1024:.0f} KB, starts {starts}")
json.dump(manifest, open(f"{APP}/content/index.json", "w"), indent=1)
