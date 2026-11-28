#!/usr/bin/env python3
"""릴스용 오르골 배경음 + 효과음을 코드로 만들어 WAV로 저장한다 (저작권 걱정 없음).

사용: python3 make_audio.py <출력.wav> <길이(초)> <이벤트 목록>
이벤트 목록: "시각:종류,시각:종류,..."  종류 = pop | whoosh | chime | ding | buzz | tick
"""
import sys, wave
import numpy as np

SR = 44100


def env(n, a=0.005, r=0.3):
    """짧게 올라갔다가 서서히 사라지는 소리 모양."""
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) * np.exp(-t / r)
    return e


def tone(f, dur, r=0.5, harm=(1, .35, .12)):
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = sum(h * np.sin(2 * np.pi * f * (i + 1) * t) for i, h in enumerate(harm))
    return s * env(n, r=r)


def music_box(total):
    """C장조 5음계 오르골 멜로디 + 낮은 화음. 4마디를 되풀이한다."""
    N = {'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'G4': 392.0, 'A4': 440.0,
         'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'G5': 783.99, 'A5': 880.0}
    mel = ['E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'C5', 'D5',
           'E5', 'G5', 'E5', 'D5', 'C5', 'A4', 'G4', 'A4',
           'C5', 'D5', 'E5', 'G5', 'A5', 'G5', 'E5', 'D5',
           'E5', 'D5', 'C5', 'D5', 'C5', 'G4', 'A4', 'G4']
    bass = ['C4', 'A4', 'D4', 'G4']  # 마디마다 한 음
    beat = 0.42
    out = np.zeros(int(SR * total) + SR)
    t = 0.0
    i = 0
    while t < total:
        m = mel[i % len(mel)]
        if m:
            s = tone(N[m], 1.2, r=0.45, harm=(1, .25, .08)) * 0.5
            k = int(t * SR)
            out[k:k + len(s)] += s[:len(out) - k]
        if i % 8 == 0:
            b = bass[(i // 8) % len(bass)]
            s = tone(N[b] / 2, 3.2, r=1.4, harm=(1, .2)) * 0.35
            k = int(t * SR)
            out[k:k + len(s)] += s[:len(out) - k]
        t += beat
        i += 1
    out = out[:int(SR * total)]
    fade = int(SR * 1.5)
    out[:fade] *= np.linspace(0, 1, fade)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out * 0.22


def sfx(kind):
    if kind == 'pop':      # 톡
        n = int(SR * .12); t = np.arange(n) / SR
        f = 900 - 500 * t / .12
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, a=.002, r=.04) * .6
    if kind == 'tick':     # 작은 톡
        return tone(1760, .15, r=.03, harm=(1,)) * .35
    if kind == 'whoosh':   # 휙 (걸러낸 잡음이 높아졌다 낮아짐)
        n = int(SR * .45); t = np.arange(n) / SR
        noise = np.random.default_rng(1).standard_normal(n)
        k = 40; sm = np.convolve(noise, np.ones(k) / k, mode='same')
        shape = np.sin(np.pi * t / .45) ** 2
        return (noise - sm) * shape * .25
    if kind == 'chime':    # 반짝 (높은 음 세 개가 차례로)
        out = np.zeros(int(SR * 1.6))
        for j, f in enumerate([1568, 2093, 2637, 3136]):
            s = tone(f, 1.2, r=.35, harm=(1, .3)) * .28
            k = int(SR * .07 * j)
            out[k:k + len(s)] += s[:len(out) - k]
        return out
    if kind == 'ding':     # 띵동 알림음
        out = np.zeros(int(SR * 1.2))
        for j, f in enumerate([1318.5, 1760]):
            s = tone(f, 1.0, r=.4, harm=(1, .4, .1)) * .45
            k = int(SR * .16 * j)
            out[k:k + len(s)] += s[:len(out) - k]
        return out
    if kind == 'buzz':     # 진동
        n = int(SR * .55); t = np.arange(n) / SR
        s = np.sign(np.sin(2 * np.pi * 150 * t)) * (0.5 + 0.5 * np.sin(2 * np.pi * 12 * t))
        return s * np.minimum(1, t / .02) * np.minimum(1, (t[-1] - t) / .05) * .08
    raise ValueError(kind)


def main():
    out_path, total, events = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    import os
    # NO_BGM=1 이면 배경음 없이 효과음만
    mix = np.zeros(int(SR * total)) if os.environ.get('NO_BGM') else music_box(total)
    for ev in events.split(','):
        at, kind = ev.split(':')
        s = sfx(kind)
        k = int(float(at) * SR)
        mix[k:k + len(s)] += s[:len(mix) - k]
    mix = mix / max(1.0, np.abs(mix).max() / 0.9)
    pcm = (mix * 32767).astype('<i2')
    st = np.repeat(pcm[:, None], 2, axis=1)
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(st.tobytes())


if __name__ == '__main__':
    main()
