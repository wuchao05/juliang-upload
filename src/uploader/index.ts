import { chromium, BrowserContext, Page } from 'playwright';
import { UploaderConfig, PlaywrightConfig, UploadResult } from '../types';
import { getLogger } from '../logger';

/**
 * 上传器类
 */
export class Uploader {
  private uploaderConfig: UploaderConfig;
  private playwrightConfig: PlaywrightConfig;
  private context: BrowserContext | null = null;
  private page: Page | null = null; // 复用的单个页面实例
  private logger = getLogger();

  constructor(uploaderConfig: UploaderConfig, playwrightConfig: PlaywrightConfig) {
    this.uploaderConfig = uploaderConfig;
    this.playwrightConfig = playwrightConfig;
  }

  /**
   * 初始化浏览器
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('正在初始化 Playwright 浏览器（持久化模式）');

      // 使用 launchPersistentContext 实现真正的持久化
      // 这样会保存 cookies、localStorage、session 等所有浏览器数据
      this.context = await chromium.launchPersistentContext(
        this.playwrightConfig.userDataDir,
        {
          headless: this.playwrightConfig.headless,
          slowMo: this.playwrightConfig.slowMo,
          viewport: null, // 支持最大化
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          args: [
            '--start-maximized',
          ]
        }
      );

      // 创建一个固定的页面实例，所有任务复用
      this.page = await this.context.newPage();
      await this.page.bringToFront(); // 强制显示窗口

      this.logger.info(`Playwright 浏览器初始化成功，数据目录: ${this.playwrightConfig.userDataDir}`);
      this.logger.info('已创建固定标签页，所有上传任务将复用此标签页');
    } catch (error) {
      this.logger.error(`初始化浏览器失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 关闭浏览器
   */
  public async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      this.logger.info('浏览器已关闭（登录状态已保存）');
    } catch (error) {
      this.logger.error(`关闭浏览器失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 随机延迟
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 等待页面加载完成
   */
  private async waitForPageReady(page: Page): Promise<void> {
    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await this.randomDelay(1000, 2000);
    } catch (error) {
      this.logger.warn('等待页面加载超时，继续执行');
    }
  }

  /**
   * 上传单批文件
   */
  private async uploadBatch(
    page: Page, 
    files: string[], 
    batchIndex: number, 
    totalBatches: number,
    taskId: string,
    drama: string
  ): Promise<boolean> {
    try {
      this.logger.uploadBatch(taskId, drama, batchIndex, totalBatches, files.length);

      // 1. 查找并点击上传按钮（button 包含 span 文本"上传视频"）
      this.logger.debug('查找上传按钮: button > span:text("上传视频")', { taskId, drama });
      
      const uploadButton = page.locator(this.uploaderConfig.selectors.uploadButton).first();
      
      // 等待按钮可见和可点击
      await uploadButton.waitFor({ state: 'visible', timeout: 10000 });
      await this.randomDelay(500, 1000);
      await uploadButton.click();
      
      this.logger.debug('上传按钮点击成功，侧边上传面板应已打开', { taskId, drama });
      await this.randomDelay(1000, 2000);

      // 2. 等待上传面板出现
      this.logger.debug(`等待上传面板出现: ${this.uploaderConfig.selectors.uploadPanel}`, { taskId, drama });
      
      const uploadPanel = page.locator(this.uploaderConfig.selectors.uploadPanel).first();
      await uploadPanel.waitFor({ state: 'visible', timeout: 10000 });
      await this.randomDelay(500, 1000);

      // 3. 使用文件选择器事件机制上传文件
      this.logger.debug(`正在设置 ${files.length} 个文件（通过文件选择器事件）`, { taskId, drama });
      
      // 监听文件选择器弹出事件
      const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });
      
      // 点击上传面板触发文件选择对话框
      await uploadPanel.click();
      
      // 等待文件选择器出现并设置文件
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(files);
      
      this.logger.debug('文件设置成功，开始上传', { taskId, drama });
      await this.randomDelay(2000, 3000);

      // 5. 等待所有文件上传完成
      // 通过检查每个进度条的成功状态来判断上传是否完成
      this.logger.debug('等待文件上传完成（轮询进度条状态）', { taskId, drama });
      
      const maxWaitTime = 600000; // 10分钟
      const startTime = Date.now();
      let allUploaded = false;

      // 先等待一下，让文件开始上传和进度条出现
      await this.randomDelay(3000, 4000);

      while (Date.now() - startTime < maxWaitTime) {
        try {
          // 查找所有进度条元素
          const progressBars = page.locator('.material-center-v2-oc-upload-table-name-progress');
          const progressCount = await progressBars.count();
          
          if (progressCount === 0) {
            this.logger.debug('进度条未找到，继续等待...', { taskId, drama });
            await this.randomDelay(2000, 3000);
            continue;
          }

          this.logger.debug(`找到 ${progressCount} 个进度条（期望 ${files.length} 个）`, { taskId, drama });

          // 检查每个进度条是否有成功标识（同级元素）
          let successCount = 0;
          
          for (let i = 0; i < progressCount; i++) {
            const progressBar = progressBars.nth(i);
            
            // 获取进度条的父元素，然后在父元素中查找 success 类（同级元素）
            const parent = progressBar.locator('..');
            const successElement = parent.locator('.material-center-v2-oc-upload-table-name-progress-success');
            const hasSuccess = await successElement.count() > 0;
            
            if (hasSuccess) {
              successCount++;
            }
          }

          this.logger.debug(`上传进度: ${successCount}/${progressCount} 个素材已完成`, { taskId, drama });

          // 检查是否所有素材都上传完成
          if (successCount === progressCount && progressCount >= files.length) {
            allUploaded = true;
            this.logger.debug('所有素材上传完成（所有进度条显示成功状态）', { taskId, drama });
            break;
          }

          // 继续等待
          await this.randomDelay(3000, 4000);
        } catch (error) {
          // 继续等待
          this.logger.debug(`检查上传状态时出错: ${error instanceof Error ? error.message : String(error)}`, { taskId, drama });
          await this.randomDelay(2000, 3000);
        }
      }

      if (!allUploaded) {
        throw new Error('等待文件上传超时（10分钟）');
      }

      this.logger.debug('所有文件上传完成', { taskId, drama });
      await this.randomDelay(1000, 2000);

      // 6. 点击确定按钮（如果还有下一批或这是最后一批）
      this.logger.debug('查找并点击确定按钮', { taskId, drama });
      
      const confirmButton = page.locator(this.uploaderConfig.selectors.confirmButton).first();
      await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
      await this.randomDelay(500, 1000);
      await confirmButton.click();
      
      this.logger.debug('确定按钮点击成功', { taskId, drama });

      // 批次间延迟
      await this.randomDelay(
        this.uploaderConfig.batchDelayMin,
        this.uploaderConfig.batchDelayMax
      );

      return true;
    } catch (error) {
      this.logger.error(
        `上传第 ${batchIndex}/${totalBatches} 批失败: ${error instanceof Error ? error.message : String(error)}`,
        { taskId, drama }
      );
      return false;
    }
  }

  /**
   * 上传所有文件
   */
  public async uploadFiles(
    url: string,
    files: string[],
    taskId: string,
    drama: string
  ): Promise<UploadResult> {
    if (!this.page) {
      throw new Error('浏览器未初始化，请先调用 initialize()');
    }

    try {
      this.logger.info(`开始上传任务，共 ${files.length} 个文件`, { taskId, drama });

      // 复用固定的页面实例，只需要导航到新 URL
      this.logger.debug(`正在导航到上传页面: ${url}`, { taskId, drama });
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await this.waitForPageReady(this.page);

      this.logger.debug('页面加载完成', { taskId, drama });

      // 分批上传
      const batchSize = this.uploaderConfig.batchSize;
      const batches: string[][] = [];

      for (let i = 0; i < files.length; i += batchSize) {
        batches.push(files.slice(i, i + batchSize));
      }

      const totalBatches = batches.length;
      this.logger.info(`文件分为 ${totalBatches} 批上传`, { taskId, drama });

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const success = await this.uploadBatch(
          this.page,
          batch,
          i + 1,
          totalBatches,
          taskId,
          drama
        );

        if (!success) {
          return {
            success: false,
            totalFiles: files.length,
            uploadedBatches: i,
            error: `第 ${i + 1} 批上传失败`
          };
        }
      }

      this.logger.info(`所有文件上传成功`, { taskId, drama });

      // 不关闭页面，下一个任务继续复用

      return {
        success: true,
        totalFiles: files.length,
        uploadedBatches: totalBatches
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`上传任务失败: ${errorMsg}`, { taskId, drama });

      // 错误时也不关闭页面，保留供人工检查，且下个任务继续使用
      if (!this.playwrightConfig.headless) {
        this.logger.warn('页面保留供人工检查，程序将继续处理下一个任务', { taskId, drama });
      }

      return {
        success: false,
        totalFiles: files.length,
        uploadedBatches: 0,
        error: errorMsg
      };
    }
  }

  /**
   * 检查登录状态（可选实现）
   */
  public async checkLoginStatus(url: string): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    try {
      // 复用固定页面
      await this.page.goto(url, { timeout: 30000 });
      await this.randomDelay(2000, 3000);

      // 检查是否有登录相关的元素
      // 这里需要根据实际页面调整
      const isLoggedIn = !await this.page.locator('text=登录').isVisible().catch(() => false);

      return isLoggedIn;
    } catch (error) {
      return false;
    }
  }
}

/**
 * 创建上传器
 */
export function createUploader(
  uploaderConfig: UploaderConfig,
  playwrightConfig: PlaywrightConfig
): Uploader {
  return new Uploader(uploaderConfig, playwrightConfig);
}

