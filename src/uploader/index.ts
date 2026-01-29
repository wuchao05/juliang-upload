import { chromium, BrowserContext, Page } from "playwright";
import { UploaderConfig, PlaywrightConfig, UploadResult } from "../types";
import { getLogger } from "../logger";
import { ProgressManager } from "../progress";

/**
 * 上传器类
 */
export class Uploader {
  private uploaderConfig: UploaderConfig;
  private playwrightConfig: PlaywrightConfig;
  private context: BrowserContext | null = null;
  private page: Page | null = null; // 复用的单个页面实例
  private logger = getLogger();
  private progressManager: ProgressManager;

  constructor(
    uploaderConfig: UploaderConfig,
    playwrightConfig: PlaywrightConfig
  ) {
    this.uploaderConfig = uploaderConfig;
    this.playwrightConfig = playwrightConfig;
    this.progressManager = new ProgressManager();
  }

  /**
   * 初始化浏览器
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info("正在初始化 Playwright 浏览器（持久化模式）");

      // 使用 launchPersistentContext 实现真正的持久化
      // 这样会保存 cookies、localStorage、session 等所有浏览器数据
      this.context = await chromium.launchPersistentContext(
        this.playwrightConfig.userDataDir,
        {
          headless: this.playwrightConfig.headless,
          slowMo: this.playwrightConfig.slowMo,
          viewport: null, // 支持最大化
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          args: ["--start-maximized"],
        }
      );

      // 创建一个固定的页面实例，所有任务复用
      this.page = await this.context.newPage();
      await this.page.bringToFront(); // 强制显示窗口

      this.logger.info(
        `Playwright 浏览器初始化成功，数据目录: ${this.playwrightConfig.userDataDir}`
      );
      this.logger.info("已创建固定标签页，所有上传任务将复用此标签页");
    } catch (error) {
      this.logger.error(
        `初始化浏览器失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
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

      this.logger.info("浏览器已关闭（登录状态已保存）");
    } catch (error) {
      this.logger.error(
        `关闭浏览器失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 随机延迟
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * 等待页面加载完成
   */
  private async waitForPageReady(page: Page): Promise<void> {
    try {
      await page.waitForLoadState("networkidle", { timeout: 30000 });
      await this.randomDelay(1000, 2000);
    } catch (error) {
      this.logger.warn("等待页面加载超时，继续执行");
    }
  }

  /**
   * 上传单批文件（支持重试）
   * 策略：必须所有素材都上传成功才算成功，不足额就重试
   */
  private async uploadBatch(
    page: Page,
    files: string[],
    batchIndex: number,
    totalBatches: number,
    taskId: string,
    drama: string
  ): Promise<boolean> {
    const maxRetries = 10; // 最多重试10次

    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        if (retry > 0) {
          this.logger.info(
            `第 ${batchIndex}/${totalBatches} 批重试第 ${retry} 次`,
            { taskId, drama }
          );

          // 重试前刷新页面，确保页面状态干净
          this.logger.debug("刷新页面以清理状态...", { taskId, drama });
          await page.reload({ waitUntil: "networkidle", timeout: 60000 });
          await this.waitForPageReady(page);
          this.logger.debug("页面刷新完成，等待 5 秒后重试", { taskId, drama });
          await page.waitForTimeout(5000); // 固定等待5秒
        }

        const result = await this.uploadBatchInternal(
          page,
          files,
          batchIndex,
          totalBatches,
          taskId,
          drama,
          retry // 传递当前重试次数
        );

        // 完全成功
        if (result.success) {
          return true;
        }

        // 不足额，需要重试
        if (retry < maxRetries - 1) {
          const shortfall = files.length - result.successCount;
          this.logger.warn(
            `第 ${batchIndex}/${totalBatches} 批上传不足额（${result.successCount}/${files.length}，差 ${shortfall} 个），准备刷新页面后重试...`,
            { taskId, drama }
          );
        } else {
          // 最后一次重试仍失败
          this.logger.error(
            `第 ${batchIndex}/${totalBatches} 批重试 ${maxRetries} 次后仍失败（${result.successCount}/${files.length}）`,
            { taskId, drama }
          );
        }
      } catch (error) {
        this.logger.error(
          `上传第 ${batchIndex}/${totalBatches} 批失败（第 ${
            retry + 1
          } 次尝试）: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { taskId, drama }
        );

        if (retry < maxRetries - 1) {
          this.logger.warn("准备刷新页面后重试...", { taskId, drama });
        } else {
          throw error;
        }
      }
    }

    return false;
  }

  /**
   * 上传单批文件（内部实现）
   * @returns { success: boolean, successCount: number }
   */
  private async uploadBatchInternal(
    page: Page,
    files: string[],
    batchIndex: number,
    totalBatches: number,
    taskId: string,
    drama: string,
    retryCount: number
  ): Promise<{ success: boolean; successCount: number }> {
    try {
      this.logger.uploadBatch(
        taskId,
        drama,
        batchIndex,
        totalBatches,
        files.length
      );

      // 1. 查找并点击上传按钮（button 包含 span 文本"上传视频"）
      this.logger.debug(`第 ${batchIndex}/${totalBatches} 批：查找上传按钮`, {
        taskId,
        drama,
      });

      const uploadButton = page
        .locator(this.uploaderConfig.selectors.uploadButton)
        .first();

      // 等待按钮可见和可点击（对于非第一批，可能需要更长时间）
      const waitTimeout = batchIndex === 1 ? 10000 : 20000;
      await uploadButton.waitFor({ state: "visible", timeout: waitTimeout });
      await this.randomDelay(500, 1000);
      await uploadButton.click();

      this.logger.debug("上传按钮点击成功，等待侧边上传面板打开", {
        taskId,
        drama,
      });

      // 2. 等待上传面板完全加载
      this.logger.debug(
        `等待上传面板出现: ${this.uploaderConfig.selectors.uploadPanel}`,
        { taskId, drama }
      );

      const uploadPanel = page
        .locator(this.uploaderConfig.selectors.uploadPanel)
        .first();
      await uploadPanel.waitFor({ state: "visible", timeout: 10000 }); // 最多10秒

      // 等待上传面板动画完成和完全准备好（增加等待时间）
      this.logger.debug(`上传面板已出现，等待完全加载和准备就绪...`, {
        taskId,
        drama,
      });
      await this.randomDelay(3000, 4000); // 增加到3-4秒

      // 3. 使用文件选择器事件机制上传文件
      this.logger.debug(
        `正在设置 ${files.length} 个文件（通过文件选择器事件）`,
        { taskId, drama }
      );

      // 先开始监听文件选择器事件（在点击之前）
      const fileChooserTimeout = 15000; // 15秒超时（如果没弹出说明页面有问题）
      this.logger.debug(
        `开始监听文件选择器事件（超时: ${fileChooserTimeout}ms）`,
        { taskId, drama }
      );
      const fileChooserPromise = page.waitForEvent("filechooser", {
        timeout: fileChooserTimeout,
      });

      // 点击上传面板触发文件选择对话框
      this.logger.debug(`点击上传面板触发文件选择`, { taskId, drama });
      await uploadPanel.click();

      // 等待文件选择器出现并设置文件
      this.logger.debug(`等待文件选择器弹出...`, { taskId, drama });
      const fileChooser = await fileChooserPromise;
      this.logger.debug(`文件选择器已弹出，设置 ${files.length} 个文件`, {
        taskId,
        drama,
      });
      await fileChooser.setFiles(files);

      this.logger.debug("文件设置成功，开始上传", { taskId, drama });
      await this.randomDelay(2000, 3000);

      // 5. 等待所有文件上传完成
      // 通过检查每个进度条的成功状态来判断上传是否完成
      this.logger.debug("等待文件上传完成（每30秒轮询一次进度条状态）", {
        taskId,
        drama,
      });

      const maxWaitTime = 600000; // 10分钟
      const startTime = Date.now();
      let finalSuccessCount = 0;

      // 先等待一下，让文件开始上传和进度条出现
      await this.randomDelay(5000, 6000);

      while (Date.now() - startTime < maxWaitTime) {
        try {
          // 查找所有进度条元素
          const progressBars = page.locator(
            ".material-center-v2-oc-upload-table-name-progress"
          );
          const progressCount = await progressBars.count();

          if (progressCount === 0) {
            this.logger.debug("进度条未找到，继续等待...", { taskId, drama });
            await this.randomDelay(5000, 6000);
            continue;
          }

          // 如果进度条数量少于预期，且不是刚开始就少（说明有文件上传失败），立即取消并重试
          const elapsedTime = Date.now() - startTime;
          if (progressCount < files.length && elapsedTime > 20000) {
            // 等待20秒后如果数量仍然不足，说明有文件上传失败
            this.logger.warn(
              `检测到进度条数量不足：${progressCount}/${files.length}，立即取消并准备重试`,
              { taskId, drama }
            );

            // 点击取消按钮
            try {
              const cancelButton = page
                .locator(this.uploaderConfig.selectors.cancelButton)
                .first();
              await cancelButton.waitFor({ state: "visible", timeout: 5000 });
              await this.randomDelay(500, 1000);
              await cancelButton.click();
              this.logger.debug("取消按钮点击成功", {
                taskId,
                drama,
              });
              await this.randomDelay(2000, 3000);
            } catch (cancelError) {
              this.logger.error(
                `点击取消按钮失败: ${
                  cancelError instanceof Error
                    ? cancelError.message
                    : String(cancelError)
                }`,
                { taskId, drama }
              );
            }

            // 返回不足额状态，让外层重试
            return { success: false, successCount: progressCount };
          }

          this.logger.debug(
            `找到 ${progressCount} 个进度条（期望 ${files.length} 个）`,
            { taskId, drama }
          );

          // 检查每个进度条是否有成功标识（同级元素）
          let successCount = 0;

          for (let i = 0; i < progressCount; i++) {
            const progressBar = progressBars.nth(i);

            // 获取进度条的父元素，然后在父元素中查找 success 类（同级元素）
            const parent = progressBar.locator("..");
            const successElement = parent.locator(
              ".material-center-v2-oc-upload-table-name-progress-success"
            );
            const hasSuccess = (await successElement.count()) > 0;

            if (hasSuccess) {
              successCount++;
            }
          }

          this.logger.debug(
            `上传进度: ${successCount}/${progressCount} 个素材已完成`,
            { taskId, drama }
          );

          // 判断上传完成的条件：所有找到的进度条都显示成功状态
          if (successCount === progressCount && successCount > 0) {
            finalSuccessCount = successCount;

            if (progressCount < files.length) {
              // 进度条数量少于预期，说明有文件上传失败
              this.logger.warn(
                `上传完成但数量不足：${progressCount}/${files.length}（第 ${
                  retryCount + 1
                } 次尝试）`,
                { taskId, drama }
              );

              // 点击取消按钮，让外层决定是否重试或容许
              try {
                const cancelButton = page
                  .locator(this.uploaderConfig.selectors.cancelButton)
                  .first();
                await cancelButton.waitFor({ state: "visible", timeout: 5000 });
                await this.randomDelay(500, 1000);
                await cancelButton.click();
                this.logger.debug("取消按钮点击成功", {
                  taskId,
                  drama,
                });
                await this.randomDelay(2000, 3000);
              } catch (cancelError) {
                this.logger.error(
                  `点击取消按钮失败: ${
                    cancelError instanceof Error
                      ? cancelError.message
                      : String(cancelError)
                  }`,
                  { taskId, drama }
                );
              }

              // 返回不足额状态，让外层决定
              return { success: false, successCount: finalSuccessCount };
            } else {
              // 进度条数量符合预期，全部上传成功
              this.logger.debug("所有素材上传完成（所有进度条显示成功状态）", {
                taskId,
                drama,
              });

              this.logger.debug("所有文件上传完成", { taskId, drama });
              await this.randomDelay(1000, 2000);

              // 6. 点击确定按钮
              this.logger.debug("查找并点击确定按钮", { taskId, drama });

              const confirmButton = page
                .locator(this.uploaderConfig.selectors.confirmButton)
                .first();
              await confirmButton.waitFor({ state: "visible", timeout: 10000 });
              await this.randomDelay(500, 1000);
              await confirmButton.click();

              this.logger.debug("确定按钮点击成功", { taskId, drama });

              // 批次间延迟
              if (batchIndex < totalBatches) {
                this.logger.debug(`等待页面准备下一批上传...`, {
                  taskId,
                  drama,
                });
                await this.randomDelay(5000, 8000);
              } else {
                await this.randomDelay(
                  this.uploaderConfig.batchDelayMin,
                  this.uploaderConfig.batchDelayMax
                );
              }

              return { success: true, successCount: finalSuccessCount };
            }
          }

          // 继续等待（30秒轮询间隔）
          await page.waitForTimeout(30000);
        } catch (error) {
          // 继续等待
          this.logger.debug(
            `检查上传状态时出错: ${
              error instanceof Error ? error.message : String(error)
            }`,
            { taskId, drama }
          );
          await this.randomDelay(5000, 6000);
        }
      }

      // 超时
      throw new Error("等待文件上传超时（10分钟）");
    } catch (error) {
      this.logger.error(
        `上传第 ${batchIndex}/${totalBatches} 批失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { taskId, drama }
      );
      return { success: false, successCount: 0 };
    }
  }

  /**
   * 上传所有文件（支持断点续传）
   */
  public async uploadFiles(
    url: string,
    files: string[],
    taskId: string,
    drama: string,
    recordId: string,
    date: string,
    account: string
  ): Promise<UploadResult> {
    if (!this.page) {
      throw new Error("浏览器未初始化，请先调用 initialize()");
    }

    try {
      this.logger.info(`开始上传任务，共 ${files.length} 个文件`, {
        taskId,
        drama,
      });

      // 复用固定的页面实例，只需要导航到新 URL
      this.logger.debug(`正在导航到上传页面: ${url}`, { taskId, drama });
      await this.page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      await this.waitForPageReady(this.page);

      this.logger.debug("页面加载完成", { taskId, drama });

      // 分批上传
      const batchSize = this.uploaderConfig.batchSize;
      const batches: string[][] = [];

      for (let i = 0; i < files.length; i += batchSize) {
        batches.push(files.slice(i, i + batchSize));
      }

      const totalBatches = batches.length;

      // 检查是否有保存的进度（断点续传）
      const savedProgress = this.progressManager.getProgress(recordId);
      let startBatchIndex = 0;

      if (savedProgress && savedProgress.totalBatches === totalBatches) {
        startBatchIndex = savedProgress.completedBatches;
        if (startBatchIndex > 0) {
          this.logger.info(
            `检测到上传进度，从第 ${
              startBatchIndex + 1
            }/${totalBatches} 批开始继续上传`,
            { taskId, drama }
          );
        }
      } else {
        this.logger.info(`文件分为 ${totalBatches} 批上传`, { taskId, drama });
      }

      // 从保存的进度开始上传
      for (let i = startBatchIndex; i < batches.length; i++) {
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
          // 上传失败，保存进度
          this.progressManager.updateProgress(
            recordId,
            drama,
            date,
            account,
            totalBatches,
            i // 保存已完成的批次数
          );

          return {
            success: false,
            totalFiles: files.length,
            uploadedBatches: i,
            error: `第 ${i + 1} 批上传失败`,
          };
        }

        // 每批成功后更新进度
        this.progressManager.updateProgress(
          recordId,
          drama,
          date,
          account,
          totalBatches,
          i + 1 // 已完成的批次数
        );
      }

      this.logger.info(`所有文件上传成功`, { taskId, drama });

      // 上传完成，清除进度记录
      this.progressManager.clearProgress(recordId, drama);

      // 不关闭页面，下一个任务继续复用

      return {
        success: true,
        totalFiles: files.length,
        uploadedBatches: totalBatches,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`上传任务失败: ${errorMsg}`, { taskId, drama });

      // 错误时也不关闭页面，保留供人工检查，且下个任务继续使用
      if (!this.playwrightConfig.headless) {
        this.logger.warn("页面保留供人工检查，程序将继续处理下一个任务", {
          taskId,
          drama,
        });
      }

      return {
        success: false,
        totalFiles: files.length,
        uploadedBatches: 0,
        error: errorMsg,
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
      const isLoggedIn = !(await this.page
        .locator("text=登录")
        .isVisible()
        .catch(() => false));

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
