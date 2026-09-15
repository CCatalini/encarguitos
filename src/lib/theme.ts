// Paleta de temas por persona. Cada persona elige uno de estos colores al
// crear su perfil, y toda su vista (avatar, categorías, botones) se pinta
// con las variantes de ese color. Los valores son clases de Tailwind
// completas (no template strings) a propósito: Tailwind arma su CSS
// escaneando el código en busca de clases literales, así que un nombre
// armado en runtime (`bg-${color}-500`) no se generaría.

export type ThemeColor = "green" | "pink" | "blue" | "amber" | "violet";

export type Theme = {
  label: string;
  /** Pastilla de color para el selector de color (fondo sólido). */
  swatch: string;
  /** Avatar circular con inicial. */
  avatarBg: string;
  avatarText: string;
  /** Fondo suave para tarjetas y secciones. */
  soft: string;
  softBorder: string;
  /** Botón/acento principal. */
  accentBg: string;
  accentBgHover: string;
  accentText: string;
  /** Tab de categoría activa vs. inactiva. */
  tabActive: string;
  tabInactive: string;
  /** Anillo de foco en inputs. */
  ring: string;
  /** Fondo del encabezado de la página de la persona. */
  headerFrom: string;
  headerTo: string;
};

export const THEMES: Record<ThemeColor, Theme> = {
  green: {
    label: "Verde",
    swatch: "bg-emerald-600",
    avatarBg: "bg-emerald-100",
    avatarText: "text-emerald-800",
    soft: "bg-emerald-50",
    softBorder: "border-emerald-200",
    accentBg: "bg-emerald-700",
    accentBgHover: "hover:bg-emerald-800",
    accentText: "text-emerald-800",
    tabActive: "bg-emerald-700 text-white",
    tabInactive: "text-emerald-800 hover:bg-emerald-100",
    ring: "focus:ring-emerald-500",
    headerFrom: "from-emerald-900",
    headerTo: "to-emerald-600",
  },
  pink: {
    label: "Rosa",
    swatch: "bg-[#CC498F]",
    avatarBg: "bg-[#F4D4E6]",
    avatarText: "text-[#8a2f61]",
    soft: "bg-[#FBEEF5]",
    softBorder: "border-[#F0C2DD]",
    accentBg: "bg-[#CC498F]",
    accentBgHover: "hover:bg-[#b53e7c]",
    accentText: "text-[#8a2f61]",
    tabActive: "bg-[#CC498F] text-white",
    tabInactive: "text-[#8a2f61] hover:bg-[#FBEEF5]",
    ring: "focus:ring-[#CC498F]",
    headerFrom: "from-[#8a2f61]",
    headerTo: "to-[#CC498F]",
  },
  blue: {
    label: "Celeste",
    swatch: "bg-sky-600",
    avatarBg: "bg-sky-100",
    avatarText: "text-sky-800",
    soft: "bg-sky-50",
    softBorder: "border-sky-200",
    accentBg: "bg-sky-700",
    accentBgHover: "hover:bg-sky-800",
    accentText: "text-sky-800",
    tabActive: "bg-sky-700 text-white",
    tabInactive: "text-sky-800 hover:bg-sky-100",
    ring: "focus:ring-sky-500",
    headerFrom: "from-sky-900",
    headerTo: "to-sky-600",
  },
  amber: {
    label: "Ámbar",
    swatch: "bg-amber-500",
    avatarBg: "bg-amber-100",
    avatarText: "text-amber-800",
    soft: "bg-amber-50",
    softBorder: "border-amber-200",
    accentBg: "bg-amber-600",
    accentBgHover: "hover:bg-amber-700",
    accentText: "text-amber-800",
    tabActive: "bg-amber-600 text-white",
    tabInactive: "text-amber-800 hover:bg-amber-100",
    ring: "focus:ring-amber-500",
    headerFrom: "from-amber-800",
    headerTo: "to-amber-500",
  },
  violet: {
    label: "Violeta",
    swatch: "bg-violet-600",
    avatarBg: "bg-violet-100",
    avatarText: "text-violet-800",
    soft: "bg-violet-50",
    softBorder: "border-violet-200",
    accentBg: "bg-violet-700",
    accentBgHover: "hover:bg-violet-800",
    accentText: "text-violet-800",
    tabActive: "bg-violet-700 text-white",
    tabInactive: "text-violet-800 hover:bg-violet-100",
    ring: "focus:ring-violet-500",
    headerFrom: "from-violet-900",
    headerTo: "to-violet-600",
  },
};

export const THEME_ORDER: ThemeColor[] = ["green", "pink", "blue", "amber", "violet"];

export function themeOf(color: string | null | undefined): Theme {
  if (color && color in THEMES) return THEMES[color as ThemeColor];
  return THEMES.green;
}
