import type { QuizCategory, QuizData, QuizEvaluation } from '../utils/quiz';

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface ViewportBounds {
  low: LatLngLiteral;
  high: LatLngLiteral;
}

export interface GeocodedLocation {
  query: string;
  formattedAddress: string;
  placeId: string;
  granularity: string;
  location: LatLngLiteral;
  viewport: ViewportBounds | null;
  city: string;
  state: string;
  country: string;
  cityStateLabel: string;
}

export interface ExplorerError {
  source: 'geocode' | 'map' | 'insights' | 'quiz';
  title: string;
  message: string;
  statusCode?: number;
  endpoint?: string;
  detail?: string;
}

export interface PresetDestination {
  id: string;
  label: string;
  query: string;
  regionHint: string;
}

export type InsightsStatus = 'idle' | 'loading' | 'success' | 'error';

export interface InsightsState {
  status: InsightsStatus;
  cityState: string | null;
  html: string | null;
  error: ExplorerError | null;
}

export type QuizModalStatus = 'closed' | 'choose' | 'loading' | 'active' | 'submitted' | 'error';

export interface QuizState {
  status: QuizModalStatus;
  cityState: string | null;
  category: QuizCategory | null;
  data: QuizData | null;
  selectedAnswers: Record<string, number>;
  evaluation: QuizEvaluation | null;
  error: ExplorerError | null;
}
