import { loadConfig } from './config';
import { getLogger } from './logger';
import { createFeishuClient } from './feishu/api';
import { createUploader } from './uploader';
import { createTaskQueue } from './queue';
import { createScheduler } from './scheduler';

/**
 * 主应用类
 */
class Application {
  private logger = getLogger();
  private scheduler: any = null;
  private uploader: any = null;

  /**
   * 初始化应用
   */
  private async initialize() {
    try {
      this.logger.info('========================================');
      this.logger.info('巨量素材自动上传系统启动');
      this.logger.info('========================================');

      // 1. 加载配置
      this.logger.info('正在加载配置文件');
      const config = loadConfig();
      this.logger.info('配置文件加载成功');

      // 2. 创建飞书客户端
      this.logger.info('正在初始化飞书客户端');
      const feishuClient = createFeishuClient(config.feishu);
      this.logger.info('飞书客户端初始化成功');

      // 3. 创建上传器
      this.logger.info('正在初始化 Playwright 上传器');
      this.uploader = createUploader(config.uploader, config.playwright);
      await this.uploader.initialize();
      this.logger.info('上传器初始化成功');

      // 4. 创建任务队列
      this.logger.info('正在初始化任务队列');
      const taskQueue = createTaskQueue();
      this.logger.info('任务队列初始化成功');

      // 5. 创建调度器
      this.logger.info('正在初始化调度器');
      this.scheduler = createScheduler(config, feishuClient, taskQueue);
      this.logger.info('调度器初始化成功');

      this.logger.info('========================================');
      this.logger.info('所有模块初始化完成');
      this.logger.info('========================================');

      return { scheduler: this.scheduler, uploader: this.uploader };
    } catch (error) {
      this.logger.error(`初始化失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 启动应用
   */
  public async start() {
    try {
      const { scheduler, uploader } = await this.initialize();

      // 注册优雅退出
      this.registerShutdownHandlers();

      // 启动调度器
      this.logger.info('正在启动调度器');
      await scheduler.start(uploader);
    } catch (error) {
      this.logger.error(`应用启动失败: ${error instanceof Error ? error.message : String(error)}`);
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * 优雅关闭
   */
  private async shutdown() {
    this.logger.info('========================================');
    this.logger.info('正在关闭应用');
    this.logger.info('========================================');

    try {
      // 停止调度器
      if (this.scheduler) {
        this.logger.info('正在停止调度器');
        this.scheduler.stop();
      }

      // 关闭浏览器
      if (this.uploader) {
        this.logger.info('正在关闭浏览器');
        await this.uploader.close();
      }

      this.logger.info('应用已安全关闭');
    } catch (error) {
      this.logger.error(`关闭应用时出错: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 注册关闭处理器
   */
  private registerShutdownHandlers() {
    // 处理 Ctrl+C
    process.on('SIGINT', async () => {
      this.logger.info('收到 SIGINT 信号');
      await this.shutdown();
      process.exit(0);
    });

    // 处理终止信号
    process.on('SIGTERM', async () => {
      this.logger.info('收到 SIGTERM 信号');
      await this.shutdown();
      process.exit(0);
    });

    // 处理未捕获的异常
    process.on('uncaughtException', async (error) => {
      this.logger.error(`未捕获的异常: ${error.message}`);
      this.logger.error(error.stack || '');
      await this.shutdown();
      process.exit(1);
    });

    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', async (reason, _promise) => {
      this.logger.error(`未处理的 Promise 拒绝: ${reason}`);
      await this.shutdown();
      process.exit(1);
    });
  }
}

/**
 * 程序入口
 */
async function main() {
  const app = new Application();
  await app.start();
}

// 启动应用
main().catch(error => {
  console.error('应用启动失败:', error);
  process.exit(1);
});

