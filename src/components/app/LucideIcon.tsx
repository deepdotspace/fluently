import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowRight,
  Bold,
  Book,
  BookOpen,
  Bot,
  Box,
  Brackets,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Code,
  Dot,
  Download,
  Edit,
  Edit2,
  Edit3,
  Eye,
  EyeOff,
  File,
  FileText,
  Gauge,
  HelpCircle,
  Home,
  Image,
  ImageOff,
  Info,
  Italic,
  Languages,
  Layers,
  Library,
  Lightbulb,
  Menu,
  Mic,
  Minus,
  Package,
  Palette,
  PartyPopper,
  Pause,
  Pencil,
  Play,
  Plus,
  PlusCircle,
  RefreshCw,
  Repeat,
  RotateCcw,
  ScrollText,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Square,
  Tag,
  Trash,
  Trash2,
  Type,
  Underline,
  Volume2,
  X,
  XCircle,
  type LucideProps
} from 'lucide-react';

/**
 * Registry of the icons this app actually renders, keyed by PascalCase name.
 *
 * Icons are imported individually (rather than via lucide-react's full `icons`
 * record) so the bundler tree-shakes everything we don't use, pulling in the
 * whole 1500+ icon set would add ~110 kB gzip to the client bundle.
 *
 * To use a new icon: add a named import above and a matching entry here. The
 * key is the icon's PascalCase name; callers may pass it as either kebab-case
 * (`arrow-left`) or PascalCase (`ArrowLeft`).
 */
const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  AlertCircle,
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowRight,
  Bold,
  Book,
  BookOpen,
  Bot,
  Box,
  Brackets,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Code,
  Dot,
  Download,
  Edit,
  Edit2,
  Edit3,
  Eye,
  EyeOff,
  File,
  FileText,
  Gauge,
  HelpCircle,
  Home,
  Image,
  ImageOff,
  Info,
  Italic,
  Languages,
  Layers,
  Library,
  Lightbulb,
  Menu,
  Mic,
  Minus,
  Package,
  Palette,
  PartyPopper,
  Pause,
  Pencil,
  Play,
  Plus,
  PlusCircle,
  RefreshCw,
  Repeat,
  RotateCcw,
  ScrollText,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Square,
  Tag,
  Trash,
  Trash2,
  Type,
  Underline,
  Volume2,
  X,
  XCircle
};

/**
 * Converts various icon name formats to PascalCase, which is how `ICONS` is
 * keyed. Handles: "arrow-left" -> "ArrowLeft", "X" -> "X", "settings" ->
 * "Settings".
 */
const toPascalCase = (str: string): string => {
  if (!str) return '';

  // Already PascalCase (starts uppercase, no separators): keep as-is.
  if (str[0] === str[0].toUpperCase() && !str.includes('-')) {
    return str;
  }

  // kebab-case / lowercase -> PascalCase.
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

interface LucideIconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

/**
 * Renders a Lucide icon by name from the bundled `lucide-react` package.
 *
 * The `name` prop accepts kebab-case (`arrow-left`) or PascalCase
 * (`ArrowLeft`); both resolve to the same registry entry. Unknown names render
 * nothing (an empty slot), matching the prior CDN-based behavior.
 */
const LucideIcon = ({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
  className = ''
}: LucideIconProps) => {
  const IconComponent = ICONS[toPascalCase(name)];

  if (!IconComponent) {
    if (name) {
      console.warn(`Lucide icon "${name}" (PascalCase: "${toPascalCase(name)}") not found`);
    }
    return null;
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        verticalAlign: 'middle'
      }}
    >
      <IconComponent
        size={size}
        color={color}
        strokeWidth={strokeWidth}
        style={{ display: 'inline-block', verticalAlign: 'middle' }}
      />
    </span>
  );
};

export default LucideIcon;
