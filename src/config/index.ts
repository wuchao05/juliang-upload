import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../types';

/**
 * 配置管理类
 */
export class ConfigManager {
  private config: Config | null = null;
  private configPath: string;

  constructor(configPath: string = './config.json') {
    this.configPath = configPath;
  }

  /**
   * 加载配置文件
   */
  public load(): Config {
    try {
      const configFile = path.resolve(this.configPath);
      
      if (!fs.existsSync(configFile)) {
        throw new Error(`配置文件不存在: ${configFile}`);
      }

      const configContent = fs.readFileSync(configFile, 'utf-8');
      const config = JSON.parse(configContent) as Config;

      this.validate(config);
      this.config = config;

      return config;
    } catch (error) {
      throw new Error(`加载配置文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证配置
   */
  private validate(config: Config): void {
    const errors: string[] = [];

    // 验证飞书配置
    if (!config.feishu) {
      errors.push('缺少 feishu 配置');
    } else {
      if (!config.feishu.app_id) errors.push('feishu.app_id 不能为空');
      if (!config.feishu.app_secret) errors.push('feishu.app_secret 不能为空');
      if (!config.feishu.app_token) errors.push('feishu.app_token 不能为空');
      if (!config.feishu.table_id) errors.push('feishu.table_id 不能为空');
      if (!config.feishu.base_url) errors.push('feishu.base_url 不能为空');
      
      if (!config.feishu.fields) {
        errors.push('feishu.fields 不能为空');
      } else {
        if (!config.feishu.fields.status) errors.push('feishu.fields.status 不能为空');
        if (!config.feishu.fields.account) errors.push('feishu.fields.account 不能为空');
        if (!config.feishu.fields.drama) errors.push('feishu.fields.drama 不能为空');
        if (!config.feishu.fields.date) errors.push('feishu.fields.date 不能为空');
      }
    }

    // 验证本地配置
    if (!config.local) {
      errors.push('缺少 local 配置');
    } else {
      if (!config.local.rootDir) errors.push('local.rootDir 不能为空');
    }

    // 验证巨量配置
    if (!config.douyin) {
      errors.push('缺少 douyin 配置');
    } else {
      if (!config.douyin.baseUploadUrl) errors.push('douyin.baseUploadUrl 不能为空');
      if (!config.douyin.baseUploadUrl.includes('{accountId}')) {
        errors.push('douyin.baseUploadUrl 必须包含 {accountId} 占位符');
      }
    }

    // 验证上传器配置
    if (!config.uploader) {
      errors.push('缺少 uploader 配置');
    } else {
      if (!config.uploader.batchSize || config.uploader.batchSize <= 0) {
        errors.push('uploader.batchSize 必须大于 0');
      }
      if (!config.uploader.selectors) {
        errors.push('缺少 uploader.selectors 配置');
      }
    }

    // 验证调度器配置
    if (!config.scheduler) {
      errors.push('缺少 scheduler 配置');
    } else {
      if (!config.scheduler.fetchIntervalMinutes || config.scheduler.fetchIntervalMinutes <= 0) {
        errors.push('scheduler.fetchIntervalMinutes 必须大于 0');
      }
    }

    // 验证 Playwright 配置
    if (!config.playwright) {
      errors.push('缺少 playwright 配置');
    }

    if (errors.length > 0) {
      throw new Error(`配置验证失败:\n${errors.join('\n')}`);
    }
  }

  /**
   * 获取配置
   */
  public getConfig(): Config {
    if (!this.config) {
      throw new Error('配置未加载，请先调用 load()');
    }
    return this.config;
  }
}

// 导出单例
let configManager: ConfigManager | null = null;

export function getConfigManager(configPath?: string): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager(configPath);
  }
  return configManager;
}

export function loadConfig(configPath?: string): Config {
  const manager = getConfigManager(configPath);
  return manager.load();
}

