import axios, { AxiosInstance } from "axios";
import {
  FeishuConfig,
  FeishuApiResponse,
  FeishuRecordListResponse,
  FeishuRecord,
} from "../types";
import { FeishuRecordData } from "./types";
import { getLogger } from "../logger";

/**
 * 飞书 API 客户端
 */
export class FeishuClient {
  private config: FeishuConfig;
  private client: AxiosInstance;
  private logger = getLogger();

  constructor(config: FeishuConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.base_url,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * 获取 tenant_access_token
   * 每次调用都重新获取，不使用缓存
   */
  private async getTenantAccessToken(): Promise<string> {
    try {
      this.logger.debug("正在获取飞书 tenant_access_token");

      const response = await axios.post<any>(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        {
          app_id: this.config.app_id,
          app_secret: this.config.app_secret,
        }
      );

      if (response.data.code !== 0) {
        throw new Error(
          `获取 token 失败 [code: ${response.data.code}]: ${response.data.msg}`
        );
      }

      // 飞书 token API 直接返回 tenant_access_token，不是嵌套在 data 里
      const tenant_access_token = response.data.tenant_access_token as string;

      if (!tenant_access_token) {
        throw new Error(`获取 token 失败: tenant_access_token 为空`);
      }

      this.logger.debug("飞书 tenant_access_token 获取成功");

      return tenant_access_token;
    } catch (error) {
      this.logger.error(
        `获取飞书 token 失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * 执行 API 请求
   */
  private async request<T>(
    method: "get" | "post" | "put" | "patch",
    url: string,
    data?: any
  ): Promise<T> {
    try {
      // 每次请求都获取新的 token
      const token = await this.getTenantAccessToken();

      const response = await this.client.request<FeishuApiResponse<T>>({
        method,
        url,
        data,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.code !== 0) {
        throw new Error(`API 调用失败: ${response.data.msg}`);
      }

      return response.data.data as T;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取待上传的记录
   */
  public async getPendingRecords(): Promise<FeishuRecordData[]> {
    try {
      this.logger.info("正在从飞书获取待上传记录");

      const url = `/apps/${this.config.app_token}/tables/${this.config.table_id}/records/search`;

      let allRecords: FeishuRecord[] = [];
      let pageToken: string | undefined = undefined;
      let hasMore = true;

      // 分页获取所有记录
      while (hasMore) {
        const requestBody: any = {
          field_names: [
            this.config.fields.drama,
            this.config.fields.date,
            this.config.fields.account,
            this.config.fields.status,
          ],
          page_size: 100,
          filter: {
            conjunction: "and",
            conditions: [
              {
                field_name: this.config.fields.status,
                operator: "is",
                value: ["待上传"],
              },
            ],
          },
        };

        if (pageToken) {
          requestBody.page_token = pageToken;
        }

        const response = await this.request<FeishuRecordListResponse>(
          "post",
          url,
          requestBody
        );

        allRecords = allRecords.concat(response.items || []);
        hasMore = response.has_more;
        pageToken = response.page_token;
      }

      // 转换为内部格式
      const records = allRecords
        .map((record) => this.parseRecord(record))
        .filter((r) => r !== null) as FeishuRecordData[];

      this.logger.info(`从飞书获取到 ${records.length} 条待上传记录`);

      return records;
    } catch (error) {
      this.logger.error(
        `获取飞书记录失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * 解析飞书记录
   */
  private parseRecord(record: FeishuRecord): FeishuRecordData | null {
    try {
      const fields = record.fields;

      let drama = fields[this.config.fields.drama];
      let date = fields[this.config.fields.date];
      let account = fields[this.config.fields.account];
      let status = fields[this.config.fields.status];

      // 飞书可能返回数组格式，取第一个元素
      if (Array.isArray(drama)) drama = drama[0];
      if (Array.isArray(date)) date = date[0];
      if (Array.isArray(account)) account = account[0];
      if (Array.isArray(status)) status = status[0];

      // 如果是对象，尝试获取 text 属性
      if (typeof drama === "object" && drama !== null)
        drama = (drama as any).text || drama;
      if (typeof date === "object" && date !== null)
        date = (date as any).text || date;
      if (typeof account === "object" && account !== null)
        account = (account as any).text || account;
      if (typeof status === "object" && status !== null)
        status = (status as any).text || status;

      // 如果日期是时间戳（数字），转换为 YYYY-MM-DD 格式
      if (typeof date === "number") {
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const day = String(dateObj.getDate()).padStart(2, "0");
        date = `${year}-${month}-${day}`;
      }

      // 验证必填字段
      if (!drama || !date || !account || !status) {
        this.logger.warn(`记录 ${record.record_id} 缺少必填字段，跳过`);
        return null;
      }

      return {
        recordId: record.record_id,
        drama: String(drama),
        date: String(date),
        account: String(account),
        status: String(status),
      };
    } catch (error) {
      this.logger.warn(
        `解析记录 ${record.record_id} 失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * 更新记录状态
   */
  public async updateRecordStatus(
    recordId: string,
    newStatus: string,
    drama: string
  ): Promise<boolean> {
    try {
      this.logger.debug(`正在更新记录 ${recordId} 的状态为"${newStatus}"`, { drama });

      // 使用官方推荐的 PATCH 方法更新记录
      const url = `/apps/${this.config.app_token}/tables/${this.config.table_id}/records/${recordId}`;

      await this.request("patch", url, {
        fields: {
          [this.config.fields.status]: newStatus,
        },
      });

      this.logger.info(`记录 ${recordId} 状态更新成功: ${newStatus}`, {
        drama,
      });

      return true;
    } catch (error) {
      this.logger.error(
        `更新记录 ${recordId} 状态失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { drama }
      );
      return false;
    }
  }

  /**
   * 批量更新记录状态（可选实现）
   */
  public async batchUpdateStatus(recordIds: string[], newStatus: string): Promise<void> {
    for (const recordId of recordIds) {
      await this.updateRecordStatus(recordId, newStatus, "batch");
    }
  }
}

/**
 * 创建飞书客户端
 */
export function createFeishuClient(config: FeishuConfig): FeishuClient {
  return new FeishuClient(config);
}
