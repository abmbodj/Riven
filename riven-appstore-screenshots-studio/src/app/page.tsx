/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";

const LOCALES = ["en"] as const;
type Locale = (typeof LOCALES)[number];

const IPHONE_SIZES = [
  { label: '6.9"', w: 1320, h: 2868 },
  { label: '6.5"', w: 1284, h: 2778 },
  { label: '6.3"', w: 1206, h: 2622 },
  { label: '6.1"', w: 1125, h: 2436 },
] as const;

const THEMES = {
  riven: {
    id: "riven",
    bg: "#162a31",
    surface: "#1e3840",
    text: "#e4ddd0",
    secondary: "#8fa6a8",
    border: "#233e46",
    accent: "#deb96a",
  },
} as const;

const SLIDES = [
  { headline: "Flashcards that stick.", subhead: "Spaced repetition, tracked." },
  { headline: "AI syllabus. Canvas LMS synced.", subhead: "Turn class content into ready-to-study decks." },
  { headline: "Never missing an assignment again.", subhead: "Deadlines tracked automatically so you stay on top." },
  { headline: "Your semester, organized.", subhead: "Classes + assignments with Canvas/iCal sync." },
  { headline: "Cram together--live.", subhead: "Shared decks. Synchronized group sessions." },
  { headline: "Streaks. Garden. Momentum.", subhead: "Daily streaks + your virtual garden/pet." },
  { headline: "AI decks. Quizzes. Progress.", subhead: "Standard + Test modes with instant feedback." },
  { headline: "Keep your momentum.", subhead: "Streaks, reminders, and study plans that stick." },
] as const;

const PHONE_SCREEN_BY_SLIDE = [
  "/phone-screens/IMG_0757.PNG",
  "/phone-screens/IMG_0758.PNG",
  "/phone-screens/IMG_0759.PNG",
  "/phone-screens/IMG_0760.PNG",
  "/phone-screens/IMG_0761.PNG",
  "/phone-screens/IMG_0762.PNG",
  "/phone-screens/IMG_0763.PNG",
  "/phone-screens/IMG_0764.PNG",
] as const;

const MOCKUP = { mkW: 1022, mkH: 2082 };
const SC_L = (52 / MOCKUP.mkW) * 100; // screen left offset %
const SC_T = (46 / MOCKUP.mkH) * 100; // screen top offset %
const SC_W = (918 / MOCKUP.mkW) * 100; // screen width %
const SC_H = (1990 / MOCKUP.mkH) * 100; // screen height %
const SC_RX = (126 / 918) * 100; // screen border radius x %
const SC_RY = (126 / 1990) * 100; // screen border radius y %

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function splitHeadline(headline: string) {
  const words = headline.split(" ");
  const lines: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    const next = [...current, word].join(" ");
    if (current.length >= 5 || (current.length >= 3 && next.length > 22)) {
      lines.push(current.join(" "));
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length) lines.push(current.join(" "));
  return lines.slice(0, 3);
}

function RivenMockScreen({
  slideIndex,
  W,
  theme,
}: {
  slideIndex: number;
  W: number;
  theme: (typeof THEMES)["riven"];
}) {
  const s = W / 1320;
  const cardR = 18 * s;
  const pad = 22 * s;
  const headerH = 64 * s;

  const commonText = theme.text;
  const commonSecondary = theme.secondary;

  const ScreenBg = (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse at 20% 10%, rgba(222,185,106,0.22) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, rgba(143,166,168,0.18) 0%, transparent 55%), linear-gradient(180deg, rgba(30,56,64,0.95) 0%, rgba(22,42,49,1) 100%)",
      }}
    />
  );

  const TopBar = (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: headerH,
        padding: `0 ${pad}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", gap: 10 * s, alignItems: "center" }}>
        <div
          style={{
            width: 38 * s,
            height: 38 * s,
            borderRadius: 12 * s,
            background:
              "radial-gradient(circle at 30% 30%, rgba(222,185,106,0.85) 0%, rgba(222,185,106,0.15) 50%, rgba(22,42,49,0.2) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        />
        <div
          style={{
            fontWeight: 800,
            letterSpacing: -0.2 * s,
            fontSize: 22 * s,
            fontFamily: "var(--font-display, serif)",
          }}
        >
          Riven
        </div>
      </div>
      <div
        style={{
          width: 36 * s,
          height: 36 * s,
          borderRadius: 14 * s,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      />
    </div>
  );

  const ContentArea = (
    <div
      style={{
        position: "absolute",
        inset: headerH,
        padding: pad,
        display: "flex",
        flexDirection: "column",
        gap: 14 * s,
      }}
    >
      {slideIndex === 0 && (
        <>
          <div
            style={{
              fontFamily: "var(--font-display, serif)",
              fontSize: 26 * s,
              fontWeight: 800,
              lineHeight: 1.05,
            }}
          >
            Spaced repetition
          </div>
          <div style={{ fontSize: 15 * s, color: commonSecondary, lineHeight: 1.3 }}>Next review</div>
          <div
            style={{
              borderRadius: cardR,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              padding: 14 * s,
            }}
          >
            <div style={{ fontSize: 34 * s, fontWeight: 900, letterSpacing: -0.4 * s }}>
              {Math.round(24 * s)}h
            </div>
            <div style={{ fontSize: 12 * s, color: commonSecondary, marginTop: 6 * s }}>Keep your streak alive</div>
          </div>
        </>
      )}

      {slideIndex === 1 && (
        <>
          <div
            style={{
              fontFamily: "var(--font-display, serif)",
              fontSize: 28 * s,
              fontWeight: 800,
              lineHeight: 1.05,
            }}
          >
            AI card generation
          </div>
          <div style={{ fontSize: 15 * s, color: commonSecondary }}>Paste notes or upload a doc.</div>
          <div
            style={{
              borderRadius: cardR,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              padding: 14 * s,
            }}
          >
            <div
              style={{
                fontSize: 12 * s,
                color: commonSecondary,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.06 * s,
              }}
            >
              Input
            </div>
            <div style={{ marginTop: 10 * s, display: "flex", gap: 10 * s }}>
              <div
                style={{
                  width: 54 * s,
                  height: 54 * s,
                  borderRadius: 16 * s,
                  background: "rgba(222,185,106,0.18)",
                  border: "1px solid rgba(222,185,106,0.28)",
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ height: 10 * s, borderRadius: 999, background: "rgba(255,255,255,0.08)" }} />
                <div style={{ height: 10 * s, borderRadius: 999, background: "rgba(255,255,255,0.06)", marginTop: 10 * s }} />
                <div style={{ height: 10 * s, borderRadius: 999, background: "rgba(255,255,255,0.04)", marginTop: 10 * s, width: "80%" }} />
              </div>
            </div>
          </div>
        </>
      )}

      {slideIndex === 2 && (
        <>
          <div style={{ fontFamily: "var(--font-display, serif)", fontSize: 28 * s, fontWeight: 800, lineHeight: 1.05 }}>
            Standard + Test
          </div>
          <div style={{ fontSize: 15 * s, color: commonSecondary }}>Track accuracy per session.</div>
          <div
            style={{
              borderRadius: cardR,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              padding: 14 * s,
            }}
          >
            <div style={{ display: "flex", gap: 10 * s }}>
              {[
                { k: "Standard", v: "8 cards" },
                { k: "Test", v: "5 answers" },
              ].map((it) => (
                <div
                  key={it.k}
                  style={{
                    flex: 1,
                    borderRadius: 16 * s,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: 12 * s,
                  }}
                >
                  <div style={{ fontSize: 12 * s, color: commonSecondary, fontWeight: 800 }}>{it.k}</div>
                  <div style={{ fontSize: 16 * s, fontWeight: 900, marginTop: 6 * s }}>{it.v}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {slideIndex === 3 && (
        <>
          <div style={{ fontFamily: "var(--font-display, serif)", fontSize: 28 * s, fontWeight: 800, lineHeight: 1.05 }}>
            Classes + deadlines
          </div>
          <div style={{ fontSize: 15 * s, color: commonSecondary }}>Weekly schedule with due dates.</div>
          <div
            style={{
              borderRadius: cardR,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              padding: 14 * s,
            }}
          >
            {[
              { t: "Assignment", a: "Due Thu" },
              { t: "Study", a: "Deck linked" },
              { t: "Review", a: "Next cards" },
            ].map((row) => (
              <div
                key={row.t}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderRadius: 14 * s,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  padding: 10 * s,
                  marginBottom: 10 * s,
                }}
              >
                <div style={{ fontSize: 13 * s, fontWeight: 900 }}>{row.t}</div>
                <div style={{ fontSize: 13 * s, color: commonSecondary, fontWeight: 800 }}>{row.a}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {slideIndex === 4 && (
        <>
          <div style={{ fontFamily: "var(--font-display, serif)", fontSize: 28 * s, fontWeight: 800, lineHeight: 1.05 }}>
            Live cram session
          </div>
          <div style={{ fontSize: 15 * s, color: commonSecondary }}>Real-time deck sync with friends.</div>
          <div
            style={{
              borderRadius: cardR,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              padding: 14 * s,
            }}
          >
            <div style={{ display: "flex", gap: 12 * s, alignItems: "center" }}>
              {new Array(4).fill(0).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: (40 - i * 2) * s,
                    height: (40 - i * 2) * s,
                    borderRadius: 16 * s,
                    background: `rgba(222,185,106,${0.14 - i * 0.02})`,
                    border: "1px solid rgba(255,255,255,0.08)",
                    marginLeft: i === 0 ? 0 : -10 * s,
                  }}
                />
              ))}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12 * s, color: commonSecondary, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.06 * s }}>
                  Group
                </div>
                <div style={{ fontSize: 18 * s, fontWeight: 900, marginTop: 6 * s }}>Study together</div>
              </div>
            </div>
          </div>
        </>
      )}

      {slideIndex === 5 && (
        <>
          <div style={{ fontFamily: "var(--font-display, serif)", fontSize: 28 * s, fontWeight: 800, lineHeight: 1.05 }}>
            Your garden
          </div>
          <div style={{ fontSize: 15 * s, color: commonSecondary }}>Study daily to grow.</div>
          <div
            style={{
              borderRadius: cardR,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              padding: 14 * s,
            }}
          >
            <div style={{ display: "flex", gap: 12 * s, alignItems: "flex-end" }}>
              {new Array(8).fill(0).map((_, i) => {
                const h = (10 + (i + 1) * 7) * s * (i < 6 ? 1 : 0.55);
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      borderRadius: 14 * s,
                      height: h,
                      background: i < 6 ? "rgba(122,158,114,0.35)" : "rgba(143,166,168,0.18)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}

      {slideIndex === 6 && (
        <>
          <div style={{ fontFamily: "var(--font-display, serif)", fontSize: 30 * s, fontWeight: 800, lineHeight: 1.05 }}>
            Premium themes
          </div>
          <div style={{ fontSize: 15 * s, color: commonSecondary }}>Unlimited AI + ad-free study.</div>
          <div
            style={{
              borderRadius: cardR,
              border: "1px solid rgba(222,185,106,0.18)",
              background: "rgba(222,185,106,0.08)",
              padding: 14 * s,
            }}
          >
            <div style={{ fontSize: 12 * s, fontWeight: 900, color: "rgba(222,185,106,0.95)", textTransform: "uppercase", letterSpacing: 0.08 * s }}>
              Supporter
            </div>
            <div style={{ marginTop: 10 * s, display: "flex", alignItems: "baseline", gap: 10 * s }}>
              <div style={{ fontSize: 34 * s, fontWeight: 1000, letterSpacing: -0.6 * s }}>$5.99</div>
              <div style={{ fontSize: 14 * s, color: commonSecondary, fontWeight: 900 }}>/ month</div>
            </div>
            <div style={{ marginTop: 12 * s, display: "flex", flexDirection: "column", gap: 10 * s }}>
              {["Unlimited AI generations", "Ad-free studying", "Advanced groups"].map((t) => (
                <div key={t} style={{ display: "flex", gap: 10 * s, alignItems: "center" }}>
                  <div style={{ width: 18 * s, height: 18 * s, borderRadius: 6 * s, background: "rgba(222,185,106,0.55)", border: "1px solid rgba(255,255,255,0.12)" }} />
                  <div style={{ fontSize: 13 * s, fontWeight: 900, color: commonText }}>{t}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {ScreenBg}
      {TopBar}
      {ContentArea}
    </div>
  );
}

function PhoneFrame({
  slideIndex,
  W,
  theme,
  style,
}: {
  slideIndex: number;
  W: number;
  theme: (typeof THEMES)["riven"];
  style?: React.CSSProperties;
}) {
  const phoneW = clamp(W * 0.86, 720, W * 0.92);
  const ratioH = phoneW * (MOCKUP.mkH / MOCKUP.mkW);
  const phoneSrc = PHONE_SCREEN_BY_SLIDE[slideIndex];

  return (
    <div style={{ position: "absolute", ...style, width: phoneW, height: ratioH }}>
      <img src="/mockup.png" alt="" draggable={false} style={{ width: phoneW, height: ratioH, display: "block" }} />
      <div
        style={{
          position: "absolute",
          left: `${SC_L}%`,
          top: `${SC_T}%`,
          width: `${SC_W}%`,
          height: `${SC_H}%`,
          borderRadius: `${SC_RX}% / ${SC_RY}%`,
          overflow: "hidden",
          background: "#000",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        {phoneSrc ? (
          <img
            src={phoneSrc}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        ) : (
          <RivenMockScreen slideIndex={slideIndex} W={W} theme={theme} />
        )}
      </div>
    </div>
  );
}

function SlideArt({
  slideIndex,
  locale,
  themeId,
  W,
  H,
}: {
  slideIndex: number;
  locale: Locale;
  themeId: keyof typeof THEMES;
  W: number;
  H: number;
}) {
  const theme = THEMES[themeId];
  const slide = SLIDES[slideIndex]!;
  const lines = useMemo(() => splitHeadline(slide.headline), [slide.headline]);

  const captionPad = 54 * (W / 1320);
  const s = W / 1320;

  const titleY = H * 0.085;

  const phonePlacement = (() => {
    switch (slideIndex) {
      case 0:
        return { left: "50%", transform: "translateX(-50%)", bottom: -H * 0.01 } as React.CSSProperties;
      case 1:
        return { right: "0%", bottom: -H * 0.01 } as React.CSSProperties;
      case 2:
        return { left: "2%", bottom: -H * 0.01 } as React.CSSProperties;
      case 3:
        return { left: "16%", bottom: -H * 0.02 } as React.CSSProperties;
      case 4:
        return { right: "3%", bottom: -H * 0.01 } as React.CSSProperties;
      case 5:
        return { left: "50%", transform: "translateX(-50%) scale(0.98)", bottom: -H * 0.015 } as React.CSSProperties;
      case 6:
        return { left: "50%", transform: "translateX(-50%)", bottom: -H * 0.015 } as React.CSSProperties;
      default:
        return { left: "50%", transform: "translateX(-50%)", bottom: -H * 0.01 } as React.CSSProperties;
    }
  })();

  return (
    <div
      style={{
        position: "relative",
        width: W,
        height: H,
        overflow: "hidden",
        background: theme.bg,
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 48 * s,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "radial-gradient(ellipse at 20% 50%, rgba(222,185,106,0.18) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(143,166,168,0.14) 0%, transparent 45%), radial-gradient(ellipse at 50% 90%, rgba(143,166,168,0.08) 0%, transparent 55%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(140deg, rgba(222,185,106,0.18) 0%, transparent 40%), linear-gradient(180deg, rgba(30,56,64,0.2) 0%, rgba(22,42,49,1) 100%)",
          mixBlendMode: "screen",
          opacity: 0.65,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: captionPad,
          right: captionPad,
          top: titleY,
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-body, serif)",
            fontSize: 14 * s,
            color: theme.secondary,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            marginBottom: 18 * s,
          }}
        >
          Riven
        </div>

        <div
          style={{
            fontFamily: "var(--font-display, serif)",
            fontSize: 110 * s,
            fontWeight: 900,
            letterSpacing: -0.4 * s,
            lineHeight: 0.98,
            color: theme.text,
          }}
        >
          {lines.map((line, i) => (
            <div key={i} style={{ display: "block" }}>
              {line}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 18 * s,
            fontSize: 34 * s,
            fontWeight: 700,
            lineHeight: 1.12,
            color: theme.secondary,
          }}
        >
          {slide.subhead}
        </div>
      </div>

      <PhoneFrame slideIndex={slideIndex} W={W} theme={theme} style={phonePlacement} />
    </div>
  );
}

export default function StudioPage() {
  const locale: Locale = "en";
  const themeId: keyof typeof THEMES = "riven";

  const exportNodeRef = useRef<HTMLDivElement | null>(null);
  const [captureVisible, setCaptureVisible] = useState(false);
  const phoneScreensReadyRef = useRef(false);

  const [exportState, setExportState] = useState<{ running: boolean; done: number; total: number; last?: string }>({
    running: false,
    done: 0,
    total: IPHONE_SIZES.length * SLIDES.length,
  });

  const [exportJob, setExportJob] = useState<{ slideIndex: number; sizeIndex: number } | null>(null);
  const exportCanvas = exportJob ? IPHONE_SIZES[exportJob.sizeIndex]! : IPHONE_SIZES[0]!;

  useEffect(() => {
    let cancelled = false;

    async function preload() {
      await Promise.all(
        PHONE_SCREEN_BY_SLIDE.map(
          (src) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => resolve();
              img.onerror = () => resolve(); // don't block export if an image fails
              img.src = src;
            })
        )
      );

      if (cancelled) return;
      phoneScreensReadyRef.current = true;
    }

    preload();
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePng({ filename, dataUrl }: { filename: string; dataUrl: string }) {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename, dataUrl }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Save failed: ${res.status} ${txt}`);
    }
  }

  async function exportOne({ slideIndex, sizeIndex }: { slideIndex: number; sizeIndex: number }) {
    const size = IPHONE_SIZES[sizeIndex]!;
    const W = size.w;
    const H = size.h;

    // html-to-image can capture before <img> resources finish loading, so we preload and wait.
    const start = Date.now();
    while (!phoneScreensReadyRef.current && Date.now() - start < 10_000) {
      await new Promise((r) => setTimeout(r, 50));
    }

    setCaptureVisible(true);
    try {
      setExportJob({ slideIndex, sizeIndex });
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));

      const node = exportNodeRef.current;
      if (!node) throw new Error("Export node not found");

      const opts = { width: W, height: H, pixelRatio: 1, cacheBust: true };

      await toPng(node, opts);
      const dataUrl = await toPng(node, opts);

      const paddedSlide = String(slideIndex + 1).padStart(2, "0");
      const filename = `${paddedSlide}-riven-${locale}-${themeId}-iphone-${size.w}x${size.h}.png`;

      await savePng({ filename, dataUrl });
    } finally {
      setCaptureVisible(false);
    }
  }

  async function handleExportAll() {
    if (exportState.running) return;

    setExportState({ running: true, done: 0, total: IPHONE_SIZES.length * SLIDES.length });
    try {
      for (let slideIndex = 0; slideIndex < SLIDES.length; slideIndex++) {
        for (let sizeIndex = 0; sizeIndex < IPHONE_SIZES.length; sizeIndex++) {
          await exportOne({ slideIndex, sizeIndex });
          setExportState((s) => ({
            ...s,
            done: s.done + 1,
            last: `Slide ${slideIndex + 1} - ${IPHONE_SIZES[sizeIndex]!.label}`,
          }));
          await new Promise((r) => setTimeout(r, 120));
        }
      }
      setExportState((s) => ({
        ...s,
        running: false,
        last: `Export complete: ${s.total} images saved to /exports`,
      }));
    } catch (err: any) {
      setExportState((s) => ({
        ...s,
        running: false,
        last: `Export failed: ${err?.message || String(err)}`,
      }));
      console.error(err);
    }
  }

  const previewSize = IPHONE_SIZES[3]!;

  return (
    <div style={{ minHeight: "100vh", padding: 24 }}>
      <div className="riven-studio-bg" />

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: THEMES[themeId].secondary }}>
              App Store Screenshot Studio
            </div>
            <div style={{ fontFamily: "var(--font-display, serif)", fontSize: 40, fontWeight: 900, marginTop: 10, lineHeight: 1.05 }}>
              Riven - Botanical Ads
            </div>
            <div style={{ marginTop: 12, color: THEMES[themeId].secondary, fontWeight: 700 }}>
              Exports PNGs for iPhone sizes: 6.9", 6.5", 6.3", 6.1"
            </div>
          </div>

          <div style={{ minWidth: 260 }}>
            <button
              onClick={handleExportAll}
              disabled={exportState.running}
              style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: 18,
                background: "linear-gradient(90deg, rgba(222,185,106,0.95) 0%, rgba(168,192,127,0.88) 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#102228",
                fontWeight: 1000,
                cursor: exportState.running ? "not-allowed" : "pointer",
              }}
            >
              {exportState.running ? `Exporting... ${exportState.done}/${exportState.total}` : "Export ALL PNGs"}
            </button>
            <div style={{ marginTop: 12, color: THEMES[themeId].secondary, fontSize: 13, fontWeight: 700 }}>
              {exportState.last ? exportState.last : "Click to export and save under: /exports"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 13, color: THEMES[themeId].secondary, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em" }}>
            Preview (6.1")
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginTop: 12 }}>
            {SLIDES.map((_, slideIndex) => (
              <div key={slideIndex} style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ transform: "scale(0.34)", transformOrigin: "top left" }}>
                  <SlideArt slideIndex={slideIndex} locale={locale} themeId={themeId} W={previewSize.w} H={previewSize.h} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Offscreen export node (kept mounted; dimensions updated per job) */}
      <div style={{ position: "absolute", top: 0, left: captureVisible ? 0 : -99999, opacity: 1, pointerEvents: "none" }}>
        <div ref={exportNodeRef} style={{ width: exportCanvas.w, height: exportCanvas.h, position: "relative" }}>
          {exportJob ? (
            <SlideArt slideIndex={exportJob.slideIndex} locale={locale} themeId={themeId} W={exportCanvas.w} H={exportCanvas.h} />
          ) : (
            <SlideArt slideIndex={0} locale={locale} themeId={themeId} W={exportCanvas.w} H={exportCanvas.h} />
          )}
        </div>
      </div>
    </div>
  );
}
