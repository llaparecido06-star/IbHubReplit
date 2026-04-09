import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AtSign,
  Award,
  ChartBar,
  Bell,
  Bookmark,
  Briefcase,
  Calendar,
  Camera,
  Check,
  CircleCheck,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Clipboard,
  Clock,
  Copy,
  CornerUpLeft,
  CornerUpRight,
  Database,
  DollarSign,
  Edit,
  Pencil,
  PenLine,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Film,
  Flag,
  Gift,
  Globe,
  Grid2x2,
  Heart,
  Home,
  Image,
  Inbox,
  Info,
  Key,
  Link,
  Link2,
  Loader,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Maximize,
  Menu,
  MessageCircle,
  MessageSquare,
  Mic,
  Minus,
  Monitor,
  MoreHorizontal,
  MoreVertical,
  Package,
  Paperclip,
  CirclePlay,
  Plus,
  CirclePlus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  Slash,
  SlidersHorizontal,
  Smartphone,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  Video,
  CircleX,
  X,
  Zap,
  Wind,
  Trophy,
} from "lucide-react-native";
import React from "react";
import { Text } from "react-native";

const FEATHER_MAP: Record<string, React.ComponentType<any>> = {
  activity: Activity,
  "alert-circle": AlertCircle,
  "alert-triangle": AlertTriangle,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  "at-sign": AtSign,
  award: Award,
  "bar-chart-2": ChartBar,
  "bar-chart": ChartBar,
  bell: Bell,
  bookmark: Bookmark,
  briefcase: Briefcase,
  calendar: Calendar,
  camera: Camera,
  check: Check,
  "check-circle": CircleCheck,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "chevron-left": ChevronLeft,
  "chevron-up": ChevronUp,
  clipboard: Clipboard,
  clock: Clock,
  copy: Copy,
  "corner-up-left": CornerUpLeft,
  "corner-up-right": CornerUpRight,
  database: Database,
  "dollar-sign": DollarSign,
  edit: Edit,
  "edit-2": Pencil,
  "edit-3": PenLine,
  "external-link": ExternalLink,
  eye: Eye,
  "eye-off": EyeOff,
  "file-text": FileText,
  film: Film,
  flag: Flag,
  gift: Gift,
  globe: Globe,
  grid: Grid2x2,
  heart: Heart,
  home: Home,
  image: Image,
  inbox: Inbox,
  info: Info,
  key: Key,
  link: Link,
  "link-2": Link2,
  loader: Loader,
  lock: Lock,
  "log-out": LogOut,
  mail: Mail,
  "map-pin": MapPin,
  maximize: Maximize,
  menu: Menu,
  "message-circle": MessageCircle,
  "message-square": MessageSquare,
  mic: Mic,
  minus: Minus,
  monitor: Monitor,
  "more-horizontal": MoreHorizontal,
  "more-vertical": MoreVertical,
  package: Package,
  paperclip: Paperclip,
  "play-circle": CirclePlay,
  plus: Plus,
  "plus-circle": CirclePlus,
  "refresh-cw": RefreshCw,
  save: Save,
  search: Search,
  send: Send,
  settings: Settings,
  "share-2": Share2,
  shield: Shield,
  "shopping-bag": ShoppingBag,
  slash: Slash,
  sliders: SlidersHorizontal,
  smartphone: Smartphone,
  star: Star,
  tag: Tag,
  "trash-2": Trash2,
  "trending-up": TrendingUp,
  upload: Upload,
  user: User,
  "user-check": UserCheck,
  "user-plus": UserPlus,
  users: Users,
  video: Video,
  wind: Wind,
  x: X,
  "x-circle": CircleX,
  zap: Zap,
  trophy: Trophy,
};

const MCI_MAP: Record<string, { component: React.ComponentType<any>; fill?: boolean }> = {
  star: { component: Star, fill: true },
  "star-outline": { component: Star, fill: false },
  bookmark: { component: Bookmark, fill: true },
  "bookmark-outline": { component: Bookmark, fill: false },
  heart: { component: Heart, fill: true },
  "heart-outline": { component: Heart, fill: false },
  poll: { component: ChartBar, fill: false },
  "comment-outline": { component: MessageSquare, fill: false },
  "share-variant-outline": { component: Share2, fill: false },
  trophy: { component: Trophy, fill: false },
};

const ANTDESIGN_MAP: Record<string, { component: React.ComponentType<any>; fill?: boolean }> = {
  checkcircle: { component: CircleCheck, fill: true },
  trophy: { component: Trophy, fill: false },
  heart: { component: Heart, fill: true },
  "heart-o": { component: Heart, fill: false },
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
  strokeWidth?: number;
}

export function Feather({ name, size = 24, color = "#000", style, strokeWidth = 2 }: IconProps) {
  const LucideIcon = FEATHER_MAP[name];
  if (!LucideIcon) {
    console.warn(`Feather icon "${name}" not found`);
    return null;
  }
  return <LucideIcon size={size} color={color} style={style} strokeWidth={strokeWidth} />;
}

export function MaterialCommunityIcons({ name, size = 24, color = "#000", style }: IconProps) {
  const entry = MCI_MAP[name];
  if (!entry) {
    console.warn(`MaterialCommunityIcons icon "${name}" not found`);
    return null;
  }
  const { component: LucideIcon, fill } = entry;
  return (
    <LucideIcon
      size={size}
      color={color}
      style={style}
      fill={fill ? color : "none"}
      strokeWidth={fill ? 0 : 2}
    />
  );
}

export function AntDesign({ name, size = 24, color = "#000", style }: IconProps) {
  const entry = ANTDESIGN_MAP[name as keyof typeof ANTDESIGN_MAP];
  if (!entry) {
    console.warn(`AntDesign icon "${name}" not found`);
    return null;
  }
  const { component: LucideIcon, fill } = entry;
  return (
    <LucideIcon
      size={size}
      color={color}
      style={style}
      fill={fill ? color : "none"}
      strokeWidth={fill ? 0 : 2}
    />
  );
}

export function Ionicons({ name, size = 24, color = "#000", style }: IconProps) {
  if (name === "logo-apple") {
    const { Svg, Path } = require("react-native-svg");
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
        <Path
          d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
          fill={color}
        />
      </Svg>
    );
  }
  console.warn(`Ionicons icon "${name}" not found`);
  return null;
}

export default Feather;
