# ClassPod Design System Specification

**Product**: ClassPod — Intelligent Verified Attendance Platform  
**Tagline**: Fast. Verified. Professional.  
**Version**: 2.0 (Enterprise EdTech Standard)

---

## 1. Brand Identity & Principles

1. **Fast**: Operations (check-ins, session launch, report export) require minimum friction and immediate feedback (< 3 seconds).
2. **Verified**: High-confidence presence through multi-signal telemetry (ESP32 BLE Beacons, Optical Person Counting, Device Biometric binding).
3. **Professional**: Serious, enterprise-ready aesthetics suitable for higher education, universities, and corporate training. No toy-like or unfinished prototype visual cues.

---

## 2. Color System & Design Tokens

### Light Mode Palette
- **Background**: `hsl(206, 33%, 98%)` (Clean slate white `#f8fafc`)
- **Foreground / Text Primary**: `hsl(219, 44%, 14%)` (Deep slate `#131d2e`)
- **Card Background**: `hsl(0, 0%, 100%)` (Pure white `#ffffff`)
- **Primary (ClassPod Royal Blue)**: `hsl(221, 78%, 52%)` (`#2563eb`)
- **Primary Foreground**: `hsl(210, 40%, 98%)` (`#f8fafc`)
- **Secondary**: `hsl(210, 40%, 96.1%)` (`#f1f5f9`)
- **Muted**: `hsl(210, 33%, 94%)` (`#e2e8f0`)
- **Muted Foreground**: `hsl(215, 20%, 42%)` (`#5a6a80`)
- **Success / Verified**: `hsl(142, 76%, 36%)` (`#16a34a`) / Light: `hsl(142, 76%, 95%)`
- **Warning / Pending**: `hsl(38, 92%, 50%)` (`#f59e0b`) / Light: `hsl(48, 96%, 95%)`
- **Destructive / Error**: `hsl(0, 84.2%, 60.2%)` (`#ef4444`) / Light: `hsl(0, 84%, 96%)`
- **Border / Outline**: `hsl(215, 30%, 90%)` (`#e2e8f0`)

### Dark Mode Palette
- **Background**: `hsl(219, 44%, 8%)` (Deep space obsidian `#0a0e17`)
- **Foreground / Text Primary**: `hsl(210, 60%, 98%)` (Crisp off-white `#f8fafc`)
- **Card Background**: `hsl(219, 44%, 12%)` (Polished slate card `#111827`)
- **Card Border**: `hsl(219, 30%, 18%)` (Subtle boundary `#1e293b`)
- **Primary**: `hsl(221, 78%, 54%)` (`#3b82f6`)
- **Secondary**: `hsl(219, 30%, 18%)` (`#1e293b`)
- **Muted**: `hsl(219, 30%, 16%)` (`#182234`)
- **Muted Foreground**: `hsl(217, 15%, 65%)` (`#94a3b8`)
- **Success / Verified**: `hsl(142, 71%, 45%)` (`#22c55e`)
- **Warning / Pending**: `hsl(38, 92%, 50%)` (`#f59e0b`)
- **Destructive / Error**: `hsl(0, 72%, 51%)` (`#dc2626`)

---

## 3. Typography Hierarchy

ClassPod uses the **Inter / System Sans-Serif** font family with a strict optical sizing scale:

| Level | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `2.25rem` (36px) | 800 (Extra Bold) | `2.5rem` (40px) | Hero banners, Auth welcome titles |
| **H1** | `1.875rem` (30px) | 700 (Bold) | `2.25rem` (36px) | Page title (e.g., Home, Attendance, Reports, Settings) |
| **H2** | `1.25rem` (20px) | 700 (Bold) | `1.75rem` (28px) | Section title, Modal headers |
| **H3** | `1.0rem` (16px) | 600 (Semi-Bold) | `1.5rem` (24px) | Card headers, Table subsection titles |
| **Body** | `0.875rem` (14px) | 400 (Regular) | `1.25rem` (20px) | Main UI paragraphs, table row values, inputs |
| **Caption / Meta** | `0.75rem` (12px) | 500 (Medium) | `1.0rem` (16px) | Timestamps, status explanations, breadcrumbs |
| **Data / Numbers** | `1.5rem` - `2.0rem` | 800 (Extra Bold) | `1.0` | Attendance stats, percentages, live student counters |

---

## 4. Spacing, Radius & Shadows

- **Spacing Scale**: 4px (`0.25rem`), 8px (`0.5rem`), 12px (`0.75rem`), 16px (`1rem`), 24px (`1.5rem`), 32px (`2rem`), 48px (`3rem`).
- **Border Radius**:
  - Small elements (Badges, Chips): `6px` (`rounded-md`)
  - Medium elements (Buttons, Inputs): `8px` (`rounded-lg`)
  - Large containers (Cards, Modals, Drawers): `16px` (`rounded-2xl`)
  - Full rounded (Avatars, Status dots): `9999px` (`rounded-full`)
- **Shadows**:
  - Card Shadow: `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`
  - Elevated Popover / Modal: `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`
  - Glow (Active Beacon / Verified): `0 0 20px -3px rgba(37, 99, 235, 0.3)`

---

## 5. Component Standards

### 5.1 Buttons
- **Primary**: Solid blue `#2563eb`, white text, shadow-sm, hover: `#1d4ed8`.
- **Secondary**: Slate-muted border & background, hover: bg-muted/80.
- **Destructive**: Subdued rose background in light mode, crimson in dark mode.
- **Ghost**: Transparent background, text-muted-foreground, hover: bg-muted.
- **Disabled State**: Opacity 50%, `cursor-not-allowed`, no hover transform.

### 5.2 Form Inputs
- Clear floating labels with uppercase tracking.
- Focused state: 2px solid `--primary` ring with subtle glow.
- Integrated validation message immediately beneath input.

### 5.3 Badges & Status Indicators
- **Verified**: `bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30`
- **Pending / In-Progress**: `bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse`
- **Rejected / Absent**: `bg-destructive/15 text-destructive border-destructive/30`
- **Active Session**: Glowing green pulse dot.

### 5.4 Avatars
- Centralized `Avatar` component with profile image loading, fallback initials, role badge indicator, and seamless camera/file upload preview.

---

## 6. Information Architecture & Navigation

```text
                         CLASS POD
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
        HOME            ATTENDANCE          REPORTS
          │                 │                 │
   Quick Overview       Start Session      History
   Today's Stats        Live Verification  Analytics
   Profile              Session Result     Export .xlsx / .pdf
          │
          └─────────────────────────────────────
                            │
                         SETTINGS
                            │
                    Profile / Security
                    WhatsApp Alerts
                    Appearance (Theme)
```

- **Removed Pages**:
  - `/automation` (Replaced by seamless backend event-driven pipeline + exports in Reports).
  - `/developer-console` (Removed from production navigation).
  - Standalone duplicate attendance log page (Merged into Reports).

---

## 7. Accessibility & Responsive Rules

1. **Touch Targets**: Minimum 44x44px for all interactive buttons and mobile navigation items.
2. **Contrast**: WCAG AA compliance (4.5:1 for normal text, 3:1 for large text).
3. **Mobile First**: Fixed bottom navigation bar with safe-area insets (`env(safe-area-inset-bottom)`), responsive horizontal scroll containers for wide roster data, zero content clipping.
4. **Keyboard Accessibility**: Focus-visible ring on all interactive elements.
