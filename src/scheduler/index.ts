import { Config, Task, TaskStatus } from '../types';
import { getLogger } from '../logger';
import { FeishuClient } from '../feishu/api';
import { TaskQueue } from '../queue';
import { v4 as uuidv4 } from 'uuid';

/**
 * 调度器类
 */
export class Scheduler {
  private config: Config;
  private feishuClient: FeishuClient;
  private taskQueue: TaskQueue;
  private logger = getLogger();
  private isRunning: boolean = false;
  private fetchTimer: NodeJS.Timeout | null = null;

  constructor(config: Config, feishuClient: FeishuClient, taskQueue: TaskQueue) {
    this.config = config;
    this.feishuClient = feishuClient;
    this.taskQueue = taskQueue;
  }

  /**
   * 从飞书拉取任务并入队
   */
  private async fetchAndEnqueueTasks(): Promise<void> {
    try {
      this.logger.info('开始从飞书拉取待上传任务');

      // 先清理已完成和已跳过的任务，释放队列空间
      this.taskQueue.cleanup();

      const records = await this.feishuClient.getPendingRecords();

      if (records.length === 0) {
        this.logger.info('没有待上传的任务');
        return;
      }

      // 转换为内部 Task 对象
      const tasks: Task[] = records.map(record => ({
        id: uuidv4(),
        recordId: record.recordId,
        drama: record.drama,
        date: record.date,
        account: record.account,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // 批量入队
      const addedCount = this.taskQueue.addTasks(tasks);

      this.logger.info(`成功入队 ${addedCount} 个新任务`);

      // 输出队列统计
      const stats = this.taskQueue.getStats();
      this.logger.info(
        `队列状态: 总计=${stats.total}, 待处理=${stats.pending}, 运行中=${stats.running}, 已完成=${stats.completed}, 已跳过=${stats.skipped}`
      );
    } catch (error) {
      this.logger.error(`拉取飞书任务失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 启动定时拉取
   */
  private startFetching(): void {
    const intervalMs = this.config.scheduler.fetchIntervalMinutes * 60 * 1000;

    this.logger.info(`定时拉取已启动，间隔: ${this.config.scheduler.fetchIntervalMinutes} 分钟`);

    // 立即执行一次
    this.fetchAndEnqueueTasks();

    // 设置定时器
    this.fetchTimer = setInterval(() => {
      this.fetchAndEnqueueTasks();
    }, intervalMs);
  }

  /**
   * 停止定时拉取
   */
  private stopFetching(): void {
    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = null;
      this.logger.info('定时拉取已停止');
    }
  }

  /**
   * 启动调度器
   */
  public async start(uploader: any): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('调度器已在运行中');
      return;
    }

    this.isRunning = true;
    this.logger.info('调度器启动');

    // 启动定时拉取
    this.startFetching();

    // 启动队列处理
    await this.taskQueue.startProcessing(this.config, uploader, this.feishuClient);
  }

  /**
   * 停止调度器
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('正在停止调度器');

    this.isRunning = false;
    this.stopFetching();
    this.taskQueue.stop();

    this.logger.info('调度器已停止');
  }

  /**
   * 检查是否运行中
   */
  public isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 获取队列统计
   */
  public getQueueStats() {
    return this.taskQueue.getStats();
  }

  /**
   * 清理已完成任务
   */
  public cleanupCompleted(): void {
    this.taskQueue.cleanup();
  }
}

/**
 * 创建调度器
 */
export function createScheduler(
  config: Config,
  feishuClient: FeishuClient,
  taskQueue: TaskQueue
): Scheduler {
  return new Scheduler(config, feishuClient, taskQueue);
}

