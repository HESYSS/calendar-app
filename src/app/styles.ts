"use client";

import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  :root {
    --bg: #f2f3f5;
    --panel: #ffffff;
    --panel-2: #f7f8fa;
    --cell: #e9ecef;
    --cell-dim: #f1f3f5;
    --border: rgba(0, 0, 0, 0.08);
    --border-strong: rgba(0, 0, 0, 0.14);
    --text: rgba(0, 0, 0, 0.86);
    --muted: rgba(0, 0, 0, 0.62);
    --faint: rgba(0, 0, 0, 0.42);
    --accent: #f08c00;
    --danger: #e03131;
    --shadow: 0 1px 2px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.08);
    --radius: 10px;
    --radius-sm: 8px;
    --scroll-thumb: rgba(0, 0, 0, 0.18);

    /* Header "inverts" in dark theme to stay high-contrast against the page. */
    --header-bg: linear-gradient(135deg, #f59f00, #f76707);
    --header-fg: #ffffff;
    --header-control-bg: rgba(0, 0, 0, 0.14);
    --header-control-bg-hover: rgba(0, 0, 0, 0.2);
    --header-control-border: rgba(255, 255, 255, 0.22);
  }

  html[data-theme="dark"] {
    --bg: #0f1115;
    --panel: #171a21;
    --panel-2: #1e2230;
    --cell: rgba(255, 255, 255, 0.06);
    --cell-dim: rgba(255, 255, 255, 0.035);
    --border: rgba(255, 255, 255, 0.12);
    --border-strong: rgba(255, 255, 255, 0.18);
    --text: rgba(255, 255, 255, 0.92);
    --muted: rgba(255, 255, 255, 0.72);
    --faint: rgba(255, 255, 255, 0.5);
    --accent: #ffa94d;
    --danger: #ff6b6b;
    --shadow: 0 1px 2px rgba(0,0,0,0.25), 0 10px 30px rgba(0,0,0,0.35);
    --scroll-thumb: rgba(255, 255, 255, 0.22);

    --header-bg: linear-gradient(135deg, #ffffff, #f1f3f5);
    --header-fg: rgba(0, 0, 0, 0.86);
    --header-control-bg: rgba(0, 0, 0, 0.06);
    --header-control-bg-hover: rgba(0, 0, 0, 0.1);
    --header-control-border: rgba(0, 0, 0, 0.14);
  }

  *, *::before, *::after { box-sizing: border-box; }
  html, body { height: 100%; }

  body {
    margin: 0;
    color: var(--text);
    background: var(--bg);
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
    line-height: 1.35;
  }

  button, input, select, textarea { font: inherit; color: inherit; }
  a { color: inherit; text-decoration: none; }
`;
