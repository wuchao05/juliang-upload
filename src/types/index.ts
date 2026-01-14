/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  SKIPPED = 'skipped'
}

/**
 * 飞书字段配置
 */
export interface FeishuFields {
  status: string;
  account: string;
  drama: string;
  date: string;
}

/**
 * 飞书配置
 */
export interface FeishuConfig {
  app_id: string;
  app_secret: string;
  app_token: string;
  table_id: string;
  base_url: string;
  fields: FeishuFields;
}

/**
 * 本地配置
 */
export interface LocalConfig {
  rootDir: string;
  sourceMaterialDir?: string; // 源素材目录（可选）
  autoDeleteSourceMaterial?: boolean; // 是否自动删除源素材目录（默认 false）
}

/**
 * 巨量配置
 */
export interface DouyinConfig {
  baseUploadUrl: string;
}

/**
 * 上传器选择器配置
 */
export interface UploaderSelectors {
  uploadButton: string;
  uploadPanel: string;
  fileInput: string;
  tableBody: string;
  operationItem: string;
  cancelUploadText: string;
  confirmButtonContainer: string;
  confirmButton: string;
  cancelButton: string;
}

/**
 * 上传器配置
 */
export interface UploaderConfig {
  batchSize: number;
  batchDelayMin: number;
  batchDelayMax: number;
  selectors: UploaderSelectors;
}

/**
 * 调度器配置
 */
export interface SchedulerConfig {
  fetchIntervalMinutes: number;
}

/**
 * Playwright 配置
 */
export interface PlaywrightConfig {
  headless: boolean;
  slowMo: number;
  userDataDir: string;
}

/**
 * 完整配置
 */
export interface Config {
  feishu: FeishuConfig;
  local: LocalConfig;
  douyin: DouyinConfig;
  uploader: UploaderConfig;
  scheduler: SchedulerConfig;
  playwright: PlaywrightConfig;
}

/**
 * 飞书记录
 */
export interface FeishuRecord {
  record_id: string;
  fields: {
    [key: string]: any;
  };
}

/**
 * 飞书 API 响应
 */
export interface FeishuApiResponse<T = any> {
  code: number;
  msg: string;
  data?: T;
}

/**
 * 飞书 tenant_access_token 响应
 */
export interface FeishuTokenResponse {
  tenant_access_token: string;
  expire: number;
}

/**
 * 飞书记录列表响应
 */
export interface FeishuRecordListResponse {
  has_more: boolean;
  page_token?: string;
  total: number;
  items: FeishuRecord[];
}

/**
 * 任务数据
 */
export interface Task {
  id: string;
  recordId: string;
  drama: string;
  date: string;
  account: string;
  status: TaskStatus;
  localPath?: string;
  mp4Files?: string[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * 日志选项
 */
export interface LogOptions {
  level?: LogLevel;
  taskId?: string;
  drama?: string;
}

/**
 * 上传结果
 */
export interface UploadResult {
  success: boolean;
  totalFiles: number;
  uploadedBatches: number;
  error?: string;
}

/**
 * 文件扫描结果
 */
export interface FileScanResult {
  exists: boolean;
  path: string;
  mp4Files: string[];
  error?: string;
}

