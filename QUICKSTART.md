# 快速开始指南

本指南帮助您快速部署和运行巨量素材自动上传系统。

## 前置要求

- ✅ Windows 操作系统
- ✅ Node.js 18.0 或更高版本
- ✅ 巨量创意后台账号（已登录状态）
- ✅ 飞书多维表格访问权限

## 10 分钟快速部署

### 步骤 1：安装 Node.js（如未安装）

访问 [Node.js 官网](https://nodejs.org/)下载并安装 LTS 版本。

验证安装：
```bash
node --version
# 应显示 v18.0.0 或更高
```

### 步骤 2：下载项目

```bash
# 如果使用 Git
git clone <repository_url>
cd juliang-upload

# 或直接解压下载的项目文件夹
cd juliang-upload
```

### 步骤 3：安装依赖

```bash
pnpm install
```

这一步会安装所有必要的依赖包，包括 Playwright 浏览器。

### 步骤 4：配置飞书

#### 4.1 获取飞书应用凭证

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 进入"开发者后台" → "应用管理"
3. 找到您的应用，复制：
   - App ID
   - App Secret

#### 4.2 获取多维表格信息

1. 打开您的飞书多维表格
2. 从 URL 中提取信息：
   ```
   https://xxx.feishu.cn/base/{app_token}?table={table_id}&view=xxx
   ```
   - `app_token`: 在 `base/` 后面的字符串
   - `table_id`: 在 `table=` 后面的字符串

#### 4.3 编辑配置文件

打开 `config.json`，填写飞书配置：

```json
{
  "feishu": {
    "app_id": "你的 App ID",
    "app_secret": "你的 App Secret",
    "app_token": "你的 App Token",
    "table_id": "你的 Table ID"
  }
}
```

### 步骤 5：配置本地路径

编辑 `config.json`，设置素材根目录：

```json
{
  "local": {
    "rootDir": "D:\\短剧剪辑"
  }
}
```

**注意：** Windows 路径使用双反斜杠 `\\` 或单正斜杠 `/`。

### 步骤 6：准备飞书表格

确保您的飞书多维表格包含以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 当前状态 | 单选 | 包含"待上传"和"待搭建"选项 |
| 账户 | 文本 | 巨量账户 ID |
| 剧名 | 文本 | 剧目名称 |
| 日期 | 日期 | 格式：YYYY-MM-DD |

**示例记录：**
| 剧名 | 日期 | 账户 | 当前状态 |
|------|------|------|----------|
| 她醒了 | 2025-12-24 | 1852188842738771 | 待上传 |

### 步骤 7：准备本地素材

确保本地目录结构正确：

```
D:\短剧剪辑\
└── 12.24 导出\           ← 日期格式：MM.DD 导出
    └── 她醒了\           ← 剧名必须与飞书表格完全一致
        ├── 1.mp4
        ├── 2.mp4
        └── ...
```

### 步骤 8：首次运行

```bash
pnpm run dev
```

程序启动后：
1. 会自动打开浏览器
2. 导航到巨量创意后台
3. **手动登录巨量账号**（仅首次需要）
4. 登录后，程序会自动开始工作

### 步骤 9：观察并调整

观察浏览器中的操作过程，如果出现错误：

#### 常见问题 1：找不到上传按钮

**错误信息：**
```
waiting for locator('button:has-text('上传视频')') to be visible
```

**解决方法：**
1. 按 F12 打开浏览器开发者工具
2. 使用元素选择器（左上角箭头图标）
3. 点击页面上的"上传"按钮
4. 查看元素的 HTML 结构
5. 更新 `config.json` 中的选择器

**示例：**

如果按钮的 HTML 是：
```html
<button class="upload-btn">上传视频</button>
```

那么选择器可以是：
```json
{
  "uploader": {
    "selectors": {
      "uploadButton": ".upload-btn"
    }
  }
}
```

#### 常见问题 2：找不到本地目录

**错误信息：**
```
日期目录不存在: D:\短剧剪辑\12.24 导出
```

**检查：**
1. 路径是否正确
2. 目录名格式是否为 `MM.DD 导出`
3. 是否有写错字或多余空格

### 步骤 10：持续运行

确认一切正常后，可以让程序持续运行：

```bash
# 构建生产版本
pnpm run build

# 运行
pnpm start
```

程序会每 30 分钟自动从飞书拉取新任务并处理。

## 验证清单

在正式使用前，请确认：

- ✅ 飞书配置正确，能够获取到待上传记录
- ✅ 本地目录结构正确，能够找到素材文件
- ✅ 浏览器能够成功打开巨量后台
- ✅ 登录状态已保存
- ✅ 能够成功上传至少一个测试任务
- ✅ 上传完成后飞书状态能够更新为"待搭建"

## 日常使用

### 启动程序

```bash
pnpm start
```

### 查看日志

```bash
# Windows PowerShell
Get-Content logs\upload.log -Tail 50

# 或使用文本编辑器打开
notepad logs\upload.log
```

### 停止程序

按 `Ctrl + C`，程序会优雅退出。

### 重启程序

```bash
# 停止（Ctrl + C）
# 然后重新启动
pnpm start
```

## 生产环境建议

### 使用 PM2 管理进程

```bash
# 安装 PM2
pnpm add -g pm2

# 启动程序
pm2 start dist/index.js --name juliang-upload

# 查看状态
pm2 status

# 查看日志
pm2 logs juliang-upload

# 停止
pm2 stop juliang-upload

# 重启
pm2 restart juliang-upload

# 开机自启
pm2 startup
pm2 save
```

### 定期维护

1. **清理日志**（每月）
   ```bash
   # 备份日志
   copy logs\upload.log logs\upload.log.backup
   
   # 清空日志
   echo. > logs\upload.log
   ```

2. **检查磁盘空间**
   确保有足够空间存储素材和日志

3. **更新依赖**（每季度）
   ```bash
   pnpm update
   ```

## 获取帮助

- 📖 [详细配置说明](CONFIGURATION.md)
- 🔧 [故障排查指南](TROUBLESHOOTING.md)
- 📝 查看日志文件：`logs/upload.log`

## 下一步

- 了解所有配置选项：[CONFIGURATION.md](CONFIGURATION.md)
- 解决常见问题：[TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- 优化性能和调整参数

祝使用顺利！🎉

