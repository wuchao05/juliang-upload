🚀《巨量素材自动上传系统》需求文档 v1.0（正式版）

1️⃣ 系统目标

在 Windows 环境下运行的常驻程序，实现：
• 定时从飞书表格获取「待上传」任务；
• 根据日期和剧名匹配本地素材目录；
• 通过浏览器自动化上传 mp4 素材到巨量创意后台；
• 每部剧全部素材上传完成后，将飞书状态改为「待搭建」；
• 周期性自动执行，全自动闭环。

⸻

2️⃣ 系统环境

项 要求
操作系统 Windows（长期运行）
网络 可访问飞书开放平台 & 巨量后台
巨量账号 固定唯一账号，浏览器中已长期保持登录态
浏览器 Playwright 驱动的 Chromium（推荐非无头模式，便于调试和观察）

⸻

3️⃣ 技术栈与模块划分（重要）

3.1 技术栈选型
• 语言 & 运行时
• Node.js（建议 18+）
• TypeScript（建议 5.x）
• 浏览器自动化
• Playwright（Node 版本）
• HTTP / API
• 内置 fetch 或 axios（按团队习惯二选一）
• 调度 / 定时任务
• 简单场景可用 setInterval
• 或使用 node-cron 做更可控的 cron 表达式调度
• 日志
• 可先使用 console + 自己封装简单文件输出
• 后续如有需要可引入 winston / pino

3.2 模块划分建议

项目结构示意（给 Cursor 用）：

/src
/config # 加载与校验配置
/feishu # 飞书 Bitable API 封装
/file # 本地目录与文件操作
/douyin # 巨量上传相关封装（URL 构造等）
/uploader # Playwright 上传执行逻辑
/queue # 任务队列与状态管理
/scheduler # 30 分钟轮询飞书、投递任务
/types # TS 公共类型定义（Task、Config、Record 等）
index.ts # 程序入口
playwright.config.ts
config.json # 外部配置

核心模块职责：
• config：读取 config.json，做基础校验（必填项检查，如 app_id、rootDir 等）。
• feishu：
• 拉取 状态 = 待上传 的记录；
• 回写记录状态为「待搭建」。
• file：
• 将 YYYY-MM-DD 转为 MM.DD 导出；
• 拼出 根目录 / {MM.DD}导出 / {剧名}；
• 搜索 .mp4 文件列表。
• douyin：
• 根据账户 ID 构造上传 URL：
• baseUploadUrl.replace('{accountId}', actualAccountId)
• uploader（基于 Playwright）：
• 负责打开 URL、点击上传、批量设置文件、等待成功、分批执行。
• queue：
• 管理任务列表：pending → running → completed / skipped；
• 防止重复任务入队。
• scheduler：
• 每 30 分钟从飞书拉新任务，转成内部 Task 对象，推入队列；
• 队列消费器持续从队列中取任务按顺序执行。

⸻

4️⃣ 配置文件结构

{
"feishu": {
"app_id": "",
"app_secret": "",
"app_token": "",
"table_id": "",
"base_url": "https://open.feishu.cn/open-apis/bitable/v1"
},
"local": {
"rootDir": "D:/素材根目录"
},
"douyin": {
"baseUploadUrl": "https://ad.oceanengine.com/material_center/management/video?aadvid={accountId}#source=ad_navigator",
"defaultAccountId": "1852188842738771"
},
"scheduler": {
"fetchIntervalMinutes": 30
}
}

⸻

5️⃣ 飞书表字段约定

字段 示例 用途
剧名 她醒了 精准匹配本地剧目录名
日期 2025-12-24 转换成本地导出目录名
状态 待上传 / 待搭建 控制任务执行
记录 ID 系统字段 更新状态时使用

程序只处理：状态 = 待上传 的记录

⸻

6️⃣ 本地目录结构与日期映射

6.1 目录结构

{rootDir}/
├─ 12.24 导出/
│ ├─ 她醒了/
│ │ ├─ 1.mp4
│ │ ├─ 2.mp4
│ │ └─ ...

6.2 日期映射规则
• 飞书日期格式：YYYY-MM-DD，例如：2025-12-24
• 本地目录格式：MM.DD 导出，例如：12.24 导出

转换逻辑示例：

2025-12-24 -> "12.24 导出"

剧目录：

{rootDir}/{MM.DD}导出/{剧名}/

    •	剧名要求精准匹配
    •	剧目录下的 所有 .mp4 文件 都需要上传

⸻

7️⃣ 巨量上传页面与规则
• 上传页面模板 URL：

https://ad.oceanengine.com/material_center/management/video?aadvid={accountId}#source=ad_navigator

    •	当前阶段：
    •	使用 defaultAccountId 替换 {accountId}
    •	后续如需按剧目/字段切换账号，可扩展

上传规则：
• 每批最多上传 10 个 mp4
• 分批上传直到该剧目录下所有 mp4 上传完毕
• 每批上传完之后：
• 等待页面显示上传成功状态（通过元素或文案判断）
• 点击“确定 / 完成”按钮进入下一批

⸻

8️⃣ 轮询 + 任务队列机制

8.1 轮询规则
• 间隔：fetchIntervalMinutes = 30
• 每次执行： 1. 调用飞书 API 查询状态 = 待上传 的记录； 2. 将每条记录转为内部 Task：
• 包含：记录 ID、剧名、日期、构造好的本地路径信息（可延迟构造）； 3. 如果 Task 不在当前队列中，则追加到队列尾部（FIFO）。

8.2 任务队列状态

内部任务状态（程序内管理，不一定写回飞书）：

状态 描述
pending 等待执行
running 正在执行上传
completed 所有素材上传成功，飞书状态已改为「待搭建」
skipped 素材缺失 / 页面异常，本次跳过，飞书状态保持不变

队列执行策略：
• 单 worker 串行消费队列（一次只处理一个任务）
• 新的轮询只负责「入队」，不负责消费

⸻

9️⃣ 单任务详细执行流程

以一条飞书记录为例：
剧名=她醒了，日期=2025-12-24，状态=待上传

步骤流 1. 解析日期目录
• 将 2025-12-24 转为 12.24 导出
• 拼接为：{rootDir}/12.24 导出/ 2. 检查日期目录存在
• 如果不存在：标记任务为 skipped，本轮结束 3. 检查剧目录存在
• 路径：{rootDir}/12.24 导出/她醒了/
• 如果不存在：标记任务为 skipped，本轮结束 4. 扫描 mp4 文件
• 读取剧目录下所有 .mp4 文件，按文件名排序
• 如果 mp4 列表为空：标记任务为 skipped，本轮结束 5. 构造上传 URL 并打开
• 将 baseUploadUrl 中 {accountId} 替换为配置中的 defaultAccountId
• 使用 Playwright 在已登录的 Chromium 中 page.goto(url) 6. 批次上传逻辑
• 将文件数组按 10 个一组切片
• 对每一批：
• 定位「上传视频」按钮 → 点击
• 定位文件选择输入 / upload 区域，调用 setInputFiles 选择该批文件
• 轮询页面每条素材的上传状态，全部显示“删除”时，说明都上传好了
• 点击「确定 / 完成」按钮
• 批次间随机 sleep 2–5 秒 7. 上传完成后的飞书状态更新
• 若所有 mp4 批次均成功上传：
• 调用飞书 API，将该记录的状态更新为：待搭建
• 将任务状态置为 completed

⸻

🔟 错误与异常策略（简化版）
• 不做复杂重试机制：
• 某一步失败（目录缺失、页面结构变更、接口异常等），该任务本轮标记为 skipped
• 飞书状态不改，下一轮 30 分钟轮询时仍会被拉到，便于人工排查
• 不做验证码破解：
• 如果遇到登录失效/验证码/异常弹窗，可以：
• 记录错误日志；
• 保持任务为 pending 或 skipped；
• 由人工重新打开浏览器登录，之后程序可继续运行。

⸻

1️⃣1️⃣ 日志要求（最小版）
• 在控制台输出：
• 哪条记录（剧名 + 日期）开始处理；
• 本地路径是否存在；
• 上传批次数量；
• 是否成功更新飞书状态。
• 同时写入本地文件（如 logs/upload.log）

⸻

1️⃣2️⃣ 示例用例

飞书记录：

剧名 日期 状态
她醒了 2025-12-24 待上传

本地目录：

D:/素材根目录/12.24 导出/她醒了/1.mp4
D:/素材根目录/12.24 导出/她醒了/2.mp4
...

执行结果：
• 所有 mp4 成功上传至：
• https://ad.oceanengine.com/material_center/management/video?aadvid=1852188842738771#source=ad_navigator
• 飞书记录状态：待上传 → 待搭建
• 任务状态：completed

⸻
