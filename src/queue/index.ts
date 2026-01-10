import { Task, TaskStatus, Config } from "../types";
import { getLogger } from "../logger";
import { createFileManager } from "../file";
import { createDouyinManager } from "../douyin";
import { Uploader } from "../uploader";
import { FeishuClient } from "../feishu/api";

/**
 * 任务队列类
 */
export class TaskQueue {
  private queue: Task[] = [];
  private taskMap: Map<string, Task> = new Map();
  private isProcessing: boolean = false;
  private logger = getLogger();

  /**
   * 添加任务到队列
   */
  public addTask(task: Task): boolean {
    // 防止重复入队
    if (this.taskMap.has(task.recordId)) {
      this.logger.debug(`任务 ${task.recordId} 已在队列中，跳过`, {
        taskId: task.id,
        drama: task.drama,
      });
      return false;
    }

    this.queue.push(task);
    this.taskMap.set(task.recordId, task);

    this.logger.info(`任务已入队: ${task.drama} (${task.date})`, {
      taskId: task.id,
      drama: task.drama,
    });

    return true;
  }

  /**
   * 批量添加任务
   */
  public addTasks(tasks: Task[]): number {
    let addedCount = 0;

    for (const task of tasks) {
      if (this.addTask(task)) {
        addedCount++;
      }
    }

    return addedCount;
  }

  /**
   * 获取下一个待处理任务
   */
  private getNextTask(): Task | null {
    for (const task of this.queue) {
      if (task.status === TaskStatus.PENDING) {
        return task;
      }
    }
    return null;
  }

  /**
   * 更新任务状态
   */
  private updateTaskStatus(
    task: Task,
    status: TaskStatus,
    error?: string
  ): void {
    task.status = status;
    task.updatedAt = new Date();

    if (error) {
      task.error = error;
    }

    this.taskMap.set(task.recordId, task);
  }

  /**
   * 获取队列统计信息
   */
  public getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    skipped: number;
  } {
    return {
      total: this.queue.length,
      pending: this.queue.filter((t) => t.status === TaskStatus.PENDING).length,
      running: this.queue.filter((t) => t.status === TaskStatus.RUNNING).length,
      completed: this.queue.filter((t) => t.status === TaskStatus.COMPLETED)
        .length,
      skipped: this.queue.filter((t) => t.status === TaskStatus.SKIPPED).length,
    };
  }

  /**
   * 清理已完成的任务
   */
  public cleanup(): void {
    const before = this.queue.length;

    this.queue = this.queue.filter((task) => {
      if (
        task.status === TaskStatus.COMPLETED ||
        task.status === TaskStatus.SKIPPED
      ) {
        this.taskMap.delete(task.recordId);
        return false;
      }
      return true;
    });

    const removed = before - this.queue.length;
    if (removed > 0) {
      this.logger.info(`清理了 ${removed} 个已完成的任务`);
    }
  }

  /**
   * 检查是否正在处理
   */
  public isRunning(): boolean {
    return this.isProcessing;
  }

  /**
   * 停止处理
   */
  public stop(): void {
    this.isProcessing = false;
    this.logger.info("任务队列已停止");
  }

  /**
   * 启动队列处理（单 worker 串行消费）
   */
  public async startProcessing(
    config: Config,
    uploader: Uploader,
    feishuClient: FeishuClient
  ): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn("任务队列已在运行中");
      return;
    }

    this.isProcessing = true;
    this.logger.info("任务队列开始处理");

    const fileManager = createFileManager(config.local.rootDir);
    const douyinManager = createDouyinManager(config.douyin);

    while (this.isProcessing) {
      const task = this.getNextTask();

      if (!task) {
        // 没有待处理任务，等待一段时间
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      // 处理任务
      await this.processTask(
        task,
        config,
        fileManager,
        douyinManager,
        uploader,
        feishuClient
      );

      // 任务间延迟
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  /**
   * 处理单个任务
   */
  private async processTask(
    task: Task,
    _config: Config,
    fileManager: any,
    douyinManager: any,
    uploader: Uploader,
    feishuClient: FeishuClient
  ): Promise<void> {
    try {
      // 标记为运行中
      this.updateTaskStatus(task, TaskStatus.RUNNING);
      this.logger.taskStart(task.id, task.drama, task.date, task.account);

      // 1. 扫描本地目录
      const scanResult = fileManager.scanDramaDirectory(task.date, task.drama);

      if (!scanResult.exists || scanResult.mp4Files.length === 0) {
        this.updateTaskStatus(task, TaskStatus.SKIPPED, scanResult.error);
        this.logger.taskSkipped(
          task.id,
          task.drama,
          scanResult.error || "目录或文件不存在"
        );
        return;
      }

      task.localPath = scanResult.path;
      task.mp4Files = scanResult.mp4Files;

      this.logger.pathCheck(task.id, task.drama, scanResult.path, true);
      this.logger.fileScan(task.id, task.drama, scanResult.mp4Files.length);

      // 2. 验证文件可读性
      const { valid, invalid } = fileManager.validateFiles(scanResult.mp4Files);

      if (invalid.length > 0) {
        this.logger.warn(`${invalid.length} 个文件不可读`, {
          taskId: task.id,
          drama: task.drama,
        });
      }

      if (valid.length === 0) {
        this.updateTaskStatus(task, TaskStatus.SKIPPED, "没有可读的 MP4 文件");
        this.logger.taskSkipped(task.id, task.drama, "没有可读的 MP4 文件");
        return;
      }

      // 3. 构造上传 URL
      const uploadUrl = douyinManager.buildUploadUrl(task.account);
      this.logger.debug(`上传 URL: ${uploadUrl}`, {
        taskId: task.id,
        drama: task.drama,
      });

      // 4. 更新飞书状态为"上传中"
      const updateToUploading = await feishuClient.updateRecordStatus(
        task.recordId,
        "上传中",
        task.drama
      );
      if (!updateToUploading) {
        this.logger.warn(`更新飞书状态为"上传中"失败，但继续上传`, {
          taskId: task.id,
          drama: task.drama,
        });
      }

      // 5. 执行上传
      const uploadResult = await uploader.uploadFiles(
        uploadUrl,
        valid,
        task.id,
        task.drama
      );

      if (!uploadResult.success) {
        this.updateTaskStatus(task, TaskStatus.SKIPPED, uploadResult.error);
        this.logger.taskFailed(
          task.id,
          task.drama,
          uploadResult.error || "上传失败"
        );

        // 上传失败（重试多次后仍失败），将飞书状态改回"待上传"
        const revertSuccess = await feishuClient.updateRecordStatus(
          task.recordId,
          "待上传",
          task.drama
        );
        if (revertSuccess) {
          this.logger.info(`已将飞书状态恢复为"待上传"，等待下次重试`, {
            taskId: task.id,
            drama: task.drama,
          });
        } else {
          this.logger.warn(`恢复飞书状态为"待上传"失败`, {
            taskId: task.id,
            drama: task.drama,
          });
        }

        return;
      }

      this.logger.taskComplete(
        task.id,
        task.drama,
        uploadResult.totalFiles,
        uploadResult.uploadedBatches
      );

      // 6. 更新飞书状态为"待资产化"
      const updateSuccess = await feishuClient.updateRecordStatus(
        task.recordId,
        "待资产化",
        task.drama
      );

      if (updateSuccess) {
        this.updateTaskStatus(task, TaskStatus.COMPLETED);
        this.logger.feishuUpdate(task.id, task.drama, true);

        // 7. 上传成功，删除本地素材目录
        if (task.localPath) {
          const deleteSuccess = fileManager.deleteDirectory(task.localPath);
          if (deleteSuccess) {
            this.logger.info(`本地素材目录已清理: ${task.localPath}`, {
              taskId: task.id,
              drama: task.drama,
            });
          } else {
            this.logger.warn(`清理本地素材目录失败: ${task.localPath}`, {
              taskId: task.id,
              drama: task.drama,
            });
          }
        }
      } else {
        // 虽然上传成功但飞书更新失败，标记为 skipped 以便下次重试
        this.updateTaskStatus(task, TaskStatus.SKIPPED, "飞书状态更新失败");
        this.logger.feishuUpdate(task.id, task.drama, false);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.updateTaskStatus(task, TaskStatus.SKIPPED, errorMsg);
      this.logger.taskFailed(task.id, task.drama, errorMsg);
    }
  }
}

/**
 * 创建任务队列
 */
export function createTaskQueue(): TaskQueue {
  return new TaskQueue();
}
