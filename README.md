# 🎵 心频 EmotionTune — 基于人脸情绪识别的歌曲推荐系统

> Vue 3 + Vite + HTML5 + CSS3 + JavaScript · 本地 CNN 情绪识别 · VA 环状模型推荐算法 · 本地曲库 + 在线音乐 API

## 一、项目简介

本系统通过**摄像头 / 拍照 / 上传图片 / 播放视频 / 示例照片**五种方式获取人脸，由**浏览器本地神经网络**识别 7 类情绪（中性、开心、悲伤、愤怒、恐惧、厌恶、惊讶），再基于 **Russell 情绪环状模型（V-A）**与**情绪旅程推荐算法**生成专属歌单，支持**本地免版权曲库**与**在线曲库（网易云 API）**双音源播放。

## 二、快速开始

```bash
# 1. 安装依赖（Node.js ≥ 18）
npm install

# 2. 启动（一条命令同时启动前端 + 在线音乐 API 服务）
npm run dev
```

- 前端地址：http://localhost:5173 （Vite 将 `/api` 代理到本地 API 服务，无跨域问题）
- API 服务：http://127.0.0.1:3000 （基于 NeteaseCloudMusicApi）

> 仅需前端时：`npm run dev:web`（在线曲库会自动降级到公共 API 实例）。
> 生产构建：`npm run build`，产物在 `dist/`，可用 `npm run preview` 预览。
> GitHub Pages 构建：`npm run build:gh`（自动把 base 设为 `/<仓库名>/` 并开启静态托管模式，详见第八节）。

**演示建议**：打开页面后停留在「示例照片」页签，内置 7 张 AI 生成的写实情绪人脸，点击任意一张即可完整体验「识别 → 策略 → 歌单 → 播放」全流程；摄像头页签可体验实时识别（浏览器需允许摄像头权限，且页面需在 localhost 或 HTTPS 下打开）。

## 三、目录结构

```
emotion-music/
├── index.html                  # 入口（加载本地 face-api.min.js）
├── package.json / vite.config.js
├── public/
│   ├── vendor/face-api.min.js  # 情绪识别算法库（本地）
│   ├── models/                 # 模型权重（本地，共 ~520KB）
│   │   ├── tiny_face_detector_model-*          # 人脸检测
│   │   └── face_expression_model-*             # 7 类情绪识别
│   ├── songs/                  # 本地曲库（12 首免版权 MP3 + songs.json 元数据）
│   └── samples/                # 7 张 AI 生成写实情绪人脸 + manifest.json
├── server/api.cjs              # 在线音乐 API 服务（Express + NeteaseCloudMusicApi）
└── src/
    ├── App.vue                 # 主应用（状态编排）
    ├── core/
    │   ├── emotion.js          # 情绪识别服务（检测 + EMA 时序平滑）
    │   ├── recommend.js        # VA 模型 + 策略 + 情绪旅程评分算法
    │   └── music.js            # 本地曲库 / 在线搜索 / 播放地址解析 / 启发式 VA
    └── components/             # CameraView / ImageInput / VideoInput / SampleGallery
                                # EmotionPanel / RecommendPanel / PlayerBar / AlgorithmDoc
```

## 四、算法说明

### 4.1 情绪识别算法（全部本地推理）

1. **人脸检测 — TinyFaceDetector**：轻量 CNN 检测器，320×320 输入，输出人脸框与置信度（阈值 0.45）；
2. **情绪识别 — FaceExpressionNet**：7 类情绪卷积网络（FER2013 等数据集训练），输出 7 维 softmax 概率，取最大者为情绪标签；
3. **时序平滑 — EMA(α=0.35) + 迟滞切换（8% 裕量）**：抑制摄像头实时识别时的标签抖动；
4. 模型与算法库完全本地化，WebGL 加速，**离线可用、无数据外传**。

### 4.2 歌曲推荐算法

1. **情绪空间 — Russell 环状模型（愉悦度 V / 唤醒度 A）**：7 类情绪映射为 VA 坐标；
2. **推荐策略**：每种情绪有独立策略与目标 VA（悲伤→渐进提振、愤怒→平复疏导、恐惧→安全安抚、厌恶→清新切换、惊讶→顺势探索、开心→共鸣增效、中性→探索发现）；
3. **单曲评分**：`0.45·(1−VA距离) + 0.25·情绪标签匹配 + 0.15·唤醒度匹配 + 0.10·质量分 + 0.05·随机抖动`；
4. **情绪旅程**：生成 5 首歌曲——第 1 首「共鸣曲」锚定当前情绪，其后沿 VA 插值路径逐首推进至「目标曲」，实现“先共鸣、后引导”的音乐治疗式推荐；
5. **在线曲库**：按情绪映射搜索关键词（如 悲伤→“治愈钢琴”），用关键词词典为在线歌曲启发式推断 VA 坐标与情绪标签，再进入同一套评分体系；播放地址经本地 NetEase API 服务解析。

> 页面右上角「📘 算法说明」内置完整图文说明（含架构图与评分公式），可直接用于课程/竞赛答辩演示。

## 五、在线音乐 API

| 端点 | 说明 |
| --- | --- |
| `GET /api/online/search?keywords=xx&limit=15` | 搜索歌曲（名称/歌手/封面） |
| `GET /api/online/url?id=123&br=320000` | 解析播放地址 |
| `GET /api/online/detail?ids=1,2,3` | 歌曲详情 |

- 前端在线曲库采用**三级链路**：① 本地 NetEase API 服务（Vite 代理，同源）→ ② **GD Studio 公共音乐 API**（`https://music-api.gdstudio.xyz`，HTTPS + CORS，**纯静态部署也能直连**）→ ③ 旧公共实例（仅 http，HTTPS 页面下自动跳过）。三者均不可用时回退本地曲库并提示。
- 换音源：推荐面板顶部「💾 本地曲库 / ☁️ 在线曲库 · 网易云」。

## 六、本地曲库与版权

`public/songs/` 内 12 首曲目全部来自 **incompetech.com**（Kevin MacLeod，**CC BY 4.0** 免版权音乐），按许可要求在此署名；元数据（VA 坐标、情绪标签、质量分）见 `public/songs/songs.json`。`public/samples/` 内人脸照片由 AI 生成，仅用于演示。

## 七、常见问题

- **摄像头无法开启**：需 localhost 或 HTTPS 环境，并在浏览器弹窗中允许摄像头权限；
- **在线曲库不可用**：确认 `npm run dev` 中 API 服务已启动（终端会打印 `在线音乐 API 服务已启动`），或点击「换一批」重试；
- **某首在线歌曲无法播放**：网易云部分歌曲无对外播放地址（版权/下架），换一首即可；
- **识别不到人脸**：使用正脸、光线充足、人脸占画面 1/3 以上的照片效果最佳。

## 八、部署到 GitHub Pages

线上地址：**https://yy3311.github.io/emotion-music/**

仓库采用「源码 / 产物 双分支」结构：

| 分支 | 内容 | 说明 |
| --- | --- | --- |
| `main` | 源码 | Vite + Vue3 工程源码，供查看与二次开发 |
| `gh-pages` | 构建产物 | `dist/` 的构建结果，GitHub Pages 直接托管此分支 |

重新部署（本地一条命令）：

```bash
npm run build:gh                      # base 自动取 git remote 仓库名，产物写入 dist/
git add -f dist && git commit -m "build" 
# 或用 npx gh-pages -d dist -b gh-pages 直接推送产物
```

**静态托管的差异与适配**：

1. Pages 只托管静态文件，**没有 Node 后端**，`server/api.cjs` 不参与部署；在线曲库自动改走 GD Studio 公共 HTTPS 接口，功能不缺失（已实测可搜索、可播放）；
2. 资源路径全部改为 `import.meta.env.BASE_URL` 拼接，`build:gh` 把 base 设为 `/<仓库名>/`，避免子路径下 404；
3. 摄像头 `getUserMedia` 在 Pages 的 HTTPS 环境下可直接使用（比本地 http 环境更友好）；
4. 情绪识别模型（~520KB）与示例照片、本地歌曲均为静态文件，随站点一起托管，**离线推理无需任何服务器**。
