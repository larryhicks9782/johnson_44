import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { 
  Users, 
  Search, 
  Plus, 
  Sparkles, 
  Calendar, 
  MapPin, 
  ChevronRight, 
  Heart,
  Palette,
  Leaf,
  GraduationCap,
  Utensils,
  Sun,
  Moon,
  X,
  Image as ImageIcon,
  Upload,
  Share2,
  Check,
  Map as MapIcon,
  Layers,
  Grid,
  List as ListIcon,
  Mail,
  MessageSquare,
  ExternalLink,
  Clock,
  QrCode as QrCodeIcon,
  Download as DownloadIcon,
  Info,
  Send,
  Trash2,
  Smartphone,
  Camera,
  Bell,
  BellOff,
  Globe,
  Compass,
  Landmark,
  Building,
  BookOpen,
  TreePine,
  Store,
  Settings,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Zap,
  Thermometer,
  Activity,
  VideoOff,
  History,
  RefreshCw,
  Wallet,
  Award,
  Trophy,
  Volume2,
  VolumeX,
  Sliders,
  Timer,
  Maximize2,
  Copy,
  Eye,
  EyeOff,
  Minus,
  Filter,
  Box,
  Lock,
  Unlock,
  RotateCcw,
  AlertTriangle,
  Magnet,
  Navigation,
  ChevronUp,
  ChevronDown,
  Ruler,
  TrendingUp,
  Table,
  Download,
  FileDown,
  Music,
  Play,
  Pause
} from 'lucide-react';
import { CATEGORIES, SEED_GATHERINGS, SEED_USERS, CURRENT_USER as DEFAULT_CURRENT_USER } from './constants';
import { Gathering, Category, UserProfile, Comment } from './types';
import { generateGatheringIdea, generateIcebreakers } from './services/geminiService';
import { auth, db, signInWithGoogle, logOut, handleFirestoreError, OperationType } from './services/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  updateDoc, 
  query, 
  orderBy, 
  getDoc,
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import jsQR from 'jsqr';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  ReferenceDot,
  ReferenceArea
} from 'recharts';

export let CURRENT_USER: UserProfile = DEFAULT_CURRENT_USER;

export const getQrScansForGathering = (gatheringId: string): number => {
  const storedCounts = localStorage.getItem('gcommunity_qr_scans_by_gathering');
  const counts = storedCounts ? JSON.parse(storedCounts) : {};
  if (counts[gatheringId] !== undefined) {
    return counts[gatheringId];
  }
  // Initialize with a realistic number based on gathering ID and attendee count
  let seed = 14;
  if (gatheringId === '1') seed = 42;
  else if (gatheringId === '2') seed = 28;
  else if (gatheringId === '3') seed = 63;
  else {
    // Generate a pseudo-random stable seed based on gatheringId hash
    let hash = 0;
    for (let i = 0; i < gatheringId.length; i++) {
      hash = (hash << 5) - hash + gatheringId.charCodeAt(i);
      hash |= 0;
    }
    seed = Math.abs(hash % 30) + 5;
  }
  counts[gatheringId] = seed;
  localStorage.setItem('gcommunity_qr_scans_by_gathering', JSON.stringify(counts));
  return seed;
};

export const incrementQrScansForGathering = (gatheringId: string): number => {
  const storedCounts = localStorage.getItem('gcommunity_qr_scans_by_gathering');
  const counts = storedCounts ? JSON.parse(storedCounts) : {};
  const current = counts[gatheringId] !== undefined ? counts[gatheringId] : getQrScansForGathering(gatheringId);
  const updatedValue = current + 1;
  counts[gatheringId] = updatedValue;
  localStorage.setItem('gcommunity_qr_scans_by_gathering', JSON.stringify(counts));
  window.dispatchEvent(new CustomEvent('gcommunity_qr_scans_updated_event', { detail: { gatheringId } }));
  return updatedValue;
};

export interface ScanAnalyticsEvent {
  timestamp: number;
  dateString: string;
  timeString: string;
}

export interface ScanDayAnalytics {
  date: string;
  fullDate: string;
  count: number;
  timestamps: ScanAnalyticsEvent[];
}

const _generateScanHistory = (gatheringId: string, days: number, offsetDays: number = 0, baseDate?: Date): ScanDayAnalytics[] => {
  const totalScans = getQrScansForGathering(gatheringId);
  const seedNum = parseInt(gatheringId, 10) || 1;
  let periodTotal = totalScans;

  if (offsetDays > 0) {
    const baseMultiplier = offsetDays >= 365 ? 0.7 : 0.85;
    const multiplier = baseMultiplier + (Math.sin(seedNum + offsetDays) * 0.12);
    periodTotal = Math.max(days, Math.floor(totalScans * multiplier * (days / 7)));
  } else if (days > 7) {
    const multiplier = 1.2 + (Math.cos(seedNum) * 0.15);
    periodTotal = Math.max(days, Math.floor(totalScans * (days / 7) * multiplier));
  }

  const data: ScanDayAnalytics[] = [];
  const now = new Date();
  const baseValue = Math.floor(periodTotal / days);
  let accumulated = 0;

  for (let i = baseDate ? 0 : days - 1; i < (baseDate ? days : -1); baseDate ? i++ : i--) {
    const d = new Date(baseDate || now);
    baseDate ? d.setDate(baseDate.getDate() + i) : d.setDate(now.getDate() - i - offsetDays);
    const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
    const fullDateStr = d.toISOString().split("T")[0];

    let count = baseValue;
    const isLast = baseDate ? i === days - 1 : i === 0;
    if (isLast) {
      count = periodTotal - accumulated;
      if (count < 0) count = 0;
    } else {
      const randomOffset = Math.floor(Math.sin(seedNum + i + offsetDays) * (Math.max(1, baseValue) * 0.45));
      count = Math.max(baseDate ? 1 : 0, baseValue + randomOffset);
      accumulated += count;
    }

    const timestamps: ScanAnalyticsEvent[] = [];
    for (let j = 0; j < count; j++) {
      const scanHour = Math.floor(8 + (j * 12) / Math.max(1, count)) % 24;
      const scanMin = Math.round(Math.sin(j + i + offsetDays) * 30 + 30) % 60;
      const scanSec = Math.round(Math.cos(j + i + offsetDays) * 30 + 30) % 60;
      const scanTime = new Date(d);
      scanTime.setHours(scanHour, scanMin, scanSec);
      timestamps.push({ timestamp: scanTime.getTime(), dateString: fullDateStr, timeString: scanTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) });
    }
    timestamps.sort((a, b) => a.timestamp - b.timestamp);
    data.push({ date: dateStr, fullDate: fullDateStr, count, timestamps });
  }

  return data;
};

export const getScanHistoryForGathering = (gatheringId: string): ScanDayAnalytics[] => {
  const key = `gcommunity_scans_analytics_history_${gatheringId}`;
  const saved = localStorage.getItem(key);
  if (saved) try { return JSON.parse(saved); } catch (e) {}
  const data = _generateScanHistory(gatheringId, 7, 0);
  localStorage.setItem(key, JSON.stringify(data));
  return data;
};

export const getPreviousScanHistoryForGathering = (gatheringId: string): ScanDayAnalytics[] => {
  const key = `gcommunity_scans_analytics_history_prev_${gatheringId}`;
  const saved = localStorage.getItem(key);
  if (saved) try { return JSON.parse(saved); } catch (e) {}
  const data = _generateScanHistory(gatheringId, 7, 7);
  localStorage.setItem(key, JSON.stringify(data));
  return data;
};

export const getYearAgoScanHistoryForGathering = (gatheringId: string): ScanDayAnalytics[] => {
  const key = `gcommunity_scans_analytics_history_yearago_${gatheringId}`;
  const saved = localStorage.getItem(key);
  if (saved) try { return JSON.parse(saved); } catch (e) {}
  const data = _generateScanHistory(gatheringId, 7, 365);
  localStorage.setItem(key, JSON.stringify(data));
  return data;
};

export const getScanHistoryForGatheringWithDays = (gatheringId: string, days: number, offsetDays = 0): ScanDayAnalytics[] => {
  const key = `gcommunity_scans_analytics_history_${gatheringId}_d${days}_o${offsetDays}`;
  const saved = localStorage.getItem(key);
  if (saved) try { return JSON.parse(saved); } catch (e) {}
  const data = _generateScanHistory(gatheringId, days, offsetDays);
  localStorage.setItem(key, JSON.stringify(data));
  return data;
};

export const getCustomScanHistoryForGathering = (gatheringId: string, startDateStr: string): ScanDayAnalytics[] => {
  const key = `gcommunity_scans_analytics_history_custom_${gatheringId}_${startDateStr}`;
  const saved = localStorage.getItem(key);
  if (saved) try { return JSON.parse(saved); } catch (e) {}
  const data = _generateScanHistory(gatheringId, 7, 0, new Date(startDateStr));
  localStorage.setItem(key, JSON.stringify(data));
  return data;
};

export const recordAnalyticsScanForToday = (gatheringId: string): ScanDayAnalytics[] => {
  const key = `gcommunity_scans_analytics_history_${gatheringId}`;
  
  // Get existing or initialize first
  let data: ScanDayAnalytics[] = [];
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      data = JSON.parse(saved);
    } catch (e) {
      data = [];
    }
  }
  
  if (data.length === 0) {
    data = getScanHistoryForGathering(gatheringId);
  }
  
  const now = new Date();
  const todayFullStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const todayShortStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
  
  // Find or create today's record in the last 7 days series
  let todayRecord = data.find((r) => r.fullDate === todayFullStr);
  if (!todayRecord) {
    todayRecord = {
      date: todayShortStr,
      fullDate: todayFullStr,
      count: 0,
      timestamps: []
    };
    data.push(todayRecord);
    // Keep only the most recent 7 days
    if (data.length > 7) {
      data = data.slice(data.length - 7);
    }
  }
  
  todayRecord.count += 1;
  if (!todayRecord.timestamps) {
    todayRecord.timestamps = [];
  }
  
  todayRecord.timestamps.push({
    timestamp: now.getTime(),
    dateString: todayFullStr,
    timeString: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  });
  
  // Sort timestamps ascending
  todayRecord.timestamps.sort((a, b) => a.timestamp - b.timestamp);
  
  localStorage.setItem(key, JSON.stringify(data));
  return data;
};

export interface PointOfInterest {
  id: string;
  title: string;
  description: string;
  type: 'landmark' | 'community_center';
  lat: number;
  lng: number;
  iconType: 'landmark' | 'library' | 'garden' | 'community_center' | 'pagoda' | 'clocktower' | 'market';
}

export const POINTS_OF_INTEREST: PointOfInterest[] = [
  {
    id: 'poi-1',
    title: 'Willow Creek Library',
    description: 'A historic public library and reading garden. Offers community learning programs, storybooks, and free public WiFi.',
    type: 'community_center',
    lat: 38,
    lng: 31,
    iconType: 'library'
  },
  {
    id: 'poi-2',
    title: 'Old Oak Botanical Gardens',
    description: 'Beautiful public trails surrounded by century-old oak trees, ponds, and peaceful greenhouse displays.',
    type: 'landmark',
    lat: 50,
    lng: 25,
    iconType: 'garden'
  },
  {
    id: 'poi-3',
    title: 'Central Community Center',
    description: 'A vibrant hub for sports, indoor games, recreational workshops, classes, and neighborhood gatherings.',
    type: 'community_center',
    lat: 45,
    lng: 55,
    iconType: 'community_center'
  },
  {
    id: 'poi-4',
    title: 'Zen Deck Pagoda',
    description: 'An elegant outdoor pavilion offering a tranquil space for serene morning meditation and scenic dawn views.',
    type: 'landmark',
    lat: 61,
    lng: 75,
    iconType: 'pagoda'
  },
  {
    id: 'poi-5',
    title: 'Old Town Clocktower',
    description: 'Constructed in 1885, this brick architectural landmark stands as the symbolic heart of the central town plaza.',
    type: 'landmark',
    lat: 25,
    lng: 50,
    iconType: 'clocktower'
  },
  {
    id: 'poi-6',
    title: 'Harvest Food Market Hall',
    description: 'A lively indoor market bringing together organic local growers, culinary labs, artisanal foods, and fresh bakeries.',
    type: 'community_center',
    lat: 31,
    lng: 63,
    iconType: 'market'
  }
];

export interface MilestoneTier {
  tier: string;
  emoji: string;
  badgeClass: string;
  textClass: string;
  accentColor: string;
  required: number;
}

export function getMilestoneTier(streak: number): MilestoneTier {
  if (streak >= 20) {
    return {
      tier: 'Platinum',
      emoji: '💎',
      badgeClass: 'bg-gradient-to-r from-[#e5e4e2]/90 via-[#708090]/10 to-[#708090]/30 text-[#2c3e50] border-slate-300 shadow-sm shadow-slate-100',
      textClass: 'text-slate-800',
      accentColor: '#475569',
      required: 20
    };
  } else if (streak >= 15) {
    return {
      tier: 'Gold',
      emoji: '🏆',
      badgeClass: 'bg-gradient-to-r from-amber-400/90 via-yellow-200 to-amber-500/90 text-amber-950 border-amber-300/80 shadow-sm shadow-amber-200/50',
      textClass: 'text-amber-900',
      accentColor: '#b45309',
      required: 15
    };
  } else if (streak >= 10) {
    return {
      tier: 'Silver',
      emoji: '🥈',
      badgeClass: 'bg-gradient-to-r from-stone-200 via-stone-50 to-stone-400/70 text-stone-900 border-stone-300 shadow-sm shadow-stone-200/50',
      textClass: 'text-stone-850',
      accentColor: '#575757',
      required: 10
    };
  } else if (streak >= 5) {
    return {
      tier: 'Bronze',
      emoji: '🥉',
      badgeClass: 'bg-gradient-to-r from-amber-600/90 via-orange-400 to-amber-700/90 text-white border-amber-600 shadow-sm shadow-amber-800/20',
      textClass: 'text-amber-800',
      accentColor: '#78350f',
      required: 5
    };
  } else {
    return {
      tier: 'Initiate',
      emoji: '🌱',
      badgeClass: 'bg-stone-50 text-stone-600 border-stone-200',
      textClass: 'text-stone-500',
      accentColor: '#78716c',
      required: 0
    };
  }
}

const ROUND_DISTANCES = [
  { value: 0.0001, label: "0.1m" },
  { value: 0.0005, label: "0.5m" },
  { value: 0.001, label: "1m" },
  { value: 0.002, label: "2m" },
  { value: 0.005, label: "5m" },
  { value: 0.01, label: "10m" },
  { value: 0.02, label: "20m" },
  { value: 0.05, label: "50m" },
  { value: 0.1, label: "100m" },
  { value: 0.2, label: "200m" },
  { value: 0.5, label: "500m" },
  { value: 1.0, label: "1km" },
  { value: 2.0, label: "2km" },
  { value: 5.0, label: "5km" },
  { value: 10.0, label: "10km" },
  { value: 20.0, label: "20km" },
  { value: 50.0, label: "50km" },
  { value: 100.0, label: "100km" },
  { value: 200.0, label: "200km" },
  { value: 500.0, label: "500km" },
  { value: 1000.0, label: "1000km" },
  { value: 2000.0, label: "2000km" },
  { value: 5000.0, label: "5000km" },
];

const MapScaleRuler = ({ zoom, containerWidth }: { zoom: number; containerWidth: number }) => {
  const mapTotalDistanceKm = 50; // default represents 50km
  // pixel width of 1 km is:
  const pxPerKm = (containerWidth * zoom) / mapTotalDistanceKm;
  
  // Find the round distance that fits best
  // We want the resulting pixel width to be between 40px and 120px if possible
  let bestItem = ROUND_DISTANCES[0];
  let minDiff = Infinity;
  let bestPxWidth = 50;

  for (const item of ROUND_DISTANCES) {
    const pxWidth = item.value * pxPerKm;
    // We want the width to be in the range [40, 120]
    if (pxWidth >= 40 && pxWidth <= 120) {
      bestItem = item;
      bestPxWidth = pxWidth;
      break; 
    }
    // As a backup, track the one closest to 80px
    const diff = Math.abs(pxWidth - 80);
    if (diff < minDiff) {
      minDiff = diff;
      bestItem = item;
      bestPxWidth = pxWidth;
    }
  }

  return (
    <div 
      className="flex flex-col items-center justify-center bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-[12px] border border-stone-200/80 shadow-md pointer-events-none select-none transition-all duration-300"
      id="map-scale-ruler-container"
      title={`Scale: map representation showing ${bestItem.label}`}
    >
      <span className="text-[9px] font-black font-mono text-stone-700 leading-none mb-1 shadow-xs">
        {bestItem.label}
      </span>
      <div className="flex items-center justify-center" style={{ width: `${bestPxWidth}px` }}>
        {/* Left vertical tick */}
        <div className="w-[1.5px] h-2.5 bg-stone-850 shadow-xs shrink-0 rounded-full" />
        {/* Horizontal ruler bar */}
        <div className="flex-1 h-[2px] bg-stone-850 shadow-xs" />
        {/* Right vertical tick */}
        <div className="w-[1.5px] h-2.5 bg-stone-850 shadow-xs shrink-0 rounded-full" />
      </div>
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEFAULT_CURRENT_USER);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  CURRENT_USER = currentUser;

  const [view, setView] = useState<'home' | 'discover' | 'architect' | 'music'>('home');
  const [discoverMode, setDiscoverMode] = useState<'list' | 'map'>('list');
  const [gatherings, setGatherings] = useState<Gathering[]>(SEED_GATHERINGS);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [selectedMapCategory, setSelectedMapCategory] = useState<Category | 'All' | 'Nearby'>('All');
  const [visibleMapCategories, setVisibleMapCategories] = useState<Category[]>(['Arts & Culture', 'Wellness', 'Social', 'Learning', 'Nature', 'Food']);
  const [userLocation] = useState<{ lat: number; lng: number }>({ lat: 40, lng: 45 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isShareMapModalOpen, setIsShareMapModalOpen] = useState(false);
  const [copiedShareMapLink, setCopiedShareMapLink] = useState(false);
  const [createPrefilledLat, setCreatePrefilledLat] = useState<number | null>(null);
  const [createPrefilledLng, setCreatePrefilledLng] = useState<number | null>(null);
  const [createPrefilledLocation, setCreatePrefilledLocation] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Category[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showPois, setShowPois] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'terrain'>('standard');
  const [isHighContrastDark, setIsHighContrastDark] = useState<boolean>(false);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(false);
  const [showMapStyleLabels, setShowMapStyleLabels] = useState<boolean>(true);
  const [minZoomLimit, setMinZoomLimit] = useState<number>(0.01);
  const [maxZoomLimit, setMaxZoomLimit] = useState<number>(5.0);
  const [isZoomLimitsExpanded, setIsZoomLimitsExpanded] = useState<boolean>(false);
  const [gridSpacing, setGridSpacing] = useState<number>(10);
  const [gridColor, setGridColor] = useState<'emerald' | 'amber' | 'slate'>('slate');
  const [showGridLabels, setShowGridLabels] = useState<boolean>(true);
  const [mapPitch, setMapPitch] = useState<number>(0);
  const mapPerspective = mapPitch > 0 ? 'tilted' : 'top-down';
  const [isResetting, setIsResetting] = useState(false);
  const [isMapRotating, setIsMapRotating] = useState(false);
  const [isMapLayersOpen, setIsMapLayersOpen] = useState(true);
  const [isMapOverlaysOpen, setIsMapOverlaysOpen] = useState(true);
  const [isCategoryFiltersOpen, setIsCategoryFiltersOpen] = useState(true);
  const [isMainLegendOpen, setIsMainLegendOpen] = useState(true);
  const [scaleUnit, setScaleUnit] = useState<'metric' | 'imperial'>('metric');
  const [isLegendAnimationEnabled, setIsLegendAnimationEnabled] = useState(true);

  // Helper to calculate realistic map scale and distance bar width based on container width and zoom level
  const getMapScale = (widthPx: number, containerWidth: number, zoom: number, unit: 'metric' | 'imperial') => {
    const curWidth = containerWidth || 800;
    const curZoom = zoom || 1.0;
    
    if (unit === 'metric') {
      const FULL_MAP_COORDINATES_KM = 100; // Assume full 100-coord map width is 100 km at 1.0x zoom
      const totalVisibleKm = FULL_MAP_COORDINATES_KM / curZoom;
      const kmPerPixel = totalVisibleKm / curWidth;
      const targetKm = kmPerPixel * widthPx;

      const metricPresets = [
        100, 50, 25, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001
      ];

      // Find closest preset smaller or equal to targetKm
      let chosenPreset = metricPresets[metricPresets.length - 1];
      for (const preset of metricPresets) {
        if (targetKm >= preset * 0.8) {
          chosenPreset = preset;
          break;
        }
      }

      const actualBarPx = Math.max(15, Math.round(chosenPreset / kmPerPixel));
      const label = chosenPreset >= 1 
        ? `${chosenPreset} km` 
        : `${Math.round(chosenPreset * 1000)} m`;

      return { barWidth: actualBarPx, label };
    } else {
      const FULL_MAP_COORDINATES_MILES = 62.1371; // 100 km in miles
      const totalVisibleMiles = FULL_MAP_COORDINATES_MILES / curZoom;
      const milesPerPixel = totalVisibleMiles / curWidth;
      const targetMiles = milesPerPixel * widthPx;

      const imperialPresets = [
        55, 25, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001
      ];

      let chosenPreset = imperialPresets[imperialPresets.length - 1];
      for (const preset of imperialPresets) {
        if (targetMiles >= preset * 0.8) {
          chosenPreset = preset;
          break;
        }
      }

      const actualBarPx = Math.max(15, Math.round(chosenPreset / milesPerPixel));
      
      let label = '';
      if (chosenPreset >= 0.25) {
        label = `${chosenPreset} mi`;
      } else {
        const feet = Math.round(chosenPreset * 5280);
        const roundedFeet = feet > 100 ? Math.round(feet / 50) * 50 : Math.round(feet / 10) * 10;
        label = `${roundedFeet || 10} ft`;
      }

      return { barWidth: actualBarPx, label };
    }
  };
  const [legendVisibleMarkers, setLegendVisibleMarkers] = useState({
    single: true,
    multi: true,
    community: true,
    landmark: true,
  });
  const [legendVisibleDensities, setLegendVisibleDensities] = useState({
    high: true,
    medium: true,
    low: true,
  });
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [mapHighlightActive, setMapHighlightActive] = useState(false);
  const triggerMapHighlight = () => {
    setMapHighlightActive(true);
    setTimeout(() => {
      setMapHighlightActive(false);
    }, 850);
  };
  
  // Enforce boundary constraints automatically by snapping zoom to min or max limits
  useEffect(() => {
    if (mapCenter) {
      if (mapCenter.zoom < minZoomLimit) {
        setMapCenter(prev => prev ? { ...prev, zoom: minZoomLimit } : null);
      } else if (mapCenter.zoom > maxZoomLimit) {
        setMapCenter(prev => prev ? { ...prev, zoom: maxZoomLimit } : null);
      }
    }
  }, [mapCenter?.zoom, minZoomLimit, maxZoomLimit]);

  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState<number>(1000);
  const [isExportingMap, setIsExportingMap] = useState<boolean>(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width) {
          setMapWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(mapContainerRef.current);
    return () => {
      observer.disconnect();
    };
  }, []);
  const [zoomInputValue, setZoomInputValue] = useState<string>('1.00');
  const [isZoomInputFocused, setIsZoomInputFocused] = useState<boolean>(false);
  const [isZoomLocked, setIsZoomLocked] = useState<boolean>(false);
  const [zoomSensitivity, setZoomSensitivity] = useState<number>(0.25);
  const [sensitivityInputValue, setSensitivityInputValue] = useState<string>('0.25');
  const [zoomSnapIncrement, setZoomSnapIncrement] = useState<number | null>(null);
  const [snapInputValue, setSnapInputValue] = useState<string>('0.25');
  const triggerPresetZoom = (val: number) => {
    // Disable any active Magnet snapping to let the user select the exact requested preset zoom level smoothly
    setZoomSnapIncrement(null);
    if (!mapCenter) {
      setMapCenter({ lat: 50, lng: 50, zoom: val });
    } else {
      setMapCenter({
        ...mapCenter,
        zoom: val
      });
    }
  };
  const [isPresetsOpen, setIsPresetsOpen] = useState<boolean>(true);
  const [aiIdea, setAiIdea] = useState<{ title: string; description: string; whyItWorks: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [activeGathering, setActiveGathering] = useState<Gathering | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [minCapacity, setMinCapacity] = useState<number>(1);
  const [maxCapacity, setMaxCapacity] = useState<number>(100);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [users] = useState<UserProfile[]>([...SEED_USERS, CURRENT_USER]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [scannedAlert, setScannedAlert] = useState<string | null>(null);
  const [profileScanStreak, setProfileScanStreak] = useState(() => {
    return parseInt(localStorage.getItem('gcommunity_scan_streak') || '0', 10);
  });
  const [profileMaxStreak, setProfileMaxStreak] = useState(() => {
    const current = parseInt(localStorage.getItem('gcommunity_scan_streak') || '0', 10);
    const storedMax = parseInt(localStorage.getItem('gcommunity_max_scan_streak') || '0', 10);
    const maxVal = Math.max(storedMax, current);
    localStorage.setItem('gcommunity_max_scan_streak', String(maxVal));
    return maxVal;
  });
  const [isResetStreakConfirmOpen, setIsResetStreakConfirmOpen] = useState(false);
  const [isScanFeedbackEnabled, setIsScanFeedbackEnabled] = useState(() => {
    return localStorage.getItem('gcommunity_scan_feedback_enabled') !== 'false';
  });
  const [isScanChimeEnabled, setIsScanChimeEnabled] = useState(() => {
    return localStorage.getItem('gcommunity_scan_chime_enabled') !== 'false';
  });
  const [isAlertSoundEnabled, setIsAlertSoundEnabled] = useState(() => {
    return localStorage.getItem('gcommunity_alert_sound_enabled') !== 'false';
  });
  const [alertDuration, setAlertDuration] = useState<string>(() => {
    return localStorage.getItem('gcommunity_alert_duration') || '4s';
  });
  const [scanVolume, setScanVolume] = useState<number>(() => {
    const val = localStorage.getItem('gcommunity_scan_volume');
    return val !== null ? parseFloat(val) : 0.8;
  });

  // Music Generator (Lyria) state definitions
  const [musicPrompt, setMusicPrompt] = useState('An uplifting acoustic guitar and flute theme for an evening gathering around the campfire');
  const [musicDuration, setMusicDuration] = useState<'short' | 'full'>('short');
  const [musicSeedGathering, setMusicSeedGathering] = useState<string>(''); 
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [musicGenerationStep, setMusicGenerationStep] = useState<string>('');
  const [musicError, setMusicError] = useState<string | null>(null);
  const [currAudio, setCurrAudio] = useState<{
    id: string;
    prompt: string;
    model: string;
    audioUrl: string;
    mimeType: string;
    lyrics: string;
    seedGatheringTitle?: string;
    createdAt: string;
  } | null>(null);
  const [musicHistory, setMusicHistory] = useState<Array<{
    id: string;
    prompt: string;
    model: string;
    audioBase64: string;
    mimeType: string;
    lyrics: string;
    seedGatheringTitle?: string;
    createdAt: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem('gcommunity_music_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);

  const [scanCooldown, setScanCooldown] = useState<number>(() => {
    const expiry = localStorage.getItem('gcommunity_scan_cooldown_expiry');
    if (expiry) {
      const remaining = Math.ceil((parseInt(expiry, 10) - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    }
    return 0;
  });

  useEffect(() => {
    if (scanCooldown <= 0) return;
    const interval = setInterval(() => {
      setScanCooldown(prev => {
        const next = prev - 1;
        if (next <= 0) {
          localStorage.removeItem('gcommunity_scan_cooldown_expiry');
          window.dispatchEvent(new Event('gcommunity_scan_cooldown_ended'));
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [scanCooldown]);

  useEffect(() => {
    const handleCooldownStarted = (e: Event) => {
      const customEvent = e as CustomEvent;
      const expiry = customEvent.detail?.expiry;
      if (expiry) {
        const remaining = Math.ceil((expiry - Date.now()) / 1000);
        if (remaining > 0) {
          setScanCooldown(remaining);
        }
      }
    };
    window.addEventListener('gcommunity_scan_cooldown_started', handleCooldownStarted);
    return () => {
      window.removeEventListener('gcommunity_scan_cooldown_started', handleCooldownStarted);
    };
  }, []);

  // Synchronize numeric zoom input with actual map zoom state when not focused
  useEffect(() => {
    if (!isZoomInputFocused) {
      const z = mapCenter ? mapCenter.zoom : 1.0;
      setZoomInputValue(z.toFixed(2));
    }
  }, [mapCenter, isZoomInputFocused]);

  // Synchronize dynamic zoomSensitivity changes with direct input value
  useEffect(() => {
    setSensitivityInputValue(zoomSensitivity.toFixed(2));
  }, [zoomSensitivity]);

  // Global keyboard shortcuts for map zoom adjustments (+ / -)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing or focusing on form controls/editable areas
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || activeEl.hasAttribute('contenteditable')) {
          return;
        }
      }

      if (e.key === '+' || e.key === '=' || e.key === 'Add') {
        if (isZoomLocked) return;
        e.preventDefault();
        setMapCenter((prev) => {
          const currentZoom = prev ? prev.zoom : 1.0;
          const newZoom = Number(Math.min(maxZoomLimit, currentZoom + zoomSensitivity).toFixed(2));
          if (!prev) {
            return { lat: 50, lng: 50, zoom: newZoom };
          }
          return {
            ...prev,
            zoom: newZoom,
          };
        });
      } else if (e.key === '-' || e.key === '_' || e.key === 'Subtract') {
        if (isZoomLocked) return;
        e.preventDefault();
        setMapCenter((prev) => {
          const currentZoom = prev ? prev.zoom : 1.0;
          const newZoom = Number(Math.max(minZoomLimit, currentZoom - zoomSensitivity).toFixed(2));
          if (!prev) {
            return { lat: 50, lng: 50, zoom: newZoom };
          }
          return {
            ...prev,
            zoom: newZoom,
          };
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isZoomLocked, zoomSensitivity, minZoomLimit, maxZoomLimit]);

  // Wheel zoom controls for the map container
  useEffect(() => {
    const mapEl = mapContainerRef.current;
    if (!mapEl) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent page scrolling when scrolling over the interactive map container to zoom
      e.preventDefault();

      if (isZoomLocked) return;

      setMapCenter((prev) => {
        const currentZoom = prev ? prev.zoom : 1.0;
        // Adjust zoom: negative deltaY is zoom in, positive is zoom out
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        const newZoom = Number(Math.max(minZoomLimit, Math.min(maxZoomLimit, currentZoom + delta)).toFixed(2));
        if (!prev) {
          return { lat: 50, lng: 50, zoom: newZoom };
        }
        return {
          ...prev,
          zoom: newZoom,
        };
      });
    };

    mapEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      mapEl.removeEventListener('wheel', handleWheel);
    };
  }, [isZoomLocked, minZoomLimit, maxZoomLimit]);


  useEffect(() => {
    const handleUpdate = () => {
      const active = parseInt(localStorage.getItem('gcommunity_scan_streak') || '0', 10);
      const storedMax = parseInt(localStorage.getItem('gcommunity_max_scan_streak') || '0', 10);
      const newMax = Math.max(storedMax, active);
      localStorage.setItem('gcommunity_max_scan_streak', String(newMax));
      setProfileScanStreak(active);
      setProfileMaxStreak(newMax);
    };
    const handleFeedbackUpdate = () => {
      setIsScanFeedbackEnabled(localStorage.getItem('gcommunity_scan_feedback_enabled') !== 'false');
    };
    const handleChimeUpdate = () => {
      setIsScanChimeEnabled(localStorage.getItem('gcommunity_scan_chime_enabled') !== 'false');
    };
    const handleDurationUpdate = () => {
      setAlertDuration(localStorage.getItem('gcommunity_alert_duration') || '4s');
    };
    const handleVolumeUpdate = () => {
      const val = localStorage.getItem('gcommunity_scan_volume');
      setScanVolume(val !== null ? parseFloat(val) : 0.8);
    };
    window.addEventListener('gcommunity_total_scans_updated', handleUpdate);
    window.addEventListener('gcommunity_feedback_settings_updated', handleFeedbackUpdate);
    window.addEventListener('gcommunity_chime_settings_updated', handleChimeUpdate);
    window.addEventListener('gcommunity_alert_duration_updated', handleDurationUpdate);
    window.addEventListener('gcommunity_volume_updated', handleVolumeUpdate);
    return () => {
      window.removeEventListener('gcommunity_total_scans_updated', handleUpdate);
      window.removeEventListener('gcommunity_feedback_settings_updated', handleFeedbackUpdate);
      window.removeEventListener('gcommunity_chime_settings_updated', handleChimeUpdate);
      window.removeEventListener('gcommunity_alert_duration_updated', handleDurationUpdate);
      window.removeEventListener('gcommunity_volume_updated', handleVolumeUpdate);
    };
  }, []);

  // Play a beautiful success sound and haptic pulse whenever the scannedAlert banner appears
  useEffect(() => {
    if (scannedAlert && isScanFeedbackEnabled) {
      const currentStreak = parseInt(localStorage.getItem('gcommunity_scan_streak') || '0', 10);
      const isMilestone = currentStreak > 0 && currentStreak % 5 === 0;

      // 1. Snappy tactile double-pulse vibrator (or celebratory multi-pulse for milestones)
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          if (isMilestone) {
            // Milestone triple-pulse: strong celebration vibration
            navigator.vibrate([100, 50, 100, 50, 150]);
          } else {
            // Standard success double-pulse
            navigator.vibrate([80, 50, 80]);
          }
        }
      } catch (vibeErr) {
        console.warn('Vibration API not supported or user gesture required', vibeErr);
      }

      // 2. Synthesize an elegant warm "Success" or "Milestone-Up" celebratory chime
      if (isScanChimeEnabled) {
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
            const ctx = new AudioContext();
            const now = ctx.currentTime;

            if (isMilestone) {
              // 🌟 CRISP, CELEBRATORY MILESTONE-UP CHIME (Cascading major C-chord sweep)
              const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6 (Ascending pure chime)
              notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                
                // Alternating sine/triangle waves for high-fidelity crystalline aesthetic
                osc.type = index % 2 === 0 ? "sine" : "triangle";
                osc.frequency.setValueAtTime(freq, now + index * 0.05);
                
                // Lift the frequency slightly on release for an energetic rising effect
                osc.frequency.exponentialRampToValueAtTime(freq * 1.03, now + index * 0.05 + 0.12);
                
                // Volume envelope per note
                gainNode.gain.setValueAtTime(0.001, now + index * 0.05);
                gainNode.gain.linearRampToValueAtTime(0.12 * scanVolume, now + index * 0.05 + 0.02);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + index * 0.05 + 0.35);
                
                osc.connect(gainNode);
                gainNode.connect(ctx.destination);
                
                osc.start(now + index * 0.05);
                osc.stop(now + index * 0.05 + 0.42);
              });
            } else {
              // 🔔 STANDARD SUCCESS CHIME (Double ascending major-third sweep)
              // Fundamental Note (G5, crisp chime)
              const osc1 = ctx.createOscillator();
              const gain1 = ctx.createGain();
              osc1.type = "sine";
              osc1.frequency.setValueAtTime(783.99, now); // G5
              osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.12); // Sweep to C6

              // Harmonizing Third Note (E6, sweet brightness)
              const osc2 = ctx.createOscillator();
              const gain2 = ctx.createGain();
              osc2.type = "sine";
              osc2.frequency.setValueAtTime(1318.51, now); // E6
              osc2.frequency.exponentialRampToValueAtTime(1567.98, now + 0.14); // Sweep to G6

              // Smooth volume envelope to prevent clicking
              gain1.gain.setValueAtTime(0.001, now);
              gain1.gain.linearRampToValueAtTime(0.12 * scanVolume, now + 0.03);
              gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

              gain2.gain.setValueAtTime(0.001, now);
              gain2.gain.linearRampToValueAtTime(0.06 * scanVolume, now + 0.05);
              gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

              // Connections
              osc1.connect(gain1);
              gain1.connect(ctx.destination);
              osc2.connect(gain2);
              gain2.connect(ctx.destination);

              // Start & stop schedule
              osc1.start(now);
              osc2.start(now);
              osc1.stop(now + 0.35);
              osc2.stop(now + 0.32);
            }
          }
        } catch (audioErr) {
          console.warn('Web Audio API not supported or user gesture required', audioErr);
        }
      }
    }
  }, [scannedAlert]);

  // Centralized auto-dismissal helper for the scan success banner, respecting specific duration or sticky mode
  useEffect(() => {
    if (!scannedAlert) return;
    if (scanCooldown > 0) return; // Keep banner visible during scan cooldown. Once cooldown ends, default timer resumes.
    if (alertDuration === 'sticky') return;

    let durationMs = 4000;
    if (alertDuration === '2s') durationMs = 2000;
    if (alertDuration === '8s') durationMs = 8000;
    if (alertDuration === '15s') durationMs = 15000;

    const timer = setTimeout(() => {
       setScannedAlert(null);
     }, durationMs);
 
     return () => clearTimeout(timer);
   }, [scannedAlert, alertDuration, scanCooldown]);
   
   // Trigger a subtle 'notification' sound whenever the alert banner is shown, if enabled
   useEffect(() => {
     if (scannedAlert && isAlertSoundEnabled) {
       playAlertNotificationSound(scanVolume);
     }
   }, [scannedAlert, isAlertSoundEnabled, scanVolume]);
   
   // 1-Hour Pre-event reminders state: { [gatheringId]: { email: boolean; push: boolean } }
  const [eventReminders, setEventReminders] = useState<Record<string, { email: boolean; push: boolean }>>({});
  const [focusedClusterId, setFocusedClusterId] = useState<string | null>(null);
  const [activePushNotification, setActivePushNotification] = useState<{ id: string; title: string; message: string; type: 'email' | 'push'; date: string } | null>(null);

  // Load reminders on mount
  useEffect(() => {
    const saved = localStorage.getItem('gcommunity_event_reminders');
    if (saved) {
      try {
        setEventReminders(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse reminders:', err);
      }
    }
  }, []);

  const toggleEventReminder = (gatheringId: string, type: 'email' | 'push') => {
    setEventReminders(prev => {
      const current = prev[gatheringId] || { email: false, push: false };
      const updated = {
        ...prev,
        [gatheringId]: {
          ...current,
          [type]: !current[type]
        }
      };
      localStorage.setItem('gcommunity_event_reminders', JSON.stringify(updated));

      // Request HTML5 Notification permission if the user toggles push notifications on
      if (type === 'push' && !current.push && 'Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }

      return updated;
    });
  };

  // Auto-dismiss simulated in-app push notifications
  useEffect(() => {
    if (activePushNotification) {
      const timer = setTimeout(() => {
        setActivePushNotification(null);
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [activePushNotification]);

  // Filtered gatherings for community density heatmap calculation
  const displayedGatheringsForHeatmap = React.useMemo(() => {
    return gatherings.filter(g => {
      const matchesVisibility = visibleMapCategories.includes(g.category);
      if (!matchesVisibility) return false;

      let matchesMapCategory = false;
      if (selectedMapCategory === 'All') {
        matchesMapCategory = true;
      } else if (selectedMapCategory === 'Nearby') {
        const dx = g.lng - userLocation.lng;
        const dy = g.lat - userLocation.lat;
        const dist = Math.sqrt(dx * dx + dy * dy);
        matchesMapCategory = dist <= 15;
      } else {
        matchesMapCategory = g.category === selectedMapCategory || (g.tags && g.tags.includes(selectedMapCategory as any));
      }
      const matchesStartDate = !startDate || g.date >= startDate;
      const matchesEndDate = !endDate || g.date <= endDate;
      const matchesCapacity = g.capacity >= minCapacity && (maxCapacity === 100 || g.capacity <= maxCapacity);
      const matchesSearch = !searchQuery || 
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        g.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.tags && g.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
      return matchesMapCategory && matchesStartDate && matchesEndDate && matchesCapacity && matchesSearch;
    });
  }, [gatherings, selectedMapCategory, visibleMapCategories, startDate, endDate, minCapacity, maxCapacity, searchQuery, userLocation]);

  // Real-time responsive marker clustering for the custom map Coordinate space
  const mapClusters = React.useMemo(() => {
    const list: { id: string; gatherings: Gathering[]; lat: number; lng: number }[] = [];
    const CLUSTER_DISTANCE = 8.5; // percentage-based distance threshold for clustering relative to container percent space

    const displayedGatherings = gatherings.filter(g => {
      const matchesVisibility = visibleMapCategories.includes(g.category);
      if (!matchesVisibility) return false;

      let matchesMapCategory = false;
      if (selectedMapCategory === 'All') {
        matchesMapCategory = true;
      } else if (selectedMapCategory === 'Nearby') {
        const dx = g.lng - userLocation.lng;
        const dy = g.lat - userLocation.lat;
        const dist = Math.sqrt(dx * dx + dy * dy);
        matchesMapCategory = dist <= 15;
      } else {
        matchesMapCategory = g.category === selectedMapCategory || (g.tags && g.tags.includes(selectedMapCategory as any));
      }
      const matchesStartDate = !startDate || g.date >= startDate;
      const matchesEndDate = !endDate || g.date <= endDate;
      const matchesCapacity = g.capacity >= minCapacity && (maxCapacity === 100 || g.capacity <= maxCapacity);
      const matchesSearch = !searchQuery || 
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        g.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.tags && g.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
      return matchesMapCategory && matchesStartDate && matchesEndDate && matchesCapacity && matchesSearch;
    });

    displayedGatherings.forEach(g => {
      let addedToCluster = false;
      for (const cluster of list) {
        const dx = g.lng - cluster.lng;
        const dy = g.lat - cluster.lat;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CLUSTER_DISTANCE) {
          cluster.gatherings.push(g);
          addedToCluster = true;
          break;
        }
      }
      if (!addedToCluster) {
        list.push({
          id: `cluster-${g.id}`,
          gatherings: [g],
          lat: g.lat,
          lng: g.lng,
        });
      }
    });

    return list;
  }, [gatherings, selectedMapCategory, visibleMapCategories, startDate, endDate, minCapacity, maxCapacity, searchQuery, userLocation]);

  const handleFitBounds = () => {
    // Collect all visible marker coordinates (gatherings and POIs)
    const coords: { lat: number; lng: number }[] = [];

    // Add clusters/gatherings
    mapClusters.forEach(cluster => {
      const isSingle = cluster.gatherings.length === 1;
      if (isSingle) {
        if (legendVisibleMarkers.single) {
          coords.push({ lat: cluster.lat, lng: cluster.lng });
        }
      } else {
        if (legendVisibleMarkers.multi) {
          coords.push({ lat: cluster.lat, lng: cluster.lng });
        }
      }
    });

    // Add POIs if they are shown
    if (!focusedClusterId && showPois) {
      POINTS_OF_INTEREST.forEach(poi => {
        const isCommunity = poi.type === 'community_center';
        if (isCommunity) {
          if (legendVisibleMarkers.community) {
            coords.push({ lat: poi.lat, lng: poi.lng });
          }
        } else {
          if (legendVisibleMarkers.landmark) {
            coords.push({ lat: poi.lat, lng: poi.lng });
          }
        }
      });
    }

    if (coords.length === 0) {
      // Default to center view if no markers are visible
      setMapCenter(null);
      return;
    }

    if (coords.length === 1) {
      // Reset view centered on the single marker
      setMapCenter({
        lat: coords[0].lat,
        lng: coords[0].lng,
        zoom: 1.5,
      });
      return;
    }

    // Calculate bounding box
    const lats = coords.map(c => c.lat);
    const lngs = coords.map(c => c.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    const maxDeltaLat = Math.max(...lats.map(lat => Math.abs(lat - centerLat)));
    const maxDeltaLng = Math.max(...lngs.map(lng => Math.abs(lng - centerLng)));

    // Calculate zoom so it leaves some padding (e.g., 40% margin of standard 50px offset)
    const paddingLat = 40;
    const paddingLng = 40;

    const zoomLat = maxDeltaLat > 0 ? paddingLat / maxDeltaLat : 1.5;
    const zoomLng = maxDeltaLng > 0 ? paddingLng / maxDeltaLng : 1.5;

    let calculatedZoom = Math.min(zoomLat, zoomLng);

    // Clamp zoom to prevent excessive deep zoom or extreme zoom-out
    calculatedZoom = Math.max(0.75, Math.min(2.5, calculatedZoom));

    setMapCenter({
      lat: Number(centerLat.toFixed(2)),
      lng: Number(centerLng.toFixed(2)),
      zoom: Number(calculatedZoom.toFixed(2)),
    });
  };

  const handleExportMapView = async () => {
    if (!mapContainerRef.current) return;
    setIsExportingMap(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const bgColor = isHighContrastDark
        ? mapStyle === 'satellite'
          ? '#030712'
          : mapStyle === 'terrain'
          ? '#1c1917'
          : '#0c0a09'
        : mapStyle === 'satellite' 
        ? '#111827' 
        : mapStyle === 'terrain'
        ? '#d2c9ad'
        : '#e0e0d1';

      const canvas = await html2canvas(mapContainerRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: bgColor,
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `gcommunity-${mapStyle}-map-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Map export failed: ", err);
    } finally {
      setIsExportingMap(false);
    }
  };

  const fetchOutbox = async () => {
    try {
      const res = await fetch('/api/reminders/outbox');
      const data = await res.json();
      setNotifications(data);
    } catch (error) {
      console.error(error);
    }
  };

  const triggerReminder = async (gathering: Gathering) => {
    try {
      await fetch('/api/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com', // Mock email
          gatheringTitle: gathering.title,
          date: gathering.date,
          time: gathering.time,
          location: gathering.location
        })
      });
      fetchOutbox();
    } catch (error) {
      console.error(error);
    }
  };

  const simulateOneHourReminders = async () => {
    // Filter gatherings with at least one active pre-event reminder
    const activeTargets = gatherings.filter(g => eventReminders[g.id]?.email || eventReminders[g.id]?.push);
    
    if (activeTargets.length === 0) {
      alert("No pre-event reminders are currently set! Toggle an Email or Push notification reminder on a gathering card or map pinpoint first.");
      return;
    }

    let emailsCount = 0;
    let pushCount = 0;

    for (const g of activeTargets) {
      const config = eventReminders[g.id];
      if (!config) continue;

      if (config.email) {
        try {
          await fetch('/api/reminders/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'alex.rivera@example.com',
              gatheringTitle: g.title,
              date: g.date,
              time: g.time,
              location: g.location,
              subject: `⏰ 1-Hour Reminder: "${g.title}" is starting soon!`,
              body: `Hi ${CURRENT_USER.name || 'Friend'}!\n\nThis is your requested 1-hour pre-event reminder!\n\n"${g.title}" begins in exactly 1 hour (at ${g.time}) at ${g.location}.\n\nSafe travels, and we look forward to seeing you there!`
            })
          });
          emailsCount++;
        } catch (err) {
          console.error("Failed to send 1-hour email reminder:", err);
        }
      }

      if (config.push) {
        pushCount++;
        
        // Play notification cue sound
        try {
          const sound = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav");
          sound.volume = 0.25;
          sound.play().catch(() => {});
        } catch (e) {}

        // Trigger dynamic interactive push-banner HUD
        setActivePushNotification({
          id: `push-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: `⏰ 1-Hour Reminder`,
          message: `"${g.title}" starts in 1 hour at ${g.time}! Located at ${g.location}.`,
          type: 'push',
          date: new Date().toLocaleTimeString()
        });

        // HTML5 native notification fallback
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`⏰ 1-Hour Reminder: ${g.title}`, {
            body: `Starts in 1 hour (${g.time}) at ${g.location}`,
            icon: g.image || undefined
          });
        }
      }
    }

    fetchOutbox();
    alert(`⚡ Simulated 1-Hour Reminders Processed Successfully!\n\n• Emails sent to Inbox Outbox: ${emailsCount}\n• Push notification banners triggered: ${pushCount}`);
  };

  useEffect(() => {
    setIsResetStreakConfirmOpen(false);
    if (activeProfile?.id === CURRENT_USER.id) {
      fetchOutbox();
    }
  }, [activeProfile]);

  const closeModal = () => {
    setIsCreateModalOpen(false);
    setUploadPreview(null);
    setSelectedTags([]);
    setCreatePrefilledLat(null);
    setCreatePrefilledLng(null);
    setCreatePrefilledLocation(null);
  };

  useEffect(() => {
    // 1. Connection test block (as required by SKILL.md)
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    // 2. Auth State Sync
    let unsubscribeGatherings: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setIsAuthLoading(true);
      if (user) {
        setFirebaseUser(user);
        const userRef = doc(db, "users", user.uid);
        try {
          let userSnap;
          try {
            userSnap = await getDoc(userRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
            throw err;
          }

          if (userSnap.exists()) {
            const data = userSnap.data();
            setCurrentUser({
              id: user.uid,
              name: data.name || user.displayName || "GCommunity Explorer",
              email: data.email || user.email || "",
              avatar: data.avatar || user.photoURL || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop",
              bio: data.bio || "Active community contributor. Passionate about bringing people together.",
              interests: data.interests || ["Social", "Arts & Culture", "Learning"],
              joinedDate: data.joinedDate || new Date().toISOString()
            } as any);
          } else {
            const newProfile = {
              id: user.uid,
              name: user.displayName || "GCommunity Explorer",
              email: user.email || "",
              avatar: user.photoURL || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop",
              bio: "Active community contributor. Passionate about bringing people together.",
              interests: ["Social", "Arts & Culture", "Learning"],
              joinedDate: new Date().toISOString()
            };
            try {
              await setDoc(userRef, newProfile);
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
              throw err;
            }
            setCurrentUser(newProfile as any);
          }
        } catch (err) {
          console.error("Error setting/getting user document from firestore:", err);
          setCurrentUser({
            id: user.uid,
            name: user.displayName || "GCommunity Explorer",
            email: user.email || "",
            avatar: user.photoURL || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop",
            bio: "Active community contributor. Passionate about bringing people together.",
            interests: ["Social", "Arts & Culture", "Learning"],
            joinedDate: new Date().toISOString()
          } as any);
        }

        // 3. Keep Gatherings synced real-time with Firestore (if authenticated)
        if (!unsubscribeGatherings) {
          const gatheringsRef = collection(db, "gatherings");
          unsubscribeGatherings = onSnapshot(gatheringsRef, async (snapshot) => {
            if (snapshot.empty) {
              console.log("Firestore gatherings database is empty. Seeding starting data...");
              for (const g of SEED_GATHERINGS) {
                await setDoc(doc(db, "gatherings", g.id), g);
              }
            } else {
              const loaded: Gathering[] = [];
              snapshot.forEach((docSnap) => {
                loaded.push(docSnap.data() as Gathering);
              });
              setGatherings(loaded);
              localStorage.setItem('gatherings', JSON.stringify(loaded));
            }
          }, (err) => {
            console.warn("Firestore gatherings snapshot subscription error, falling back locally:", err);
          });
        }
      } else {
        setFirebaseUser(null);
        setCurrentUser(DEFAULT_CURRENT_USER);

        // Clean up subscription if logging out
        if (unsubscribeGatherings) {
          unsubscribeGatherings();
          unsubscribeGatherings = null;
        }

        // In guest mode, load from localStorage or default seed data
        const saved = localStorage.getItem('gatherings');
        if (saved) {
          try {
            setGatherings(JSON.parse(saved));
          } catch (e) {
            setGatherings(SEED_GATHERINGS);
          }
        } else {
          setGatherings(SEED_GATHERINGS);
        }
      }
      setIsAuthLoading(false);
    });

    const handleResetCache = () => {
      localStorage.removeItem('gatherings');
      setGatherings(SEED_GATHERINGS);
    };

    window.addEventListener('gcommunity_reset_cache', handleResetCache);
    return () => {
      unsubscribeAuth();
      if (unsubscribeGatherings) {
        unsubscribeGatherings();
      }
      window.removeEventListener('gcommunity_reset_cache', handleResetCache);
    };
  }, []);

  useEffect(() => {
    // Check initial load URL parameter scanning
    const params = new URLSearchParams(window.location.search);
    const gid = params.get('gatheringId');
    if (gid) {
      const saved = localStorage.getItem('gatherings');
      const loadedGatherings = saved ? JSON.parse(saved) : SEED_GATHERINGS;
      const g = loadedGatherings.find((x: any) => x.id === gid);
      if (g) {
        setSearchQuery(g.title);
        setView('discover');
        setScannedAlert(`Navigated to: ${g.title}`);
      }
    }

    // Check map view parameters for restoring shared map view filters
    const viewParam = params.get('view');
    const mapCategoryParam = params.get('mapCategory');
    const mapSearchParam = params.get('mapSearch');
    const mapStartParam = params.get('mapStart');
    const mapEndParam = params.get('mapEnd');
    const mapMinCapParam = params.get('mapMinCapacity');
    const mapMaxCapParam = params.get('mapMaxCapacity');

    if (viewParam === 'map' || mapCategoryParam || mapSearchParam || mapStartParam || mapEndParam || mapMinCapParam || mapMaxCapParam) {
      setView('discover');
      setDiscoverMode('map');
      if (mapCategoryParam) {
        setSelectedMapCategory(mapCategoryParam as any);
      }
      if (mapSearchParam) {
        setSearchQuery(mapSearchParam);
      }
      if (mapStartParam) {
        setStartDate(mapStartParam);
      }
      if (mapEndParam) {
        setEndDate(mapEndParam);
      }
      if (mapMinCapParam) {
        setMinCapacity(parseInt(mapMinCapParam, 10));
      }
      if (mapMaxCapParam) {
        setMaxCapacity(parseInt(mapMaxCapParam, 10));
      }
    }

    // Listener for camera scans inside app
    const handleScanSuccess = (e: Event) => {
      const expiry = localStorage.getItem('gcommunity_scan_cooldown_expiry');
      if (expiry && parseInt(expiry, 10) > Date.now()) {
        console.log("Scan blocked: Cooldown is active.");
        return;
      }

      const customEvent = e as CustomEvent;
      const scannedId = customEvent.detail?.gatheringId;
      if (scannedId) {
        setGatherings((currentGatherings) => {
          let updatedGatherings = [...currentGatherings];
          const g = currentGatherings.find(x => x.id === scannedId);
          if (g) {
            incrementQrScansForGathering(scannedId);
            setSearchQuery(g.title);
            setView('discover');
            
            const wasAttending = g.attendeeIds.includes(CURRENT_USER.id);
            if (!wasAttending && g.attendeeIds.length < g.capacity) {
              let updatedItem: Gathering | null = null;
              updatedGatherings = currentGatherings.map(item => {
                if (item.id === scannedId) {
                  updatedItem = {
                     ...item,
                     attendeeIds: [...item.attendeeIds, CURRENT_USER.id],
                     maybeIds: item.maybeIds.filter(id => id !== CURRENT_USER.id)
                  };
                  return updatedItem;
                }
                return item;
              });

              if (updatedItem) {
                setDoc(doc(db, "gatherings", scannedId), updatedItem).catch(console.error);
              }
              
              // Increment lifetime count
              const currentCount = parseInt(localStorage.getItem('gcommunity_total_scans') || '0', 10);
              localStorage.setItem('gcommunity_total_scans', String(currentCount + 1));
              
              // Increment Scan Streak
              const currentStreak = parseInt(localStorage.getItem('gcommunity_scan_streak') || '0', 10);
              localStorage.setItem('gcommunity_scan_streak', String(currentStreak + 1));
              
              window.dispatchEvent(new Event('gcommunity_total_scans_updated'));
              
              setScannedAlert(`Successfully Scanned and Joined: "${g.title}"!`);
            } else {
              setScannedAlert(wasAttending ? `Scanned: "${g.title}" (already joined)` : `Scanned: "${g.title}" (capacity full)`);
            }
            
            // Start 60-second cooldown for successful scanning validation
            const cooldownExpiry = Date.now() + 60000;
            localStorage.setItem('gcommunity_scan_cooldown_expiry', String(cooldownExpiry));
            window.dispatchEvent(new CustomEvent('gcommunity_scan_cooldown_started', { detail: { expiry: cooldownExpiry } }));

            // Scroll to the active element if it exists
            setTimeout(() => {
              const el = document.getElementById(`gathering-card-${scannedId}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-4', 'ring-olive/30', 'transition-all');
                setTimeout(() => el.classList.remove('ring-4', 'ring-olive/30'), 3000);
              }
            }, 300);
          } else {
            setScannedAlert(`Scanned Code: Gathering ID "${scannedId}" not found in local records.`);
          }
          
          localStorage.setItem('gatherings', JSON.stringify(updatedGatherings));
          return updatedGatherings;
        });
      }
    };

    const handleReAccess = (e: Event) => {
      const customEvent = e as CustomEvent;
      const title = customEvent.detail?.title;
      if (title) {
        setSearchQuery(title);
        setView('discover');
        setTimeout(() => {
          const saved = localStorage.getItem('gatherings');
          const loadedGatherings = saved ? JSON.parse(saved) : SEED_GATHERINGS;
          const g = loadedGatherings.find((x: any) => x.title === title);
          if (g) {
            const el = document.getElementById(`gathering-card-${g.id}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-4', 'ring-olive/30', 'transition-all');
              setTimeout(() => el.classList.remove('ring-4', 'ring-olive/30'), 3000);
            }
          }
        }, 300);
      }
    };

    window.addEventListener('gcommunity_scan_success', handleScanSuccess);
    window.addEventListener('gcommunity_reaccess_gathering', handleReAccess);
    return () => {
      window.removeEventListener('gcommunity_scan_success', handleScanSuccess);
      window.removeEventListener('gcommunity_reaccess_gathering', handleReAccess);
    };
  }, []);

  const saveGathering = async (newGathering: Gathering) => {
    const updated = [newGathering, ...gatherings];
    setGatherings(updated);
    localStorage.setItem('gatherings', JSON.stringify(updated));

    // Write to Firestore
    try {
      await setDoc(doc(db, "gatherings", newGathering.id), newGathering);
    } catch (err) {
      console.error("Error saving gathering to Firestore:", err);
    }
  };

  const handleSuggest = async () => {
    setIsGenerating(true);
    try {
      const idea = await generateGatheringIdea(['music', 'outdoor', 'community', 'crafts']);
      setAiIdea(idea);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const showIcebreakers = async (gathering: Gathering) => {
    setActiveGathering(gathering);
    try {
      const questions = await generateIcebreakers(gathering.title);
      setIcebreakers(questions);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRSVP = async (gatheringId: string, status: 'attending' | 'maybe' | 'not_attending') => {
    let targetGathering: Gathering | null = null;
    const updated = gatherings.map(g => {
      if (g.id === gatheringId) {
        let newAttendeeIds = g.attendeeIds.filter(id => id !== CURRENT_USER.id);
        let newMaybeIds = g.maybeIds.filter(id => id !== CURRENT_USER.id);

        const wasAttending = g.attendeeIds.includes(CURRENT_USER.id);

        if (status === 'attending') {
          if (newAttendeeIds.length < g.capacity) {
            newAttendeeIds.push(CURRENT_USER.id);
            if (!wasAttending) {
              const currentCount = parseInt(localStorage.getItem('gcommunity_total_scans') || '0', 10);
              localStorage.setItem('gcommunity_total_scans', String(currentCount + 1));
              
              // Also increment scan streak
              const currentStreak = parseInt(localStorage.getItem('gcommunity_scan_streak') || '0', 10);
              localStorage.setItem('gcommunity_scan_streak', String(currentStreak + 1));
              
              window.dispatchEvent(new Event('gcommunity_total_scans_updated'));
            }
          } else {
            return g; // Capacity full
          }
        } else if (status === 'maybe') {
          newMaybeIds.push(CURRENT_USER.id);
        }
        
        targetGathering = { ...g, attendeeIds: newAttendeeIds, maybeIds: newMaybeIds };
        return targetGathering;
      }
      return g;
    });
    setGatherings(updated);
    localStorage.setItem('gatherings', JSON.stringify(updated));

    if (targetGathering) {
      try {
        await setDoc(doc(db, "gatherings", gatheringId), targetGathering);
      } catch (err) {
        console.error("Error pushing RSVP to Firestore:", err);
      }
    }
  };

  const filteredGatherings = gatherings.filter(g => {
    const matchesCategory = selectedCategory === 'All' || g.category === selectedCategory || (g.tags && g.tags.includes(selectedCategory as any));
    const matchesStartDate = !startDate || g.date >= startDate;
    const matchesEndDate = !endDate || g.date <= endDate;
    const matchesCapacity = g.capacity >= minCapacity && (maxCapacity === 100 || g.capacity <= maxCapacity);
    const matchesSearch = !searchQuery || 
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      g.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.tags && g.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCategory && matchesStartDate && matchesEndDate && matchesCapacity && matchesSearch;
  });

  return (
    <div className="min-h-screen pb-20">
      {/* Alert banner */}
      <AnimatePresence>
        {scannedAlert && (
          <motion.div
            initial={{ opacity: 0, y: -100, x: '-50%', scaleX: 0.2, scaleY: 0.7 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              x: '-50%',
              scaleX: 1,
              scaleY: 1
            }}
            exit={{ opacity: 0, y: -40, x: '-50%', scaleX: 0.4, scaleY: 0.8 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 24,
              mass: 1
            }}
            style={{ transformOrigin: 'top center' }}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                const nextVal = !isScanChimeEnabled;
                localStorage.setItem('gcommunity_scan_chime_enabled', String(nextVal));
                setIsScanChimeEnabled(nextVal);
                window.dispatchEvent(new Event('gcommunity_chime_settings_updated'));
                if (nextVal) {
                  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                    navigator.vibrate(40);
                  }
                }
              }
            }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 border border-stone-800 text-stone-100 px-6 py-3.5 rounded-3xl flex items-center gap-3.5 shadow-2xl relative overflow-hidden group focus:outline-none focus:ring-2 focus:ring-olive focus:ring-offset-2 focus:ring-offset-stone-900 transition-shadow duration-200"
            id="gcommunity-scanned-alert"
            title="Scan info banner. Press 'M' to toggle chime sound."
          >
            {/* Elegant warm dynamic glowing backdrop behind the alert */}
            <motion.div 
              className="absolute -inset-2 rounded-3xl -z-10 opacity-70 blur-md bg-gradient-to-r from-emerald-500/70 via-olive/80 to-amber-500/70"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                scale: [0.93, 1.04, 0.93],
              }}
              transition={{
                backgroundPosition: { duration: 3.5, repeat: Infinity, ease: "linear" },
                scale: { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
              }}
              style={{ backgroundSize: "200% 200%" }}
            />
            
            {/* Subtly pulsing subtle inner border overlay */}
            <motion.div 
              className="absolute inset-0 rounded-3xl border border-olive/35 pointer-events-none z-0"
              animate={{
                opacity: [0.4, 0.9, 0.4],
                scale: [0.985, 1.015, 0.985]
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Moving premium visual shimmer glare inside the alert banner - loops infinitely */}
            <motion.div
              className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/12 to-transparent skew-x-12 pointer-events-none z-0"
              animate={{ x: ['-150%', '350%'] }}
              transition={{ 
                duration: 2.0, 
                delay: 0.2, 
                repeat: Infinity, 
                repeatDelay: 3.5, 
                ease: "easeInOut" 
              }}
            />

            <div className="w-5 h-5 bg-olive rounded-full flex items-center justify-center shrink-0 relative z-10 animate-pulse">
              <Sparkles className="w-3 h-3 text-warm-white animate-spin-slow" />
            </div>
            
            {/* Timer countdown and message texts inside gcommunity-scanned-alert */}
            <div className="flex flex-col gap-1 relative z-10" id="alert-text-timer-container">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider pr-1 text-stone-100">{scannedAlert}</span>
                {scanCooldown > 0 && (
                  <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded-md border border-amber-400/20 select-none shrink-0" id="cooldown-numeric-badge">
                    Cooldown: {scanCooldown}s
                  </span>
                )}
              </div>
              
              {/* Small visual timer indicator below success scan message */}
              {scanCooldown > 0 && (
                <div className="w-full min-w-[120px] h-1 bg-stone-850 rounded-full overflow-hidden mt-0.5" id="cooldown-progress-container" title={`${scanCooldown}s until duplicate scan locks release`}>
                  <motion.div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                    initial={{ width: "100%" }}
                    animate={{ width: `${(scanCooldown / 60) * 100}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
              )}
            </div>

            <div className="h-4 w-[1px] bg-stone-700/60 relative z-10 mx-0.5" />
            <div className="flex items-center gap-2 relative z-10 bg-stone-950/40 px-2.5 py-1 rounded-full border border-stone-800/40">
              {/* Mute Success Chime Shortcut & Precise Volume Level Slider */}
              <div className="flex items-center gap-1.5" id="banner-sound-controls-group">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextVal = !isScanChimeEnabled;
                    localStorage.setItem('gcommunity_scan_chime_enabled', String(nextVal));
                    setIsScanChimeEnabled(nextVal);
                    window.dispatchEvent(new Event('gcommunity_chime_settings_updated'));
                    if (nextVal) {
                      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                        navigator.vibrate(40);
                      }
                    }
                  }}
                  className={`p-1 rounded-md transition-all duration-200 focus:outline-none cursor-pointer ${
                    isScanChimeEnabled 
                      ? 'text-emerald-400 hover:text-emerald-300 hover:bg-stone-850' 
                      : 'text-stone-500 hover:text-stone-300 hover:bg-stone-850'
                  }`}
                  title={isScanChimeEnabled ? "Mute Success Chime" : "Unmute Success Chime"}
                  id="mute-sound-shortcut-btn"
                  aria-label={isScanChimeEnabled ? "Mute Success Chime" : "Unmute Success Chime"}
                >
                  {isScanChimeEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-rose-450" />
                  )}
                </button>

                {/* Precise volume slider */}
                <div className="flex items-center gap-1.5 min-w-[90px]" id="banner-chime-slider-container">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isScanChimeEnabled ? scanVolume : 0}
                    disabled={!isScanChimeEnabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      const newVol = parseFloat(e.target.value);
                      localStorage.setItem('gcommunity_scan_volume', String(newVol));
                      setScanVolume(newVol);
                      window.dispatchEvent(new Event('gcommunity_volume_updated'));
                      if (newVol > 0 && !isScanChimeEnabled) {
                        localStorage.setItem('gcommunity_scan_chime_enabled', 'true');
                        setIsScanChimeEnabled(true);
                        window.dispatchEvent(new Event('gcommunity_chime_settings_updated'));
                      }
                    }}
                    className={`w-12 h-1 rounded-lg appearance-none cursor-pointer focus:outline-none accent-olive ${
                      isScanChimeEnabled ? 'bg-stone-800' : 'bg-stone-900/40 opacity-45 cursor-not-allowed'
                    }`}
                    title={`Scan Success Chime Volume: ${Math.round((isScanChimeEnabled ? scanVolume : 0) * 100)}%`}
                    id="scan-volume-slider-banner"
                    aria-label="Success chime volume level slider"
                  />

                  {/* Animated Mini Waveform responding to chime volume */}
                  <div 
                    className="flex items-end gap-[1.5px] h-3.5 w-4 px-0.5 select-none"
                    id="volume-mini-waveform"
                    title={`Mini audio waveform reacting to volume (${Math.round((isScanChimeEnabled ? scanVolume : 0) * 100)}%)`}
                  >
                    {[0.6, 1.0, 0.7, 0.4].map((baseMultiplier, idx) => {
                      const isActive = isScanChimeEnabled && scanVolume > 0;
                      const effectiveVol = isScanChimeEnabled ? scanVolume : 0;
                      return (
                        <motion.div
                          key={idx}
                          className={`w-[1.5px] rounded-full transition-colors duration-300 ${isActive ? 'bg-emerald-400' : 'bg-stone-600/50'}`}
                          animate={!isActive ? {
                            height: "2px"
                          } : {
                            height: [
                              `${2 + baseMultiplier * 10 * effectiveVol}px`,
                              `${2 + baseMultiplier * 2 * effectiveVol}px`,
                              `${2 + baseMultiplier * 10 * effectiveVol}px`
                            ]
                          }}
                          transition={!isActive ? {} : {
                            duration: 0.5 + idx * 0.12,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          style={{ originY: 1 }}
                        />
                      );
                    })}
                  </div>

                  <span className={`text-[9px] font-mono font-bold w-5 text-right select-none ${isScanChimeEnabled ? 'text-stone-400' : 'text-stone-600'}`}>
                    {Math.round((isScanChimeEnabled ? scanVolume : 0) * 100)}%
                  </span>
                </div>
              </div>

              <div className="h-3 w-[1px] bg-stone-800" />

              {/* Sound Effects Toggle (Chime & Vibrations collectively) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextVal = !isScanFeedbackEnabled;
                  localStorage.setItem('gcommunity_scan_feedback_enabled', String(nextVal));
                  setIsScanFeedbackEnabled(nextVal);
                  window.dispatchEvent(new Event('gcommunity_feedback_settings_updated'));
                  if (nextVal) {
                    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                      navigator.vibrate(40);
                    }
                  }
                }}
                className="focus:outline-none cursor-pointer flex items-center gap-1.5 p-1 rounded-md transition-all duration-200 hover:bg-stone-850 group/fx"
                title={isScanFeedbackEnabled ? "Disable Sound & Vibration Feedback" : "Enable Sound & Vibration Feedback"}
                id="sound-effects-feedback-toggle-btn"
                aria-label={isScanFeedbackEnabled ? "Disable Sound & Vibration Feedback" : "Enable Sound & Vibration Feedback"}
              >
                <Sliders className={`w-4 h-4 transition-colors duration-200 ${isScanFeedbackEnabled ? 'text-olive group-hover/fx:text-emerald-400' : 'text-stone-500 group-hover/fx:text-stone-300'}`} />
                <span className={`text-[10px] tracking-wide font-extrabold uppercase select-none transition-colors duration-200 ${isScanFeedbackEnabled ? 'text-olive group-hover/fx:text-emerald-400' : 'text-stone-500 group-hover/fx:text-stone-300'}`}>
                   {isScanFeedbackEnabled ? "FX On" : "FX Off"}
                 </span>
               </button>
 
               <div className="h-3 w-[1px] bg-stone-800" />
 
               {/* Alert Notification Bell Toggle */}
               <button
                 type="button"
                 onClick={(e) => {
                   e.stopPropagation();
                   const nextVal = !isAlertSoundEnabled;
                   localStorage.setItem('gcommunity_alert_sound_enabled', String(nextVal));
                   setIsAlertSoundEnabled(nextVal);
                   if (nextVal) {
                     playAlertNotificationSound(scanVolume);
                   }
                 }}
                 className={`p-1 rounded-md transition-all duration-200 focus:outline-none cursor-pointer flex items-center justify-center shrink-0 hover:bg-stone-800/60 ${
                   isAlertSoundEnabled 
                     ? 'text-amber-400 hover:text-amber-300' 
                     : 'text-stone-500 hover:text-stone-300'
                 }`}
                 title={isAlertSoundEnabled ? "Mute Alert Banner Notification" : "Unmute Alert Banner Notification"}
                 id="toggle-alert-sound-btn"
                 aria-label={isAlertSoundEnabled ? "Mute alert sound" : "Unmute alert sound"}
               >
                 {isAlertSoundEnabled ? (
                   <Bell className="w-4 h-4 active:scale-90 transition-transform" />
                 ) : (
                   <BellOff className="w-4 h-4 text-rose-450 active:scale-90 transition-transform" />
                 )}
               </button>
 
               <div className="h-3 w-[1px] bg-stone-800" />
 
               {/* Banner Auto-dismiss/Sticky Duration Cycle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const durations = ['2s', '4s', '8s', 'sticky'];
                  const currentIndex = durations.indexOf(alertDuration);
                  const nextIndex = (currentIndex + 1) % durations.length;
                  const nextVal = durations[nextIndex];
                  localStorage.setItem('gcommunity_alert_duration', nextVal);
                  setAlertDuration(nextVal);
                  window.dispatchEvent(new Event('gcommunity_alert_duration_updated'));
                  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                    navigator.vibrate(20);
                  }
                }}
                className="focus:outline-none cursor-pointer flex items-center gap-1.5 p-1 rounded-md transition-all duration-200 hover:bg-stone-850 group/dur"
                title={`Banner Duration: ${alertDuration === 'sticky' ? 'Keep visible (Sticky)' : alertDuration}. Click to cycle.`}
                id="banner-duration-toggle-btn"
                aria-label={`Banner Duration: ${alertDuration === 'sticky' ? 'Keep visible (Sticky)' : alertDuration}`}
              >
                <Timer className={`w-4 h-4 transition-colors duration-200 ${alertDuration === 'sticky' ? 'text-amber-400 group-hover/dur:text-amber-300 animate-pulse' : 'text-stone-400 group-hover/dur:text-stone-200'}`} />
                <span className={`text-[10px] tracking-wide font-extrabold uppercase select-none transition-colors duration-200 ${alertDuration === 'sticky' ? 'text-amber-400 group-hover/dur:text-amber-300' : 'text-stone-400 group-hover/dur:text-stone-200'}`}>
                  {alertDuration === 'sticky' ? "Sticky" : alertDuration}
                </span>
              </button>

              <div className="h-3 w-[1px] bg-stone-800" />

              {/* Manual Dismiss Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setScannedAlert(null);
                }}
                className="p-1 rounded-md transition-all duration-200 text-stone-500 hover:text-rose-450 hover:bg-stone-850 focus:outline-none cursor-pointer"
                title="Dismiss Banner"
                id="dismiss-scanned-alert-btn"
                aria-label="Dismiss Banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1-Hour Reminder active HUD banner */}
      <AnimatePresence>
        {activePushNotification && (
          <motion.div
            initial={{ opacity: 0, y: -100, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: -100, scale: 0.9, x: '-50%' }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm bg-white border border-stone-150 p-4 rounded-3xl shadow-xl flex items-start gap-4"
            id={`push-notif-hud-${activePushNotification.id}`}
          >
            <div className="w-10 h-10 bg-olive rounded-full flex items-center justify-center shrink-0 shadow-md animate-bounce">
              <Bell className="w-5 h-5 text-zinc-100" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex justify-between items-start gap-2">
                <h4 className="serif text-xs font-bold text-olive">{activePushNotification.title}</h4>
                <span className="text-[9px] text-[#8c8a7c] font-mono whitespace-nowrap mt-0.5">{activePushNotification.date}</span>
              </div>
              <p className="text-[11px] text-[#55524b] mt-1 leading-normal font-light">{activePushNotification.message}</p>
            </div>
            <button 
              onClick={() => setActivePushNotification(null)}
              className="p-1 text-stone-400 hover:text-stone-650 rounded-lg hover:bg-stone-55 transition-colors shrink-0"
              aria-label="Close notification banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-6 sticky top-0 bg-warm-bg/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
          <div className="w-8 h-8 bg-olive rounded-full flex items-center justify-center">
            <Users className="text-warm-white w-4 h-4" />
          </div>
          <span className="serif text-2xl font-semibold tracking-tight">Gather</span>
        </div>
        <div className="flex items-center gap-8">
          <button 
            onClick={() => setView('discover')}
            className={`text-sm font-medium transition-all ${view === 'discover' ? 'active-tab-underline text-olive' : 'text-gray-500 hover:text-olive'}`}
          >
            Discover
          </button>
          <button 
            onClick={() => setView('architect')}
            className={`text-sm font-medium transition-all ${view === 'architect' ? 'active-tab-underline text-olive' : 'text-gray-500 hover:text-olive'}`}
          >
            AI Architect
          </button>
          <button 
            onClick={() => setView('music')}
            className={`text-sm font-medium transition-all ${view === 'music' ? 'active-tab-underline text-olive' : 'text-gray-500 hover:text-olive'}`}
          >
            Theme Music
          </button>
          <div 
            onClick={() => setActiveProfile(CURRENT_USER)}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-olive/20 cursor-pointer hover:border-olive transition-colors"
          >
            <img src={CURRENT_USER.avatar} alt={CURRENT_USER.name} className="w-full h-full object-cover" />
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="olive-button flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Host
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 pt-12">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-24"
            >
              {/* Hero */}
              <section className="text-center space-y-8 max-w-3xl mx-auto">
                <motion.h1 
                  className="serif text-7xl md:text-8xl leading-none font-light tracking-tighter"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8 }}
                >
                  Belonging is a <span className="italic">shared</span> craft.
                </motion.h1>
                <p className="text-lg text-gray-600 max-w-xl mx-auto font-light">
                  Gather helps you find and create meaningful connections through local activities designed to bring us closer together.
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button onClick={() => setView('discover')} className="olive-button flex items-center gap-2 px-8 py-4">
                    Explore Gatherings
                  </button>
                  <button onClick={() => setView('architect')} className="px-8 py-4 rounded-full border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-olive" />
                    AI Ideas
                  </button>
                </div>
              </section>

              {/* Featured Categories */}
              <section className="space-y-8">
                <h2 className="serif text-3xl">Ways to Gather</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setView('discover');
                      }}
                      className="warm-card p-6 flex flex-col items-center gap-4 text-center group"
                    >
                      <div className="w-12 h-12 rounded-full bg-olive/5 flex items-center justify-center group-hover:bg-olive transition-colors">
                        {getCategoryIcon(cat)}
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 group-hover:text-olive">
                        {cat}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Latest Gatherings Preview */}
              <section className="space-y-8">
                <div className="flex items-end justify-between">
                  <h2 className="serif text-3xl">Recently Shared</h2>
                  <button onClick={() => setView('discover')} className="text-sm font-medium text-olive flex items-center gap-1">
                    View all <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {gatherings.slice(0, 4).map((g) => (
                    <GatheringCard 
                      key={g.id} 
                      gathering={g} 
                      reminders={eventReminders[g.id] || { email: false, push: false }}
                      onToggleReminder={(type) => toggleEventReminder(g.id, type)}
                      onIcebreakers={() => showIcebreakers(g)} 
                      onRSVP={(status) => handleRSVP(g.id, status)}
                      onViewHost={() => setActiveProfile(users.find(u => u.id === g.hostId) || null)}
                      users={users}
                      selectedTag={selectedCategory}
                      onSelectTag={(tag) => {
                        setSelectedCategory(tag);
                        setView('discover');
                      }}
                    />
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {view === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-6 flex-1">
                    <h1 className="serif text-5xl">Discover Gatherings</h1>

                    {/* Search Bar with clear title/location/description real-time filtering feedback */}
                    <div className="space-y-2 max-w-md w-full">
                      <div className="relative" id="discover-search-container">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" id="discover-search-icon-wrapper">
                          <Search className="h-4 w-4 text-olive/50" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search by title, location, or description..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-11 pr-10 py-3 bg-white/70 focus:bg-white border border-olive/15 focus:border-olive rounded-2xl text-sm transition-all focus:outline-none focus:ring-4 focus:ring-olive/5 shadow-sm placeholder:text-stone-400"
                          id="discover-search-input"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-450 hover:text-olive transition-colors"
                            title="Clear search query"
                            id="discover-search-clear-btn"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] text-stone-450/90 font-medium">
                          Filters title, location & description in real-time
                        </span>
                        {searchQuery && (
                          <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Active filter
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedCategory('All')}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === 'All' ? 'bg-olive text-warm-white' : 'bg-white border border-gray-100'}`}
                      >
                        All
                      </button>
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat ? 'bg-olive text-warm-white' : 'bg-white border border-gray-100'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex bg-white/50 rounded-full border border-gray-100 p-1">
                      <button 
                        onClick={() => setDiscoverMode('list')}
                        className={`p-2 rounded-full transition-all ${discoverMode === 'list' ? 'bg-olive text-white' : 'text-gray-400 hover:text-olive'}`}
                      >
                        <ListIcon className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDiscoverMode('map')}
                        className={`p-2 rounded-full transition-all ${discoverMode === 'map' ? 'bg-olive text-white' : 'text-gray-400 hover:text-olive'}`}
                      >
                        <MapIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-white/50 rounded-[24px] border border-gray-100">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-olive/60" />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-tight text-gray-400">From</span>
                          <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-sm bg-transparent border-none p-0 focus:ring-0 cursor-pointer" 
                          />
                        </div>
                      </div>
                      <div className="hidden sm:block w-px h-8 bg-gray-200" />
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-tight text-gray-400">To</span>
                          <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-sm bg-transparent border-none p-0 focus:ring-0 cursor-pointer" 
                          />
                        </div>
                      </div>
                      {(startDate || endDate) && (
                        <button 
                          onClick={() => { setStartDate(''); setEndDate(''); }}
                          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                          title="Clear dates"
                        >
                          <X className="w-3 h-3 text-gray-400" />
                        </button>
                      )}
                    </div>

                    {/* Capacity range slider filter card */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-white/50 rounded-[24px] border border-gray-100 min-w-[280px]">
                      <div className="flex items-center gap-3 shrink-0">
                        <Users className="w-4 h-4 text-olive/60" />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-tight text-gray-400">Capacity limits</span>
                          <span className="text-xs font-semibold text-olive/90">
                            {minCapacity === 1 && maxCapacity === 100 ? 'Any Capacity' : `${minCapacity} - ${maxCapacity === 100 ? '100+' : maxCapacity}`}
                          </span>
                        </div>
                      </div>
                      <div className="hidden sm:block w-px h-8 bg-gray-200 shrink-0" />
                      <div className="flex flex-col gap-1.5 w-full sm:w-44">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                          <span>Min: <span className="text-gray-700 font-extrabold">{minCapacity}</span></span>
                          <span>Max: <span className="text-gray-700 font-extrabold">{maxCapacity === 100 ? '100+' : maxCapacity}</span></span>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-400 font-bold tracking-wider w-6 uppercase">Min</span>
                            <input 
                              type="range"
                              min="1"
                              max="100"
                              value={minCapacity}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setMinCapacity(val);
                                if (val > maxCapacity) {
                                  setMaxCapacity(val);
                                }
                              }}
                              className="accent-olive h-1 w-full bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              id="capacity-min-slider"
                              title="Minimum gathering capacity limit"
                            />
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-400 font-bold tracking-wider w-6 uppercase">Max</span>
                            <input 
                              type="range"
                              min="1"
                              max="100"
                              value={maxCapacity}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setMaxCapacity(val);
                                if (val < minCapacity) {
                                  setMinCapacity(val);
                                }
                              }}
                              className="accent-olive h-1 w-full bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              id="capacity-max-slider"
                              title="Maximum gathering capacity limit"
                            />
                          </div>
                        </div>
                      </div>
                      {(minCapacity > 1 || maxCapacity < 100) && (
                        <button 
                          onClick={() => { setMinCapacity(1); setMaxCapacity(100); }}
                          className="p-1.5 hover:bg-gray-150 rounded-full transition-colors shrink-0"
                          title="Reset capacity filters"
                          id="reset-capacity-btn"
                        >
                          <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500 transition-colors" />
                        </button>
                      )}
                    </div>
                  </div>
              </div>
            </div>

            {discoverMode === 'list' ? (
                filteredGatherings.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredGatherings.map((g) => (
                      <GatheringCard 
                        key={g.id} 
                        gathering={g} 
                        reminders={eventReminders[g.id] || { email: false, push: false }}
                        onToggleReminder={(type) => toggleEventReminder(g.id, type)}
                        onIcebreakers={() => showIcebreakers(g)} 
                        onRSVP={(status) => handleRSVP(g.id, status)}
                        onViewHost={() => setActiveProfile(users.find(u => u.id === g.hostId) || null)}
                        users={users}
                        selectedTag={selectedCategory}
                        onSelectTag={(tag) => {
                          setSelectedCategory(tag);
                          setView('discover');
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center warm-card border-dashed border-2 border-olive/20 rounded-[32px] bg-stone-50/50" id="empty-search-state">
                    <div className="w-14 h-14 bg-olive/5 rounded-full flex items-center justify-center mb-4">
                      <Search className="w-6 h-6 text-olive/50" />
                    </div>
                    <h3 className="serif text-xl font-medium text-gray-800 mb-2">No gatherings match your search</h3>
                    <p className="text-sm text-gray-500 max-w-md mb-6">We couldn't find any gatherings matching your current filters or keywords. Try checking other categories or clearing your search.</p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('All');
                        setStartDate('');
                        setEndDate('');
                        setMinCapacity(1);
                        setMaxCapacity(100);
                      }}
                      className="px-6 py-2.5 bg-olive text-warm-white rounded-full text-xs font-bold uppercase tracking-wider shadow-sm hover:opacity-90 transition-all"
                      id="clear-all-filters-btn"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )
              ) : (
                <motion.div 
                  ref={mapContainerRef}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`warm-card h-[600px] relative overflow-hidden transition-all duration-500 border-olive/10 ${
                    mapHighlightActive ? 'animate-map-highlight ring-2 ring-rose-450/45' : ''
                  } ${
                    isHighContrastDark
                      ? mapStyle === 'satellite'
                        ? 'map-style-satellite bg-[#030712]' 
                        : mapStyle === 'terrain'
                        ? 'map-style-terrain bg-[#1c1917] border-stone-800'
                        : 'map-style-standard bg-[#0c0a09]'
                      : mapStyle === 'satellite' 
                      ? 'map-style-satellite bg-[#111827]' 
                      : mapStyle === 'terrain'
                      ? 'map-style-terrain bg-[#d2c9ad] border-amber-900/10' 
                      : 'map-style-standard bg-[#e0e0d1]'
                  }`}
                >
                  {/* Floating Filter Overlay */}
                  <div data-html2canvas-ignore="true" className="absolute top-4 left-4 right-4 z-30 flex flex-col md:flex-row gap-3 items-center justify-center max-w-4xl mx-auto">
                    {/* Map Category Pills */}
                    <motion.div 
                      variants={{
                        hidden: { opacity: 0 },
                        visible: {
                          opacity: 1,
                          transition: {
                            staggerChildren: 0.06,
                            delayChildren: 0.1
                          }
                        }
                      }}
                      initial="hidden"
                      animate="visible"
                      className="bg-white/85 backdrop-blur-md p-1.5 rounded-[24px] border border-olive/15 shadow-md flex flex-wrap gap-1 hover:bg-white/95 transition-all duration-300 items-center justify-center"
                    >
                      <motion.button
                        variants={{
                          hidden: { y: 15, opacity: 0 },
                          visible: { 
                            y: 0, 
                            opacity: 1,
                            transition: {
                              type: "spring",
                              stiffness: 260,
                              damping: 18
                            }
                          }
                        }}
                        onClick={() => setSelectedMapCategory('All')}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${selectedMapCategory === 'All' ? 'bg-olive text-warm-white shadow-sm' : 'text-gray-600 hover:bg-olive/5 hover:text-olive'}`}
                        id="map-filter-category-all"
                      >
                        All
                      </motion.button>
                      <motion.button
                        variants={{
                          hidden: { y: 15, opacity: 0 },
                          visible: { 
                            y: 0, 
                            opacity: 1,
                            transition: {
                              type: "spring",
                              stiffness: 260,
                              damping: 18
                            }
                          }
                        }}
                        onClick={() => setSelectedMapCategory('Nearby')}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${selectedMapCategory === 'Nearby' ? 'bg-olive text-warm-white shadow-sm' : 'text-gray-600 hover:bg-olive/5 hover:text-olive'}`}
                        id="map-filter-category-nearby"
                        title="Filter events close to you"
                      >
                        <Compass className="w-3.5 h-3.5 text-current shrink-0 animate-pulse" />
                        <span>Nearby</span>
                      </motion.button>
                      {CATEGORIES.map(cat => (
                        <motion.button
                          key={cat}
                          variants={{
                            hidden: { y: 15, opacity: 0 },
                            visible: { 
                              y: 0, 
                              opacity: 1,
                              transition: {
                                type: "spring",
                                stiffness: 260,
                                damping: 18
                              }
                            }
                          }}
                          onClick={() => setSelectedMapCategory(cat)}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${selectedMapCategory === cat ? 'bg-olive text-warm-white shadow-sm' : 'text-gray-600 hover:bg-olive/5 hover:text-olive'}`}
                          id={`map-filter-category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <span className="scale-75 origin-center inline-block -mx-1 [&_svg]:!text-current">
                            {getCategoryIcon(cat)}
                          </span>
                          <span>{cat}</span>
                        </motion.button>
                      ))}
                      
                      <div className="w-[1px] h-5 bg-stone-200 mx-0.5 self-center" />
                      
                      <motion.button
                        variants={{
                          hidden: { y: 15, opacity: 0 },
                          visible: { 
                            y: 0, 
                            opacity: 1,
                            transition: {
                              type: "spring",
                              stiffness: 260,
                              damping: 18
                            }
                          }
                        }}
                        onClick={() => {
                          setCopiedShareMapLink(false);
                          setIsShareMapModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-700 hover:text-white text-emerald-800 border border-emerald-200/55 cursor-pointer shadow-xs"
                        id="map-filter-category-share"
                        title="Share currently filtered map view"
                      >
                        <Share2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Share View</span>
                      </motion.button>
                    </motion.div>

                    {/* Map Date-Range controls */}
                    <div className="bg-white/85 backdrop-blur-md px-4 py-2 rounded-[24px] border border-olive/15 shadow-md flex items-center gap-2.5 text-xs hover:bg-white/95 transition-all duration-300">
                      <Calendar className="w-3.5 h-3.5 text-olive/70 shrink-0" />
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-tight text-stone-400">From</span>
                        <input 
                          type="date" 
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="bg-transparent border-none p-0 text-[11px] focus:ring-0 cursor-pointer w-[95px] text-gray-700 font-medium" 
                          id="map-filter-start-date"
                        />
                      </div>
                      <div className="w-[1px] h-3.5 bg-stone-300" />
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-tight text-stone-400">To</span>
                        <input 
                          type="date" 
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="bg-transparent border-none p-0 text-[11px] focus:ring-0 cursor-pointer w-[95px] text-gray-700 font-medium" 
                          id="map-filter-end-date"
                        />
                      </div>
                      {(startDate || endDate) && (
                        <button 
                          onClick={() => { setStartDate(''); setEndDate(''); }}
                          className="p-1 hover:bg-stone-200 rounded-full transition-colors flex items-center justify-center"
                          title="Clear dates"
                          id="map-filter-clear-dates"
                        >
                          <X className="w-3 h-3 text-stone-500" />
                        </button>
                      )}
                    </div>

                    {/* Map Capacity limits controls */}
                    <div className="bg-white/85 backdrop-blur-md px-4 py-1.5 rounded-[24px] border border-olive/15 shadow-md flex items-center gap-3 text-xs hover:bg-white/95 transition-all duration-300">
                      <Users className="w-3.5 h-3.5 text-olive/70 shrink-0" />
                      <div className="flex flex-col shrink-0 min-w-[70px]">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-stone-400 leading-none">Capacity</span>
                        <span className="text-[10px] font-semibold text-olive/95 leading-tight">
                          {minCapacity === 1 && maxCapacity === 100 ? 'Any limit' : `${minCapacity}-${maxCapacity === 100 ? '100+' : maxCapacity}`}
                        </span>
                      </div>
                      <div className="w-[1px] h-6 bg-stone-300 shrink-0" />
                      
                      <div className="flex flex-col gap-0.5 w-[110px]">
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] text-stone-400 font-bold uppercase tracking-widest w-5">Min</span>
                          <input 
                            type="range"
                            min="1"
                            max="100"
                            value={minCapacity}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setMinCapacity(val);
                              if (val > maxCapacity) {
                                setMaxCapacity(val);
                              }
                            }}
                            className="accent-olive h-1 w-full bg-stone-200 rounded-lg appearance-none cursor-pointer"
                            id="map-capacity-min-slider"
                            title="Minimum capacity"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] text-stone-400 font-bold uppercase tracking-widest w-5">Max</span>
                          <input 
                            type="range"
                            min="1"
                            max="100"
                            value={maxCapacity}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setMaxCapacity(val);
                              if (val < minCapacity) {
                                setMinCapacity(val);
                              }
                            }}
                            className="accent-olive h-1 w-full bg-stone-200 rounded-lg appearance-none cursor-pointer"
                            id="map-capacity-max-slider"
                            title="Maximum capacity"
                          />
                        </div>
                      </div>
                      {(minCapacity > 1 || maxCapacity < 100) && (
                        <button 
                          onClick={() => { setMinCapacity(1); setMaxCapacity(100); }}
                          className="p-1 hover:bg-stone-200 rounded-full transition-colors flex items-center justify-center shrink-0"
                          title="Clear capacity filters"
                          id="map-capacity-clear"
                        >
                          <X className="w-2.5 h-2.5 text-stone-500" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Focus Mode Banner */}
                  {focusedClusterId !== null && (
                    <div data-html2canvas-ignore="true" className="absolute top-[80px] md:top-[85px] left-1/2 -translate-x-1/2 z-35 pointer-events-auto flex items-center gap-2 bg-amber-50/95 backdrop-blur-xs border border-amber-200 text-amber-900 rounded-full px-4 py-1.5 shadow-md">
                      <EyeOff className="w-3.5 h-3.5 text-amber-750 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Map Focus Active</span>
                      <button 
                        onClick={() => setFocusedClusterId(null)}
                        className="ml-2 bg-amber-200/60 hover:bg-amber-200 text-amber-950 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase transition-all"
                        id="show-all-pins-banner-btn"
                      >
                        Show All
                      </button>
                    </div>
                  )}

                  {/* Decorative Elements for the "Map" depending on selected style */}
                  <div 
                    className="absolute inset-0 w-full h-full"
                    style={{ 
                      transformOrigin: '50% 50%', 
                      transformStyle: 'preserve-3d',
                      // Custom physics spring-back casing or highly dramatic, elastic spring animation when resetting
                      transition: isResetting
                        ? 'transform 1.9s cubic-bezier(0.15, 1.85, 0.3, 1.18), rotate 1.9s cubic-bezier(0.15, 1.85, 0.3, 1.18)'
                        : 'transform 1.1s cubic-bezier(0.175, 0.885, 0.32, 1.275), rotate 1.2s cubic-bezier(0.34, 1.56, 0.64, 1.1)',
                      willChange: 'transform, rotate',
                      transform: mapCenter 
                        ? `perspective(1000px) scale(${mapCenter.zoom}) translate(${50 - mapCenter.lng}%, ${50 - mapCenter.lat}%)` 
                        : `perspective(1000px) scale(1) translate(0%, 0%)`,
                      rotate: `x ${mapPitch}deg`
                    }}
                  >
                    {/* Cinematic rotation wrapper layer */}
                    <div
                      className="absolute inset-0 w-full h-full"
                      style={{
                        transformOrigin: '50% 50%',
                        transformStyle: 'preserve-3d',
                        animation: isMapRotating ? 'map-rotate-360 80s linear infinite' : 'none'
                      }}
                    >
                  {mapStyle === 'standard' && (
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                      <div className={`absolute top-1/4 left-1/4 w-32 h-32 rounded-full blur-3xl ${isHighContrastDark ? 'bg-emerald-500/10' : 'bg-olive/20'}`} />
                      <div className={`absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full blur-3xl ${isHighContrastDark ? 'bg-emerald-500/5' : 'bg-olive/10'}`} />
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Standard grid lines and pathways */}
                        <path d="M0,50 Q25,30 50,50 T100,50" fill="none" stroke="currentColor" strokeWidth="0.1" className={isHighContrastDark ? 'text-zinc-750' : 'text-olive'} />
                        <path d="M20,0 Q40,50 20,100" fill="none" stroke="currentColor" strokeWidth="0.1" className={isHighContrastDark ? 'text-zinc-750' : 'text-olive'} />
                        <path d="M0,20 L100,20 M0,40 L100,40 M0,60 L100,60 M0,80 L100,80" fill="none" stroke="currentColor" strokeWidth="0.05" className={isHighContrastDark ? 'text-zinc-800' : 'text-olive'} />
                        <path d="M20,0 L20,100 M40,0 L40,100 M60,0 L60,100 M80,0 L80,100" fill="none" stroke="currentColor" strokeWidth="0.05" className={isHighContrastDark ? 'text-zinc-800' : 'text-olive'} />
                        
                        {/* Conditional Styled Street & Landmark Identifiers */}
                        {showMapStyleLabels && (
                          <g className="select-none tracking-wider font-mono opacity-85" fontSize="1.3" fontWeight="bold">
                            <text x="32" y="42" fill={isHighContrastDark ? '#d4d4d8' : '#3f4238'} transform="rotate(-12, 32, 42)">Oak Avenue</text>
                            <text x="18" y="75" fill={isHighContrastDark ? '#d4d4d8' : '#3f4238'} transform="rotate(74, 18, 75)">Valley Highway</text>
                            <text x="70" y="32" fill={isHighContrastDark ? '#34d399' : '#15803d'} fontSize="1.6" className="serif font-extrabold">Pine Plaza Landmark</text>
                            <text x="45" y="88" fill={isHighContrastDark ? '#34d399' : '#15803d'} fontSize="1.4" className="serif font-extrabold">Community Park</text>
                          </g>
                        )}
                      </svg>
                    </div>
                  )}

                  {mapStyle === 'satellite' && (
                    <div className="absolute inset-0 opacity-35 pointer-events-none">
                      {/* Deep oceans or landmass contours styled for night look */}
                      <div className="absolute top-10 left-10 w-44 h-44 bg-teal-800/15 rounded-full blur-3xl" />
                      <div className="absolute bottom-20 right-20 w-64 h-64 bg-emerald-950/25 rounded-full blur-3xl" />
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Satellite orbital scan grid and radar arcs */}
                        <circle cx="50" cy="50" r="30" fill="none" stroke={isHighContrastDark ? '#34d399' : '#2dd4bf'} strokeWidth="0.08" strokeDasharray="1,2" opacity="0.3" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke={isHighContrastDark ? '#059669' : '#10b981'} strokeWidth="0.05" strokeDasharray="2,3" opacity="0.2" />
                        <line x1="50" y1="0" x2="50" y2="100" stroke={isHighContrastDark ? '#34d399' : '#10b981'} strokeWidth="0.05" opacity="0.2" strokeDasharray="3,3" />
                        <line x1="0" y1="50" x2="100" y2="50" stroke={isHighContrastDark ? '#34d399' : '#10b981'} strokeWidth="0.05" opacity="0.2" strokeDasharray="3,3" />
                        
                        {/* Abstract landmass boundaries */}
                        <path d="M 10 20 Q 30 15 35 40 T 70 30 T 90 70 T 30 90 Z" fill="none" stroke={isHighContrastDark ? '#115e59' : '#0f766e'} strokeWidth="0.3" opacity="0.4" />
                        <path d="M 40 45 Q 50 35 60 55 T 80 40" fill="none" stroke={isHighContrastDark ? '#064e3b' : '#14532d'} strokeWidth="0.2" opacity="0.3" />
                        
                        {/* Conditional Satellite Station & Sector labels */}
                        {showMapStyleLabels && (
                          <g className="select-none tracking-widest font-mono opacity-90" fontSize="1.4" fontWeight="black" fill={isHighContrastDark ? '#a7f3d0' : '#065f46'}>
                            <text x="15" y="28">Sector NW-01</text>
                            <text x="68" y="48">Central Lagoon</text>
                            <text x="42" y="82">Orbital Range Alpha</text>
                          </g>
                        )}
                      </svg>
                    </div>
                  )}

                  {mapStyle === 'terrain' && (
                    <div className="absolute inset-0 opacity-30 pointer-events-none">
                      {/* Mountainous peak shadows */}
                      <div className="absolute top-1/3 left-1/2 w-40 h-40 bg-amber-700/10 rounded-full blur-2xl" />
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Beautiful Topographical Contour Lines (Nested heights) */}
                        <path d="M-10,30 Q15,10 35,35 T70,10 T110,40" fill="none" stroke={isHighContrastDark ? '#57534e' : '#78350f'} strokeWidth="0.25" />
                        <path d="M-10,34 Q15,14 35,39 T70,14 T110,44" fill="none" stroke={isHighContrastDark ? '#44403c' : '#78350f'} strokeWidth="0.15" opacity="0.8" />
                        <path d="M-10,38 Q15,18 35,43 T70,18 T110,48" fill="none" stroke={isHighContrastDark ? '#292524' : '#78350f'} strokeWidth="0.08" opacity="0.6" />
                        
                        <path d="M15,90 Q40,60 60,85 T110,75" fill="none" stroke={isHighContrastDark ? '#57534e' : '#78350f'} strokeWidth="0.25" />
                        <path d="M15,94 Q40,64 60,89 T110,79" fill="none" stroke={isHighContrastDark ? '#44403c' : '#78350f'} strokeWidth="0.15" opacity="0.8" />
                        
                        {/* Elevation Peak Label indicators and basin text */}
                        {showMapStyleLabels && (
                          <>
                            <g transform="translate(45, 23)" opacity="0.6">
                              <circle cx="0" cy="0" r="0.6" fill={isHighContrastDark ? '#78716c' : '#78350f'} />
                              <text x="1.5" y="0.5" fill={isHighContrastDark ? '#78716c' : '#78350f'} fontSize="1.8" fontFamily="monospace" fontWeight="bold">El. 450m (Pine Peak)</text>
                            </g>
                            <g transform="translate(75, 82)" opacity="0.6">
                              <circle cx="0" cy="0" r="0.6" fill={isHighContrastDark ? '#78716c' : '#78350f'} />
                              <text x="1.5" y="0.5" fill={isHighContrastDark ? '#78716c' : '#78350f'} fontSize="1.8" fontFamily="monospace" fontWeight="bold">El. 680m (Eagle Ridge)</text>
                            </g>
                            <g transform="translate(20, 60)" opacity="0.5">
                              <text x="0" y="0" fill={isHighContrastDark ? '#a8a29e' : '#9a3412'} fontSize="1.5" fontFamily="monospace" fontWeight="bold">Echo Basin</text>
                            </g>
                          </>
                        )}
                      </svg>
                    </div>
                  )}

                  {/* Dynamic Configurable Latitude/Longitude Grid Overlay */}
                  {showGridOverlay && (
                    <div className="absolute inset-0 pointer-events-none z-5 transition-all duration-300" id="map-latitude-longitude-grid-overlay">
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Define coordinate bounds of the grid */}
                        {(() => {
                          const lines: React.ReactNode[] = [];
                          const spacingVal = gridSpacing || 10;
                          
                          // Determine stroke color class based on state/contrast
                          let strokeColor = '';
                          let textColor = '';
                          let bgLabelColor = '';
                          
                          if (gridColor === 'emerald') {
                            strokeColor = isHighContrastDark ? 'rgba(52, 211, 153, 0.25)' : 'rgba(16, 185, 129, 0.22)';
                            textColor = isHighContrastDark ? '#34d399' : '#059669';
                            bgLabelColor = isHighContrastDark ? 'rgba(9, 9, 11, 0.85)' : 'rgba(240, 253, 244, 0.85)';
                          } else if (gridColor === 'amber') {
                            strokeColor = isHighContrastDark ? 'rgba(251, 191, 36, 0.25)' : 'rgba(217, 119, 6, 0.22)';
                            textColor = isHighContrastDark ? '#fbbf24' : '#d97706';
                            bgLabelColor = isHighContrastDark ? 'rgba(9, 9, 11, 0.85)' : 'rgba(254, 243, 199, 0.85)';
                          } else { // Slate
                            strokeColor = isHighContrastDark ? 'rgba(203, 213, 225, 0.25)' : 'rgba(100, 116, 139, 0.18)';
                            textColor = isHighContrastDark ? '#cbd5e1' : '#475569';
                            bgLabelColor = isHighContrastDark ? 'rgba(9, 9, 11, 0.85)' : 'rgba(241, 245, 249, 0.85)';
                          }

                          // Draw Horizontal (Latitude) Lines
                          for (let y = spacingVal; y < 100; y += spacingVal) {
                            lines.push(
                              <line
                                key={`lat-line-${y}`}
                                x1="0"
                                y1={y}
                                x2="100"
                                y2={y}
                                stroke={strokeColor}
                                strokeWidth="0.08"
                                strokeDasharray="1,1"
                              />
                            );
                            
                            if (showGridLabels) {
                              lines.push(
                                <g key={`lat-label-${y}`} transform={`translate(2.5, ${y})`} className="select-none">
                                  <rect x="-1.8" y="-0.8" width="3.6" height="1.6" rx="0.5" fill={bgLabelColor} stroke={strokeColor} strokeWidth="0.04" />
                                  <text
                                    x="0"
                                    y="0.3"
                                    fill={textColor}
                                    fontSize="0.8"
                                    fontFamily="monospace"
                                    fontWeight="bolder"
                                    textAnchor="middle"
                                    alignmentBaseline="middle"
                                  >
                                    {(90 - y * 1.8).toFixed(0)}°N
                                  </text>
                                </g>
                              );
                            }
                          }

                          // Draw Vertical (Longitude) Lines
                          for (let x = spacingVal; x < 100; x += spacingVal) {
                            lines.push(
                              <line
                                key={`lng-line-${x}`}
                                x1={x}
                                y1="0"
                                x2={x}
                                y2="100"
                                stroke={strokeColor}
                                strokeWidth="0.08"
                                strokeDasharray="1,1"
                              />
                            );
                            
                            if (showGridLabels) {
                              lines.push(
                                <g key={`lng-label-${x}`} transform={`translate(${x}, 2.5)`} className="select-none">
                                  <rect x="-1.8" y="-0.8" width="3.6" height="1.6" rx="0.5" fill={bgLabelColor} stroke={strokeColor} strokeWidth="0.04" />
                                  <text
                                    x="0"
                                    y="0.3"
                                    fill={textColor}
                                    fontSize="0.8"
                                    fontFamily="monospace"
                                    fontWeight="bolder"
                                    textAnchor="middle"
                                    alignmentBaseline="middle"
                                  >
                                    {(x * 3.6 - 180).toFixed(0)}°E
                                  </text>
                                </g>
                              );
                            }
                          }
                          
                          return lines;
                        })()}
                      </svg>
                    </div>
                  )}

                  {/* Density Heatmap Overlay (Fills background smoothly beneath interactive pins) */}
                  {showHeatmap && (
                    <div className="absolute inset-0 pointer-events-none z-0 opacity-75 transition-all duration-500 overflow-hidden">
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                          {/* Rich heatmap radial gradient with progressive heat color stops */}
                          <radialGradient id="heat-overlap" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
                            <stop offset="25%" stopColor="#f97316" stopOpacity="0.65" />
                            <stop offset="55%" stopColor="#eab308" stopOpacity="0.4" />
                            <stop offset="85%" stopColor="#84cc16" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
                          </radialGradient>
                          
                          {/* Radial gradient for isolated low-density gathering areas */}
                          <radialGradient id="heat-solo" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#84cc16" stopOpacity="0.65" />
                            <stop offset="60%" stopColor="#84cc16" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
                          </radialGradient>

                          {/* High quality SVG gaussian blur filter to melt overlapping coordinates together */}
                          <filter id="heat-sig-blur" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3.2" />
                          </filter>
                        </defs>

                        {/* Blurring group matching standard heat sheet signature mapping */}
                        <g filter="url(#heat-sig-blur)">
                          {displayedGatheringsForHeatmap.filter(g => {
                            if (focusedClusterId) {
                              const activeCluster = mapClusters.find(c => c.id === focusedClusterId);
                              return activeCluster?.gatherings.some(cg => cg.id === g.id) || false;
                            }
                            return true;
                          }).filter(g => {
                            // Calculate neighborhood count for this node to determine its density level
                            const neighborhoodCount = displayedGatheringsForHeatmap.filter(other => {
                              const dx = other.lng - g.lng;
                              const dy = other.lat - g.lat;
                              return Math.sqrt(dx * dx + dy * dy) < 13.5;
                            }).length;

                            if (neighborhoodCount >= 3) {
                              return legendVisibleDensities.high;
                            } else if (neighborhoodCount === 2) {
                              return legendVisibleDensities.medium;
                            } else {
                              return legendVisibleDensities.low;
                            }
                          }).map(g => {
                            // Quantify local neighborhood density count to scale thermal spot magnitude
                            const neighborhoodCount = displayedGatheringsForHeatmap.filter(other => {
                              const dx = other.lng - g.lng;
                              const dy = other.lat - g.lat;
                              return Math.sqrt(dx * dx + dy * dy) < 13.5;
                            }).length;

                            // High-activity areas grow more radiant, wider, and turn red-orange (using 'heat-overlap' gradient)
                            // Isolated areas remain soft lime-green (using 'heat-solo' gradient)
                            const isHighDensity = neighborhoodCount > 1;
                            const radius = isHighDensity 
                              ? (5.5 + Math.min(neighborhoodCount * 1.8, 10.5)) // Hot zones grow from 7.3% up to 16% in coordinate space
                              : 4.8; // Isolated spots are compact and localized

                            const opacity = isHighDensity 
                              ? Math.min(0.28 + (neighborhoodCount * 0.12), 0.9)
                              : 0.38;

                            return (
                              <circle 
                                key={`heat-node-${g.id}`}
                                cx={g.lng}
                                cy={g.lat}
                                r={radius}
                                fill={isHighDensity ? "url(#heat-overlap)" : "url(#heat-solo)"}
                                opacity={opacity}
                                className="transition-all duration-500 ease-in-out"
                              />
                            );
                          })}
                        </g>
                      </svg>
                    </div>
                  )}

                  {showEvents && mapClusters.map((cluster) => {
                    const isMainFocused = focusedClusterId !== null;
                    const isThisCluster = focusedClusterId === cluster.id;
                    if (isMainFocused && !isThisCluster) {
                      return null;
                    }
                    if (cluster.gatherings.length === 1) {
                      const g = cluster.gatherings[0];
                      if (!legendVisibleMarkers.single) return null;
                      return (
                        <MapPinPoint 
                          key={g.id} 
                          gathering={g} 
                          reminders={eventReminders[g.id] || { email: false, push: false }}
                          onToggleReminder={(type) => toggleEventReminder(g.id, type)}
                          onRSVP={(status) => handleRSVP(g.id, status)}
                          onViewHost={() => setActiveProfile(users.find(u => u.id === g.hostId) || null)}
                          onIcebreakers={() => showIcebreakers(g)}
                        />
                      );
                    } else {
                      if (!legendVisibleMarkers.multi) return null;
                      return (
                        <MapClusterPinPoint 
                          key={cluster.id} 
                          cluster={cluster} 
                          reminders={eventReminders}
                          onToggleReminder={toggleEventReminder}
                          onRSVP={handleRSVP}
                          onViewHost={(hostId) => setActiveProfile(users.find(u => u.id === hostId) || null)}
                          onIcebreakers={showIcebreakers}
                          focusedClusterId={focusedClusterId}
                          onToggleFocusCluster={(cId) => setFocusedClusterId(prev => prev === cId ? null : cId)}
                          onHostAtCluster={(lat, lng, locationName) => {
                            setCreatePrefilledLat(lat);
                            setCreatePrefilledLng(lng);
                            setCreatePrefilledLocation(locationName);
                            setIsCreateModalOpen(true);
                          }}
                          onCenterOnCluster={(lat, lng) => {
                            setMapCenter({ lat, lng, zoom: 1.7 });
                          }}
                          mapStyle={mapStyle}
                          onToggleMapStyle={setMapStyle}
                        />
                      );
                    }
                  })}

                  {!focusedClusterId && showPois && POINTS_OF_INTEREST.map((poi) => {
                    if (poi.type === 'community_center' && !legendVisibleMarkers.community) return null;
                    if (poi.type === 'landmark' && !legendVisibleMarkers.landmark) return null;
                    return (
                      <PoiPinPoint key={poi.id} poi={poi} />
                    );
                  })}

                  {/* User Current Location Pulsating Visual Marker */}
                  {!focusedClusterId && (
                    <div 
                      style={{ left: `${userLocation.lng}%`, top: `${userLocation.lat}%`, transform: 'translate(-50%, -50%)' }}
                      className="absolute z-40 flex flex-col items-center pointer-events-none"
                      id="map-user-current-location-marker"
                    >
                      <span className="relative flex h-6 w-6 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" style={{ animationDuration: '2s' }} />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600 border-2 border-white shadow-md shadow-blue-500/50" />
                      </span>
                      <span className="text-[7.5px] font-black tracking-widest text-blue-700 bg-white/95 backdrop-blur-xs px-1.5 py-0.5 rounded-full border border-blue-250 shadow-sm uppercase leading-none mt-1">
                        You
                      </span>
                    </div>
                  )}
                    </div>
                  </div>

                  {mapClusters.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#e0e0d1]/65 backdrop-blur-xs pointer-events-none z-20">
                      <Search className="w-10 h-10 text-olive/45 mb-3" />
                      <h4 className="serif text-lg font-medium text-gray-800 mb-1">No map markers found</h4>
                      <p className="text-xs text-stone-600 max-w-sm">Adjust your map category or search query to reveal corresponding events.</p>
                    </div>
                  )}

                  {/* Bottom-Left Overlay Stack HUD */}
                  <div className="absolute bottom-6 left-6 z-30 flex flex-col items-start gap-2 max-w-[280px] pointer-events-none" id="map-bottom-left-hud-wrapper">
                    {/* Live Zoom Percentage Label Overlay */}
                    <div 
                      className="bg-stone-900/85 backdrop-blur-md rounded-2xl border border-stone-850 px-3 py-1.5 flex items-center gap-2 pointer-events-auto shadow-md transition-all duration-300"
                      id="map-zoom-percentage-text-overlay"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-stone-200 select-none">
                        Zoom Level: <strong className="text-emerald-400 font-mono text-[11px] ml-0.5">{Math.round((mapCenter ? mapCenter.zoom : 1.0) * 100)}%</strong>
                      </span>
                    </div>

                    {/* Descriptive Map Overlay Legend */}
                    <motion.div 
                      layout={isLegendAnimationEnabled ? "position" : false}
                      transition={isLegendAnimationEnabled ? { type: "spring", stiffness: 180, damping: 25 } : { duration: 0 }}
                      className="bg-white/95 backdrop-blur-md rounded-[24px] border border-stone-200/60 shadow-lg flex flex-col pointer-events-auto w-full overflow-hidden" 
                      id="map-comprehensive-legend-panel"
                    >
                    {/* Header */}
                    <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/50">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-olive/10 text-olive flex items-center justify-center shrink-0">
                          <Info className="w-3 h-3 text-olive" />
                        </div>
                        <span className="text-[9.5px] font-black uppercase tracking-widest text-[#4f5544]">
                          Map Legend
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* Animations Toggle Button */}
                        <button
                          type="button"
                          onClick={() => setIsLegendAnimationEnabled(!isLegendAnimationEnabled)}
                          className={`p-1 active:scale-95 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-3xs ${
                            isLegendAnimationEnabled
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200/40 hover:bg-emerald-100/70'
                              : 'bg-stone-50 text-stone-400 border-stone-200/30 hover:bg-stone-100'
                          }`}
                          id="toggle-legend-animations-btn"
                          title={isLegendAnimationEnabled ? "Disable transitions/animations (Smooth Mode Active)" : "Enable smooth transitions/animations (Instant Mode Active)"}
                          aria-label={isLegendAnimationEnabled ? "Disable legend transitions" : "Enable legend transitions"}
                        >
                          <Zap className={`w-3.5 h-3.5 ${isLegendAnimationEnabled ? 'animate-pulse text-emerald-600' : 'text-stone-400'}`} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsMainLegendOpen(!isMainLegendOpen)}
                          className="p-1 hover:bg-stone-200/60 active:scale-95 text-stone-500 hover:text-stone-850 rounded-lg border border-stone-200/30 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-3xs"
                          id="toggle-main-legend-btn"
                          title={isMainLegendOpen ? "Collapse map legend" : "Expand map legend"}
                          aria-label={isMainLegendOpen ? "Collapse map legend" : "Expand map legend"}
                        >
                          {isMainLegendOpen ? (
                            <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                          ) : (
                            <ChevronUp className="w-4 h-4 transition-transform duration-200" />
                          )}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {isMainLegendOpen && (
                        <motion.div
                          initial={isLegendAnimationEnabled ? { height: 0, opacity: 0 } : { height: "auto", opacity: 1 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={isLegendAnimationEnabled ? { height: 0, opacity: 0 } : { height: "auto", opacity: 0 }}
                          transition={isLegendAnimationEnabled ? { type: "spring", stiffness: 180, damping: 24 } : { duration: 0 }}
                          className="overflow-hidden flex flex-col"
                        >
                          {/* Interactive Scale & Zoom Level Panel */}
                          <div className="px-3.5 py-2.5 bg-stone-50/75 border-b border-stone-200/60 flex flex-col gap-2 " id="interactive-scale-zoom-section">
                            <div className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1">
                                <Ruler className="w-3 h-3 text-emerald-600" />
                                <span className="font-extrabold text-[#4f5544] uppercase tracking-wider">Dynamic Map Scale</span>
                              </div>
                              {/* Interactive toggle for metric vs imperial */}
                              <button
                                type="button"
                                onClick={() => setScaleUnit(prev => prev === 'metric' ? 'imperial' : 'metric')}
                                className="px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold uppercase bg-stone-200/80 hover:bg-stone-300 text-stone-700 transition-all cursor-pointer active:scale-95"
                                title="Toggle scale units (Metric vs Imperial)"
                                id="scale-unit-toggle-btn"
                              >
                                {scaleUnit === 'metric' ? 'Metric' : 'Imperial'}
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2 bg-white/70 px-2.5 py-2 rounded-xl border border-stone-200/40">
                              {/* Interactive Scale Graphic Bar */}
                              <div className="flex flex-col gap-1 shrink-0">
                                <div className="flex items-end h-3 relative" style={{ width: '90px' }}>
                                  {/* The Scale Line */}
                                  <div 
                                    className="h-2 border-r-2 border-l-2 border-b-2 border-stone-800 transition-all duration-350 ease-out"
                                    style={{ width: `${getMapScale(80, mapWidth, mapCenter ? mapCenter.zoom : 1.0, scaleUnit).barWidth}px` }}
                                  />
                                </div>
                                <span className="text-[9.5px] font-bold text-stone-800 tracking-tight select-none">
                                  {getMapScale(80, mapWidth, mapCenter ? mapCenter.zoom : 1.0, scaleUnit).label}
                                </span>
                              </div>

                              {/* Interactive Zoom Level Controller & Presets */}
                              <div className="flex flex-col gap-1.5 items-end flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-stone-550 font-bold select-none">Zoom:</span>
                                  {(() => {
                                    const zoomVal = mapCenter ? mapCenter.zoom : 1.0;
                                    let tierLabel = 'Standard';
                                    let badgeStyle = 'bg-amber-50/50 text-amber-800 border-amber-200/50';
                                    if (zoomVal <= 0.35) {
                                      tierLabel = 'Ultra-Wide';
                                      badgeStyle = 'bg-stone-50 text-stone-650 border-stone-200/50';
                                    } else if (zoomVal <= 0.75) {
                                      tierLabel = 'Wide';
                                      badgeStyle = 'bg-indigo-50/50 text-indigo-700 border-indigo-200/40';
                                    } else if (zoomVal <= 1.5) {
                                      tierLabel = 'Standard';
                                      badgeStyle = 'bg-emerald-50/50 text-emerald-850 border-emerald-150/50';
                                    } else if (zoomVal <= 3.0) {
                                      tierLabel = 'Close-up';
                                      badgeStyle = 'bg-rose-50/50 text-rose-800 border-rose-200/40';
                                    } else {
                                      tierLabel = 'Macro';
                                      badgeStyle = 'bg-violet-50/50 text-violet-850 border-violet-200/40';
                                    }
                                    return (
                                      <span className={`text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 border rounded-md select-none transition-all duration-350 ease-in-out ${badgeStyle}`}>
                                        {tierLabel}
                                      </span>
                                    );
                                  })()}
                                  <span className="text-[10.5px] font-bold font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-150 shadow-2xs">
                                    {Math.round((mapCenter ? mapCenter.zoom : 1.0) * 100)}%
                                  </span>
                                </div>

                                {/* Quick Preset Zoom Trigger Beads */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[7.5px] text-stone-400 font-extrabold uppercase select-none mr-0.5">Presets:</span>
                                  {[0.25, 1.0, 2.5, 5.0].map((level) => {
                                    const active = Math.abs((mapCenter ? mapCenter.zoom : 1.0) - level) < 0.05;
                                    return (
                                      <button
                                        key={level}
                                        type="button"
                                        onClick={() => {
                                          if (isZoomLocked) return;
                                          setMapCenter({
                                            lat: mapCenter ? mapCenter.lat : 50,
                                            lng: mapCenter ? mapCenter.lng : 50,
                                            zoom: level
                                          });
                                          triggerMapHighlight();
                                        }}
                                        disabled={isZoomLocked}
                                        className={`w-4 h-4 rounded-full text-[7px] font-extrabold flex items-center justify-center transition-all active:scale-90 ${
                                          active 
                                            ? 'bg-emerald-600 font-black text-white ring-1 ring-emerald-500/40' 
                                            : 'bg-stone-55 hover:bg-stone-200 border border-stone-200 text-stone-600 disabled:opacity-45'
                                        }`}
                                        title={`Zoom to ${level}x`}
                                      >
                                        {level === 0.25 ? '0.2' : level === 1.0 ? '1' : level === 2.5 ? '2.5' : '5'}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Altitude Scope / Zoom Tier indicator */}
                            <div className="flex items-center justify-between bg-white/75 px-2.5 py-1.5 rounded-xl border border-stone-200/40 select-none text-[10px]" id="map-altitude-scope-row">
                              <span className="text-[8px] text-stone-550 font-extrabold uppercase tracking-wider">Altitude Scope</span>
                              {(() => {
                                const zoomVal = mapCenter ? mapCenter.zoom : 1.0;
                                let scopeLabel = 'Regional';
                                if (zoomVal >= 3.0) scopeLabel = 'Street Level';
                                else if (zoomVal >= 1.5) scopeLabel = 'City View';
                                else if (zoomVal >= 0.75) scopeLabel = 'Regional';
                                else if (zoomVal >= 0.35) scopeLabel = 'Provincial';
                                else scopeLabel = 'Continental';
                                return (
                                  <span className="text-[9px] font-black text-emerald-800 tracking-tight flex items-center gap-1 bg-emerald-50/60 px-2 py-0.5 rounded-md border border-emerald-150/40 shadow-2xs">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    {scopeLabel}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="p-3.5 space-y-4 max-h-[345px] overflow-y-auto scrollbar-thin text-xs">
                            {/* Map Pins Section */}
                            <div className="space-y-2">
                              <span className="text-[8.5px] font-black uppercase tracking-widest text-stone-450 block pb-1 border-b border-stone-100">
                                Interactive Markers (Tap to Toggle)
                              </span>
                              
                              <div className="space-y-2">
                                {/* Single Gathering Pin */}
                                <div 
                                  onClick={() => setLegendVisibleMarkers(p => ({ ...p, single: !p.single }))}
                                  className={`flex items-start justify-between gap-2.5 p-1.5 rounded-xl border transition-all cursor-pointer ${
                                    legendVisibleMarkers.single 
                                      ? 'bg-stone-50/60 hover:bg-stone-50 border-stone-200/50 shadow-2xs' 
                                      : 'bg-stone-100/40 border-dashed border-stone-200/50 opacity-55'
                                  }`}
                                  title="Toggle single gatherings visibility on map"
                                  id="legend-toggle-single"
                                >
                                  <div className="flex items-start gap-2">
                                    <div className={`w-5.5 h-5.5 rounded-full text-olive flex items-center justify-center shrink-0 shadow-xs transition-colors duration-300 ${
                                      legendVisibleMarkers.single ? 'bg-white border border-olive/15' : 'bg-stone-200 border border-stone-300'
                                    }`}>
                                      <Sparkles className={`w-2.5 h-2.5 text-olive ${legendVisibleMarkers.single ? 'animate-pulse' : 'opacity-40'}`} />
                                    </div>
                                    <div>
                                      <h5 className="font-extrabold text-[10px] text-stone-850 leading-none">Single Gathering</h5>
                                      <p className="text-[8.5px] text-stone-500 leading-normal mt-1">Individual localized community meetups.</p>
                                    </div>
                                  </div>
                                  <div className="text-stone-400 hover:text-stone-605 self-center shrink-0 transition-colors">
                                    {legendVisibleMarkers.single ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-stone-400" />}
                                  </div>
                                </div>

                                {/* Cluster Overlapping Pin */}
                                <div 
                                  onClick={() => setLegendVisibleMarkers(p => ({ ...p, multi: !p.multi }))}
                                  className={`flex items-start justify-between gap-2.5 p-1.5 rounded-xl border transition-all cursor-pointer ${
                                    legendVisibleMarkers.multi 
                                      ? 'bg-stone-50/60 hover:bg-stone-50 border-stone-200/50 shadow-2xs' 
                                      : 'bg-stone-100/40 border-dashed border-stone-200/50 opacity-55'
                                  }`}
                                  title="Toggle overlapping group nodes visibility on map"
                                  id="legend-toggle-multi"
                                >
                                  <div className="flex items-start gap-2">
                                    <div className={`relative w-5.5 h-5.5 rounded-full text-warm-white flex flex-col items-center justify-center shrink-0 shadow-xs transition-colors duration-300 ${
                                      legendVisibleMarkers.multi ? 'bg-olive border border-white' : 'bg-stone-350 border border-stone-300'
                                    }`}>
                                      <span className="text-[7px] font-black leading-none">3</span>
                                      <span className="text-[4px] font-bold uppercase leading-none mt-0.5">Evs</span>
                                    </div>
                                    <div>
                                      <h5 className="font-extrabold text-[10px] text-stone-850 leading-none">Multi-Event Overlap</h5>
                                      <p className="text-[8.5px] text-stone-500 leading-normal mt-1">Overlapping regional cluster nodes.</p>
                                    </div>
                                  </div>
                                  <div className="text-stone-400 hover:text-stone-605 self-center shrink-0 transition-colors">
                                    {legendVisibleMarkers.multi ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-stone-400" />}
                                  </div>
                                </div>

                                {/* Community Center POI */}
                                <div 
                                  onClick={() => setLegendVisibleMarkers(p => ({ ...p, community: !p.community }))}
                                  className={`flex items-start justify-between gap-2.5 p-1.5 rounded-xl border transition-all cursor-pointer ${
                                    legendVisibleMarkers.community 
                                      ? 'bg-stone-50/60 hover:bg-stone-50 border-stone-200/50 shadow-2xs' 
                                      : 'bg-stone-100/40 border-dashed border-stone-200/50 opacity-55'
                                  }`}
                                  title="Toggle community space spots visibility on map"
                                  id="legend-toggle-community"
                                >
                                  <div className="flex items-start gap-2">
                                    <div className={`w-5.5 h-5.5 rounded-full text-white flex items-center justify-center shrink-0 shadow-xs transition-colors duration-300 ${
                                      legendVisibleMarkers.community ? 'bg-indigo-600' : 'bg-stone-350'
                                    }`}>
                                      <Building className="w-2.5 h-2.5 text-white" />
                                    </div>
                                    <div>
                                      <h5 className="font-extrabold text-[10px] text-stone-850 leading-none">Community Space</h5>
                                      <p className="text-[8.5px] text-stone-500 leading-normal mt-1">Libraries and partner workshops.</p>
                                    </div>
                                  </div>
                                  <div className="text-stone-400 hover:text-stone-605 self-center shrink-0 transition-colors">
                                    {legendVisibleMarkers.community ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-stone-400" />}
                                  </div>
                                </div>

                                {/* Landmark POI */}
                                <div 
                                  onClick={() => setLegendVisibleMarkers(p => ({ ...p, landmark: !p.landmark }))}
                                  className={`flex items-start justify-between gap-2.5 p-1.5 rounded-xl border transition-all cursor-pointer ${
                                    legendVisibleMarkers.landmark 
                                      ? 'bg-stone-50/60 hover:bg-stone-50 border-stone-200/50 shadow-2xs' 
                                      : 'bg-stone-100/40 border-dashed border-stone-200/50 opacity-55'
                                  }`}
                                  title="Toggle regional landmark indicators visibility on map"
                                  id="legend-toggle-landmark"
                                >
                                  <div className="flex items-start gap-2">
                                    <div className={`w-5.5 h-5.5 rounded-full text-white flex items-center justify-center shrink-0 shadow-xs transition-colors duration-300 ${
                                      legendVisibleMarkers.landmark ? 'bg-amber-600' : 'bg-stone-350'
                                    }`}>
                                      <Landmark className="w-2.5 h-2.5 text-white" />
                                    </div>
                                    <div>
                                      <h5 className="font-extrabold text-[10px] text-stone-850 leading-none">Regional Landmark</h5>
                                      <p className="text-[8.5px] text-stone-500 leading-normal mt-1">Historic towers or botanical trails.</p>
                                    </div>
                                  </div>
                                  <div className="text-stone-400 hover:text-stone-605 self-center shrink-0 transition-colors">
                                    {legendVisibleMarkers.landmark ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-stone-400" />}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Heatmap Overlay Section */}
                            {showHeatmap && (
                              <div className="space-y-2 pt-2 border-t border-stone-200/50">
                                <span className="text-[8.5px] font-black uppercase tracking-widest text-[#4f5544] block pb-1 border-b border-stone-100">
                                  Activity Density Overlays (Tap to Toggle)
                                </span>
                                
                                <p className="text-[8.5px] text-stone-500 leading-normal">
                                  Toggle physical bands of active regional hosts to isolate specific densities:
                                </p>

                                <div className="grid grid-cols-3 gap-1 pt-0.5">
                                  {/* High Density */}
                                  <div 
                                    onClick={() => setLegendVisibleDensities(p => ({ ...p, high: !p.high }))}
                                    className={`flex flex-col items-center p-1 rounded-lg text-center cursor-pointer border transition-all ${
                                      legendVisibleDensities.high 
                                        ? 'bg-red-50/65 border-red-105 shadow-xs shadow-red-500/5' 
                                        : 'bg-stone-55/40 border-dashed border-stone-200/80 opacity-50'
                                    }`}
                                    title="Toggle high density overlay thermal nodes"
                                    id="legend-toggle-dense-high"
                                  >
                                    <div className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                                      {legendVisibleDensities.high ? <Eye className="w-2.5 h-2.5 text-red-500" /> : <EyeOff className="w-2.5 h-2.5 text-stone-400" />}
                                    </div>
                                    <span className="text-[8px] font-extrabold text-red-700 uppercase mt-1">High</span>
                                    <span className="text-[7px] text-red-500 leading-tight">Many events</span>
                                  </div>

                                  {/* Medium Density */}
                                  <div 
                                    onClick={() => setLegendVisibleDensities(p => ({ ...p, medium: !p.medium }))}
                                    className={`flex flex-col items-center p-1 rounded-lg text-center cursor-pointer border transition-all ${
                                      legendVisibleDensities.medium 
                                        ? 'bg-orange-50/65 border-orange-105 shadow-xs shadow-orange-400/55' 
                                        : 'bg-stone-55/40 border-dashed border-stone-200/80 opacity-50'
                                    }`}
                                    title="Toggle medium density overlay thermal nodes"
                                    id="legend-toggle-dense-medium"
                                  >
                                    <div className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />
                                      {legendVisibleDensities.medium ? <Eye className="w-2.5 h-2.5 text-orange-500" /> : <EyeOff className="w-2.5 h-2.5 text-stone-400" />}
                                    </div>
                                    <span className="text-[8px] font-extrabold text-orange-700 uppercase mt-1">Medium</span>
                                    <span className="text-[7px] text-orange-500 leading-tight">Active hubs</span>
                                  </div>

                                  {/* Low Density */}
                                  <div 
                                    onClick={() => setLegendVisibleDensities(p => ({ ...p, low: !p.low }))}
                                    className={`flex flex-col items-center p-1 rounded-lg text-center cursor-pointer border transition-all ${
                                      legendVisibleDensities.low 
                                        ? 'bg-lime-50/55 border-lime-105 shadow-xs shadow-lime-500/5' 
                                        : 'bg-stone-55/40 border-dashed border-stone-200/80 opacity-50'
                                    }`}
                                    title="Toggle low density overlay thermal nodes"
                                    id="legend-toggle-dense-low"
                                  >
                                    <div className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#84cc16]" />
                                      {legendVisibleDensities.low ? <Eye className="w-2.5 h-2.5 text-stone-605" /> : <EyeOff className="w-2.5 h-2.5 text-stone-400" />}
                                    </div>
                                    <span className="text-[8px] font-extrabold text-stone-700 uppercase mt-1">Low</span>
                                    <span className="text-[7px] text-stone-500 leading-tight">Quiet areas</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  </div>

                  {/* Floating Map Controls Column */}
                  <div data-html2canvas-ignore="true" className="absolute bottom-6 right-6 z-30 flex flex-col gap-2.5 pointer-events-auto items-end" id="map-custom-controls-container">
                    {/* Dedicated Primary Zoom Lock Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setIsZoomLocked(!isZoomLocked)}
                      className={`px-3 py-2 rounded-[18px] text-[10px] font-black uppercase tracking-wider border shadow-md transition-all duration-200 flex items-center gap-1.5 active:scale-95 cursor-pointer select-none ${
                        isZoomLocked
                          ? 'bg-amber-600 border-amber-600 text-white animate-pulse shadow-amber-300/30'
                          : 'bg-white hover:bg-stone-55 border-stone-200 text-stone-700 hover:border-amber-350/50 hover:text-amber-600'
                      }`}
                      id="map-dedicated-zoom-lock-btn"
                      title={isZoomLocked ? "Map zoom interactions are locked - click to unlock" : "Lock all map zoom interactions"}
                      aria-label={isZoomLocked ? "Unlock Map Zoom" : "Lock Map Zoom"}
                    >
                      {isZoomLocked ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span>{isZoomLocked ? "Zoom Locked" : "Lock Zoom"}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isZoomLocked}
                      onClick={handleFitBounds}
                      className="px-3 py-2 rounded-[18px] text-[10px] font-black uppercase tracking-wider bg-white hover:bg-stone-50 text-stone-700 border border-stone-200/85 shadow-md transition-all duration-200 flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:active:scale-100"
                      id="fit-bounds-btn"
                      title="Fit map boundaries to show all active markers"
                    >
                      <Compass className="w-3.5 h-3.5 text-olive" />
                      <span>Fit Bounds</span>
                    </button>

                    <button
                      type="button"
                      disabled={isZoomLocked}
                      onClick={() => {
                        setMapCenter({ lat: 50, lng: 50, zoom: 1.0 });
                        triggerMapHighlight();
                      }}
                      className="px-3 py-2 rounded-[18px] text-[10px] font-black uppercase tracking-wider bg-white hover:bg-stone-50 text-stone-700 border border-stone-200/85 shadow-md transition-all duration-200 flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:active:scale-100 shadow-amber-100/40"
                      id="reset-zoom-floating-btn"
                      title="Reset view zoom and centering to 1.0x"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                      <span>Reset Zoom</span>
                    </button>

                    <button
                      type="button"
                      disabled={isZoomLocked}
                      onClick={() => {
                        const currentZoom = mapCenter ? mapCenter.zoom : 1.0;
                        setMapCenter({ lat: userLocation.lat, lng: userLocation.lng, zoom: currentZoom });
                        triggerMapHighlight();
                      }}
                      className="px-3 py-2 rounded-[18px] text-[10px] font-black uppercase tracking-wider bg-white hover:bg-stone-50 text-stone-700 border border-stone-200/85 shadow-md transition-all duration-200 flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:active:scale-100 shadow-blue-100/40"
                      id="fly-to-user-location-btn"
                      title="Fly to your current location"
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-500" />
                      <span>My Location</span>
                    </button>

                    <button
                      type="button"
                      disabled={isZoomLocked || (filteredGatherings.length === 0 && gatherings.length === 0)}
                      onClick={() => {
                        const lat = mapCenter ? mapCenter.lat : 50;
                        const lng = mapCenter ? mapCenter.lng : 50;
                        
                        const candidates = filteredGatherings.length > 0 ? filteredGatherings : gatherings;
                        if (candidates.length === 0) return;

                        let nearest: Gathering | null = null;
                        let minDistance = Infinity;

                        // Support clicking multiple times to cycle/jump to another close landmark if we are already practically on one
                        const distinctCandidates = candidates.filter(g => {
                          const dy = g.lat - lat;
                          const dx = g.lng - lng;
                          const dist = Math.sqrt(dx * dx + dy * dy);
                          return dist > 0.05;
                        });

                        const finalCandidates = distinctCandidates.length > 0 ? distinctCandidates : candidates;

                        finalCandidates.forEach(g => {
                          const dy = g.lat - lat;
                          const dx = g.lng - lng;
                          const dist = Math.sqrt(dx * dx + dy * dy);
                          if (dist < minDistance) {
                            minDistance = dist;
                            nearest = g;
                          }
                        });

                        if (nearest) {
                          const currentZoom = mapCenter ? mapCenter.zoom : 1.0;
                          const targetZoom = Math.max(1.0, currentZoom);
                          setMapCenter({ lat: (nearest as Gathering).lat, lng: (nearest as Gathering).lng, zoom: targetZoom });
                          triggerMapHighlight();
                        }
                      }}
                      className="px-3 py-2 rounded-[18px] text-[10px] font-black uppercase tracking-wider bg-white hover:bg-stone-50 text-stone-700 border border-stone-200/85 shadow-md transition-all duration-200 flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:active:scale-100 shadow-emerald-100/40"
                      id="explore-nearest-poi-btn"
                      title="Fly to the nearest monument or Point of Interest (POI) relative to map center"
                    >
                      <Compass className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                      <span>Explore POI</span>
                    </button>

                    {mapCenter && (
                      <button
                        disabled={isZoomLocked}
                        onClick={() => {
                          setMapCenter(null);
                          triggerMapHighlight();
                        }}
                        className="px-3 py-2 rounded-[18px] text-[10px] font-black uppercase tracking-wider bg-red-50 hover:bg-red-100 text-rose-700 border border-red-200 shadow-md transition-all duration-200 flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:active:scale-100"
                        id="reset-map-view-btn"
                        title="Reset map zoom and center to default"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Reset Map View
                      </button>
                    )}

                    {/* Primary Incremental Zoom Buttons */}
                    <div className="flex gap-2 w-full" id="map-primary-incremental-zoom-row">
                      <button
                        type="button"
                        disabled={isZoomLocked}
                        onClick={() => {
                          const currentZoom = mapCenter ? mapCenter.zoom : 1.0;
                          const newZoom = Number(Math.min(5.0, currentZoom + zoomSensitivity).toFixed(2));
                          if (!mapCenter) {
                            setMapCenter({ lat: 50, lng: 50, zoom: newZoom });
                          } else {
                            setMapCenter({
                              ...mapCenter,
                              zoom: newZoom
                            });
                          }
                        }}
                        className="flex-1 px-3 py-2 rounded-[18px] text-[10px] font-black uppercase tracking-wider bg-white hover:bg-stone-50 text-stone-750 border border-stone-200 shadow-md transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
                        id="primary-zoom-in-btn"
                        title="Zoom In"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                        <span>Zoom In</span>
                      </button>

                      <button
                        type="button"
                        disabled={isZoomLocked}
                        onClick={() => {
                          const currentZoom = mapCenter ? mapCenter.zoom : 1.0;
                          const newZoom = Number(Math.max(0.01, currentZoom - zoomSensitivity).toFixed(2));
                          if (!mapCenter) {
                            setMapCenter({ lat: 50, lng: 50, zoom: newZoom });
                          } else {
                            setMapCenter({
                              ...mapCenter,
                              zoom: newZoom
                            });
                          }
                        }}
                        className="flex-1 px-3 py-2 rounded-[18px] text-[10px] font-black uppercase tracking-wider bg-white hover:bg-stone-50 text-stone-750 border border-stone-200 shadow-md transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
                        id="primary-zoom-out-btn"
                        title="Zoom Out"
                      >
                        <Minus className="w-3.5 h-3.5 text-rose-600 font-bold" />
                        <span>Zoom Out</span>
                      </button>
                    </div>

                    {/* High-resolution PNG Map Exporter Button */}
                    <button
                      type="button"
                      onClick={handleExportMapView}
                      disabled={isExportingMap}
                      className="px-3 py-2 rounded-[18px] text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 shadow-md transition-all duration-200 flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      id="export-map-png-btn"
                      title="Export current map view as a high-resolution PNG image"
                    >
                      {isExportingMap ? (
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-white" />
                      )}
                      <span>{isExportingMap ? "Exporting..." : "Export Map"}</span>
                    </button>

                    {/* Zoom In/Out Manual Controls & Pitch/Tilt Vertical Control Row */}
                    <div className="flex items-stretch gap-3" id="map-controls-row-wrapper">
                      {/* Zoom controls card */}
                      <div className="flex flex-col bg-white/95 backdrop-blur-md border border-stone-200/65 shadow-md rounded-[20px] px-4 py-2.5 items-stretch gap-2 flex-1 animate-fade-in" id="map-zoom-buttons-group">
                      <div className="flex items-center gap-3 w-full" id="map-zoom-controls-row">
                        {/* Zoom Lock Button */}
                      <button
                        type="button"
                        onClick={() => setIsZoomLocked(!isZoomLocked)}
                        className={`w-7 h-7 rounded-full border transition-all flex items-center justify-center active:scale-90 cursor-pointer ${
                          isZoomLocked
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-600 hover:text-amber-500'
                        }`}
                        id="map-zoom-lock-btn"
                        title={isZoomLocked ? "Unlock Zoom Controls" : "Lock Zoom Controls"}
                        aria-label={isZoomLocked ? "Unlock Zoom Controls" : "Lock Zoom Controls"}
                      >
                        {isZoomLocked ? (
                          <Lock className="w-3.5 h-3.5 animate-pulse" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Cinematic Rotation Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setIsMapRotating(!isMapRotating)}
                        className={`w-7 h-7 rounded-full border transition-all flex items-center justify-center active:scale-90 cursor-pointer ${
                          isMapRotating
                            ? 'bg-olive border-olive text-white shadow-sm'
                            : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-600 hover:text-olive'
                        }`}
                        id="map-cinematic-rotation-btn"
                        title={isMapRotating ? "Disable Cinematic Rotation" : "Enable Cinematic 360° Rotation"}
                        aria-label={isMapRotating ? "Disable Cinematic Rotation" : "Enable Cinematic Rotation"}
                      >
                        <Compass className={`w-3.5 h-3.5 ${isMapRotating ? 'animate-[spin_10s_linear_infinite]' : ''}`} />
                      </button>

                      {/* Magnet Zoom Snapping Toggle Button */}
                      <button
                        type="button"
                        disabled={isZoomLocked}
                        onClick={() => {
                          if (zoomSnapIncrement === null) {
                            const parsed = parseFloat(snapInputValue);
                            const val = !isNaN(parsed) && parsed > 0 ? Number(parsed.toFixed(3)) : 0.25;
                            setZoomSnapIncrement(val);
                          } else {
                            setZoomSnapIncrement(null);
                          }
                        }}
                        className={`w-7 h-7 rounded-full border transition-all flex items-center justify-center active:scale-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          zoomSnapIncrement !== null
                            ? 'bg-olive border-olive text-white shadow-sm'
                            : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-600 hover:text-olive'
                        }`}
                        id="map-magnet-snap-toggle-btn"
                        title={
                          zoomSnapIncrement !== null
                            ? `Snapping is ACTIVE (${zoomSnapIncrement}x). Click to switch to Fluid zoom.`
                            : "Snapping is INACTIVE (Fluid zoom). Click to snap zoom to current interval."
                        }
                        aria-label={zoomSnapIncrement !== null ? "Disable Zoom Snapping" : "Enable Zoom Snapping"}
                      >
                        <Magnet className={`w-3.5 h-3.5 ${zoomSnapIncrement !== null ? 'animate-[bounce_2s_infinite]' : ''}`} />
                      </button>

                      <button
                        type="button"
                        disabled={isZoomLocked}
                        onClick={() => {
                          const currentZoom = mapCenter ? mapCenter.zoom : 1.0;
                          const newZoom = Number(Math.max(0.01, currentZoom - zoomSensitivity).toFixed(2));
                          if (!mapCenter) {
                            setMapCenter({ lat: 50, lng: 50, zoom: newZoom });
                          } else {
                            setMapCenter({
                              ...mapCenter,
                              zoom: newZoom
                            });
                          }
                        }}
                        className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200 hover:text-olive text-stone-700 transition-all flex items-center justify-center active:scale-90 cursor-pointer font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-stone-100 disabled:hover:text-stone-700 disabled:active:scale-100"
                        id="map-incremental-zoom-out-btn"
                        title="Zoom Out (or press '-')"
                        aria-label="Zoom Out"
                      >
                        -
                      </button>

                      <div className="flex flex-col items-center w-24 relative" id="map-zoom-slider-wrapper">
                        <input
                          type="range"
                          min={zoomSnapIncrement !== null ? "0.00" : "0.01"}
                          max="5.0"
                          step={zoomSnapIncrement !== null ? zoomSnapIncrement.toString() : "0.05"}
                          value={mapCenter ? mapCenter.zoom : 1.0}
                          disabled={isZoomLocked}
                          onChange={(e) => {
                            let val = parseFloat(e.target.value);
                            if (zoomSnapIncrement !== null) {
                              const snapped = Math.round(val / zoomSnapIncrement) * zoomSnapIncrement;
                              val = Math.max(0.01, Math.min(5.0, snapped));
                            }
                            val = Number(val.toFixed(2));
                            if (!mapCenter) {
                              setMapCenter({ lat: 50, lng: 50, zoom: val });
                            } else {
                              setMapCenter({
                                ...mapCenter,
                                zoom: val
                              });
                            }
                          }}
                          className="w-24 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-olive focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                          id="map-zoom-slider"
                          title={zoomSnapIncrement !== null ? `Adjust Zoom level (Snapping to ${zoomSnapIncrement}x)` : "Adjust Zoom Level"}
                          aria-label="Adjust Zoom Level"
                        />
                        {/* Zoom Level Tick Indicators */}
                        <div className="w-full relative h-4 mt-1 pointer-events-none select-none" id="map-zoom-slider-ticks">
                          {/* 0.01x tick */}
                          <div className="absolute left-0 top-0 flex flex-col items-start scale-90">
                            <span className="w-[1.5px] h-1 bg-stone-400 rounded-full self-start ml-0.5" />
                            <span className="text-[7px] leading-none font-bold text-stone-500 mt-0.5 select-none tracking-tighter">0.01x</span>
                          </div>
                          {/* 1.0x tick */}
                          <div className="absolute top-0 flex flex-col items-center scale-90" style={{ left: '19.84%', transform: 'translateX(-50%) scale(0.9)' }}>
                            <span className="w-[1.5px] h-1 bg-stone-400 rounded-full" />
                            <span className="text-[7px] leading-none font-bold text-stone-500 mt-0.5 select-none tracking-tighter">1.0x</span>
                          </div>
                          {/* 5.0x tick */}
                          <div className="absolute right-0 top-0 flex flex-col items-end scale-90">
                            <span className="w-[1.5px] h-1 bg-stone-400 rounded-full self-end mr-0.5" />
                            <span className="text-[7px] leading-none font-bold text-stone-500 mt-0.5 select-none tracking-tighter">5.0x</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isZoomLocked}
                        onClick={() => {
                          const currentZoom = mapCenter ? mapCenter.zoom : 1.0;
                          const newZoom = Number(Math.min(5.0, currentZoom + zoomSensitivity).toFixed(2));
                          if (!mapCenter) {
                            setMapCenter({ lat: 50, lng: 50, zoom: newZoom });
                          } else {
                            setMapCenter({
                              ...mapCenter,
                              zoom: newZoom
                            });
                          }
                        }}
                        className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200 hover:text-olive text-stone-700 transition-all flex items-center justify-center active:scale-90 cursor-pointer font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-stone-100 disabled:hover:text-stone-700 disabled:active:scale-100"
                        id="map-incremental-zoom-in-btn"
                        title="Zoom In (or press '+')"
                        aria-label="Zoom In"
                      >
                        +
                      </button>

                      {/* Zoom Snap Interval Custom Control Group */}
                      <div className="flex items-center gap-1.5 border-l border-r border-stone-200/60 px-3 h-7 animate-fade-in" id="map-custom-snap-input-group">
                        <span className="text-[9px] font-black font-sans text-stone-500 uppercase tracking-wider select-none whitespace-nowrap">Snap:</span>
                        
                        <button
                          type="button"
                          disabled={isZoomLocked}
                          onClick={() => {
                            if (zoomSnapIncrement === null) {
                              const parsed = parseFloat(snapInputValue);
                              const val = !isNaN(parsed) && parsed > 0 ? Number(parsed.toFixed(3)) : 0.25;
                              setZoomSnapIncrement(val);
                            } else {
                              setZoomSnapIncrement(null);
                            }
                          }}
                          className={`w-7 h-7 rounded-lg border transition-all flex items-center justify-center active:scale-90 cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed ${
                            zoomSnapIncrement !== null
                              ? 'bg-olive text-white border-olive shadow-sm'
                              : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-650 hover:text-olive'
                          }`}
                          id="map-zoom-snap-btn"
                          title={
                            zoomSnapIncrement !== null
                              ? `Zoom snapping is ACTIVE at ${zoomSnapIncrement}x steps. Click to disable snapping.`
                              : "Enable custom zoom slider snapping"
                          }
                          aria-label="Toggle Zoom Snapping Grid"
                        >
                          <Magnet className={`w-3.5 h-3.5 ${zoomSnapIncrement !== null ? 'animate-pulse' : ''}`} />
                        </button>

                        <div className="flex items-center gap-1 relative" id="map-zoom-snap-input-container">
                          <input
                            type="number"
                            id="map-zoom-snap-input"
                            min="0.01"
                            max="5.0"
                            step="0.01"
                            placeholder="0.25"
                            value={snapInputValue}
                            disabled={isZoomLocked}
                            onChange={(e) => {
                              const inputString = e.target.value;
                              setSnapInputValue(inputString);
                              const parsed = parseFloat(inputString);
                              if (!isNaN(parsed) && parsed > 0) {
                                if (zoomSnapIncrement !== null) {
                                  setZoomSnapIncrement(Number(parsed.toFixed(3)));
                                }
                              }
                            }}
                            onBlur={() => {
                              const parsed = parseFloat(snapInputValue);
                              if (isNaN(parsed) || parsed <= 0) {
                                setSnapInputValue('0.25');
                                if (zoomSnapIncrement !== null) {
                                  setZoomSnapIncrement(0.25);
                                }
                              } else {
                                const rounded = Number(Math.max(0.01, Math.min(5.0, parsed)).toFixed(3));
                                setSnapInputValue(rounded.toString());
                                if (zoomSnapIncrement !== null) {
                                  setZoomSnapIncrement(rounded);
                                }
                              }
                            }}
                            className="w-14 h-7 text-center rounded-lg border border-stone-200 text-[10px] font-mono font-black bg-stone-50 text-stone-700 outline-none focus:border-olive focus:ring-1 focus:ring-olive disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Define custom snap step value (e.g. 0.1, 0.75). Minimum is 0.01."
                            aria-label="Define custom zoom snap step"
                          />
                          <span className="text-[9px] font-bold text-stone-400 select-none">x</span>
                        </div>

                        {/* Quick preset buttons for instant interaction (e.g. 0.1, 0.25, 0.75) */}
                        <div className="flex items-center gap-1" id="map-zoom-snap-quick-presets">
                          {[0.1, 0.25, 0.75].map((presetVal) => {
                            const isCurrent = zoomSnapIncrement === presetVal;
                            return (
                              <button
                                key={presetVal}
                                type="button"
                                disabled={isZoomLocked}
                                onClick={() => {
                                  setSnapInputValue(presetVal.toString());
                                  setZoomSnapIncrement(presetVal);
                                }}
                                className={`px-1.5 h-5 rounded-md text-[8px] font-black transition-all border cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed ${
                                  isCurrent
                                    ? 'bg-olive/10 border-olive text-olive font-extrabold'
                                    : 'bg-stone-50 border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                                }`}
                                title={`Set snap scale directly to ${presetVal}x`}
                                aria-label={`Set snap scale directly to ${presetVal}x`}
                              >
                                {presetVal}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mapped Preset Zoom Buttons */}
                      {[
                        { val: 0.01, id: "map-extreme-zoom-out-btn", label: "Zoom 0.01x", desc: "Extreme Zoom Out" },
                        { val: 0.015, id: "map-preset-zoom-0015-btn", label: "Zoom 0.015x", desc: "Fine Wide-Angle Step" },
                        { val: 0.02, id: "map-preset-zoom-002-btn", label: "Zoom 0.02x", desc: "Wide-Angle Step" },
                        { val: 0.03, id: "map-preset-zoom-003-btn", label: "Zoom 0.03x", desc: "Logical Wide-Angle Intermediate" },
                        { val: 0.04, id: "map-preset-zoom-004-btn", label: "Zoom 0.04x", desc: "Smoother Wide-Angle" },
                        { val: 0.05, id: "map-preset-zoom-005-btn", label: "Zoom 0.05x", desc: "Very Wide" },
                        { val: 0.08, id: "map-preset-zoom-008-btn", label: "Zoom 0.08x", desc: "Ultra Wide" },
                        { val: 0.1, id: "map-preset-zoom-01-btn", label: "Zoom 0.1x", desc: "Wide" },
                        { val: 0.12, id: "map-preset-zoom-012-btn", label: "Zoom 0.12x", desc: "Wide-Intermediate" },
                        { val: 0.125, id: "map-preset-zoom-0125-btn", label: "Zoom 0.125x", desc: "Refined Wide Step" },
                        { val: 0.14, id: "map-preset-zoom-014-btn", label: "Zoom 0.14x", desc: "Fine Wide-Angle navigational scale" },
                        { val: 0.15, id: "map-preset-zoom-015-btn", label: "Zoom 0.15x", desc: "Intermediate Wide" },
                        { val: 0.16, id: "map-preset-zoom-016-btn", label: "Zoom 0.16x", desc: "Fine Navigational Gap Step" },
                        { val: 0.18, id: "map-preset-zoom-018-btn", label: "Zoom 0.18x", desc: "Mid-Wide" },
                        { val: 0.2, id: "map-preset-zoom-02-btn", label: "Zoom 0.2x", desc: "" },
                        { val: 0.22, id: "map-preset-zoom-022-btn", label: "Zoom 0.22x", desc: "Logical Intermediate Step" },
                        { val: 0.25, id: "map-preset-zoom-025-btn", label: "Zoom 0.25x", desc: "Quarter Scale" },
                        { val: 0.28, id: "map-preset-zoom-028-btn", label: "Zoom 0.28x", desc: "Improved Granular Navigation" },
                        { val: 0.3, id: "map-preset-zoom-03-btn", label: "Zoom 0.3x", desc: "" },
                        { val: 0.35, id: "map-preset-zoom-035-btn", label: "Zoom 0.35x", desc: "Refined Scale" },
                        { val: 0.4, id: "map-preset-zoom-04-btn", label: "Zoom 0.4x", desc: "Fine Scale" },
                        { val: 0.5, id: "map-preset-zoom-05-btn", label: "Zoom 0.5x", desc: "Half Scale" },
                        { val: 0.55, id: "map-preset-zoom-055-btn", label: "Zoom 0.55x", desc: "Refined Granular Step" },
                        { val: 0.6, id: "map-preset-zoom-06-btn", label: "Zoom 0.6x", desc: "Intermediate Zoom" },
                        { val: 0.65, id: "map-preset-zoom-065-btn", label: "Zoom 0.65x", desc: "Refined Intermediate" },
                        { val: 0.7, id: "map-preset-zoom-07-btn", label: "Zoom 0.7x", desc: "Stable Mid-High Zoom" },
                        { val: 0.75, id: "map-preset-zoom-075-btn", label: "Zoom 0.75x", desc: "" },
                        { val: 0.85, id: "map-preset-zoom-085-btn", label: "Zoom 0.85x", desc: "" },
                        { val: 1.0, id: "map-preset-zoom-center-btn", label: "Center Zoom", desc: "Center Zoom (1.0x)" },
                        { val: 2.0, id: "map-preset-zoom-20-btn", label: "Zoom 2.0x", desc: "Close Up" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          disabled={isZoomLocked}
                          onClick={() => triggerPresetZoom(item.val)}
                          className={`px-2 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-200 hover:text-olive text-stone-750 transition-all flex items-center justify-center active:scale-90 cursor-pointer font-extrabold text-[9px] uppercase tracking-wider whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-stone-100 disabled:hover:text-stone-700 disabled:active:scale-100 relative ${item.val === 0.14 ? 'group' : ''}`}
                          id={item.id}
                          title={item.val === 0.14 ? "Fine Wide-Angle" : (item.desc ? `${item.label} Preset (${item.desc})` : `${item.label} Preset`)}
                          aria-label={item.desc ? `Set zoom to ${item.desc.toLowerCase()} preset (${item.val}x)` : `Set zoom to ${item.val}x`}
                        >
                          {item.label}
                          {item.val === 0.14 && (
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[10px] font-sans normal-case font-bold text-white bg-stone-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg whitespace-nowrap z-50">
                              Fine Wide-Angle
                              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900" />
                            </span>
                          )}
                        </button>
                      ))}

                      <div 
                        className={`flex flex-col items-center justify-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg select-none min-w-[64px] text-center border transition-all duration-300 relative ${
                          (mapCenter ? mapCenter.zoom : 1.0) <= 0.01
                            ? 'bg-rose-100 border-rose-400 text-rose-900 shadow-sm'
                            : (mapCenter ? mapCenter.zoom : 1.0) >= 5.0
                            ? 'bg-emerald-100 border-emerald-450 text-emerald-950 shadow-sm'
                            : (mapCenter ? mapCenter.zoom : 1.0) <= 0.10 || (mapCenter ? mapCenter.zoom : 1.0) >= 4.50
                            ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-sm shadow-amber-100 animate-[pulse_2s_infinite]'
                            : 'bg-stone-50 border-stone-150'
                        }`} 
                        id="map-zoom-percentage-badge" 
                        title={
                          (mapCenter ? mapCenter.zoom : 1.0) <= 0.01
                            ? "Strict minimum limit reached! (0.01x zoom)"
                            : (mapCenter ? mapCenter.zoom : 1.0) >= 5.0
                            ? "Strict maximum limit reached! (5.0x zoom)"
                            : (mapCenter ? mapCenter.zoom : 1.0) <= 0.10
                            ? "Warning: Nearing minimum limit of 0.01x zoom!"
                            : (mapCenter ? mapCenter.zoom : 1.0) >= 4.50
                            ? "Warning: Nearing maximum limit of 5.0x zoom!"
                            : "Current Map Zoom Level"
                        }
                      >
                        <div className="flex items-center gap-1">
                          {(mapCenter ? mapCenter.zoom : 1.0) <= 0.01 ? (
                            <span className="px-1 py-0.5 text-[8px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 rounded select-none animate-[pulse_1s_infinite] tracking-tighter" id="map-zoom-min-indicator">MIN</span>
                          ) : (mapCenter ? mapCenter.zoom : 1.0) >= 5.0 ? (
                            <span className="px-1 py-0.5 text-[8px] font-black uppercase text-emerald-800 bg-emerald-50 border border-emerald-200 rounded select-none animate-[pulse_1s_infinite] tracking-tighter" id="map-zoom-max-indicator">MAX</span>
                          ) : ((mapCenter ? mapCenter.zoom : 1.0) <= 0.10 || (mapCenter ? mapCenter.zoom : 1.0) >= 4.50) && (
                            <AlertTriangle className="w-3 h-3 text-amber-600 animate-[bounce_1.5s_infinite]" />
                          )}
                          <span className="font-black font-mono text-stone-850 leading-none">
                            {Math.round((mapCenter ? mapCenter.zoom : 1.0) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-1 bg-stone-200/80 rounded-full overflow-hidden" aria-hidden="true">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              (mapCenter ? mapCenter.zoom : 1.0) <= 0.01
                                ? 'bg-rose-500'
                                : (mapCenter ? mapCenter.zoom : 1.0) >= 5.0
                                ? 'bg-emerald-600'
                                : (mapCenter ? mapCenter.zoom : 1.0) <= 0.10 || (mapCenter ? mapCenter.zoom : 1.0) >= 4.50
                                ? 'bg-amber-600'
                                : 'bg-olive'
                            }`}
                            style={{
                              width: `${Math.max(0, Math.min(100, (((mapCenter ? mapCenter.zoom : 1.0) - 0.01) / (5.0 - 0.01)) * 100))}%`
                            }}
                          />
                        </div>
                      </div>

                      {/* Precise decimal zoom numeric input */}
                      <div className="flex items-center gap-1 border-l border-stone-200/60 pl-2" id="map-zoom-numeric-input-container">
                        <input
                          type="number"
                          min="0.01"
                          max="5.0"
                          step="0.01"
                          value={zoomInputValue}
                          disabled={isZoomLocked}
                          onChange={(e) => setZoomInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = parseFloat(zoomInputValue);
                              if (!isNaN(val)) {
                                const clamped = Math.max(0.01, Math.min(5.0, val));
                                const rounded = Number(clamped.toFixed(2));
                                if (!mapCenter) {
                                  setMapCenter({ lat: 50, lng: 50, zoom: rounded });
                                } else {
                                  setMapCenter({
                                    ...mapCenter,
                                    zoom: rounded,
                                  });
                                }
                                setZoomInputValue(rounded.toFixed(2));
                              } else {
                                const z = mapCenter ? mapCenter.zoom : 1.0;
                                setZoomInputValue(z.toFixed(2));
                              }
                              e.currentTarget.blur();
                            }
                          }}
                          onFocus={() => setIsZoomInputFocused(true)}
                          onBlur={() => {
                            setIsZoomInputFocused(false);
                            const val = parseFloat(zoomInputValue);
                            if (!isNaN(val)) {
                              const clamped = Math.max(0.01, Math.min(5.0, val));
                              const rounded = Number(clamped.toFixed(2));
                              if (!mapCenter) {
                                  setMapCenter({ lat: 50, lng: 50, zoom: rounded });
                              } else {
                                setMapCenter({
                                  ...mapCenter,
                                  zoom: rounded,
                                });
                              }
                              setZoomInputValue(rounded.toFixed(2));
                            } else {
                              const z = mapCenter ? mapCenter.zoom : 1.0;
                              setZoomInputValue(z.toFixed(2));
                            }
                          }}
                          className="w-12 px-1 py-0.5 rounded border border-stone-200 text-[10px] font-mono font-bold focus:outline-none focus:border-olive focus:ring-1 focus:ring-olive text-center bg-stone-50 text-stone-800 disabled:opacity-40 disabled:cursor-not-allowed"
                          id="map-zoom-numeric-input"
                          placeholder="1.00"
                          title="Type decimal zoom (0.01 to 5.0) and press Enter"
                          aria-label="Precision numeric zoom input"
                        />
                        <span className="text-[10px] font-black text-stone-500 font-mono select-none">x</span>
                      </div>

                      {/* Zoom Sensitivity Override Control */}
                      <div className="flex items-center gap-2 border-l border-stone-200/60 pl-2 pr-1 h-7" id="map-zoom-sensitivity-container">
                        <Sliders className={`w-3.5 h-3.5 transition-colors duration-300 ${zoomSensitivity !== 0.25 ? 'text-olive font-extrabold' : 'text-stone-500'}`} />
                        <div className="flex flex-col justify-center">
                          <div className="flex items-center gap-1">
                            <label htmlFor="map-zoom-sensitivity-slider" className={`text-[8px] font-black font-mono uppercase leading-none select-none tracking-tight pb-0.5 transition-colors duration-300 ${zoomSensitivity !== 0.25 ? 'text-olive' : 'text-stone-500'}`}>
                              Sensitivity:
                            </label>
                            {zoomSensitivity !== 0.25 && (
                              <span className="w-1 h-1 bg-olive rounded-full animate-pulse" title="Custom Sensitivity Level Active" />
                            )}
                          </div>
                          <input
                            type="range"
                            id="map-zoom-sensitivity-slider"
                            min="0.01"
                            max="1.5"
                            step="0.01"
                            value={zoomSensitivity}
                            disabled={isZoomLocked}
                            onChange={(e) => setZoomSensitivity(Number(parseFloat(e.target.value).toFixed(2)))}
                            className="w-16 h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-olive focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Adjust Zoom Sensitivity Slider"
                            aria-label="Adjust Zoom Sensitivity Step"
                          />
                        </div>

                        {/* Dedicated Interactive Numeric Input for Zoom Sensitivity */}
                        <div className="flex items-center gap-0.5" id="map-zoom-sensitivity-input-wrapper">
                          <input
                            type="number"
                            id="map-zoom-sensitivity-input"
                            min="0.01"
                            max="2.0"
                            step="0.01"
                            value={sensitivityInputValue}
                            disabled={isZoomLocked}
                            onChange={(e) => setSensitivityInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = parseFloat(sensitivityInputValue);
                                if (!isNaN(val)) {
                                  const clamped = Math.max(0.01, Math.min(2.0, val));
                                  const rounded = Number(clamped.toFixed(2));
                                  setZoomSensitivity(rounded);
                                } else {
                                  setSensitivityInputValue(zoomSensitivity.toFixed(2));
                                }
                                e.currentTarget.blur();
                              }
                            }}
                            onBlur={() => {
                              const val = parseFloat(sensitivityInputValue);
                              if (!isNaN(val)) {
                                const clamped = Math.max(0.01, Math.min(2.0, val));
                                const rounded = Number(clamped.toFixed(2));
                                setZoomSensitivity(rounded);
                              } else {
                                setSensitivityInputValue(zoomSensitivity.toFixed(2));
                              }
                            }}
                            className="w-11 px-0.5 py-0.5 rounded border border-stone-200 text-[9px] font-mono font-black focus:outline-none focus:border-olive focus:ring-1 focus:ring-olive text-center bg-stone-50 text-stone-800 disabled:opacity-40 disabled:cursor-not-allowed animate-fade-in"
                            title="Direct sensitivity zoom step (0.01 to 2.0) and press Enter"
                            aria-label="Direct Zoom Sensitivity Step Input"
                          />
                          <span className="text-[9px] font-black text-stone-400 font-mono select-none">x</span>
                        </div>

                        {/* Zoom Sensitivity Reset Button */}
                        <button
                          type="button"
                          disabled={zoomSensitivity === 0.25 || isZoomLocked}
                          onClick={() => setZoomSensitivity(0.25)}
                          className={`w-5 h-5 rounded-full border transition-all flex items-center justify-center active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed group ${
                            zoomSensitivity !== 0.25 
                              ? 'bg-olive text-warm-white border-olive hover:bg-olive/90 shadow-sm' 
                              : 'bg-stone-50 border-stone-200 text-stone-400 hover:text-stone-600'
                          }`}
                          id="map-zoom-sensitivity-reset-btn"
                          title="Reset Zoom Sensitivity to default 0.25x"
                          aria-label="Reset Zoom Sensitivity to default 0.25x"
                        >
                          <RotateCcw className="w-2.5 h-2.5 transition-transform duration-300 group-hover:rotate-180" />
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={isZoomLocked}
                        onClick={() => {
                          if (!mapCenter) {
                            setMapCenter({ lat: 50, lng: 50, zoom: 1.0 });
                          } else {
                            setMapCenter({
                              ...mapCenter,
                              zoom: 1.0
                            });
                          }
                        }}
                        className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200 hover:text-olive text-stone-700 transition-all flex items-center justify-center active:scale-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-stone-100 disabled:hover:text-stone-700 disabled:active:scale-100"
                        id="map-zoom-reset-btn"
                        title="Reset Zoom to 100%"
                        aria-label="Reset Zoom to 100%"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      {[0.15, 0.25, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6].map((val) => (
                        <button
                          key={val}
                          type="button"
                          disabled={isZoomLocked}
                          onClick={() => triggerPresetZoom(val)}
                          className="px-2.5 h-7 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200 hover:text-olive text-stone-700 transition-all flex items-center justify-center active:scale-90 cursor-pointer text-[10px] font-black disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-stone-100 disabled:hover:text-stone-700 disabled:active:scale-100 whitespace-nowrap"
                          id={`map-zoom-${val.toString().replace('.', '')}x-btn`}
                          title={`Zoom to exactly ${val}x`}
                          aria-label={`Zoom to exactly ${val}x`}
                        >
                          Zoom {val}x
                        </button>
                      ))}

                      {/* Predefined Zoom Presets */}
                      <div className="flex items-center gap-2 border-l border-stone-200/60 pl-3 h-7" id="map-zoom-presets-container">
                        <span className="text-[10px] font-black font-sans text-stone-500 uppercase tracking-wider select-none whitespace-nowrap">Presets:</span>
                        
                        <div className="relative flex items-center bg-stone-50 border border-stone-200/50 rounded-full px-1.5 py-0.5" id="map-zoom-presets-wrapper">
                          <div 
                            className="flex items-center gap-1.5 overflow-x-auto scroll-smooth py-0.5" 
                            id="map-zoom-presets-scrollable-row"
                            style={{ 
                              maxWidth: '240px',
                              scrollbarWidth: 'none',
                              msOverflowStyle: 'none'
                            }}
                          >
                            <style>{`
                              #map-zoom-presets-scrollable-row::-webkit-scrollbar {
                                display: none;
                              }
                              @keyframes map-rotate-360 {
                                from {
                                  transform: rotate(0deg);
                                }
                                to {
                                  transform: rotate(360deg);
                                }
                              }
                              @keyframes map-reset-highlight {
                                0% {
                                  box-shadow: 0 0 0 0px rgba(244, 63, 94, 0);
                                  border-color: rgba(120, 113, 108, 0.1);
                                  transform: scale(1);
                                }
                                30% {
                                  box-shadow: 0 0 0 8px rgba(244, 63, 94, 0.45);
                                  border-color: rgba(244, 63, 94, 0.82);
                                  transform: scale(1.004);
                                }
                                100% {
                                  box-shadow: 0 0 0 0px rgba(244, 63, 94, 0);
                                  border-color: rgba(120, 113, 108, 0.1);
                                  transform: scale(1);
                                }
                              }
                              .animate-map-highlight {
                                animation: map-reset-highlight 0.8s ease-out;
                              }
                            `}</style>
                            {[
                              { value: 0.015, id: 'map-zoom-preset-0015x-btn' },
                              { value: 0.02, id: 'map-zoom-preset-002x-btn' },
                              { value: 0.03, id: 'map-zoom-preset-003x-btn' },
                              { value: 0.04, id: 'map-zoom-preset-004x-btn' },
                              { value: 0.05, id: 'map-zoom-preset-005x-btn' },
                              { value: 0.1, id: 'map-zoom-preset-01x-btn' },
                              { value: 0.14, id: 'map-zoom-preset-014x-btn' },
                              { value: 0.15, id: 'map-zoom-preset-015x-btn' },
                              { value: 0.16, id: 'map-zoom-preset-016x-btn' },
                              { value: 0.25, id: 'map-zoom-preset-025x-btn' },
                              { value: 0.28, id: 'map-zoom-preset-028x-btn' },
                              { value: 0.3, id: 'map-zoom-03x-btn' },
                              { value: 0.35, id: 'map-zoom-035x-btn' },
                              { value: 0.4, id: 'map-zoom-04x-btn' },
                              { value: 0.45, id: 'map-zoom-045x-btn' },
                              { value: 0.5, id: 'map-zoom-05x-btn' },
                              { value: 0.55, id: 'map-zoom-055x-btn' },
                              { value: 0.6, id: 'map-zoom-06x-btn' },
                              { value: 0.65, id: 'map-zoom-065x-btn' },
                              { value: 0.7, id: 'map-zoom-07x-btn' },
                              { value: 0.75, id: 'map-zoom-075x-btn' },
                              { value: 0.8, id: 'map-zoom-08x-btn' },
                              { value: 0.9, id: 'map-zoom-09x-btn' },
                              { value: 0.95, id: 'map-zoom-095x-btn' },
                              { value: 1.0, id: 'map-zoom-1x-btn' },
                              { value: 1.5, id: 'map-zoom-15x-btn' },
                              { value: 2.0, id: 'map-zoom-2x-btn' },
                              { value: 5.0, id: 'map-zoom-5x-btn' }
                            ].map((preset) => {
                              const isSelected = Math.abs((mapCenter ? mapCenter.zoom : 1.0) - preset.value) < 0.01;
                              return (
                                <button
                                  key={preset.value}
                                  type="button"
                                  disabled={isZoomLocked}
                                  onClick={() => triggerPresetZoom(preset.value)}
                                  className={`h-[22px] px-2.5 rounded-full text-[9px] font-black tracking-tight flex items-center justify-center active:scale-90 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border whitespace-nowrap focus:outline-none ${
                                    isSelected
                                      ? 'bg-olive border-olive text-warm-white shadow-xs'
                                      : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                                  }`}
                                  id={preset.id}
                                  title={`Zoom to ${preset.value}x`}
                                  aria-label={`Zoom to ${preset.value}x`}
                                >
                                  {preset.value}x
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Presets Select Dropdown of same values for ultimate quick select */}
                        <div className="relative flex items-center h-full" id="map-zoom-presets-dropdown-wrapper">
                          <select
                            id="map-zoom-presets-select"
                            disabled={isZoomLocked}
                            value={
                              [0.015, 0.02, 0.03, 0.04, 0.05, 0.1, 0.14, 0.15, 0.16, 0.25, 0.28, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.9, 0.95, 1.0, 1.5, 2.0, 5.0].find(
                                p => Math.abs((mapCenter ? mapCenter.zoom : 1.0) - p) < 0.01
                              ) || ""
                            }
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                triggerPresetZoom(val);
                              }
                            }}
                            className="bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg px-2 py-0.5 text-[9px] font-black text-stone-700 outline-none cursor-pointer focus:border-olive focus:ring-1 focus:ring-olive pr-4"
                            title="Direct Dropdown Selection"
                          >
                            <option value="" disabled>Select Preset</option>
                            {[
                              { label: '0.015x', value: 0.015 },
                              { label: '0.02x (Wide)', value: 0.02 },
                              { label: '0.03x', value: 0.03 },
                              { label: '0.04x', value: 0.04 },
                              { label: '0.05x', value: 0.05 },
                              { label: '0.10x', value: 0.1 },
                              { label: '0.14x (Fine Wide-Angle)', value: 0.14 },
                              { label: '0.15x', value: 0.15 },
                              { label: '0.16x', value: 0.16 },
                              { label: '0.25x (Plan)', value: 0.25 },
                              { label: '0.28x', value: 0.28 },
                              { label: '0.30x', value: 0.3 },
                              { label: '0.35x', value: 0.35 },
                              { label: '0.40x', value: 0.4 },
                              { label: '0.45x', value: 0.45 },
                              { label: '0.50x (Mid)', value: 0.5 },
                              { label: '0.55x', value: 0.55 },
                              { label: '0.60x', value: 0.6 },
                              { label: '0.65x', value: 0.65 },
                              { label: '0.70x', value: 0.7 },
                              { label: '0.75x', value: 0.75 },
                              { label: '0.80x', value: 0.8 },
                              { label: '0.90x', value: 0.9 },
                              { label: '0.95x', value: 0.95 },
                              { label: '1.00x (Standard)', value: 1.0 },
                              { label: '1.50x', value: 1.5 },
                              { label: '2.00x (Detailed)', value: 2.0 },
                              { label: '5.00x (Macro)', value: 5.0 }
                            ].map((preset) => (
                              <option key={preset.value} value={preset.value}>
                                {preset.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMapPitch(prev => prev === 0 ? 35 : 0);
                        }}
                        className={`w-7 h-7 rounded-full border transition-all flex items-center justify-center active:scale-90 cursor-pointer ${
                          mapPerspective === 'tilted' 
                             ? 'bg-olive text-warm-white border-olive' 
                             : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-700 hover:text-olive'
                        }`}
                        id="map-perspective-toggle-btn"
                        title={mapPerspective === 'tilted' ? "Switch to Top-Down View" : "Switch to Tilted 3D View"}
                        aria-label={mapPerspective === 'tilted' ? "Switch to Top-Down View" : "Switch to Tilted 3D View"}
                      >
                        <Box className={`w-3.5 h-3.5 transition-transform duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${mapPerspective === 'tilted' ? 'rotate-180 scale-110' : 'rotate-0'}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMapPitch(prev => prev === 0 ? 35 : 0);
                        }}
                        className={`px-2.5 h-7 rounded-full border transition-all flex items-center justify-center active:scale-90 cursor-pointer text-[9px] font-extrabold uppercase tracking-wider whitespace-nowrap ${
                          mapPerspective === 'tilted' 
                            ? 'bg-olive text-warm-white border-olive' 
                            : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-700 hover:text-olive'
                        }`}
                        id="map-zoom-toggle-perspective-btn"
                        title="Toggle Perspective"
                        aria-label="Toggle Perspective"
                      >
                        Toggle Perspective
                      </button>

                      {/* Reset Perspective to Top-Down */}
                      <button
                        type="button"
                        disabled={mapPerspective === 'top-down'}
                        onClick={() => {
                          setMapPitch(0);
                        }}
                        className={`w-7 h-7 rounded-full border transition-all flex items-center justify-center active:scale-90 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                          mapPerspective === 'tilted'
                            ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100 shadow-sm animate-pulse'
                            : 'bg-stone-50 border-stone-200 text-stone-400'
                        }`}
                        id="map-perspective-reset-btn"
                        title={mapPerspective === 'tilted' ? "Reset Map Perspective to Top-Down" : "Map is already in Top-Down view"}
                        aria-label="Reset Map Perspective to Top-Down"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={isZoomLocked}
                        onClick={() => {
                          setMapCenter({ lat: 40, lng: 45, zoom: 1.0 });
                        }}
                        className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200 hover:text-olive text-stone-700 transition-all flex items-center justify-center active:scale-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-stone-100 disabled:hover:text-stone-700 disabled:active:scale-100"
                        id="map-recenter-user-btn"
                        title="Reset to User Location"
                        aria-label="Reset to User Location"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                      </button>

                      {/* Full Animated View & Rotation Reset Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setMapCenter(null);
                          setMapPitch(0);
                          setIsMapRotating(false);
                          setIsResetting(true);
                          setTimeout(() => {
                            setIsResetting(false);
                          }, 1900);
                          triggerMapHighlight();
                        }}
                        className="w-7 h-7 rounded-full bg-stone-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-stone-200 text-stone-605 transition-all flex items-center justify-center active:scale-90 cursor-pointer"
                        id="map-zoom-full-reset-btn"
                        title="Reset Zoom, Perspective & Cinematic Rotation"
                        aria-label="Reset Zoom, Perspective and Cinematic Rotation"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      </div>

                      {/* Zoom Ranges Legend List */}
                      <div className="flex items-center justify-between border-t border-stone-200/60 pt-2 px-1 text-[9px] text-stone-500 font-extrabold select-none" id="map-zoom-legend-list">
                        <span className="text-[8px] uppercase tracking-wider text-stone-400 font-extrabold flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-olive animate-pulse" /> Zoom Ranges:
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 hover:text-stone-750 transition-colors">
                            <span className="w-1 h-1 rounded-full bg-amber-500" />
                            <span>Wide-Angle</span>
                            <span className="font-mono text-stone-400">(0.01x - 0.15x)</span>
                          </span>
                          <span className="flex items-center gap-1 hover:text-stone-750 transition-colors">
                            <span className="w-1 h-1 rounded-full bg-stone-500" />
                            <span>Standard/Detail</span>
                            <span className="font-mono text-stone-400">(0.5x - 2.0x)</span>
                          </span>
                          <span className="flex items-center gap-1 hover:text-stone-750 transition-colors">
                            <span className="w-1 h-1 rounded-full bg-emerald-600" />
                            <span>Macro</span>
                            <span className="font-mono text-stone-400">(5.0x)</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pitch Tilt vertical slider card */}
                    <div className="flex flex-col items-center justify-between bg-white/95 backdrop-blur-md border border-stone-200/65 shadow-md rounded-[20px] px-2.5 py-3.5 w-12 hover:border-olive/40 transition-all self-stretch animate-fade-in" id="map-pitch-tilt-slider-card">
                      <span className="text-[8px] font-black uppercase tracking-wider text-stone-400 select-none pb-1 leading-none text-center">
                        Tilt
                      </span>
                      
                      <div className="relative flex flex-col items-center justify-center py-2 h-32 w-full" id="map-pitch-slider-track-container">
                        {/* Vertical range input */}
                        <input
                          type="range"
                          min="0"
                          max="60"
                          step="1"
                          value={mapPitch}
                          onChange={(e) => setMapPitch(Number(e.target.value))}
                          className="h-28 w-1.5 focus:outline-hidden cursor-ns-resize accent-olive bg-stone-200 rounded-lg hover:bg-stone-300 transition-colors"
                          style={{
                            writingMode: 'vertical-lr',
                            direction: 'rtl',
                            WebkitAppearance: 'slider-vertical',
                          }}
                          id="map-pitch-range-slider"
                          title="Adjust Map Tilt/Perspective (0° - 60°)"
                          aria-label="Adjust map perspective tilt angle vertical slider"
                        />
                      </div>

                      <div className="flex flex-col items-center gap-1 mt-1.5 pt-1.5 border-t border-stone-200/60 w-full" id="map-pitch-readout-container">
                        <span className="text-[9px] font-mono font-black text-olive leading-none">
                          {mapPitch}°
                        </span>
                      </div>
                    </div>
                  </div>

                    {/* Expandable/Collapsible Category Visibility Filters */}
                    <div className="flex flex-col items-end gap-2" id="map-category-filters-container">
                      <button
                        type="button"
                        onClick={() => setIsCategoryFiltersOpen(!isCategoryFiltersOpen)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-[18px] border shadow-xs duration-200 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                          isCategoryFiltersOpen 
                            ? 'bg-olive border-olive text-warm-white' 
                            : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-600'
                        }`}
                        id="map-category-filters-toggle-btn"
                        title="Toggle category visibility panel"
                      >
                        <Filter className={`w-3.5 h-3.5 ${isCategoryFiltersOpen ? 'scale-110' : ''} transition-transform duration-250`} />
                        <span>Category Visibility</span>
                      </button>

                      <AnimatePresence>
                        {isCategoryFiltersOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 12 }}
                            transition={{ type: "spring", stiffness: 280, damping: 20 }}
                            className="w-72 bg-white/95 backdrop-blur-md border border-stone-200/50 p-4 rounded-[24px] shadow-xl flex flex-col gap-3.5 text-left"
                            id="map-category-filters-card"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <h4 className="serif text-[12px] font-extrabold text-stone-900 leading-tight">Category Filters</h4>
                                <p className="text-[9px] text-stone-500 font-medium leading-none mt-1">Toggle which categories display on the map</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setVisibleMapCategories(['Arts & Culture', 'Wellness', 'Social', 'Learning', 'Nature', 'Food'])}
                                  className="text-[8.5px] font-black uppercase tracking-wider text-olive hover:underline cursor-pointer bg-stone-100 hover:bg-stone-200/70 px-1.5 py-0.5 rounded-md"
                                  id="select-all-map-cats-btn"
                                >
                                  All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setVisibleMapCategories([])}
                                  className="text-[8.5px] font-black uppercase tracking-wider text-rose-600 hover:underline cursor-pointer bg-stone-100 hover:bg-stone-200/70 px-1.5 py-0.5 rounded-md"
                                  id="clear-all-map-cats-btn"
                                >
                                  None
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-1">
                              {CATEGORIES.map(cat => {
                                const isChecked = visibleMapCategories.includes(cat);
                                return (
                                  <div 
                                    key={cat} 
                                    className="flex items-center justify-between bg-stone-50/70 hover:bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200/30 transition-all cursor-pointer"
                                    onClick={() => {
                                      if (isChecked) {
                                        setVisibleMapCategories(visibleMapCategories.filter(c => c !== cat));
                                      } else {
                                        setVisibleMapCategories([...visibleMapCategories, cat]);
                                      }
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="scale-75 origin-center inline-block -mx-1 text-olive">
                                        {getCategoryIcon(cat)}
                                      </span>
                                      <span className="text-[10px] font-bold text-stone-700 leading-none">{cat}</span>
                                    </div>
                                    <button
                                      type="button"
                                      className={`relative inline-flex h-4 w-7.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${isChecked ? 'bg-olive' : 'bg-stone-300'}`}
                                      role="checkbox"
                                      aria-checked={isChecked}
                                      id={`category-toggle-switch-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                                      title={`Toggle ${cat} category visibility`}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-250 ease-in-out ${isChecked ? 'translate-x-[14px]' : 'translate-x-0'}`}
                                      />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Expandable/Collapsible Display and Layers Control Panel */}
                    <div className="flex flex-col items-end gap-2" id="map-layers-customizer-parent">
                      <div className="flex flex-row gap-2 items-center">
                        {/* High-Contrast Quick-Switch Button */}
                        <button
                          type="button"
                          onClick={() => setIsHighContrastDark(!isHighContrastDark)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-[18px] border shadow-xs duration-200 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                            isHighContrastDark
                              ? 'bg-zinc-900 border-zinc-800 text-amber-450 hover:bg-zinc-800'
                              : 'bg-stone-100 hover:bg-stone-200/80 border-stone-200/80 text-stone-650'
                          }`}
                          id="map-contrast-toggle-quick-btn"
                          title={isHighContrastDark ? "Switch to High-Contrast Light Map" : "Switch to High-Contrast Dark Map"}
                        >
                          {isHighContrastDark ? (
                            <>
                              <Sun className="w-3.5 h-3.5 text-amber-400" />
                              <span>Contrast: Dark</span>
                            </>
                          ) : (
                            <>
                              <Moon className="w-3.5 h-3.5 text-stone-500" />
                              <span>Contrast: Light</span>
                            </>
                          )}
                        </button>

                        {/* Lat/Lng Coordinate Grid Quick Switch Button */}
                        <button
                          type="button"
                          onClick={() => setShowGridOverlay(!showGridOverlay)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-[18px] border shadow-xs duration-200 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                            showGridOverlay
                              ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-stone-100 hover:bg-stone-200/80 border-stone-200/80 text-stone-650'
                          }`}
                          id="map-grid-toggle-quick-btn"
                          title={showGridOverlay ? "Disable Latitude/Longitude Grid Overlay" : "Enable Latitude/Longitude Grid Overlay"}
                        >
                          <Grid className={`w-3.5 h-3.5 ${showGridOverlay ? 'animate-pulse' : 'text-stone-500'}`} />
                          <span>Grid Link: {showGridOverlay ? 'ON' : 'OFF'}</span>
                        </button>

                        {/* Direct +/- Zoom Button Group alongside other controls */}
                        <div className="flex items-center gap-1 bg-stone-100 border border-stone-200/80 rounded-[18px] p-0.5 shadow-xs" id="map-quick-zoom-direct-parent">
                          <button
                            type="button"
                            disabled={isZoomLocked}
                            onClick={() => {
                              const currentZoom = mapCenter ? mapCenter.zoom : 1.0;
                              const newZoom = Number(Math.min(maxZoomLimit, currentZoom + zoomSensitivity).toFixed(2));
                              if (!mapCenter) {
                                setMapCenter({ lat: 50, lng: 50, zoom: newZoom });
                              } else {
                                setMapCenter({
                                  ...mapCenter,
                                  zoom: newZoom
                                });
                              }
                            }}
                            className="flex items-center justify-center p-1.5 rounded-full bg-white hover:bg-stone-50 text-stone-700 hover:text-emerald-600 duration-150 transition-all cursor-pointer shadow-3xs hover:shadow-2xs active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed select-none"
                            id="quick-zoom-in-btn"
                            title="Zoom In (+)"
                          >
                            <Plus className="w-3.5 h-3.5 font-bold" />
                          </button>
                          
                          <span className="text-[9px] font-black font-mono tracking-tight text-stone-600 px-1 select-none min-w-[34px] text-center" title="Current Map Zoom Level">
                            {mapCenter ? `${(mapCenter.zoom).toFixed(2)}x` : '1.00x'}
                          </span>

                          <button
                            type="button"
                            disabled={isZoomLocked}
                            onClick={() => {
                              const currentZoom = mapCenter ? mapCenter.zoom : 1.0;
                              const newZoom = Number(Math.max(minZoomLimit, currentZoom - zoomSensitivity).toFixed(2));
                              if (!mapCenter) {
                                setMapCenter({ lat: 50, lng: 50, zoom: newZoom });
                              } else {
                                setMapCenter({
                                  ...mapCenter,
                                  zoom: newZoom
                                });
                              }
                            }}
                            className="flex items-center justify-center p-1.5 rounded-full bg-white hover:bg-stone-50 text-stone-700 hover:text-rose-600 duration-150 transition-all cursor-pointer shadow-3xs hover:shadow-2xs active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed select-none"
                            id="quick-zoom-out-btn"
                            title="Zoom Out (-)"
                          >
                            <Minus className="w-3.5 h-3.5 font-bold" />
                          </button>
                        </div>

                        {/* Precision Vertical Zoom Level Slider Card */}
                        <div className="flex flex-col items-center justify-between bg-white/95 backdrop-blur-xs border border-stone-200/85 hover:border-olive/35 shadow-xs rounded-[18px] px-2 py-1.5 h-[64px] w-[42px] transition-all select-none animate-fade-in" id="quick-vertical-zoom-slider-card" title="Manually Slide to Set Zoom">
                          <span className="text-[6.5px] font-black uppercase tracking-wider text-stone-400 select-none pb-0.5 leading-none text-center">Zoom</span>
                          <div className="relative flex flex-col items-center justify-center h-6 w-full" id="map-quick-zoom-vertical-track-container">
                            <input
                              type="range"
                              min={minZoomLimit}
                              max={maxZoomLimit}
                              step="0.01"
                              value={mapCenter ? mapCenter.zoom : 1.0}
                              disabled={isZoomLocked}
                              onChange={(e) => {
                                const val = Number(parseFloat(e.target.value).toFixed(2));
                                if (!mapCenter) {
                                  setMapCenter({ lat: 50, lng: 55, zoom: val });
                                } else {
                                  setMapCenter({
                                    ...mapCenter,
                                    zoom: val
                                  });
                                }
                                setZoomInputValue(val.toFixed(2));
                              }}
                              className="h-6 w-1 focus:outline-hidden cursor-ns-resize accent-olive bg-stone-200 rounded-lg hover:bg-stone-300 transition-colors"
                              style={{
                                writingMode: 'vertical-lr',
                                direction: 'rtl',
                                WebkitAppearance: 'slider-vertical',
                              }}
                              id="map-vertical-zoom-range-slider"
                              title={`Adjust Map Zoom Level: ${mapCenter ? mapCenter.zoom.toFixed(2) : '1.00'}x`}
                              aria-label="Adjust map zoom level vertical slider"
                            />
                          </div>
                          <span className="text-[7.5px] font-mono font-black text-olive leading-none select-none pt-0.5">
                            {mapCenter ? `${mapCenter.zoom.toFixed(1)}x` : '1.0x'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsMapLayersOpen(!isMapLayersOpen)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-[18px] border shadow-xs duration-200 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                            isMapLayersOpen 
                              ? 'bg-olive border-olive text-warm-white' 
                              : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-600'
                          }`}
                          id="map-layers-toggle-expand-btn"
                          title="Toggle map visual options"
                        >
                          <Layers className={`w-3.5 h-3.5 ${isMapLayersOpen ? 'rotate-180': ''} transition-transform duration-250`} />
                          <span>Map Styles & Layers</span>
                        </button>
                      </div>

                      <AnimatePresence>
                        {isMapLayersOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 12 }}
                            transition={{ type: "spring", stiffness: 280, damping: 20 }}
                            className="w-72 bg-white/95 backdrop-blur-md border border-stone-200/50 p-4 rounded-[24px] shadow-xl flex flex-col gap-3.5 text-left"
                            id="map-options-floating-card"
                          >
                            <div className="flex flex-col">
                              <h4 className="serif text-[12.5px] font-extrabold text-stone-900 leading-tight">Map Properties</h4>
                              <p className="text-[10px] text-stone-500 font-medium leading-none mt-1">Adjust vector grids, overlays, and elevations</p>
                            </div>

                            {/* View Modes grid selector */}
                            <div className="flex flex-col gap-2">
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#5c6052]">
                                Base Layout Modes
                              </span>
                              
                              <div className="grid grid-cols-3 gap-1.5">
                                {/* Standard Layout Button */}
                                <button
                                  type="button"
                                  onClick={() => setMapStyle('standard')}
                                  className={`group rounded-xl p-2 border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                                    mapStyle === 'standard' 
                                      ? 'border-[#4f5544] bg-[#4f5544]/5 text-olive font-extrabold shadow-xs' 
                                      : 'border-stone-150 bg-stone-50/50 hover:bg-stone-50 text-stone-500 hover:border-stone-350'
                                  }`}
                                  id="map-style-standard-btn-new"
                                  title="Standard Layout"
                                >
                                  <div className="w-full h-8 rounded-lg bg-[#faf8f5] overflow-hidden relative flex items-center justify-center border border-stone-200/50">
                                    <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(#4f5544 1px, transparent 1px)', backgroundSize: '6px 6px' }} />
                                    <MapIcon className={`w-3.5 h-3.5 ${mapStyle === 'standard' ? 'text-olive scale-110' : 'text-stone-400 group-hover:scale-110'} transition-transform duration-200`} />
                                  </div>
                                  <span className="text-[9px] font-bold tracking-wide">Standard</span>
                                </button>

                                {/* Satellite Photo Layout Button */}
                                <button
                                  type="button"
                                  onClick={() => setMapStyle('satellite')}
                                  className={`group rounded-xl p-2 border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                                    mapStyle === 'satellite' 
                                      ? 'border-[#4f5544] bg-[#4f5544]/5 text-olive font-extrabold shadow-xs' 
                                      : 'border-stone-150 bg-stone-50/50 hover:bg-stone-50 text-stone-500 hover:border-stone-350'
                                  }`}
                                  id="map-style-satellite-btn-new"
                                  title="Satellite Orbit Photography Mapping"
                                >
                                  <div className="w-full h-8 rounded-lg bg-[#0e1610] overflow-hidden relative flex items-center justify-center border border-stone-200/50">
                                    <div className="absolute inset-0 opacity-25 border border-emerald-500/25 scale-75 rounded-full animate-pulse" />
                                    <Globe className={`w-3.5 h-3.5 ${mapStyle === 'satellite' ? 'text-emerald-455 scale-110' : 'text-stone-300 group-hover:scale-110'} transition-transform duration-200`} />
                                  </div>
                                  <span className="text-[9px] font-bold tracking-wide">Satellite</span>
                                </button>

                                {/* Terrain Topographical Layout Button */}
                                <button
                                  type="button"
                                  onClick={() => setMapStyle('terrain')}
                                  className={`group rounded-xl p-2 border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                                    mapStyle === 'terrain' 
                                      ? 'border-[#4f5544] bg-[#4f5544]/5 text-olive font-extrabold shadow-xs' 
                                      : 'border-stone-150 bg-stone-50/50 hover:bg-stone-50 text-stone-500 hover:border-stone-350'
                                  }`}
                                  id="map-style-terrain-btn-new"
                                  title="Topographic Elevation Terrain layer"
                                >
                                  <div className="w-full h-8 rounded-lg bg-amber-50/20 overflow-hidden relative flex items-center justify-center border border-stone-200/50">
                                    <div className="absolute inset-x-0 bottom-0 opacity-15" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #78350f 0px, #78350f 1px, transparent 1px, transparent 3px)' }} />
                                    <Compass className={`w-3.5 h-3.5 ${mapStyle === 'terrain' ? 'text-amber-850 scale-110' : 'text-stone-400 group-hover:scale-110'} transition-transform duration-200`} />
                                  </div>
                                  <span className="text-[9px] font-bold tracking-wide">Terrain</span>
                                </button>
                              </div>
                            </div>

                            {/* Map Content Details Toggle */}
                            <div className="flex flex-col gap-2 mt-1.5 border-t border-stone-100/80 pt-3" id="map-labels-options-group">
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#5c6052]">
                                Typography & Detail Labels
                              </span>
                              
                              <div 
                                className="flex items-center justify-between bg-stone-50/70 hover:bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200/30 transition-all cursor-pointer"
                                onClick={() => setShowMapStyleLabels(!showMapStyleLabels)}
                                id="map-labels-toggle-container-row"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={showMapStyleLabels}
                                    onChange={(e) => setShowMapStyleLabels(e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="accent-olive h-4.5 w-4.5 rounded-md border-stone-300 text-olive focus:ring-olive cursor-pointer bg-white"
                                    id="map-style-labels-checkbox-input"
                                    title="Toggles street names, landmarks, altitude peaks, and basin labels"
                                  />
                                  <label 
                                    htmlFor="map-style-labels-checkbox-input" 
                                    className="text-[10px] font-bold text-stone-700 leading-none cursor-pointer select-none"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Show Map Style Labels
                                  </label>
                                </div>
                                <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider font-mono ${showMapStyleLabels ? 'bg-emerald-500/10 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}>
                                  {showMapStyleLabels ? 'On' : 'Off'}
                                </span>
                              </div>
                            </div>

                            {/* Set Zoom Limits Sub-Menu */}
                            <div className="flex flex-col gap-2 mt-1.5 border-t border-stone-100/80 pt-3" id="map-zoom-limits-settings-group">
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#5c6052]">
                                Zoom Constraints
                              </span>
                              
                              <div 
                                className="flex items-center justify-between bg-stone-50/70 hover:bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200/30 transition-all cursor-pointer"
                                onClick={() => setIsZoomLimitsExpanded(!isZoomLimitsExpanded)}
                                id="map-zoom-limits-header-row"
                              >
                                <div className="flex items-center gap-2">
                                  <Sliders className={`w-3.5 h-3.5 ${isZoomLimitsExpanded ? 'text-olive' : 'text-stone-400'}`} />
                                  <span className="text-[10px] font-bold text-stone-700 leading-none">Set Zoom Limits</span>
                                </div>
                                <span className="text-[9px] font-mono font-black text-stone-500">
                                  {minZoomLimit.toFixed(2)}x - {maxZoomLimit.toFixed(2)}x
                                </span>
                              </div>

                              {isZoomLimitsExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="flex flex-col gap-2.5 pl-0.5 mt-0.5 overflow-hidden"
                                  id="zoom-limits-expanded-menu"
                                >
                                  {/* Min Zoom numerical input with direct +/- increment buttons */}
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-stone-400">Min Zoom Limit</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setMinZoomLimit(prev => Math.max(0.01, Number((prev - 0.1).toFixed(2))))}
                                        className="h-6 w-6 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-all font-bold cursor-pointer"
                                        title="Decrease minimum limit"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min="0.01"
                                        max={Number((maxZoomLimit - 0.05).toFixed(2))}
                                        step="0.01"
                                        value={minZoomLimit}
                                        onChange={(e) => {
                                          const val = Number(Math.max(0.01, parseFloat(e.target.value) || 0.01).toFixed(2));
                                          if (val < maxZoomLimit) {
                                            setMinZoomLimit(val);
                                          }
                                        }}
                                        className="w-full bg-stone-50 hover:bg-stone-100 border border-stone-200 focus:border-olive focus:ring-1 focus:ring-olive rounded-lg px-2 py-0.5 text-center text-[10px] font-mono font-extrabold text-stone-700"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setMinZoomLimit(prev => Math.min(Number((maxZoomLimit - 0.05).toFixed(2)), Number((prev + 0.1).toFixed(2))))}
                                        className="h-6 w-6 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-all font-bold cursor-pointer"
                                        title="Increase minimum limit"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  {/* Max Zoom numerical input with direct +/- increment buttons */}
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-stone-400">Max Zoom Limit</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setMaxZoomLimit(prev => Math.max(Number((minZoomLimit + 0.05).toFixed(2)), Number((prev - 0.1).toFixed(2))))}
                                        className="h-6 w-6 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-all font-bold cursor-pointer"
                                        title="Decrease maximum limit"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min={Number((minZoomLimit + 0.05).toFixed(2))}
                                        max="10.0"
                                        step="0.1"
                                        value={maxZoomLimit}
                                        onChange={(e) => {
                                          const val = Number(Math.max(minZoomLimit + 0.05, parseFloat(e.target.value) || 5.0).toFixed(2));
                                          setMaxZoomLimit(val);
                                        }}
                                        className="w-full bg-stone-50 hover:bg-stone-100 border border-stone-200 focus:border-olive focus:ring-1 focus:ring-olive rounded-lg px-2 py-0.5 text-center text-[10px] font-mono font-extrabold text-stone-700"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setMaxZoomLimit(prev => Number((prev + 0.1).toFixed(2)))}
                                        className="h-6 w-6 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-all font-bold cursor-pointer"
                                        title="Increase maximum limit"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  {/* Quick Zoom constraints presets */}
                                  <div className="flex flex-col gap-1 mt-1">
                                    <span className="text-[7.5px] font-black uppercase tracking-wider text-stone-400">Presets</span>
                                    <div className="grid grid-cols-2 gap-1">
                                      <button
                                        key="preset-default"
                                        type="button"
                                        onClick={() => {
                                          setMinZoomLimit(0.01);
                                          setMaxZoomLimit(5.0);
                                        }}
                                        className="py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[8.5px] font-bold text-stone-600 cursor-pointer text-center"
                                        title="Reset limits to classical defaults (0.01x - 5.0x)"
                                      >
                                        Reset Defaults
                                      </button>
                                      
                                      <button
                                        key="preset-narrow"
                                        type="button"
                                        onClick={() => {
                                          setMinZoomLimit(0.5);
                                          setMaxZoomLimit(2.0);
                                        }}
                                        className="py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[8.5px] font-bold text-stone-600 cursor-pointer text-center"
                                        title="Restrict zoom limits narrow (0.50x - 2.0x)"
                                      >
                                        Narrow Span
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </div>

                            {/* Advanced Grids & Coordinate System Settings */}
                            <div className="flex flex-col gap-2 mt-1.5 border-t border-stone-100/80 pt-3">
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#5c6052]">
                                Grid Coordinates (Lat/Lng)
                              </span>
                              
                              <div 
                                className="flex items-center justify-between bg-stone-50/70 hover:bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200/30 transition-all cursor-pointer"
                                onClick={() => setShowGridOverlay(!showGridOverlay)}
                                id="map-menu-grid-overlay-row"
                              >
                                <div className="flex items-center gap-2">
                                  <Grid className={`w-3.5 h-3.5 ${showGridOverlay ? 'text-emerald-600' : 'text-stone-400'}`} />
                                  <span className="text-[10px] font-bold text-stone-700 leading-none">Enable Lat/Lng Grid</span>
                                </div>
                                <button
                                  type="button"
                                  className={`relative inline-flex h-4 w-7.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${showGridOverlay ? 'bg-olive' : 'bg-stone-300'}`}
                                  role="checkbox"
                                  aria-checked={showGridOverlay}
                                  id="grid-overlay-toggle-switch"
                                  title="Toggle spatial grid alignment"
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-250 ease-in-out ${showGridOverlay ? 'translate-x-[14px]' : 'translate-x-0'}`}
                                  />
                                </button>
                              </div>

                              {showGridOverlay && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="flex flex-col gap-2.5 pl-0.5 mt-0.5 overflow-hidden"
                                  id="grid-overlay-customizer-expanded-menu"
                                >
                                  {/* Grid Spacing Interval Config */}
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-stone-400">Grid Interval (Cell Size)</span>
                                    <div className="grid grid-cols-4 gap-1">
                                      {[5, 10, 20, 25].map((spacing) => (
                                        <button
                                          key={`grid-spacing-${spacing}`}
                                          type="button"
                                          onClick={() => setGridSpacing(spacing)}
                                          className={`py-1 rounded-lg text-[9px] font-bold border transition-all text-center cursor-pointer ${
                                            gridSpacing === spacing
                                              ? 'border-[#4f5544] bg-[#4f5544]/5 text-olive font-black shadow-xs'
                                              : 'border-stone-150 bg-stone-50/50 hover:bg-stone-50 text-stone-500'
                                          }`}
                                          title={`Grid spacing every ${spacing} units`}
                                        >
                                          {spacing}%
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Grid Color Styling Config */}
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-stone-400">Grid Accent Tone</span>
                                    <div className="grid grid-cols-3 gap-1">
                                      {(['emerald', 'amber', 'slate'] as const).map((color) => (
                                        <button
                                          key={`grid-color-${color}`}
                                          type="button"
                                          onClick={() => setGridColor(color)}
                                          className={`py-1 rounded-lg text-[9px] font-bold border capitalize transition-all text-center cursor-pointer ${
                                            gridColor === color
                                              ? color === 'emerald'
                                                 ? 'border-emerald-600 bg-emerald-500/5 text-emerald-700 font-extrabold'
                                                 : color === 'amber'
                                                 ? 'border-amber-600 bg-amber-500/5 text-amber-700 font-extrabold'
                                                 : 'border-slate-500 bg-slate-400/5 text-slate-700 font-extrabold'
                                              : 'border-stone-150 bg-stone-50/50 hover:bg-stone-50 text-stone-500'
                                          }`}
                                          title={`Use ${color} grid overlay accent`}
                                        >
                                          {color}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Grid Label Switch */}
                                  <div 
                                    className="flex items-center justify-between border-t border-dashed border-stone-200/50 pt-2 cursor-pointer mt-1"
                                    onClick={() => setShowGridLabels(!showGridLabels)}
                                  >
                                    <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-stone-550 select-none">Show Coordinate labels</span>
                                    <button
                                      type="button"
                                      className={`relative inline-flex h-3.5 w-6.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${showGridLabels ? 'bg-olive' : 'bg-stone-300'}`}
                                      role="checkbox"
                                      aria-checked={showGridLabels}
                                      id="grid-labels-toggle-switch"
                                      title="Toggle coordinate values display"
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-xs transition duration-250 ease-in-out ${showGridLabels ? 'translate-x-[11px]' : 'translate-x-0'}`}
                                      />
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </div>

                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Expandable/Collapsible Map Overlays Panel */}
                    <div className="flex flex-col items-end gap-2" id="map-overlays-customizer-parent">
                      <button
                        type="button"
                        onClick={() => setIsMapOverlaysOpen(!isMapOverlaysOpen)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-[18px] border shadow-xs duration-200 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                          isMapOverlaysOpen 
                            ? 'bg-emerald-700 border-emerald-700 text-warm-white' 
                            : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-600'
                        }`}
                        id="map-overlays-toggle-expand-btn"
                        title="Toggle map overlay controls"
                      >
                        <Eye className={`w-3.5 h-3.5 ${isMapOverlaysOpen ? 'scale-110': ''} transition-transform duration-250`} />
                        <span>Map Overlays</span>
                        {((showEvents ? 1 : 0) + (showPois ? 1 : 0) + (showHeatmap ? 1 : 0)) > 0 && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black leading-none min-w-[15px] text-center ${
                            isMapOverlaysOpen 
                              ? 'bg-warm-white text-emerald-800' 
                              : 'bg-emerald-600 text-white shadow-xs'
                          }`}>
                            {((showEvents ? 1 : 0) + (showPois ? 1 : 0) + (showHeatmap ? 1 : 0))}
                          </span>
                        )}
                      </button>

                      <AnimatePresence>
                        {isMapOverlaysOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 12 }}
                            transition={{ type: "spring", stiffness: 280, damping: 20 }}
                            className="w-72 bg-white/95 backdrop-blur-md border border-stone-200/50 p-4 rounded-[24px] shadow-xl flex flex-col gap-3.5 text-left"
                            id="map-overlays-floating-card"
                          >
                            <div className="flex flex-col">
                              <h4 className="serif text-[12.5px] font-extrabold text-stone-900 leading-tight">Map Overlays</h4>
                              <p className="text-[10px] text-stone-500 font-medium leading-none mt-1">Manage core layout layers & density complexity</p>
                            </div>

                            <div className="flex flex-col gap-2 pt-1">
                              {/* 1. Events Overlay Toggle */}
                              <div 
                                className="flex items-center justify-between bg-stone-50/70 hover:bg-stone-50 px-3 py-2 rounded-xl border border-stone-200/30 transition-all cursor-pointer"
                                onClick={() => setShowEvents(!showEvents)}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="relative flex h-2 w-2">
                                    {showEvents && (
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                    )}
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${showEvents ? 'bg-orange-500' : 'bg-stone-350'}`}></span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-extrabold text-stone-750 leading-tight">Events / Gatherings</span>
                                    <span className="text-[8px] text-stone-450 font-semibold leading-none">Interactive pin-points</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={`relative inline-flex h-4 w-7.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${showEvents ? 'bg-emerald-600' : 'bg-stone-300'}`}
                                  aria-label="Toggle Events Layer"
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-250 ease-in-out ${showEvents ? 'translate-x-[14px]' : 'translate-x-0'}`}
                                  />
                                </button>
                              </div>

                              {/* 2. POIs Overlay Toggle */}
                              <div 
                                className="flex items-center justify-between bg-stone-50/70 hover:bg-stone-50 px-3 py-2 rounded-xl border border-stone-200/30 transition-all cursor-pointer"
                                onClick={() => setShowPois(!showPois)}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="relative flex h-2 w-2">
                                    {showPois && (
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    )}
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${showPois ? 'bg-indigo-500' : 'bg-stone-350'}`}></span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-extrabold text-[#3a3a3a] leading-tight">Points of Interest</span>
                                    <span className="text-[8px] text-stone-450 font-semibold leading-none">Monuments & landmarks</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={`relative inline-flex h-4 w-7.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${showPois ? 'bg-emerald-600' : 'bg-stone-300'}`}
                                  aria-label="Toggle POIs Layer"
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-250 ease-in-out ${showPois ? 'translate-x-[14px]' : 'translate-x-0'}`}
                                  />
                                </button>
                              </div>

                              {/* 3. Density Heatmap Overlay Toggle */}
                              <div 
                                className="flex items-center justify-between bg-stone-50/70 hover:bg-stone-50 px-3 py-2 rounded-xl border border-stone-200/30 transition-all cursor-pointer"
                                onClick={() => setShowHeatmap(!showHeatmap)}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="relative flex h-2 w-2">
                                    {showHeatmap && (
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    )}
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${showHeatmap ? 'bg-red-500' : 'bg-stone-350'}`}></span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-extrabold text-[#3a3a3a] leading-tight flex items-center gap-1">Density Heatmap</span>
                                    <span className="text-[8px] text-stone-450 font-semibold leading-none">Activity overlaps & hot spots</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={`relative inline-flex h-4 w-7.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${showHeatmap ? 'bg-emerald-600' : 'bg-stone-300'}`}
                                  aria-label="Toggle Density Heatmap Layer"
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-250 ease-in-out ${showHeatmap ? 'translate-x-[14px]' : 'translate-x-0'}`}
                                  />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Dynamic Scale Ruler representing round distances dynamically based on zoom */}
                    <MapScaleRuler 
                      zoom={mapCenter ? mapCenter.zoom : 1.0} 
                      containerWidth={mapWidth} 
                    />
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'architect' && (
            <motion.div
              key="architect"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto space-y-12"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-olive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-8 h-8 text-olive" />
                </div>
                <h1 className="serif text-6xl">Gathering Architect</h1>
                <p className="text-gray-600 max-w-lg mx-auto">
                  Let AI help you design a unique community gathering based on your shared interests.
                </p>
              </div>

              <div className="warm-card p-12 text-center space-y-8 bg-gradient-to-br from-warm-white to-olive/5">
                {!aiIdea ? (
                  <div className="space-y-6">
                    <p className="text-sm uppercase tracking-[0.2em] font-bold text-olive/60">Ready to build something?</p>
                    <button 
                      onClick={handleSuggest}
                      disabled={isGenerating}
                      className="olive-button px-12 py-5 text-lg flex items-center gap-3 mx-auto"
                    >
                      {isGenerating ? 'Designing...' : 'Generate New Idea'}
                      {!isGenerating && <ChevronRight className="w-5 h-5" />}
                    </button>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6 text-left"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="serif text-4xl text-olive">{aiIdea.title}</h3>
                      <button onClick={() => setAiIdea(null)} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xl font-light leading-relaxed">{aiIdea.description}</p>
                    <div className="p-6 bg-white/50 rounded-2xl border border-olive/10">
                      <p className="text-sm font-semibold uppercase tracking-widest text-olive mb-2">Why it brings us together</p>
                      <p className="text-gray-600 italic">"{aiIdea.whyItWorks}"</p>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => {
                          // Prefill host modal or just simulate hosting
                          setIsCreateModalOpen(true);
                        }}
                        className="olive-button"
                      >
                        Host this Gathering
                      </button>
                      <button onClick={handleSuggest} className="px-6 py-3 rounded-full border border-gray-200 text-sm font-medium hover:bg-white transition-colors">
                        Another Idea
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Automation / System Section */}
              <div className="space-y-6">
                <h2 className="serif text-3xl">Automation & Intelligence</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="warm-card p-8 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-olive">Email Reminders</h4>
                    <p className="text-sm text-gray-600">Simulate the system sending 24h reminders to all attendees for upcoming gatherings.</p>
                    <button 
                      onClick={() => {
                        const upcoming = gatherings.filter(g => g.attendeeIds.includes(CURRENT_USER.id));
                        upcoming.forEach(triggerReminder);
                      }}
                      className="text-sm font-semibold text-olive flex items-center gap-2 hover:underline"
                    >
                      Trigger reminders for joined events <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="warm-card p-8 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-olive">1-Hour Pre-Event Reminders</h4>
                    <p className="text-sm text-gray-600">Simulate triggering your set 1-hour email queues and desktop push/in-app HUD notifications.</p>
                    <button 
                      onClick={simulateOneHourReminders}
                      className="text-sm font-semibold text-olive flex items-center gap-2 hover:underline"
                      id="simulate-1h-reminders-btn"
                    >
                      Simulate 1h notifications <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="warm-card p-8 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-olive">Smart Matching</h4>
                    <p className="text-sm text-gray-600">Analyze your profile and suggest gatherings you might have missed.</p>
                    <button className="text-sm font-semibold text-olive flex items-center gap-2 hover:underline">
                      Run discovery scan <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'music' && (
            <motion.div
              key="music"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto space-y-12 pb-16"
              id="theme-music-generator-view"
            >
              {/* Header section with theme elements */}
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-olive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Music className="w-8 h-8 text-olive" />
                </div>
                <h1 className="serif text-5xl md:text-6xl text-stone-900 tracking-tight font-extrabold">Theme Music Generator</h1>
                <p className="text-gray-600 max-w-lg mx-auto">
                  Compose unique background score tracks and custom ambient soundscapes for your community events with Lyria.
                </p>
              </div>

              {/* Grid content split: generator & player */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                
                {/* Compose Form Panel */}
                <div className="md:col-span-7 space-y-6">
                  <div className="warm-card p-8 space-y-6 bg-white/75 relative overflow-hidden">
                    <h3 className="serif text-2xl text-stone-800">Compose a New Track</h3>
                    
                    {/* Prompt input field */}
                    <div className="space-y-2">
                      <label id="music-prompt-label" className="text-xs uppercase tracking-widest font-bold text-stone-500">
                        Soundscape Directive or Theme
                      </label>
                      <textarea
                        value={musicPrompt}
                        aria-labelledby="music-prompt-label"
                        onChange={(e) => setMusicPrompt(e.target.value)}
                        placeholder="Describe the mood, instruments, or genre (e.g. peaceful wooden wind and strings theme...)"
                        className="w-full min-h-[90px] p-4 rounded-2xl bg-stone-50/70 border border-stone-200 focus:border-olive focus:ring-1 focus:ring-olive text-sm font-medium text-stone-800"
                        id="music-generation-prompt-input"
                      />
                    </div>

                    {/* Quick Presets Selection Grid */}
                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-widest font-bold text-stone-500">
                        Aura Presets
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          {
                            title: "Woodland Campfire",
                            prompt: "An uplifting, warm acoustic guitar and flute theme for an evening gathering around the campfire with gentle soft chimes.",
                            icon: "🔥"
                          },
                          {
                            title: "Zen Yoga Swell",
                            prompt: "Slow meditative synth swell, resonant crystal singing bowls, and minor nature rainfalls for deep mindfulness breathwork.",
                            icon: "🧘"
                          },
                          {
                            title: "Farmers Market",
                            prompt: "A cheerful mandolin and acoustic folk instrumental, capturing a rustic, energetic vibe for a lively countryside fair.",
                            icon: "🍎"
                          },
                          {
                            title: "Workshop Focus",
                            prompt: "Futuristic low-fi cybernetic synthwave with soft ambient digital keys, guiding productivity and technical focus.",
                            icon: "⚡"
                          },
                          {
                            title: "Artistic Canvas",
                            prompt: "Lyrical classical piano with elegant cello sweeps, creating an atmosphere of deep creative flow and abstract painting focus.",
                            icon: "🎨"
                          },
                          {
                            title: "Evening Cooking",
                            prompt: "Upbeat organic jazz and light brass beats, building an inviting social ambiance for a shared cooking workshop.",
                            icon: "🍳"
                          }
                        ].map((preset, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => setMusicPrompt(preset.prompt)}
                            className="flex items-center gap-1.5 p-2.5 text-left rounded-xl border border-stone-200/55 hover:border-olive/40 bg-stone-50/40 hover:bg-white text-[11px] font-bold text-stone-600 transition-all cursor-pointer"
                            title={preset.prompt}
                          >
                            <span>{preset.icon}</span>
                            <span className="truncate leading-none">{preset.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dual toggle variables: duration and seed gathering */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Track Duration selector */}
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest font-bold text-stone-500 block">
                          Format Duration
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-stone-100/60 p-1 rounded-xl border border-stone-200/20">
                          <button
                            type="button"
                            onClick={() => setMusicDuration('short')}
                            className={`py-1.5 rounded-lg text-xs font-bold text-center cursor-pointer transition-all ${
                              musicDuration === 'short'
                                ? 'bg-white text-stone-800 shadow-sm'
                                : 'text-stone-500 hover:text-stone-700'
                            }`}
                          >
                            Short Clip (~30s)
                          </button>
                          <button
                            type="button"
                            onClick={() => setMusicDuration('full')}
                            className={`py-1.5 rounded-lg text-xs font-bold text-center cursor-pointer transition-all ${
                              musicDuration === 'full'
                                ? 'bg-white text-stone-800 shadow-sm'
                                : 'text-stone-500 hover:text-stone-700'
                            }`}
                          >
                            Full Track
                          </button>
                        </div>
                      </div>

                      {/* Seed Gathering association */}
                      <div className="space-y-2">
                        <label id="seed-gathering-label" className="text-xs uppercase tracking-widest font-bold text-stone-500 block">
                          Inspire from Cover Image
                        </label>
                        <select
                          value={musicSeedGathering}
                          aria-labelledby="seed-gathering-label"
                          onChange={(e) => setMusicSeedGathering(e.target.value)}
                          className="w-full py-2 px-3 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-700 focus:border-olive focus:ring-1 focus:ring-olive"
                          id="gathering-image-seed-selector"
                        >
                          <option value="">-- No cover art reference --</option>
                          {gatherings.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.title}
                            </option>
                          ))}
                        </select>
                      </div>

                    </div>

                    {/* Selected gathering preview if any */}
                    {musicSeedGathering && (() => {
                      const g = gatherings.find(x => x.id === musicSeedGathering);
                      if (!g) return null;
                      return (
                        <div className="p-3.5 bg-olive/5 rounded-2xl border border-olive/10 flex items-center gap-3.5 animate-fadeIn">
                          <img 
                            src={g.image} 
                            alt="Seed art representation" 
                            className="w-12 h-12 object-cover rounded-xl shadow-xs"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-wider text-olive leading-tight">Visual Anchor Seed</span>
                            <span className="text-xs font-bold text-stone-700 truncate">{g.title}</span>
                            <span className="text-[10px] text-stone-400 font-semibold truncate">{g.location}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Action execution button and state error messages */}
                    <div className="space-y-4 pt-1 border-t border-stone-100">
                      
                      {musicError && (
                        <div className="p-4 bg-red-50/50 border border-red-200/60 rounded-xl text-xs text-red-600 font-bold leading-relaxed">
                          {musicError}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isGeneratingMusic || !musicPrompt.trim()}
                        onClick={async () => {
                          setIsGeneratingMusic(true);
                          setMusicError(null);
                          setMusicGenerationStep('Initializing Lyria...');
                          
                          // Find the seed gathering image URL if any
                          let seedImageUrl = '';
                          let seedTitle = '';
                          if (musicSeedGathering) {
                            const g = gatherings.find(x => x.id === musicSeedGathering);
                            if (g) {
                              seedImageUrl = g.image;
                              seedTitle = g.title;
                            }
                          }

                          try {
                            const t1 = setTimeout(() => setMusicGenerationStep('Analyzing soundscape profile...'), 2000);
                            const t2 = setTimeout(() => setMusicGenerationStep(seedImageUrl ? 'Analyzing Cover Art spectrum...' : 'Translating acoustic cues with AI...'), 5000);
                            const t3 = setTimeout(() => setMusicGenerationStep('Synthesizing waveforms with Google Lyria...'), 9000);

                            const response = await fetch('/api/generate-music', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                prompt: musicPrompt,
                                duration: musicDuration,
                                image: seedImageUrl || undefined
                              })
                            });

                            clearTimeout(t1);
                            clearTimeout(t2);
                            clearTimeout(t3);

                            const data = await response.json();

                            if (!response.ok || !data.success) {
                              throw new Error(data.error || 'Failed to generate theme music.');
                            }

                            setMusicGenerationStep('Assembling audio stream...');

                            // Decode base64 to executable blob
                            const binary = atob(data.audioBase64);
                            const bytes = new Uint8Array(binary.length);
                            for (let i = 0; i < binary.length; i++) {
                              bytes[i] = binary.charCodeAt(i);
                            }
                            const blob = new Blob([bytes], { type: data.mimeType });
                            const audioUrl = URL.createObjectURL(blob);

                            const newTrack = {
                              id: Math.random().toString(36).substring(2, 11),
                              prompt: data.prompt,
                              model: data.model,
                              audioUrl,
                              mimeType: data.mimeType,
                              lyrics: data.lyrics || '',
                              seedGatheringTitle: seedTitle || undefined,
                              createdAt: new Date().toLocaleDateString()
                            };

                            setCurrAudio(newTrack);
                            setIsMusicPlaying(true);
                            
                            // Log history base64 package for offline persistence reloads
                            const historyItem = {
                              id: newTrack.id,
                              prompt: data.prompt,
                              model: data.model,
                              audioBase64: data.audioBase64,
                              mimeType: data.mimeType,
                              lyrics: data.lyrics || '',
                              seedGatheringTitle: seedTitle || undefined,
                              createdAt: newTrack.createdAt
                            };

                            const nextHistory = [historyItem, ...musicHistory];
                            setMusicHistory(nextHistory);
                            localStorage.setItem('gcommunity_music_history', JSON.stringify(nextHistory));

                          } catch (err: any) {
                            console.error(err);
                            setMusicError(err.message || 'An error occurred during music creation. Ensure your GEMINI_API_KEY is configured correctly.');
                          } finally {
                            setIsGeneratingMusic(false);
                            setMusicGenerationStep('');
                          }
                        }}
                        className="w-full olive-button py-4 text-sm flex items-center justify-center gap-2 font-bold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        id="generate-music-btn"
                      >
                        {isGeneratingMusic ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-white" />
                            <span>{musicGenerationStep}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-white" />
                            <span>Compose Ambient Soundscape</span>
                          </>
                        )}
                      </button>

                    </div>
                  </div>
                </div>

                {/* Live Player & Music Details Card */}
                <div className="md:col-span-5 space-y-6">
                  
                  {/* Active Audio Wave and Settings */}
                  <div className="warm-card p-8 space-y-6 bg-gradient-to-br from-stone-900 via-stone-950 to-neutral-950 text-white border-0 shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-start z-10 relative">
                      <div className="flex items-center gap-2 p-1 bg-white/10 rounded-full px-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-neutral-200 leading-none">
                          {currAudio?.model === "lyria-3-pro-preview" ? "Lyria Pro Active" : "Lyria Clip Active"}
                        </span>
                      </div>
                      
                      <span className="text-[9px] font-mono font-semibold text-stone-400">
                        {currAudio ? currAudio.createdAt : "Ready"}
                      </span>
                    </div>

                    {/* Visual Art or Placeholder */}
                    <div className="relative h-44 rounded-2xl overflow-hidden bg-stone-950 flex items-center justify-center shadow-inner border border-stone-850 group/player">
                      {currAudio ? (
                        <div className="absolute inset-0 w-full h-full">
                          {/* Simulated moving dynamic vector layers */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-[#808000]/15 via-emerald-600/5 to-transparent mix-blend-color-dodge z-10" />
                          <div className="absolute inset-0 bg-[#060606]/40 z-10" />
                          
                          {/* Animated background wave nodes */}
                          <div className="absolute bottom-3 inset-x-0 h-28 flex items-end justify-center gap-[4px] px-6 pb-2 z-20">
                            {Array.from({ length: 28 }).map((_, waveIdx) => {
                              const baseH = Math.random() * 80 + 15;
                              return (
                                <motion.div
                                  key={waveIdx}
                                  className="w-[3px] bg-gradient-to-t from-olive via-emerald-400 to-teal-300 rounded-full"
                                  animate={!isMusicPlaying ? {
                                    height: "4px"
                                  } : {
                                    height: [
                                      `${baseH * 0.15}%`,
                                      `${baseH * 1.0}%`,
                                      `${baseH * 0.45}%`,
                                      `${baseH * 0.15}%`
                                    ]
                                  }}
                                  transition={!isMusicPlaying ? {} : {
                                    duration: 0.35 + (waveIdx % 6) * 0.08,
                                    repeat: Infinity,
                                    repeatType: "reverse",
                                    ease: "easeInOut"
                                  }}
                                  style={{ originY: 1 }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-6 space-y-3 z-10 text-stone-400 select-none">
                          <Music className="w-10 h-10 mx-auto text-stone-605" />
                          <p className="text-xs font-bold max-w-[200px] leading-snug">
                            No Soundscape is loaded. Compose a new track to start the experience.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Active Track Name / Meta info */}
                    <div className="space-y-1.5 min-w-0">
                      <h4 className="text-sm font-black tracking-tight text-white line-clamp-2 leading-snug" title={currAudio?.prompt || "Awaiting Composition"}>
                        {currAudio ? currAudio.prompt : "Awaiting Composition Directive"}
                      </h4>
                      {currAudio?.seedGatheringTitle && (
                        <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 inline text-emerald-400" /> Inspired by: {currAudio.seedGatheringTitle}
                        </span>
                      )}
                    </div>

                    {/* Interactive Controls Bar */}
                    <div className="flex items-center justify-between gap-4 pt-1 border-t border-stone-800">
                      <button
                        type="button"
                        disabled={!currAudio}
                        onClick={() => {
                          if (musicAudioRef.current) {
                            if (isMusicPlaying) {
                              musicAudioRef.current.pause();
                              setIsMusicPlaying(false);
                            } else {
                              musicAudioRef.current.play().catch(console.error);
                              setIsMusicPlaying(true);
                            }
                          }
                        }}
                        className="h-12 w-12 flex items-center justify-center rounded-full bg-white hover:bg-stone-100 text-stone-900 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none transform active:scale-95 shadow-md shrink-0"
                        title={isMusicPlaying ? "Pause Soundscape" : "Play Soundscape"}
                        id="play-pause-active-music-btn"
                      >
                        {isMusicPlaying ? (
                          <Pause className="w-5 h-5 text-stone-900" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5 text-stone-900" />
                        )}
                      </button>

                      {/* Download element */}
                      {currAudio && (
                        <a
                          href={currAudio.audioUrl}
                          download={`Soundscape_${currAudio.id}.wav`}
                          className="px-4 py-2 text-xs font-bold text-stone-300 hover:text-white hover:bg-white/10 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-stone-850 select-none animate-fadeIn"
                          title="Save generated WAV track to disk"
                          id="download-generated-music-link"
                        >
                          <Download className="w-3.5 h-3.5 text-stone-300" />
                          <span>Download WAV</span>
                        </a>
                      )}
                    </div>

                    {/* Sub audio helper elements */}
                    {currAudio && (
                      <audio
                        ref={musicAudioRef}
                        src={currAudio.audioUrl}
                        onPlay={() => setIsMusicPlaying(true)}
                        onPause={() => setIsMusicPlaying(false)}
                        onEnded={() => setIsMusicPlaying(false)}
                        autoPlay
                        id="audio-source-player-node"
                      />
                    )}

                  </div>

                  {/* Generated Lyrics Card */}
                  {currAudio?.lyrics && (
                    <div className="warm-card p-6 space-y-3.5 bg-white/80 border border-[#f0eee5] animate-fadeIn">
                      <h4 className="text-xs uppercase tracking-widest font-bold text-stone-500">
                        Generated Chorus / Metas
                      </h4>
                      <div className="text-stone-700 text-xs italic font-semibold leading-relaxed whitespace-pre-wrap max-h-[160px] overflow-y-auto pr-2" id="lyrics-render-box">
                        {currAudio.lyrics}
                      </div>
                    </div>
                  )}

                  {/* History of generated files */}
                  {musicHistory.length > 0 && (
                    <div className="space-y-3.5 p-0.5">
                      <span className="text-xs uppercase tracking-widest font-bold text-stone-500 flex items-center gap-1.5 select-none">
                        <History className="w-4 h-4 text-stone-400" /> History & Vault (saved locally)
                      </span>
                      
                      <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1 select-none">
                        {musicHistory.map((item, histIdx) => {
                          const isActiveTrack = currAudio?.id === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                try {
                                  const binary = atob(item.audioBase64);
                                  const bytes = new Uint8Array(binary.length);
                                  for (let i = 0; i < binary.length; i++) {
                                    bytes[i] = binary.charCodeAt(i);
                                  }
                                  const blob = new Blob([bytes], { type: item.mimeType });
                                  const audioUrl = URL.createObjectURL(blob);

                                  setCurrAudio({
                                    id: item.id,
                                    prompt: item.prompt,
                                    model: item.model,
                                    audioUrl,
                                    mimeType: item.mimeType,
                                    lyrics: item.lyrics,
                                    seedGatheringTitle: item.seedGatheringTitle,
                                    createdAt: item.createdAt
                                  });
                                  setIsMusicPlaying(true);
                                } catch (err) {
                                  console.error(err);
                                  setMusicError('Failed to load this history track.');
                                }
                              }}
                              className={`w-full p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left ${
                                isActiveTrack 
                                  ? 'bg-[#808000]/10 border-olive/30 shadow-xs' 
                                  : 'bg-white hover:bg-stone-50 border-stone-200/50'
                              }`}
                              title="Click to load and play this soundscape"
                              id={`history-music-item-${item.id}`}
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <p className="text-xs font-bold text-stone-700 truncate leading-snug">
                                  {item.prompt}
                                </p>
                                <div className="flex items-center gap-1.5 text-[9px] text-stone-400 font-bold uppercase tracking-wider">
                                  <span>{item.createdAt}</span>
                                  <span>•</span>
                                  <span>{item.model === "lyria-3-pro-preview" ? "Full" : "Clip"}</span>
                                  {item.seedGatheringTitle && (
                                    <>
                                      <span>•</span>
                                      <span className="text-olive">{item.seedGatheringTitle}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="shrink-0">
                                {isActiveTrack && isMusicPlaying ? (
                                  <div className="w-5 h-5 flex items-center justify-center rounded-full bg-olive text-white shadow-xs">
                                    <Pause className="w-2.5 h-2.5 text-white" />
                                  </div>
                                ) : (
                                  <div className={`w-5 h-5 flex items-center justify-center rounded-full ${isActiveTrack ? 'bg-olive text-white shadow-xs' : 'bg-stone-100 hover:bg-stone-200 text-stone-600'} transition-all`}>
                                    <Play className="w-2.5 h-2.5 ml-0.5" />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Icebreaker Flyout */}
      <AnimatePresence>
        {activeGathering && icebreakers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed right-8 top-32 w-80 bg-white shadow-2xl rounded-[32px] p-8 z-50 border border-gray-100"
          >
            <div className="flex justify-between items-center mb-6">
              <h4 className="serif text-xl">Icebreakers</h4>
              <button onClick={() => setActiveGathering(null)}><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4 uppercase tracking-widest">Questions for {activeGathering.title}</p>
            <div className="space-y-4">
              {icebreakers.map((q, i) => (
                <div key={i} className="p-4 bg-warm-bg rounded-2xl text-sm italic text-gray-700 leading-relaxed ring-1 ring-black/[0.03]">
                  {q}
                </div>
              ))}
            </div>
            <button 
              onClick={() => showIcebreakers(activeGathering)}
              className="mt-6 w-full text-xs font-semibold text-olive flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3 h-3" /> Refresh Questions
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {activeProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setActiveProfile(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-warm-bg w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-10 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="flex gap-6 items-center">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg">
                      <img src={activeProfile.avatar} alt={activeProfile.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h2 className="serif text-4xl">{activeProfile.name}</h2>
                      <p className="text-sm text-gray-500 font-medium">Joined {new Date(activeProfile.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveProfile(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-olive/60">Bio</h3>
                  <p className="text-lg font-light text-gray-700 leading-relaxed">{activeProfile.bio}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeProfile.interests.map(interest => (
                    <span key={interest} className="px-4 py-1.5 bg-olive/5 text-olive rounded-full text-xs font-semibold tracking-wide">
                      {interest}
                    </span>
                  ))}
                </div>

                {/* Firebase Authentication Sync Status (Only for their own profile) */}
                {activeProfile.id === CURRENT_USER.id && (
                  <div className="bg-gradient-to-r from-[#ea4335]/10 via-[#4285f4]/10 to-[#34a853]/10 p-6 rounded-[30px] border border-stone-200/60 flex flex-col md:flex-row items-center justify-between gap-4 font-sans">
                    <div className="space-y-1 text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        <span className="text-lg">🔐</span>
                        <h4 className="text-sm font-bold text-stone-850">
                          {firebaseUser ? "Securely Synced with Google" : "Guest Mode — Sync Account"}
                        </h4>
                      </div>
                      <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
                        {firebaseUser 
                          ? `Identified as ${firebaseUser.email}. Your events, RSVPs and comments are safely persisted to Firestore.`
                          : "Join the community with Google Auth to persist your gatherings, RSVPs, and comments across devices."}
                      </p>
                    </div>
                    {firebaseUser ? (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await logOut();
                            setActiveProfile(null);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="px-5 py-2 text-xs font-black text-stone-700 bg-stone-100 hover:bg-stone-200/80 border border-stone-200 rounded-2xl active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 shadow-xs"
                      >
                        Sign Out
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const profile = await signInWithGoogle();
                            setActiveProfile(profile as any);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="px-5 py-2.5 text-xs font-black text-white bg-olive hover:bg-olive/90 rounded-2xl shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 border border-olive/25"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.111 4.114a5.86 5.86 0 0 1-5.861-5.86 5.86 5.86 0 0 1 5.861-5.86c1.196 0 2.29.414 3.161 1.096l3.195-3.194A10.015 10.015 0 0 0 12.24 2C6.59 2 2 6.59 2 12.24s4.59 10.24 10.24 10.24c5.795 0 9.252-4.053 9.252-9.454 0-.61-.061-1.18-.178-1.741H12.24z" />
                        </svg>
                        Sign In with Google
                      </button>
                    )}
                  </div>
                )}

                {/* Scan Streak Settings & Reset Info */}
                {activeProfile.id === CURRENT_USER.id && (
                  <div className="bg-stone-50 border border-stone-200/60 rounded-3xl p-6 space-y-5 font-sans" id="scan-streak-settings-panel">
                    {/* Highest Achieved Tier Badge Display */}
                    <div className="flex items-center justify-between p-3.5 bg-gradient-to-br from-amber-50 to-amber-100/40 rounded-2xl border border-amber-200/50 shadow-2xs relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${getMilestoneTier(profileMaxStreak).badgeClass}`}>
                          {getMilestoneTier(profileMaxStreak).emoji}
                        </div>
                        <div>
                          <div className="text-[8px] uppercase tracking-widest font-extrabold text-amber-850/80 mb-0.5">Highest Achieved Milestone</div>
                          <div className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1">
                            {getMilestoneTier(profileMaxStreak).tier} Badge
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-amber-800 bg-amber-200/55 px-2.5 py-1 rounded-full font-extrabold">
                        Record: {profileMaxStreak} {profileMaxStreak === 1 ? 'scan' : 'scans'}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-2xl shadow-xs relative">
                          🔥
                          {profileScanStreak > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-duration-1000"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                            </span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">Community Scan Streak</h4>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-[#e25822] font-mono" id="profile-streak-count-val">
                              {profileScanStreak}
                            </span>
                            <span className="text-xs text-stone-600 font-medium font-sans">
                              {profileScanStreak === 1 ? 'gathering' : 'gatherings'} joined via QR
                            </span>
                          </div>
                        </div>
                      </div>

                      {!isResetStreakConfirmOpen ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsResetStreakConfirmOpen(true);
                          }}
                          disabled={profileScanStreak === 0}
                          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all duration-200 border flex items-center gap-1.5 ${
                            profileScanStreak === 0
                              ? 'text-stone-300 bg-stone-100 border-stone-200 cursor-not-allowed'
                              : 'text-red-700 bg-red-50 hover:bg-red-100/70 border-red-100 active:scale-95 cursor-pointer hover:shadow-xs'
                          }`}
                          id="reset-scan-streak-btn"
                          title="Reset your current scan streak back to 0"
                        >
                          Reset Streak
                        </button>
                      ) : (
                        <motion.div 
                          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-red-50/50 p-3 rounded-2xl border border-red-100/80 w-full sm:w-auto"
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.15 }}
                          id="reset-streak-confirmation-box"
                        >
                          <span className="text-xs font-semibold text-stone-700 text-left leading-tight sm:max-w-[140px]">
                            Are you sure? This starts your current streak back at 0.
                          </span>
                          <div className="flex gap-2 justify-end self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                localStorage.setItem('gcommunity_scan_streak', '0');
                                window.dispatchEvent(new Event('gcommunity_total_scans_updated'));
                                setIsResetStreakConfirmOpen(false);
                              }}
                              className="px-3 py-1.5 text-xs font-black text-white bg-red-600 hover:bg-red-700 hover:scale-102 active:scale-95 rounded-xl transition-all cursor-pointer shadow-xs shadow-red-200"
                              id="confirm-reset-streak-btn"
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsResetStreakConfirmOpen(false)}
                              className="px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-200 bg-white rounded-xl active:scale-95 transition-all cursor-pointer border border-stone-200"
                              id="cancel-reset-streak-btn"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Scan Sound & Vibration Settings Toggle & Sound Level Slider */}
                    <div className="p-4 bg-stone-100/50 rounded-2xl border border-stone-250/20 shadow-3xs space-y-4 font-sans" id="feedback-effects-settings-box">
                      <div className="flex items-center justify-between font-sans">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🔊</span>
                          <div>
                            <h4 className="text-xs font-bold text-stone-850">Scan Chime & Vibration</h4>
                            <p className="text-[10px] text-stone-400">Play success sound and haptic pulse on joins</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !isScanFeedbackEnabled;
                            localStorage.setItem('gcommunity_scan_feedback_enabled', String(nextVal));
                            setIsScanFeedbackEnabled(nextVal);
                            window.dispatchEvent(new Event('gcommunity_feedback_settings_updated'));
                            if (nextVal) {
                              if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                                navigator.vibrate(40);
                              }
                            }
                          }}
                          className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-300 cursor-pointer ${
                            isScanFeedbackEnabled ? 'bg-olive' : 'bg-stone-300'
                          }`}
                          aria-label="Toggle scan feedback sound and vibration effects"
                          id="toggle-feedback-settings-btn"
                        >
                          <div
                            className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${
                              isScanFeedbackEnabled ? 'translate-x-[24px]' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Precise Volume Level Slider */}
                      {isScanFeedbackEnabled && (
                        <div className="pt-3 border-t border-stone-200/60 flex items-center justify-between gap-4 animate-fadeIn">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Chime Level</span>
                          </div>
                          <div className="flex items-center gap-3 flex-1 justify-end max-w-xs">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={isScanChimeEnabled ? scanVolume : 0}
                              disabled={!isScanChimeEnabled}
                              onChange={(e) => {
                                const newVol = parseFloat(e.target.value);
                                localStorage.setItem('gcommunity_scan_volume', String(newVol));
                                setScanVolume(newVol);
                                window.dispatchEvent(new Event('gcommunity_volume_updated'));
                                if (newVol > 0 && !isScanChimeEnabled) {
                                  localStorage.setItem('gcommunity_scan_chime_enabled', 'true');
                                  setIsScanChimeEnabled(true);
                                  window.dispatchEvent(new Event('gcommunity_chime_settings_updated'));
                                }
                              }}
                              className={`w-full h-1 rounded-lg appearance-none cursor-pointer focus:outline-none accent-olive ${
                                isScanChimeEnabled ? 'bg-stone-300' : 'bg-stone-200 opacity-40 cursor-not-allowed'
                              }`}
                              title={`Scan Success Chime Volume: ${Math.round((isScanChimeEnabled ? scanVolume : 0) * 100)}%`}
                              id="profile-panel-volume-slider"
                              aria-label="Scan success chime volume level"
                            />
                            <span className={`text-xs font-mono font-bold w-10 text-right select-none ${isScanChimeEnabled ? 'text-stone-700' : 'text-stone-400'}`}>
                              {Math.round((isScanChimeEnabled ? scanVolume : 0) * 100)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Progress to next milestone */}
                    <div className="space-y-2 pt-1 border-t border-stone-200/40">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-stone-500 font-medium font-sans">Progress to next Milestone</span>
                        <span className="font-extrabold text-[#e25822] font-mono">
                          {profileScanStreak % 5 === 0 && profileScanStreak > 0 
                            ? 'Milestone Achieved! 🎉' 
                            : `${profileScanStreak % 5} / 5 scans`}
                        </span>
                      </div>
                      
                      {/* Modern fluid Progress Bar */}
                      <div className="w-full h-2.5 bg-stone-200/75 rounded-full overflow-hidden relative border border-stone-200/30 shadow-inner">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${((profileScanStreak % 5) / 5) * 100 || (profileScanStreak > 0 && profileScanStreak % 5 === 0 ? 100 : 0)}%` }}
                          transition={{ type: 'spring', stiffness: 80, damping: 15 }}
                        />
                      </div>
                      
                      <p className="text-[11px] text-stone-400 font-sans leading-relaxed">
                        Join 5 gatherings via QR codes to achieve a milestone. Resetting will drop your current streak straight back to 0.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-6 pt-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <h3 className="serif text-2xl">Activity</h3>
                    {activeProfile.id === CURRENT_USER.id && (
                      <div className="flex gap-4">
                        <button className="text-[10px] font-bold uppercase tracking-widest text-olive border-b-2 border-olive pb-1">Events</button>
                        <button className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-olive pb-1">Inbox ({notifications.length})</button>
                      </div>
                    )}
                  </div>

                  {activeProfile.id === CURRENT_USER.id ? (
                    <div className="space-y-8">
                       <div className="grid gap-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Inbox (Email Logs)</h4>
                        {notifications.length > 0 ? (
                          notifications.map(n => (
                            <div key={n.id} className="p-4 bg-white rounded-2xl border border-olive/10 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-olive">{n.subject}</span>
                                <span className="text-[10px] text-gray-400">{new Date(n.sentAt).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-xs text-gray-600 whitespace-pre-wrap">{n.body}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400 italic">No email logs yet.</p>
                        )}
                      </div>
                      
                      <div className="grid gap-4">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Hosting</h4>
                          <span className="bg-olive/10 text-olive text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {gatherings.filter(g => g.hostId === activeProfile.id).length}
                          </span>
                        </div>
                        {gatherings.filter(g => g.hostId === activeProfile.id).length > 0 ? (
                          gatherings.filter(g => g.hostId === activeProfile.id).map(g => (
                            <div key={g.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-50 font-sans">
                              <img src={g.image} className="w-16 h-16 rounded-xl object-cover" />
                              <div>
                                <p className="font-medium">{g.title}</p>
                                <p className="text-xs text-gray-500">{new Date(g.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400 italic font-sans">No hosted gatherings yet.</p>
                        )}
                      </div>

                      <div className="grid gap-4">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Attending</h4>
                          <span className="bg-olive/10 text-olive text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {gatherings.filter(g => g.attendeeIds.includes(activeProfile.id)).length}
                          </span>
                        </div>
                        {gatherings.filter(g => g.attendeeIds.includes(activeProfile.id)).length > 0 ? (
                          gatherings.filter(g => g.attendeeIds.includes(activeProfile.id)).map(g => (
                            <div key={g.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-50 font-sans">
                              <img src={g.image} className="w-16 h-16 rounded-xl object-cover" />
                              <div>
                                <p className="font-medium">{g.title}</p>
                                <p className="text-xs text-gray-500">{new Date(g.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400 italic font-sans">Hasn't joined any gatherings yet.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-6">
                      {/* Original activity view for others */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Hosting</h4>
                          <span className="bg-olive/10 text-olive text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {gatherings.filter(g => g.hostId === activeProfile.id).length}
                          </span>
                        </div>
                        {gatherings.filter(g => g.hostId === activeProfile.id).length > 0 ? (
                          gatherings.filter(g => g.hostId === activeProfile.id).map(g => (
                            <div key={g.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-50 font-sans">
                              <img src={g.image} className="w-16 h-16 rounded-xl object-cover" />
                              <div>
                                <p className="font-medium">{g.title}</p>
                                <p className="text-xs text-gray-500">{new Date(g.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400 italic font-sans">No hosted gatherings yet.</p>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Attending</h4>
                          <span className="bg-olive/10 text-olive text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {gatherings.filter(g => g.attendeeIds.includes(activeProfile.id)).length}
                          </span>
                        </div>
                        {gatherings.filter(g => g.attendeeIds.includes(activeProfile.id)).length > 0 ? (
                          gatherings.filter(g => g.attendeeIds.includes(activeProfile.id)).map(g => (
                            <div key={g.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-50 font-sans">
                              <img src={g.image} className="w-16 h-16 rounded-xl object-cover" />
                              <div>
                                <p className="font-medium">{g.title}</p>
                                <p className="text-xs text-gray-500">{new Date(g.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400 italic font-sans">Hasn't joined any gatherings yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-warm-bg w-full max-w-xl rounded-[40px] p-10 overflow-hidden shadow-2xl"
            >
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newG: Gathering = {
                  id: Math.random().toString(36).substr(2, 9),
                  title: formData.get('title') as string,
                  description: formData.get('description') as string,
                  category: formData.get('category') as Category,
                  date: formData.get('date') as string,
                  time: formData.get('time') as string,
                  location: formData.get('location') as string,
                  hostId: CURRENT_USER.id,
                  hostName: CURRENT_USER.name,
                  hostAvatar: CURRENT_USER.avatar,
                  lat: createPrefilledLat !== null ? createPrefilledLat : Math.random() * 80 + 10,
                  lng: createPrefilledLng !== null ? createPrefilledLng : Math.random() * 80 + 10,
                  attendeeIds: [],
                  maybeIds: [],
                  capacity: parseInt(formData.get('capacity') as string),
                  image: uploadPreview || `https://images.unsplash.com/photo-${Math.floor(Math.random() * 10000)}?w=800&auto=format&fit=crop`,
                  tags: selectedTags.length > 0 ? selectedTags : [formData.get('category') as Category]
                };
                saveGathering(newG);
                closeModal();
              }} className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="serif text-3xl">Host a Gathering</h2>
                  <button type="button" onClick={closeModal}><X className="w-5 h-5" /></button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Title</label>
                    <input name="title" required className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-3 focus:outline-none focus:ring-1 focus:ring-olive/30" placeholder="e.g. Garden Picnic & Paint" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Category</label>
                    <select name="category" className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-3 focus:outline-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  
                  {/* Dynamic Multi-select Interests & discoverability tags */}
                  <div className="space-y-2 bg-[#f6f5f0]/50 p-4 rounded-[24px] border border-stone-200/40">
                    <label className="text-xs font-bold uppercase tracking-widest text-stone-600 block">
                      Discoverability Interests & Tags (Multi-select)
                    </label>
                    <p className="text-[10px] text-gray-500 leading-normal">
                      Toggle interests/tags below to help community members find this event when filtering or searching by interest areas!
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1" id="interest-multi-select-container">
                      {CATEGORIES.map(cat => {
                        const isSelected = selectedTags.includes(cat);
                        return (
                          <button
                            type="button"
                            key={cat}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTags(prev => prev.filter(t => t !== cat));
                              } else {
                                setSelectedTags(prev => [...prev, cat]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
                              isSelected 
                                ? 'bg-olive text-warm-white shadow-xs scale-[1.03]' 
                                : 'bg-white text-gray-600 border border-stone-200/50 hover:bg-stone-50'
                            }`}
                            id={`multi-select-tag-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                            title={`Toggle tag: ${cat}`}
                          >
                            <span className="scale-[0.8] origin-center shrink-0 [&_svg]:!text-current">
                              {getCategoryIcon(cat)}
                            </span>
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Date</label>
                      <input type="date" name="date" required className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-3 focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Time</label>
                      <input type="time" name="time" required className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-3 focus:outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Location</label>
                    <input name="location" required defaultValue={createPrefilledLocation || ""} className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-3 focus:outline-none focus:ring-1 focus:ring-olive/30" placeholder="e.g. Central Park West" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Capacity</label>
                    <input type="number" name="capacity" min="1" required className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-3 focus:outline-none" placeholder="Maximum number of attendees" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Image</label>
                    <div 
                      className="relative border-2 border-dashed border-gray-100 rounded-[32px] overflow-hidden text-center hover:border-olive/30 transition-colors cursor-pointer group"
                    >
                      {uploadPreview ? (
                        <div className="relative h-40">
                          <img src={uploadPreview} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                document.getElementById('image-upload')?.click();
                              }}
                              className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-medium hover:bg-white/40 transition-colors"
                            >
                              Replace
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadPreview(null);
                              }}
                              className="px-4 py-2 bg-red-500/40 backdrop-blur-md rounded-full text-white text-xs font-medium hover:bg-red-500/60 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="space-y-2 py-8"
                          onClick={() => document.getElementById('image-upload')?.click()}
                        >
                          <div className="w-10 h-10 bg-olive/5 rounded-full flex items-center justify-center mx-auto group-hover:bg-olive transition-colors">
                            <Upload className="w-5 h-5 text-olive group-hover:text-warm-white" />
                          </div>
                          <p className="text-xs text-gray-500">Click to upload a cover photo</p>
                        </div>
                      )}
                      <input 
                        id="image-upload"
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setUploadPreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Description</label>
                    <textarea name="description" required className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-3 focus:outline-none h-24" placeholder="Tell people why they should come..." />
                  </div>
                </div>

                <button type="submit" className="w-full olive-button py-4 text-base">
                  Share Gathering
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Share Map View Modal */}
      <AnimatePresence>
        {isShareMapModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left" id="map-share-modal-container">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsShareMapModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-warm-bg w-full max-w-md rounded-[32px] p-8 overflow-hidden shadow-2xl border border-stone-200 z-10"
              id="map-share-modal-card"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <h3 className="serif text-2xl font-bold text-gray-900">Share Filtered Map</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsShareMapModalOpen(false)}
                  className="p-1.5 hover:bg-stone-100 rounded-full transition-all text-stone-400 hover:text-stone-700 cursor-pointer"
                  id="map-share-modal-close-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Active filters preview list */}
              <div className="bg-white/80 border border-stone-200/60 rounded-2xl p-4 mb-6 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5c6052] pb-2 border-b border-stone-100">
                  Currently Active Map Filters
                </h4>
                
                <div className="grid grid-cols-1 gap-3 text-xs">
                  {/* Category Filter description */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-md bg-stone-100/60 border border-stone-200/50 flex items-center justify-center shrink-0 text-stone-500 mt-0.5">
                      {selectedMapCategory === 'All' ? <Sparkles className="w-3 h-3" /> : selectedMapCategory === 'Nearby' ? <Compass className="w-3 h-3" /> : getCategoryIcon(selectedMapCategory)}
                    </div>
                    <div>
                      <span className="text-[9.5px] uppercase tracking-wide font-bold text-stone-400 block leading-none mb-1">Category</span>
                      <span className="font-semibold text-stone-850">
                        {selectedMapCategory === 'All' ? 'All Gatherings' : selectedMapCategory === 'Nearby' ? 'Nearby Events (15% Radius)' : selectedMapCategory}
                      </span>
                    </div>
                  </div>

                  {/* Date Filter description */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-md bg-stone-100/60 border border-stone-200/50 flex items-center justify-center shrink-0 text-stone-500 mt-0.5">
                      <Calendar className="w-3 h-3" />
                    </div>
                    <div>
                      <span className="text-[9.5px] uppercase tracking-wide font-bold text-stone-400 block leading-none mb-1">Date Period</span>
                      <span className="font-semibold text-stone-850">
                        {startDate || endDate ? (
                          <>
                            {startDate ? `From ${startDate}` : 'Anytime'} {endDate ? `Until ${endDate}` : 'onward'}
                          </>
                        ) : (
                          'No date restrictions'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Capacity Filter description */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-md bg-stone-100/60 border border-stone-200/50 flex items-center justify-center shrink-0 text-stone-500 mt-0.5">
                      <Users className="w-3 h-3" />
                    </div>
                    <div>
                      <span className="text-[9.5px] uppercase tracking-wide font-bold text-stone-400 block leading-none mb-1">Group Size</span>
                      <span className="font-semibold text-stone-850">
                        {minCapacity === 1 && maxCapacity === 100 ? (
                          'Any party capacity'
                        ) : (
                          <>{minCapacity} to {maxCapacity === 100 ? '100+' : maxCapacity} attendees</>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Query matches if set */}
                  {searchQuery && (
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-md bg-stone-100/60 border border-stone-200/50 flex items-center justify-center shrink-0 text-stone-500 mt-0.5">
                        <Search className="w-3 h-3" />
                      </div>
                      <div>
                        <span className="text-[9.5px] uppercase tracking-wide font-bold text-stone-400 block leading-none mb-1">Search Query</span>
                        <span className="font-mono text-[11.5px] font-bold text-stone-850 bg-stone-100 px-1.5 py-0.5 rounded">
                          "{searchQuery}"
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Generated URL & Copy Actions block */}
              <div className="space-y-1.5 mb-6">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#5c6052] block" htmlFor="map-share-link">
                  Shareable Filter Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    id="map-share-link"
                    readOnly
                    value={(() => {
                      const baseUrl = window.location.origin + window.location.pathname;
                      const urlParams = new URLSearchParams();
                      urlParams.set('view', 'map');
                      if (selectedMapCategory !== 'All') {
                        urlParams.set('mapCategory', selectedMapCategory);
                      }
                      if (searchQuery) {
                        urlParams.set('mapSearch', searchQuery);
                      }
                      if (startDate) {
                        urlParams.set('mapStart', startDate);
                      }
                      if (endDate) {
                        urlParams.set('mapEnd', endDate);
                      }
                      if (minCapacity > 1) {
                        urlParams.set('mapMinCapacity', String(minCapacity));
                      }
                      if (maxCapacity < 100) {
                        urlParams.set('mapMaxCapacity', String(maxCapacity));
                      }
                      const queryStr = urlParams.toString();
                      return queryStr ? `${baseUrl}?${queryStr}` : baseUrl;
                    })()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 bg-stone-100 hover:bg-stone-200 focus:bg-white text-[11px] font-medium border border-stone-200 rounded-xl px-3.5 py-2.5 focus:outline-none transition-colors select-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const baseUrl = window.location.origin + window.location.pathname;
                      const urlParams = new URLSearchParams();
                      urlParams.set('view', 'map');
                      if (selectedMapCategory !== 'All') {
                        urlParams.set('mapCategory', selectedMapCategory);
                      }
                      if (searchQuery) {
                        urlParams.set('mapSearch', searchQuery);
                      }
                      if (startDate) {
                        urlParams.set('mapStart', startDate);
                      }
                      if (endDate) {
                        urlParams.set('mapEnd', endDate);
                      }
                      if (minCapacity > 1) {
                        urlParams.set('mapMinCapacity', String(minCapacity));
                      }
                      if (maxCapacity < 100) {
                        urlParams.set('mapMaxCapacity', String(maxCapacity));
                      }
                      const queryStr = urlParams.toString();
                      const fullUrl = queryStr ? `${baseUrl}?${queryStr}` : baseUrl;
                      navigator.clipboard.writeText(fullUrl).then(() => {
                        setCopiedShareMapLink(true);
                        setTimeout(() => setCopiedShareMapLink(false), 2000);
                      });
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase shrink-0 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                      copiedShareMapLink 
                        ? 'bg-emerald-600 text-white shadow-md' 
                        : 'bg-olive text-warm-white hover:opacity-90 shadow-xs'
                    }`}
                    id="map-share-copy-btn"
                  >
                    {copiedShareMapLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-stone-500 font-medium">
                  Sharing this link lets others load the map pre-filtered with your current parameters instantly.
                </p>
              </div>

              {/* Decorative instructions/recommendations */}
              <div className="bg-emerald-50/45 border border-emerald-100/60 rounded-xl p-3.5 flex items-start gap-2.5 text-[11px] text-emerald-950 leading-relaxed">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                <p>
                  <strong>Live connection:</strong> Map filters are loaded dynamically. If new events are created matching your settings, they'll pop up on their screen in real time.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto px-8 py-12 border-t border-gray-100 mt-24">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-olive rounded-full flex items-center justify-center">
              <Users className="text-warm-white w-3 h-3" />
            </div>
            <span className="serif text-xl font-semibold">Gather</span>
          </div>
          <div className="flex gap-8 text-xs font-semibold uppercase tracking-widest text-gray-400">
            <a href="#" className="hover:text-olive">Privacy</a>
            <a href="#" className="hover:text-olive">Terms</a>
            <a href="#" className="hover:text-olive">Guidelines</a>
            <a href="#" className="hover:text-olive">Contact</a>
          </div>
          <p className="text-xs text-gray-400">© 2026 Gather Community. Designed to bring us together.</p>
        </div>
      </footer>
    </div>
  );
}

const SEED_COMMENTS: Comment[] = [
  {
    id: 'comment-s1',
    gatheringId: '1',
    userId: 'user-1',
    userName: 'Elena V.',
    userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&auto=format&fit=crop',
    text: "Can't wait to see everyone! Bring your favorite blanket and a book of verses you love. 🌸",
    timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  },
  {
    id: 'comment-s2',
    gatheringId: '1',
    userId: 'user-2',
    userName: 'Marcus Rose',
    userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop',
    text: "I'll highlight some poems from Mary Oliver. Her writing perfectly fits the Willow Creek Meadow vibe!",
    timestamp: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString()
  },
  {
    id: 'comment-s3',
    gatheringId: '2',
    userId: 'user-2',
    userName: 'Marcus Rose',
    userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop',
    text: "Please try to arrive 10 minutes early so we can start exactly at 06:30. See you as the sun rises! 🧘",
    timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'comment-s4',
    gatheringId: '3',
    userId: 'user-3',
    userName: 'Baker Sam',
    userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop',
    text: "Make sure to bring a glass container if you want to take some starter culture home with you! 🌾",
    timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  }
];

function getCommentsForGathering(gatheringId: string): Comment[] {
  const stored = localStorage.getItem('gcommunity_comments');
  let comments: Comment[] = [];
  if (stored) {
    try {
      comments = JSON.parse(stored);
    } catch (e) {
      comments = [];
    }
  } else {
    comments = SEED_COMMENTS;
    localStorage.setItem('gcommunity_comments', JSON.stringify(comments));
  }
  return comments.filter(c => c.gatheringId === gatheringId);
}

function saveCommentForGathering(comment: Comment) {
  const stored = localStorage.getItem('gcommunity_comments');
  let comments: Comment[] = [];
  if (stored) {
    try {
      comments = JSON.parse(stored);
    } catch (e) {}
  } else {
    comments = [...SEED_COMMENTS];
  }
  comments.push(comment);
  localStorage.setItem('gcommunity_comments', JSON.stringify(comments));
  
  // Save to Firestore asynchronously
  setDoc(doc(db, "gatherings", comment.gatheringId, "comments", comment.id), comment).catch(console.error);

  window.dispatchEvent(new CustomEvent('gcommunity_comments_changed', { detail: { gatheringId: comment.gatheringId } }));
}

function deleteCommentForGathering(commentId: string, gatheringId: string) {
  const stored = localStorage.getItem('gcommunity_comments');
  let comments: Comment[] = [];
  if (stored) {
    try {
      comments = JSON.parse(stored);
    } catch (e) {}
  } else {
    comments = [...SEED_COMMENTS];
  }
  comments = comments.filter(c => c.id !== commentId);
  localStorage.setItem('gcommunity_comments', JSON.stringify(comments));

  // Delete from Firestore asynchronously
  deleteDoc(doc(db, "gatherings", gatheringId, "comments", commentId)).catch(console.error);

  window.dispatchEvent(new CustomEvent('gcommunity_comments_changed', { detail: { gatheringId } }));
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return "just now";
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) {
      return "just now";
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return "yesterday";
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  } catch (e) {
    return "";
  }
}

function playQrPingSound() {
  const isMasterEnabled = localStorage.getItem('gcommunity_scan_feedback_enabled') !== 'false';
  const isChimeEnabled = localStorage.getItem('gcommunity_scan_chime_enabled') !== 'false';
  
  if (!isMasterEnabled) return;

  try {
    // 1. Snappy custom haptic feedback pattern for ultimate tactile confirmation
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      // Double-pulse haptic pattern: vibrate 70ms, pause 40ms, vibrate 70ms
      navigator.vibrate([70, 40, 70]);
    }
  } catch (vibeErr) {
    console.warn("Haptic haptic vibration failed or unsupported:", vibeErr);
  }

  if (!isChimeEnabled) return;

  try {
    // 2. High-fidelity Synthesized Polyphonic Chime Sound Effect (Warm major-fifth chime)
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // Core tone oscillator (high-frequency crystal chime)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now); // A5 tone
    osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.12); // smooth transition to E6
    
    // Warm harmonic layer oscillator for richer acoustics
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine"; 
    osc2.frequency.setValueAtTime(1109.73, now); // C#6 (Major third layer)
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.15); // Ramp up to A6 peak octave
    
    const savedVolume = localStorage.getItem('gcommunity_scan_volume');
    const volumeMultiplier = savedVolume !== null ? parseFloat(savedVolume) : 0.8;

    // Configure core chime envelope (snappy rise, slow organic decay)
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.18 * volumeMultiplier, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    
    // Configure supporting harmonic envelope (ambient secondary resonance)
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(0.07 * volumeMultiplier, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    
    // Connect audio node graph
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    // Start play synthesis
    osc1.start(now);
    osc2.start(now);
    
    // Safely stop oscillator units
    osc1.stop(now + 0.32);
    osc2.stop(now + 0.28);
  } catch (err) {
    console.warn("Failed to play synthesized QR confirmation chime:", err);
  }
}

function triggerHighFidelityScanHaptics() {
  const isMasterEnabled = localStorage.getItem('gcommunity_scan_feedback_enabled') !== 'false';
  if (!isMasterEnabled) return;
  
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      // Elegant, soothing triple-pulse tactile confirmation:
      // T1 (12ms whisper) -> delay (40ms) -> T2 (20ms light tick) -> delay (50ms) -> T3 (65ms warm organic heartbeat pulse)
      navigator.vibrate([12, 40, 20, 50, 65]);
    }
  } catch (e) {
    console.warn("Haptic organic vibration failed or unsupported:", e);
  }
}

function playHighFidelityOrganicChime(customVolume = 1.0) {
  const isMasterEnabled = localStorage.getItem('gcommunity_scan_feedback_enabled') !== 'false';
  const isChimeEnabled = localStorage.getItem('gcommunity_scan_chime_enabled') !== 'false';
  
  if (!isMasterEnabled || !isChimeEnabled) return;

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // An organic, resonant chime is created by tuning multiple sine wave oscillators
    // to harmonic and inharmonic partials, with a long, slow organic decay.
    // Base frequency (f) = 523.25 Hz (C5) for a warm, comforting base note
    const baseFreq = 523.25;
    
    const savedVolume = localStorage.getItem('gcommunity_scan_volume');
    const volumeMultiplier = (savedVolume !== null ? parseFloat(savedVolume) : 0.8) * customVolume;
    
    // Inharmonic frequencies for organic bell-like resonance:
    // f1 (Fundamental) = multiplier 1.0 (523.25 Hz)
    // f2 (Hum) = multiplier 0.5 (261.63 Hz, warm low sub)
    // f3 (Tierce/Minor Third) = multiplier 1.19 (622.67 Hz)
    // f4 (Quint/Fifth) = multiplier 1.5 (784.88 Hz)
    // f5 (Nominal) = multiplier 2.0 (1046.50 Hz)
    // f6 (Supernominal) = multiplier 2.51 (1313.36 Hz, glassy sparkle)
    
    const partials = [
      { freq: baseFreq, gain: 0.28, attack: 0.005, decay: 1.4 },       // Fundamental (warm core)
      { freq: baseFreq * 0.5, gain: 0.18, attack: 0.03, decay: 1.8 },   // Hum (resonance/depth)
      { freq: baseFreq * 1.19, gain: 0.10, attack: 0.008, decay: 0.9 },  // Minor third (pensive overtone)
      { freq: baseFreq * 1.5, gain: 0.20, attack: 0.006, decay: 1.2 },   // Fifth (consonant)
      { freq: baseFreq * 2.0, gain: 0.16, attack: 0.003, decay: 0.7 },   // Nominal octave (bright)
      { freq: baseFreq * 2.51, gain: 0.09, attack: 0.002, decay: 0.5 }   // Supernominal (shimmering glass)
    ];

    partials.forEach((part) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(part.freq, now);
      
      // Pitch envelope: subtle organic vibrato/wobble or micro-glide on start
      osc.frequency.exponentialRampToValueAtTime(part.freq * 1.002, now + part.decay);
      
      // Amplitude envelope: snappy rise, organic exponential decay
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(part.gain * volumeMultiplier, now + part.attack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + part.decay);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + part.decay + 0.1);
    });
  } catch (err) {
    console.warn("Failed to play custom organic sensory chime:", err);
  }
}

function playAlertNotificationSound(volume = 0.5) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(783.99, now); // G5
    osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.08); // C6
    
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.06 * volume, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.23);
  } catch (err) {
    console.warn("Notification sound playback failed:", err);
  }
}

function getIcsDateString(dateStr: string, timeStr: string, offsetHours = 0) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, min] = timeStr.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, min);
  if (offsetHours > 0) {
    date.setHours(date.getHours() + offsetHours);
  }
  
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const minVal = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  
  return `${y}${m}${d}T${h}${minVal}${s}`;
}

const escapeIcsText = (str: string) => {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
};

const exportToIcs = (gathering: Gathering) => {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtStart = getIcsDateString(gathering.date, gathering.time);
  const dtEnd = getIcsDateString(gathering.date, gathering.time, 2);

  const summary = escapeIcsText(gathering.title);
  const description = escapeIcsText(`${gathering.description}\n\nHost: ${gathering.hostName}\nGroup Capacity: ${gathering.capacity}`);
  const location = escapeIcsText(gathering.location);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gatherings Community//NONSGML Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${gathering.id}-${dtStart}@gatherings.community`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${gathering.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_gathering.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  shape: 'circle' | 'square' | 'triangle';
  angle: number;
}

function ConfettiStream() {
  const [particles] = useState<ConfettiParticle[]>(() => {
    const list: ConfettiParticle[] = [];
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];
    const shapes: Array<'circle' | 'square' | 'triangle'> = ['circle', 'square', 'triangle'];
    for (let i = 0; i < 100; i++) {
      list.push({
        id: i,
        x: Math.random() * 100, // percentage x inside modal
        y: -15 - Math.random() * 25, // start above the modal
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 6,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        angle: Math.random() * 360
      });
    }
    return list;
  });

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-55 rounded-[32px]">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ 
            left: `${p.x}%`, 
            top: `${p.y}%`, 
            rotate: p.angle,
            scale: 0.5,
            opacity: 1
          }}
          animate={{ 
            top: '110%', 
            left: `${p.x + (Math.random() * 30 - 15)}%`,
            rotate: p.angle + Math.random() * 720 - 360,
            scale: [0.5, 1, 0.7, 0],
            opacity: [1, 1, 0.8, 0]
          }}
          transition={{ 
            duration: Math.random() * 2.5 + 2.5, 
            ease: "easeOut",
            delay: Math.random() * 0.7
          }}
          className="absolute"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.shape !== 'triangle' ? p.color : undefined,
            borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'square' ? '2px' : '0px',
            borderLeft: p.shape === 'triangle' ? `${p.size / 2}px solid transparent` : undefined,
            borderRight: p.shape === 'triangle' ? `${p.size / 2}px solid transparent` : undefined,
            borderBottom: p.shape === 'triangle' ? `${p.size}px solid ${p.color}` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function GatheringCard({ gathering, onIcebreakers, onRSVP, onViewHost, users, reminders = { email: false, push: false }, onToggleReminder, onSelectTag, selectedTag }: { gathering: Gathering; onIcebreakers: () => void | Promise<void>; onRSVP: (status: 'attending' | 'maybe' | 'not_attending') => void; onViewHost: () => void; users: UserProfile[]; reminders: { email: boolean; push: boolean }; onToggleReminder: (type: 'email' | 'push') => void; onSelectTag?: (tag: Category) => void; selectedTag?: Category | 'All'; key?: React.Key }) {
  const isAttending = gathering.attendeeIds.includes(CURRENT_USER.id);
  const isMaybe = gathering.maybeIds.includes(CURRENT_USER.id);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [now, setNow] = useState(new Date());
  const [headerView, setHeaderView] = useState<'photo' | 'map'>('photo');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [lifetimeScans, setLifetimeScans] = useState(() => {
    return parseInt(localStorage.getItem('gcommunity_total_scans') || '0', 10);
  });
  const [scanStreak, setScanStreak] = useState(() => {
    return parseInt(localStorage.getItem('gcommunity_scan_streak') || '0', 10);
  });
  const [maxStreak, setMaxStreak] = useState(() => {
    const current = parseInt(localStorage.getItem('gcommunity_scan_streak') || '0', 10);
    const storedMax = parseInt(localStorage.getItem('gcommunity_max_scan_streak') || '0', 10);
    const maxVal = Math.max(storedMax, current);
    localStorage.setItem('gcommunity_max_scan_streak', String(maxVal));
    return maxVal;
  });
  const [triggerConfettiSection, setTriggerConfettiSection] = useState(false);
  const [qrScanTimestamps, setQrScanTimestamps] = useState<string[]>(() => {
    const key = `qr_scan_timestamps_${gathering.id}`;
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    const nowMs = Date.now();
    return [
      new Date(nowMs - 3600000 * 2).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      new Date(nowMs - 1800000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      new Date(nowMs - 600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    ];
  });
  const lastStreakRef = React.useRef<number>(scanStreak);

  useEffect(() => {
    if (isQrModalOpen) {
      if (scanStreak > lastStreakRef.current && scanStreak % 5 === 0 && scanStreak > 0) {
        setTriggerConfettiSection(true);
        const t = setTimeout(() => {
          setTriggerConfettiSection(false);
        }, 6000);
        return () => clearTimeout(t);
      }
    }
    lastStreakRef.current = scanStreak;
  }, [scanStreak, isQrModalOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      const activeStreak = parseInt(localStorage.getItem('gcommunity_scan_streak') || '0', 10);
      const activeLifetime = parseInt(localStorage.getItem('gcommunity_total_scans') || '0', 10);
      const storedMax = parseInt(localStorage.getItem('gcommunity_max_scan_streak') || '0', 10);
      const newMax = Math.max(storedMax, activeStreak);
      localStorage.setItem('gcommunity_max_scan_streak', String(newMax));
      
      setLifetimeScans(activeLifetime);
      setScanStreak(activeStreak);
      setMaxStreak(newMax);
    };
    window.addEventListener('gcommunity_total_scans_updated', handleUpdate);
    return () => window.removeEventListener('gcommunity_total_scans_updated', handleUpdate);
  }, []);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [analyticsViewMode, setAnalyticsViewMode] = useState<'chart' | 'table'>('chart');
  const [analyticsData, setAnalyticsData] = useState<ScanDayAnalytics[]>([]);
  const [prevAnalyticsData, setPrevAnalyticsData] = useState<ScanDayAnalytics[]>([]);
  const [showPrevPeriod, setShowPrevPeriod] = useState<boolean>(false);
  const [yearAgoAnalyticsData, setYearAgoAnalyticsData] = useState<ScanDayAnalytics[]>([]);
  const [showYearAgoPeriod, setShowYearAgoPeriod] = useState<boolean>(false);
  const [customAnalyticsData, setCustomAnalyticsData] = useState<ScanDayAnalytics[]>([]);
  const [showCustomPeriod, setShowCustomPeriod] = useState<boolean>(false);
  const [showScanDensity, setShowScanDensity] = useState<boolean>(false);
  const [showSmoothing, setShowSmoothing] = useState<boolean>(false);
  const [zoomRange, setZoomRange] = useState<{ start: number; end: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragStartRange, setDragStartRange] = useState<{ start: number; end: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chartEl = chartRef.current;
    if (!chartEl) return;

    const handleWheel = (e: WheelEvent) => {
      const dataLength = analyticsData.length;
      if (dataLength <= 2) return;

      e.preventDefault();

      const currentStart = zoomRange ? zoomRange.start : 0;
      const currentEnd = zoomRange ? zoomRange.end : dataLength - 1;
      const currentSpan = currentEnd - currentStart;

      const zoomIn = e.deltaY < 0;

      if (zoomIn) {
        if (currentSpan <= 1) return;
        const rect = chartEl.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        const progress = Math.max(0, Math.min(relativeX / rect.width, 1));
        
        const newSpan = Math.max(1, currentSpan - 1);
        const shift = currentSpan - newSpan;
        
        let newStart = Math.round(currentStart + shift * progress);
        let newEnd = newStart + newSpan;
        
        if (newEnd >= dataLength) {
          newEnd = dataLength - 1;
          newStart = Math.max(0, newEnd - newSpan);
        }
        if (newStart < 0) {
          newStart = 0;
          newEnd = Math.min(dataLength - 1, newStart + newSpan);
        }

        setZoomRange({ start: newStart, end: newEnd });
      } else {
        if (currentSpan >= dataLength - 1) {
          setZoomRange(null);
          return;
        }
        const rect = chartEl.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        const progress = Math.max(0, Math.min(relativeX / rect.width, 1));

        const newSpan = Math.min(dataLength - 1, currentSpan + 1);
        const shift = newSpan - currentSpan;
        
        let newStart = Math.round(currentStart - shift * progress);
        let newEnd = newStart + newSpan;

        if (newStart < 0) {
          newStart = 0;
          newEnd = Math.min(dataLength - 1, newStart + newSpan);
        }
        if (newEnd >= dataLength) {
          newEnd = dataLength - 1;
          newStart = Math.max(0, newEnd - newSpan);
        }

        if (newStart === 0 && newEnd === dataLength - 1) {
          setZoomRange(null);
        } else {
          setZoomRange({ start: newStart, end: newEnd });
        }
      }
    };

    chartEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      chartEl.removeEventListener('wheel', handleWheel);
    };
  }, [analyticsData, zoomRange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!zoomRange || !analyticsData.length) return;
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartRange({ ...zoomRange });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || dragStartX === null || !dragStartRange || !chartRef.current || !analyticsData.length) return;
    const rect = chartRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartX;
    
    const pixelsPerIndex = rect.width / (analyticsData.length || 7);
    const indexShift = Math.round(-deltaX / pixelsPerIndex);
    
    if (indexShift !== 0) {
      const dataLength = analyticsData.length;
      const span = dragStartRange.end - dragStartRange.start;
      
      let newStart = dragStartRange.start + indexShift;
      let newEnd = newStart + span;
      
      if (newStart < 0) {
        newStart = 0;
        newEnd = Math.min(dataLength - 1, newStart + span);
      }
      if (newEnd >= dataLength) {
        newEnd = dataLength - 1;
        newStart = Math.max(0, newEnd - span);
      }
      
      setZoomRange({ start: newStart, end: newEnd });
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
    setDragStartX(null);
    setDragStartRange(null);
  };

  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });

  const [analyticsDateRange, setAnalyticsDateRange] = useState<7 | 30 | 90>(7);

  useEffect(() => {
    if (isAnalyticsModalOpen) {
      setAnalyticsData(getScanHistoryForGatheringWithDays(gathering.id, analyticsDateRange));
      setPrevAnalyticsData(getScanHistoryForGatheringWithDays(gathering.id, analyticsDateRange, analyticsDateRange));
      setYearAgoAnalyticsData(getScanHistoryForGatheringWithDays(gathering.id, analyticsDateRange, 365));
      setCustomAnalyticsData(getCustomScanHistoryForGathering(gathering.id, customStartDate));
      setZoomRange(null);
    }
  }, [isAnalyticsModalOpen, gathering.id, customStartDate, analyticsDateRange]);

  const handleExportCSV = () => {
    const logs = [...analyticsData]
      .flatMap(day => (day.timestamps || []).map(t => ({
        date: day.date,
        fullDate: day.fullDate,
        time: t.timeString,
        timestamp: t.timestamp
      })))
      .sort((a, b) => b.timestamp - a.timestamp);

    const headers = ['Gathering ID', 'Gathering Title', 'Date', 'Time', 'Unix Timestamp', 'ISO Date-Time'];
    const rows = logs.map(log => [
      gathering.id,
      `"${gathering.title.replace(/"/g, '""')}"`,
      log.fullDate,
      log.time,
      log.timestamp,
      new Date(log.timestamp).toISOString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gcommunity_scan_history_${gathering.id}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      
      const originalMode = analyticsViewMode;
      if (originalMode !== 'chart') {
        setAnalyticsViewMode('chart');
        await new Promise((resolve) => setTimeout(resolve, 310));
      }

      const chartId = `analytics-chart-container-${gathering.id}`;
      const chartElement = document.getElementById(chartId);
      let chartImageBase64 = null;
      if (chartElement) {
        try {
          const canvas = await html2canvas(chartElement, {
            scale: 2,
            backgroundColor: '#faf8f5',
            logging: false,
            useCORS: true,
          });
          chartImageBase64 = canvas.toDataURL('image/png');
        } catch (err) {
          console.error("Failed to capture chart: ", err);
        }
      }

      if (originalMode !== 'chart') {
        setAnalyticsViewMode(originalMode);
      }

      const doc = new jsPDF('p', 'pt', 'a4');
      const primaryColor = [128, 128, 0];      
      const secondaryColor = [59, 63, 48];     
      const lightBgColor = [250, 248, 245];     
      const tableHeaderBg = [241, 239, 234];    
      const textDarkColor = [38, 38, 38];       
      const textMutedColor = [120, 113, 108];   
      
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      
      let curY = 40;
      const addHeader = (pageNum: number) => {
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(margin, 30, pageWidth - (margin * 2), 4, 'F');
      };

      const addFooter = (pageNum: number, totalPagesPlaceholder: string) => {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(textMutedColor[0], textMutedColor[1], textMutedColor[2]);
        
        const footerY = pageHeight - 35;
        doc.text('Generated via GatherCommunity Scan Engine', margin, footerY);
        
        const pageStr = `Page ${pageNum}`;
        doc.text(pageStr, pageWidth - margin - doc.getTextWidth(pageStr), footerY);
      };

      addHeader(1);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('GatherCommunity Scan History Report', margin, 65);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(textMutedColor[0], textMutedColor[1], textMutedColor[2]);
      const dateStr = `Generated on: ${new Date().toLocaleString()} (Local Time)`;
      doc.text(dateStr, margin, 80);
      
      doc.setDrawColor(217, 214, 206); 
      doc.setLineWidth(0.8);
      doc.line(margin, 95, pageWidth - margin, 95);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Gathering Details', margin, 115);
      
      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.roundedRect(margin, 125, pageWidth - (margin * 2), 65, 8, 8, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(textDarkColor[0], textDarkColor[1], textDarkColor[2]);
      
      doc.setFont('helvetica', 'bold'); doc.text('Title:', margin + 15, 142);
      doc.setFont('helvetica', 'normal'); doc.text(gathering.title || 'N/A', margin + 70, 142);
      
      doc.setFont('helvetica', 'bold'); doc.text('Category:', margin + 15, 157);
      doc.setFont('helvetica', 'normal'); doc.text(gathering.category || 'N/A', margin + 70, 157);
      
      doc.setFont('helvetica', 'bold'); doc.text('Location:', margin + 15, 172);
      doc.setFont('helvetica', 'normal'); doc.text(gathering.location || 'N/A', margin + 70, 172);
      
      const rightColX = margin + 280;
      doc.setFont('helvetica', 'bold'); doc.text('Capacity:', rightColX, 142);
      doc.setFont('helvetica', 'normal'); doc.text(`${gathering.attendeeIds?.length || 0} / ${gathering.capacity || 'Unlimited'}`, rightColX + 70, 142);
      
      doc.setFont('helvetica', 'bold'); doc.text('Date:', rightColX, 157);
      doc.setFont('helvetica', 'normal'); doc.text(gathering.date || 'N/A', rightColX + 70, 157);
      
      doc.setFont('helvetica', 'bold'); doc.text('Status:', rightColX, 172);
      doc.setFont('helvetica', 'normal'); doc.text((gathering.attendeeIds?.length || 0) >= (gathering.capacity || 9999) ? 'FULLY BOOKED' : 'ACTIVE', rightColX + 70, 172);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Key Performance Indicators', margin, 215);

      const allLogs = [...analyticsData]
        .flatMap(day => (day.timestamps || []))
        .sort((a, b) => b.timestamp - a.timestamp);
      
      const totalRegistered = allLogs.length;
      const sampleDays = analyticsData.length || 7;
      const avgScans = (totalRegistered / sampleDays).toFixed(1);
      
      const segmentHours = [0, 0, 0, 0, 0, 0];
      allLogs.forEach(log => {
        const hour = new Date(log.timestamp).getHours();
        const segmentIdx = Math.min(5, Math.floor(hour / 4));
        segmentHours[segmentIdx]++;
      });
      const peakSegmentIdx = segmentHours.indexOf(Math.max(...segmentHours));
      const segmentsLabels = ['12am-4am', '4am-8am', '8am-12pm', '12pm-4pm', '4pm-8pm', '8pm-12am'];
      const peakPeriod = totalRegistered > 0 ? segmentsLabels[peakSegmentIdx] : 'None';

      const cardW = (pageWidth - (margin * 2) - 20) / 3;
      const cardY = 225;
      const cardH = 50;

      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.roundedRect(margin, cardY, cardW, cardH, 6, 6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(textMutedColor[0], textMutedColor[1], textMutedColor[2]);
      doc.text('TOTAL DECLARED SCANS', margin + 10, cardY + 16);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(String(totalRegistered), margin + 10, cardY + 38);

      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.roundedRect(margin + cardW + 10, cardY, cardW, cardH, 6, 6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(textMutedColor[0], textMutedColor[1], textMutedColor[2]);
      doc.text('AVG SCANS / DAY (7D)', margin + cardW + 20, cardY + 16);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(String(avgScans), margin + cardW + 20, cardY + 38);

      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.roundedRect(margin + (cardW * 2) + 20, cardY, cardW, cardH, 6, 6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(textMutedColor[0], textMutedColor[1], textMutedColor[2]);
      doc.text('PEAK TRAFFIC WINDOW', margin + (cardW * 2) + 30, cardY + 16);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(peakPeriod, margin + (cardW * 2) + 30, cardY + 37);

      curY = 295;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('7-Day Scan Frequency Graph (Trend Visual)', margin, curY);

      if (chartImageBase64) {
        doc.addImage(chartImageBase64, 'PNG', margin, curY + 10, pageWidth - (margin * 2), 170);
        curY += 190;
      } else {
        doc.setFillColor(245, 245, 242);
        doc.roundedRect(margin, curY + 10, pageWidth - (margin * 2), 150, 8, 8, 'F');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(textMutedColor[0], textMutedColor[1], textMutedColor[2]);
        doc.text('Chart visual analysis not loaded. Recharts rendered dynamically above.', margin + 80, curY + 80);
        curY += 170;
      }

      const filterQuery = analyticsSearchQuery.trim();
      if (filterQuery) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(194, 65, 12); 
        doc.text(`Active search filter applied: "${filterQuery}". Showing matching sub-records only.`, margin, curY + 10);
        curY += 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Granular Scan Event Ledger', margin, curY + 10);
      curY += 25;

      const query = filterQuery.toLowerCase();
      const filteredLogs = allLogs.filter(log => {
        if (!query) return true;
        const logDate = new Date(log.timestamp);
        const dateLabel = logDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' }).toLowerCase();
        const fullDate = (log.dateString || '').toLowerCase();
        const timeStr = (log.timeString || '').toLowerCase();
        const tsStr = log.timestamp.toString();
        return dateLabel.includes(query) || fullDate.includes(query) || timeStr.includes(query) || tsStr.includes(query);
      });

      const colWidths = {
        index: 35,
        date: 110,
        time: 90,
        unix: 110,
        detailed: pageWidth - (margin * 2) - 35 - 110 - 90 - 110
      };

      const drawTableHeader = (y: number) => {
        doc.setFillColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
        doc.rect(margin, y, pageWidth - (margin * 2), 18, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        
        let curX = margin + 8;
        doc.text('#', curX, y + 12); curX += colWidths.index;
        doc.text('Date / Weekday', curX, y + 12); curX += colWidths.date;
        doc.text('Scan Time', curX, y + 12); curX += colWidths.time;
        doc.text('Unix Timestamp', curX, y + 12); curX += colWidths.unix;
        doc.text('Detailed ISO Date-Time', curX, y + 12);
      };

      drawTableHeader(curY);
      curY += 18;

      let pageNum = 1;

      if (filteredLogs.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(textMutedColor[0], textMutedColor[1], textMutedColor[2]);
        doc.text('No matching active logs found for specified selection period.', margin + 15, curY + 20);
      } else {
        filteredLogs.forEach((log, idx) => {
          if (curY > pageHeight - 70) {
            addFooter(pageNum, '');
            doc.addPage();
            pageNum++;
            curY = 50;
            addHeader(pageNum);
            drawTableHeader(curY);
            curY += 18;
          }

          if (idx % 2 === 1) {
            doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
            doc.rect(margin, curY, pageWidth - (margin * 2), 16, 'F');
          }

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(textDarkColor[0], textDarkColor[1], textDarkColor[2]);

          const logDate = new Date(log.timestamp);
          const dateLabel = logDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
          const timeStr = log.timeString || 'N/A';
          const unixStr = String(log.timestamp);
          const isoStr = logDate.toISOString();

          let curX = margin + 8;
          
          doc.setFont('helvetica', 'bold');
          doc.text(String(idx + 1), curX, curY + 11);
          curX += colWidths.index;

          doc.setFont('helvetica', 'normal');
          doc.text(dateLabel, curX, curY + 11);
          curX += colWidths.date;

          doc.text(timeStr, curX, curY + 11);
          curX += colWidths.time;

          doc.text(unixStr, curX, curY + 11);
          curX += colWidths.unix;

          doc.text(isoStr, curX, curY + 11);

          curY += 16;
        });
      }

      addFooter(pageNum, '');
      doc.save(`gcommunity_analytics_report_${gathering.id}_${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (err) {
      console.error("An error occurred during PDF generation: ", err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const [walletType, setWalletType] = useState<'apple' | 'google'>('apple');
  const [walletQrUrl, setWalletQrUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [communitySharedCopied, setCommunitySharedCopied] = useState(false);
  const [quickShareCopied, setQuickShareCopied] = useState(false);
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const [isInfoHovered, setIsInfoHovered] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [qrActiveTab, setQrActiveTab] = useState<'code' | 'help'>('code');
  const [helpStep, setHelpStep] = useState(1);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [isZooming, setIsZooming] = useState(false);
  const zoomScaleRef = React.useRef(1);

  useEffect(() => {
    zoomScaleRef.current = zoomScale;
  }, [zoomScale]);

  const triggerAutoFocus = () => {
    if (isZooming) return;
    setIsZooming(true);
    setZoomScale(1.8);
    
    // Attempt tracking zoom support in modern WebRTC implementation
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities() as any;
        if (capabilities && capabilities.zoom) {
          track.applyConstraints({
            advanced: [{ zoom: Math.min(capabilities.zoom.max || 2, 1.8) }]
          } as any).catch((err) => console.warn("Native zoom constraint failed:", err));
        }
      }
    } catch (e) {
      console.warn("High-level track constraint access error:", e);
    }

    // Return to standard lens focus after a brief period
    setTimeout(() => {
      setZoomScale(1.0);
      setIsZooming(false);
      try {
        const track = streamRef.current?.getVideoTracks()[0];
        if (track) {
          track.applyConstraints({
            advanced: [{ zoom: 1.0 }]
          } as any).catch((err) => console.warn("Native zoom reset constraint failed:", err));
        }
      } catch (e) {}
    }, 1200);
  };

  const [autoCloseDelay, setAutoCloseDelay] = useState(2000); // default to 2 seconds
  const [scanSuccess, setScanSuccess] = useState(false);
  const scanTimeoutRef = React.useRef<number | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const lastScanTimeRef = React.useRef<number>(0);
  const [forceLowPower, setForceLowPower] = useState(false);
  const [isFeedbackEnabled, setIsFeedbackEnabled] = useState(() => {
    return localStorage.getItem('gcommunity_scan_feedback_enabled') !== 'false';
  });
  const [isScanChimeEnabled, setIsScanChimeEnabled] = useState(() => {
    return localStorage.getItem('gcommunity_scan_chime_enabled') !== 'false';
  });
  const [scanVolume, setScanVolume] = useState<number>(() => {
    const val = localStorage.getItem('gcommunity_scan_volume');
    return val !== null ? parseFloat(val) : 0.8;
  });

  useEffect(() => {
    (window as any).__gcommunity_camera_active = isScanning;
    (window as any).__gcommunity_camera_error = scanError;
    window.dispatchEvent(new CustomEvent('gcommunity_camera_status', {
      detail: { active: isScanning, error: scanError }
    }));
  }, [isScanning, scanError]);

  const [scanCooldown, setScanCooldown] = useState<number>(() => {
    const expiry = localStorage.getItem('gcommunity_scan_cooldown_expiry');
    if (expiry) {
      const remaining = Math.ceil((parseInt(expiry, 10) - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    }
    return 0;
  });

  useEffect(() => {
    if (scanCooldown <= 0) return;
    const interval = setInterval(() => {
      setScanCooldown(prev => {
        const next = prev - 1;
        if (next <= 0) {
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [scanCooldown]);

  useEffect(() => {
    const handleCooldownStarted = (e: Event) => {
      const customEvent = e as CustomEvent;
      const expiry = customEvent.detail?.expiry;
      if (expiry) {
        const remaining = Math.ceil((expiry - Date.now()) / 1000);
        if (remaining > 0) {
          setScanCooldown(remaining);
        }
      }
    };
    const handleCooldownEnded = () => {
      setScanCooldown(0);
    };
    window.addEventListener('gcommunity_scan_cooldown_started', handleCooldownStarted);
    window.addEventListener('gcommunity_scan_cooldown_ended', handleCooldownEnded);
    return () => {
      window.removeEventListener('gcommunity_scan_cooldown_started', handleCooldownStarted);
      window.removeEventListener('gcommunity_scan_cooldown_ended', handleCooldownEnded);
    };
  }, []);


  useEffect(() => {
    const handleFeedbackUpdate = () => {
      setIsFeedbackEnabled(localStorage.getItem('gcommunity_scan_feedback_enabled') !== 'false');
    };
    const handleChimeUpdate = () => {
      setIsScanChimeEnabled(localStorage.getItem('gcommunity_scan_chime_enabled') !== 'false');
    };
    const handleVolumeUpdate = () => {
      const val = localStorage.getItem('gcommunity_scan_volume');
      setScanVolume(val !== null ? parseFloat(val) : 0.8);
    };
    window.addEventListener('gcommunity_feedback_settings_updated', handleFeedbackUpdate);
    window.addEventListener('gcommunity_chime_settings_updated', handleChimeUpdate);
    window.addEventListener('gcommunity_volume_updated', handleVolumeUpdate);
    return () => {
      window.removeEventListener('gcommunity_feedback_settings_updated', handleFeedbackUpdate);
      window.removeEventListener('gcommunity_chime_settings_updated', handleChimeUpdate);
      window.removeEventListener('gcommunity_volume_updated', handleVolumeUpdate);
    };
  }, []);

  const [battery, setBattery] = useState<{ level: number; charging: boolean; supported: boolean; temperature: number }>({
    level: 0.82,
    charging: false,
    supported: false,
    temperature: 31,
  });

  const [showBatteryBreakdown, setShowBatteryBreakdown] = useState(false);
  const [isSmartSaver, setIsSmartSaver] = useState(false);
  const [autoPause, setAutoPause] = useState(true);
  const [recentScans, setRecentScans] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentScans');
    return saved ? JSON.parse(saved) : ["Tech Pitch Night", "Rooftop Yoga Session", "Community Garden Planting"];
  });

  useEffect(() => {
    const handleScanSuccessGlobal = (e: Event) => {
      const customEvent = e as CustomEvent;
      const scannedId = customEvent.detail?.gatheringId;
      if (scannedId) {
        const saved = localStorage.getItem('gatherings');
        const loadedGatherings = saved ? JSON.parse(saved) : SEED_GATHERINGS;
        const found = loadedGatherings.find((x: any) => x.id === scannedId);
        if (found) {
          setRecentScans(prev => {
            const cleaned = prev.filter(x => x !== found.title);
            const updated = [found.title, ...cleaned].slice(0, 5);
            localStorage.setItem('recentScans', JSON.stringify(updated));
            return updated;
          });
        }
        
        // Specifically when a QR code of *this* gathering is successfully scanned (e.g. from camera or click simulation)
        if (scannedId === gathering.id) {
          playHighFidelityOrganicChime(1.0);
          triggerHighFidelityScanHaptics();

          // Refresh states instantly for maximum fidelity feedback loops
          const updatedTotalScans = parseInt(localStorage.getItem('gcommunity_total_scans') || '0', 10);
          const updatedStreak = parseInt(localStorage.getItem('gcommunity_scan_streak') || '0', 10);
          setLifetimeScans(updatedTotalScans);
          setScanStreak(updatedStreak);

          setQrScanTimestamps(prev => {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const updated = [timeStr, ...prev].slice(0, 10);
            localStorage.setItem(`qr_scan_timestamps_${gathering.id}`, JSON.stringify(updated));
            return updated;
          });

          // Append to 7-day analytics history dynamically
          const updatedAnalytics = recordAnalyticsScanForToday(gathering.id);
          setAnalyticsData(updatedAnalytics);
        }
      }
    };
    
    window.addEventListener('gcommunity_scan_success', handleScanSuccessGlobal);
    return () => window.removeEventListener('gcommunity_scan_success', handleScanSuccessGlobal);
  }, [gathering.id]);

  const batteryHoverTimeoutRef = React.useRef<any>(null);
  const [selectedScanEnv, setSelectedScanEnv] = useState<'sun' | 'shade' | 'ac'>('shade');
  const [thermalHistory, setThermalHistory] = useState<number[]>([31.0, 31.8, 33.2, 35.0, 36.5, 38.0, 39.5, 41.0, 40.8, 39.2, 37.6, 36.0, 34.4, 32.8, 31.5]);

  const [batterySaver, setBatterySaver] = useState(() => {
    return localStorage.getItem('batterySaverActive') === 'true';
  });

  const isEcoThrottling = (battery.level < 0.15 && !battery.charging) || forceLowPower || battery.temperature >= 40 || batterySaver;

  // Interactive diagnostic log state
  const [diagnosticLogs, setDiagnosticLogs] = useState<Array<{
    id: string;
    time: string;
    action: string;
    category: 'System' | 'Power' | 'Thermal';
    impact: string;
    color: string;
    details: string;
  }>>([
    { id: 'initial-1', time: '20:02:10', action: 'Diagnostics Init', category: 'System', impact: '0.00% / min', color: 'text-stone-400', details: 'Power diagnostic subsystems successfully initialized' },
    { id: 'initial-2', time: '20:03:15', action: 'Standby Activated', category: 'Power', impact: '-0.30% / min', color: 'text-stone-400', details: 'AMOLED/TFT background standby power active' },
    { id: 'initial-3', time: '20:05:42', action: 'Shade Engaged', category: 'Thermal', impact: '0.00% / min', color: 'text-emerald-400', details: 'Outdoor shade temperature baseline profile matches environment preset.' }
  ]);
  const [activeLogFilter, setActiveLogFilter] = useState<'All' | 'Sys' | 'Pwr' | 'Thm'>('All');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const lastLogStateRef = React.useRef({ isScanning, isEcoThrottling, charging: battery.charging, env: selectedScanEnv });

  useEffect(() => {
    const logsToAdd: Array<{
      id: string;
      time: string;
      action: string;
      category: 'System' | 'Power' | 'Thermal';
      impact: string;
      color: string;
      details: string;
    }> = [];

    const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (isScanning !== lastLogStateRef.current.isScanning) {
      logsToAdd.push({
        id: `scan-${Date.now()}-${Math.random()}`,
        time: nowStr,
        action: isScanning ? 'Scan Started' : 'Scan Paused',
        category: 'System',
        impact: isScanning ? '-2.40% / min' : '0.00% / min',
        color: isScanning ? 'text-emerald-400' : 'text-stone-400',
        details: isScanning ? 'VQR camera feed opened; high FPS decoders in active search.' : 'Camera feed standard pause; decoder standby mode engaged.'
      });
    }

    if (isEcoThrottling !== lastLogStateRef.current.isEcoThrottling) {
      logsToAdd.push({
        id: `throttle-${Date.now()}-${Math.random()}`,
        time: nowStr,
        action: isEcoThrottling ? 'Throttling Active' : 'Throttling Inactive',
        category: 'Power',
        impact: isEcoThrottling ? '-0.80% / min' : '-2.40% / min',
        color: isEcoThrottling ? 'text-amber-400' : 'text-emerald-400',
        details: isEcoThrottling ? 'FPS capped at 3 FPS due to low charge or forced energy throttle constraint.' : 'Standard optimal FPS frame rate restored.'
      });
    }

    if (battery.charging !== lastLogStateRef.current.charging) {
      logsToAdd.push({
        id: `charge-${Date.now()}-${Math.random()}`,
        time: nowStr,
        action: battery.charging ? 'Charger Plugged' : 'Charger Unplugged',
        category: 'Power',
        impact: battery.charging ? '+1.50% / min' : '-0.60% / min',
        color: battery.charging ? 'text-sky-400' : 'text-stone-400',
        details: battery.charging ? 'External AC voltage detected; dynamic accumulator charging started.' : 'External voltage disconnected; running on lithium-ion pack.'
      });
    }

    if (selectedScanEnv !== lastLogStateRef.current.env) {
      const rate = selectedScanEnv === 'sun' ? '-3.80% / min' : (selectedScanEnv === 'ac' ? '-0.80% / min' : '-1.50% / min');
      const names = { sun: 'Sun Preset Set', shade: 'Shade Preset Set', ac: 'AC Preset Set' };
      const detailsMap = {
        sun: 'Thermal baseline shifted to 45.0°C; maximum scanner solar stress, higher thermal dissipation rate.',
        shade: 'Thermal baseline shifted to 41.0°C; standard outdoor use bounds.',
        ac: 'Thermal baseline locked at 34.0°C; heat dissipation optimal under laboratory controls.'
      };
      logsToAdd.push({
        id: `env-${Date.now()}-${Math.random()}`,
        time: nowStr,
        action: names[selectedScanEnv] || 'Env Preset Changed',
        category: 'Thermal',
        impact: rate,
        color: selectedScanEnv === 'sun' ? 'text-rose-400' : (selectedScanEnv === 'ac' ? 'text-emerald-400' : 'text-[#808000]'),
        details: detailsMap[selectedScanEnv] || 'Environmental baseline profile altered.'
      });
    }

    if (logsToAdd.length > 0) {
      setDiagnosticLogs(prev => {
        const updated = [...logsToAdd, ...prev];
        return updated.slice(0, 15);
      });
    }

    lastLogStateRef.current = { isScanning, isEcoThrottling, charging: battery.charging, env: selectedScanEnv };
  }, [isScanning, isEcoThrottling, battery.charging, selectedScanEnv]);

  const [smartRefresh, setSmartRefresh] = useState(() => {
    return localStorage.getItem('smartRefreshActive') === 'true';
  });

  useEffect(() => {
    if (!smartRefresh) return;
    const interval = setInterval(() => {
      // Clear cache of stale gathering data
      localStorage.removeItem('gatherings');
      // Dispatch reset cache event to App component
      window.dispatchEvent(new CustomEvent('gcommunity_reset_cache'));
      
      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setDiagnosticLogs(prev => {
        const newLog = {
          id: `cache-clear-${Date.now()}`,
          time: nowStr,
          action: 'Smart Refresh: Cache cleared',
          category: 'System' as const,
          impact: '0.00% / min',
          color: 'text-sky-400',
          details: 'Automatic periodic cache clearing completed. Stale local storage gathering data cleared to prevent outdated event listings.'
        };
        return [newLog, ...prev].slice(0, 15);
      });
    }, 15000); // clear every 15 seconds
    return () => clearInterval(interval);
  }, [smartRefresh]);

  const handleToggleSmartRefresh = (val: boolean) => {
    setSmartRefresh(val);
    localStorage.setItem('smartRefreshActive', String(val));
    
    const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDiagnosticLogs(prev => {
      const log = {
        id: `refresh-toggle-${Date.now()}`,
        time: nowStr,
        action: val ? 'Smart Refresh Enabled' : 'Smart Refresh Disabled',
        category: 'System' as const,
        impact: '0.00% / min',
        color: val ? 'text-emerald-400' : 'text-stone-400',
        details: val 
          ? 'Periodic auto-clearing of gathering cache active every 15 seconds.' 
          : 'Periodic cache clearing deactivated; local storage cache persistent.'
      };
      return [log, ...prev].slice(0, 15);
    });
  };

  const handleToggleBatterySaver = (val: boolean) => {
    setBatterySaver(val);
    localStorage.setItem('batterySaverActive', String(val));
    
    const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDiagnosticLogs(prev => {
      const log = {
        id: `saver-toggle-${Date.now()}`,
        time: nowStr,
        action: val ? 'Battery Saver Active' : 'Battery Saver Idle',
        category: 'Power' as const,
        impact: val ? '-0.80% / min' : '0.00% / min',
        color: val ? 'text-emerald-400' : 'text-stone-400',
        details: val 
          ? 'Scanning adjusted to power-saving 3 FPS mode.' 
          : 'High performance scanning rate restored.'
      };
      return [log, ...prev].slice(0, 15);
    });
  };

  const [batteryHistory, setBatteryHistory] = useState<number[]>([82.4, 82.2, 82.1, 82.0, 81.8, 81.5, 81.1, 81.0, 80.8]);

  // Record battery consumption history during scanning sessions
  useEffect(() => {
    let interval: any = null;
    if (isScanning) {
      interval = setInterval(() => {
        setBatteryHistory(prev => {
          const lastVal = prev[prev.length - 1] ?? (battery.level * 100);
          const rateOfChange = battery.charging 
            ? 0.05 
            : isEcoThrottling 
              ? -0.02 
              : -0.08;
          const nextVal = Math.max(1, Math.min(100, Number((lastVal + rateOfChange).toFixed(2))));
          const updated = [...prev, nextVal];
          if (updated.length > 15) {
            updated.shift();
          }
          return updated;
        });
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isScanning, battery.charging, isEcoThrottling, battery.level]);

  useEffect(() => {
    const nav = navigator as any;
    if (nav && typeof nav.getBattery === 'function') {
      let batteryObj: any = null;

      const handleBatteryUpdate = () => {
        if (batteryObj) {
          const apiTemp = typeof batteryObj.temperature === 'number' ? batteryObj.temperature : undefined;
          setBattery(prev => ({
            level: batteryObj.level,
            charging: batteryObj.charging,
            supported: true,
            temperature: apiTemp !== undefined ? apiTemp : prev.temperature,
          }));
        }
      };

      nav.getBattery().then((bat: any) => {
        batteryObj = bat;
        handleBatteryUpdate();
        bat.addEventListener('levelchange', handleBatteryUpdate);
        bat.addEventListener('chargingchange', handleBatteryUpdate);
      }).catch((err: any) => {
        console.warn("Battery status API promise failed:", err);
      });

      return () => {
        if (batteryObj) {
          batteryObj.removeEventListener('levelchange', handleBatteryUpdate);
          batteryObj.removeEventListener('chargingchange', handleBatteryUpdate);
        }
      };
    }
  }, []);

  // Monitor device temperature and warm up under heavy camera scanning
  useEffect(() => {
    let interval: any = null;
    
    // Environment configurations
    const envConfig = {
      sun: { rate: 1.8, max: 45 },
      shade: { rate: 1.0, max: 41 },
      ac: { rate: 0.4, max: 34 }
    };
    
    if (isScanning) {
      interval = setInterval(() => {
        setBattery(prev => {
          const cfg = envConfig[selectedScanEnv] || envConfig.shade;
          const rateMultiplier = prev.charging ? 1.5 : 1.0;
          const rate = Number((cfg.rate * rateMultiplier).toFixed(1));
          const maxTemp = prev.charging ? Math.min(46, cfg.max + 2) : cfg.max;
          
          if (prev.temperature < maxTemp) {
            const nextTemp = Math.min(maxTemp, Number((prev.temperature + rate).toFixed(1)));
            
            // Record live history point
            setThermalHistory(hPrev => {
              const updated = [...hPrev, nextTemp];
              if (updated.length > 15) {
                updated.shift();
              }
              return updated;
            });
            
            return { ...prev, temperature: nextTemp };
          }
          
          // Even if at max, record current temperature in history
          setThermalHistory(hPrev => {
            const updated = [...hPrev, prev.temperature];
            if (updated.length > 15) {
              updated.shift();
            }
            return updated;
          });
          
          return prev;
        });
      }, 1500); 
    } else {
      interval = setInterval(() => {
        setBattery(prev => {
          if (prev.temperature > 31) {
            const nextTemp = Math.max(31, Number((prev.temperature - 0.8).toFixed(1)));
            setThermalHistory(hPrev => {
              const updated = [...hPrev, nextTemp];
              if (updated.length > 15) {
                updated.shift();
              }
              return updated;
            });
            return { ...prev, temperature: nextTemp };
          }
          return prev;
        });
      }, 1500);
    }
    
    return () => clearInterval(interval);
  }, [isScanning, selectedScanEnv]);

  const stopScanning = () => {
    setIsScanning(false);
    setScanError(null);
    setZoomScale(1.0);
    setIsZooming(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
    
    // Eco-Throttle when battery power is low (<15%) and not charging, manually forced, or if high temperature is detected (>= 40°C)
    const isHighHeat = battery.temperature >= 40;
    const isLowPower = (battery.level < 0.15 && !battery.charging) || forceLowPower || isHighHeat;
    const now = performance.now();
    
    // Calculate throttle threshold dynamically if Smart Saver is enabled, otherwise use static checks.
    let throttleThreshold = 0;
    if (isHighHeat) {
      throttleThreshold = 333; // ~3 FPS on High heat regardless to protect device
    } else if (isSmartSaver && !battery.charging) {
      if (battery.level < 0.15) {
        throttleThreshold = 400; // ~2.5 FPS
      } else if (battery.level < 0.25) {
        throttleThreshold = 250; // ~4 FPS
      } else if (battery.level < 0.45) {
        throttleThreshold = 143; // ~7 FPS
      } else if (battery.level < 0.70) {
        throttleThreshold = 83;  // ~12 FPS
      } else if (battery.level < 0.85) {
        throttleThreshold = 50;  // ~20 FPS
      } else {
        throttleThreshold = 33;  // ~30 FPS
      }
    } else {
      throttleThreshold = isLowPower ? 333 : 0; // limit parsing to ~3 FPS when battery low, manually throttled, or high heat
    }

    const isThrottled = throttleThreshold > 0;
    
    if (isThrottled && now - lastScanTimeRef.current < throttleThreshold) {
      if (streamRef.current) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
      return;
    }
    
    lastScanTimeRef.current = now;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const currentZoom = zoomScaleRef.current;
        if (currentZoom > 1.0) {
          const sw = video.videoWidth / currentZoom;
          const sh = video.videoHeight / currentZoom;
          const sx = (video.videoWidth - sw) / 2;
          const sy = (video.videoHeight - sh) / 2;
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          
          if (code) {
            const resultText = code.data;
            console.log("QR scanned successfully:", resultText);
            
            let parsedGatheringId: string | null = null;
            if (resultText.includes('gatheringId=')) {
              try {
                const url = new URL(resultText);
                parsedGatheringId = url.searchParams.get('gatheringId');
              } catch (e) {
                const match = resultText.match(/[?&]gatheringId=([^&]+)/);
                if (match) parsedGatheringId = match[1];
              }
            } else if (resultText.startsWith('gathering:')) {
              parsedGatheringId = resultText.replace('gathering:', '');
            } else {
              parsedGatheringId = resultText.trim();
            }
            
            if (parsedGatheringId) {
              playQrPingSound();
              window.dispatchEvent(new CustomEvent('gcommunity_scan_success', { 
                detail: { gatheringId: parsedGatheringId } 
              }));
              
              if (autoPause) {
                stopScanning();
              }
              
              if (autoCloseDelay === 0) {
                if (autoPause) {
                  setIsQrModalOpen(false);
                }
              } else {
                setScanSuccess(true);
                scanTimeoutRef.current = window.setTimeout(() => {
                  if (autoPause) {
                    setIsQrModalOpen(false);
                  }
                  setScanSuccess(false);
                }, autoCloseDelay);
              }
              
              if (autoPause) {
                return;
              }
            }
          }
        } catch (err) {
          console.error("jsQR error:", err);
        }
      }
    }
    
    if (streamRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  };

  const startScanning = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Autoplay was prevented", playErr);
        }
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setScanError('Failed to access camera. Please ensure camera permissions are active.');
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (!isQrModalOpen) {
      stopScanning();
      setQrActiveTab('code');
      setHelpStep(1);
      setScanSuccess(false);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    }
  }, [isQrModalOpen]);

  const shareTitle = `Join me at ${gathering.title}!`;
  const shareText = `${gathering.description}\n\nWhen: ${new Date(gathering.date).toLocaleDateString()} at ${gathering.time}\nWhere: ${gathering.location}`;
  const shareUrl = `${window.location.origin}${window.location.pathname}?gatheringId=${gathering.id}`;

  const loadComments = () => {
    setComments(getCommentsForGathering(gathering.id));
  };

  useEffect(() => {
    loadComments();
    
    const handleCommentsChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.gatheringId === gathering.id) {
        loadComments();
      }
    };
    
    window.addEventListener('gcommunity_comments_changed', handleCommentsChanged);
    return () => {
      window.removeEventListener('gcommunity_comments_changed', handleCommentsChanged);
    };
  }, [gathering.id]);

  const handlePostComment = () => {
    if (!newCommentText.trim()) return;
    
    const comment: Comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      gatheringId: gathering.id,
      userId: CURRENT_USER.id,
      userName: CURRENT_USER.name,
      userAvatar: CURRENT_USER.avatar,
      text: newCommentText.trim(),
      timestamp: new Date().toISOString()
    };
    
    saveCommentForGathering(comment);
    setNewCommentText('');
    
    setTimeout(() => {
      const container = document.getElementById(`comments-list-${gathering.id}`);
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isQrModalOpen) {
      QRCode.toDataURL(
        shareUrl,
        {
          width: 300,
          margin: 2,
          color: {
            dark: '#4f5544',
            light: '#fcfbf7'
          }
        },
        (err, url) => {
          if (!err) {
            setQrCodeDataUrl(url);
          } else {
            console.error('Failed to generate QR Code:', err);
          }
        }
      );
    }
  }, [isQrModalOpen, shareUrl]);

  useEffect(() => {
    if (isWalletModalOpen) {
      QRCode.toDataURL(
        shareUrl,
        {
          width: 300,
          margin: 2,
          color: {
            dark: '#1c1917',
            light: '#faf8f5'
          }
        },
        (err, url) => {
          if (!err) {
            setWalletQrUrl(url);
          } else {
            console.error('Failed to generate Wallet QR Code:', err);
          }
        }
      );
    }
  }, [isWalletModalOpen, shareUrl]);

  const handleExportWalletPass = async () => {
    let currentQr = walletQrUrl;
    if (!currentQr) {
      try {
        currentQr = await new Promise<string>((resolve, reject) => {
          QRCode.toDataURL(
            shareUrl,
            {
              width: 300,
              margin: 2,
              color: {
                dark: '#1c1917',
                light: '#faf8f5'
              }
            },
            (err, url) => {
              if (err) reject(err);
              else resolve(url);
            }
          );
        });
      } catch (err) {
        console.error('Failed to generate pass QR:', err);
      }
    }

    const passHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${gathering.title} - Event Entry Pass</title>
  <style>
    body {
      margin: 0;
      padding: 32px 16px;
      background-color: #0c0a09;
      color: #fafaf9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .pass-container {
      width: 100%;
      max-width: 360px;
      background: linear-gradient(135deg, #1c1917 0%, #0c0a09 100%);
      border: 1px solid rgba(120, 113, 108, 0.2);
      border-radius: 28px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      position: relative;
    }
    .pass-container::before, .pass-container::after {
      content: '';
      position: absolute;
      width: 24px;
      height: 24px;
      background-color: #0c0a09;
      border-radius: 50%;
      top: 66%;
      z-index: 10;
      border: 1px solid rgba(120, 113, 108, 0.2);
      box-sizing: border-box;
    }
    .pass-container::before {
      left: -12px;
    }
    .pass-container::after {
      right: -12px;
    }
    .pass-header {
      background-color: #4f5544;
      padding: 18px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px dashed rgba(120, 113, 108, 0.3);
    }
    .brand-title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #faf8f5;
      text-transform: uppercase;
    }
    .pass-type {
      font-size: 9px;
      font-weight: 700;
      color: #e2e8f0;
      background: rgba(255,255,255,0.15);
      padding: 2px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .pass-body {
      padding: 24px 20px;
    }
    .event-title {
      font-size: 22px;
      line-height: 1.25;
      font-weight: 800;
      color: #faf8f5;
      margin: 0 0 16px 0;
      letter-spacing: -0.5px;
    }
    .field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .field-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #a8a29e;
      margin-bottom: 4px;
    }
    .field-val {
      font-size: 13px;
      font-weight: 600;
      color: #faf8f5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .qr-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-top: 16px;
      background: #faf8f5;
      padding: 24px;
      border-radius: 20px;
      box-shadow: inset 0 2px 10px rgba(0,0,0,0.05);
    }
    .qr-image {
      width: 180px;
      height: 180px;
      display: block;
    }
    .qr-label {
      font-size: 10px;
      font-weight: 700;
      color: #1c1917;
      margin-top: 12px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .pass-footer {
      padding: 16px 20px 24px 20px;
      text-align: center;
    }
    .system-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: monospace;
      font-size: 9px;
      color: #84cc16;
      background: rgba(132, 204, 22, 0.1);
      border: 1px solid rgba(132, 204, 22, 0.2);
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: bold;
    }
    .instructions {
      margin-top: 28px;
      max-width: 320px;
      text-align: center;
    }
    .instructions-title {
      font-size: 13px;
      font-weight: bold;
      color: #e7e5e4;
      margin-bottom: 10px;
    }
    .instructions-step {
      font-size: 11px;
      color: #a8a29e;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .home-btn {
      margin-top: 24px;
      display: inline-block;
      font-size: 12px;
      font-weight: bold;
      color: #4f5544;
      background-color: #faf8f5;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 999px;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .home-btn:hover {
      background-color: #e7e5e4;
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <div class="pass-container">
    <div class="pass-header">
      <span class="brand-title">Community Gatherings</span>
      <span class="pass-type">Digital Pass</span>
    </div>
    <div class="pass-body">
      <h1 class="event-title">${gathering.title}</h1>
      
      <div class="field-grid">
        <div>
          <div class="field-label">Date</div>
          <div class="field-val">${new Date(gathering.date.replace(/-/g, '/')).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
        <div>
          <div class="field-label">Time</div>
          <div class="field-val">${gathering.time}</div>
        </div>
        <div>
          <div class="field-label">Location</div>
          <div class="field-val" title="${gathering.location}">${gathering.location}</div>
        </div>
        <div>
          <div class="field-label">Host</div>
          <div class="field-val">${gathering.hostName}</div>
        </div>
      </div>

      <div class="qr-section">
        <img class="qr-image" src="${currentQr || qrCodeDataUrl}" alt="Pass Entry Barcode">
        <div class="qr-label">Verified Gate Ticket</div>
      </div>
    </div>
    
    <div class="pass-footer">
      <div class="system-status">
        ● OFFLINE SECURE PASS ACTIVE
      </div>
    </div>
  </div>

  <div class="instructions">
    <div class="instructions-title">Add to Wallet / Homescreen Instruction:</div>
    <div class="instructions-step"><strong>Apple iOS (Safari):</strong> Tap the bottom <strong>Share</strong> icon, then select <strong>Add to Home Screen</strong>. This saves it directly to your device local apps list.</div>
    <div class="instructions-step"><strong>Google Android (Chrome):</strong> Tap the top-right menu (three vertical dots), then select <strong>Add to Home screen</strong> to register your digital ticket shortcut.</div>
    <a href="${shareUrl}" class="home-btn">Open Live Event Details</a>
  </div>
</body>
</html>`;

    const blob = new Blob([passHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gathering_pass_${gathering.id}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getRemainingTimeText = () => {
    try {
      const [year, month, day] = gathering.date.split('-').map(Number);
      const [hour, minute] = gathering.time.split(':').map(Number);
      const targetDate = new Date(year, month - 1, day, hour, minute);
      const diffMs = targetDate.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        return null;
      }
      
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      const remainingHours = diffHours % 24;
      const remainingMins = diffMins % 60;

      const parts = [];
      if (diffDays > 0) {
        parts.push(`${diffDays}d`);
      }
      if (remainingHours > 0 || diffDays > 0) {
        parts.push(`${remainingHours}h`);
      }
      if (remainingMins > 0 || (diffDays === 0 && remainingHours === 0)) {
        parts.push(`${remainingMins}m`);
      }

      return `starts in ${parts.join(' ')}`;
    } catch (e) {
      return null;
    }
  };

  const remainingText = getRemainingTimeText();

  const handleShare = (platform: 'email' | 'twitter' | 'facebook' | 'native' | 'sms' | 'qr') => {
    switch (platform) {
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareText + '\n\nView details: ' + shareUrl)}`;
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle + ' ' + shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'sms':
        const smsBody = `${shareTitle}\n\n${shareText}\n\nView details: ${shareUrl}`;
        window.location.href = `sms:?body=${encodeURIComponent(smsBody)}`;
        break;
      case 'qr':
        setIsQrModalOpen(true);
        break;
      case 'native':
        if (navigator.share) {
          navigator.share({ title: shareTitle, text: shareText, url: shareUrl }).catch(console.error);
        } else {
          navigator.clipboard.writeText(shareUrl).then(() => {
            setCommunitySharedCopied(true);
            setTimeout(() => setCommunitySharedCopied(false), 2500);
          }).catch(console.error);
        }
        break;
    }
    setShowShareMenu(false);
  };

  return (
    <motion.div 
      layout
      whileHover={{ y: -4 }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'm' || e.key === 'M') {
          setHeaderView('map');
        } else if (e.key === 'p' || e.key === 'P') {
          setHeaderView('photo');
        }
      }}
      className="warm-card overflow-hidden flex flex-col h-full focus:outline-none focus:ring-2 focus:ring-olive focus-within:ring-2 focus-within:ring-olive"
      id={`gathering-card-${gathering.id}`}
    >
      <div className="relative h-48 overflow-hidden group bg-[#f4f2eb] border-b border-olive/5" id={`card-header-container-${gathering.id}`}>
        <AnimatePresence mode="wait">
          {headerView === 'photo' ? (
            <motion.div
              key="photo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
              id={`card-photo-pane-${gathering.id}`}
            >
              <img src={gathering.image} alt={gathering.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            </motion.div>
          ) : (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full relative"
              id={`card-map-pane-${gathering.id}`}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none" id={`card-map-svg-${gathering.id}`}>
                <defs>
                  <pattern id={`card-grid-${gathering.id}`} width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(128, 138, 114, 0.08)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100" height="100" fill={`url(#card-grid-${gathering.id})`} />

                {/* Simulated topographical curved contours and pathways */}
                <path d="M-10,35 Q30,45 60,20 T110,60" fill="none" stroke="rgba(128, 138, 114, 0.15)" strokeWidth="3" strokeDasharray="1,2" />
                <path d="M25,-10 Q35,40 20,110" fill="none" stroke="rgba(128, 138, 114, 0.15)" strokeWidth="2" />
                <path d="M70,-10 Q50,60 80,110" fill="none" stroke="rgba(128, 138, 114, 0.2)" strokeWidth="4" className="text-olive/20" />
                <path d="M-10,80 C40,75 60,85 110,75" fill="none" stroke="rgba(128, 138, 114, 0.12)" strokeWidth="2.5" />

                {/* Surrounding landscape marker references */}
                <g className="opacity-35">
                  <circle cx="20" cy="40" r="1.5" fill="#808a72" />
                  <circle cx="80" cy="15" r="1.5" fill="#808a72" />
                  <circle cx="45" cy="85" r="1.5" fill="#808a72" />
                </g>

                {/* Highlighted current venue location */}
                <g>
                  {/* Outer pulsating echo effect */}
                  <circle 
                    cx={gathering.lng} 
                    cy={gathering.lat} 
                    r="8" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="0.75" 
                    className="text-olive/25 animate-pulse origin-center" 
                  />
                  <circle cx={gathering.lng} cy={gathering.lat} r="4" fill="rgba(128, 138, 114, 0.25)" />
                  <path 
                    d={`M ${gathering.lng} ${gathering.lat - 5} C ${gathering.lng - 3} ${gathering.lat - 5} ${gathering.lng - 3} ${gathering.lat} ${gathering.lng} ${gathering.lat} C ${gathering.lng + 3} ${gathering.lat} ${gathering.lng + 3} ${gathering.lat - 5} ${gathering.lng} ${gathering.lat - 5} Z`} 
                    fill="#6e7761" 
                    className="filter drop-shadow-sm"
                  />
                  <circle cx={gathering.lng} cy={gathering.lat - 3.2} r="1" fill="#fff" />
                </g>

                {/* Micro badge indicator titles for context */}
                <g transform="translate(6, 14)" className="font-sans text-[4px] font-bold fill-olive/60 tracking-widest uppercase">
                  <text>Sector-Grid Map REF</text>
                </g>

                {/* Custom Scale bar representation */}
                <g transform="translate(6, 84)" className="font-sans text-[4px] font-bold fill-olive/75 tracking-wider">
                  <rect width="18" height="4" fill="rgba(255, 255, 255, 0.85)" rx="1" />
                  <line x1="2" y1="2" x2="16" y2="2" stroke="currentColor" strokeWidth="0.5" />
                  <line x1="2" y1="1" x2="2" y2="3" stroke="currentColor" strokeWidth="0.5" />
                  <line x1="16" y1="1" x2="16" y2="3" stroke="currentColor" strokeWidth="0.5" />
                  <text x="5" y="3" className="fill-olive font-extrabold" style={{ fontSize: '2px' }}>500m</text>
                </g>
                
                {/* Coordinates grid metadata badge */}
                <g transform="translate(56, 84)" className="font-mono text-[4px] font-bold">
                  <rect x="-2" y="-1" width="40" height="6" fill="rgba(255,255,255,0.85)" rx="1" />
                  <text x="0" y="3" className="fill-olive/90 font-semibold">{gathering.lng}% E, {gathering.lat}% N</text>
                </g>
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Category indicator tag */}
        <div className="absolute top-4 left-4 z-10" id={`category-pill-${gathering.id}`}>
          <span className="bg-warm-white/95 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-olive shadow-sm">
            {gathering.category}
          </span>
        </div>

        {/* Micro slider toggles for Photo vs Map representation */}
        <div 
          className="absolute top-4 right-4 z-10 flex bg-warm-white/95 backdrop-blur p-0.5 rounded-xl border border-olive/15 shadow-sm" 
          id={`header-toggle-container-${gathering.id}`}
          role="group"
          aria-label="Card preview mode toggle"
        >
          <span className="sr-only">Use keyboard shortcut P for Photo and M for Map Pin when card is focused</span>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); setHeaderView('photo'); }}
            className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-olive ${headerView === 'photo' ? 'bg-olive text-warm-white' : 'text-gray-500 hover:text-olive'}`}
            id={`photo-toggle-btn-${gathering.id}`}
            aria-label="Switch card header to photo view"
            aria-pressed={headerView === 'photo'}
            aria-keyshortcuts="p"
            title="Press P key to show photo"
          >
            Photo
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); setHeaderView('map'); }}
            className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-olive ${headerView === 'map' ? 'bg-olive text-warm-white' : 'text-gray-500 hover:text-olive'}`}
            id={`map-toggle-btn-${gathering.id}`}
            aria-label="Switch card header to map pin location view"
            aria-pressed={headerView === 'map'}
            aria-keyshortcuts="m"
            title="Press M key to show map pin"
          >
            <MapIcon className="w-2.5 h-2.5" /> Map Pin
          </button>
        </div>

        {/* Favorite marker Button */}
        <button className="absolute bottom-4 right-4 z-10 p-2 bg-warm-white/90 backdrop-blur rounded-full shadow-sm hover:text-red-500 transition-colors" id={`favorite-heart-btn-${gathering.id}`}>
          <Heart className="w-4 h-4" />
        </button>
      </div>
      <div className="p-6 flex-1 flex flex-col space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 cursor-pointer group/host" onClick={onViewHost}>
            <div className="w-6 h-6 rounded-full overflow-hidden border border-olive/20">
              <img src={gathering.hostAvatar} className="w-full h-full object-cover" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover/host:text-olive transition-colors">Host: {gathering.hostName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={(e) => { e.stopPropagation(); exportToIcs(gathering); }}
              className="p-2 rounded-full hover:bg-olive/5 text-gray-400 hover:text-olive transition-colors"
              title="Add to Calendar (.ics)"
              id={`export-calendar-btn-${gathering.id}`}
            >
              <Calendar className="w-4 h-4" />
            </button>
            <div className="relative border-l border-gray-100 pl-1.5">
              <button 
                onClick={() => setShowShareMenu(!showShareMenu)}
                className={`p-2 rounded-full transition-colors ${showShareMenu ? 'bg-olive text-white' : 'hover:bg-olive/5 text-gray-400 hover:text-olive'}`}
                title="Share Gathering"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {showShareMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowShareMenu(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-20 overflow-hidden"
                    >
                      <button 
                        onClick={() => handleShare('email')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold text-gray-600 hover:bg-olive hover:text-white rounded-xl transition-all"
                      >
                        <Mail className="w-4 h-4" /> Email
                      </button>
                      <button 
                        onClick={() => handleShare('twitter')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold text-gray-600 hover:bg-olive hover:text-white rounded-xl transition-all"
                      >
                        <ExternalLink className="w-4 h-4" /> Twitter
                      </button>
                      <button 
                        onClick={() => handleShare('facebook')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold text-gray-600 hover:bg-olive hover:text-white rounded-xl transition-all"
                      >
                        <ExternalLink className="w-4 h-4" /> Facebook
                      </button>
                      <button 
                        onClick={() => handleShare('sms')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold text-gray-600 hover:bg-olive hover:text-white rounded-xl transition-all border-t border-gray-50 mt-1"
                        id={`share-sms-btn-${gathering.id}`}
                      >
                        <MessageSquare className="w-4 h-4" /> Text Message
                      </button>
                      <button 
                        onClick={() => handleShare('qr')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold text-gray-600 hover:bg-olive hover:text-white rounded-xl transition-all border-t border-gray-50 mt-1"
                        id={`share-qr-btn-${gathering.id}`}
                      >
                        <QrCodeIcon className="w-4 h-4" /> QR Code
                      </button>
                      <button 
                        onClick={() => { exportToIcs(gathering); setShowShareMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold text-gray-600 hover:bg-olive hover:text-white rounded-xl transition-all border-t border-gray-100 mt-1"
                        id={`share-ics-btn-${gathering.id}`}
                      >
                        <Calendar className="w-4 h-4" /> Export (.ics)
                      </button>
                      {navigator.share && (
                        <button 
                          onClick={() => handleShare('native')}
                          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold text-gray-600 hover:bg-olive hover:text-white rounded-xl transition-all border-t border-gray-50 mt-1"
                        >
                          <Share2 className="w-4 h-4" /> System Share
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="serif text-xl font-medium leading-tight group-hover:text-olive transition-colors">{gathering.title}</h3>
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-gray-500 font-light">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-olive/40" />
              {gathering.location}
            </div>
            {remainingText && (
              <span className="flex items-center gap-1 bg-olive/5 text-olive font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-olive/15 shadow-sm animate-pulse">
                <Clock className="w-2.5 h-2.5" />
                {remainingText}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 font-light flex-1 line-clamp-2">
          {gathering.description}
        </p>
        
        {/* Dynamic Discoverability Tag Pills */}
        {gathering.tags && gathering.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 pb-1" id={`tags-list-${gathering.id}`}>
            {gathering.tags.map(tag => (
              <span 
                key={tag} 
                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md transition-all duration-150 cursor-pointer ${
                  selectedTag === tag 
                    ? 'bg-olive text-warm-white shadow-xs' 
                    : 'bg-[#f6f5f0] text-stone-600 hover:bg-olive/10 hover:text-olive'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTag?.(tag);
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        {isAttending && (
          <div className="flex items-center gap-3 py-2 px-3 bg-olive/5 rounded-2xl border border-olive/10">
            <div className="flex -space-x-1.5 overflow-visible">
              {gathering.attendeeIds.map(id => users.find(u => u.id === id)).filter((u): u is UserProfile => !!u).map((attendee) => (
                <div 
                  key={attendee.id} 
                  className="w-7 h-7 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-olive/10 hover:-translate-y-1 hover:scale-105 transition-all duration-200"
                  title={attendee.name}
                >
                  <img src={attendee.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"} alt={attendee.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-olive truncate">
                Attending
              </p>
              <p className="text-xs text-gray-600 truncate">
                {gathering.attendeeIds.length === 1 
                  ? 'Only you are attending' 
                  : `You and ${gathering.attendeeIds.length - 1} ${gathering.attendeeIds.length - 1 === 1 ? 'other' : 'others'}`}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-3 h-3 text-olive/40" />
            {new Date(gathering.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onIcebreakers}
              className="text-[10px] font-bold uppercase tracking-tighter text-olive/60 hover:text-olive transition-colors flex items-center gap-1"
              id={`icebreakers-btn-${gathering.id}`}
            >
              <Sparkles className="w-3 h-3" /> Icebreakers
            </button>
            <button 
              type="button"
              onClick={() => setShowComments(!showComments)}
              className={`text-[10px] font-bold uppercase tracking-tighter transition-colors flex items-center gap-1 ${showComments ? 'text-olive font-extrabold' : 'text-olive/60 hover:text-olive'}`}
              id={`discussion-btn-${gathering.id}`}
            >
              <MessageSquare className="w-3 h-3" /> Discussion {comments.length > 0 && `(${comments.length})`}
            </button>
          </div>
        </div>

        {/* Collapsible Discussion Board */}
        <AnimatePresence initial={false}>
          {showComments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden border-t border-stone-100 pt-3.5 space-y-3"
              id={`comments-panel-${gathering.id}`}
            >
              <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
                <span>Discussion Board</span>
                <span className="text-[9px] text-gray-400 font-normal normal-case">{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
              </div>

              {/* Comment list container */}
              <div 
                className="space-y-2 max-h-52 overflow-y-auto pr-1 pb-1 scrollbar-thin"
                id={`comments-list-${gathering.id}`}
              >
                {comments.length === 0 ? (
                  <div className="text-center py-5 px-4 bg-[#faf9f5] rounded-2xl border border-dashed border-olive/15" id={`comments-empty-${gathering.id}`}>
                    <MessageSquare className="w-5 h-5 text-olive/20 mx-auto mb-1" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">No questions yet</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">Be the first to say hello or ask a question!</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div 
                      key={comment.id} 
                      className="flex gap-2.5 items-start bg-[#faf9f5] p-2.5 rounded-2xl border border-olive/5 shadow-sm group/comment relative"
                      id={`comment-item-${comment.id}`}
                    >
                      <div className="w-6 h-6 rounded-full overflow-hidden border border-olive/15 shrink-0 bg-[#e4e2db]">
                        <img 
                          src={comment.userAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"} 
                          alt={comment.userName} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1 mb-0.5">
                          <span className="text-[10px] font-bold text-stone-700 truncate">{comment.userName}</span>
                          <span className="text-[8px] text-stone-400 shrink-0 font-mono">{formatRelativeTime(comment.timestamp)}</span>
                        </div>
                        <p className="text-[11px] text-stone-600 font-light leading-relaxed break-words pr-4">
                          {comment.text}
                        </p>
                      </div>

                      {/* Delete button for user's own comments */}
                      {comment.userId === CURRENT_USER.id && (
                        <button
                          type="button"
                          onClick={() => deleteCommentForGathering(comment.id, gathering.id)}
                          className="absolute top-2 right-2 text-stone-300 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-all opacity-0 group-hover/comment:opacity-100 focus:opacity-100 focus:outline-none"
                          aria-label="Delete comment"
                          title="Delete your comment"
                          id={`comment-delete-btn-${comment.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add comment field */}
              <div className="flex gap-2 items-center" id={`comments-form-${gathering.id}`}>
                <div className="w-6 h-6 rounded-full overflow-hidden border border-olive/15 shrink-0 bg-[#e4e2db]">
                  <img src={CURRENT_USER.avatar} alt={CURRENT_USER.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 relative flex items-center">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handlePostComment();
                      }
                    }}
                    placeholder="Ask a question or say hello..."
                    className="w-full pl-3 pr-8 py-1.5 bg-stone-50 border border-olive/10 rounded-xl text-xs placeholder:text-stone-400 text-stone-800 font-light focus:outline-none focus:ring-1 focus:ring-olive/40 focus:border-olive/20"
                    id={`comments-input-${gathering.id}`}
                  />
                  <button
                    type="button"
                    onClick={handlePostComment}
                    disabled={!newCommentText.trim()}
                    className="absolute right-1 p-1 rounded-full text-olive hover:bg-olive/5 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Post comment"
                    id={`comments-post-btn-${gathering.id}`}
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Get Reminded Toggle section */}
        <div className="py-2 px-3.5 bg-[#f6f5f0] rounded-2xl border border-olive/5 flex items-center justify-between gap-4 mt-1 mb-2.5" id={`reminder-bar-${gathering.id}`}>
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1">
              <Clock className="w-3 h-3 text-olive shrink-0" /> Get Reminded (-1h)
            </span>
            <span className="text-[9px] text-[#8c8a7c] mt-0.5 leading-none">
              Notify 1 hour before event
            </span>
          </div>
          <div className="flex items-center gap-1 bg-[#eae8e0]/60 p-0.5 rounded-lg border border-stone-200/20">
            {/* Email Toggle Button */}
            <button
              onClick={() => onToggleReminder('email')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-all ${
                reminders.email 
                  ? 'bg-olive text-[#f6f5f0] shadow-xs' 
                  : 'text-stone-400 hover:text-stone-650 hover:bg-white/50'
              }`}
              title="Toggle 1-hour before Email reminder"
              id={`toggle-email-remind-${gathering.id}`}
            >
              <Mail className="w-3 h-3" />
            </button>
            
            {/* Push/Notification Toggle Button */}
            <button
              onClick={() => onToggleReminder('push')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-all ${
                reminders.push 
                  ? 'bg-olive text-[#f6f5f0] shadow-xs' 
                  : 'text-stone-400 hover:text-stone-650 hover:bg-white/50'
              }`}
              title="Toggle 1-hour before Push notification"
              id={`toggle-push-remind-${gathering.id}`}
            >
              <Bell className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => onRSVP(isAttending ? 'not_attending' : 'attending')}
            className={`flex-1 py-3 rounded-2xl text-sm font-medium transition-all duration-300 ${isAttending ? 'bg-olive text-warm-white' : 'bg-warm-bg hover:bg-olive hover:text-warm-white'}`}
          >
            {isAttending ? 'Attending' : 'Join'} • {gathering.attendeeIds.length}/{gathering.capacity}
          </button>
          {!isAttending && (
            <button 
              onClick={() => onRSVP(isMaybe ? 'not_attending' : 'maybe')}
              className={`px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300 ${isMaybe ? 'bg-olive/20 text-olive' : 'bg-warm-bg hover:bg-olive/10 hover:text-olive'}`}
              title="Maybe"
            >
              Maybe
            </button>
          )}
        </div>

        {/* Share to Community native OS share button */}
        <button
          type="button"
          onClick={() => handleShare('native')}
          className={`w-full mt-2 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 border border-olive/15 ${
            communitySharedCopied 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs' 
              : 'bg-olive/5 hover:bg-olive/10 text-olive active:scale-98 font-bold'
          }`}
          id={`share-to-community-btn-${gathering.id}`}
          title="Share gathering with friends via messaging apps"
        >
          <Share2 className="w-3.5 h-3.5" />
          {communitySharedCopied ? 'Link Copied!' : 'Share to Community'}
        </button>

        {/* Sync to Google/Apple Calendar Button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); exportToIcs(gathering); }}
          className="w-full mt-2 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 border border-olive/15 bg-olive/5 hover:bg-olive/10 text-olive active:scale-98 font-bold"
          id={`sync-calendar-btn-${gathering.id}`}
          title="Sync to Google/Apple Calendar (.ics)"
        >
          <Calendar className="w-3.5 h-3.5 text-olive" />
          Sync to Google/Apple Calendar
        </button>

        {/* Add to Apple/Google Wallet Button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsWalletModalOpen(true); }}
          className="w-full mt-2 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 border border-[#808000]/25 bg-[#808000]/7 hover:bg-[#808000]/15 text-olive active:scale-98 font-bold font-sans"
          id={`add-wallet-btn-${gathering.id}`}
          title="Add gathering ticket as a digital pass to your Apple or Google Wallet"
        >
          <Wallet className="w-3.5 h-3.5 text-olive" />
          Add to Apple/Google Wallet
        </button>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {isQrModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id={`qr-modal-${gathering.id}`}>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsQrModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-[#faf8f5] w-full max-w-sm rounded-[32px] p-8 overflow-hidden shadow-2xl border border-olive/10 flex flex-col items-center text-center"
              id={`qr-modal-content-${gathering.id}`}
            >
              {triggerConfettiSection && <ConfettiStream />}
              {/* Close Button */}
              <button 
                type="button" 
                onClick={() => {
                  stopScanning();
                  setIsQrModalOpen(false);
                }}
                className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-olive hover:bg-olive/5 transition-all"
                aria-label="Close QR Code Dialog"
                id={`qr-modal-close-btn-${gathering.id}`}
              >
                <X className="w-5 h-5" />
              </button>

              {/* Unified Header with the QR Info Trigger always available */}
              <div className="w-full flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-olive/5 flex items-center justify-center mb-3">
                  {isScanning ? (
                    <Camera className="w-6 h-6 text-olive animate-pulse" />
                  ) : (
                    <QrCodeIcon className="w-6 h-6 text-olive" />
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 mb-1" id={`qr-title-container-${gathering.id}`}>
                  <h3 className="serif text-2xl text-gray-800">
                    {isScanning ? "Scan Gathering" : "Scan to Join"}
                  </h3>
                  <div className="relative flex items-center">
                    <style>{`
                      @keyframes keyframe-ring-pulse {
                        0% {
                          box-shadow: 0 0 0 0 rgba(128, 128, 0, 0.5);
                          transform: scale(1);
                        }
                        50% {
                          box-shadow: 0 0 0 10px rgba(128, 128, 0, 0.15);
                          transform: scale(1.05);
                        }
                        100% {
                          box-shadow: 0 0 0 0 rgba(128, 128, 0, 0);
                          transform: scale(1);
                        }
                      }
                      @keyframes dash-flow {
                        to {
                          stroke-dashoffset: -16;
                        }
                      }
                      @keyframes arrow-bob {
                        0%, 100% {
                          transform: translate(0, 0) scale(1);
                        }
                        50% {
                          transform: translate(3px, 3px) scale(1.05);
                        }
                      }
                    `}</style>

                    {/* Subtle directional arrow/curve leading towards the 'Help Guide' tab button */}
                    {qrActiveTab !== 'help' && !isScanning && (
                      <div className="absolute top-4 left-6 w-48 h-20 pointer-events-none z-10 hidden sm:block overflow-visible select-none">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 160 80">
                          <path
                            d="M 10 5 C 60 10, 110 25, 142 58"
                            fill="none"
                            stroke="#808000"
                            strokeOpacity="0.45"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                            style={{ animation: 'dash-flow 1.8s linear infinite' }}
                          />
                          {/* Rich animated Arrowhead */}
                          <path
                            d="M 134 57 L 144 60 L 142 50"
                            fill="none"
                            stroke="#808000"
                            strokeOpacity="0.75"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ animation: 'arrow-bob 1.5s ease-in-out infinite' }}
                          />
                          {/* Mini guidance label overlaying the curve */}
                          <text
                            x="75"
                            y="25"
                            fill="#808000"
                            fillOpacity="0.85"
                            className="serif text-[9px] font-bold tracking-wider select-none"
                            textAnchor="middle"
                          >
                            Click to View Guide
                          </text>
                        </svg>
                      </div>
                    )}

                    {(() => {
                      const maxTempScale = 45;
                      const safeTempScale = 37.5;
                      const coolingProgress = Math.max(0, Math.min(100, Math.round(((maxTempScale - battery.temperature) / (maxTempScale - safeTempScale)) * 100)));
                      const estSeconds = Math.max(0, Math.ceil((battery.temperature - 37.5) / 0.533));

                      return (
                        <div className="flex items-center gap-1.5" id={`qr-actions-inner-container-${gathering.id}`}>
                          <button
                            type="button"
                          onClick={() => {
                            setShowHelpTooltip(!showHelpTooltip);
                            if (qrActiveTab !== 'help') {
                              setQrActiveTab('help');
                            }
                          }}
                          onMouseEnter={() => {
                            setIsInfoHovered(true);
                            if (!showBatteryBreakdown) {
                              setShowHelpTooltip(true);
                            }
                          }}
                          onMouseLeave={() => {
                            setIsInfoHovered(false);
                            setShowHelpTooltip(false);
                          }}
                          style={{
                            animation: showHelpTooltip || isInfoHovered ? "none" : "keyframe-ring-pulse 2.2s infinite ease-in-out"
                          }}
                          className={`p-1.5 rounded-full transition-all duration-300 focus:outline-none relative ${
                            showHelpTooltip 
                              ? 'bg-olive text-warm-white ring-4 ring-olive/25 scale-110 shadow-md shadow-olive/10' 
                              : battery.temperature >= 38
                                ? 'bg-orange-50 text-orange-600 ring-4 ring-orange-500/20 scale-105 border border-orange-250 hover:bg-orange-100'
                                : battery.level < 0.15
                                  ? 'bg-rose-50 text-rose-500 ring-4 ring-rose-500/20 scale-105 border border-rose-250 animate-pulse'
                                  : isInfoHovered 
                                    ? 'bg-olive text-warm-white scale-110 shadow-md ring-4 ring-olive/20'
                                    : 'text-stone-400 hover:text-olive hover:bg-olive/8'
                          }`}
                          aria-label="Scan instructions info"
                          id="qr-info-trigger-gathering-card"
                          title={battery.temperature >= 38 ? `Device Overheated! Cooling in progress towards normal level: ~${estSeconds}s remaining` : undefined}
                        >
                          {/* Rich visually prominent pulsing beacon that represents a guide connection link */}
                          {qrActiveTab !== 'help' && (
                            <>
                              <span className="absolute inset-0 rounded-full bg-olive/35 animate-ping opacity-75 scale-150 pointer-events-none" />
                              <span className="absolute -inset-1 rounded-full border border-olive/30 animate-pulse pointer-events-none" style={{ animationDuration: '1.2s' }} />
                            </>
                          )}
                          <Info className="w-4 h-4 relative z-10" />

                          {lifetimeScans > 0 && (
                            <span 
                              className="absolute -bottom-1 -right-1 bg-olive text-warm-white text-[8px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-xs text-center leading-none"
                              id={`qr-total-scans-badge-${gathering.id}`}
                              title={`${lifetimeScans} gatherings joined via QR code`}
                            >
                              {lifetimeScans}
                            </span>
                          )}

                          {scanStreak > 0 && (
                            <span 
                              className="absolute -top-1.5 -right-1.5 bg-[#e25822] text-white text-[8px] font-extrabold px-1 min-w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-xs text-center leading-none"
                              id={`qr-scan-streak-badge-${gathering.id}`}
                              title={`Scan Streak: ${scanStreak} gatherings joined`}
                            >
                              🔥{scanStreak}
                            </span>
                          )}

                          {/* Countdown & Progress overlay directly on the info trigger button when T >= 38°C */}
                          {battery.temperature >= 38 && (
                            <span className="absolute inset-0 flex flex-col items-center justify-center bg-orange-600 text-white rounded-full text-[7.5px] font-extrabold transition-all duration-300 shadow-inner overflow-hidden">
                              {isScanning ? (
                                <Thermometer className="w-3.5 h-3.5 animate-pulse text-white" />
                              ) : (
                                <span className="font-mono tracking-tighter leading-none">{estSeconds}s</span>
                              )}
                              {/* Sub-pixel bottom progress bar overlay relative to safe temperature progress */}
                              <span className="absolute bottom-0 left-0 w-full h-[3px] bg-white/20">
                                <span 
                                  className="h-full bg-white block transition-all duration-500 ease-out"
                                  style={{ width: `${coolingProgress}%` }}
                                />
                              </span>
                            </span>
                          )}
                      
                      {/* Unified Battery & Camera Status Badge */}
                      <span 
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          if (batteryHoverTimeoutRef.current) {
                            clearTimeout(batteryHoverTimeoutRef.current);
                          }
                          setShowBatteryBreakdown(true);
                          setShowHelpTooltip(false);
                        }}
                        onMouseLeave={(e) => {
                          e.stopPropagation();
                          batteryHoverTimeoutRef.current = setTimeout(() => {
                            setShowBatteryBreakdown(false);
                          }, 300);
                        }}
                        className={`absolute -top-2.5 -right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-extrabold shadow-sm ring-2 ring-[#faf8f5] transition-all duration-300 cursor-pointer ${
                          battery.temperature >= 38
                            ? 'bg-orange-600 text-white animate-pulse'
                            : battery.level < 0.15
                              ? 'bg-rose-600 text-white animate-pulse'
                              : battery.level <= 0.25 && !battery.charging
                                ? 'bg-rose-500 text-white animate-pulse'
                                : batterySaver
                                  ? 'bg-emerald-600 text-white animate-pulse'
                                  : isScanning
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-stone-100 text-stone-600 border border-stone-200'
                        }`}
                        title={`Battery: ${Math.round(battery.level * 100)}%${battery.charging ? ' (Charging)' : ''} | Temp: ${battery.temperature}°C | Camera: ${isScanning ? 'Active' : 'Ready'}${batterySaver ? ' | Battery Saver: Active' : ''}`}
                        id={`qr-status-badge-${gathering.id}`}
                      >
                        {/* Battery Saver active mini label */}
                        {batterySaver && (
                          <span className="text-[6px] font-mono font-extrabold px-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 shrink-0 uppercase tracking-tight">ECO</span>
                        )}

                        {/* Camera green pulse dot if scanning */}
                        {isScanning && (
                          <span className="relative flex h-1.5 w-1.5 mr-0.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                          </span>
                        )}

                        {/* Thermal Warning Icon when throttling is active */}
                        {isEcoThrottling && (
                          <Thermometer className="w-2.5 h-2.5 shrink-0 text-white animate-pulse" title={`Thermal control active: ${battery.temperature}°C`} />
                        )}

                        {/* Battery Icon with charging indicator */}
                        {battery.charging ? (
                           <BatteryCharging className="w-2.5 h-2.5 shrink-0" />
                        ) : battery.level <= 0.25 ? (
                          <motion.span
                            animate={
                              battery.level < 0.15
                                ? {
                                    color: ["#ffffff", "#fca5a5", "#ef4444", "#ffffff"],
                                    scale: [1, 1.3, 1.3, 1],
                                  }
                                : {}
                            }
                            transition={
                              battery.level < 0.15
                                ? {
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                  }
                                : undefined
                            }
                            className="inline-flex shrink-0"
                          >
                            <BatteryWarning className="w-2.5 h-2.5 shrink-0" />
                          </motion.span>
                        ) : (
                          <Battery className="w-2.5 h-2.5 shrink-0" />
                        )}

                        {/* Sleek dynamic charge bar */}
                        <span 
                          className={`w-5 h-1.5 rounded-full p-[1px] overflow-hidden flex items-center border ${
                            battery.level < 0.15 || battery.temperature >= 38 || (battery.level <= 0.25 && !battery.charging) || isScanning
                              ? 'bg-white/20 border-white/30'
                              : 'bg-stone-250 bg-stone-200 border-stone-300/60'
                          }`}
                          aria-hidden="true"
                          id={`qr-battery-bar-${gathering.id}`}
                        >
                          <span 
                            className={`h-full rounded-full transition-all duration-500 ease-out ${
                              battery.level < 0.15 || battery.temperature >= 38 || (battery.level <= 0.25 && !battery.charging) || isScanning
                                ? 'bg-white'
                                : battery.level < 0.15
                                  ? 'bg-rose-500'
                                  : battery.level <= 0.25
                                    ? 'bg-amber-500'
                                    : battery.charging
                                      ? 'bg-sky-500'
                                      : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max(10, battery.level * 100)}%` }}
                          />
                        </span>

                        <span className="tracking-tighter leading-none">
                          {Math.round(battery.level * 100)}%
                        </span>
                      </span>
                       {/* Battery breakdown tooltip */}
                      <AnimatePresence>
                        {showBatteryBreakdown && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -8 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            className="absolute -top-[485px] -right-3 w-56 max-h-[450px] overflow-y-auto scrollbar-thin bg-stone-950/95 backdrop-blur-md text-stone-200 p-3.5 rounded-2xl border border-[#808000]/40 shadow-2xl z-[60] text-left font-sans flex flex-col gap-2 pointer-events-auto"
                            id={`qr-battery-breakdown-${gathering.id}`}
                            onMouseEnter={() => {
                              if (batteryHoverTimeoutRef.current) {
                                clearTimeout(batteryHoverTimeoutRef.current);
                              }
                            }}
                            onMouseLeave={() => {
                              setShowBatteryBreakdown(false);
                            }}
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-stone-850 pb-1.5">
                              <span className="text-[9px] font-extrabold text-[#808000] uppercase tracking-wider flex items-center gap-1">
                                <Battery className="w-2.5 h-2.5 text-[#808000]" /> Power Diagnostic
                              </span>
                              <span className="text-[7.5px] font-bold text-stone-400 font-mono bg-stone-900 border border-stone-850 px-1 py-0.2 rounded">
                                Li-Ion 3.82V
                              </span>
                            </div>

                            {/* Battery Health Metric */}
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between items-center text-[8.5px]">
                                <span className="text-stone-400 flex items-center gap-1">
                                  <Heart className="w-2.5 h-2.5 text-stone-400 shrink-0" /> Battery Health
                                </span>
                                <span className="font-extrabold text-stone-100">96.0% (Peak)</span>
                              </div>
                              <div className="w-full h-1 bg-stone-850 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '96%' }} />
                              </div>
                            </div>

                            {/* Estimated Runtime Metric */}
                            <div className="flex flex-col gap-0.5">
                              <div className="flex justify-between items-center text-[8.5px]">
                                <span className="text-stone-400 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 text-stone-400 shrink-0" /> Rest Est. Usage
                                </span>
                                <span className="font-extrabold text-white font-mono shrink-0">
                                  {battery.charging 
                                    ? "Full (~45 mins)" 
                                    : (() => {
                                        const hrs = !isScanning 
                                          ? battery.level * 9.5 
                                          : isSmartSaver 
                                            ? (battery.level < 0.15 
                                                ? battery.level * 8.5 
                                                : battery.level < 0.25 
                                                  ? battery.level * 7.5 
                                                  : battery.level < 0.45 
                                                    ? battery.level * 6.5 
                                                    : battery.level < 0.70 
                                                      ? battery.level * 5.5 
                                                      : battery.level * 5.0) 
                                            : isEcoThrottling 
                                              ? battery.level * 6.5 
                                              : battery.level * 4.8;
                                        const h = Math.floor(hrs);
                                        const m = Math.round((hrs % 1) * 60);
                                        return `${h}h ${m}m`;
                                      })()
                                  }
                                </span>
                              </div>
                            </div>

                            {/* Smart Saver Preset Toggle */}
                            <div className="mt-0.5 pt-1.5 border-t border-stone-850">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex flex-col text-left font-sans flex-1">
                                  <span className="font-extrabold text-[9px] text-[#808000] uppercase tracking-wider flex items-center gap-1">
                                    <Zap className={`w-2.5 h-2.5 text-[#808000] ${isSmartSaver && isScanning ? 'animate-pulse' : ''}`} /> Smart Saver
                                  </span>
                                  <span className="text-[8px] text-stone-400 mt-0.5 leading-tight">
                                    {isSmartSaver 
                                      ? "Adjusts FPS dynamically" 
                                      : "Manual scanning performance"}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsSmartSaver(!isSmartSaver);
                                  }}
                                  className={`relative inline-flex h-4 w-7.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    isSmartSaver ? 'bg-olive' : 'bg-stone-800'
                                  }`}
                                  role="switch"
                                  aria-checked={isSmartSaver}
                                  id={`smart-saver-toggle-${gathering.id}`}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                      isSmartSaver ? 'translate-x-3.5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Thermal History Section */}
                            <div className="mt-0.5 pt-1.5 border-t border-stone-850 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-extrabold text-[#e05638] uppercase tracking-wider flex items-center gap-1">
                                  <Thermometer className="w-2.5 h-2.5 text-[#e05638]" /> Thermal History
                                </span>
                                <span className="text-[7.5px] font-bold text-stone-300 font-mono bg-stone-900 border border-stone-850 px-1 rounded">
                                  {battery.temperature}°C
                                </span>
                              </div>

                              {/* Interactive Env Preset Selector */}
                              <div className="grid grid-cols-3 gap-0.5 bg-stone-900/80 p-0.5 rounded-lg border border-stone-850">
                                {(['sun', 'shade', 'ac'] as const).map((e) => {
                                  const isActive = selectedScanEnv === e;
                                  const icons = { sun: '☀️', shade: '🌳', ac: '❄️' };
                                  const names = { sun: 'Sun', shade: 'Shade', ac: 'AC' };
                                  return (
                                    <button
                                      key={e}
                                      type="button"
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        setSelectedScanEnv(e);
                                      }}
                                      className={`py-0.5 rounded text-[7px] font-extrabold transition-all outline-none text-center cursor-pointer ${
                                        isActive
                                          ? 'bg-amber-600/25 text-amber-300 border border-amber-500/30'
                                          : 'text-stone-400 hover:text-stone-300 border border-transparent'
                                      }`}
                                    >
                                      {icons[e]} {names[e]}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Live Sparkline Area Chart */}
                              {(() => {
                                const getThermalPath = () => {
                                  if (!thermalHistory || thermalHistory.length === 0) return '';
                                  const minT = 30;
                                  const maxT = 46;
                                  const w = 180;
                                  const h = 24;
                                  const points = thermalHistory.map((val, idx) => {
                                    const x = (idx / (thermalHistory.length - 1)) * w;
                                    const y = h - ((val - minT) / (maxT - minT)) * h;
                                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                                  });
                                  return `M ${points.join(' L ')}`;
                                };

                                const getThermalAreaPath = () => {
                                  if (!thermalHistory || thermalHistory.length === 0) return '';
                                  const minT = 30;
                                  const maxT = 46;
                                  const w = 180;
                                  const h = 24;
                                  const points = thermalHistory.map((val, idx) => {
                                    const x = (idx / (thermalHistory.length - 1)) * w;
                                    const y = h - ((val - minT) / (maxT - minT)) * h;
                                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                                  });
                                  return `M 0,${h} L ${points.join(' L ')} L ${w},${h} Z`;
                                };

                                return (
                                  <div className="bg-stone-900 border border-stone-850 p-1.5 rounded-xl flex flex-col gap-0.5 animate-fade-in">
                                    <div className="flex justify-between items-center text-[7.5px] text-stone-500 font-medium">
                                      <span>Overheat Spike Profile</span>
                                      <span className="font-mono text-[7px]">30°C - 46°C</span>
                                    </div>
                                    <div className="relative h-[24px] w-[180px] self-center">
                                      <svg className="w-full h-full overflow-visible" viewBox="0 0 180 24">
                                        <defs>
                                          <linearGradient id="thermal-gradient-chart" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                                          </linearGradient>
                                        </defs>
                                        {/* Dash horizontal bounds */}
                                        <line x1="0" y1="3.5" x2="180" y2="3.5" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.15" />
                                        <line x1="0" y1="12" x2="180" y2="12" stroke="#eab308" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.1" />
                                        <line x1="0" y1="20.5" x2="180" y2="20.5" stroke="#22c55e" strokeWidth="0.5" opacity="0.08" />

                                        {/* Area fill */}
                                        <path d={getThermalAreaPath()} fill="url(#thermal-gradient-chart)" className="transition-all duration-300" />
                                        {/* Line path */}
                                        <path d={getThermalPath()} fill="none" stroke="#f43f5e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300" />
                                        
                                        {/* Dynamic current value indicator marker */}
                                        {thermalHistory.length > 0 && (() => {
                                          const lastVal = thermalHistory[thermalHistory.length - 1];
                                          const minT = 30;
                                          const maxT = 46;
                                          const x = 180;
                                          const y = 24 - ((lastVal - minT) / (maxT - minT)) * 24;
                                          return (
                                            <g>
                                              <circle cx={x} cy={y} r="2.5" fill="#f43f5e" />
                                              <circle cx={x} cy={y} r="1" fill="#fff" />
                                            </g>
                                          );
                                        })()}
                                      </svg>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Relative environment spikes indicators */}
                              <div className="flex flex-col gap-1 mt-0.5">
                                {/* Env Compare: Sun */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex justify-between items-center text-[7.5px] leading-tight">
                                    <span className={`${selectedScanEnv === 'sun' ? 'text-amber-300 font-extrabold' : 'text-stone-400'}`}>
                                      Direct Sun ☀️
                                    </span>
                                    <span className="font-extrabold text-orange-500 font-mono">45.0°C Peak</span>
                                  </div>
                                  <div className="w-full h-1 bg-stone-900 rounded-full overflow-hidden relative">
                                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-400 to-red-600 rounded-full transition-all duration-500" style={{ width: '92%' }} />
                                  </div>
                                </div>

                                {/* Env Compare: Shade */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex justify-between items-center text-[7.5px] leading-tight">
                                    <span className={`${selectedScanEnv === 'shade' ? 'text-amber-300 font-extrabold' : 'text-stone-300'}`}>
                                      Outdoor Shade 🌳
                                    </span>
                                    <span className="font-extrabold text-amber-500 font-mono">41.0°C Peak</span>
                                  </div>
                                  <div className="w-full h-1 bg-stone-900 rounded-full overflow-hidden relative">
                                    <div className="absolute inset-y-0 left-0 bg-amber-500 rounded-full transition-all duration-500" style={{ width: '68%' }} />
                                  </div>
                                </div>

                                {/* Env Compare: AC */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex justify-between items-center text-[7.5px] leading-tight">
                                    <span className={`${selectedScanEnv === 'ac' ? 'text-amber-300 font-extrabold' : 'text-stone-400'}`}>
                                      Indoor AC Lab ❄️
                                    </span>
                                    <span className="font-extrabold text-emerald-500 font-mono">34.0°C Peak</span>
                                  </div>
                                  <div className="w-full h-1 bg-stone-900 rounded-full overflow-hidden relative">
                                    <div className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-500" style={{ width: '25%' }} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Components active and estimated draws */}
                            <div className="flex flex-col gap-1 border-t border-stone-850 pt-1.5">
                              <span className="text-[7.5px] font-extrabold text-stone-500 uppercase tracking-widest flex items-center gap-1">
                                <Activity className="w-2.5 h-2.5 text-stone-500" /> Active Consumers
                              </span>
                              
                              <div className="space-y-1">
                                {/* Component 1: Camera sensor */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex justify-between text-[8px] font-mono leading-none">
                                    <span className="text-stone-400">Camera Feed</span>
                                    <span className={isScanning ? "text-[#808000] font-bold" : "text-stone-500"}>
                                      {isScanning ? "24% load" : "Standby"}
                                    </span>
                                  </div>
                                  <div className="w-full h-1 bg-stone-900 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${isScanning ? "bg-[#808000]" : "bg-stone-750"}`} 
                                      style={{ width: isScanning ? '24%' : '1%' }} 
                                    />
                                  </div>
                                </div>

                                {/* Component 2: VQR Code Decoders */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex justify-between text-[8px] font-mono leading-none">
                                    <span className="text-stone-400">VQR Decoders</span>
                                    <span className={isScanning ? (isSmartSaver ? "text-olive font-bold" : isEcoThrottling ? "text-amber-500 font-bold" : "text-emerald-500 font-bold") : "text-stone-500"}>
                                      {isScanning 
                                        ? isSmartSaver 
                                          ? (battery.level < 0.15 ? "Eco-Throttled (2.5 FPS)"
                                             : battery.level < 0.25 ? "Power Save (4 FPS)"
                                             : battery.level < 0.45 ? "Sustained (7 FPS)"
                                             : battery.level < 0.70 ? "Balanced (12 FPS)"
                                             : battery.level < 0.85 ? "Optimal (20 FPS)"
                                             : "Super Max (30 FPS)")
                                          : isEcoThrottling 
                                            ? "Throttled (3 FPS)" 
                                            : "Active (25 FPS)" 
                                        : "Idle"}
                                    </span>
                                  </div>
                                  <div className="w-full h-1 bg-stone-900 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        isScanning 
                                          ? isSmartSaver 
                                            ? "bg-olive"
                                            : isEcoThrottling 
                                              ? "bg-amber-500" 
                                              : "bg-emerald-500" 
                                          : "bg-stone-750"
                                      }`} 
                                      style={{ 
                                        width: isScanning 
                                          ? isSmartSaver 
                                            ? (battery.level < 0.15 ? '5%' 
                                               : battery.level < 0.25 ? '8%' 
                                               : battery.level < 0.45 ? '12%' 
                                               : battery.level < 0.70 ? '16%' 
                                               : battery.level < 0.85 ? '18%' 
                                               : '22%')
                                            : isEcoThrottling 
                                              ? '6%' 
                                              : '18%' 
                                          : '0%' 
                                      }} 
                                    />
                                  </div>
                                </div>

                                {/* Component 3: Screen Backlight */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex justify-between text-[8px] font-mono leading-none">
                                    <span className="text-stone-400">Display (TFT)</span>
                                    <span className="text-stone-300">Active (35%)</span>
                                  </div>
                                  <div className="w-full h-1 bg-stone-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-stone-500 rounded-full" style={{ width: '35%' }} />
                                  </div>
                                </div>

                                {/* Component 4: System Bus / Sensors */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex justify-between text-[8px] font-mono leading-none">
                                    <span className="text-stone-400">System Core</span>
                                    <span className="text-stone-300 font-bold">Active (8%)</span>
                                  </div>
                                  <div className="w-full h-1 bg-stone-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#808000] rounded-full" style={{ width: '8%' }} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Interactive Power & Action Log View */}
                            <div className="mt-1.5 pt-1.5 border-t border-stone-850 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[7.5px] font-extrabold text-[#808000] uppercase tracking-wider flex items-center gap-1">
                                  <History className="w-2.5 h-2.5 text-[#808000]" /> Diagnostics Log
                                </span>
                                {/* Filter badges */}
                                <div className="flex gap-0.5">
                                  {(['All', 'Sys', 'Pwr', 'Thm'] as const).map(cat => {
                                    const isActive = activeLogFilter === cat;
                                    return (
                                      <button
                                        key={cat}
                                        type="button"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          setActiveLogFilter(cat);
                                        }}
                                        className={`px-1 py-0.2 rounded text-[6.5px] font-extrabold transition-all cursor-pointer ${
                                          isActive
                                            ? 'bg-olive text-white border border-[#808000]/60'
                                            : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-transparent'
                                        }`}
                                      >
                                        {cat}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="bg-stone-900/90 border border-stone-850 rounded-lg p-1 max-h-[85px] overflow-y-auto flex flex-col gap-0.5 scrollbar-thin select-none">
                                {(() => {
                                  const filtered = diagnosticLogs.filter(log => {
                                    if (activeLogFilter === 'All') return true;
                                    if (activeLogFilter === 'Sys' && log.category === 'System') return true;
                                    if (activeLogFilter === 'Pwr' && log.category === 'Power') return true;
                                    if (activeLogFilter === 'Thm' && log.category === 'Thermal') return true;
                                    return false;
                                  });

                                  if (filtered.length === 0) {
                                    return <span className="text-[7px] text-stone-500 italic p-1">No matching logs.</span>;
                                  }

                                  return filtered.map(log => {
                                    const isExpanded = expandedLogId === log.id;
                                    return (
                                      <div
                                        key={log.id}
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          setExpandedLogId(isExpanded ? null : log.id);
                                        }}
                                        className={`p-1 rounded transition-colors cursor-pointer text-left hover:bg-stone-800 ${
                                          isExpanded ? 'bg-stone-800/90 border-l-2 border-olive' : 'bg-transparent'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between text-[7px] leading-tight">
                                          <div className="flex items-center gap-1 min-w-0">
                                            <span className="font-mono text-stone-500 text-[6px] shrink-0">{log.time}</span>
                                            <span className="font-bold text-stone-200 truncate">{log.action}</span>
                                          </div>
                                          <span className={`font-mono font-extrabold shrink-0 pl-1 ${log.color}`}>
                                            {log.impact}
                                          </span>
                                        </div>
                                        {isExpanded && (
                                          <div className="mt-0.5 pt-0.5 text-[6.5px] text-stone-350 border-t border-stone-850 leading-normal animate-fade-in">
                                            {log.details}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>

                              <div className="flex justify-between items-center text-[6px] text-stone-500">
                                <span>Click entries to expand</span>
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setDiagnosticLogs([
                                      {
                                        id: `purge-${Date.now()}`,
                                        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                                        action: 'Subsystem Purge',
                                        category: 'System',
                                        impact: '0.00% / min',
                                        color: 'text-stone-400',
                                        details: 'Diagnostics buffer purged manually. Standby monitoring active.'
                                      }
                                    ]);
                                  }}
                                  className="text-[#808000] font-bold hover:underline cursor-pointer"
                                >
                                  Reset Log
                                </button>
                              </div>
                            </div>

                            {/* Floating arrow/tick indicator */}
                            <div className="absolute top-full right-5 border-x-4 border-x-transparent border-t-4 border-t-stone-950/95" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Visual Thermal warning pop advice inside the #qr-info-trigger- element itself */}
                      {battery.temperature >= 38 && (
                        <span 
                          id={`qr-thermal-urgent-warning-${gathering.id}`}
                          className="absolute -bottom-7.5 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-md border border-orange-500 animate-pulse flex items-center gap-1.5 whitespace-nowrap z-45 shadow-md font-sans"
                          title="High device heat detected! Cool device recommended."
                        >
                          <Thermometer className="w-2.5 h-2.5 text-white animate-pulse" />
                          <span>Advised: Cool device before continuing</span>
                        </span>
                      )}
                    </button>

                    {/* Quick Share Button next to the info button inside the card trigger area */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const shareUrl = `${window.location.origin}${window.location.pathname}?gatheringId=${gathering.id}`;
                        navigator.clipboard.writeText(shareUrl).then(() => {
                          setQuickShareCopied(true);
                          setTimeout(() => setQuickShareCopied(false), 2000);
                        });
                      }}
                      className={`p-1.5 rounded-full transition-all duration-300 focus:outline-none relative flex items-center justify-center ${
                        quickShareCopied
                          ? 'bg-emerald-50 text-emerald-600 ring-4 ring-emerald-500/25 scale-110 border border-emerald-250 shadow-md shadow-emerald-500/10'
                          : 'text-stone-400 hover:text-olive hover:bg-olive/8'
                      }`}
                      aria-label="Quick share gathering link"
                      id={`qr-quick-share-btn-gathering-card-${gathering.id}`}
                      title={quickShareCopied ? "Link copied!" : "Quick Share Link"}
                    >
                      <AnimatePresence mode="wait">
                        {quickShareCopied ? (
                          <motion.div
                            key="check"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Check className="w-4 h-4 text-emerald-600" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="share"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Share2 className="w-4 h-4" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>
                      );
                    })()}
                    <AnimatePresence>
                      {(battery.level < 0.15 || battery.temperature >= 40) && !showHelpTooltip && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.85, y: 4, x: '-50%' }}
                          animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
                          exit={{ opacity: 0, scale: 0.85, y: 4, x: '-50%' }}
                          className={`absolute bottom-full left-1/2 mb-7 w-48 text-white py-1.5 px-2.5 rounded-xl shadow-lg text-center text-[10px] font-extrabold z-40 pointer-events-none font-sans border animate-pulse flex items-center justify-center gap-1.5 ${
                            battery.temperature >= 40
                              ? 'bg-orange-600 border-orange-500'
                              : 'bg-rose-600 border-rose-500'
                          }`}
                          id={`qr-battery-warning-banner-${gathering.id}`}
                        >
                          {battery.temperature >= 40 ? (
                            <Thermometer className="w-3.5 h-3.5 text-white animate-pulse" />
                          ) : (
                            <BatteryWarning className="w-3.5 h-3.5 text-white animate-pulse" />
                          )}
                          <span>
                            {battery.temperature >= 40 
                              ? `High Heat (${battery.temperature}°C): Throttled!` 
                              : 'Battery Low: Scan may fail!'}
                          </span>
                          <div className={`absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 ${
                            battery.temperature >= 40 ? 'border-t-orange-600' : 'border-t-rose-600'
                          }`} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {showHelpTooltip && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92, y: 6, x: '-50%' }}
                          animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
                          exit={{ opacity: 0, scale: 0.92, y: 6, x: '-50%' }}
                          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                          onMouseEnter={() => setShowHelpTooltip(true)}
                          onMouseLeave={() => setShowHelpTooltip(false)}
                          className="absolute bottom-full left-1/2 mb-3.5 w-64 max-h-[420px] overflow-y-auto scrollbar-thin bg-stone-950/95 backdrop-blur-md text-stone-100 p-4 rounded-2xl shadow-xl text-left text-[11px] leading-relaxed z-50 pointer-events-auto font-sans border border-olive/30"
                          id={`qr-info-tip-${gathering.id}`}
                        >
                          <div className="font-bold text-olive mb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                              <Info className="w-3.5 h-3.5 text-olive" /> Scan Instructions
                            </span>
                          </div>
                          
                          <div className="space-y-2 mt-1">
                            <div className="flex items-start gap-2">
                              <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-olive/20 text-olive text-[9px] font-bold">1</span>
                              <p className="text-stone-300">Open your default mobile phone <strong className="text-white">Camera App</strong>.</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-olive/20 text-olive text-[9px] font-bold">2</span>
                              <p className="text-stone-300">Point the lens steadily at the displayed <strong className="text-white">QR Code</strong>.</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-olive/20 text-olive text-[9px] font-bold">3</span>
                              <p className="text-stone-300">Tap the floating notification banner to immediately view and join this community gathering!</p>
                            </div>
                          </div>

                          {/* Success Auto-Close configuration */}
                          <div className="mt-3.5 pt-3 border-t border-stone-800">
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span className="font-extrabold text-[9px] text-olive uppercase tracking-wider flex items-center gap-1.5">
                                <Settings className="w-3 h-3 text-olive" /> Auto-Close Delay
                              </span>
                              <span className="text-[9px] font-bold text-stone-400 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded-md">
                                {autoCloseDelay === 0 ? 'Manual Close' : `${autoCloseDelay / 1000}s Delay`}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                              {[0, 1000, 2000, 4000].map((delayValue) => (
                                <button
                                  key={delayValue}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAutoCloseDelay(delayValue);
                                  }}
                                  className={`py-1 rounded-lg text-[9px] font-extrabold text-center border transition-all duration-250 cursor-pointer ${
                                    autoCloseDelay === delayValue
                                      ? 'bg-olive border-olive text-warm-white shadow-xs'
                                      : 'bg-stone-900 border-stone-850 text-stone-400 hover:text-stone-200 hover:bg-stone-800/80'
                                  }`}
                                >
                                  {delayValue === 0 ? 'Instant' : `${delayValue / 1000}s`}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Auto-Low-Power Mode Toggle */}
                          <div className="mt-3.5 pt-3 border-t border-stone-800">
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex flex-col text-left font-sans flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-[9px] text-olive uppercase tracking-wider flex items-center gap-1.5">
                                    <Zap className="w-3 h-3 text-olive" /> Auto-Low-Power
                                  </span>
                                  <span className={`text-[7px] px-1 py-0.2 rounded font-extrabold font-mono uppercase tracking-wider ${
                                    forceLowPower 
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                      : 'bg-stone-900 border border-stone-800 text-stone-500'
                                  }`}>
                                    {forceLowPower ? 'Forced ON' : 'Auto (15%)'}
                                  </span>
                                </div>
                                <span className="text-[8px] text-stone-400 mt-0.5 leading-tight">
                                  Manually enforce battery-conserving 3 FPS scan mode. Overrides the automatic 15% threshold to guarantee extended battery life during long outdoor community events.
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setForceLowPower(!forceLowPower);
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  forceLowPower ? 'bg-olive' : 'bg-stone-800'
                                }`}
                                role="switch"
                                aria-checked={forceLowPower}
                                id={`auto-low-power-toggle-${gathering.id}`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    forceLowPower ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Battery Saver Mode Toggle */}
                          <div className="mt-3.5 pt-3 border-t border-stone-800" id={`battery-saver-container-${gathering.id}`}>
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex flex-col text-left font-sans flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-[9px] text-[#808000] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                    <Zap className={`w-3 h-3 text-olive ${batterySaver ? 'animate-pulse text-emerald-400' : ''}`} /> Battery Saver
                                  </span>
                                  <span className={`text-[7px] px-1 py-0.2 rounded font-extrabold font-mono uppercase tracking-wider ${
                                    batterySaver 
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                      : 'bg-stone-900 border border-stone-800 text-stone-500'
                                  }`} id={`battery-saver-badge-${gathering.id}`}>
                                    {batterySaver ? 'Energy-Efficient' : 'Performance'}
                                  </span>
                                </div>
                                <span className="text-[8px] text-stone-400 mt-0.5 leading-tight">
                                  Configure scanning mode for gathering QR codes. Off enables full-speed performance. On conserves battery at 3 FPS.
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleBatterySaver(!batterySaver);
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  batterySaver ? 'bg-emerald-650' : 'bg-stone-800'
                                }`}
                                role="switch"
                                aria-checked={batterySaver}
                                id={`battery-saver-toggle-${gathering.id}`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    batterySaver ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Auto-Pause Mode Toggle */}
                          <div className="mt-3.5 pt-3 border-t border-stone-800">
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex flex-col text-left font-sans flex-1">
                                <span className="font-extrabold text-[9px] text-olive uppercase tracking-wider flex items-center gap-1.5">
                                  <VideoOff className="w-3 h-3 text-olive" /> Auto-Pause Stream
                                </span>
                                <span className="text-[8px] text-stone-400 mt-0.5 leading-tight">
                                  Deactivates camera analysis immediately after a successful scan to prevent drain
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAutoPause(!autoPause);
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  autoPause ? 'bg-olive' : 'bg-stone-800'
                                }`}
                                role="switch"
                                aria-checked={autoPause}
                                id={`auto-pause-toggle-${gathering.id}`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    autoPause ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Smart Refresh Mode Toggle */}
                          <div className="mt-3.5 pt-3 border-t border-stone-800" id={`smart-refresh-toggle-container-${gathering.id}`}>
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex flex-col text-left font-sans flex-1">
                                <span className="font-extrabold text-[9px] text-olive uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                  <RefreshCw className={`w-3 h-3 text-olive ${smartRefresh ? 'animate-spin' : ''}`} /> Smart Refresh
                                </span>
                                <span className="text-[8px] text-stone-400 mt-0.5 leading-tight">
                                  Enables periodic automatic cache clearing of gathering data, reducing stale information during long event sessions.
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSmartRefresh(!smartRefresh);
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  smartRefresh ? 'bg-olive' : 'bg-stone-800'
                                }`}
                                role="switch"
                                aria-checked={smartRefresh}
                                id={`smart-refresh-toggle-${gathering.id}`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    smartRefresh ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Scan Chime & Vibration Feedback Toggle */}
                          <div className="mt-3.5 pt-3 border-t border-stone-800 space-y-3" id={`scan-feedback-toggle-container-${gathering.id}`}>
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex flex-col text-left font-sans flex-1">
                                <span className="font-extrabold text-[9px] text-olive uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                  <Volume2 className="w-3 h-3 text-olive" /> Scan Chime & Vibration
                                </span>
                                <span className="text-[8px] text-stone-400 mt-0.5 leading-tight">
                                  Play an auditory success chime and a haptic vibration confirmation when a QR code scan completes successfully.
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextVal = !isFeedbackEnabled;
                                  localStorage.setItem('gcommunity_scan_feedback_enabled', String(nextVal));
                                  setIsFeedbackEnabled(nextVal);
                                  window.dispatchEvent(new Event('gcommunity_feedback_settings_updated'));
                                  if (nextVal) {
                                    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                                      navigator.vibrate(40);
                                    }
                                  }
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  isFeedbackEnabled ? 'bg-olive' : 'bg-stone-800'
                                }`}
                                role="switch"
                                aria-checked={isFeedbackEnabled}
                                id={`scan-feedback-toggle-${gathering.id}`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    isFeedbackEnabled ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Precise Volume Level Slider */}
                            {isFeedbackEnabled && (
                              <div className="pt-2.5 border-t border-stone-850 flex items-center justify-between gap-3 animate-fadeIn" id={`scanner-chime-volume-row-${gathering.id}`}>
                                <span className="text-[8.5px] font-extrabold text-stone-400 uppercase tracking-widest shrink-0 font-sans">
                                  Chime Volume
                                </span>
                                <div className="flex items-center gap-2 flex-1 justify-end max-w-[160px]">
                                  <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={isScanChimeEnabled ? scanVolume : 0}
                                    disabled={!isScanChimeEnabled}
                                    onChange={(e) => {
                                      const newVol = parseFloat(e.target.value);
                                      localStorage.setItem('gcommunity_scan_volume', String(newVol));
                                      setScanVolume(newVol);
                                      window.dispatchEvent(new Event('gcommunity_volume_updated'));
                                      if (newVol > 0 && !isScanChimeEnabled) {
                                        localStorage.setItem('gcommunity_scan_chime_enabled', 'true');
                                        setIsScanChimeEnabled(true);
                                        window.dispatchEvent(new Event('gcommunity_chime_settings_updated'));
                                      }
                                    }}
                                    className={`w-full h-1 rounded-lg appearance-none cursor-pointer focus:outline-none accent-olive ${
                                      isScanChimeEnabled ? 'bg-stone-800' : 'bg-stone-900 opacity-40 cursor-not-allowed'
                                    }`}
                                    title={`Scan Success Chime Volume: ${Math.round((isScanChimeEnabled ? scanVolume : 0) * 100)}%`}
                                    id={`scan-volume-slider-scanner-${gathering.id}`}
                                    aria-label="Scan success chime volume level"
                                  />
                                  <span className={`text-[9.5px] font-mono font-bold w-8 text-right select-none ${isScanChimeEnabled ? 'text-stone-300' : 'text-stone-500'}`}>
                                    {Math.round((isScanChimeEnabled ? scanVolume : 0) * 100)}%
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Live Telemetry Status Details */}
                          <div className="mt-3.5 pt-3 border-t border-stone-800 flex items-center justify-between text-[9px]">
                            <span className="text-stone-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                              <Thermometer className="w-3 h-3 text-olive" /> Thermal Sensors
                            </span>
                            <span className={`font-bold flex items-center gap-1.5 px-1.5 py-0.5 rounded-md ${
                              battery.temperature >= 40 
                                ? 'bg-orange-950/60 text-orange-400 border border-orange-500/30 animate-pulse' 
                                : battery.temperature >= 37 
                                  ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20' 
                                  : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {battery.temperature}°C 
                              {battery.temperature >= 40 ? ' (High Heat)' : ' (Cool)'}
                            </span>
                          </div>

                          {/* Real-time Battery Consumption Sparkline */}
                          <div className="mt-3.5 pt-3 border-t border-stone-800">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-extrabold text-[9px] text-olive uppercase tracking-wider flex items-center gap-1.5">
                                <Battery className="w-3 h-3 text-olive" /> Scan Power History
                              </span>
                              <span className="text-[8.5px] text-stone-400 font-mono">
                                Rate: {battery.charging ? '+' : '-'}{isEcoThrottling ? '0.6%/m' : '2.4%/m'}
                              </span>
                            </div>
                            
                            <div className="h-10 w-full bg-stone-900/60 border border-stone-800/80 rounded-xl p-1.5 flex items-center justify-center relative overflow-hidden">
                              {batteryHistory.length > 1 ? (() => {
                                const min = Math.min(...batteryHistory);
                                const max = Math.max(...batteryHistory);
                                const range = max - min === 0 ? 1 : max - min;
                                
                                const width = 220;
                                const height = 26;
                                const points = batteryHistory.map((val, idx) => {
                                  const x = (idx / (batteryHistory.length - 1)) * width;
                                  const y = height - ((val - min) / range) * height;
                                  return { x, y, val };
                                });
                                
                                const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
                                
                                return (
                                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" id={`sparkline-svg-${gathering.id}`}>
                                    <defs>
                                      <linearGradient id={`sparkline-grad-${gathering.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#808000" stopOpacity="0.45" />
                                        <stop offset="100%" stopColor="#808000" stopOpacity="0.0" />
                                      </linearGradient>
                                    </defs>
                                    <path d={areaD} fill={`url(#sparkline-grad-${gathering.id})`} />
                                    <path 
                                      d={pathD} 
                                      fill="none" 
                                      stroke="#808000" 
                                      strokeWidth="1.5" 
                                      strokeLinecap="round" 
                                      strokeLinejoin="round" 
                                    />
                                    <circle 
                                      cx={points[points.length - 1].x} 
                                      cy={points[points.length - 1].y} 
                                      r="2" 
                                      fill="#808000" 
                                      className="animate-ping"
                                    />
                                    <circle 
                                      cx={points[points.length - 1].x} 
                                      cy={points[points.length - 1].y} 
                                      r="1.5" 
                                      fill="#faf8f5"
                                    />
                                  </svg>
                                );
                              })() : (
                                <span className="text-[8px] text-stone-500 font-mono">Calibrating telemetry...</span>
                              )}
                            </div>
                            
                            <div className="flex justify-between items-center mt-1 text-[7.5px] text-stone-500 font-mono leading-none">
                              <span>{batteryHistory.length} readings</span>
                              <span className="flex items-center gap-1">
                                Latest: <strong className="text-stone-300 font-bold">{batteryHistory[batteryHistory.length - 1]?.toFixed(1)}%</strong>
                              </span>
                            </div>
                          </div>

                          {/* Eco-Throttling Warn Statuses */}
                          {isEcoThrottling && (
                            <div className="mt-3 pt-2.5 border-t border-stone-850">
                              <div className={`p-2 py-2 text-[10px] rounded-xl flex items-center gap-2 ${
                                battery.temperature >= 40
                                  ? 'bg-orange-950/40 border border-orange-500/40 text-orange-200'
                                  : battery.level < 0.15
                                    ? 'bg-rose-950/40 border border-rose-500/40 text-rose-200'
                                    : 'bg-olive/10 border border-olive/30 text-stone-200'
                              }`}>
                                {battery.temperature >= 40 ? (
                                  <Thermometer className="w-4 h-4 text-orange-500 shrink-0 animate-pulse" />
                                ) : battery.level < 0.15 ? (
                                  <BatteryWarning className="w-4 h-4 text-rose-500 shrink-0 animate-pulse" />
                                ) : (
                                  <Zap className="w-4 h-4 text-olive shrink-0 animate-pulse" />
                                )}
                                <div className="flex-1 leading-tight font-medium">
                                  {battery.temperature >= 40 ? (
                                    <>
                                      <span className="font-extrabold uppercase text-orange-300">Thermal Throttle Active</span>: Your device is hot (<strong className="text-white">{battery.temperature}°C</strong>). Scanning framerate is reduced to 3 FPS to prevent overheating.
                                    </>
                                  ) : battery.level < 0.15 ? (
                                    <>
                                      <span className="font-extrabold uppercase text-rose-300">Eco-Throttle Active</span>: Your battery level is at <strong className="text-white font-bold">{Math.round(battery.level * 100)}%</strong>. Scanning has been throttled to 3 FPS to conserve power.
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-extrabold uppercase text-olive">Eco-Throttle Active</span>: Manually forced. Scanning is adjusted to 3 FPS to save battery life.
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Recent Scans for quick re-access */}
                          <div className="mt-3 pt-2.5 border-t border-stone-800">
                            <div className="flex items-center gap-1.5 mb-1.5 uppercase tracking-wider text-[9px] font-extrabold text-olive">
                              <History className="w-3 h-3 text-olive" /> Recent Scans
                            </div>
                            {recentScans && recentScans.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {recentScans.map((title, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Re-access gathering: dispatch event
                                      window.dispatchEvent(new CustomEvent('gcommunity_reaccess_gathering', {
                                        detail: { title }
                                      }));
                                    }}
                                    className="text-left w-full truncate py-1 px-1.5 bg-stone-900 border border-stone-850 hover:bg-stone-800 hover:text-white rounded text-[8.5px] font-extrabold text-stone-300 transition-all cursor-pointer flex items-center justify-between group"
                                  >
                                    <span className="truncate group-hover:translate-x-0.5 transition-transform">{title}</span>
                                    <ChevronRight className="w-2.5 h-2.5 text-stone-400 group-hover:text-olive shrink-0" />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[8px] text-stone-500 italic">No scanned gatherings yet.</p>
                            )}
                          </div>

                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-stone-950/95" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <p className="text-xs text-gray-500 max-w-xs mb-4">
                  {isScanning 
                    ? "Aim your camera at another gathering's QR code to view and instantly join!"
                    : "Scan this QR code with a phone camera to view and instantly join."}
                </p>
              </div>

              {/* Conditional Body Content */}
              {scanSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full py-8 flex flex-col items-center justify-center min-h-[220px]"
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ type: 'spring', stiffness: 220, damping: 15 }}
                    className="w-16 h-16 rounded-full bg-emerald-505 bg-[#10b981] flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4"
                  >
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <motion.path 
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="3" 
                        d="M5 13l4 4L19 7" 
                      />
                    </svg>
                  </motion.div>
                  <h4 className="serif text-xl font-bold text-stone-900 mb-1">Scan Successful!</h4>
                  <p className="text-xs text-stone-600 max-w-[240px] px-4">
                    Successfully joined the gathering. Closing automatically in <span className="font-bold text-olive">{(autoCloseDelay / 1000).toFixed(0)}s</span>...
                  </p>
                  
                  {scanStreak % 5 === 0 && scanStreak > 0 && (
                    <motion.div
                      className="mt-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col items-center max-w-[240px] text-center"
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: [0.85, 1.05, 1], opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                      id={`qr-streak-milestone-panel-${gathering.id}`}
                    >
                      <span className="text-3xl mb-1 animate-bounce">🏆🏁🔥</span>
                      <h5 className="font-extrabold text-amber-800 text-[10px] tracking-widest uppercase font-sans">Milestone Achieved!</h5>
                      <p className="text-[11px] text-amber-950 mt-1 font-medium leading-tight select-none">
                        You've reached a legendary <strong className="font-sans font-black text-amber-900 text-xs">{scanStreak}</strong> scan streak! Keep up the community spirit!
                      </p>

                      {/* Visually distinct, gold-colored badge showing the highest achieved milestone tier */}
                      <div className="mt-3 w-full px-2.5 py-1.5 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 rounded-xl border border-amber-300 text-amber-950 text-[10px] font-black tracking-wider uppercase flex items-center justify-center gap-1 shadow-xs animate-pulse relative overflow-hidden">
                        <Trophy className="w-3 h-3 text-amber-950 shrink-0" />
                        <span>{getMilestoneTier(scanStreak).tier} Tier Unlocked!</span>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ) : isScanning ? (
                <div className="w-full flex flex-col items-center">
                  {/* Camera stream container */}
                  <div className="relative w-full h-48 mb-4 rounded-[24px] overflow-hidden bg-stone-900 border border-olive/10 shadow-inner flex items-center justify-center">
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ 
                        transform: `scale(${zoomScale})`, 
                        transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)' 
                      }}
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Auto-Focus Overlay Trigger */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-auto z-10" id="scanner-controls-overlay">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerAutoFocus();
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 bg-stone-900/90 hover:bg-stone-950 text-stone-100 text-[8px] font-black uppercase tracking-widest rounded-full border shadow-sm transition-all duration-200 active:scale-95 cursor-pointer ${
                          isZooming 
                            ? 'border-emerald-500 text-emerald-400' 
                            : 'border-white/10 hover:border-white/30 text-stone-200'
                        }`}
                        title="Pulse lens zoom to acquire sharp QR focus"
                        id="camera-auto-focus-toggle-btn"
                      >
                        <Sparkles className={`w-3 h-3 ${isZooming ? 'animate-spin text-emerald-400' : 'animate-pulse text-olive'}`} />
                        {isZooming ? "Zooming 1.8x" : "Auto-Focus"}
                      </button>
                    </div>

                    {/* Targeting reticle overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`relative w-32 h-32 border-2 border-dashed rounded-xl flex items-center justify-center transition-all duration-300 ${
                        isZooming ? 'scale-110 border-emerald-500 bg-emerald-500/[0.03]' : 'border-olive/80'
                      }`}>
                        <div className={`absolute top-1 left-1 w-3.5 h-3.5 border-t-2 border-l-2 rounded-tl transition-colors duration-300 ${isZooming ? 'border-emerald-500' : 'border-olive'}`} />
                        <div className={`absolute top-1 right-1 w-3.5 h-3.5 border-t-2 border-r-2 rounded-tr transition-colors duration-300 ${isZooming ? 'border-emerald-500' : 'border-olive'}`} />
                        <div className={`absolute bottom-1 left-1 w-3.5 h-3.5 border-b-2 border-l-2 rounded-bl transition-colors duration-300 ${isZooming ? 'border-emerald-500' : 'border-olive'}`} />
                        <div className={`absolute bottom-1 right-1 w-3.5 h-3.5 border-b-2 border-r-2 rounded-br transition-colors duration-300 ${isZooming ? 'border-emerald-500' : 'border-olive'}`} />
                        
                        {isZooming && (
                          <div className="absolute inset-2 border border-emerald-400/40 rounded-lg animate-ping opacity-75" />
                        )}

                        {/* Sweeping scan bar */}
                        <motion.div 
                          className={`w-full h-0.5 shadow-[0_0_8px_rgba(110,119,97,0.8)] absolute left-0 transition-colors duration-300 ${isZooming ? 'bg-emerald-400 shadow-emerald-400/60' : 'bg-olive'}`}
                          animate={{ top: ['10%', '90%', '10%'] }}
                          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        />
                      </div>
                    </div>
                  </div>

                  {scanError && (
                    <p className="text-xs font-medium text-rose-500 mb-4 px-2 bg-rose-50 py-1.5 rounded-lg border border-rose-100">
                      {scanError}
                    </p>
                  )}

                  {/* Stop scanning button */}
                  <button
                    type="button"
                    onClick={stopScanning}
                    className="w-full py-3 bg-stone-100 text-stone-700 font-bold text-xs uppercase tracking-wider rounded-full hover:bg-stone-200 transition-all cursor-pointer"
                  >
                    Cancel Scan
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">

                  {/* Tab Selector Buttons */}
                  <div 
                    className="flex bg-stone-100 p-1 rounded-full border border-stone-200 mb-5 w-full shrink-0"
                    id={`qr-tab-switcher-${gathering.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => setQrActiveTab('code')}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all duration-200 ${qrActiveTab === 'code' ? 'bg-white text-olive shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                      id={`qr-tab-code-btn-${gathering.id}`}
                    >
                      Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrActiveTab('help')}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all duration-300 relative ${
                        qrActiveTab === 'help' 
                          ? 'bg-white text-olive shadow-sm scale-102 font-extrabold' 
                          : isInfoHovered
                            ? 'bg-olive/15 text-olive shadow-xs scale-[1.03] ring-2 ring-olive/20'
                            : 'text-stone-550 hover:text-stone-850 hover:bg-stone-200/50'
                      }`}
                      id={`qr-tab-help-btn-${gathering.id}`}
                    >
                      {qrActiveTab !== 'help' && (
                        <span className={`absolute inset-0 rounded-full bg-olive/5 pointer-events-none ${isInfoHovered ? 'animate-ping opacity-35' : 'animate-pulse'}`} />
                      )}
                      
                      <span className="relative z-10 flex items-center justify-center gap-1.5">
                        Help Guide
                        {qrActiveTab !== 'help' && (
                          <span className={`w-1.5 h-1.5 rounded-full bg-olive ${isInfoHovered ? 'scale-125 animate-bounce' : 'animate-ping'}`} />
                        )}
                      </span>
                    </button>
                  </div>

                  {qrActiveTab === 'code' ? (
                    <motion.div
                      key="code-tab-panel"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="w-full flex flex-col items-center"
                    >
                      <p className="text-xs text-gray-500 max-w-xs mb-4 px-2">
                        Scan this QR code with a phone camera to view and instantly join <strong className="font-semibold text-olive">{gathering.title}</strong>.
                      </p>

                      {/* Unified Scan Metrics Summary Panel */}
                      <div 
                        className="w-full grid grid-cols-2 gap-3 mb-4 p-3 bg-stone-100/50 rounded-2xl border border-stone-200/50"
                        id={`qr-metrics-panel-${gathering.id}`}
                      >
                        <div className="flex flex-col items-center justify-center p-2.5 bg-white rounded-xl border border-stone-200/40 shadow-xs">
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-stone-400 mb-0.5">Lifetime Joined</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-stone-850 font-mono" id={`lifetime-scans-val-${gathering.id}`}>{lifetimeScans}</span>
                            <span className="text-[10px] text-olive font-sans">✨</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-center justify-center p-2.5 bg-white rounded-xl border border-stone-200/40 shadow-xs">
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-stone-400 mb-0.5">Scan Streak</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-[#e25822] font-mono" id={`scan-streak-val-${gathering.id}`}>{scanStreak}</span>
                            <span className="text-xs animate-pulse">🔥</span>
                          </div>
                        </div>

                        {/* Gold-colored Highest Achieved Badge */}
                        <div 
                          className="col-span-2 flex items-center justify-between p-3 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl border border-amber-200/60 shadow-3xs relative overflow-hidden group"
                          id={`qr-milestone-badge-display-${gathering.id}`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${getMilestoneTier(maxStreak).badgeClass}`}>
                              {getMilestoneTier(maxStreak).emoji}
                            </div>
                            <div className="text-left">
                              <span className="text-[8px] uppercase tracking-widest font-extrabold text-amber-800/80 block mb-0.5">Highest Milestone</span>
                              <span className="text-[10px] font-black uppercase text-amber-950 tracking-wider flex items-center gap-1">
                                {getMilestoneTier(maxStreak).tier} Tier
                              </span>
                            </div>
                          </div>
                          <div className="text-[9px] font-extrabold text-amber-800 bg-amber-200/40 px-2 py-0.5 rounded-full select-none">
                            Record: {maxStreak}
                          </div>
                        </div>
                      </div>

                      {/* Simulation Trigger button to demonstrate Milestone trigger with high confidence */}
                      <div className="w-full flex justify-center -mt-2 mb-4">
                        <button
                          type="button"
                          onClick={() => {
                            const current = parseInt(localStorage.getItem('gcommunity_scan_streak') || '0', 10);
                            const nextMilestone = current > 0 ? Math.ceil((current + 1) / 5) * 5 : 5;
                            localStorage.setItem('gcommunity_scan_streak', String(nextMilestone));
                            
                            const currentScans = parseInt(localStorage.getItem('gcommunity_total_scans') || '0', 10);
                            localStorage.setItem('gcommunity_total_scans', String(currentScans + (nextMilestone - current)));
                            
                            window.dispatchEvent(new Event('gcommunity_total_scans_updated'));
                            setScanSuccess(true);
                          }}
                          className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 rounded-full border border-emerald-100 font-extrabold transition-all duration-200 flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
                          id={`qr-simulate-milestone-btn-${gathering.id}`}
                        >
                          <Sparkles className="w-3 h-3 text-emerald-600 animate-spin" />
                          <span>Simulate Milestone 🎉</span>
                        </button>
                      </div>

                      {/* QR Code Canvas container */}
                      <div 
                        className="bg-[#fcfbf7] p-5 rounded-[24px] border border-olive/10 shadow-inner flex flex-col items-center justify-center relative mb-4 w-full gap-3"
                        id={`qr-code-frame-${gathering.id}`}
                      >
                        {qrCodeDataUrl ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ 
                              opacity: 1, 
                              scale: [0.92, 1.03, 0.98, 1.01, 1] 
                            }}
                            transition={{ 
                              duration: 0.7,
                              ease: "easeOut"
                            }}
                            whileHover={{ scale: 1.025 }}
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('gcommunity_scan_success', { 
                                detail: { gatheringId: gathering.id } 
                              }));
                            }}
                            className="relative p-2 rounded-2xl bg-white border border-stone-150 shadow-xs group cursor-pointer"
                            title="Click QR code to simulate scanning and play organic chime & haptics!"
                          >
                            <img 
                              src={qrCodeDataUrl} 
                              alt={`QR Code for ${gathering.title}`} 
                              className="w-48 h-48 object-contain rounded-lg transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                            {/* Subtle continuous breeding pulse ring */}
                            <motion.div 
                              className="absolute -inset-0.5 rounded-[18px] border-2 border-olive/30 pointer-events-none"
                              animate={{ 
                                scale: [0.99, 1.03, 0.99],
                                opacity: [0.3, 0.75, 0.3]
                              }}
                              transition={{
                                repeat: Infinity,
                                duration: 2.5,
                                ease: "easeInOut"
                              }}
                            />
                          </motion.div>
                        ) : (
                          <div className="w-48 h-48 flex items-center justify-center text-gray-400">
                            <span className="text-xs font-semibold animate-pulse">Generating QR Code...</span>
                          </div>
                        )}

                        {/* Horizontal 'Recent Scans' scrollable list of timestamps */}
                        <div className="w-full flex flex-col items-center gap-1.5 mt-1 px-1" id={`qr-timestamp-history-list-${gathering.id}`}>
                          <div className="w-full flex items-center justify-between text-[9px] uppercase tracking-wider font-extrabold text-stone-400 px-1">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Recent Scan History
                            </span>
                            <span className="font-mono text-[8.5px] text-stone-400 lowercase">Real-time log</span>
                          </div>
                          
                          {qrScanTimestamps.length > 0 ? (
                            <div 
                              className="w-full overflow-x-auto flex items-center gap-2 py-1 px-0.5" 
                              style={{ 
                                scrollbarWidth: 'none', 
                                msOverflowStyle: 'none' 
                              }}
                            >
                              <AnimatePresence mode="popLayout">
                                {qrScanTimestamps.map((timestamp, index) => (
                                  <motion.div
                                    key={`${timestamp}-${index}`}
                                    initial={{ opacity: 0, scale: 0.8, x: -15 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, x: 15 }}
                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                    className={`flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold shadow-3xs hover:scale-102 transition-transform duration-200 ${
                                      index === 0 
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-250 ring-2 ring-emerald-500/10'
                                        : 'bg-stone-50 text-stone-600 border-stone-200/50'
                                    }`}
                                  >
                                    <Clock className={`w-3 h-3 ${index === 0 ? 'text-emerald-600 animate-pulse' : 'text-stone-400'}`} />
                                    <span>{timestamp}</span>
                                    {index === 0 && (
                                      <span className="text-[7px] uppercase font-black tracking-tighter text-emerald-700 bg-emerald-100/60 px-1 rounded-xs">New</span>
                                    )}
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          ) : (
                            <div className="w-full text-center py-2 bg-stone-50/50 border border-dashed border-stone-200 rounded-lg text-[9px] text-stone-400 italic">
                              No recent activity registered. Click the QR code above to simulate scan!
                            </div>
                          )}
                        </div>

                        {/* Badges and actions row at the bottom of the frame */}
                        <div className="flex flex-col sm:flex-row items-center gap-2 mt-2 w-full justify-center">
                          {/* Contribution lifetime scans indicator */}
                          <div 
                            className="flex items-center gap-1.5 px-3 py-1 bg-olive/5 rounded-full border border-olive/10 shrink-0 select-none" 
                            id={`qr-lifetime-scans-indicator-${gathering.id}`}
                            title="Every QR scan dynamically registers your arrival and supports the gathering's growth!"
                          >
                            <Award className="w-3.5 h-3.5 text-olive" />
                            <span className="text-[10px] font-bold text-stone-650 uppercase tracking-wider font-sans">
                              Your Scans: <strong className="font-extrabold text-olive font-mono text-xs">{lifetimeScans}</strong>
                            </span>
                          </div>

                          {/* Scan Analytics Trigger Button */}
                          <button
                            type="button"
                            onClick={() => setIsAnalyticsModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-olive/10 hover:bg-olive/20 text-olive rounded-full border border-olive/15 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer"
                            id={`qr-analytics-modal-btn-${gathering.id}`}
                            title="Open Scan Analytics Dashboard Modal"
                          >
                            <TrendingUp className="w-3.5 h-3.5 text-olive" />
                            <span>Scan Analytics</span>
                          </button>
                        </div>
                      </div>

                      {/* Quick Guide Card */}
                      <div 
                        className="flex items-start gap-2.5 text-left bg-olive/5 border border-olive/10 rounded-2xl p-3 mb-5 w-full text-xs text-stone-600"
                        id={`qr-instructions-${gathering.id}`}
                      >
                        <Info className="w-4 h-4 text-olive shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold text-olive text-[10px] uppercase tracking-wider block mb-0.5">Quick guide</span>
                          <p className="text-[10px] leading-relaxed text-stone-500">
                            Aim your phone camera at the code. Tap the pop-up web banner to join details, or click the <span className="font-semibold text-olive">Help Guide</span> tab above for interactive steps!
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="w-full flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (qrCodeDataUrl) {
                              const link = document.createElement('a');
                              link.href = qrCodeDataUrl;
                              link.download = `${gathering.title.toLowerCase().replace(/\s+/g, '-')}-qr.png`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          }}
                          disabled={!qrCodeDataUrl}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-olive text-warm-white font-bold text-xs uppercase tracking-wider rounded-full shadow-md hover:bg-olive/90 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                          id={`qr-download-btn-${gathering.id}`}
                        >
                          <DownloadIcon className="w-4 h-4" /> Download
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(shareUrl).then(() => {
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            });
                          }}
                          className={`py-3 px-5 font-bold text-xs uppercase tracking-wider rounded-full transition-all ${
                            copied 
                              ? 'bg-olive text-warm-white border border-transparent' 
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                          }`}
                          id={`qr-copy-btn-${gathering.id}`}
                        >
                          {copied ? 'Copied!' : 'Copy Link'}
                        </button>
                      </div>

                      {/* Dedicated Scan Code Button & Visual Status Indicator */}
                      <div className="flex items-center gap-2 mt-3 w-full" id={`qr-scan-wrapper-${gathering.id}`}>
                        <button
                          type="button"
                          onClick={startScanning}
                          className="flex-1 flex items-center justify-center gap-2.5 py-3 bg-stone-900 text-stone-100 font-bold text-xs uppercase tracking-wider rounded-full shadow-md hover:bg-stone-800 active:scale-95 transition-all cursor-pointer relative"
                          id={`qr-scan-code-btn-${gathering.id}`}
                        >
                          <Camera className="w-4 h-4 text-olive animate-pulse" /> 
                          <span>Scan Code</span>
                          {/* Subtle LED-style status indicator inside the button */}
                          <span className="flex h-2 w-2 relative ml-1" id={`qr-scan-led-${gathering.id}`}>
                            {isScanning ? (
                              <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></span>
                              </>
                            ) : (
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-stone-600 opacity-60"></span>
                            )}
                          </span>
                        </button>
                        <div 
                          className={`flex items-center gap-1.5 px-3 py-3 border rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 shrink-0 select-none ${
                            isScanning 
                              ? 'bg-emerald-50 border-emerald-500/35 text-emerald-700 shadow-sm shadow-emerald-100/50' 
                              : 'bg-stone-100 border-stone-200 text-stone-500'
                          }`}
                          id={`qr-camera-sensor-status-${gathering.id}`}
                          title={isScanning ? "Camera feed is active" : "Camera sensor is inactive"}
                        >
                          <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                            {isScanning ? (
                              <>
                                {/* Smooth, blooming outer pulse ring */}
                                <motion.span
                                  className="absolute rounded-full bg-emerald-400/40"
                                  style={{ width: '14px', height: '14px' }}
                                  animate={{
                                    scale: [1, 1.7, 1],
                                    opacity: [0.4, 0, 0.4],
                                  }}
                                  transition={{
                                    duration: 2.0,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }}
                                />
                                {/* Main bright core status lamp */}
                                <motion.span
                                  className="relative rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"
                                  style={{ width: '8px', height: '8px' }}
                                  animate={{
                                    scale: [1, 1.2, 1],
                                    opacity: [0.85, 1, 0.85],
                                  }}
                                  transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }}
                                />
                              </>
                            ) : (
                              <span className="rounded-full bg-stone-400 opacity-60" style={{ width: '8px', height: '8px' }} />
                            )}
                          </span>
                          <span className="leading-none">{isScanning ? 'Active' : 'Standby'}</span>
                        </div>
                      </div>
                    </motion.div>
              ) : (
                <motion.div
                  key="help-tab-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full flex flex-col items-center"
                >
                  {/* Step Selector Pills */}
                  <div className="flex gap-2 mb-4" id={`qr-help-step-pills-${gathering.id}`}>
                    {[1, 2, 3].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setHelpStep(step)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          helpStep === step 
                            ? 'bg-olive text-warm-white shadow-md scale-105' 
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-500'
                        }`}
                        id={`qr-step-${step}-btn-${gathering.id}`}
                      >
                        {step}
                      </button>
                    ))}
                  </div>

                  {/* Animated Visual Guide Display */}
                  <div 
                    className="w-full h-40 bg-[#fcfbf7] rounded-[24px] border border-olive/10 shadow-inner relative overflow-hidden flex items-center justify-center mb-4"
                    id={`qr-help-display-${gathering.id}`}
                  >
                    <AnimatePresence mode="wait">
                      {helpStep === 1 && (
                        <motion.div
                          key="step-1"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center"
                        >
                          {/* Animated Phone */}
                          <div className="relative w-18 h-28 bg-[#f4f2eb] rounded-xl border border-olive/20 shadow-md flex flex-col items-center justify-between py-1.5 px-2 overflow-hidden">
                            <div className="w-5 h-0.5 bg-olive/20 rounded-full" />
                            
                            <motion.div 
                              animate={{ scale: [1, 1.12, 1], rotate: [0, 8, -8, 0] }}
                              transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                              className="w-10 h-10 rounded-full bg-olive/10 flex items-center justify-center border border-olive/20"
                            >
                              <Camera className="w-5 h-5 text-olive" />
                            </motion.div>

                            <div className="w-full flex justify-between px-1 text-[5px] font-bold text-olive/60 uppercase tracking-widest font-mono">
                              <span>PHOTO</span>
                              <div className="w-1 h-1 rounded-full bg-olive/40" />
                              <span>VIDEO</span>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {helpStep === 2 && (
                        <motion.div
                          key="step-2"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <div className="relative w-full h-full flex items-center justify-center">
                            {/* Static Code Behind */}
                            <div className="opacity-25 transform scale-75">
                              <QrCodeIcon className="w-16 h-16 text-stone-800" />
                            </div>

                            {/* Scanning overlay bracket */}
                            <motion.div 
                              className="absolute w-24 h-24 border-2 border-dashed border-olive rounded-xl flex items-center justify-center pointer-events-none"
                              animate={{ 
                                scale: [0.93, 1.03, 0.93],
                                rotate: [0, 1.5, -1.5, 0]
                              }}
                              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                            >
                              <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-olive rounded-tl" />
                              <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-olive rounded-tr" />
                              <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-olive rounded-bl" />
                              <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-olive rounded-br" />
                              
                              {/* Sweeping bar */}
                              <motion.div 
                                className="w-full h-0.5 bg-olive/50 shadow-[0_0_8px_rgba(110,119,97,0.8)] absolute left-0"
                                animate={{ top: ['15%', '85%', '15%'] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                              />
                            </motion.div>
                          </div>
                        </motion.div>
                      )}

                      {helpStep === 3 && (
                        <motion.div
                          key="step-3"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute inset-0 flex flex-col items-center justify-center p-3"
                        >
                          <div className="w-44 bg-[#f4f2eb] rounded-xl border border-olive/20 p-2 shadow-sm flex flex-col gap-1.5 relative overflow-hidden">
                            <div className="flex items-center justify-between text-[6px] text-olive/40 font-mono">
                              <span>9:41 AM</span>
                              <div className="w-8 h-1 bg-olive/20 rounded-full" />
                              <span>100%</span>
                            </div>

                            {/* Banner notification pops up */}
                            <motion.div 
                              initial={{ y: -20, opacity: 0, scale: 0.95 }}
                              animate={{ y: 0, opacity: 1, scale: 1 }}
                              transition={{ 
                                delay: 0.2,
                                type: "spring",
                                stiffness: 350,
                                damping: 14
                              }}
                              className="bg-white rounded-lg p-1.5 shadow-md border border-olive/10 flex items-center gap-1.5 text-left"
                            >
                              <div className="w-4.5 h-4.5 rounded bg-olive/10 flex items-center justify-center shrink-0">
                                <QrCodeIcon className="w-2.5 h-2.5 text-olive" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-[5.5px] font-bold uppercase tracking-wider text-olive block leading-none mb-0.5">Camera Link Detected</span>
                                <span className="text-[7.5px] text-gray-700 font-bold truncate block">{gathering.title}</span>
                              </div>
                              <ExternalLink className="w-2 h-2 text-olive shrink-0 animate-bounce" />
                            </motion.div>

                            <div className="h-5 bg-olive/5 rounded border border-dashed border-olive/15 flex items-center justify-center text-[6px] text-olive/40 tracking-wider uppercase font-bold">
                              Preview Content
                            </div>

                            {/* Simulated click cursor */}
                            <motion.div 
                              className="absolute top-8 right-6 pointer-events-none"
                              animate={{ 
                                scale: [1, 0.8, 1],
                                x: [10, 0, 10],
                                y: [10, 0, 10],
                                opacity: [0, 1, 0]
                              }}
                              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                            >
                              <div className="w-4 h-4 bg-olive/30 rounded-full absolute -top-1 -left-1 animate-ping" />
                              <svg className="w-4 h-4 fill-olive stroke-white stroke-2" viewBox="0 0 24 24">
                                <path d="M12 2C11.45 2 11 2.45 11 3V12.17L9.12 10.29C8.73 9.9 8.1 9.9 7.71 10.29C7.32 10.68 7.32 11.31 7.71 11.7L11.3 15.29C11.69 15.68 12.32 15.68 12.71 15.29L16.3 11.7C16.69 11.31 16.69 10.68 16.3 10.29C15.91 9.9 15.28 9.9 14.89 10.29L13 12.17V3C13 2.45 12.55 2 12 2Z" transform="rotate(-45 12 12)" />
                              </svg>
                            </motion.div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Help Guide description text box */}
                  <div className="bg-olive/5 border border-olive/10 rounded-2xl p-4 text-left w-full mb-5 select-none min-h-[85px] flex items-center">
                    {helpStep === 1 && (
                      <div>
                        <span className="font-bold text-olive text-[10px] uppercase tracking-wider block mb-0.5">Step 1: Open Your Camera</span>
                        <p className="text-[11px] text-stone-600 leading-normal font-light">
                          Open the default <strong className="font-semibold text-olive">Camera app</strong> on your mobile phone or tablet. You do not need secondary scanners or barcode software installed.
                        </p>
                      </div>
                    )}
                    {helpStep === 2 && (
                      <div>
                        <span className="font-bold text-olive text-[10px] uppercase tracking-wider block mb-0.5">Step 2: Aim & Frame</span>
                        <p className="text-[11px] text-stone-600 leading-normal font-light">
                          Frame the QR code central on your screen. Keep your hands steady for a second to allow the sensor to capture the visual tags.
                        </p>
                      </div>
                    )}
                    {helpStep === 3 && (
                      <div>
                        <span className="font-bold text-olive text-[10px] uppercase tracking-wider block mb-0.5">Step 3: Tap Banner to Join</span>
                        <p className="text-[11px] text-stone-600 leading-normal font-light">
                          A web redirect banner notification will instantly float from the top or center. Tap this link bubble to instantly navigate and register!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Got it, Show QR Code */}
                  <button
                    type="button"
                    onClick={() => setQrActiveTab('code')}
                    className="w-full py-3 bg-olive text-warm-white font-bold text-xs uppercase tracking-wider rounded-full shadow-md hover:bg-olive/90 active:scale-95 transition-all"
                    id={`qr-help-finish-btn-${gathering.id}`}
                  >
                    Got it, show QR Code
                  </button>
                </motion.div>
              )}
            </div>
          )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Wallet Pass Modal */}
      <AnimatePresence>
        {isWalletModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id={`wallet-modal-${gathering.id}`}>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsWalletModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-[#faf8f5] w-full max-w-sm rounded-[32px] p-6 overflow-hidden shadow-2xl border border-olive/10 flex flex-col items-center"
              id={`wallet-modal-content-${gathering.id}`}
            >
              {/* Close Button */}
              <button 
                type="button" 
                onClick={() => setIsWalletModalOpen(false)}
                className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-olive hover:bg-olive/5 transition-all"
                aria-label="Close Wallet Dialog"
                id={`wallet-modal-close-btn-${gathering.id}`}
              >
                <X className="w-5 h-5" />
              </button>

              {/* Title Section */}
              <div className="w-full flex flex-col items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-olive/5 flex items-center justify-center mb-2">
                  <Wallet className="w-6 h-6 text-olive" />
                </div>
                <h3 className="serif text-2.5xl text-gray-800 font-bold">Save Event Pass</h3>
                <p className="text-[11px] text-gray-500 text-center mt-1">Get an offline-active mobile boarding pass for check-in</p>
              </div>

              {/* Wallet OS Type Selector Tabs */}
              <div 
                className="flex bg-stone-100 p-1 rounded-full border border-stone-200 mb-5 w-full shrink-0"
                id={`wallet-tab-switcher-${gathering.id}`}
              >
                <button
                  type="button"
                  onClick={() => setWalletType('apple')}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all duration-200 flex items-center justify-center gap-1.5 ${walletType === 'apple' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                  id={`wallet-tab-apple-btn-${gathering.id}`}
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                     <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
                  </svg>
                  Apple Pass
                </button>
                <button
                  type="button"
                  onClick={() => setWalletType('google')}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all duration-200 flex items-center justify-center gap-1.5 ${walletType === 'google' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                  id={`wallet-tab-google-btn-${gathering.id}`}
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.102 1.025 5.043 1.926l3.245-3.125C18.428 1.151 15.584 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.89 11.57-11.79 0-.795-.085-1.4-.187-1.925H12.24z" />
                  </svg>
                  Google Pass
                </button>
              </div>

              {/* Live Preview Container with Flipping Animation or Dynamic Styling */}
              <div className="w-full flex flex-col items-center mb-6">
                {walletType === 'apple' ? (
                  /* High Fidelity Apple Wallet Card Preview */
                  <div className="w-full bg-gradient-to-b from-[#4f5544] to-[#2c3026] text-white rounded-[20px] p-5 shadow-lg border border-white/10 relative overflow-hidden flex flex-col min-h-[290px] w-[270px]">
                    {/* Apple Perforated Hole Punch Look */}
                    <div className="absolute left-[-8px] top-[60%] w-4 h-4 bg-[#faf8f5] rounded-full shadow-inner" />
                    <div className="absolute right-[-8px] top-[60%] w-4 h-4 bg-[#faf8f5] rounded-full shadow-inner" />
                    
                    {/* Header bar */}
                    <div className="flex justify-between items-center pb-2.5 border-b border-white/10 mb-3 text-left">
                      <span className="text-[7.5px] font-black uppercase tracking-widest text-stone-300">Community Gatherings</span>
                      <span className="text-[7px] bg-white/15 px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wider text-white font-mono">Event Pass</span>
                    </div>

                    <h4 className="serif text-base font-extrabold tracking-tight truncate text-left mb-2 text-white">{gathering.title}</h4>
                    
                    {/* Pass content grid */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-left mb-4">
                      <div>
                        <span className="text-[6.5px] uppercase tracking-wider text-stone-400 block font-sans">Date</span>
                        <span className="text-[9.5px] font-bold truncate block text-white">{new Date(gathering.date.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div>
                        <span className="text-[6.5px] uppercase tracking-wider text-stone-400 block font-sans">Time</span>
                        <span className="text-[9.5px] font-bold truncate block text-white">{gathering.time}</span>
                      </div>
                      <div>
                        <span className="text-[6.5px] uppercase tracking-wider text-stone-400 block font-sans">Location</span>
                        <span className="text-[9.5px] font-bold truncate block text-white" title={gathering.location}>{gathering.location.split(',')[0]}</span>
                      </div>
                      <div>
                        <span className="text-[6.5px] uppercase tracking-wider text-stone-400 block font-sans">Ticket For</span>
                        <span className="text-[9.5px] font-bold truncate block text-white">{CURRENT_USER.name}</span>
                      </div>
                    </div>

                    {/* QR Code Segment */}
                    <div className="mt-auto bg-[#faf8f5] p-2 rounded-xl flex flex-col items-center justify-center shadow-inner">
                      {walletQrUrl ? (
                        <img src={walletQrUrl} alt="Apple Pass Qr Preview" className="w-24 h-24 object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-24 h-24 bg-stone-100 flex items-center justify-center rounded">
                          <span className="text-[7px] text-gray-400 animate-pulse font-extrabold uppercase">Generating QR...</span>
                        </div>
                      )}
                      <div className="text-[6px] font-bold text-stone-800 tracking-widest uppercase mt-1 font-mono">Verified Gate Pass</div>
                    </div>
                  </div>
                ) : (
                  /* High Fidelity Google Wallet Card Preview */
                  <div className="w-full bg-[#f8fafc] text-stone-900 rounded-[24px] p-5 shadow-lg border border-stone-200 relative overflow-hidden flex flex-col min-h-[290px] w-[270px]">
                    {/* Header bar */}
                    <div className="flex items-center gap-1.5 pb-3 border-b border-stone-100 mb-3 text-left">
                      <div className="w-4 h-4 rounded-full bg-stone-900 flex items-center justify-center">
                        <Wallet className="w-2 h-2 text-white" />
                      </div>
                      <span className="text-[8px] font-bold tracking-wider uppercase text-stone-600 font-sans">Google Pay • Wallet</span>
                    </div>

                    <h4 className="serif text-base font-extrabold text-stone-900 tracking-tight truncate text-left mb-2">{gathering.title}</h4>
                    
                    {/* Pass content grid */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-left mb-4">
                      <div>
                        <span className="text-[6.5px] uppercase tracking-wider text-stone-500 block font-sans">Date</span>
                        <span className="text-[9.5px] text-stone-800 font-bold truncate block">{new Date(gathering.date.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div>
                        <span className="text-[6.5px] uppercase tracking-wider text-stone-500 block font-sans">Time</span>
                        <span className="text-[9.5px] text-stone-800 font-bold truncate block">{gathering.time}</span>
                      </div>
                      <div>
                        <span className="text-[6.5px] uppercase tracking-wider text-stone-500 block font-sans">Location</span>
                        <span className="text-[9.5px] text-stone-800 font-bold truncate block" title={gathering.location}>{gathering.location.split(',')[0]}</span>
                      </div>
                      <div>
                        <span className="text-[6.5px] uppercase tracking-wider text-stone-500 block font-sans">Attendee</span>
                        <span className="text-[9.5px] text-stone-800 font-bold truncate block">{CURRENT_USER.name}</span>
                      </div>
                    </div>

                    {/* QR Code Segment */}
                    <div className="mt-auto bg-white p-2 rounded-xl flex flex-col items-center justify-center border border-stone-100 shadow-xs">
                      {walletQrUrl ? (
                        <img src={walletQrUrl} alt="Google Pass Qr Preview" className="w-24 h-24 object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-24 h-24 bg-stone-50 flex items-center justify-center rounded">
                          <span className="text-[7px] text-gray-400 animate-pulse font-extrabold uppercase">Generating QR...</span>
                        </div>
                      )}
                      <div className="text-[6px] font-bold text-stone-500 tracking-widest uppercase mt-1 font-mono">Check-in Scan Barcode</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action save trigger pill button */}
              <button
                type="button"
                onClick={() => {
                  handleExportWalletPass();
                }}
                className={`w-full py-3.5 flex items-center justify-center gap-2 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all text-white font-sans ${
                  walletType === 'apple' 
                    ? 'bg-stone-900 border border-stone-800 hover:bg-stone-800' 
                    : 'bg-[#3b82f6] hover:bg-blue-600 shadow-blue-500/10'
                }`}
                id={`wallet-save-pills-btn-${gathering.id}`}
              >
                <DownloadIcon className="w-4 h-4" />
                {walletType === 'apple' ? 'Save Apple Wallet Pass' : 'Save Google Wallet Pass'}
              </button>

              <div className="mt-4 text-center">
                <span className="text-[9px] text-stone-500 block leading-relaxed font-light px-2">
                  Downloads a fully offline-secured digital pass file (.html). Add to Homescreen from Safari or Chrome for instantaneous entry checking at the gates!
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scan Analytics Modal */}
      <AnimatePresence>
        {isAnalyticsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" id={`analytics-modal-${gathering.id}`}>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
              onClick={() => setIsAnalyticsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative bg-[#faf8f5] w-full max-w-md rounded-[32px] p-6 overflow-hidden shadow-2xl border border-olive/15 flex flex-col items-center"
              id={`analytics-modal-content-${gathering.id}`}
            >
              {/* Close Button */}
              <button 
                type="button" 
                onClick={() => setIsAnalyticsModalOpen(false)}
                className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-olive hover:bg-olive/5 transition-all cursor-pointer"
                aria-label="Close Analytics Dialog"
                id={`analytics-modal-close-btn-${gathering.id}`}
              >
                <X className="w-5 h-5" />
              </button>

              {/* Title Section */}
              <div className="w-full flex flex-col items-start text-left mb-4 border-b border-stone-200/50 pb-3">
                <span className="text-[10px] font-extrabold text-[#808000] uppercase tracking-widest flex items-center gap-1.5 font-sans">
                  <Activity className="w-4 h-4 text-olive" /> Performance Metrics
                </span>
                <h3 className="serif text-xl text-stone-850 font-extrabold mt-1">Scan Analytics Dashboard</h3>
                <p className="text-[11px] text-stone-500 mt-0.5 font-sans truncate w-11/12">{gathering.title}</p>
                
                {/* View Switcher Button in Header along with Export CSV Action */}
                <div className="w-full flex items-center justify-between gap-2 mt-4" id={`analytics-toolbar-${gathering.id}`}>
                  <div 
                    className="flex bg-stone-100 p-1 rounded-full border border-stone-200/60 shrink-0" 
                    id={`analytics-tab-switcher-${gathering.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => setAnalyticsViewMode('chart')}
                      className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${analyticsViewMode === 'chart' ? 'bg-white text-olive shadow-xs border border-stone-200/20' : 'text-stone-500 hover:text-stone-800'}`}
                      id={`analytics-tab-chart-btn-${gathering.id}`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      7-Day Trend
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalyticsViewMode('table')}
                      className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${analyticsViewMode === 'table' ? 'bg-white text-olive shadow-xs border border-stone-200/20' : 'text-stone-500 hover:text-stone-800'}`}
                      id={`analytics-tab-table-btn-${gathering.id}`}
                    >
                      <Table className="w-3.5 h-3.5" />
                      Granular Logs
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Export CSV Action */}
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-widest text-olive border border-olive/20 hover:border-olive/40 bg-olive/[0.04] hover:bg-olive/[0.08] rounded-full flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95"
                      title="Export granular scan logs to a CSV file"
                      id={`analytics-export-csv-btn-${gathering.id}`}
                    >
                      <Download className="w-3.5 h-3.5 text-olive shrink-0" />
                      <span>CSV</span>
                    </button>

                    {/* Export PDF Action */}
                    <button
                      type="button"
                      disabled={isExportingPDF}
                      onClick={handleExportPDF}
                      className={`px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-widest border rounded-full flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 ${
                        isExportingPDF 
                          ? 'text-stone-400 border-stone-200 bg-stone-100 cursor-not-allowed'
                          : 'text-emerald-850 border-emerald-500/25 hover:border-emerald-500/45 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.09]'
                      }`}
                      title="Export comprehensive report of the scan history to a PDF file"
                      id={`analytics-export-pdf-btn-${gathering.id}`}
                    >
                      {isExportingPDF ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-stone-400 shrink-0 animate-spin" />
                          <span>Preparing...</span>
                        </>
                      ) : (
                        <>
                          <FileDown className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Body / View Switch */}
              <div className="w-full">
                {analyticsViewMode === 'chart' ? (() => {
                  const getSmoothedValue = (dataList: any[], index: number) => {
                    const val = dataList[index]?.count || 0;
                    if (!showSmoothing) return val;
                    let sum = 0;
                    let count = 0;
                    for (let j = index - 1; j <= index + 1; j++) {
                      if (j >= 0 && j < dataList.length) {
                        sum += dataList[j]?.count || 0;
                        count++;
                      }
                    }
                    return count > 0 ? parseFloat((sum / count).toFixed(1)) : 0;
                  };

                  const combinedChartData = analyticsData.map((currDay, idx) => {
                    const prevDay = prevAnalyticsData[idx] || { date: 'N/A', count: 0 };
                    const yearAgoDay = yearAgoAnalyticsData[idx] || { date: 'N/A', count: 0 };
                    const customDay = customAnalyticsData[idx] || { date: 'N/A', count: 0 };
                    return {
                      date: currDay.date,
                      count: getSmoothedValue(analyticsData, idx),
                      prevDate: prevDay.date,
                      prevCount: getSmoothedValue(prevAnalyticsData, idx),
                      yearAgoDate: yearAgoDay.date,
                      yearAgoCount: getSmoothedValue(yearAgoAnalyticsData, idx),
                      customDate: customDay.date,
                      customCount: getSmoothedValue(customAnalyticsData, idx),
                    };
                  });

                  const totalPoints = combinedChartData.length;
                  const startIdx = zoomRange ? Math.max(0, Math.min(zoomRange.start, totalPoints - 1)) : 0;
                  const endIdx = zoomRange ? Math.max(startIdx, Math.min(zoomRange.end, totalPoints - 1)) : totalPoints - 1;
                  const visibleChartData = combinedChartData.slice(startIdx, endIdx + 1);

                  const currentTotal = analyticsData.reduce((acc, curr) => acc + (curr.count || 0), 0);
                  const previousTotal = prevAnalyticsData.reduce((acc, curr) => acc + (curr.count || 0), 0);
                  const yearAgoTotal = yearAgoAnalyticsData.reduce((acc, curr) => acc + (curr.count || 0), 0);
                  const customTotal = customAnalyticsData.reduce((acc, curr) => acc + (curr.count || 0), 0);
                  
                  const currentAvg = Math.ceil(currentTotal / 7);
                  const previousAvg = Math.ceil(previousTotal / 7);
                  const yearAgoAvg = Math.ceil(yearAgoTotal / 7);
                  const customAvg = Math.ceil(customTotal / 7);

                  const currentMax = Math.max(...analyticsData.map(d => d.count || 0), 0);
                  const currentMaxIdx = analyticsData.findIndex(d => (d.count || 0) === currentMax);

                  const previousMax = Math.max(...prevAnalyticsData.map(d => d.count || 0), 0);
                  const previousMaxIdx = prevAnalyticsData.findIndex(d => (d.count || 0) === previousMax);

                  const customMax = Math.max(...customAnalyticsData.map(d => d.count || 0), 0);
                  const customMaxIdx = customAnalyticsData.findIndex(d => (d.count || 0) === customMax);

                  // Calculate the true historical all-time high for this gathering
                  const storedAllTimeHighKey = `gcommunity_scans_alltime_high_${gathering.id}`;
                  const storedAllTimeHighRaw = localStorage.getItem(storedAllTimeHighKey);
                  let storedAllTimeHigh = storedAllTimeHighRaw ? parseInt(storedAllTimeHighRaw, 10) : 0;

                  const sessionMaxVal = Math.max(
                    currentMax,
                    previousMax,
                    customMax,
                    Math.max(...yearAgoAnalyticsData.map(d => d.count || 0), 0)
                  );

                  if (sessionMaxVal > storedAllTimeHigh) {
                    storedAllTimeHigh = sessionMaxVal;
                    localStorage.setItem(storedAllTimeHighKey, storedAllTimeHigh.toString());
                  }
                  if (storedAllTimeHigh === 0 && sessionMaxVal > 0) {
                    storedAllTimeHigh = sessionMaxVal;
                    localStorage.setItem(storedAllTimeHighKey, storedAllTimeHigh.toString());
                  }

                  // Find local peak indices for current, previous, and custom lines of combinedChartData
                  const getLocalPeakIndices = (dataList: any[], key: string) => {
                    const peaks = new Set<number>();
                    const len = dataList.length;
                    if (len === 0) return peaks;
                    
                    for (let i = 0; i < len; i++) {
                      const val = dataList[i]?.[key] || 0;
                      if (val === 0) continue;
                      
                      let isLeftOk = true;
                      let isRightOk = true;
                      
                      if (i > 0) {
                        const leftVal = dataList[i - 1]?.[key] || 0;
                        isLeftOk = val > leftVal;
                      }
                      if (i < len - 1) {
                        const rightVal = dataList[i + 1]?.[key] || 0;
                        isRightOk = val > rightVal;
                      }
                      
                      if (isLeftOk && isRightOk) {
                        peaks.add(i);
                      }
                    }
                    return peaks;
                  };

                  const currentLocalPeaks = getLocalPeakIndices(combinedChartData, 'count');
                  const prevLocalPeaks = getLocalPeakIndices(combinedChartData, 'prevCount');
                  const customLocalPeaks = getLocalPeakIndices(combinedChartData, 'customCount');

                  // Calculate milestones reached (5, 10, 15, 20) in the current 7 days period
                  const milestoneTargets = [5, 10, 15, 20];
                  const milestonesToRender: { date: string; count: number; milestone: number; tier: MilestoneTier }[] = [];
                  let runningSum = 0;
                  const reachedSet = new Set<number>();

                  analyticsData.forEach((day) => {
                    runningSum += day.count || 0;
                    for (const target of milestoneTargets) {
                      if (runningSum >= target && !reachedSet.has(target)) {
                        reachedSet.add(target);
                        milestonesToRender.push({
                          date: day.date,
                          count: day.count || 0,
                          milestone: target,
                          tier: getMilestoneTier(target)
                        });
                      }
                    }
                  });

                  // Calculate dates where current scan count exceeded daily average by 50% or more
                  const rawDailyAvg = currentTotal / 7;
                  const highScanThreshold = rawDailyAvg * 1.5;
                  const highScansToRender: { date: string; count: number; percentOver: number }[] = [];
                  
                  if (rawDailyAvg > 0) {
                    analyticsData.forEach((day) => {
                      const count = day.count || 0;
                      if (count >= highScanThreshold) {
                        const percentOver = Math.round(((count - rawDailyAvg) / rawDailyAvg) * 100);
                        highScansToRender.push({
                          date: day.date,
                          count,
                          percentOver
                        });
                      }
                    });
                  }

                  const RenderCurrentPeakLabel = (props: any) => {
                    const { x, y, value, index } = props;
                    const actualIdx = startIdx + index;
                    if (currentLocalPeaks.has(actualIdx)) {
                      const isRecord = value > 0 && value === storedAllTimeHigh;
                      if (isRecord) {
                        return (
                          <g opacity="0">
                            <animate
                              attributeName="opacity"
                              from="0"
                              to="1"
                              dur="0.4s"
                              begin="0.1s"
                              fill="freeze"
                            />
                            <animateTransform
                              attributeName="transform"
                              type="translate"
                              from={`0, 6`}
                              to={`0, 0`}
                              dur="0.4s"
                              begin="0.1s"
                              fill="freeze"
                            />
                            <rect
                              x={x - 27}
                              y={y - 33}
                              width="54"
                              height="24"
                              rx="6"
                              fill="#b45309"
                              stroke="#fafcfc"
                              strokeWidth={1.5}
                            />
                            <path
                              d={`M ${x - 4} ${y - 9} L ${x + 4} ${y - 9} L ${x} ${y - 5} Z`}
                              fill="#b45309"
                            />
                            <text
                              x={x}
                              y={y - 23}
                              textAnchor="middle"
                              fill="#fef08a"
                              fontSize="7"
                              fontWeight="900"
                              letterSpacing="0.05em"
                            >
                              ★ RECORD
                            </text>
                            <text
                              x={x}
                              y={y - 12}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="10"
                              fontWeight="900"
                            >
                              {value}
                            </text>
                          </g>
                        );
                      }

                      return (
                        <g opacity="0">
                          <animate
                            attributeName="opacity"
                            from="0"
                            to="1"
                            dur="0.4s"
                            begin="0.1s"
                            fill="freeze"
                          />
                          <animateTransform
                            attributeName="transform"
                            type="translate"
                            from={`0, 6`}
                            to={`0, 0`}
                            dur="0.4s"
                            begin="0.1s"
                            fill="freeze"
                          />
                          <rect
                            x={x - 14}
                            y={y - 25}
                            width="28"
                            height="16"
                            rx="4"
                            fill="#808000"
                            stroke="#ffffff"
                            strokeWidth={1}
                          />
                          <path
                            d={`M ${x - 3} ${y - 9} L ${x + 3} ${y - 9} L ${x} ${y - 6} Z`}
                            fill="#808000"
                          />
                          <text
                            x={x}
                            y={y - 14}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="9"
                            fontWeight="extrabold"
                          >
                            {value}
                          </text>
                        </g>
                      );
                    }
                    return null;
                  };

                  const RenderPreviousPeakLabel = (props: any) => {
                    const { x, y, value, index } = props;
                    const actualIdx = startIdx + index;
                    if (prevLocalPeaks.has(actualIdx)) {
                      const isRecord = value > 0 && value === storedAllTimeHigh;
                      if (isRecord) {
                        return (
                          <g opacity="0">
                            <animate
                              attributeName="opacity"
                              from="0"
                              to="1"
                              dur="0.4s"
                              begin="0.1s"
                              fill="freeze"
                            />
                            <animateTransform
                              attributeName="transform"
                              type="translate"
                              from={`0, 6`}
                              to={`0, 0`}
                              dur="0.4s"
                              begin="0.1s"
                              fill="freeze"
                            />
                            <rect
                              x={x - 27}
                              y={y - 33}
                              width="54"
                              height="24"
                              rx="6"
                              fill="#b45309"
                              stroke="#fafcfc"
                              strokeWidth={1.5}
                            />
                            <path
                              d={`M ${x - 4} ${y - 9} L ${x + 4} ${y - 9} L ${x} ${y - 5} Z`}
                              fill="#b45309"
                            />
                            <text
                              x={x}
                              y={y - 23}
                              textAnchor="middle"
                              fill="#fef08a"
                              fontSize="7"
                              fontWeight="900"
                              letterSpacing="0.05em"
                            >
                              ★ RECORD
                            </text>
                            <text
                              x={x}
                              y={y - 12}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="10"
                              fontWeight="900"
                            >
                              {value}
                            </text>
                          </g>
                        );
                      }

                      return (
                        <g opacity="0">
                          <animate
                            attributeName="opacity"
                            from="0"
                            to="1"
                            dur="0.4s"
                            begin="0.1s"
                            fill="freeze"
                          />
                          <animateTransform
                            attributeName="transform"
                            type="translate"
                            from={`0, 6`}
                            to={`0, 0`}
                            dur="0.4s"
                            begin="0.1s"
                            fill="freeze"
                          />
                          <rect
                            x={x - 14}
                            y={y - 25}
                            width="28"
                            height="16"
                            rx="4"
                            fill="#d97706"
                            stroke="#ffffff"
                            strokeWidth={1}
                          />
                          <path
                            d={`M ${x - 3} ${y - 9} L ${x + 3} ${y - 9} L ${x} ${y - 6} Z`}
                            fill="#d97706"
                          />
                          <text
                            x={x}
                            y={y - 14}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="9"
                            fontWeight="extrabold"
                          >
                            {value}
                          </text>
                        </g>
                      );
                    }
                    return null;
                  };

                  const RenderCustomPeakLabel = (props: any) => {
                    const { x, y, value, index } = props;
                    const actualIdx = startIdx + index;
                    if (showCustomPeriod && customLocalPeaks.has(actualIdx)) {
                      const isRecord = value > 0 && value === storedAllTimeHigh;
                      if (isRecord) {
                        return (
                          <g opacity="0">
                            <animate
                              attributeName="opacity"
                              from="0"
                              to="1"
                              dur="0.4s"
                              begin="0.1s"
                              fill="freeze"
                            />
                            <animateTransform
                              attributeName="transform"
                              type="translate"
                              from={`0, 6`}
                              to={`0, 0`}
                              dur="0.4s"
                              begin="0.1s"
                              fill="freeze"
                            />
                            <rect
                              x={x - 27}
                              y={y - 33}
                              width="54"
                              height="24"
                              rx="6"
                              fill="#b45309"
                              stroke="#fafcfc"
                              strokeWidth={1.5}
                            />
                            <path
                              d={`M ${x - 4} ${y - 9} L ${x + 4} ${y - 9} L ${x} ${y - 5} Z`}
                              fill="#b45309"
                            />
                            <text
                              x={x}
                              y={y - 23}
                              textAnchor="middle"
                              fill="#fef08a"
                              fontSize="7"
                              fontWeight="900"
                              letterSpacing="0.05em"
                            >
                              ★ RECORD
                            </text>
                            <text
                              x={x}
                              y={y - 12}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="10"
                              fontWeight="900"
                            >
                              {value}
                            </text>
                          </g>
                        );
                      }

                      return (
                        <g opacity="0">
                          <animate
                            attributeName="opacity"
                            from="0"
                            to="1"
                            dur="0.4s"
                            begin="0.1s"
                            fill="freeze"
                          />
                          <animateTransform
                            attributeName="transform"
                            type="translate"
                            from={`0, 6`}
                            to={`0, 0`}
                            dur="0.4s"
                            begin="0.1s"
                            fill="freeze"
                          />
                          <rect
                            x={x - 14}
                            y={y - 25}
                            width="28"
                            height="16"
                            rx="4"
                            fill="#6366f1"
                            stroke="#ffffff"
                            strokeWidth={1}
                          />
                          <path
                            d={`M ${x - 3} ${y - 9} L ${x + 3} ${y - 9} L ${x} ${y - 6} Z`}
                            fill="#6366f1"
                          />
                          <text
                            x={x}
                            y={y - 14}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="9"
                            fontWeight="extrabold"
                          >
                            {value}
                          </text>
                        </g>
                      );
                    }
                    return null;
                  };

                  return (
                    <div className="w-full flex flex-col font-sans" id={`analytics-chart-view-${gathering.id}`}>
                      {/* Trend Range Selector Header block with dropdown */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-stone-200/40 px-1 bg-stone-50/40 p-2.5 rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-olive opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-olive"></span>
                          </span>
                          <span className="text-[10px] text-stone-700 font-extrabold uppercase tracking-widest font-sans">
                            Current Range: <strong className="text-olive">{analyticsDateRange} Days Horizon</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2" id={`analytics-range-selector-${gathering.id}`}>
                          <span className="text-[10.5px] text-stone-500 font-bold font-sans">Date Range:</span>
                          <div className="relative">
                            <select
                              value={analyticsDateRange}
                              onChange={(e) => {
                                const val = Number(e.target.value) as 7 | 30 | 90;
                                setAnalyticsDateRange(val);
                              }}
                              className="appearance-none bg-white pr-9 pl-3.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-widest text-[#808000] border border-stone-200 hover:border-[#808000]/40 rounded-xl cursor-pointer shadow-inner focus:outline-none focus:ring-1 focus:ring-olive transition-all duration-200"
                              id={`analytics-time-range-select-${gathering.id}`}
                            >
                              <option value="7">Last 7 Days</option>
                              <option value="30">Last 30 Days</option>
                              <option value="90">Last 90 Days</option>
                            </select>
                            <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[#808000]">
                              <ChevronDown className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Comparisons Toggle Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 mt-1 px-1">
                        <span className="text-[10px] text-[#808000] font-extrabold uppercase tracking-wider font-sans">
                          Compare Periods
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setShowPrevPeriod(!showPrevPeriod)}
                            className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest rounded-full border transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none ${showPrevPeriod ? 'bg-amber-100/50 text-amber-850 border-amber-300' : 'bg-stone-100/70 text-stone-500 border-stone-200 hover:text-stone-700'}`}
                            id={`analytics-toggle-prev-period-${gathering.id}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${showPrevPeriod ? 'bg-amber-500' : 'bg-stone-300'}`} />
                            <span>Previous {analyticsDateRange} Days</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowYearAgoPeriod(!showYearAgoPeriod)}
                            className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest rounded-full border transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none ${showYearAgoPeriod ? 'bg-blue-100/50 text-blue-800 border-blue-300 animate-pulse-subtle' : 'bg-stone-100/70 text-stone-500 border-stone-200 hover:text-stone-700'}`}
                            id={`analytics-toggle-yearago-period-${gathering.id}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${showYearAgoPeriod ? 'bg-blue-500' : 'bg-stone-300'}`} />
                            <span>Compare to last year</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowCustomPeriod(!showCustomPeriod)}
                            className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest rounded-full border transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none ${showCustomPeriod ? 'bg-indigo-100/50 text-indigo-800 border-indigo-300 animate-pulse-subtle' : 'bg-stone-100/70 text-stone-500 border-stone-200 hover:text-stone-700'}`}
                            id={`analytics-toggle-custom-period-${gathering.id}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${showCustomPeriod ? 'bg-indigo-500' : 'bg-stone-300'}`} />
                            <span>Custom Period</span>
                          </button>
                        </div>
                      </div>

                      {/* Scan Density, YoY Comparison, and Smoothing Settings Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5 mt-1.5 px-1 border-t border-stone-100 pt-2.5">
                        <span className="text-[10px] text-[#808000] font-extrabold uppercase tracking-wider font-sans">
                          Overlay Settings
                        </span>
                        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                          {/* Scan Density Toggle */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9.5px] font-extrabold text-stone-500 uppercase tracking-widest select-none">
                              Density Heatmap:
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowScanDensity(!showScanDensity)}
                              className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                showScanDensity ? 'bg-emerald-500' : 'bg-stone-200'
                              }`}
                              id={`analytics-density-toggle-${gathering.id}`}
                            >
                              <span className="sr-only">Enable Scan Density Overlay</span>
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                  showScanDensity ? 'translate-x-3.5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className="text-[9px] font-bold text-stone-400 uppercase select-none">
                              {showScanDensity ? 'On' : 'Off'}
                            </span>
                          </div>

                          {/* Year-over-Year Toggle */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9.5px] font-extrabold text-stone-500 uppercase tracking-widest select-none">
                              YoY Trend Line (365d ago):
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowYearAgoPeriod(!showYearAgoPeriod)}
                              className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                showYearAgoPeriod ? 'bg-blue-500' : 'bg-stone-200'
                              }`}
                              id={`analytics-yoy-toggle-${gathering.id}`}
                            >
                              <span className="sr-only">Enable Year-over-Year Comparison</span>
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                  showYearAgoPeriod ? 'translate-x-3.5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className="text-[9px] font-bold text-stone-400 uppercase select-none">
                              {showYearAgoPeriod ? 'On' : 'Off'}
                            </span>
                          </div>

                          {/* Smoothing Toggle */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9.5px] font-extrabold text-[#808000] uppercase tracking-widest select-none">
                              Trend Smoothing (SMA):
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowSmoothing(!showSmoothing)}
                              className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                showSmoothing ? 'bg-[#808000]' : 'bg-stone-200'
                              }`}
                              id={`analytics-smoothing-toggle-${gathering.id}`}
                            >
                              <span className="sr-only">Enable Trend Smoothing</span>
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                  showSmoothing ? 'translate-x-3.5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className="text-[9px] font-bold text-[#808000] uppercase select-none">
                              {showSmoothing ? 'On' : 'Off'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Custom Date Picker Inline Control */}
                      {showCustomPeriod && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3 mt-1 px-1.5 py-2 bg-indigo-50/40 border border-indigo-100/40 rounded-xl">
                          <span className="text-[9px] text-indigo-850 font-extrabold uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block shrink-0" />
                            Custom Period Start Date:
                          </span>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="bg-white border border-indigo-200/80 rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer w-full sm:w-auto"
                            id={`analytics-custom-date-picker-${gathering.id}`}
                          />
                          <span className="text-[8.5px] text-stone-400 font-bold sm:ml-auto italic">
                            Plots 7 days starting on this date
                          </span>
                        </div>
                      )}

                      {/* Zoom control helper indicator */}
                      <div className="flex items-center justify-between px-3 py-1.5 bg-[#808000]/5 border border-[#808000]/15 rounded-xl mb-2.5 mt-1 select-none animate-fadeIn">
                        <div className="flex items-center gap-2 text-[#808000] text-[10px] font-extrabold uppercase tracking-widest">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#808000] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#808000]"></span>
                          </span>
                          {zoomRange ? (
                            <span>Zoom: Day {startIdx + 1} to {endIdx + 1} of {totalPoints} (Grab & Drag to Pan)</span>
                          ) : (
                            <span>Zoom Tip: Hover chart & Scroll wheel to zoom in</span>
                          )}
                        </div>
                        {zoomRange ? (
                          <button
                            type="button"
                            onClick={() => setZoomRange(null)}
                            className="text-[9px] font-extrabold uppercase tracking-widest text-[#808000] hover:text-[#909000] bg-[#808000]/10 hover:bg-[#808000]/20 px-2.5 py-1 rounded-full cursor-pointer transition-all active:scale-95"
                          >
                            Reset Zoom
                          </button>
                        ) : (
                          <span className="text-[9px] text-stone-400 font-medium italic">Interactive Chart</span>
                        )}
                      </div>

                      <div 
                        ref={chartRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseLeave={handleMouseUpOrLeave}
                        className={`w-full h-64 mt-1 bg-white p-4 rounded-2xl border border-stone-200/60 shadow-inner flex flex-col justify-center transition-all ${zoomRange ? 'cursor-grab active:cursor-grabbing border-blue-200 shadow-blue-50/50' : ''}`}
                        id={`analytics-chart-container-${gathering.id}`}
                      >
                        <div className="w-full h-full" style={{ minHeight: '220px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={visibleChartData} margin={{ top: 25, right: 15, left: -25, bottom: 5 }}>
                              {showScanDensity && (
                                <defs>
                                  {visibleChartData.map((day, idx) => {
                                    const actualIdx = startIdx + idx;
                                    const segments = [0, 0, 0, 0, 0, 0];
                                    const matchingDay = analyticsData[actualIdx];
                                    if (matchingDay && matchingDay.timestamps) {
                                      matchingDay.timestamps.forEach((t) => {
                                        const dateObj = new Date(t.timestamp);
                                        const hour = dateObj.getHours();
                                        const segmentIdx = Math.min(5, Math.floor(hour / 4));
                                        segments[segmentIdx]++;
                                      });
                                    }

                                    let maxSeg = 1;
                                    analyticsData.forEach((d) => {
                                      const segs = [0, 0, 0, 0, 0, 0];
                                      if (d.timestamps) {
                                        d.timestamps.forEach((t) => {
                                          const dateObj = new Date(t.timestamp);
                                          const hr = dateObj.getHours();
                                          const segIdx = Math.min(5, Math.floor(hr / 4));
                                          segs[segIdx]++;
                                        });
                                      }
                                      const currentMaxSeg = Math.max(...segs, 0);
                                      if (currentMaxSeg > maxSeg) {
                                        maxSeg = currentMaxSeg;
                                      }
                                    });

                                    return (
                                      <linearGradient
                                        key={`density-gradient-${gathering.id}-${actualIdx}-${day.date}`}
                                        id={`scan-density-grad-${gathering.id}-${actualIdx}`}
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                      >
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.01 + (segments[5] / maxSeg) * 0.18} />
                                        <stop offset="20%" stopColor="#10b981" stopOpacity={0.01 + (segments[4] / maxSeg) * 0.18} />
                                        <stop offset="40%" stopColor="#10b981" stopOpacity={0.01 + (segments[3] / maxSeg) * 0.18} />
                                        <stop offset="60%" stopColor="#10b981" stopOpacity={0.01 + (segments[2] / maxSeg) * 0.18} />
                                        <stop offset="80%" stopColor="#10b981" stopOpacity={0.01 + (segments[1] / maxSeg) * 0.18} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.01 + (segments[0] / maxSeg) * 0.18} />
                                      </linearGradient>
                                    );
                                  })}
                                </defs>
                              )}
                              {showScanDensity && visibleChartData.map((day, idx) => {
                                const actualIdx = startIdx + idx;
                                return (
                                  <ReferenceArea
                                    {...({
                                      key: `density-area-${gathering.id}-${actualIdx}-${day.date}`,
                                      x1: day.date,
                                      x2: day.date,
                                      fill: `url(#scan-density-grad-${gathering.id}-${actualIdx})`,
                                      strokeOpacity: 0
                                    } as any)}
                                  />
                                );
                              })}
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ec" vertical={false} />
                              <XAxis 
                                dataKey="date" 
                                tick={{ fill: '#78716c', fontSize: 10, fontWeight: 600 }}
                                axisLine={{ stroke: '#e7e5e4' }}
                                tickLine={false}
                              />
                              <YAxis 
                                tick={{ fill: '#78716c', fontSize: 10, fontWeight: 500 }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                              />
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: '#1c1917',
                                  borderRadius: '12px',
                                  border: 'none',
                                  color: '#faf8f5',
                                  fontSize: '11px',
                                  fontFamily: 'sans-serif',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                }}
                                labelStyle={{ fontWeight: 'bold', color: '#eae6df' }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="count" 
                                stroke="#808000" 
                                strokeWidth={3} 
                                dot={{ r: 4, stroke: '#808000', strokeWidth: 2, fill: '#faf8f5' }}
                                activeDot={{ r: 6, stroke: '#808000', strokeWidth: 2, fill: '#808000' }}
                                name="Current Period" 
                                label={<RenderCurrentPeakLabel />}
                              />
                              {showPrevPeriod && (
                                <Line 
                                  type="monotone" 
                                  dataKey="prevCount" 
                                  stroke="#d97706" 
                                  strokeWidth={2} 
                                  strokeDasharray="4 4"
                                  dot={{ r: 3, stroke: '#d97706', strokeWidth: 1.5, fill: '#faf8f5' }}
                                  activeDot={{ r: 5, stroke: '#d97706', strokeWidth: 1.5, fill: '#d97706' }}
                                  name="Previous Period" 
                                  label={<RenderPreviousPeakLabel />}
                                />
                              )}
                              {showYearAgoPeriod && (
                                <Line 
                                  type="monotone" 
                                  dataKey="yearAgoCount" 
                                  stroke="#2563eb" 
                                  strokeWidth={2} 
                                  strokeDasharray="3 3"
                                  dot={{ r: 3, stroke: '#2563eb', strokeWidth: 1.5, fill: '#faf8f5' }}
                                  activeDot={{ r: 5, stroke: '#2563eb', strokeWidth: 1.5, fill: '#2563eb' }}
                                  name="1 Year Ago (YoY)" 
                                />
                              )}
                              {showCustomPeriod && (
                                <Line 
                                  type="monotone" 
                                  dataKey="customCount" 
                                  stroke="#6366f1" 
                                  strokeWidth={2.5} 
                                  strokeDasharray="2 2"
                                  dot={{ r: 3.5, stroke: '#6366f1', strokeWidth: 1.5, fill: '#faf8f5' }}
                                  activeDot={{ r: 5.5, stroke: '#6366f1', strokeWidth: 1.5, fill: '#6366f1' }}
                                  name="Custom Period" 
                                  label={<RenderCustomPeakLabel />}
                                />
                              )}

                              {/* Milestone Annotation Markers */}
                              {milestonesToRender.map((m, idx) => (
                                <ReferenceDot
                                  key={`milestone-badge-${gathering.id}-${m.milestone}`}
                                  x={m.date}
                                  y={m.count}
                                  r={6}
                                  shape={(props: any) => {
                                    const { cx, cy } = props;
                                    return (
                                      <g opacity="0" className="cursor-pointer select-none">
                                        <animate
                                          attributeName="opacity"
                                          from="0"
                                          to="1"
                                          dur="0.5s"
                                          begin={`${0.15 + idx * 0.1}s`}
                                          fill="freeze"
                                        />
                                        <animateTransform
                                          attributeName="transform"
                                          type="translate"
                                          from="0, 8"
                                          to="0, 0"
                                          dur="0.5s"
                                          begin={`${0.15 + idx * 0.1}s`}
                                          fill="freeze"
                                        />
                                        {/* Colored glowing indicator dot */}
                                        <circle
                                          cx={cx}
                                          cy={cy}
                                          r={10}
                                          fill={m.tier.accentColor}
                                          opacity="0.15"
                                          className="animate-pulse-subtle"
                                        />
                                        <circle
                                          cx={cx}
                                          cy={cy}
                                          r={5}
                                          fill="#ffffff"
                                          stroke={m.tier.accentColor}
                                          strokeWidth={2}
                                        />
                                        {/* Fine dashed connecting line up to the badge */}
                                        <line
                                          x1={cx}
                                          y1={cy - 5}
                                          x2={cx}
                                          y2={cy - 20}
                                          stroke={m.tier.accentColor}
                                          strokeWidth={1}
                                          strokeDasharray="1.5 1.5"
                                        />
                                        {/* Main Badge Card */}
                                        <rect
                                          x={cx - 15}
                                          y={cy - 39}
                                          width="30"
                                          height="20"
                                          rx="5"
                                          fill="#ffffff"
                                          stroke={m.tier.accentColor}
                                          strokeWidth={1.5}
                                          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))' }}
                                        />
                                        {/* Tint overlay */}
                                        <rect
                                          x={cx - 15}
                                          y={cy - 39}
                                          width="30"
                                          height="20"
                                          rx="5"
                                          fill={m.tier.accentColor}
                                          opacity="0.04"
                                        />
                                        {/* Medal Emoji emoji */}
                                        <text
                                          x={cx}
                                          y={cy - 26}
                                          textAnchor="middle"
                                          fontSize="11"
                                        >
                                          {m.tier.emoji}
                                        </text>
                                        {/* Target number label above */}
                                        <rect
                                          x={cx - 8}
                                          y={cy - 47}
                                          width="16"
                                          height="9"
                                          rx="2.5"
                                          fill={m.tier.accentColor}
                                        />
                                        <text
                                          x={cx}
                                          y={cy - 40}
                                          textAnchor="middle"
                                          fill="#ffffff"
                                          fontSize="7"
                                          fontWeight="900"
                                          fontFamily="sans-serif"
                                        >
                                          {m.milestone}
                                        </text>
                                      </g>
                                    );
                                  }}
                                />
                              ))}

                              {/* High-volume Scan Days (>50% of Average) Annotation Markers */}
                              {highScansToRender.map((hs, idx) => (
                                <ReferenceDot
                                  key={`high-scan-badge-${gathering.id}-${hs.date}`}
                                  x={hs.date}
                                  y={hs.count}
                                  r={6}
                                  shape={(props: any) => {
                                    const { cx, cy } = props;
                                    return (
                                      <g opacity="0" className="cursor-pointer select-none">
                                        <animate
                                          attributeName="opacity"
                                          from="0"
                                          to="1"
                                          dur="0.5s"
                                          begin={`${0.2 + idx * 0.1}s`}
                                          fill="freeze"
                                        />
                                        <animateTransform
                                          attributeName="transform"
                                          type="translate"
                                          from="0, -8"
                                          to="0, 0"
                                          dur="0.5s"
                                          begin={`${0.2 + idx * 0.1}s`}
                                          fill="freeze"
                                        />
                                        {/* Glowing teal ring */}
                                        <circle
                                          cx={cx}
                                          cy={cy}
                                          r={12}
                                          fill="#10b981"
                                          opacity="0.12"
                                          className="animate-pulse-subtle"
                                        />
                                        <circle
                                          cx={cx}
                                          cy={cy}
                                          r={6}
                                          fill="#ffffff"
                                          stroke="#10b981"
                                          strokeWidth={2.5}
                                        />
                                        <line
                                          x1={cx}
                                          y1={cy - 6}
                                          x2={cx}
                                          y2={cy - 16}
                                          stroke="#10b981"
                                          strokeWidth={1}
                                          strokeDasharray="2 2"
                                        />
                                        {/* Pill Badge */}
                                        <rect
                                          x={cx - 24}
                                          y={cy - 34}
                                          width="48"
                                          height="18"
                                          rx="5"
                                          fill="#ffffff"
                                          stroke="#10b981"
                                          strokeWidth={1.5}
                                          style={{ filter: 'drop-shadow(0 2px 4px rgba(16,185,129,0.12))' }}
                                        />
                                        {/* Accent side tag inside pill */}
                                        <rect
                                          x={cx - 24}
                                          y={cy - 34}
                                          width="4"
                                          height="18"
                                          rx="2"
                                          fill="#10b981"
                                        />
                                        {/* Percentage Label */}
                                        <text
                                          x={cx + 1}
                                          y={cy - 22}
                                          textAnchor="middle"
                                          fill="#065f46"
                                          fontSize="8.5"
                                          fontWeight="900"
                                          fontFamily="sans-serif"
                                        >
                                          +{hs.percentOver}%
                                        </text>
                                      </g>
                                    );
                                  }}
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Insights panel */}
                      <div className="flex flex-col gap-1.5 text-[10px] text-stone-500 font-bold px-1 mt-3 border-t border-stone-100 pt-3 select-none">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-olive inline-block" />
                            <span>Current Total (7d): <strong className="text-stone-850 font-extrabold">{currentTotal}</strong></span>
                          </div>
                          <div>
                            <span>Current Daily Avg: <strong className="text-stone-850 font-extrabold">{currentAvg}</strong></span>
                          </div>
                        </div>

                        {/* All-Time Historic Record Banner */}
                        {storedAllTimeHigh > 0 && (
                          <div className="flex items-center justify-between text-amber-800 bg-[#b45309]/5 px-2 py-1.5 rounded-lg border border-[#b45309]/15 mt-1 animate-fadeIn">
                            <div className="flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
                              </span>
                              <span>All-Time Record Daily Vol: <strong className="text-[#b45309] font-extrabold">{storedAllTimeHigh} scans</strong></span>
                            </div>
                            <span className="text-[8px] font-black uppercase text-white bg-[#b45309] px-1.5 py-0.5 rounded-full tracking-wider">
                              ★ All-Time High
                            </span>
                          </div>
                        )}
                        {showPrevPeriod && (
                          <div className="flex items-center justify-between text-amber-700 bg-amber-50/50 px-2 py-1.5 rounded-lg border border-amber-100/50 transition-all duration-200 mt-1 animate-fadeIn">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
                              <span>Previous Total (7d): <strong className="text-amber-900 font-extrabold">{previousTotal}</strong></span>
                            </div>
                            <div>
                              <span>Previous Daily Avg: <strong className="text-amber-900 font-extrabold">{previousAvg}</strong></span>
                            </div>
                          </div>
                        )}
                        {showYearAgoPeriod && (
                          <div className="flex items-center justify-between text-blue-700 bg-blue-50/50 px-2 py-1.5 rounded-lg border border-blue-100/50 transition-all duration-200 mt-1 animate-fadeIn">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                              <span>Last Year Total (YoY): <strong className="text-blue-900 font-extrabold">{yearAgoTotal}</strong></span>
                            </div>
                            <div>
                              <span>Last Year Daily Avg: <strong className="text-blue-900 font-extrabold">{yearAgoAvg}</strong></span>
                            </div>
                          </div>
                        )}
                        {showCustomPeriod && (
                          <div className="flex items-center justify-between text-indigo-700 bg-indigo-50/50 px-2 py-1.5 rounded-lg border border-indigo-100/40 transition-all duration-200 mt-1 animate-fadeIn animate-pulse-subtle">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                              <span>Custom Period Total (7d): <strong className="text-indigo-900 font-extrabold">{customTotal}</strong></span>
                            </div>
                            <div>
                              <span>Custom Daily Avg: <strong className="text-indigo-900 font-extrabold">{customAvg}</strong></span>
                            </div>
                          </div>
                        )}

                        {/* Milestones Reached Legend */}
                        {milestonesToRender.length > 0 && (
                          <div className="mt-3.5 bg-stone-50/80 border border-stone-200/50 p-2.5 rounded-2xl animate-fadeIn">
                            <span className="text-[9px] uppercase tracking-wider text-stone-400 font-black mb-1.5 block">
                              🎉 Milestones Reached (Current Period Cumulative)
                            </span>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {milestonesToRender.map((m, mIdx) => (
                                <div 
                                  key={`m-leg-${mIdx}`}
                                  className="flex items-center gap-2 p-1.5 bg-white border border-stone-150 rounded-xl shadow-sm transition-all duration-200 hover:shadow-md"
                                >
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: `${m.tier.accentColor}10` }}>
                                    {m.tier.emoji}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-extrabold leading-tight" style={{ color: m.tier.accentColor }}>
                                      {m.tier.tier} Tier
                                    </span>
                                    <span className="text-[8px] font-bold text-stone-400 leading-none mt-0.5">
                                      {m.milestone} Total Scans
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* High Scan Days Legend */}
                        {highScansToRender.length > 0 && (
                          <div className="mt-2 bg-emerald-50/40 border border-emerald-150/40 p-2.5 rounded-2xl animate-fadeIn">
                            <span className="text-[9px] uppercase tracking-wider text-emerald-800 font-black mb-1.5 block flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-subtle" />
                              📈 High-Volume Scan Days (Exceeded Daily Average by ≥ 50%)
                            </span>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {highScansToRender.map((hs, hsIdx) => (
                                <div 
                                  key={`hs-leg-${hsIdx}`}
                                  className="flex items-center gap-2 p-1.5 bg-white border border-emerald-100/60 rounded-xl shadow-sm transition-all duration-200 hover:shadow-md"
                                >
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs bg-emerald-50 text-emerald-600 font-extrabold font-mono">
                                    +{hs.percentOver}%
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-extrabold leading-tight text-emerald-950">
                                      {hs.date}
                                    </span>
                                    <span className="text-[8px] font-bold text-stone-400 leading-none mt-0.5">
                                      {hs.count} Scans
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Scan Density Heatmap Legend overlay */}
                        {showScanDensity && (
                          <div className="mt-2 bg-emerald-50/40 border border-emerald-150/40 p-2.5 rounded-2xl animate-fadeIn" id={`scan-density-legend-${gathering.id}`}>
                            <span className="text-[9px] uppercase tracking-wider text-emerald-800 font-extrabold mb-1.5 block flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              🟢 Scan Density Overlay active
                            </span>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <p className="text-[9.5px] text-stone-500 leading-normal">
                                The vertical green bands display the hourly scan densities for each day — 
                                <strong> darker accents near the top</strong> correspond to late-evening scans, and 
                                <strong> darker accents near the bottom</strong> correspond to morning scans.
                              </p>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[9px] text-stone-400 font-bold">Low</span>
                                <div className="w-16 h-3.5 bg-gradient-to-r from-emerald-50 to-emerald-500/30 border border-emerald-200/50 rounded-md" />
                                <span className="text-[9px] text-emerald-600 font-extrabold">Peak</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="w-full flex flex-col" id={`analytics-table-view-${gathering.id}`}>
                    {/* Search Input Field */}
                    <div className="relative w-full mb-2.5 px-0.5" id={`analytics-search-container-${gathering.id}`}>
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Search className="h-3.5 w-3.5 text-stone-400" />
                      </div>
                      <input
                        type="text"
                        value={analyticsSearchQuery}
                        onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                        placeholder="Filter logs by date, day, time or timestamp..."
                        className="w-full pl-9 pr-8 py-2 bg-white border border-stone-200 hover:border-stone-300 focus:border-olive focus:outline-none focus:ring-1 focus:ring-olive rounded-xl text-xs font-semibold text-stone-800 placeholder-stone-400 shadow-xs transition-all"
                        id={`analytics-search-input-${gathering.id}`}
                      />
                      {analyticsSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setAnalyticsSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                          id={`analytics-search-clear-btn-${gathering.id}`}
                          title="Clear filter text"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="w-full mt-1 flex flex-col bg-white rounded-2xl border border-stone-200/60 p-4 shadow-inner">
                      <div className="flex items-center justify-between text-[9px] text-stone-400 font-bold uppercase tracking-wider pb-2 border-b border-stone-100">
                        <span className="w-1/2 text-left font-extrabold">Date / Day</span>
                        <span className="w-1/2 text-right font-extrabold">Timestamp Log</span>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-stone-100 pr-1 mt-1" style={{ scrollbarWidth: 'thin' }}>
                        {(() => {
                          const logs = [...analyticsData]
                            .flatMap(day => (day.timestamps || []))
                            .sort((a, b) => b.timestamp - a.timestamp);

                          const query = analyticsSearchQuery.toLowerCase().trim();
                          const filteredLogs = logs.filter(log => {
                            if (!query) return true;
                            const logDate = new Date(log.timestamp);
                            const dateLabel = logDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' }).toLowerCase();
                            const fullDate = (log.dateString || '').toLowerCase();
                            const timeStr = (log.timeString || '').toLowerCase();
                            const tsStr = log.timestamp.toString();
                            return dateLabel.includes(query) || fullDate.includes(query) || timeStr.includes(query) || tsStr.includes(query);
                          });

                          if (filteredLogs.length > 0) {
                            return filteredLogs.map((log, idx) => {
                              const logDate = new Date(log.timestamp);
                              const isToday = log.dateString === new Date().toISOString().split('T')[0];
                              const dateLabel = logDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
                              
                              return (
                                <div key={`${log.timestamp}-${idx}`} className="flex items-center justify-between py-2 text-xs hover:bg-stone-50/50 rounded-lg px-1 transition-colors">
                                  <span className="font-sans font-bold flex items-center gap-1.5 text-stone-600">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`} />
                                    <span>{dateLabel}</span>
                                    {isToday && (
                                      <span className="text-[7.5px] font-black uppercase text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded">Today</span>
                                    )}
                                  </span>
                                  <span className="font-mono text-[11px] font-semibold text-stone-800 flex items-center gap-1.5 bg-stone-50 px-2 py-0.5 rounded border border-stone-100/80">
                                    <Clock className="w-3 h-3 text-stone-400" />
                                    <span>{log.timeString}</span>
                                  </span>
                                </div>
                              );
                            });
                          } else {
                            if (logs.length > 0) {
                              return (
                                <div className="text-center py-8 text-xs text-stone-400 italic">
                                  No logs match "{analyticsSearchQuery}".
                                </div>
                              );
                            }
                            return (
                              <div className="text-center py-8 text-xs text-stone-400 italic">
                                No activity registered in the last 7 days.
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                    {/* Log table footer summary */}
                    <div className="flex items-center justify-between text-[10px] text-stone-500 font-bold border-t border-stone-100 pt-3 mt-3 px-1">
                      <span>
                        {analyticsSearchQuery ? (
                          <>Matches string: <strong className="text-stone-800 font-black">{
                            [...analyticsData]
                              .flatMap(day => (day.timestamps || []))
                              .filter(log => {
                                const query = analyticsSearchQuery.toLowerCase().trim();
                                const logDate = new Date(log.timestamp);
                                const dateLabel = logDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' }).toLowerCase();
                                const fullDate = (log.dateString || '').toLowerCase();
                                const timeStr = (log.timeString || '').toLowerCase();
                                const tsStr = log.timestamp.toString();
                                return dateLabel.includes(query) || fullDate.includes(query) || timeStr.includes(query) || tsStr.includes(query);
                              }).length
                          }</strong> / {
                            analyticsData.flatMap(day => (day.timestamps || [])).length
                          } total</>
                        ) : (
                          <>Total Registered Logs: <strong className="text-stone-800 font-extrabold">{
                            analyticsData.flatMap(day => (day.timestamps || [])).length
                          }</strong></>
                        )}
                      </span>
                      <span className="text-[9px] text-stone-400 italic font-medium">Sorted: newest first</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Back to Code modal button/footer */}
              <div className="w-full mt-6">
                <button
                  type="button"
                  onClick={() => setIsAnalyticsModalOpen(false)}
                  className="w-full py-3.5 flex items-center justify-center gap-2 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all text-white bg-olive hover:bg-stone-800 cursor-pointer"
                  id={`analytics-panel-dismiss-btn-${gathering.id}`}
                >
                  <Check className="w-4 h-4 text-white" />
                  Dismiss Dashboard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function getCategoryIcon(cat: Category) {
  switch (cat) {
    case 'Arts & Culture': return <Palette className="w-5 h-5 text-olive" />;
    case 'Wellness': return <Sun className="w-5 h-5 text-olive" />;
    case 'Social': return <Users className="w-5 h-5 text-olive" />;
    case 'Learning': return <GraduationCap className="w-5 h-5 text-olive" />;
    case 'Nature': return <Leaf className="w-5 h-5 text-olive" />;
    case 'Food': return <Utensils className="w-5 h-5 text-olive" />;
    default: return null;
  }
}

function MapPinPoint({ gathering, onRSVP, onViewHost, onIcebreakers, reminders = { email: false, push: false }, onToggleReminder }: { gathering: Gathering; onRSVP: (status: 'attending' | 'maybe' | 'not_attending') => void; onViewHost: () => void; onIcebreakers: () => void; reminders: { email: boolean; push: boolean }; onToggleReminder: (type: 'email' | 'push') => void; key?: React.Key }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const isAttending = gathering.attendeeIds.includes(CURRENT_USER.id);
  const isMaybe = gathering.maybeIds.includes(CURRENT_USER.id);

  return (
    <div 
      className="absolute transition-all z-10"
      style={{ left: `${gathering.lng}%`, top: `${gathering.lat}%`, transform: 'translate(-50%, -100%)' }}
    >
      <motion.button 
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 440, damping: 18 }}
        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-shadow duration-300 ${isOpen ? 'bg-olive text-white ring-4 ring-olive/20' : 'bg-white text-olive border border-olive/15'}`}
        tabIndex={0}
        aria-label={`Gathering: ${gathering.title}. Category: ${gathering.category}. Location: ${gathering.location}. Click or press Enter to toggle details dialog.`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {getCategoryIcon(gathering.category)}
      </motion.button>

      <AnimatePresence>
        {isHovered && !isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.85, y: 5, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.85, y: 5, x: '-50%' }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-12 left-1/2 bg-stone-900 border border-stone-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap z-40 pointer-events-none"
            role="tooltip"
          >
            {gathering.title}
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-stone-900" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 w-64 bg-white rounded-[24px] shadow-2xl p-4 border border-gray-100 z-50"
            role="dialog"
            aria-label={`${gathering.title} details`}
          >
            <div className="space-y-3">
              <div className="relative h-24 overflow-hidden rounded-xl">
                <img src={gathering.image} alt={gathering.title} className="w-full h-full object-cover" />
                <button 
                  onClick={() => setIsOpen(false)}
                  className="absolute top-2 right-2 p-1 bg-black/20 backdrop-blur rounded-full text-white cursor-pointer"
                  aria-label="Close details dialog"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div>
                <h4 className="serif text-sm font-semibold truncate">{gathering.title}</h4>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">{gathering.category} • {gathering.location}</p>
                {gathering.tags && gathering.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5" id={`map-popup-tags-${gathering.id}`}>
                    {gathering.tags.map(tag => (
                      <span key={tag} className="text-[8px] font-bold uppercase tracking-wider bg-stone-100 text-stone-605 px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mini Reminder Toggle row */}
              <div className="flex items-center justify-between bg-stone-50 p-2 rounded-xl text-left border border-stone-200/20 animate-fade-in" id={`map-remind-bar-${gathering.id}`}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1 leading-none">
                  <Clock className="w-3 h-3 text-olive shrink-0" /> Remind -1h:
                </span>
                <div className="flex items-center gap-1 bg-stone-200/40 p-0.5 rounded-lg border border-stone-200/10">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleReminder('email'); }}
                    className={`p-1 rounded-md transition-all ${reminders?.email ? 'bg-olive text-white shadow-xs' : 'text-stone-400 hover:text-stone-600'}`}
                    id={`map-email-remind-${gathering.id}`}
                    title="Toggle 1h before Email reminder"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleReminder('push'); }}
                    className={`p-1 rounded-md transition-all ${reminders?.push ? 'bg-olive text-white shadow-xs' : 'text-stone-400 hover:text-stone-600'}`}
                    id={`map-push-remind-${gathering.id}`}
                    title="Toggle 1h before Push notification"
                  >
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRSVP(isAttending ? 'not_attending' : 'attending'); }}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-transform active:scale-95 ${isAttending ? 'bg-olive text-warm-white' : 'bg-warm-bg text-olive border border-olive/10'}`}
                  >
                    {isAttending ? 'Attending' : 'Join'}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onIcebreakers(); }}
                    className="p-2 bg-warm-bg rounded-xl text-olive hover:bg-olive hover:text-white transition-colors"
                    title="Icebreakers"
                  >
                    <Sparkles className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      const shareUrl = `${window.location.origin}${window.location.pathname}?gatheringId=${gathering.id}`;
                      navigator.clipboard.writeText(shareUrl).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className={`p-2 rounded-xl transition-all duration-200 active:scale-95 ${copied ? 'bg-emerald-500 text-white' : 'bg-warm-bg text-stone-605 hover:bg-olive hover:text-white'}`}
                    title={copied ? "Copied!" : "Share Link"}
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                  </button>
                </div>
                {!isAttending && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRSVP(isMaybe ? 'not_attending' : 'maybe'); }}
                    className={`w-full py-2 rounded-xl text-[10px] font-bold uppercase transition-transform active:scale-95 ${isMaybe ? 'bg-olive/10 text-olive' : 'bg-gray-50 text-gray-400'}`}
                  >
                    {isMaybe ? 'Maybe attending' : 'Thinking about it? (Maybe)'}
                  </button>
                )}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onViewHost(); }}
                className="w-full text-center text-[10px] text-gray-400 hover:text-olive font-medium transition-colors"
              >
                View details
              </button>
            </div>
            {/* Arrow */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PoiPinPoint({ poi }: { poi: PointOfInterest; key?: React.Key }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isCurrentlyHighlighted, setIsCurrentlyHighlighted] = useState(false);

  useEffect(() => {
    const handleHighlight = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.poiId === poi.id) {
        setIsOpen(true);
        setIsCurrentlyHighlighted(true);
        setTimeout(() => setIsCurrentlyHighlighted(false), 4000);
      }
    };
    window.addEventListener('gcommunity_highlight_poi', handleHighlight);
    return () => {
      window.removeEventListener('gcommunity_highlight_poi', handleHighlight);
    };
  }, [poi.id]);

  const getPoiIcon = (iconType: string) => {
    switch (iconType) {
      case 'library':
        return <BookOpen className="w-3.5 h-3.5 text-white" />;
      case 'garden':
        return <TreePine className="w-3.5 h-3.5 text-white" />;
      case 'community_center':
        return <Building className="w-3.5 h-3.5 text-white" />;
      case 'pagoda':
        return <Compass className="w-3.5 h-3.5 text-white" />;
      case 'clocktower':
        return <Landmark className="w-3.5 h-3.5 text-white" />;
      case 'market':
        return <Store className="w-3.5 h-3.5 text-white" />;
      default:
        return <Landmark className="w-3.5 h-3.5 text-white" />;
    }
  };

  const getPoiColorClass = (type: 'landmark' | 'community_center') => {
    return type === 'landmark' 
      ? 'bg-amber-600 hover:bg-amber-700 ring-amber-100' 
      : 'bg-indigo-600 hover:bg-indigo-700 ring-indigo-100';
  };

  return (
    <div 
      className="absolute transition-all z-20"
      style={{ left: `${poi.lng}%`, top: `${poi.lat}%`, transform: 'translate(-50%, -100%)' }}
    >
      {isCurrentlyHighlighted && (
        <span className="absolute -inset-2 rounded-full border-2 border-rose-500 animate-ping opacity-75 pointer-events-none z-10" />
      )}
      <motion.button 
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 440, damping: 18 }}
        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-350 relative z-20 ${
          isOpen ? 'ring-4 ring-offset-2 ' + getPoiColorClass(poi.type) : getPoiColorClass(poi.type)
        } ${isCurrentlyHighlighted ? 'animate-bounce ring-4 ring-rose-500 ring-offset-2 scale-110 shadow-rose-200 shadow-2xl' : ''}`}
        tabIndex={0}
        aria-label={`Point of Interest: ${poi.title}. Type: ${poi.type === 'landmark' ? 'Landmark' : 'Community Center'}. Click or press Enter to toggle details dialog.`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {getPoiIcon(poi.iconType)}
      </motion.button>

      <AnimatePresence>
        {isHovered && !isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.85, y: 5, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.85, y: 5, x: '-50%' }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-10 left-1/2 bg-stone-900 border border-stone-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap z-40 pointer-events-none"
            role="tooltip"
          >
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${poi.type === 'landmark' ? 'bg-amber-400' : 'bg-indigo-400'}`} />
              <span>{poi.title}</span>
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-stone-900" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 w-60 bg-white rounded-[20px] shadow-2xl p-4 border border-stone-100 z-50 pointer-events-auto text-left"
            role="dialog"
            aria-label={`${poi.title} Details`}
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    poi.type === 'landmark' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                  }`}>
                    {poi.type === 'landmark' ? 'Landmark' : 'Community Center'}
                  </span>
                  <h4 className="serif text-xs font-bold text-stone-900 mt-1.5">{poi.title}</h4>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-stone-50 rounded-full text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                  aria-label="Close details dialog"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-stone-600">
                {poi.description}
              </p>
              <div className="flex items-center gap-1 text-[8px] font-semibold text-stone-400 uppercase tracking-wider border-t border-stone-100 pt-1.5">
                <MapPin className="w-2.5 h-2.5 shrink-0 text-stone-400" /> Coords: {poi.lng}% W, {poi.lat}% N
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MapClusterPinPoint({ 
  cluster, 
  onRSVP, 
  onViewHost, 
  onIcebreakers,
  reminders = {},
  onToggleReminder,
  onHostAtCluster,
  onCenterOnCluster,
  focusedClusterId = null,
  onToggleFocusCluster,
  mapStyle = 'standard',
  onToggleMapStyle
}: { 
  cluster: { id: string; gatherings: Gathering[]; lat: number; lng: number }; 
  onRSVP: (gatheringId: string, status: 'attending' | 'maybe' | 'not_attending') => void; 
  onViewHost: (hostId: string) => void; 
  onIcebreakers: (gathering: Gathering) => void; 
  reminders: Record<string, { email: boolean; push: boolean }>;
  onToggleReminder: (gatheringId: string, type: 'email' | 'push') => void;
  onHostAtCluster: (lat: number, lng: number, locationName: string) => void;
  onCenterOnCluster?: (lat: number, lng: number) => void;
  focusedClusterId?: string | null;
  onToggleFocusCluster?: (clusterId: string) => void;
  mapStyle?: 'standard' | 'satellite' | 'terrain';
  onToggleMapStyle: (style: 'standard' | 'satellite' | 'terrain') => void;
  key?: React.Key;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [selectedGatheringId, setSelectedGatheringId] = useState<string | null>(null);
  const [previewGatheringId, setPreviewGatheringId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCoordsId, setCopiedCoordsId] = useState<string | null>(null);
  const [copiedLocationId, setCopiedLocationId] = useState<string | null>(null);
  const [copiedClusterCoords, setCopiedClusterCoords] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);
  const [qrScans, setQrScans] = useState<Record<string, number>>({});
  const [isCameraActive, setIsCameraActive] = useState<boolean>(() => (window as any).__gcommunity_camera_active || false);
  const [cameraError, setCameraError] = useState<string | null>(() => (window as any).__gcommunity_camera_error || null);

  useEffect(() => {
    const handleCameraStatus = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setIsCameraActive(customEvent.detail.active || false);
        setCameraError(customEvent.detail.error || null);
      }
    };
    window.addEventListener('gcommunity_camera_status', handleCameraStatus);
    return () => {
      window.removeEventListener('gcommunity_camera_status', handleCameraStatus);
    };
  }, []);

  useEffect(() => {
    if (pulseActive) {
      const timer = setTimeout(() => {
        setPulseActive(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [pulseActive]);

  useEffect(() => {
    const handleQrScansUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const gid = customEvent.detail?.gatheringId;
      if (gid) {
        setQrScans(prev => ({
          ...prev,
          [gid]: getQrScansForGathering(gid)
        }));

        const isPartOfCluster = cluster.gatherings.some(g => g.id === gid);
        if (isPartOfCluster) {
          setPulseActive(true);
        }
      }
    };

    const handleScanSuccess = (e: Event) => {
      const customEvent = e as CustomEvent;
      const gid = customEvent.detail?.gatheringId;
      if (gid) {
        const isPartOfCluster = cluster.gatherings.some(g => g.id === gid);
        if (isPartOfCluster) {
          setPulseActive(true);
        }
      }
    };

    window.addEventListener('gcommunity_qr_scans_updated_event', handleQrScansUpdated);
    window.addEventListener('gcommunity_scan_success', handleScanSuccess);
    return () => {
      window.removeEventListener('gcommunity_qr_scans_updated_event', handleQrScansUpdated);
      window.removeEventListener('gcommunity_scan_success', handleScanSuccess);
    };
  }, [cluster.gatherings]);

  const [recentScans, setRecentScans] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentScans');
    return saved ? JSON.parse(saved) : ["Tech Pitch Night", "Rooftop Yoga Session", "Community Garden Planting"];
  });

  const [showRecentScans, setShowRecentScans] = useState<Record<string, boolean>>({});
  const [showMapLegend, setShowMapLegend] = useState<Record<string, boolean>>({});
  const [showQuickScanHelp, setShowQuickScanHelp] = useState<Record<string, boolean>>({});
  const [showScanLeaders, setShowScanLeaders] = useState<Record<string, boolean>>({});
  const [lifetimeScans, setLifetimeScans] = useState<number>(() => {
    return parseInt(localStorage.getItem('gcommunity_total_scans') || '0', 10);
  });

  useEffect(() => {
    const handleUpdate = () => {
      setLifetimeScans(parseInt(localStorage.getItem('gcommunity_total_scans') || '0', 10));
    };
    window.addEventListener('gcommunity_total_scans_updated', handleUpdate);
    return () => {
      window.removeEventListener('gcommunity_total_scans_updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    const updateRecentScans = () => {
      setTimeout(() => {
        const saved = localStorage.getItem('recentScans');
        if (saved) {
          setRecentScans(JSON.parse(saved));
        }
      }, 50);
    };
    window.addEventListener('gcommunity_total_scans_updated', updateRecentScans);
    window.addEventListener('gcommunity_scan_success', updateRecentScans);
    return () => {
      window.removeEventListener('gcommunity_total_scans_updated', updateRecentScans);
      window.removeEventListener('gcommunity_scan_success', updateRecentScans);
    };
  }, []);

  const getScansForGathering = (id: string) => {
    return qrScans[id] !== undefined ? qrScans[id] : getQrScansForGathering(id);
  };

  const [nearestPoiMessage, setNearestPoiMessage] = useState<Record<string, string>>({});

  const findClosestPoiToCluster = (lat: number, lng: number) => {
    let closest: PointOfInterest | null = null;
    let minDistance = Infinity;
    for (const poi of POINTS_OF_INTEREST) {
      const d = Math.sqrt(Math.pow(poi.lat - lat, 2) + Math.pow(poi.lng - lng, 2));
      if (d < minDistance) {
        minDistance = d;
        closest = poi;
      }
    }
    return closest;
  };

  const [activeQrGathering, setActiveQrGathering] = useState<Gathering | null>(null);
  const [showQrQrDataUrl, setShowQrQrDataUrl] = useState<string>('');

  // If popover closes, reset the selected gathering back to null/list view
  useEffect(() => {
    if (!isOpen) {
      setSelectedGatheringId(null);
      setPreviewGatheringId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeQrGathering) {
      const shareUrl = `${window.location.origin}${window.location.pathname}?gatheringId=${activeQrGathering.id}`;
      QRCode.toDataURL(
        shareUrl,
        {
          width: 300,
          margin: 2,
          color: {
            dark: '#4f5544',
            light: '#fcfbf7'
          }
        },
        (err, url) => {
          if (!err) {
            setShowQrQrDataUrl(url);
          } else {
            console.error('Failed to generate QR Code:', err);
          }
        }
      );
    } else {
      setShowQrQrDataUrl('');
    }
  }, [activeQrGathering]);

  // Find the currently selected gathering (if any)
  const selectedGathering = cluster.gatherings.find(g => g.id === selectedGatheringId);

  return (
    <div 
      className="absolute transition-all z-20"
      style={{ left: `${cluster.lng}%`, top: `${cluster.lat}%`, transform: 'translate(-50%, -100%)' }}
    >
      {/* Cluster Icon/Pin */}
      <motion.button 
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        animate={isHovered ? {
          scale: [1.12, 1.20, 1.12],
          boxShadow: [
            "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            "0 0 16px 5px rgba(79, 85, 68, 0.35)",
            "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
          ]
        } : pulseActive ? { scale: 1.1 } : { scale: 1 }}
        whileTap={{ scale: 0.95 }}
        transition={isHovered ? {
          scale: {
            duration: 1.6,
            repeat: Infinity,
            ease: "easeInOut"
          },
          boxShadow: {
            duration: 1.6,
            repeat: Infinity,
            ease: "easeInOut"
          }
        } : {
          type: "spring", stiffness: 440, damping: 18
        }}
        className={`relative w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300 cursor-pointer ${
          pulseActive
            ? 'bg-emerald-600 text-white ring-4 ring-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.6)]'
            : isOpen
            ? 'bg-olive text-white ring-4 ring-olive/20'
            : 'bg-olive text-warm-white border-2 border-white'
        }`}
        id={`cluster-pin-${cluster.id}`}
        tabIndex={0}
        aria-label={`Gathering Cluster: ${cluster.gatherings.length} events nearby. Click or press Enter to view list.`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {/* Subtle breathing/pulsing background glow ring when hovered */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0.25, scale: 0.9 }}
            animate={{ 
              opacity: [0.55, 0.1, 0.55],
              scale: [1, 1.25, 1]
            }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 rounded-full bg-olive/30 pointer-events-none ring-2 ring-olive/15 -z-10"
            style={{ margin: '-8px' }}
          />
        )}

        {/* Decorative stacked visual rings to signify overlapping gatherings */}
        <div className="absolute inset-0 rounded-full border border-white/45 -m-[3px] animate-pulse" />
        <div className="absolute inset-0 rounded-full border border-white/20 -m-[6.5px]" />
        
        {/* Subtle, elegant green pulse waves when a successful scan is processed inside this cluster */}
        {pulseActive && (
          <>
            <span className="absolute -inset-[6px] rounded-full ring-[3px] ring-emerald-500/70 animate-pulse pointer-events-none" />
            <span className="absolute -inset-[12px] rounded-full border-2 border-emerald-400/40 animate-ping pointer-events-none" style={{ animationDuration: '1.4s' }} />
          </>
        )}
        
        <span className="text-xs font-black leading-none">{cluster.gatherings.length}</span>
        <span className="text-[7.5px] uppercase font-bold tracking-wider opacity-90 leading-none mt-0.5">Events</span>
      </motion.button>

      {/* Mini Hover Tooltip */}
      <AnimatePresence>
        {isHovered && !isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.85, y: 5, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.85, y: 5, x: '-50%' }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-14 left-1/2 bg-stone-900 border border-stone-800 text-white text-[11px] font-bold px-3 py-2 rounded-xl shadow-2xl whitespace-nowrap z-40 pointer-events-none flex flex-col items-center gap-0.5"
            role="tooltip"
          >
            <span className="text-olive font-extrabold text-[9px] uppercase tracking-wider">Gathering Cluster</span>
            <span className="text-stone-305 font-medium">{cluster.gatherings.length} overlapping events nearby</span>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-stone-900" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Cluster Popover/Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-14 left-1/2 -translate-x-1/2 w-72 bg-white rounded-[24px] shadow-2xl p-4 border border-gray-100/80 z-50 overflow-hidden"
            role="dialog"
            aria-label={selectedGathering ? `${selectedGathering.title} details` : `Cluster gatherings dropdown`}
          >
            {selectedGathering ? (
              /* State 2: Expand/View specific gathering inside the cluster */
              <div className="space-y-3">
                {/* Back to list controller */}
                <button 
                  onClick={() => setSelectedGatheringId(null)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-olive/80 hover:text-olive uppercase tracking-wider transition-colors mb-1 cursor-pointer"
                  aria-label="Back to cluster events index"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back to list
                </button>

                <div className="relative h-24 overflow-hidden rounded-xl">
                  {selectedGathering.image ? (
                    <img src={selectedGathering.image} alt={selectedGathering.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-350">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="absolute top-2 right-2 p-1 bg-black/20 backdrop-blur rounded-full text-white cursor-pointer"
                    aria-label="Close details dialog"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div>
                  <h4 className="serif text-sm font-semibold truncate text-gray-800">{selectedGathering.title}</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 truncate">
                    {selectedGathering.category} • {selectedGathering.location}
                  </p>
                  {selectedGathering.tags && selectedGathering.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5" id={`cluster-popup-tags-${selectedGathering.id}`}>
                      {selectedGathering.tags.map(tag => (
                        <span key={tag} className="text-[8px] font-bold uppercase tracking-wider bg-stone-100 text-stone-650 px-1.5 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-gray-400 font-medium mt-1">
                    When: {new Date(selectedGathering.date).toLocaleDateString()} at {selectedGathering.time}
                  </p>
                </div>

                {/* Mini Reminder Toggle row */}
                <div className="flex items-center justify-between bg-stone-50 p-2 rounded-xl text-left border border-stone-200/20" id={`cluster-remind-bar-${selectedGathering.id}`}>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1 leading-none">
                    <Clock className="w-3 h-3 text-olive shrink-0" /> Remind -1h:
                  </span>
                  <div className="flex items-center gap-1 bg-stone-200/40 p-0.5 rounded-lg border border-stone-200/10">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleReminder(selectedGathering.id, 'email'); }}
                      className={`p-1 rounded-md transition-all ${reminders[selectedGathering.id]?.email ? 'bg-olive text-white shadow-xs' : 'text-stone-400 hover:text-stone-600'}`}
                      id={`cluster-email-remind-${selectedGathering.id}`}
                      title="Toggle 1h before Email reminder"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleReminder(selectedGathering.id, 'push'); }}
                      className={`p-1 rounded-md transition-all ${reminders[selectedGathering.id]?.push ? 'bg-olive text-white shadow-xs' : 'text-stone-400 hover:text-stone-600'}`}
                      id={`cluster-push-remind-${selectedGathering.id}`}
                      title="Toggle 1h before Push notification"
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* RSVP / Icebreakers Action Row */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        const isAttending = selectedGathering.attendeeIds.includes(CURRENT_USER.id); 
                        onRSVP(selectedGathering.id, isAttending ? 'not_attending' : 'attending'); 
                      }}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-transform active:scale-95 ${
                        selectedGathering.attendeeIds.includes(CURRENT_USER.id) 
                          ? 'bg-olive text-warm-white' 
                          : 'bg-warm-bg text-olive border border-olive/10'
                      }`}
                    >
                      {selectedGathering.attendeeIds.includes(CURRENT_USER.id) ? 'Attending' : 'Join'}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onIcebreakers(selectedGathering); }}
                      className="p-2 bg-warm-bg rounded-xl text-olive hover:bg-olive hover:text-white transition-colors"
                      title="Icebreakers"
                    >
                      <Sparkles className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        const shareUrl = `${window.location.origin}${window.location.pathname}?gatheringId=${selectedGathering.id}`;
                        navigator.clipboard.writeText(shareUrl).then(() => {
                          setCopiedId(selectedGathering.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        });
                      }}
                      className={`p-2 rounded-xl transition-all duration-200 active:scale-95 ${copiedId === selectedGathering.id ? 'bg-emerald-500 text-white' : 'bg-warm-bg text-stone-605 hover:bg-olive hover:text-white'}`}
                      title={copiedId === selectedGathering.id ? "Copied!" : "Share Link"}
                    >
                      {copiedId === selectedGathering.id ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        navigator.clipboard.writeText(selectedGathering.location).then(() => {
                          setCopiedLocationId(selectedGathering.id);
                          setTimeout(() => setCopiedLocationId(null), 2000);
                        });
                      }}
                      className={`p-2 rounded-xl transition-all duration-200 active:scale-95 ${copiedLocationId === selectedGathering.id ? 'bg-emerald-500 text-white' : 'bg-warm-bg text-stone-605 hover:bg-olive hover:text-white'}`}
                      title={copiedLocationId === selectedGathering.id ? "Location Copied!" : "Copy Location"}
                      id={`cluster-detail-copy-loc-${selectedGathering.id}`}
                      aria-label={copiedLocationId === selectedGathering.id ? "Location copied" : "Copy Location to Clipboard"}
                    >
                      {copiedLocationId === selectedGathering.id ? <Check className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                    </button>
                  </div>
                  
                  {!selectedGathering.attendeeIds.includes(CURRENT_USER.id) && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        const isMaybe = selectedGathering.maybeIds.includes(CURRENT_USER.id);
                        onRSVP(selectedGathering.id, isMaybe ? 'not_attending' : 'maybe'); 
                      }}
                      className={`w-full py-2 rounded-xl text-[10px] font-bold uppercase transition-transform active:scale-95 ${
                        selectedGathering.maybeIds.includes(CURRENT_USER.id) 
                          ? 'bg-olive/10 text-olive' 
                          : 'bg-stone-50 text-stone-400 border border-stone-100'
                      }`}
                    >
                      {selectedGathering.maybeIds.includes(CURRENT_USER.id) ? 'Maybe attending' : 'Thinking about it? (Maybe)'}
                    </button>
                  )}
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); onViewHost(selectedGathering.hostId); }}
                  className="w-full text-center text-[10px] text-stone-400 hover:text-olive font-bold uppercase tracking-wider transition-colors pt-1"
                >
                  View full details
                </button>
              </div>
            ) : (
              /* State 1: Beautiful scrollable list of gatherings in this proximity */
              <div className="flex flex-col max-h-72">
                <div className="flex justify-between items-center pb-2 border-b border-stone-100 mb-2 shrink-0">
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] text-olive font-extrabold uppercase tracking-widest leading-none">Nearby Clusters</span>
                    <h4 className="serif text-sm font-semibold text-stone-800 mt-1">{cluster.gatherings.length} Events Here</h4>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCenterOnCluster?.(cluster.lat, cluster.lng);
                      }}
                      className="p-1 px-1.5 text-olive hover:bg-stone-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[8px] font-black uppercase tracking-wider"
                      title="Re-center the map view to this cluster"
                      id={`cluster-popover-center-${cluster.id}`}
                      aria-label="Center map on this cluster"
                    >
                      <Compass className="w-3.5 h-3.5 animate-spin text-olive" style={{ animationDuration: '6s' }} />
                      Center Map
                    </button>
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="p-1 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-50 transition-colors cursor-pointer"
                      aria-label="Close cluster gatherings rollup popup"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Scrollable list content */}
                <div className="overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar flex-1 max-h-56 py-1">
                  {cluster.gatherings.map((g) => {
                    const isAttending = g.attendeeIds.includes(CURRENT_USER.id);
                    const isPreviewed = previewGatheringId === g.id;
                    return (
                      <div 
                        key={g.id}
                        onClick={() => setPreviewGatheringId(isPreviewed ? null : g.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setPreviewGatheringId(isPreviewed ? null : g.id);
                          }
                        }}
                        className={`group flex flex-col p-2 rounded-xl cursor-pointer text-left border transition-all duration-200 ${
                          isPreviewed 
                            ? 'bg-olive/[0.08] border-olive/30 ring-1 ring-olive/10 shadow-xs' 
                            : 'hover:bg-olive/5 border-transparent hover:border-olive/10'
                        }`}
                        id={`cluster-item-${g.id}`}
                        tabIndex={0}
                        role="button"
                        aria-expanded={isPreviewed}
                        aria-label={`${g.title}. Category: ${g.category}. Location: ${g.location}. Date: ${new Date(g.date).toLocaleDateString()}. Status: ${isAttending ? 'Joined' : 'Not joined'}. Press Enter or Space to toggle details card view.`}
                      >
                        <div className="flex gap-2.5 w-full">
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-stone-100">
                            {g.image ? (
                              <img src={g.image} alt={g.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <h5 className={`text-[11px] font-bold truncate group-hover:text-olive transition-colors leading-tight ${isPreviewed ? 'text-olive font-extrabold' : 'text-stone-800'}`}>
                              {g.title}
                            </h5>
                            <p className="text-[9px] text-stone-400 truncate font-medium">
                              {g.category} • {g.location}
                            </p>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[8.5px] text-stone-400 font-bold uppercase tracking-wider">
                                {new Date(g.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                              </span>
                              {isAttending && (
                                <span className="text-[8px] bg-olive/10 text-olive font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                  Joined
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 self-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const shareUrl = `${window.location.origin}${window.location.pathname}?gatheringId=${g.id}`;
                                navigator.clipboard.writeText(shareUrl).then(() => {
                                  setCopiedId(g.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                });
                              }}
                              className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                                copiedId === g.id 
                                  ? 'bg-emerald-50 text-emerald-600 scale-105' 
                                  : 'text-stone-400 hover:text-olive hover:bg-stone-100/80'
                              }`}
                              title={copiedId === g.id ? "Link Copied!" : "Quick Share"}
                              id={`cluster-item-share-${g.id}`}
                              aria-label={`Share link for ${g.title}`}
                            >
                              {copiedId === g.id ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Share2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGatheringId(g.id);
                              }}
                              className="flex items-center text-stone-300 hover:text-olive hover:bg-stone-100/80 p-1.5 rounded-lg transition-all cursor-pointer"
                              title="Go to full details"
                              aria-label={`View full details for ${g.title}`}
                            >
                              <ChevronRight className="w-4 h-4 shrink-0" />
                            </button>
                          </div>
                        </div>

                        {/* Expandable Preview Section */}
                        <AnimatePresence>
                          {isPreviewed && (
                            <motion.div
                              initial={{ height: 0, opacity: 0, y: 15 }}
                              animate={{ height: "auto", opacity: 1, y: 0 }}
                              exit={{ height: 0, opacity: 0, y: 15 }}
                              transition={{ 
                                height: { duration: 0.25, ease: "easeOut" },
                                opacity: { duration: 0.25, ease: "easeOut" },
                                y: { type: "spring", stiffness: 200, damping: 20 }
                              }}
                              className="overflow-hidden mt-2 pt-2 border-t border-stone-200/40 w-full flex flex-col gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="grid grid-cols-3 gap-1 px-0.5 text-[9px]">
                                {/* Host Column */}
                                <div className="flex items-center gap-1 bg-white/60 p-1 rounded-lg border border-stone-100">
                                  {g.hostAvatar ? (
                                    <img src={g.hostAvatar} alt={g.hostName} className="w-4 h-4 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center shrink-0">
                                      <span className="text-[7px] font-bold text-stone-500">{g.hostName.slice(0, 1)}</span>
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <span className="text-[6px] uppercase font-bold text-stone-400 block tracking-wider leading-none">Host</span>
                                    <span className="text-stone-700 font-semibold truncate block leading-tight">{g.hostName}</span>
                                  </div>
                                </div>

                                {/* Date / Time / Duration Column */}
                                <div className="flex items-center gap-1 bg-white/60 p-1 rounded-lg border border-stone-100 text-left">
                                  <Clock className="w-3 h-3 text-olive shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-[6px] uppercase font-bold text-stone-400 block tracking-wider leading-none">Time & Length</span>
                                    <span className="text-stone-700 font-semibold truncate block leading-tight">
                                      {g.time}
                                    </span>
                                  </div>
                                </div>

                                {/* QR Scans Badge */}
                                <div className="flex items-center gap-1 bg-olive/[0.04] p-1 rounded-lg border border-olive/10 text-left" id={`qr-total-scans-badge-${g.id}`}>
                                  <QrCodeIcon className="w-3 h-3 text-olive shrink-0 animate-pulse" />
                                  <div className="min-w-0">
                                    <span className="text-[6px] uppercase font-bold text-olive/70 block tracking-wider leading-none">QR Scans</span>
                                    <span className="text-olive font-black block leading-tight font-mono">
                                      {getScansForGathering(g.id)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Row of Performance Metrics */}
                              <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                                {/* Lifetime QR Scans badge */}
                                <div className="flex items-center justify-between bg-amber-50/75 border border-amber-200/55 p-1.5 px-2 rounded-lg text-left" id={`lifetime-qr-scans-badge-${g.id}`}>
                                  <div className="flex items-center gap-1 min-w-0">
                                    <Award className="w-3 h-3 text-amber-600 shrink-0 animate-pulse" />
                                    <div className="min-w-0">
                                      <span className="text-[6.5px] uppercase font-black text-amber-700 block tracking-wider leading-none truncate">Lifetime Scans</span>
                                      <span className="text-stone-500 text-[5.5px] leading-none block truncate">App-wide total</span>
                                    </div>
                                  </div>
                                  <span className="text-[9px] text-amber-800 font-extrabold leading-none font-mono bg-white px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                                    {lifetimeScans}
                                  </span>
                                </div>

                                {/* Scan Rate badge */}
                                {(() => {
                                  const scans = getScansForGathering(g.id);
                                  const gatheringDate = new Date(g.date);
                                  const referenceDate = new Date('2026-06-14');
                                  let diffDays = 1;
                                  if (!isNaN(gatheringDate.getTime())) {
                                    const diffTime = referenceDate.getTime() - gatheringDate.getTime();
                                    diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                                  }
                                  const scansPerDay = parseFloat((scans / diffDays).toFixed(1));
                                  return (
                                    <div className="flex items-center justify-between bg-emerald-50/75 border border-emerald-200/55 p-1.5 px-2 rounded-lg text-left" id={`scan-rate-badge-${g.id}`}>
                                      <div className="flex items-center gap-1 min-w-0">
                                        <Activity className="w-3 h-3 text-emerald-600 shrink-0 animate-pulse" />
                                        <div className="min-w-0">
                                          <span className="text-[6.5px] uppercase font-black text-emerald-700 block tracking-wider leading-none truncate heading-semibold">Scan Rate</span>
                                          <span className="text-stone-500 text-[5.5px] leading-none block truncate">Scans / day ({diffDays}d)</span>
                                        </div>
                                      </div>
                                      <span className="text-[9px] text-emerald-800 font-extrabold leading-none font-mono bg-white px-1.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                                        {scansPerDay}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Camera Hardware Status Badge */}
                              {(() => {
                                let statusLabel = "Idle";
                                let statusColorClass = "bg-stone-50 border-stone-200/55 text-stone-600";
                                let dotColorClass = "bg-stone-400";
                                let description = "On standby";
                                if (cameraError) {
                                  statusLabel = "Error";
                                  statusColorClass = "bg-red-50 border-red-200/55 text-red-700 font-bold";
                                  dotColorClass = "bg-red-500 animate-pulse";
                                  description = "Hardware limits/access error";
                                } else if (isCameraActive) {
                                  statusLabel = "Active";
                                  statusColorClass = "bg-emerald-50 border-emerald-200/55 text-emerald-700 font-bold";
                                  dotColorClass = "bg-emerald-500 animate-pulse";
                                  description = "Scanning stream active";
                                }

                                return (
                                  <div 
                                    className={`flex items-center justify-between p-1.5 px-2 rounded-lg text-left border ${statusColorClass} mt-0.5`} 
                                    id={`camera-status-badge-${g.id}`}
                                  >
                                    <div className="flex items-center gap-1 min-w-0">
                                      <Camera className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                                      <div className="min-w-0">
                                        <span className="text-[6.5px] uppercase font-black block tracking-wider leading-none truncate">Camera Sensor</span>
                                        <span className="text-stone-500 text-[5.5px] leading-none block truncate">
                                          {description}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="flex items-center gap-1 text-[8px] font-black uppercase font-mono px-2 py-0.5 rounded-full bg-white border border-stone-200 shadow-3xs shrink-0">
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColorClass}`} />
                                      {statusLabel}
                                    </span>
                                  </div>
                                );
                              })()}

                              <p className="text-[9px] text-stone-500 italic px-1 bg-stone-50/40 py-1 rounded">
                                "{g.description}"
                              </p>

                              {/* Show Recent Scans List toggled inside the cluster item preview popover */}
                              <div className="mt-1 flex flex-col gap-1 border-t border-stone-200/30 pt-1.5" id={`recent-scans-container-${g.id}`}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowRecentScans(prev => ({
                                      ...prev,
                                      [g.id]: !prev[g.id]
                                    }));
                                  }}
                                  className="flex items-center justify-between w-full px-1.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200/70 text-stone-700 text-[8.5px] font-bold uppercase transition-all"
                                  id={`toggle-recent-scans-btn-${g.id}`}
                                >
                                  <span className="flex items-center gap-1">
                                    <History className="w-2.5 h-2.5 text-olive shrink-0 animate-pulse" />
                                    Show Recent Scans
                                  </span>
                                  <span className="text-[7.5px] text-stone-500">
                                    {showRecentScans[g.id] ? 'Hide' : 'Expand'}
                                  </span>
                                </button>

                                {showRecentScans[g.id] && (
                                  <div 
                                    className="flex flex-col gap-1 bg-white/70 border border-stone-200/50 rounded-lg p-1.5 mt-0.5 animate-fade-in" 
                                    style={{ animationDuration: '150ms' }}
                                    id={`recent-scans-list-${g.id}`}
                                  >
                                    <div className="text-[7.5px] text-stone-400 font-extrabold uppercase tracking-wide px-0.5 pb-1 mb-1 border-b border-stone-100 flex items-center gap-1">
                                      <History className="w-2 h-2 text-olive" />
                                      Last 3 Joined via QR
                                    </div>
                                    {recentScans && recentScans.length > 0 ? (
                                      recentScans.slice(0, 3).map((title, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-stone-700 font-medium text-[8.5px] px-0.5 leading-normal">
                                          <span className="truncate flex items-center gap-1">
                                            <span className="w-1 h-1 bg-olive/70 rounded-full inline-block" />
                                            {title}
                                          </span>
                                          <span className="text-[7px] text-emerald-600 bg-emerald-50 px-1 rounded-sm uppercase tracking-tight font-extrabold shrink-0">Scanned</span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-[8px] text-stone-400 italic px-0.5">No recent scans yet</p>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Map Legend Toggle inside the cluster item preview popover */}
                              <div className="mt-1 flex flex-col gap-1 border-t border-stone-200/30 pt-1.5" id={`map-legend-container-${g.id}`}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMapLegend(prev => ({
                                      ...prev,
                                      [g.id]: !prev[g.id]
                                    }));
                                  }}
                                  className="flex items-center justify-between w-full px-1.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200/70 text-stone-700 text-[8.5px] font-bold uppercase transition-all"
                                  id={`toggle-map-legend-btn-${g.id}`}
                                >
                                  <span className="flex items-center gap-1">
                                    <MapIcon className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                                    Map Legend
                                  </span>
                                  <span className="text-[7.5px] text-stone-500 font-bold uppercase">
                                    {showMapLegend[g.id] ? 'Hide' : 'Expand'}
                                  </span>
                                </button>

                                {showMapLegend[g.id] && (
                                  <div 
                                    className="flex flex-col gap-1.5 bg-white/75 border border-stone-200/50 rounded-lg p-2.5 mt-0.5 animate-fade-in" 
                                    style={{ animationDuration: '150ms' }}
                                    id={`map-legend-popup-overlay-${g.id}`}
                                  >
                                    <div className="text-[7.5px] text-stone-400 font-extrabold uppercase tracking-wide px-0.5 pb-1 mb-0.5 border-b border-stone-100 flex items-center justify-between">
                                      <span className="flex items-center gap-1">
                                        <Info className="w-2.5 h-2.5 text-rose-500 animate-pulse" />
                                        Heatmap Intensity Guide
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowMapLegend(prev => ({ ...prev, [g.id]: false }));
                                        }}
                                        className="text-stone-405 hover:text-stone-600 font-bold uppercase text-[7.5px]"
                                      >
                                        Close
                                      </button>
                                    </div>
                                    <div className="text-[8px] text-stone-600 space-y-1.5 leading-normal">
                                      <div className="flex items-start gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#ef4444] shrink-0 mt-0.5 shadow-[0_0_4px_#ef4444] animate-pulse" />
                                        <div className="min-w-0">
                                          <strong className="text-stone-850 uppercase text-[7.5px] font-black">High Density Zone (Red)</strong>
                                          <p className="text-[7.5px] text-stone-500 leading-tight">Crowded hubs with overlapping community events, strong host presence, and active attendee check-ins.</p>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-start gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#f97316] shrink-0 mt-0.5 shadow-[0_0_4px_#f97316]" />
                                        <div className="min-w-0">
                                          <strong className="text-stone-850 uppercase text-[7.5px] font-black">Medium Density Zone (Orange)</strong>
                                          <p className="text-[7.5px] text-stone-500 leading-tight">Active neighborhoods or popular local venues hosting steady schedules of community gatherings.</p>
                                        </div>
                                      </div>

                                      <div className="flex items-start gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#eab308] shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                          <strong className="text-stone-850 uppercase text-[7.5px] font-black">Light Density Zone (Yellow)</strong>
                                          <p className="text-[7.5px] text-stone-500 leading-tight">Moderate activities like localized boutique meetups, small workshops, or single host listings.</p>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-start gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#84cc16] shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                          <strong className="text-stone-850 uppercase text-[7.5px] font-black">Isolated Location (Lime Green)</strong>
                                          <p className="text-[7.5px] text-stone-500 leading-tight">Single peaceful gatherings out in nature trails or quiet outer neighborhood pockets.</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Quick Scan Help Tooltip inside the cluster item preview popover */}
                              <div className="mt-1 flex flex-col gap-1 border-t border-stone-200/30 pt-1.5" id={`quick-scan-help-container-${g.id}`}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowQuickScanHelp(prev => ({
                                      ...prev,
                                      [g.id]: !prev[g.id]
                                    }));
                                  }}
                                  className="flex items-center justify-between w-full px-1.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200/70 text-stone-700 text-[8.5px] font-bold uppercase transition-all"
                                  id={`toggle-quick-scan-help-btn-${g.id}`}
                                >
                                  <span className="flex items-center gap-1">
                                    <Smartphone className="w-2.5 h-2.5 text-olive shrink-0" />
                                    Quick Scan Help
                                  </span>
                                  <span className="text-[7.5px] text-stone-500 font-bold uppercase">
                                    {showQuickScanHelp[g.id] ? 'Hide' : 'Expand'}
                                  </span>
                                </button>

                                {showQuickScanHelp[g.id] && (
                                  <div 
                                    className="flex flex-col gap-1.5 bg-white/75 border border-stone-200/50 rounded-lg p-2.5 mt-0.5 animate-fade-in text-[8px] text-stone-600 leading-normal" 
                                    style={{ animationDuration: '150ms' }}
                                    id={`quick-scan-help-tooltip-${g.id}`}
                                  >
                                    <div className="text-[7.5px] text-stone-400 font-extrabold uppercase tracking-wide px-0.5 pb-1 mb-0.5 border-b border-stone-100 flex items-center justify-between">
                                      <span className="flex items-center gap-1">
                                        <Camera className="w-2.5 h-2.5 text-olive animate-pulse" />
                                        Optimal Camera Positioning
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowQuickScanHelp(prev => ({ ...prev, [g.id]: false }));
                                        }}
                                        className="text-stone-405 hover:text-stone-600 font-bold uppercase text-[7.5px]"
                                      >
                                        Close
                                      </button>
                                    </div>
                                    <div className="space-y-1.5">
                                      <div className="flex items-start gap-1.5">
                                        <span className="text-olive font-extrabold shrink-0">1.</span>
                                        <p className="text-stone-500 leading-tight">
                                          <strong className="text-stone-700">Distance & Fit:</strong> Keep the device <strong className="text-stone-850">4–6 inches (10–15 cm)</strong> away. Ensure the QR code fits fully inside the camera selection frame.
                                        </p>
                                      </div>
                                      <div className="flex items-start gap-1.5">
                                        <span className="text-olive font-extrabold shrink-0">2.</span>
                                        <p className="text-stone-500 leading-tight">
                                          <strong className="text-stone-700">Lighting & Angle:</strong> Avoid direct glare and shadows. Hold the screen flat and parallel to your camera lens for maximum contrast and rapid detection.
                                        </p>
                                      </div>
                                      <div className="flex items-start gap-1.5">
                                        <span className="text-olive font-extrabold shrink-0">3.</span>
                                        <p className="text-stone-500 leading-tight">
                                          <strong className="text-stone-700">Stability & Focus:</strong> Hold your device steady for a split second to let the autofocus module lock onto the finder patterns.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Community Scan Leaders Section */}
                              <div className="mt-1 flex flex-col gap-1 border-t border-stone-200/30 pt-1.5" id={`community-scan-leaders-container-${g.id}`}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowScanLeaders(prev => ({
                                      ...prev,
                                      [g.id]: !prev[g.id]
                                    }));
                                  }}
                                  className="flex items-center justify-between w-full px-1.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200/70 text-stone-700 text-[8.5px] font-bold uppercase transition-all"
                                  id={`toggle-scan-leaders-btn-${g.id}`}
                                >
                                  <span className="flex items-center gap-1">
                                    <Trophy className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                    Community Scan Leaders
                                  </span>
                                  <span className="text-[7.5px] text-stone-500 font-bold uppercase font-sans">
                                    {showScanLeaders[g.id] ? 'Hide' : 'Expand'}
                                  </span>
                                </button>

                                {showScanLeaders[g.id] && (
                                  <div 
                                    className="flex flex-col gap-1 bg-white/75 border border-stone-200/50 rounded-lg p-2.5 mt-0.5 animate-fade-in text-[8px] text-stone-600 leading-normal" 
                                    style={{ animationDuration: '150ms' }}
                                    id={`scan-leaders-list-${g.id}`}
                                  >
                                    <div className="text-[7.5px] text-stone-400 font-extrabold uppercase tracking-wide px-0.5 pb-1 mb-1 border-b border-stone-100 flex items-center justify-between">
                                      <span className="flex items-center gap-1">
                                        <Trophy className="w-2.5 h-2.5 text-amber-500 animate-bounce" />
                                        Leaderboard (Top 3)
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowScanLeaders(prev => ({ ...prev, [g.id]: false }));
                                        }}
                                        className="text-stone-405 hover:text-stone-600 font-bold uppercase text-[7.5px] font-sans"
                                      >
                                        Close
                                      </button>
                                    </div>
                                    <div className="space-y-1.5">
                                      {(() => {
                                        const allLeaders = [
                                          { username: 'Elena V.', scans: 43, isMe: false, avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400' },
                                          { username: 'Marcus Rose', scans: 35, isMe: false, avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400' },
                                          { username: 'Baker Sam', scans: 29, isMe: false, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400' },
                                          { username: 'Alex Rivera', scans: lifetimeScans, isMe: true, avatar: CURRENT_USER.avatar }
                                        ];
                                        const topThree = allLeaders
                                          .sort((a, b) => b.scans - a.scans)
                                          .slice(0, 3);

                                        return topThree.map((leader, index) => {
                                          const rankColors = [
                                            { bg: 'bg-amber-100 text-amber-700 border-amber-200/50', emoji: '🥇' },
                                            { bg: 'bg-stone-200 text-stone-705 border-stone-300/50', emoji: '🥈' },
                                            { bg: 'bg-orange-100 text-orange-700 border-orange-200/50', emoji: '🥉' }
                                          ];
                                          const styling = rankColors[index] || { bg: 'bg-stone-50 text-stone-600 border-stone-200/50', emoji: `${index + 1}` };
                                          
                                          return (
                                            <div 
                                              key={index} 
                                              className={`flex items-center justify-between p-1 rounded-md border ${
                                                leader.isMe 
                                                  ? 'bg-olive/10 border-olive/30 shadow-2xs font-bold' 
                                                  : 'bg-stone-50/50 border-stone-150'
                                              }`}
                                            >
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-black border ${styling.bg}`}>
                                                  {styling.emoji}
                                                </span>
                                                <img 
                                                  src={leader.avatar} 
                                                  alt={leader.username} 
                                                  className="w-4 h-4 rounded-full object-cover border border-stone-200 shrink-0" 
                                                  referrerPolicy="no-referrer"
                                                />
                                                <span className={`text-[8.5px] truncate ${leader.isMe ? 'text-olive font-black' : 'text-stone-700 font-semibold'}`}>
                                                  {leader.username} {leader.isMe && <span className="text-[7px] text-olive/60 font-medium">(You)</span>}
                                                </span>
                                              </div>
                                              <span className={`font-mono text-[8.5px] px-1.5 py-0.5 rounded-full border ${
                                                leader.isMe 
                                                  ? 'bg-olive text-white border-olive font-extrabold' 
                                                  : 'bg-white text-stone-605 border-stone-200 font-bold'
                                              }`}>
                                                {leader.scans}
                                              </span>
                                            </div>
                                          );
                                        });
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Actions inside the preview */}
                              <div className="flex items-center justify-between gap-1 mt-0.5 border-t border-dashed border-stone-200/50 pt-1.5">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      const isCurrentlyAttending = g.attendeeIds.includes(CURRENT_USER.id);
                                      onRSVP(g.id, isCurrentlyAttending ? 'not_attending' : 'attending');
                                    }}
                                    className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase transition-all duration-150 active:scale-95 ${
                                      g.attendeeIds.includes(CURRENT_USER.id)
                                        ? 'bg-olive text-white shadow-xs'
                                        : 'bg-stone-100 text-olive hover:bg-olive/10'
                                    }`}
                                  >
                                    {g.attendeeIds.includes(CURRENT_USER.id) ? 'Joined' : 'Join'}
                                  </button>
                                  {!g.attendeeIds.includes(CURRENT_USER.id) && (
                                    <button
                                      onClick={() => {
                                        const isCurrentlyMaybe = g.maybeIds.includes(CURRENT_USER.id);
                                        onRSVP(g.id, isCurrentlyMaybe ? 'not_attending' : 'maybe');
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase transition-all duration-150 active:scale-95 ${
                                        g.maybeIds.includes(CURRENT_USER.id)
                                          ? 'bg-olive/15 text-olive'
                                          : 'bg-stone-50 text-stone-400 hover:bg-stone-100'
                                      }`}
                                    >
                                      Maybe
                                    </button>
                                  )}
                                  <button
                                    onClick={() => onHostAtCluster(cluster.lat, cluster.lng, g.location)}
                                    className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-stone-100 text-stone-700 hover:bg-stone-200 transition-all duration-150 active:scale-95"
                                    title="Host a gathering at this cluster location"
                                    id={`host-at-cluster-btn-${g.id}`}
                                  >
                                    Host
                                  </button>
                                  <button
                                    onClick={() => onCenterOnCluster?.(cluster.lat, cluster.lng)}
                                    className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-stone-100 text-olive hover:bg-olive hover:text-white transition-all duration-150 active:scale-95 flex items-center gap-0.5"
                                    title="Center the main map on these coordinates"
                                    id={`show-on-map-btn-${g.id}`}
                                  >
                                    <MapIcon className="w-2.5 h-2.5" />
                                    Show on Map
                                  </button>
                                  <button
                                    onClick={() => {
                                      const coordsStr = `${cluster.lat.toFixed(4)}, ${cluster.lng.toFixed(4)}`;
                                      navigator.clipboard.writeText(coordsStr).then(() => {
                                        setCopiedCoordsId(g.id);
                                        setTimeout(() => setCopiedCoordsId(null), 2000);
                                      });
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase transition-all duration-150 active:scale-95 flex items-center gap-0.5 ${
                                      copiedCoordsId === g.id
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                    }`}
                                    title="Copy latitude and longitude coordinates"
                                    id={`copy-coords-btn-${g.id}`}
                                  >
                                    {copiedCoordsId === g.id ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                    {copiedCoordsId === g.id ? 'Copied' : 'Copy Coords'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(g.location).then(() => {
                                        setCopiedLocationId(g.id);
                                        setTimeout(() => setCopiedLocationId(null), 2000);
                                      });
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase transition-all duration-150 active:scale-95 flex items-center gap-0.5 ${
                                      copiedLocationId === g.id
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                    }`}
                                    title="Copy event location name"
                                    id={`copy-location-btn-${g.id}`}
                                  >
                                    {copiedLocationId === g.id ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                    {copiedLocationId === g.id ? 'Copied' : 'Copy Location Name'}
                                  </button>
                                  <button
                                    onClick={() => setActiveQrGathering(g)}
                                    className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-stone-100 text-stone-700 hover:bg-stone-200 transition-all duration-150 active:scale-95 flex items-center gap-0.5"
                                    title="Show QR code for this gathering"
                                    id={`show-qr-btn-${g.id}`}
                                  >
                                    <QrCodeIcon className="w-2.5 h-2.5 text-olive" />
                                    Show QR
                                  </button>
                                  <button
                                    onClick={() => onToggleFocusCluster?.(cluster.id)}
                                    className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase transition-all duration-150 active:scale-95 flex items-center gap-0.5 ${
                                      focusedClusterId === cluster.id
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                    }`}
                                    title={focusedClusterId === cluster.id ? "Show all pins on the map" : "Focus exclusively on this cluster"}
                                    id={`focus-cluster-btn-${g.id}`}
                                  >
                                    {focusedClusterId === cluster.id ? (
                                      <Check className="w-2.5 h-2.5 text-amber-700" />
                                    ) : (
                                      <span className="w-2.5 h-2.5 text-stone-600 block text-center font-normal leading-none">◌</span>
                                    )}
                                    {focusedClusterId === cluster.id ? 'Show All Pins' : 'Focus Cluster'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      const closest = findClosestPoiToCluster(cluster.lat, cluster.lng);
                                      if (closest) {
                                        window.dispatchEvent(new CustomEvent('gcommunity_highlight_poi', { detail: { poiId: closest.id } }));
                                        setNearestPoiMessage(prev => ({
                                          ...prev,
                                          [g.id]: `Closest: ${closest.title}`
                                        }));
                                        setTimeout(() => {
                                          setNearestPoiMessage(prev => ({ ...prev, [g.id]: '' }));
                                        }, 4000);
                                      }
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase transition-all duration-150 active:scale-95 flex items-center gap-0.5 ${
                                      nearestPoiMessage[g.id]
                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                    }`}
                                    title="Find and highlight the nearest Point of Interest to this gathering"
                                    id={`find-closest-poi-btn-${g.id}`}
                                  >
                                    <Compass className="w-2.5 h-2.5 text-rose-500 animate-spin shrink-0" style={{ animationDuration: '3s' }} />
                                    {nearestPoiMessage[g.id] ? nearestPoiMessage[g.id] : 'Find Closest'}
                                  </button>
                                </div>

                                <button
                                  onClick={() => setSelectedGatheringId(g.id)}
                                  className="text-[8.5px] font-bold text-olive hover:underline uppercase tracking-wider flex items-center gap-0.5"
                                >
                                  Details
                                  <ChevronRight className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Map Style Selector Segment Control to toggle main map view */}
            <div className="mt-3 pt-3 border-t border-stone-100 flex flex-col gap-1.5" id={`map-style-toggle-container-${cluster.id}`}>
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black uppercase tracking-widest text-[#4f5544] flex items-center gap-1">
                  <Compass className="w-3 h-3 text-olive animate-pulse" /> Map Style
                </span>
                <span className="text-[7.5px] text-stone-400 capitalize font-medium">
                  Active: {mapStyle}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 bg-stone-50 p-1 rounded-xl border border-stone-100" id={`map-style-segmented-control-${cluster.id}`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMapStyle('standard');
                  }}
                  className={`py-1 px-1 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    mapStyle === 'standard'
                      ? 'bg-olive text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                  id={`popover-${cluster.id}-style-standard`}
                  title="Switch to Standard layout"
                >
                  <MapIcon className="w-2.5 h-2.5" />
                  Standard
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMapStyle('satellite');
                  }}
                  className={`py-1 px-1 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    mapStyle === 'satellite'
                      ? 'bg-olive text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                  id={`popover-${cluster.id}-style-satellite`}
                  title="Switch to Satellite layout"
                >
                  <Globe className="w-2.5 h-2.5" />
                  Satellite
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMapStyle('terrain');
                  }}
                  className={`py-1 px-1 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    mapStyle === 'terrain'
                      ? 'bg-olive text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                  id={`popover-${cluster.id}-style-terrain`}
                  title="Switch to Terrain layout"
                >
                  <Compass className="w-2.5 h-2.5" />
                  Terrain
                </button>
              </div>
            </div>

            {/* Heatmap Activity Density Legend */}
            <div className="mt-3 pt-3 border-t border-stone-100 flex flex-col gap-1.5" id={`heatmap-legend-container-${cluster.id}`}>
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black uppercase tracking-widest text-[#4f5544] flex items-center gap-1" id={`heatmap-legend-lbl-${cluster.id}`}>
                  <Activity className="w-3 h-3 text-olive animate-pulse" /> Activity Density
                </span>
                <span className="text-[7.5px] text-stone-400 font-medium">
                  Heatmap Legend
                </span>
              </div>
              <div 
                className="grid grid-cols-4 gap-1 p-1 bg-stone-50 rounded-xl border border-stone-100"
                role="img"
                aria-labelledby={`heatmap-legend-lbl-${cluster.id}`}
                aria-label="Heatmap activity level gradient legend. Red shows high density core overlap areas, orange is medium-high, yellow is standard medium activity, green-lime is low density or isolated events."
                id={`heatmap-legend-grid-${cluster.id}`}
              >
                <div className="flex flex-col items-center gap-0.5 p-1 rounded-lg hover:bg-white/40 transition-colors text-center" id={`legend-high-${cluster.id}`}>
                  <div className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-100 shadow-xs" id={`legend-dot-high-${cluster.id}`} />
                  <span className="text-[8px] font-extrabold text-stone-700 leading-none">High</span>
                  <span className="text-[6px] text-stone-400 font-medium leading-none">Core</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 p-1 rounded-lg hover:bg-white/40 transition-colors text-center" id={`legend-medhigh-${cluster.id}`}>
                  <div className="w-2 h-2 rounded-full bg-orange-500 ring-2 ring-orange-100 shadow-xs" id={`legend-dot-medhigh-${cluster.id}`} />
                  <span className="text-[8px] font-extrabold text-stone-700 leading-none">Med-Hi</span>
                  <span className="text-[6px] text-stone-400 font-medium leading-none">Cluster</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 p-1 rounded-lg hover:bg-white/40 transition-colors text-center" id={`legend-medium-${cluster.id}`}>
                  <div className="w-2 h-2 rounded-full bg-yellow-500 ring-2 ring-yellow-100 shadow-xs" id={`legend-dot-medium-${cluster.id}`} />
                  <span className="text-[8px] font-extrabold text-stone-700 leading-none">Medium</span>
                  <span className="text-[6px] text-stone-400 font-medium leading-none">Proxy</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 p-1 rounded-lg hover:bg-white/40 transition-colors text-center" id={`legend-low-${cluster.id}`}>
                  <div className="w-2 h-2 rounded-full bg-lime-500 ring-2 ring-lime-100 shadow-xs" id={`legend-dot-low-${cluster.id}`} />
                  <span className="text-[8px] font-extrabold text-stone-700 leading-none">Low</span>
                  <span className="text-[6px] text-stone-400 font-medium leading-none">Isolated</span>
                </div>
              </div>
            </div>

            {/* Re-center Map & Copy Coordinates Action Row */}
            <div className="mt-3 pt-3 border-t border-stone-100 flex flex-col gap-1.5" id={`recenter-map-container-${cluster.id}`}>
              <div className="grid grid-cols-2 gap-2" id={`cluster-actions-grid-${cluster.id}`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCenterOnCluster?.(cluster.lat, cluster.lng);
                  }}
                  className="py-1.5 bg-olive/10 hover:bg-olive text-olive hover:text-white rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-all duration-200 hover:shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  id={`popover-${cluster.id}-center-map-btn`}
                  title="Immediately re-center map onto these coordinates"
                >
                  <Compass className="w-3.5 h-3.5 animate-pulse" />
                  Center Map
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const coordsText = `${cluster.lat}, ${cluster.lng}`;
                    navigator.clipboard.writeText(coordsText).then(() => {
                      setCopiedClusterCoords(true);
                      setTimeout(() => setCopiedClusterCoords(false), 2000);
                    });
                  }}
                  className={`py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-all duration-200 hover:shadow-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                    copiedClusterCoords
                      ? 'bg-emerald-500 text-white'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                  id={`popover-${cluster.id}-copy-coords-btn`}
                  title="Copy cluster latitude and longitude coordinates to clipboard"
                >
                  {copiedClusterCoords ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedClusterCoords ? 'Copied' : 'Copy Coords'}
                </button>
              </div>
            </div>

            {/* Popover Arrow */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Show QR Modal */}
      <AnimatePresence>
        {activeQrGathering && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/45 backdrop-blur-xs"
              onClick={() => setActiveQrGathering(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="relative bg-[#faf8f5] w-full max-w-xs rounded-3xl p-6 shadow-2xl border border-stone-200 flex flex-col items-center text-center pointer-events-auto"
              id={`cluster-qr-modal-${activeQrGathering.id}`}
            >
              <button 
                onClick={() => setActiveQrGathering(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all active:scale-95"
                id={`cluster-qr-close-btn-${activeQrGathering.id}`}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-10 h-10 rounded-full bg-olive/10 flex items-center justify-center mb-3">
                <QrCodeIcon className="w-5 h-5 text-olive" />
              </div>

              <h3 className="serif text-lg font-bold text-stone-900 leading-snug px-2">
                Join {activeQrGathering.title}
              </h3>
              <p className="text-[10px] text-stone-500 mt-1 max-w-[220px]">
                Scan with your phone's camera to instantly find this gathering and join the community.
              </p>

              <div className="my-5 bg-[#fcfbf7] p-4 rounded-2xl border border-olive/10 shadow-inner flex flex-col items-center justify-center w-full">
                {showQrQrDataUrl ? (
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="p-1.5 rounded-xl bg-white border border-stone-100 shadow-xs"
                  >
                    <img 
                      src={showQrQrDataUrl} 
                      alt={`QR Code for ${activeQrGathering.title}`} 
                      className="w-40 h-40 object-contain rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                  </motion.div>
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-stone-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider animate-pulse">Generating QR...</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setActiveQrGathering(null)}
                className="w-full py-2.5 bg-olive hover:bg-olive/90 active:scale-95 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all animate-fade-in"
                id={`cluster-qr-done-btn-${activeQrGathering.id}`}
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
