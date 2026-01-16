// Shared, app-agnostic types that will be used by both the web app and worker jobs.
// Keep these "business domain" focused and avoid importing runtime dependencies here.

export type AppEnv = 'development' | 'staging' | 'production';

export type JobName =
  | 'hourly:refresh-trends'
  | 'daily:generate-copy'
  | 'daily:expire-deals';

export type DealStatus = 'active' | 'expired' | 'scheduled';

export interface Deal {
  id: string;
  title: string;
  status: DealStatus;
  expiresAt: string; // ISO date string for portability
}

export interface TrendSnapshot {
  id: string;
  keyword: string;
  score: number;
  capturedAt: string; // ISO date string
}

