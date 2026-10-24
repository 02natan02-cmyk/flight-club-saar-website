import math, struct, wave, random, sys
def song(bpm, dur, out, sr=44100, lead=0.37):
    random.seed(1); n=int(dur*sr); p=60/bpm; buf=[0.0]*n
    def add(t0, f, d, amp, decay, noise=False):
        i0=int(t0*sr)
        for k in range(int(d*sr)):
            i=i0+k
            if i>=n: break
            t=k/sr; e=math.exp(-decay*t)
            s=(random.uniform(-1,1) if noise else math.sin(2*math.pi*f*t*(1+ (0.6*math.exp(-30*t) if not noise and f<100 else 0))))
            buf[i]+=amp*e*s
    b=0; t=lead
    while t<dur:
        add(t,52,0.35,0.9 if b%4==0 else 0.7,9)          # Kick
        if b%2==1: add(t,0,0.12,0.35,30,True)            # Snare/Clap
        add(t+p/2,0,0.04,0.12,80,True)                   # Hihat
        add(t,110*(1 if (b//4)%2==0 else 1.335),p*0.9,0.18,3) # Bass
        b+=1; t=lead+b*p
    m=max(abs(x) for x in buf) or 1
    w=wave.open(out,'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(b''.join(struct.pack('<hh',int(x/m*28000),int(x/m*28000)) for x in buf)); w.close()
song(float(sys.argv[1]), float(sys.argv[2]), sys.argv[3])
