# 飞书多维表格 API 使用指南

本文档说明项目中使用的飞书多维表格 API 接口及其正确用法。

## API 概览

| 功能       | 方法  | 端点                                                              | 说明               |
| ---------- | ----- | ----------------------------------------------------------------- | ------------------ |
| 获取 Token | POST  | `/auth/v3/tenant_access_token/internal`                           | 获取访问令牌       |
| 查询记录   | POST  | `/bitable/v1/apps/:app_token/tables/:table_id/records/search`     | 搜索符合条件的记录 |
| 更新记录   | PATCH | `/bitable/v1/apps/:app_token/tables/:table_id/records/:record_id` | 更新单条记录       |

---

## 1. 获取 Tenant Access Token

### 端点

```
POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
```

### 请求头

```
Content-Type: application/json
```

### 请求体

```json
{
  "app_id": "cli_a870f7611b7b1013",
  "app_secret": "NTwHbZG8rpOQyMEnXGPV6cNQ84KEqE8z"
}
```

### 响应示例

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "tenant_access_token": "t-xxx",
    "expire": 7200
  }
}
```

### 代码实现

```typescript
private async getTenantAccessToken(): Promise<string> {
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      app_id: this.config.app_id,
      app_secret: this.config.app_secret
    }
  );

  if (response.data.code !== 0) {
    throw new Error(`获取 token 失败: ${response.data.msg}`);
  }

  return response.data.data.tenant_access_token;
}
```

### 注意事项

- ✅ **每次调用 API 前都获取新 token**（简化逻辑，避免过期问题）
- Token 有效期为 2 小时，但我们不缓存
- 频率限制：50 次/分钟/应用

---

## 2. 查询记录（搜索）

### 端点

```
POST https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/search
```

### 请求头

```
Authorization: Bearer {tenant_access_token}
Content-Type: application/json
```

### 请求体

```json
{
  "field_names": ["剧名", "日期", "账户", "当前状态"],
  "page_size": 100,
  "filter": {
    "conjunction": "and",
    "conditions": [
      {
        "field_name": "当前状态",
        "operator": "is",
        "value": ["待上传"]
      }
    ]
  },
  "page_token": "可选，用于分页"
}
```

### 请求参数说明

| 参数        | 类型     | 必填 | 说明                               |
| ----------- | -------- | ---- | ---------------------------------- |
| field_names | string[] | 否   | 指定返回的字段，不填则返回所有字段 |
| page_size   | number   | 否   | 每页记录数，最大 500，默认 100     |
| page_token  | string   | 否   | 分页标记，首次请求不填             |
| filter      | object   | 否   | 筛选条件                           |

### 筛选条件 (filter) 结构

```typescript
{
  conjunction: "and" | "or",  // 多条件关系
  conditions: [
    {
      field_name: string,        // 字段名
      operator: string,          // 操作符
      value: any[]              // 值（数组）
    }
  ]
}
```

### 常用操作符

| 操作符           | 说明   | 示例                                                |
| ---------------- | ------ | --------------------------------------------------- |
| `is`             | 等于   | `{"operator": "is", "value": ["待上传"]}`           |
| `isNot`          | 不等于 | `{"operator": "isNot", "value": ["已完成"]}`        |
| `contains`       | 包含   | `{"operator": "contains", "value": ["测试"]}`       |
| `doesNotContain` | 不包含 | `{"operator": "doesNotContain", "value": ["删除"]}` |
| `isEmpty`        | 为空   | `{"operator": "isEmpty"}`                           |
| `isNotEmpty`     | 不为空 | `{"operator": "isNotEmpty"}`                        |

### 响应示例

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "has_more": false,
    "page_token": "",
    "total": 5,
    "items": [
      {
        "record_id": "recxxxxxx",
        "fields": {
          "剧名": "她醒了",
          "日期": "2025-12-24",
          "账户": "1852188842738771",
          "当前状态": "待上传"
        }
      }
    ]
  }
}
```

### 代码实现

```typescript
public async getPendingRecords(): Promise<FeishuRecordData[]> {
  const url = `/apps/${this.config.app_token}/tables/${this.config.table_id}/records/search`;

  let allRecords: FeishuRecord[] = [];
  let pageToken: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const requestBody: any = {
      field_names: [
        this.config.fields.drama,
        this.config.fields.date,
        this.config.fields.account,
        this.config.fields.status
      ],
      page_size: 100,
      filter: {
        conjunction: "and",
        conditions: [
          {
            field_name: this.config.fields.status,
            operator: "is",
            value: ["待上传"]
          }
        ]
      }
    };

    if (pageToken) {
      requestBody.page_token = pageToken;
    }

    const response = await this.request("post", url, requestBody);

    allRecords = allRecords.concat(response.items || []);
    hasMore = response.has_more;
    pageToken = response.page_token;
  }

  return allRecords;
}
```

### 注意事项

- ✅ 使用 POST 方法，不是 GET
- ✅ 端点是 `/records/search`，不是 `/records`
- ✅ 筛选条件放在请求体中，不是 URL 参数
- ✅ 字段名使用中文（与表格中的字段名完全一致）
- ✅ 支持分页，需要循环获取所有数据

---

## 3. 更新记录

### 端点

```
PATCH https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/{record_id}
```

### 请求头

```
Authorization: Bearer {tenant_access_token}
Content-Type: application/json
```

### 请求体

```json
{
  "fields": {
    "当前状态": "待资产化"
  }
}
```

### 请求参数说明

| 参数   | 类型   | 必填 | 说明               |
| ------ | ------ | ---- | ------------------ |
| fields | object | 是   | 要更新的字段及其值 |

### 响应示例

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "record": {
      "record_id": "recxxxxxx",
      "fields": {
        "当前状态": "待资产化"
      }
    }
  }
}
```

### 代码实现

```typescript
public async updateRecordStatus(recordId: string, drama: string): Promise<boolean> {
  try {
    const url = `/apps/${this.config.app_token}/tables/${this.config.table_id}/records/${recordId}`;

    await this.request("patch", url, {
      fields: {
        [this.config.fields.status]: "待资产化"
      }
    });

    this.logger.info(`记录 ${recordId} 状态更新成功: 待上传 → 待资产化`);
    return true;
  } catch (error) {
    this.logger.error(`更新记录失败: ${error}`);
    return false;
  }
}
```

### 注意事项

- ✅ 使用 PATCH 方法，不是 PUT
- ✅ 只更新指定的字段，不影响其他字段
- ✅ 字段名使用中文（与表格中的字段名完全一致）
- ✅ record_id 从查询接口返回的 `record_id` 字段获取

---

## 4. 错误处理

### 常见错误码

| 错误码   | 说明             | 解决方法                 |
| -------- | ---------------- | ------------------------ |
| 99991663 | token 无效或过期 | 重新获取 token           |
| 99991668 | 应用权限不足     | 检查应用权限配置         |
| 1254103  | 记录不存在       | 检查 record_id 是否正确  |
| 1254044  | 字段不存在       | 检查字段名是否与表格一致 |

### 错误响应示例

```json
{
  "code": 99991663,
  "msg": "token invalid",
  "data": {}
}
```

### 错误处理代码

```typescript
const response = await this.client.request({
  method,
  url,
  data,
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

if (response.data.code !== 0) {
  throw new Error(`API 调用失败 [${response.data.code}]: ${response.data.msg}`);
}
```

---

## 5. 完整流程示例

### 场景：查询待上传记录并更新状态

```typescript
// 1. 获取 token
const token = await getTenantAccessToken();

// 2. 查询待上传记录
const records = await getPendingRecords();

// 3. 处理每条记录
for (const record of records) {
  console.log(`处理记录: ${record.drama} - ${record.date}`);

  // ... 执行上传操作 ...

  // 4. 上传成功后更新状态
  const success = await updateRecordStatus(record.recordId, record.drama);

  if (success) {
    console.log(`记录 ${record.recordId} 状态已更新`);
  }
}
```

---

## 6. 性能优化建议

### Token 管理

- ✅ 每次 API 调用前获取新 token（简单可靠）
- ❌ 不缓存 token（避免过期问题）
- 频率：< 1 次/分钟（远低于限流 50 次/分钟）

### 查询优化

- ✅ 使用 `field_names` 只返回需要的字段
- ✅ 合理设置 `page_size`（建议 100）
- ✅ 正确处理分页（has_more + page_token）

### 更新优化

- ✅ 使用 PATCH 只更新需要的字段
- ✅ 串行更新，避免并发冲突
- ❌ 暂不使用批量更新接口（简单场景无需）

---

## 7. API 调用频率

### 当前场景（30 分钟轮询）

- 获取 token：1 次
- 查询记录：1 次（假设结果在 100 条内）
- 更新记录：N 次（N = 待上传记录数）

**示例计算：**

- 假设有 5 条待上传记录
- 总计：1 + 1 + 5 = 7 次 API 调用 / 30 分钟
- 平均：< 0.5 次/分钟

**飞书限流：**

- 限制：50 次/分钟/应用
- 实际：< 0.5 次/分钟
- 安全余量：充足 ✅

---

## 8. 安全建议

1. **凭证安全**

   - ✅ app_secret 不提交到版本控制
   - ✅ 使用环境变量或配置文件
   - ✅ 定期轮换凭证

2. **权限最小化**

   - ✅ 只申请必要的权限（读取+写入多维表格）
   - ❌ 不申请不需要的权限

3. **日志安全**
   - ✅ 记录操作日志
   - ❌ 不记录 token 和 secret

---

## 9. 参考文档

- [飞书开放平台](https://open.feishu.cn/document/home/introduction)
- [多维表格 API](https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-overview)
- [认证鉴权](https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal)

---

## 10. 问题排查

### 问题：获取不到记录

1. 检查 app_token 和 table_id 是否正确
2. 检查筛选条件中的字段名是否与表格一致
3. 检查应用是否有表格的读取权限

### 问题：更新失败

1. 检查 record_id 是否正确
2. 检查字段名是否与表格一致
3. 检查应用是否有表格的写入权限

### 问题：token 错误

1. 检查 app_id 和 app_secret 是否正确
2. 检查应用状态是否正常
3. 检查网络是否可以访问飞书 API

---

## 总结

本项目使用的飞书 API：

1. ✅ 每次调用前获取新 token
2. ✅ 使用 POST `/records/search` 查询记录
3. ✅ 使用 PATCH `/records/:record_id` 更新记录
4. ✅ 所有接口都符合官方规范
5. ✅ 完善的错误处理和日志记录
