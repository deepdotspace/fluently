export const softThemes = {
  "soft-lavender": {
    id: "soft-lavender",
    name: "Soft Lavender",
    gradient: "linear-gradient(135deg, #e0d4fd 0%, #f0e6ff 100%)",
    primary: "#a78bfa",
    cardBg: "rgba(255, 255, 255, 0.65)",
    cardBorder: "rgba(255, 255, 255, 0.4)",
    backdropBlur: "10px",
    textPrimary: "#4c1d95",
    textSecondary: "#6b46c1",
    highlight: "#ddd6fe"
  },
  "mint-breeze": {
    id: "mint-breeze",
    name: "Mint Breeze",
    gradient: "linear-gradient(135deg, #d4f8e8 0%, #e8fdf5 100%)",
    primary: "#34d399",
    cardBg: "rgba(255, 255, 255, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.5)",
    backdropBlur: "12px",
    textPrimary: "#065f46",
    textSecondary: "#10b981",
    highlight: "#a7f3d0"
  },
  "peach-dream": {
    id: "peach-dream",
    name: "Peach Dream",
    gradient: "linear-gradient(135deg, #fde2e4 0%, #fff1f2 100%)",
    primary: "#fb923c",
    cardBg: "rgba(255, 255, 255, 0.68)",
    cardBorder: "rgba(255, 255, 255, 0.45)",
    backdropBlur: "10px",
    textPrimary: "#9f1239",
    textSecondary: "#f43f5e",
    highlight: "#fecaca"
  },
  "sky-serenity": {
    id: "sky-serenity",
    name: "Sky Serenity",
    gradient: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)",
    primary: "#60a5fa",
    cardBg: "rgba(255, 255, 255, 0.72)",
    cardBorder: "rgba(255, 255, 255, 0.5)",
    backdropBlur: "12px",
    textPrimary: "#1e40af",
    textSecondary: "#3b82f6",
    highlight: "#bfdbfe"
  },
  "blush-rose": {
    id: "blush-rose",
    name: "Blush Rose",
    gradient: "linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%)",
    primary: "#ec4899",
    cardBg: "rgba(255, 255, 255, 0.65)",
    cardBorder: "rgba(255, 255, 255, 0.4)",
    backdropBlur: "10px",
    textPrimary: "#831843",
    textSecondary: "#be185d",
    highlight: "#fbcfe8"
  }
};

export function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty('--theme-gradient', theme.gradient);
  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-card-bg', theme.cardBg);
  root.style.setProperty('--theme-card-border', theme.cardBorder);
  root.style.setProperty('--theme-backdrop-blur', theme.backdropBlur);
  root.style.setProperty('--theme-text-primary', theme.textPrimary);
  root.style.setProperty('--theme-text-secondary', theme.textSecondary);
  root.style.setProperty('--theme-highlight', theme.highlight);
}
