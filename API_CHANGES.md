# API 变更说明

## v1.0.1 飞书 API 调用修正

### 变更 1: 记录查询接口修正

#### 之前的实现（错误）

```typescript
// 使用 GET 方法和 URL 参数
const url = `/apps/${app_token}/tables/${table_id}/records`;
const filterParam = `CurrentValue.[${field}]="待上传"`;
const queryString = new URLSearchParams({
  filter: filterParam,
  page_size: 100,
}).toString();

const response = await request("get", `${url}?${queryString}`);
```

#### 现在的实现（正确）

```typescript
// 使用 POST 方法和 JSON body
const url = `/apps/${app_token}/tables/${table_id}/records/search`;

const requestBody = {
  field_names: ["剧名", "日期", "账户", "当前状态"],
  page_size: 100,
  filter: {
    conjunction: "and",
    conditions: [
      {
        field_name: "当前状态",
        operator: "is",
        value: ["待上传"],
      },
    ],
  },
};

const response = await request("post", url, requestBody);
```

#### 关键变更

1. **接口端点**：`/records` → `/records/search`
2. **请求方法**：`GET` → `POST`
3. **参数位置**：URL 查询参数 → JSON 请求体
4. **筛选格式**：简单字符串 → 结构化 filter 对象
5. **字段指定**：添加 `field_names` 数组，明确返回哪些字段

#### 为什么要修改

- 飞书多维表格 API 的 `/records/search` 接口是官方推荐的查询方式
- 支持更复杂的筛选条件
- 支持指定返回的字段，减少数据传输
- 更符合 RESTful API 设计规范

---

## v1.0.1 更新记录接口修正

### 变更 2: 更新记录方法修正

#### 之前的实现（不推荐）

```typescript
// 使用 PUT 方法
const url = `/apps/${app_token}/tables/${table_id}/records/${recordId}`;

await request("put", url, {
  fields: {
    当前状态: "待搭建",
  },
});
```

#### 现在的实现（官方推荐）

```typescript
// 使用 PATCH 方法
const url = `/apps/${app_token}/tables/${table_id}/records/${recordId}`;

await request("patch", url, {
  fields: {
    当前状态: "待搭建",
  },
});
```

#### 关键变更

1. **请求方法**：`PUT` → `PATCH`
2. **请求体格式**：保持不变，仍然使用 `fields` 对象

#### 为什么要修改

- **符合 RESTful 规范**：PATCH 用于部分更新，PUT 用于完整替换
- **官方推荐**：飞书多维表格 API 文档推荐使用 PATCH 方法
- **更安全**：PATCH 只更新指定字段，不会影响其他字段
- **更明确的语义**：清楚表达"部分更新"的意图

#### API 规范对比

| 方法  | 语义     | 用途           | 飞书推荐  |
| ----- | -------- | -------------- | --------- |
| PUT   | 完整替换 | 替换整个资源   | ❌ 不推荐 |
| PATCH | 部分更新 | 只更新指定字段 | ✅ 推荐   |

#### 完整的更新流程

```typescript
// 1. 获取 token
const token = await getTenantAccessToken();

// 2. 构造请求
const url = `/apps/${app_token}/tables/${table_id}/records/${recordId}`;
const data = {
  fields: {
    当前状态: "待搭建",
  },
};

// 3. 发送 PATCH 请求
const response = await axios.patch(url, data, {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});

// 4. 检查响应
if (response.data.code === 0) {
  console.log("更新成功");
}
```

---

## v1.0.1 飞书 Token 管理变更

### 变更内容

简化了飞书 token 的获取和管理逻辑。

### 之前的实现

```typescript
// 使用缓存机制
private tokenCache: FeishuTokenCache | null = null;

private async getTenantAccessToken(forceRefresh: boolean = false): Promise<string> {
  // 检查缓存
  if (!forceRefresh && this.tokenCache && Date.now() < this.tokenCache.expireAt) {
    return this.tokenCache.token;
  }

  // 获取并缓存 token
  const { tenant_access_token, expire } = response.data.data;
  this.tokenCache = {
    token: tenant_access_token,
    expireAt: Date.now() + (expire - 300) * 1000
  };

  return tenant_access_token;
}
```

### 现在的实现

```typescript
// 不使用缓存，每次都获取
private async getTenantAccessToken(): Promise<string> {
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      app_id: this.config.app_id,
      app_secret: this.config.app_secret
    }
  );

  const { tenant_access_token } = response.data.data;
  return tenant_access_token;
}
```

### 变更原因

1. **简化逻辑**：移除了缓存管理的复杂性
2. **更可靠**：避免了缓存过期导致的问题
3. **易维护**：代码更简洁，更容易理解和维护

### 性能影响

- **优点**：逻辑简单，不会出现 token 过期问题
- **缺点**：每次 API 调用都需要额外的一次 token 获取请求

**评估：**

- 飞书 token 获取接口响应很快（通常 < 100ms）
- 本系统调用频率不高（30 分钟轮询一次）
- 性能损失可以忽略不计
- 可靠性提升的收益远大于性能损失

### API 调用频率

**之前（使用缓存）：**

- 每 2 小时获取一次 token
- 其他时间使用缓存的 token

**现在（不使用缓存）：**

- 获取待上传记录：1 次 token 请求
- 更新每条记录状态：1 次 token 请求
- 假设有 N 条记录要处理：1 + N 次 token 请求

**示例计算：**

- 假设每次有 5 条待上传记录
- 每 30 分钟执行一次
- 总计：(1 + 5) = 6 次 token 请求 / 30 分钟
- 平均：0.2 次 token 请求 / 分钟

这个频率完全可以接受，不会对飞书 API 造成压力。

### 飞书 API 限流

根据飞书开放平台文档：

- tenant_access_token 接口限流：50 次/分钟/应用
- 我们的调用频率：< 1 次/分钟
- 安全余量：非常充足

### 迁移说明

此变更对外部接口没有影响，无需修改调用代码。

### 删除的类型

```typescript
// 已删除
export interface FeishuTokenCache {
  token: string;
  expireAt: number;
}
```

如果您的代码中有使用此类型，请移除相关引用。

### 总结

这是一个内部实现的优化，遵循"简单优于复杂"的原则。在我们的使用场景下，性能影响微乎其微，但代码可靠性和可维护性得到了显著提升。
