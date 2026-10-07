"use client";

import { CanvasRenderer } from "echarts/renderers";
import { graphic, use } from "echarts/core";

export const ECHARTS_RENDERERS = {
  canvas: "canvas",
};

export const DEFAULT_ECHARTS_RENDERER = ECHARTS_RENDERERS.canvas;

// Only register CanvasRenderer to drastically cut bundle size
use([CanvasRenderer]);

// ─────────────────────────────────────────────────────────────────────────────
// Theme keys + config
// ─────────────────────────────────────────────────────────────────────────────

export const THEMES = {
  light: "",
  dark: ".dark",
};
export const THEME_KEYS = Object.keys(THEMES);

export function getColorsCount(item) {
  if (!item.colors) return 1;
  const counts = THEME_KEYS.map((theme) => item.colors?.[theme]?.length ?? 0);
  return Math.max(...counts, 1);
}

export function distributeColors(colors, maxCount) {
  const available = colors.length;
  if (available >= maxCount) return colors.slice(0, maxCount);

  const result = [];
  const baseSlots = Math.floor(maxCount / available);
  const extraSlots = maxCount % available;

  for (let i = 0; i < available; i++) {
    const isExtra = i >= available - extraSlots;
    const slots = baseSlots + (isExtra ? 1 : 0);
    for (let j = 0; j < slots; j++) result.push(colors[i]);
  }

  return result;
}

export function buildChartCss(id, config) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.colors);
  if (!colorConfig.length) return "";

  const varsFor = (theme) =>
    colorConfig
      .flatMap(([key, item]) => {
        const authored = item.colors?.[theme];
        if (!authored || authored.length === 0) return [];
        return distributeColors(authored, getColorsCount(item)).map(
          (color, index) => `  --color-${key}-${index}: ${color};`,
        );
      })
      .join("\n");

  return Object.entries(THEMES)
    .map(
      ([theme, prefix]) =>
        `${prefix} [data-chart=${id}] {\n${varsFor(theme)}\n}`,
    )
    .join("\n");
}

let normalizerCtx = null;
export function normalizeColor(value) {
  const raw = value.trim();
  if (!raw || typeof document === "undefined") return raw;

  if (!normalizerCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    normalizerCtx = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!normalizerCtx) return raw;

  normalizerCtx.clearRect(0, 0, 1, 1);
  normalizerCtx.fillStyle = "#000";
  normalizerCtx.fillStyle = raw;
  normalizerCtx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = normalizerCtx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

export function withAlpha(color, alpha) {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return color;
  const [r, g, b, a] = match[1].split(",").map((p) => p.trim());
  const base = a === undefined ? 1 : Number.parseFloat(a) || 0;
  return `rgba(${r}, ${g}, ${b}, ${(base * alpha).toFixed(3)})`;
}

export function resolveColors(container, config, seriesKeys) {
  const computed = getComputedStyle(container);
  const series = {};

  for (const key of seriesKeys) {
    const count = getColorsCount(config[key] ?? {});
    const slots = [];
    for (let n = 0; n < count; n++) {
      const raw = computed.getPropertyValue(`--color-${key}-${n}`).trim();
      slots.push(raw ? normalizeColor(raw) : "rgba(120, 120, 120, 1)");
    }
    series[key] = slots;
  }

  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;";
  container.appendChild(probe);
  const readToken = (className) => {
    probe.className = className;
    return normalizeColor(getComputedStyle(probe).color);
  };
  const tokens = {
    mutedForeground: readToken("text-muted-foreground"),
    border: readToken("text-border"),
    foreground: readToken("text-foreground"),
    background: readToken("text-background"),
  };
  container.removeChild(probe);

  return { series, tokens };
}

// Tree-shakeable graphic.LinearGradient
export function seriesPaint(slots) {
  if (slots.length <= 1) return slots[0] ?? "rgba(120, 120, 120, 1)";
  const stops = slots.map((color, i) => ({
    offset: i / (slots.length - 1),
    color,
  }));
  return new graphic.LinearGradient(0, 0, 1, 0, stops);
}

export function indicatorBackground(key, colorsCount) {
  if (colorsCount <= 1) return `var(--color-${key}-0)`;
  const stops = Array.from({ length: colorsCount }, (_, i) => {
    const offset = (i / (colorsCount - 1)) * 100;
    return `var(--color-${key}-${i}) ${offset}%`;
  }).join(", ");
  return `linear-gradient(to right, ${stops})`;
}

export function flattenColor(color, base) {
  const parse = (value) =>
    value
      .match(/rgba?\(([^)]+)\)/)?.[1]
      .split(",")
      .map((part) => Number.parseFloat(part)) ?? [0, 0, 0, 1];
  const [r, g, b, a = 1] = parse(color);
  const [baseR, baseG, baseB] = parse(base);
  const mix = (channel, baseChannel) =>
    Math.round(channel * a + baseChannel * (1 - a));
  return `rgb(${mix(r, baseR)}, ${mix(g, baseG)}, ${mix(b, baseB)})`;
}
