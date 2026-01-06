# 配置说明文档

本文档详细说明如何配置巨量素材自动上传系统。

## 配置文件位置

配置文件位于项目根目录：`config.json`

## 配置结构

### 1. 飞书配置 (feishu)

```json
{
  "feishu": {
    "app_id": "cli_a870f7611b7b1013",
    "app_secret": "NTwHbZG8rpOQyMEnXGPV6cNQ84KEqE8z",
    "app_token": "WdWvbGUXXaokk8sAS94c00IZnsf",
    "table_id": "tblJcLhLpEkmFkga",
    "base_url": "https://open.feishu.cn/open-apis/bitable/v1",
    "fields": {
      "status": "当前状态",
      "account": "账户",
      "drama": "剧名",
      "date": "日期"
    }
  }
}
```

**说明：**

- `app_id`: 飞书应用的 App ID
- `app_secret`: 飞书应用的 App Secret
- `app_token`: 多维表格的 App Token（从表格 URL 中获取）
- `table_id`: 具体表格的 Table ID（从表格 URL 中获取）
- `base_url`: 飞书 Bitable API 基础 URL（通常不需要修改）
- `fields`: 飞书表格中的字段名映射
  - `status`: 状态字段名（必须为"当前状态"）
  - `account`: 账户字段名（必须为"账户"）
  - `drama`: 剧名字段名（必须为"剧名"）
  - `date`: 日期字段名（必须为"日期"）

**如何获取 app_token 和 table_id：**

飞书多维表格 URL 格式：

```
https://xxx.feishu.cn/base/{app_token}?table={table_id}&view=xxx
```

### 2. 本地配置 (local)

```json
{
  "local": {
    "rootDir": "D:\\短剧剪辑"
  }
}
```

**说明：**

- `rootDir`: 本地素材根目录的绝对路径
- Windows 路径使用双反斜杠 `\\` 或单正斜杠 `/`

**目录结构示例：**

```
D:\短剧剪辑\
├── 12.24 导出\
│   ├── 她醒了\
│   │   ├── 1.mp4
│   │   ├── 2.mp4
│   │   └── ...
│   └── 其他剧名\
└── 其他日期导出\
```

### 3. 巨量配置 (douyin)

```json
{
  "douyin": {
    "baseUploadUrl": "https://ad.oceanengine.com/material_center/management/video?aadvid={accountId}#source=ad_navigator"
  }
}
```

**说明：**

- `baseUploadUrl`: 巨量上传页面 URL 模板
- `{accountId}` 会被替换为飞书表格中的账户字段值
- 通常不需要修改此 URL

### 4. 上传器配置 (uploader)

```json
{
  "uploader": {
    "batchSize": 10,
    "batchDelayMin": 2000,
    "batchDelayMax": 5000,
    "selectors": {
      "uploadButton": "button:has(span:text('上传视频'))",
      "uploadPanel": ".material-center-v2-oc-create-upload-select-wrapper",
      "fileInput": "input[type='file']",
      "tableBody": ".material-center-v2-tbody",
      "operationItem": ".material-center-v2-oc-promotion-operation-action-item",
      "cancelUploadText": "取消上传",
      "confirmButtonContainer": ".material-center-v2-oc-create-material-submit-bar-btn-group",
      "confirmButton": ".material-center-v2-oc-create-material-submit-bar-btn-group button:has-text('确定')"
    }
  }
}
```

**说明：**

- `batchSize`: 每批上传的文件数量（默认 10）
- `batchDelayMin`: 批次间最小延迟（毫秒）
- `batchDelayMax`: 批次间最大延迟（毫秒）
- `selectors`: 页面元素选择器（已针对巨量创意后台优化）

**选择器详解：**

| 选择器                   | 说明                                        |
| ------------------------ | ------------------------------------------- |
| `uploadButton`           | 包含"上传视频"文案的 button（打开上传面板） |
| `uploadPanel`            | 上传面板的文件选择区域                      |
| `fileInput`              | 文件输入框                                  |
| `tableBody`              | 素材列表表格主体                            |
| `operationItem`          | 操作项容器（用于检查上传状态）              |
| `cancelUploadText`       | "取消上传"文案（判断是否还在上传）          |
| `confirmButtonContainer` | 确定按钮容器                                |
| `confirmButton`          | 确定按钮（完成当前批次）                    |

**上传流程：**

1. 点击"上传视频"按钮，打开侧边上传面板
2. 在上传面板中选择文件
3. 文件自动开始上传
4. 轮询检查操作项，当所有项都不包含"取消上传"时表示上传完成
5. 点击"确定"按钮完成

**⚠️ 重要：** 所有选择器使用后代查找方式。详细说明请参考 [SELECTOR_GUIDE.md](SELECTOR_GUIDE.md)。

### 5. 调度器配置 (scheduler)

```json
{
  "scheduler": {
    "fetchIntervalMinutes": 30
  }
}
```

**说明：**

- `fetchIntervalMinutes`: 从飞书拉取任务的间隔时间（分钟）
- 建议值：30-60 分钟

### 6. Playwright 配置 (playwright)

```json
{
  "playwright": {
    "headless": false,
    "slowMo": 500,
    "userDataDir": "./playwright-state"
  }
}
```

**说明：**

- `headless`: 是否使用无头模式（建议 false，便于调试）
- `slowMo`: 操作延迟（毫秒），便于观察
- `userDataDir`: 浏览器用户数据目录（保存登录状态）

## 首次配置步骤

1. **复制配置文件**

   ```bash
   cp config.json config.json.backup
   ```

2. **填写飞书配置**

   - 登录飞书开放平台获取 app_id 和 app_secret
   - 从飞书表格 URL 中提取 app_token 和 table_id

3. **设置本地路径**

   - 确认素材根目录路径
   - 检查目录结构是否符合要求

4. **首次运行**

   ```bash
   npm install
   npm run dev
   ```

5. **调整选择器**

   - 观察浏览器中的上传页面
   - 使用开发者工具检查元素
   - 根据实际页面调整 `config.json` 中的选择器

6. **测试上传**
   - 在飞书表格中创建一条测试记录
   - 观察程序是否能正确上传
   - 检查日志文件 `logs/upload.log`

## 常见配置问题

### Q: 提示"配置验证失败"

A: 检查所有必填字段是否已填写，特别是飞书配置

### Q: 无法找到本地目录

A: 检查 `rootDir` 路径是否正确，Windows 路径使用 `\\` 或 `/`

### Q: 页面元素未找到

A: 使用开发者工具重新定位元素，更新选择器配置

### Q: 登录状态丢失

A: 浏览器会保存在 `playwright-state` 目录，首次运行需手动登录

## 安全建议

1. **不要将 config.json 提交到 Git**

   - 已在 `.gitignore` 中排除

2. **妥善保管飞书凭证**

   - app_secret 不要泄露给他人

3. **定期检查日志**
   - 日志文件位于 `logs/upload.log`
   - 建议定期备份和清理

## 性能优化

1. **调整批次大小**

   - 网络较快时可增大 `batchSize`
   - 网络不稳定时减小 `batchSize`

2. **调整轮询间隔**

   - 任务较多时可缩短 `fetchIntervalMinutes`
   - 任务较少时可延长以减少 API 调用

3. **调整延迟时间**
   - `batchDelayMin/Max` 影响上传速度
   - 太短可能触发频率限制
   - 太长会降低效率
