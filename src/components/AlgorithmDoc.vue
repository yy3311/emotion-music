<template>
  <div class="doc-mask" @click.self="$emit('close')">
    <div class="doc-modal">
      <div class="doc-header">
        <h2>📘 算法与实现说明</h2>
        <button class="ghost" @click="$emit('close')">✕ 关闭</button>
      </div>

      <div class="doc-body">
        <h3>一、系统架构</h3>
        <svg class="arch" viewBox="0 0 680 150">
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#8b5cf6" /><stop offset="1" stop-color="#22d3ee" />
            </linearGradient>
          </defs>
          <g font-size="12" fill="#e8ecf8" text-anchor="middle">
            <rect x="8" y="30" width="120" height="90" rx="10" fill="#1a2138" stroke="#2a3352" />
            <text x="68" y="55">① 人脸输入</text>
            <text x="68" y="75" fill="#97a1c2" font-size="11">摄像头/拍照</text>
            <text x="68" y="92" fill="#97a1c2" font-size="11">图片/视频/示例</text>
            <rect x="168" y="30" width="150" height="90" rx="10" fill="#1a2138" stroke="#8b5cf6" />
            <text x="243" y="55">② 本地情绪识别</text>
            <text x="243" y="75" fill="#97a1c2" font-size="11">TinyFaceDetector</text>
            <text x="243" y="92" fill="#97a1c2" font-size="11">FaceExpressionNet</text>
            <rect x="368" y="30" width="150" height="90" rx="10" fill="#1a2138" stroke="#8b5cf6" />
            <text x="443" y="55">③ 推荐引擎</text>
            <text x="443" y="75" fill="#97a1c2" font-size="11">VA 模型 + 策略</text>
            <text x="443" y="92" fill="#97a1c2" font-size="11">情绪旅程评分</text>
            <rect x="558" y="30" width="114" height="90" rx="10" fill="#1a2138" stroke="#22d3ee" />
            <text x="615" y="55">④ 歌曲播放</text>
            <text x="615" y="75" fill="#97a1c2" font-size="11">本地曲库</text>
            <text x="615" y="92" fill="#97a1c2" font-size="11">在线 API</text>
            <line x1="128" y1="75" x2="166" y2="75" stroke="url(#g1)" stroke-width="2" />
            <line x1="318" y1="75" x2="366" y2="75" stroke="url(#g1)" stroke-width="2" />
            <line x1="518" y1="75" x2="556" y2="75" stroke="url(#g1)" stroke-width="2" />
          </g>
        </svg>

        <h3>二、情绪识别算法（本地推理）</h3>
        <p><b>① 人脸检测 — TinyFaceDetector：</b>轻量级卷积神经网络检测器（受 Tiny-YOLO 多尺度检测思想启发），在 320×320 输入下单人脸场景速度/精度平衡最佳，输出人脸框与置信度（阈值 0.45）。</p>
        <p><b>② 情绪识别 — FaceExpressionNet：</b>7 类情绪卷积网络（在 FER2013 等表情数据集上训练），输入人脸区域裁剪图，经多层卷积 + 全连接输出 7 维 softmax 概率：neutral / happy / sad / angry / fearful / disgusted / surprised，取概率最大者为情绪标签。</p>
        <p><b>③ 时序平滑 — EMA + 迟滞切换：</b>对摄像头视频流，用指数滑动平均（α=0.35）平滑 7 维概率序列，并要求候选情绪领先当前情绪 8% 以上才切换标签，有效抑制闪烁与误跳。</p>
        <p><b>④ 本地化：</b>算法库（face-api.js / TensorFlow.js）与全部模型权重置于 <code>public/vendor</code> 与 <code>public/models</code>，推理在浏览器端由 WebGL 加速完成，全程离线、无数据外传。</p>

        <h3>三、歌曲推荐算法</h3>
        <p><b>① 情绪空间模型 — Russell 环状模型（V-A）：</b>用愉悦度 V 与唤醒度 A 两个维度定位情绪：</p>
        <table class="va-table">
          <tr><th>情绪</th><th>V</th><th>A</th><th>推荐策略</th><th>目标 V/A</th></tr>
          <tr v-for="row in vaRows" :key="row.emo"><td>{{ row.label }}</td><td>{{ row.v }}</td><td>{{ row.a }}</td><td>{{ row.strategy }}</td><td>{{ row.tv }} / {{ row.ta }}</td></tr>
        </table>
        <p><b>② 单曲综合评分：</b></p>
        <pre class="formula">score(song) = 0.45·(1 − VA距离) + 0.25·情绪标签匹配 + 0.15·唤醒度匹配 + 0.10·质量分 + 0.05·随机抖动</pre>
        <p><b>③ 情绪旅程（Emotion Journey）：</b>不为“悲伤”直接推欢歌（情绪跳跃过大易被跳过），而是生成 5 首歌曲的旅程：第 1 首锚定当前情绪作为「共鸣曲」，其后歌曲的 VA 沿当前情绪 → 目标情绪的插值路径逐首推进，依次为「过渡曲」，最后一首为「目标曲」。这是音乐治疗中“同质原则 → 异构原则”的工程化落地。</p>
        <p><b>④ 在线曲库：</b>按情绪映射搜索关键词（如 悲伤→“治愈 温柔 钢琴”），用关键词词典为在线歌曲启发式推断 VA 坐标与情绪标签，再进入同一套评分体系；播放地址经本地 NetEase API 服务解析。</p>

        <h3>四、在线音乐 API</h3>
        <p>项目自带基于 <b>NeteaseCloudMusicApi</b> 的 Express 服务（<code>server/api.cjs</code>，端口 3000）：<code>/api/online/search</code>、<code>/api/online/url</code>、<code>/api/online/detail</code>；<code>npm run dev</code> 会同时启动前端与该服务，Vite 将 <code>/api</code> 代理到本地服务（同源、无跨域）。服务未启动（如 GitHub Pages 静态部署）时自动改用 GD Studio 公共 HTTPS 接口（CORS 已开放），再不可用则回退本地曲库并提示。</p>

        <h3>五、技术栈</h3>
        <p>HTML5（getUserMedia / Canvas / File API / Video / Audio）· CSS3（Grid / 暗色玻璃质感主题）· JavaScript（ES6+）· Vue 3（组合式 API + 单文件组件）· Vite · face-api.js（TensorFlow.js）· Express + NeteaseCloudMusicApi。</p>

        <h3>六、版权归属</h3>
        <p>本地曲库全部曲目来自 <b>incompetech.com</b>（Kevin MacLeod，CC BY 4.0 免版权音乐），已按许可要求署名；示例人脸照片由 AI 生成，仅用于演示。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { EMOTION_VA, STRATEGIES } from '../core/recommend'
import { EMOTION_LABELS } from '../core/emotion'

defineEmits(['close'])

const vaRows = Object.keys(EMOTION_VA).map(emo => ({
  emo,
  label: EMOTION_LABELS[emo],
  v: EMOTION_VA[emo].v,
  a: EMOTION_VA[emo].a,
  strategy: STRATEGIES[emo].name,
  tv: STRATEGIES[emo].target.v,
  ta: STRATEGIES[emo].target.a
}))
</script>

<style scoped>
.doc-mask {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(4, 6, 12, .78);
  display: flex; align-items: center; justify-content: center;
  padding: 24px; backdrop-filter: blur(4px);
}
.doc-modal {
  width: min(860px, 96vw); max-height: 92vh; overflow-y: auto;
  background: var(--card); border: 1px solid var(--line); border-radius: 16px;
}
.doc-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 22px; border-bottom: 1px solid var(--line);
  position: sticky; top: 0; background: var(--card); z-index: 1;
}
.doc-header h2 { font-size: 18px; }
.doc-body { padding: 18px 24px 28px; }
.doc-body h3 { font-size: 15px; margin: 20px 0 8px; color: #c4b5fd; }
.doc-body p { font-size: 13.5px; color: #c9d1e8; line-height: 1.85; margin: 6px 0; }
.doc-body code { background: rgba(139, 92, 246, .18); padding: 1px 6px; border-radius: 5px; font-size: 12px; }
.arch { width: 100%; margin: 8px 0; }
.va-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12.5px; }
.va-table th, .va-table td { border: 1px solid var(--line); padding: 5px 8px; text-align: center; }
.va-table th { background: var(--card2); color: var(--muted); }
.formula {
  background: #0a0e1a; border: 1px solid var(--line); border-radius: 10px;
  padding: 12px 14px; font-size: 13px; color: #a5f3fc; margin: 8px 0; overflow-x: auto;
}
</style>
