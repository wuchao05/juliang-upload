import * as fs from "fs";
import * as path from "path";
import { LogLevel, LogOptions } from "../types";

/**
 * 日志管理类
 */
export class Logger {
  private logDir: string;
  private logFile: string;

  constructor(logDir: string = "./logs") {
    this.logDir = logDir;
    this.logFile = path.join(logDir, "upload.log");
    this.ensureLogDir();
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    options?: LogOptions
  ): string {
    const timestamp = new Date().toISOString();
    const parts = [`[${timestamp}]`, `[${level}]`];

    if (options?.taskId) {
      parts.push(`[Task:${options.taskId}]`);
    }

    if (options?.drama) {
      parts.push(`[剧名:${options.drama}]`);
    }

    parts.push(message);

    return parts.join(" ");
  }

  /**
   * 写入日志文件
   */
  private writeToFile(message: string): void {
    try {
      fs.appendFileSync(this.logFile, message + "\n", "utf-8");
    } catch (error) {
      console.error("写入日志文件失败:", error);
    }
  }

  /**
   * 输出日志
   */
  private log(level: LogLevel, message: string, options?: LogOptions): void {
    const formattedMessage = this.formatMessage(level, message, options);

    // 控制台输出
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
    }

    // 写入文件
    this.writeToFile(formattedMessage);
  }

  /**
   * Debug 级别日志
   */
  public debug(message: string, options?: LogOptions): void {
    this.log(LogLevel.DEBUG, message, options);
  }

  /**
   * Info 级别日志
   */
  public info(message: string, options?: LogOptions): void {
    this.log(LogLevel.INFO, message, options);
  }

  /**
   * Warning 级别日志
   */
  public warn(message: string, options?: LogOptions): void {
    this.log(LogLevel.WARN, message, options);
  }

  /**
   * Error 级别日志
   */
  public error(message: string, options?: LogOptions): void {
    this.log(LogLevel.ERROR, message, options);
  }

  /**
   * 记录任务开始
   */
  public taskStart(
    taskId: string,
    drama: string,
    date: string,
    account: string
  ): void {
    this.info(`任务开始 - 剧名: ${drama}, 日期: ${date}, 账户: ${account}`, {
      taskId,
      drama,
    });
  }

  /**
   * 记录任务完成
   */
  public taskComplete(
    taskId: string,
    drama: string,
    totalFiles: number,
    batches: number
  ): void {
    this.info(`任务完成 - 共上传 ${totalFiles} 个文件, 分 ${batches} 批`, {
      taskId,
      drama,
    });
  }

  /**
   * 记录任务跳过
   */
  public taskSkipped(taskId: string, drama: string, reason: string): void {
    this.warn(`任务跳过 - 原因: ${reason}`, {
      taskId,
      drama,
    });
  }

  /**
   * 记录任务失败
   */
  public taskFailed(taskId: string, drama: string, error: string): void {
    this.error(`任务失败 - 错误: ${error}`, {
      taskId,
      drama,
    });
  }

  /**
   * 记录路径检查
   */
  public pathCheck(
    taskId: string,
    drama: string,
    path: string,
    exists: boolean
  ): void {
    const message = exists ? `路径检查通过: ${path}` : `路径不存在: ${path}`;

    this.info(message, { taskId, drama });
  }

  /**
   * 记录文件扫描
   */
  public fileScan(taskId: string, drama: string, fileCount: number): void {
    this.info(`扫描到 ${fileCount} 个 MP4 文件`, { taskId, drama });
  }

  /**
   * 记录上传批次
   */
  public uploadBatch(
    taskId: string,
    drama: string,
    batchIndex: number,
    totalBatches: number,
    fileCount: number
  ): void {
    this.info(
      `开始上传第 ${batchIndex}/${totalBatches} 批 (${fileCount} 个文件)`,
      {
        taskId,
        drama,
      }
    );
  }

  /**
   * 记录飞书状态更新
   */
  public feishuUpdate(taskId: string, drama: string, success: boolean): void {
    const message = success
      ? "飞书状态更新成功: 待上传 → 待资产化"
      : "飞书状态更新失败";

    if (success) {
      this.info(message, { taskId, drama });
    } else {
      this.error(message, { taskId, drama });
    }
  }
}

// 导出单例
let logger: Logger | null = null;

export function getLogger(logDir?: string): Logger {
  if (!logger) {
    logger = new Logger(logDir);
  }
  return logger;
}
