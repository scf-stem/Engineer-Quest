# C 线：工位、首单素材与沉浸式探索 V0.3

2026-11-11 · 基于 `eb0f63f` · `work/ui` · 供总控接入与风格评审

交付的是可运行 React 组件及五张原创素材：研发工位、客户阅读角、元件托盘、林工独立立绘、暮色研发室。标准工位、邮箱、工作台、个人收入榜、素材画廊和沉浸式探索均能预览；所有身份、进度、邮件、收入和草稿为明确标注的合成演示。最新《开发计划》及用户后续指示优先：个人参与、Arduino Uno 家族、简写 C++、个人收入、直接产图、增强探索与角色代入感。

- [接入与 props](integration.md)
- [沉浸感审查与具体改进](immersion-review.md) · [探索工位接入协议](adventure-integration.md)
- [视觉规范与 token](style-guide.md)
- [资产清单](../../public/art/manifest.json)
- [桌面截图](preview-desktop.png) · [手机截图](preview-mobile.png) · [邮件截图](preview-mail.png) · [工作台截图](preview-workbench.png)
- [首单素材画廊截图](preview-art.png) · [尺寸、透明通道与文件摘要记录](art-validation.json)
- [探索工位](preview-adventure-desktop.png) · [人物对话](preview-adventure-dialogue.png) · [道具查看](preview-adventure-kit.png) · [手机探索](preview-adventure-mobile.png)

在项目根目录使用已有依赖：

```sh
npm ci --ignore-scripts --offline
npx vite --config src/ui/preview.vite.config.js --host 127.0.0.1 --port 4175 --strictPort
```

打开 `http://127.0.0.1:4175/src/ui/preview.html`。仅启动本机服务，没有部署或上传。离线安装需要本机 npm 缓存；也可按项目现行依赖安装流程准备环境。

完整素材画廊：`http://127.0.0.1:4175/src/ui/art-preview.html`。客户邮件已接入阅读角，工位工具箱已接入元件托盘，NPC 默认使用独立透明立绘。生成图不承载引脚、中文、测试或交互。

沉浸式独立入口：`http://127.0.0.1:4175/src/ui/adventure-preview.html`。空间热点与同名键盘入口、当前目标、静态短对话、道具与手册查看、工具直达及有限动效。按 D / E 协调采用纯导航 `onAction(actionId)` 和受控 `goal/actionStates`，不重建总控已有业务模块。

## 本轮验证

已执行：

1. `npm run build`：通过。现有原型 Blockly 主包仍有大于 500 kB 的构建提示；C 线未改公共分包配置。
2. `npx vite build --config src/ui/preview.vite.config.js --outDir /tmp/eq-ui-adventure-build`：通过，工位、画廊、探索三个入口编译成功。共享 JS 约 236 kB / gzip 74 kB，探索入口约 13 kB / gzip 5 kB，CSS 约 45 kB / gzip 10 kB。
3. `npm test`：现有 10 项测试通过。它们不证明新增 UI 的业务验收，也不修复旧引擎按学生阈值推导预期的缺口。
4. `node src/ui/verify.mjs`：使用本机已有无头 Chromium 跑通。当前机器缓存版本与 Playwright 默认版本不同，因此指定了 `PLAYWRIGHT_EXECUTABLE_PATH`，没有安装新浏览器或新增依赖。

浏览器验证覆盖：1440px 桌面与 390px 手机；四个导航页无整页横向溢出；邮件选择、解释和本次演示草稿；切页保留草稿；SVG 端子点选；连线构图显隐；工作台方向键/End；手册弹窗 Escape 关闭与焦点返回；真机阶段明确未实现；合成收入展示；移动求助入口；零页面运行错误或失败资源请求；叠加旧 `src/style.css` 后布局仍保持隔离。截图来自实际页面，保存脚本可重跑。

V0.2 追加：四张素材全部解码成功；三张新图尺寸与登记值一致；画廊桌面/手机无整页横向溢出。元件托盘与人物 PNG 原图中的透明像素真实存在，转 WebP 后 alpha 通道逐像素完全一致。三张新增 WebP 合计 744,394 字节（约 727 KiB），保持原尺寸；只做格式压缩，未用脚本改变画面内容。

V0.3 追加：`verify-adventure.mjs` 通过热点与等价键盘列表、静态对话、串联弹窗焦点恢复、元件/手册查看、受控目标不变、禁用动作原因、工具/求助不产生业务副作用、390px 手机布局、手动及系统减少动效、叠加旧全局样式的桌面宽度。新场景 1672×941、275,918 字节。旧 UI / 五张素材画廊复验通过；旧客户测试等待页改为中性图标，不再用勾号暗示成功。

复跑（先保持预览服务运行）：

```sh
PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chrome-headless-shell node src/ui/verify.mjs
PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chrome-headless-shell node src/ui/verify-adventure.mjs
```

若本机 Playwright 默认浏览器已安装，可省略路径变量。自定义地址可设 `EQ_UI_PREVIEW_URL` / `EQ_ADVENTURE_PREVIEW_URL`。两脚本共更新九张设计截图；未运行实际接线、语言执行、客户测试、在线 AI、真机或真实学生测试。

## 本轮边界

`src/main.jsx`、`src/style.css`、公共配置与 package 文件均未修改；没有新增依赖。按用户补充直接调用内置图片生成工具制作素材，无需以具体模型名称确认为前置条件；工具未回传型号，清单如实记录。没有调用 CLI/API 付费路径。本轮只增加一张探索场景，没有扩展成全商城资产、战斗或 3D。

SVG 主板是有可读标签的外观构图，具体 Uno 型号、器件参数、端子布局和连线规则未冻结。示意不导出 `DeviceProfile` 或 `WiringDocument`；正式接线要由 B 线组件替换。积木、简写 C++ 和客户测试留出可替换内容位置，当前不产生运行结果。保存草稿只存在内存，刷新会清空；没有真实账号、通关、奖励、求助队列、编译、烧录或教师签核。

图像工具自动把五张原始 PNG 留在工作区 `generated_images/`，未纳入提交；项目实际消费的 JPG/WebP 在 `public/art/`。压缩使用本机已有 `cwebp`，未新增 npm 依赖。没有修改其他专项目录，也没有推送或部署。
