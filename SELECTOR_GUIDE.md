# 页面选择器详细说明

本文档详细说明巨量创意后台上传页面的元素选择器，以及如何根据页面变化进行调整。

## 页面结构概览

```
巨量创意后台页面
├── 上传按钮区域
│   └── button > span:text("上传视频")  ← 点击打开上传面板
│
├── 侧边上传面板（点击后出现）
│   ├── .material-center-v2-oc-create-upload-select-wrapper  ← 文件选择区域
│   │   └── input[type="file"]  ← 实际的文件输入框
│   │
│   └── .material-center-v2-oc-create-material-submit-bar-btn-group  ← 底部按钮组
│       └── button:has-text("确定")  ← 确定按钮
│
└── 素材列表区域
    └── .material-center-v2-tbody  ← 表格主体
        └── .material-center-v2-oc-promotion-operation-action-item  ← 操作项
            └── 包含"取消上传"文案时表示正在上传
```

## 详细选择器说明

### 1. 上传按钮 (uploadButton)

**选择器：** `button:has(span:text('上传视频'))`

**HTML 结构：**
```html
<button class="...">
  <span>上传视频</span>
</button>
```

**说明：**
- 查找包含文案"上传视频"的 span 标签
- span 的外层是一个 button 标签
- 点击这个 button 会打开侧边上传面板

**如果失效：**
1. 检查按钮文案是否变化（如"上传素材"、"添加视频"等）
2. 检查 HTML 结构是否变化
3. 可以使用类名或其他属性定位

---

### 2. 上传面板 (uploadPanel)

**选择器：** `.material-center-v2-oc-create-upload-select-wrapper`

**说明：**
- 上传面板中用于触发文件选择的区域
- 这是一个可点击的区域，点击后会打开系统文件选择框
- 通常包含"点击上传"或拖拽上传的提示文案

**如果失效：**
1. 使用浏览器开发者工具检查实际的类名
2. 可能的替代选择器：
   - 查找包含"点击上传"文案的元素
   - 查找上传面板的容器元素

---

### 3. 文件输入框 (fileInput)

**选择器：** `input[type='file']`

**说明：**
- HTML 原生的文件选择输入框
- 通常是隐藏的，但可以通过 Playwright 直接操作
- 用于实际设置要上传的文件

**如果失效：**
- 这个选择器通常不会失效
- 如果页面有多个文件输入框，可能需要更精确的定位

---

### 4. 表格主体 (tableBody)

**选择器：** `.material-center-v2-tbody`

**说明：**
- 素材列表的表格主体
- 包含所有已上传和正在上传的素材项
- 用于监控上传状态

**如果失效：**
1. 检查表格容器的类名
2. 可以通过 `table > tbody` 等方式定位

---

### 5. 操作项 (operationItem)

**选择器：** `.material-center-v2-oc-promotion-operation-action-item`

**说明：**
- 每个素材项的操作区域
- 包含"取消上传"、"删除"、"编辑"等操作按钮
- 用于判断素材的上传状态

**查找方式：**
```typescript
// 在表格主体下查找所有操作项（后代查找）
const tableBody = page.locator('.material-center-v2-tbody').first();
const operationItems = tableBody.locator('.material-center-v2-oc-promotion-operation-action-item');
```

**如果失效：**
1. 检查操作项的实际类名
2. 可以通过包含特定按钮文案的元素定位

---

### 6. 取消上传文案 (cancelUploadText)

**值：** `"取消上传"`

**说明：**
- 这是一个文本值，不是选择器
- 用于判断素材是否还在上传中
- 如果操作项中包含此文案，说明该素材正在上传

**检查逻辑：**
```typescript
const text = await operationItem.textContent();
if (text && text.includes('取消上传')) {
  // 素材正在上传中
}
```

**如果失效：**
- 检查实际的按钮文案（可能是"中止上传"、"停止"等）

---

### 7. 确定按钮容器 (confirmButtonContainer)

**选择器：** `.material-center-v2-oc-create-material-submit-bar-btn-group`

**说明：**
- 上传面板底部的按钮组容器
- 包含"取消"、"确定"等按钮

---

### 8. 确定按钮 (confirmButton)

**选择器：** `.material-center-v2-oc-create-material-submit-bar-btn-group button:has-text('确定')`

**HTML 结构：**
```html
<div class="material-center-v2-oc-create-material-submit-bar-btn-group">
  <button>取消</button>
  <button>确定</button>  ← 目标按钮
</div>
```

**说明：**
- 在按钮组容器下查找包含"确定"文案的 button
- 后代查找，不是直接子元素
- 点击后完成当前批次，关闭上传面板

**如果失效：**
1. 检查按钮文案（可能是"完成"、"提交"等）
2. 检查容器类名是否变化

---

## 上传状态判断逻辑

### 完整流程

```typescript
// 1. 点击上传按钮
await page.locator('button:has(span:text("上传视频"))').click();

// 2. 等待上传面板出现
await page.locator('.material-center-v2-oc-create-upload-select-wrapper').waitFor();

// 3. 选择文件
await page.locator('input[type="file"]').setInputFiles(files);

// 4. 轮询检查上传状态
const tableBody = page.locator('.material-center-v2-tbody');
const operationItems = tableBody.locator('.material-center-v2-oc-promotion-operation-action-item');

let allUploaded = false;
while (!allUploaded) {
  const count = await operationItems.count();
  let hasUploading = false;
  
  for (let i = 0; i < count; i++) {
    const text = await operationItems.nth(i).textContent();
    if (text?.includes('取消上传')) {
      hasUploading = true;
      break;
    }
  }
  
  if (!hasUploading && count >= files.length) {
    allUploaded = true;
  }
  
  await page.waitForTimeout(3000);
}

// 5. 点击确定按钮
await page.locator('.material-center-v2-oc-create-material-submit-bar-btn-group button:has-text("确定")').click();
```

### 判断标准

**上传中：** 操作项中包含"取消上传"文案  
**上传完成：** 操作项中不包含"取消上传"文案  
**全部完成：** 所有操作项都不包含"取消上传"，且数量 >= 上传文件数

---

## 如何调试选择器

### 1. 使用浏览器开发者工具

```javascript
// 在浏览器控制台测试选择器
document.querySelector('.material-center-v2-tbody')
document.querySelectorAll('.material-center-v2-oc-promotion-operation-action-item')
```

### 2. 使用 Playwright Inspector

```bash
# 启动 Playwright Inspector
pnpm exec playwright codegen https://ad.oceanengine.com/material_center/management/video
```

### 3. 在代码中添加调试日志

```typescript
// 打印元素数量
const count = await locator.count();
console.log('元素数量:', count);

// 打印元素文本
const text = await locator.textContent();
console.log('元素文本:', text);

// 截图
await page.screenshot({ path: 'debug.png' });
```

---

## 页面更新应对

### 当页面结构变化时

1. **确认变化的元素**
   - 打开巨量创意后台
   - 按 F12 打开开发者工具
   - 使用元素选择器查看实际结构

2. **更新选择器**
   - 编辑 `config.json`
   - 修改对应的选择器
   - 重启程序测试

3. **测试验证**
   - 使用少量文件测试
   - 观察上传过程
   - 检查日志输出

### 常见变化场景

| 变化类型 | 可能影响的选择器 | 解决方案 |
|---------|----------------|---------|
| 按钮文案变化 | uploadButton, confirmButton | 更新文本匹配内容 |
| 类名变化 | 大部分选择器 | 使用开发者工具获取新类名 |
| HTML 结构变化 | 所有选择器 | 重新分析页面结构 |
| 新增功能模块 | 可能需要新选择器 | 添加新的选择器配置 |

---

## 最佳实践

1. **优先使用稳定的选择器**
   - 类名可能会变化
   - 文本匹配相对稳定
   - ID 选择器最稳定但不常见

2. **后代查找 vs 子元素查找**
   - 使用后代查找（空格）：`.parent .child`
   - 不使用直接子元素（>）：`.parent > .child`
   - 更灵活，适应性更强

3. **添加等待和重试**
   - 使用 `waitFor()` 等待元素出现
   - 添加适当的延迟
   - 处理超时情况

4. **详细的日志记录**
   - 记录每个步骤
   - 记录元素查找情况
   - 便于问题排查

---

## 技术支持

如果选择器失效无法解决：

1. 查看完整日志文件 `logs/upload.log`
2. 截图页面的实际状态
3. 使用开发者工具检查元素
4. 提供错误信息和页面截图

