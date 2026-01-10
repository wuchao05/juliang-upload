# 巨量素材自动上传系统

自动化上传系统，实现从飞书表格获取任务、匹配本地素材、自动上传到巨量创意后台并更新状态的完整闭环。

## 功能特性

- 🔄 自动从飞书多维表格拉取待上传任务
- 📁 智能匹配本地素材目录
- 🚀 批量上传 MP4 文件到巨量创意后台
- ✅ 自动更新飞书表格状态
- 📝 完整的日志记录
- ⏰ 30 分钟定时轮询

## 环境要求

- Node.js >= 18.0.0
- Windows 操作系统
- 已登录的巨量创意后台账号

## 安装

```bash
# 安装依赖
pnpm install

# 安装 Playwright 浏览器
pnpm exec playwright install chromium
```

**提示：** 首次安装需要下载 Chromium 浏览器，可能需要几分钟时间。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置系统

编辑 `config.json` 文件，填写必要的配置信息。详细配置说明请参考 [CONFIGURATION.md](CONFIGURATION.md)。

**必须配置的项目：**

- 飞书 app_id、app_secret、app_token、table_id
- 本地素材根目录路径
- 上传页面选择器（首次运行后根据实际页面调整）

### 3. 首次运行

```bash
# 开发模式（推荐首次使用）
npm run dev

# 或生产模式
npm run build
npm start
```

### 4. 手动登录

程序首次运行时会打开浏览器，需要手动登录巨量创意后台。登录状态会被保存，后续运行无需重复登录。

### 5. 调整选择器

观察浏览器中的上传过程，如果出现元素找不到的错误，需要调整 `config.json` 中的选择器配置。详细说明请参考 [CONFIGURATION.md](CONFIGURATION.md#4-上传器配置-uploader)。

## 配置

配置文件为 `config.json`，包含以下几个部分：

### 飞书配置

```json
{
  "feishu": {
    "app_id": "your_app_id",
    "app_secret": "your_app_secret",
    "app_token": "your_app_token",
    "table_id": "your_table_id",
    "fields": {
      "status": "当前状态",
      "account": "账户",
      "drama": "剧名",
      "date": "日期"
    }
  }
}
```

### 本地路径配置

```json
{
  "local": {
    "rootDir": "D:\\短剧剪辑"
  }
}
```

### 上传器配置

```json
{
  "uploader": {
    "batchSize": 10,
    "selectors": {
      "uploadButton": "button:has(span:text('上传视频'))",
      "uploadPanel": ".material-center-v2-oc-create-upload-select-wrapper",
      "tableBody": ".material-center-v2-tbody",
      "operationItem": ".material-center-v2-oc-promotion-operation-action-item",
      "confirmButton": ".material-center-v2-oc-create-material-submit-bar-btn-group button:has-text('确定')"
    }
  }
}
```

**⚠️ 重要：** 选择器已针对巨量创意后台优化。详细说明请查看：

- [CONFIGURATION.md](CONFIGURATION.md) - 配置说明
- [SELECTOR_GUIDE.md](SELECTOR_GUIDE.md) - 选择器详细指南

## 使用方法

### 开发模式

```bash
pnpm run dev
```

### 生产模式

```bash
pnpm run build
pnpm start
```

## 目录结构

```
本地素材目录/
├── 12.24 导出/
│   ├── 她醒了/
│   │   ├── 1.mp4
│   │   ├── 2.mp4
│   │   └── ...
│   └── 其他剧名/
└── 其他日期导出/
```

## 飞书表格字段

| 字段名   | 说明                           | 示例             |
| -------- | ------------------------------ | ---------------- |
| 剧名     | 剧目名称，需与本地目录精准匹配 | 她醒了           |
| 日期     | 上传日期，格式 YYYY-MM-DD      | 2025-12-24       |
| 账户     | 巨量账户 ID                    | 1852188842738771 |
| 当前状态 | 任务状态                       | 待上传/待资产化  |

## 工作流程

1. 每 30 分钟从飞书拉取「待上传」状态的记录
2. 根据日期和剧名匹配本地目录
3. 将 MP4 文件分批上传（每批 10 个）
4. 上传完成后更新飞书状态为「待资产化」

## 日志

日志文件位置：`logs/upload.log`

日志包含：

- 任务开始/结束时间
- 本地路径检查结果
- 上传批次信息
- 成功/失败状态

## 错误处理

- **目录不存在**：任务标记为 skipped，保持飞书状态不变
- **文件列表为空**：任务标记为 skipped
- **页面元素未找到**：任务标记为 skipped，保留浏览器供人工检查
- **登录失效**：任务保持 pending，等待人工重新登录

## 注意事项

1. **首次运行**：需要手动登录巨量创意后台，浏览器状态会被保存
2. **选择器配置**：需要根据实际页面调整 `config.json` 中的选择器
3. **Windows 路径**：配置中使用双反斜杠 `\\` 或正斜杠 `/`
4. **浏览器模式**：默认非无头模式，便于观察和调试

## 文档

- [详细配置说明](CONFIGURATION.md) - 完整的配置文档
- [故障排查指南](TROUBLESHOOTING.md) - 常见问题解决方案

## 常见问题

### 找不到本地目录？

检查 `rootDir` 配置和日期格式转换（YYYY-MM-DD → MM.DD 导出）。详见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md#本地文件问题)。

### 页面元素找不到？

需要调整选择器配置。详见 [CONFIGURATION.md](CONFIGURATION.md#如何调整选择器)。

### 登录状态丢失？

首次运行需手动登录，状态会保存。详见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md#问题登录状态丢失)。

### 更多问题？

查看完整的 [故障排查指南](TROUBLESHOOTING.md)。

## 许可证

MIT
