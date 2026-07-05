/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: "#0f172a",
    tint: "#2563eb",

    background: "#f8fafc",
    foreground: "#0f172a",

    card: "#ffffff",
    cardForeground: "#0f172a",

    primary: "#2563eb",
    primaryForeground: "#ffffff",

    secondary: "#f1f5f9",
    secondaryForeground: "#1e293b",

    muted: "#f1f5f9",
    mutedForeground: "#64748b",

    accent: "#eff6ff",
    accentForeground: "#1d4ed8",

    destructive: "#ef4444",
    destructiveForeground: "#ffffff",

    success: "#16a34a",
    successForeground: "#ffffff",

    border: "#e2e8f0",
    input: "#e2e8f0",
  },

  dark: {
    text: "#f1f5f9",
    tint: "#3b82f6",

    background: "#0b1220",
    foreground: "#f1f5f9",

    card: "#131c2e",
    cardForeground: "#f1f5f9",

    primary: "#3b82f6",
    primaryForeground: "#ffffff",

    secondary: "#1c2942",
    secondaryForeground: "#e2e8f0",

    muted: "#1c2942",
    mutedForeground: "#94a3b8",

    accent: "#16233d",
    accentForeground: "#60a5fa",

    destructive: "#f87171",
    destructiveForeground: "#0b1220",

    success: "#4ade80",
    successForeground: "#0b1220",

    border: "#22314c",
    input: "#22314c",
  },

  // Border radius (in px). Applies to cards, buttons, inputs, and modals.
  radius: 12,
};

export default colors;
