# Artech HRMS — Theme Reference

Two themes are active in the application.

---

## 1. Soft Faded Light (`faded-lightheme`)

**Key:** `faded-lightheme` · **Mode:** Light · **File:** `faded-lightheme.jpg`

### Background & Overlay
| Property | Value |
|---|---|
| Background image | `faded-lightheme.jpg` |
| Overlay | `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(240,246,255,0.14) 100%)` |
| Body fallback color | `#EEF3FC` |

### Accent Colors
| Token | Value |
|---|---|
| `--accent` | `#2E6BE6` |
| `--accent-dark` | `#1B3A6B` |
| `--accent-50` | `#EBF4FF` |

### Dashboard Text Colors
| Element | Color | Notes |
|---|---|---|
| Page title | `#0D1F4E` | Deep Navy |
| Card title | `#0D1F4E` | Deep Navy |
| Primary body text | `#0D1F4E` | Deep Navy |
| Secondary / muted text | `#A0AABF` | Steel Gray |
| Table header text | `#A0AABF` | Steel Gray |
| Table cell text | `#0D1F4E` | Deep Navy |
| Form labels | `#0D1F4E` | Deep Navy |
| Stat card label | `rgba(255,255,255,0.60)` | On colored gradient |
| Stat card value | `#ffffff` | On colored gradient |
| Stat card sub-text | `rgba(255,255,255,0.50)` | On colored gradient |
| Chart tick / grid labels | `#A0AABF` | Steel Gray |
| Chart grid lines | `rgba(13,31,78,0.06)` | |

### Card Colors
| Element | Color |
|---|---|
| Card background | `rgba(255,255,255,0.95)` with `blur(20px)` |
| Card border | `rgba(255,255,255,0.60)` |
| Card shadow | `0 4px 20px rgba(13,31,78,0.12)` |
| Card head border | `rgba(232,237,245,0.90)` |
| Section card background | `#ffffff` |
| Section card border | `#E8EDF5` (Mist Gray) |
| Section card shadow | `0 4px 18px rgba(13,31,78,0.10), 0 1px 3px rgba(13,31,78,0.06)` |
| Page head background | `rgba(255,255,255,0.42)` with `blur(34px)` |
| Page head border | `rgba(255,255,255,0.35)` |
| Table header background | `#F4F8FF` (Cloud White) |
| Table header border | `#E8EDF5` (Mist Gray) |
| Table row hover | `color-mix(in srgb, #2E6BE6 5%, transparent)` |
| Sidebar | `rgba(255,255,255,0.28)` with `blur(52px)` |
| Sidebar border | `rgba(255,255,255,0.30)` |
| Topbar | `rgba(255,255,255,0.38)` with `blur(34px)` |
| Topbar border | `rgba(255,255,255,0.35)` |

### Stat Card Gradients
| Card | Gradient |
|---|---|
| Headcount / primary | `linear-gradient(135deg, #0D1F4E 0%, #1A6AB4 100%)` |
| Attendance / blue-teal | `linear-gradient(135deg, #1A6AB4, #3DC7B3)` |
| Revenue / green | `linear-gradient(135deg, #065F46, #2DB37A)` |
| Leave / amber | `linear-gradient(135deg, #92400E, #F59E0B)` |
| Alert / orange | `linear-gradient(135deg, #9A3412, #F97316)` |

### Insight Panel Colors
| Type | Background | Border | Text |
|---|---|---|---|
| Warning | `#FFFBEB` | `#FDE68A` | `#92400E` |
| Info | `#EFF6FF` | `#BFDBFE` | `#1E40AF` |
| Success | `#F0FDF4` | `#BBF7D0` | `#166534` |

### Sidebar Text Tokens (Light)
| Token | Value |
|---|---|
| `--sidebar-fg` | `#000000` |
| `--sidebar-fg-strong` | `#000000` |
| `--sidebar-fg-muted` | `rgba(0,0,0,0.70)` |
| `--sidebar-fg-label` | `rgba(0,0,0,0.60)` |
| `--sidebar-active-fg` | `#1d4ed8` |
| `--sidebar-active-bg` | `rgba(26,106,180,0.12)` |
| `--sidebar-hover-bg` | `rgba(0,0,0,0.05)` |

---

## 2. Dark Theme 3 (`darktheme-2`)

**Key:** `darktheme-2` · **Mode:** Dark · **File:** `darktheme-2.png`

### Background & Overlay
| Property | Value |
|---|---|
| Background image | `darktheme-2.png` |
| Overlay | `linear-gradient(180deg, rgba(8,10,24,0.50) 0%, rgba(6,8,20,0.68) 100%)` |
| Body fallback color | `#081428` |

### Accent Colors
| Token | Value |
|---|---|
| `--accent` | `#6366F1` |
| `--accent-dark` | `#312E81` |

### Dashboard Text Colors
| Element | Color | Notes |
|---|---|---|
| Page title | `#f1f5f9` | Forced by `.bg-is-dark` |
| Card title | `#e2e8f0` | Forced by `.bg-is-dark` |
| `.text-gray-900` | `#f1f5f9` | Overridden for dark bg |
| `.text-gray-800` | `#e2e8f0` | Overridden for dark bg |
| `.text-gray-700` | `#cbd5e1` | Overridden for dark bg |
| `.text-gray-600` | `#aab6cc` | Overridden for dark bg |
| `.text-gray-500` | `#94a3b8` | Overridden for dark bg |
| Inline navy text `#0D1F4E` | `#eef2f9` | Recolored for dark bg |
| Inline steel text `#A0AABF` | `#aab6cc` | Recolored for dark bg |
| Table header text | `#94a3b8` | |
| Table cell text | `#cbd5e1` | |
| Topbar text / icons | `#cbd5e1` | |
| Stat card label | `rgba(255,255,255,0.60)` | On colored gradient |
| Stat card value | `#ffffff` | On colored gradient |
| Stat card sub-text | `rgba(255,255,255,0.50)` | On colored gradient |
| Form labels | `#94a3b8` | |
| Form inputs | `#e2e8f0` | |

### Card Colors
| Element | Color |
|---|---|
| Card background | `rgba(18,25,42,0.72)` with `blur(34px)` |
| Card border | `rgba(255,255,255,0.12)` |
| Card head border | `rgba(255,255,255,0.10)` |
| Section card background | `rgba(20,27,45,0.72)` |
| Section card border | `rgba(255,255,255,0.10)` |
| Page head background | `rgba(15,23,42,0.40)` with `blur(34px)` |
| Page head border | `rgba(255,255,255,0.08)` |
| Table header background | `rgba(255,255,255,0.04)` |
| Table header border | `rgba(255,255,255,0.10)` |
| Table row border | `rgba(255,255,255,0.08)` |
| Table row hover | `rgba(255,255,255,0.05)` |
| Sidebar | `rgba(10,15,30,0.38)` with `blur(48px)` |
| Sidebar border | `rgba(255,255,255,0.10)` |
| Topbar | `rgba(15,23,42,0.40)` with `blur(34px)` |
| Topbar border | `rgba(255,255,255,0.08)` |
| Action buttons | `rgba(255,255,255,0.08)` bg, `rgba(255,255,255,0.18)` border |
| Action button hover | `rgba(255,255,255,0.15)` |
| Row hover | `rgba(255,255,255,0.07)` |
| Form inputs | `#1e293b` bg, `#475569` border |
| Secondary buttons | `#1e293b` bg, `#475569` border |

### Stat Card Gradients
Same gradients as Light theme — stat cards use colored backgrounds independent of the page theme.

### Insight Panel Colors
Same as Light theme — insight panels use their own background colors.

### Sidebar Text Tokens (Dark)
| Token | Value |
|---|---|
| `--sidebar-fg` | `rgba(255,255,255,0.78)` |
| `--sidebar-fg-strong` | `#f1f5f9` |
| `--sidebar-fg-muted` | `rgba(255,255,255,0.52)` |
| `--sidebar-fg-label` | `rgba(255,255,255,0.40)` |
| `--sidebar-active-fg` | `#818cf8` |
| `--sidebar-active-bg` | `rgba(99,102,241,0.18)` |
| `--sidebar-hover-bg` | `rgba(255,255,255,0.07)` |

---

## Shared Brand Palette

These colors are constant across both themes:

| Name | Hex | Usage |
|---|---|---|
| Deep Navy | `#0D1F4E` | Primary text (light), headings |
| ARTech Blue | `#1A6AB4` | Primary CTAs, links |
| Innovation Teal | `#3DC7B3` | Accents, highlights |
| Growth Green | `#2DB37A` | Success states |
| Cloud White | `#F4F8FF` | Page/card backgrounds (light) |
| Mist Gray | `#E8EDF5` | Borders, dividers, input bg |
| Steel Gray | `#A0AABF` | Secondary text, captions |
| Amber | `#F59E0B` | Warnings, leave status |
| Red | `#EF4444` | Errors, absent status |

## Data Visualization Colors (Both Themes)

| Purpose | Colors |
|---|---|
| Department bars | `#1A6AB4`, `#3DC7B3`, `#2DB37A`, `#8B5CF6`, `#F59E0B`, `#EC4899`, `#F97316`, `#06B6D4` |
| Attendance: Present | `#2DB37A` |
| Attendance: Absent | `#EF4444` |
| Attendance: On Leave | `#F59E0B` |
| Attendance: Half Day | `#1A6AB4` |
| Attendance: WFH | `#8B5CF6` |
| Leave: Pending | `#F59E0B` |
| Leave: Approved | `#2DB37A` |
| Leave: Rejected | `#EF4444` |
