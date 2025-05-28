/**
 * Common utility types and patterns for claude-task-master
 */

/**
 * Deep partial type - makes all properties and nested properties optional
 */
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

/**
 * Deep readonly type - makes all properties and nested properties readonly
 */
export type DeepReadonly<T> = T extends object ? {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
} : T;

/**
 * Type for extracting keys of a specific type
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Type for nullable values
 */
export type Nullable<T> = T | null;

/**
 * Type for optional values
 */
export type Optional<T> = T | undefined;

/**
 * Type for values that might not exist yet
 */
export type Maybe<T> = T | null | undefined;

/**
 * Extract non-nullable type
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Type for JSON-serializable values
 */
export type JsonValue = 
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

/**
 * Type for configuration objects with environment variable overrides
 */
export interface ConfigWithEnv<T> {
  value: T;
  envVar?: string;
  description?: string;
  required?: boolean;
}

/**
 * Type for paginated results
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Type for sorted results
 */
export interface SortOptions<T> {
  field: keyof T;
  direction: 'asc' | 'desc';
}

/**
 * Type for filter options
 */
export interface FilterOptions<T> {
  field: keyof T;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
  value: any;
}

/**
 * Type for command execution results
 */
export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  message?: string;
  duration?: number;
}

/**
 * Type for async operation states
 */
export type AsyncState<T> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

/**
 * Type for operation metadata
 */
export interface OperationMetadata {
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  userId?: string;
  sessionId?: string;
  version?: string;
}

/**
 * Type for change tracking
 */
export interface ChangeSet<T> {
  before: T;
  after: T;
  changedFields: (keyof T)[];
  changedAt: Date;
  changedBy?: string;
}

/**
 * Type for feature flags
 */
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
  enabledFor?: string[];
  disabledFor?: string[];
}

/**
 * Type helper to make certain keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Type helper to make certain keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Type for environment configuration
 */
export type Environment = 'development' | 'test' | 'staging' | 'production';

/**
 * Type for log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Type for file paths
 */
export interface FilePath {
  absolute: string;
  relative?: string;
  directory: string;
  filename: string;
  extension?: string;
}

/**
 * Type for semantic version
 */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * Helper to create a branded type
 */
export type Brand<K, T> = K & { __brand: T };

/**
 * Common branded types
 */
export type UserId = Brand<string, 'UserId'>;
export type TaskId = Brand<string, 'TaskId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type Timestamp = Brand<number, 'Timestamp'>;

/**
 * Type for retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * Type for rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (context: any) => string;
}