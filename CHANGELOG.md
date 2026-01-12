# 更新日志

本文档记录项目的版本更新和重要变更。

## [1.0.1] - 2025-12-25

### 🔧 优化更新

#### 包管理器变更

- 从 npm 切换到 pnpm
- 更新所有文档中的安装命令
- 添加 pnpm 配置文件 (.npmrc)
- 更新 .gitignore 忽略 pnpm-lock.yaml

#### 飞书 API 调用修正

**1. 查询记录接口**

- 使用正确的 `/records/search` 端点和 POST 方法
- 使用 JSON body 而不是 URL 查询参数
- 使用标准的 filter 对象结构
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
    }
  }
  ```

**2. 更新记录接口**

- 使用官方推荐的 PATCH 方法（之前使用 PUT）
- 端点：`/apps/:app_token/tables/:table_id/records/:record_id`
- 请求体格式：
  ```json
  {
    "fields": {
      "当前状态": "待搭建"
    }
  }
  ```

#### 飞书 Token 管理简化

- 移除 token 缓存机制，每次调用飞书 API 时都重新获取 token
- 简化代码逻辑，提高可靠性
- 移除 FeishuTokenCache 类型定义

#### 选择器优化

- 根据巨量创意后台实际页面结构优化所有选择器
- 使用更精确的元素定位方式
- 改进上传状态检测逻辑

#### 选择器变更

- `uploadButton`: 改为 `button:has(span:text('上传视频'))`，精确定位包含文案的按钮
- 新增 `uploadPanel`: `.material-center-v2-oc-create-upload-select-wrapper`，定位上传面板
- 新增 `tableBody`: `.material-center-v2-tbody`，素材列表表格
- 新增 `operationItem`: `.material-center-v2-oc-promotion-operation-action-item`，操作项容器
- 新增 `cancelUploadText`: "取消上传"，用于判断上传状态
- 优化 `confirmButton`: 使用容器 + 文本匹配的方式

#### 上传逻辑改进

- 改进上传状态检测：通过检查"取消上传"文案判断是否完成
- 增加上传超时时间：从 5 分钟增加到 10 分钟
- 优化轮询间隔：更合理的等待时间
- 增加详细的日志输出

#### 文档更新

- 新增 `SELECTOR_GUIDE.md` - 选择器详细说明文档
- 更新 `CONFIGURATION.md` - 补充选择器详细说明
- 更新 `README.md` - 添加选择器指南链接

---

## [1.0.0] - 2025-12-25

### 🎉 首次发布

完整实现巨量素材自动上传系统的所有核心功能。

### ✨ 新功能

#### 核心功能

- 自动从飞书多维表格获取待上传任务
- 智能匹配本地素材目录（日期格式自动转换）
- 批量上传 MP4 文件到巨量创意后台
- 自动更新飞书表格状态（待上传 → 待搭建）
- 30 分钟定时轮询机制

#### 模块实现

- **配置模块**：完整的配置加载和验证
- **日志模块**：控制台和文件双输出，支持多级别日志
- **飞书模块**：API 集成，支持 token 自动刷新
- **文件模块**：目录扫描、日期转换、文件验证
- **巨量模块**：URL 构造和参数替换
- **上传器模块**：基于 Playwright 的自动化上传
- **队列模块**：FIFO 任务队列，防重复机制
- **调度器模块**：定时拉取和队列消费

#### 技术特性

- TypeScript 5.x 严格模式
- Playwright 自动化（非无头模式，便于调试）
- 登录状态持久化
- 优雅的错误处理和退出机制
- 完整的类型定义

### 📖 文档

- README.md - 项目介绍和基本使用
- QUICKSTART.md - 10 分钟快速部署指南
- CONFIGURATION.md - 详细配置说明
- TROUBLESHOOTING.md - 故障排查指南
- CHANGELOG.md - 更新日志

### 🔧 配置

- 支持可配置的页面选择器
- 支持可配置的批次大小和延迟
- 支持可配置的轮询间隔
- 支持自定义飞书字段映射

### 🛡️ 安全性

- 配置文件已加入 .gitignore
- 敏感信息不会被提交到版本控制

### 📦 依赖

- Node.js >= 18.0.0
- Playwright ^1.40.0
- Axios ^1.6.2
- TypeScript ^5.3.3
- UUID ^9.0.1

---

## 未来计划

### v1.1.0（计划中）

- [ ] 支持多账户并发上传
- [ ] 增加飞书机器人通知
- [ ] 实现断点续传功能
- [ ] 添加上传进度实时展示

### v1.2.0（计划中）

- [ ] Web 管理界面
- [ ] 上传统计和报表
- [ ] 支持更多视频格式
- [ ] 智能重试机制

### v2.0.0（计划中）

- [ ] 分布式部署支持
- [ ] Redis 任务队列
- [ ] Docker 容器化
- [ ] API 接口开放

---

## 版本说明

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范：

- 主版本号：不兼容的 API 修改
- 次版本号：向下兼容的功能性新增
- 修订号：向下兼容的问题修正

---

## 反馈

如有问题或建议，请通过以下方式反馈：

- 查看 [故障排查指南](TROUBLESHOOTING.md)
- 检查日志文件 `logs/upload.log`
- 提供详细的错误信息和重现步骤
