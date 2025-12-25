import { DouyinConfig } from '../types';

/**
 * 巨量相关工具类
 */
export class DouyinManager {
  private config: DouyinConfig;

  constructor(config: DouyinConfig) {
    this.config = config;
  }

  /**
   * 构造上传 URL
   * 将模板中的 {accountId} 替换为实际账户 ID
   */
  public buildUploadUrl(accountId: string): string {
    return this.config.baseUploadUrl.replace('{accountId}', accountId);
  }

  /**
   * 验证 URL 格式
   */
  public validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 从 URL 中提取账户 ID
   */
  public extractAccountId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const aadvidParam = urlObj.searchParams.get('aadvid');
      return aadvidParam;
    } catch {
      return null;
    }
  }
}

/**
 * 创建巨量管理器
 */
export function createDouyinManager(config: DouyinConfig): DouyinManager {
  return new DouyinManager(config);
}

