"""Rain — oh. Original score/synthesis; no reference audio or sampled instruments.
Rebuild: python -m pip install numpy scipy imageio-ffmpeg; python scripts/compose-rain.py
"""
from pathlib import Path
import json
import subprocess
import tempfile
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io.wavfile import write
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
SR, BPM, BARS = 32000, 74, 32
BEAT = 60 / BPM
N = round(BARS * 4 * BEAT * SR)
rng = np.random.default_rng(20260922)
dry = np.zeros((N, 2), np.float32)
send = np.zeros_like(dry)


def filt(signal, hz, kind="lowpass"):
    return sosfilt(butter(2, hz, fs=SR, btype=kind, output="sos"), signal).astype(np.float32)


def place(sound, beat, gain, pan=0, wet=0.2):
    start = round(beat * BEAT * SR) % N
    stereo = sound[:, None] * np.array([np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)]) * gain
    for offset in range(0, len(sound), N):
        part = stereo[offset:offset + N]
        first = min(len(part), N - start)
        dry[start:start + first] += part[:first]
        send[start:start + first] += part[:first] * wet
        if first < len(part):
            dry[:len(part) - first] += part[first:]
            send[:len(part) - first] += part[first:] * wet


def keys(midi, duration, velocity=0.7, bell=False):
    t = np.arange(round((duration + 2.4) * SR), dtype=np.float32) / SR
    f = 440 * 2 ** ((midi - 69) / 12)
    # Damped tine FM, warm fundamental, slight slow pitch drift, rounded hammer.
    phase = 2 * np.pi * f * t + 0.004 * np.sin(2 * np.pi * 0.7 * t)
    tone = np.sin(phase + (0.42 if bell else 0.23) * velocity * np.exp(-t / 0.6) * np.sin(phase * 3.002))
    tone += 0.18 * np.sin(phase * 2.001) * np.exp(-t / 0.7)
    tone += 0.08 * np.sin(phase * 4.003) * np.exp(-t / 0.22)
    envelope = (1 - np.exp(-t / 0.012)) * np.exp(-t / (1.65 if bell else 2.8))
    envelope *= np.exp(-np.maximum(0, t - duration) / 0.4)
    return filt(tone * envelope, 3300 if bell else 2600)


def bass(midi, duration):
    t = np.arange(round(duration * SR), dtype=np.float32) / SR
    phase = 2 * np.pi * 440 * 2 ** ((midi - 69) / 12) * t
    env = (1 - np.exp(-t / 0.022)) * np.minimum(1, (duration - t) / 0.15) * np.exp(-t / 2)
    return (np.sin(phase) + 0.2 * np.sin(2 * phase) + 0.04 * np.sin(3 * phase)) * env


def percussion(kind):
    length = {"kick": 0.38, "brush": 0.25, "hat": 0.095}[kind]
    t = np.arange(round(length * SR), dtype=np.float32) / SR
    noise = rng.normal(0, 1, len(t)).astype(np.float32)
    if kind == "kick":
        phase = 2 * np.pi * (48 * t + 40 * 0.028 * (1 - np.exp(-t / 0.028)))
        return np.sin(phase) * (1 - np.exp(-t / 0.003)) * np.exp(-t / 0.085)
    if kind == "brush":
        body = np.sin(2 * np.pi * 175 * t) * np.exp(-t / 0.033) * 0.2
        texture = filt(filt(noise, 700, "highpass"), 3200)
        return (texture * 0.7 + body) * (1 - np.exp(-t / 0.007)) * np.exp(-t / 0.047)
    texture = filt(filt(noise, 3800, "highpass"), 6900)
    return texture * (1 - np.exp(-t / 0.0015)) * np.exp(-t / 0.019)


# Db major / Bb minor: common jazz harmony, independently voiced and sequenced.
# Each chord lasts one bar. Final Ab13 resolves naturally to the opening Dbmaj9.
chords = [
    (37, [53, 60, 63, 68], "Dbmaj9"), (34, [53, 56, 60, 65], "Bbm9"),
    (39, [54, 58, 61, 65], "Ebm9"), (32, [54, 60, 65, 70], "Ab13"),
    (41, [56, 60, 63, 67], "Fm9"), (34, [56, 62, 66, 72], "Bb7(b13)"),
    (39, [54, 58, 61, 65], "Ebm9"), (32, [54, 60, 65, 70], "Ab13"),
    (42, [53, 56, 61, 65], "Gbmaj9"), (41, [51, 56, 60, 63], "Fm7"),
    (39, [54, 58, 61, 65], "Ebm9"), (32, [54, 60, 65, 70], "Ab13"),
    (37, [53, 58, 63, 68], "Db6/9"), (34, [56, 62, 66, 72], "Bb7(b13)"),
    (39, [54, 58, 61, 65], "Ebm9"), (32, [54, 60, 65, 70], "Ab13"),
]
# Original sparse motif, played only in selected bars; no transcription of Lee.
motifs = {
    4: [(0.5, 77, 0.9), (2.25, 75, 0.65), (3.25, 72, 0.7)],
    5: [(1.25, 70, 1.3), (3, 68, 0.7)],
    6: [(0.75, 70, 0.65), (2, 73, 1.4)],
    7: [(1.25, 72, 0.8), (2.75, 70, 0.6)],
    8: [(0.5, 73, 1.5), (2.75, 77, 0.8)],
    9: [(1.25, 75, 0.8), (2.5, 72, 1.1)],
    10: [(0.75, 70, 1.8)],
    11: [(2, 68, 1.0), (3.25, 70, 0.6)],
    12: [(0.75, 73, 2.1)],
    20: [(0.5, 77, 1.2), (2.25, 80, 0.7), (3.25, 75, 0.7)],
    21: [(1.25, 74, 1.4)], 22: [(0.75, 73, 0.8), (2.25, 70, 1.2)],
    23: [(1, 72, 1), (2.75, 70, 0.8)],
    24: [(0.5, 77, 1.2), (2.5, 73, 1.0)],
    25: [(0.75, 75, 1), (2.25, 72, 1.4)],
    26: [(1, 70, 2)], 27: [(2.25, 68, 1)], 28: [(0.75, 73, 2.4)],
}
for bar in range(BARS):
    root, notes, _ = chords[bar % 16]
    start = bar * 4
    for j, note in enumerate(notes):
        place(keys(note, 2.2), start + 0.035 * j + rng.uniform(-0.009, 0.009),
              0.068 * rng.uniform(0.87, 1.06), (j - 1.5) * 0.16, 0.32)
    if bar % 4 in (1, 3) and bar < 29:
        for j, note in enumerate(notes[1:]):
            place(keys(note, 0.8, 0.45), start + 2.65 + j * 0.025,
                  0.032, (j - 1) * 0.22, 0.3)
    place(bass(root, BEAT * 2.5), start + 0.012, 0.14, 0, 0.03)
    if bar > 2 and bar < 29:
        place(bass(root + (7 if bar % 2 == 0 else 12), BEAT * 0.55), start + 3.3, 0.055, 0, 0.03)
    # Intro/outro breathe; the rhythmic section enters gradually.
    level = 0.35 if bar < 4 or bar >= 28 else 1.0
    for beat in [0, 2.65] + ([3.4] if bar % 4 == 3 else []):
        place(percussion("kick"), start + beat + rng.uniform(-0.012, 0.012), 0.11 * level, 0, 0.015)
    for beat in [1.025, 3.03]:
        place(percussion("brush"), start + beat, 0.105 * level, -0.13, 0.12)
    for eighth in range(8):
        beat = (eighth // 2) + (0.58 if eighth % 2 else 0)
        place(percussion("hat"), start + beat + rng.uniform(-0.009, 0.009),
              0.035 * level * (0.65 if eighth % 2 else 1), 0.27, 0.05)
    for beat, note, duration in motifs.get(bar, []):
        place(keys(note, duration, 0.6, True), start + beat + 0.025,
              0.052, -0.12 + (bar % 3) * 0.12, 0.48)

# Stereo room tail and gentle eighth-note echoes wrap across the loop boundary.
mix = dry.copy()
for ch in range(2):
    t = np.arange(int(SR * 2.4), dtype=np.float32) / SR
    impulse = filt(rng.normal(0, 1, len(t)).astype(np.float32), 2300) * np.exp(-t / 0.48)
    impulse[:int(0.027 * SR)] = 0
    impulse *= 0.13 / np.sqrt(np.sum(impulse ** 2))
    tail = fftconvolve(send[:, ch], impulse)
    mix[:, ch] += tail[:N]
    mix[:len(tail) - N, ch] += tail[N:]
    mix[:, ch] += np.roll(send[:, 1 - ch], round(BEAT * (0.75 + ch * 0.015) * SR)) * 0.22
    mix[:, ch] = filt(filt(mix[:, ch], 32, "highpass"), 7200)
mix = np.tanh(mix * 1.3)
mix -= mix.mean(axis=0)
mix *= 0.105 / np.sqrt(np.mean(mix ** 2))
# A tiny boundary bridge removes filter start-up clicks without a musical fade.
bridge = int(0.005 * SR)
mix[:bridge] += (mix[-1] - mix[0]) * np.linspace(1, 0, bridge)[:, None]
assert np.max(np.abs(mix)) < 0.95

out = ROOT / "public" / "audio"
out.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix="rain-score-") as temp:
    wav = Path(temp) / "rain.wav"
    write(wav, SR, (mix * 32767).astype(np.int16))
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "160k",
        "-metadata", "title=Rain", "-metadata", "artist=oh", "-metadata", "album=Rain Window",
        str(out / "oh-rain.mp3")], check=True)

report = {"title": "Rain", "artist": "oh", "bpm": BPM, "bars": BARS,
          "seconds": N / SR, "sampleRate": SR, "peak": float(np.max(np.abs(mix))),
          "rms": float(np.sqrt(np.mean(mix ** 2))), "boundaryJump": float(np.max(np.abs(mix[0] - mix[-1]))),
          "chords": [chord[2] for chord in chords], "seed": 20260922,
          "externalSamples": False}
(out / "score.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
