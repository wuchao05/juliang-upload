import * as fs from "fs";
import * as path from "path";
import { FileScanResult } from "../types";
import { getLogger } from "../logger";

/**
 * 文件处理类
 */
export class FileManager {
  private rootDir: string;
  private logger = getLogger();

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  /**
   * 将日期格式从 YYYY-MM-DD 转换为 M.D 导出（不带前导零）
   * 例如：2025-12-24 → 12.24导出，2025-01-07 → 1.7导出
   */
  public convertDateToFolder(date: string): string {
    try {
      // 支持多种日期格式
      const dateObj = new Date(date);

      if (isNaN(dateObj.getTime())) {
        throw new Error(`无效的日期格式: ${date}`);
      }

      const month = dateObj.getMonth() + 1; // 不带前导零
      const day = dateObj.getDate(); // 不带前导零

      return `${month}.${day}导出`;
    } catch (error) {
      this.logger.error(
        `日期转换失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * 构造剧目录路径
   * {rootDir}/{MM.DD}导出/{剧名}/
   */
  public buildDramaPath(date: string, drama: string): string {
    const dateFolder = this.convertDateToFolder(date);
    return path.join(this.rootDir, dateFolder, drama);
  }

  /**
   * 检查目录是否存在
   */
  public directoryExists(dirPath: string): boolean {
    try {
      return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * 扫描目录下的所有 MP4 文件
   */
  public scanMp4Files(dirPath: string): string[] {
    try {
      if (!this.directoryExists(dirPath)) {
        return [];
      }

      const files = fs.readdirSync(dirPath);
      const mp4Files = files
        .filter((file) => file.toLowerCase().endsWith(".mp4"))
        .map((file) => path.join(dirPath, file))
        .sort((a, b) => {
          // 自然排序（支持 1.mp4, 2.mp4, ..., 10.mp4 等）
          const aName = path.basename(a, ".mp4");
          const bName = path.basename(b, ".mp4");

          const aNum = parseInt(aName);
          const bNum = parseInt(bName);

          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }

          return aName.localeCompare(bName);
        });

      return mp4Files;
    } catch (error) {
      this.logger.error(
        `扫描 MP4 文件失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  /**
   * 扫描并验证剧目录
   */
  public scanDramaDirectory(date: string, drama: string): FileScanResult {
    try {
      // 构造路径
      const dramaPath = this.buildDramaPath(date, drama);

      // 检查日期目录
      const dateFolder = this.convertDateToFolder(date);
      const datePath = path.join(this.rootDir, dateFolder);

      if (!this.directoryExists(datePath)) {
        return {
          exists: false,
          path: dramaPath,
          mp4Files: [],
          error: `日期目录不存在: ${datePath}`,
        };
      }

      // 检查剧目录
      if (!this.directoryExists(dramaPath)) {
        return {
          exists: false,
          path: dramaPath,
          mp4Files: [],
          error: `剧目录不存在: ${dramaPath}`,
        };
      }

      // 扫描 MP4 文件
      const mp4Files = this.scanMp4Files(dramaPath);

      if (mp4Files.length === 0) {
        return {
          exists: true,
          path: dramaPath,
          mp4Files: [],
          error: `目录下没有 MP4 文件: ${dramaPath}`,
        };
      }

      return {
        exists: true,
        path: dramaPath,
        mp4Files,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`扫描剧目录失败: ${errorMsg}`);

      return {
        exists: false,
        path: "",
        mp4Files: [],
        error: errorMsg,
      };
    }
  }

  /**
   * 验证文件是否可读
   */
  public validateFiles(files: string[]): {
    valid: string[];
    invalid: string[];
  } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const file of files) {
      try {
        fs.accessSync(file, fs.constants.R_OK);
        valid.push(file);
      } catch (error) {
        invalid.push(file);
        this.logger.warn(`文件不可读: ${file}`);
      }
    }

    return { valid, invalid };
  }

  /**
   * 获取文件大小（MB）
   */
  public getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size / (1024 * 1024);
    } catch (error) {
      return 0;
    }
  }

  /**
   * 获取多个文件的总大小（MB）
   */
  public getTotalSize(files: string[]): number {
    return files.reduce((total, file) => total + this.getFileSize(file), 0);
  }

  /**
   * 删除目录及其所有内容
   * @param dirPath 要删除的目录路径
   * @returns 是否删除成功
   */
  public deleteDirectory(dirPath: string): boolean {
    try {
      if (!this.directoryExists(dirPath)) {
        this.logger.warn(`目录不存在，无需删除: ${dirPath}`);
        return true;
      }

      // 递归删除目录
      fs.rmSync(dirPath, { recursive: true, force: true });
      this.logger.info(`素材目录已删除: ${dirPath}`);
      return true;
    } catch (error) {
      this.logger.error(
        `删除目录失败: ${dirPath}, 错误: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * 删除剧的素材目录
   * @param date 日期
   * @param drama 剧名
   * @returns 是否删除成功
   */
  public deleteDramaDirectory(date: string, drama: string): boolean {
    const dramaPath = this.buildDramaPath(date, drama);
    return this.deleteDirectory(dramaPath);
  }
}

/**
 * 创建文件管理器
 */
export function createFileManager(rootDir: string): FileManager {
  return new FileManager(rootDir);
}
