# Emerald Explorer (v2.0 Web Pivot) - Prototype

This is the high-fidelity web prototype for the Emerald Explorer application, built with React and Vite. It implements the "Evergreen System" design library and the ICE Brain logic.

## Getting Started

1. Navigate to this directory in your terminal:
   ```bash
   cd /Users/carl.liu/.gemini/antigravity/scratch/emerald-explorer-web
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open the provided URL (usually `http://localhost:5173`) in your browser.

## Implemented Features

*   **The Evergreen System:** Implemented via CSS variables in `src/index.css`. Includes the Biophilic Palette and premium typography.
*   **useRotationEngine:** React hook that handles the Parenting vs Solo mode state.
*   **useViabilityEngine (ICE Brain):** Calculates "match scores" for activities based on environment (tide, snow), user gear, and parenting constraints.
*   **Adaptive UI:**
    *   **Dual-State Theme:** The entire app UI (background, colors, card shapes) shifts dynamically when you toggle modes.
    *   **PulseWeatherRibbon:** Animates environmental metrics and renders a "Golden Hour" timeline in summer mode.
    *   **AdaptiveHeroCard:** Changes its visual density and border radius based on the active mode.
*   **Gear Tracking:** Mock resource system showing "Gears Ready" status for Kayaking and Skiing activities.

## Technology Stack
*   **Frontend:** React 18+
*   **Build Tool:** Vite
*   **Styling:** Vanilla CSS (CSS Variables + Scoped CSS)
