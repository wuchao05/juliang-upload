import * as fs from "fs";
import * as path from "path";
import { getLogger } from "../logger";

/**
 * 上传进度记录
 */
interface UploadProgress {
  recordId: string; // 飞书记录ID
  drama: string; // 剧名
  date: string; // 日期
  account: string; // 账户
  totalBatches: number; // 总批次数
  completedBatches: number; // 已完成的批次数
  lastUpdated: string; // 最后更新时间
}

/**
 * 进度管理器
 */
export class ProgressManager {
  private progressFile: string;
  private progressMap: Map<string, UploadProgress> = new Map();
  private logger = getLogger();

  constructor(progressDir: string = "./upload-progress") {
    // 确保进度目录存在
    if (!fs.existsSync(progressDir)) {
      fs.mkdirSync(progressDir, { recursive: true });
    }
    this.progressFile = path.join(progressDir, "progress.json");
    this.loadProgress();
  }

  /**
   * 从文件加载进度
   */
  private loadProgress(): void {
    try {
      if (fs.existsSync(this.progressFile)) {
        const data = fs.readFileSync(this.progressFile, "utf-8");
        const progressArray: UploadProgress[] = JSON.parse(data);
        this.progressMap.clear();
        progressArray.forEach((p) => {
          this.progressMap.set(p.recordId, p);
        });
        this.logger.debug(`已加载 ${this.progressMap.size} 条上传进度记录`);
      }
    } catch (error) {
      this.logger.error(
        `加载进度文件失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 保存进度到文件
   */
  private saveProgress(): void {
    try {
      const progressArray = Array.from(this.progressMap.values());
      fs.writeFileSync(
        this.progressFile,
        JSON.stringify(progressArray, null, 2),
        "utf-8"
      );
    } catch (error) {
      this.logger.error(
        `保存进度文件失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 获取任务的上传进度
   */
  public getProgress(recordId: string): UploadProgress | null {
    return this.progressMap.get(recordId) || null;
  }

  /**
   * 更新任务进度
   */
  public updateProgress(
    recordId: string,
    drama: string,
    date: string,
    account: string,
    totalBatches: number,
    completedBatches: number
  ): void {
    const progress: UploadProgress = {
      recordId,
      drama,
      date,
      account,
      totalBatches,
      completedBatches,
      lastUpdated: new Date().toISOString(),
    };

    this.progressMap.set(recordId, progress);
    this.saveProgress();

    this.logger.debug(
      `已更新进度: ${drama} - 完成 ${completedBatches}/${totalBatches} 批`,
      { drama }
    );
  }

  /**
   * 清除任务进度
   */
  public clearProgress(recordId: string, drama: string): void {
    if (this.progressMap.has(recordId)) {
      this.progressMap.delete(recordId);
      this.saveProgress();
      this.logger.info(`已清除上传进度: ${drama}`, { drama });
    }
  }

  /**
   * 清除所有进度
   */
  public clearAllProgress(): void {
    this.progressMap.clear();
    this.saveProgress();
    this.logger.info("已清除所有上传进度");
  }

  /**
   * 获取所有进度记录
   */
  public getAllProgress(): UploadProgress[] {
    return Array.from(this.progressMap.values());
  }
}

/**
 * 创建进度管理器
 */
export function createProgressManager(progressDir?: string): ProgressManager {
  return new ProgressManager(progressDir);
}
