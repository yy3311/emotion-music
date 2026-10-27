<template>
  <div class="panel emotion-panel">
    <div class="panel-title">🧠 情绪识别结果 <span class="tag">本地 CNN 推理</span></div>
    <div v-if="!detection" class="empty">
      <div class="empty-icon">🎭</div>
      <p>等待人脸输入…</p>
      <p class="empty-sub">可通过摄像头 / 上传图片 / 视频文件 / 示例照片获取人脸</p>
    </div>
    <template v-else>
      <div class="emotion-head">
        <div class="emoji" :style="{ background: color + '22', borderColor: color }">{{ emoji }}</div>
        <div class="emotion-meta">
          <div class="emotion-name" :style="{ color }">{{ label }}</div>
          <div class="conf-row">
            <span class="conf-num">{{ Math.round(confidence * 100) }}%</span>
            <span class="conf-label">置信度</span>
          </div>
          <div class="source-chip">来源：{{ detection.source }}</div>
        </div>
      </div>
      <div class="dist">
        <div v-for="d in dist" :key="d.key" class="dist-row">
          <span class="dist-name">{{ d.label }}</span>
          <div class="dist-bar">
            <div class="dist-fill" :style="{ width: (d.value * 100) + '%', background: d.color }"></div>
          </div>
          <span class="dist-val">{{ (d.value * 100).toFixed(1) }}%</span>
        </div>
      </div>
      <div v-if="strategy" class="strategy-card">
        <div class="strategy-name">推荐策略 · {{ strategy.name }}</div>
        <div class="strategy-desc">{{ strategy.desc }}</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { EMOTION_LABELS, EMOTION_EMOJIS, EMOTION_COLORS, EMOTIONS } from '../core/emotion'

const props = defineProps({ detection: { type: Object, default: null }, strategy: { type: Object, default: null } })

const label = computed(() => EMOTION_LABELS[props.detection?.top] || '')
const emoji = computed(() => EMOTION_EMOJIS[props.detection?.top] || '🎭')
const color = computed(() => EMOTION_COLORS[props.detection?.top] || '#8b5cf6')
const confidence = computed(() => props.detection?.confidence || 0)

const dist = computed(() => {
  if (!props.detection) return []
  const ex = props.detection.expressions || {}
  return EMOTIONS
    .map(k => ({ key: k, label: EMOTION_LABELS[k], value: ex[k] || 0, color: EMOTION_COLORS[k] }))
    .sort((a, b) => b.value - a.value)
})
</script>

<style scoped>
.emotion-panel { min-height: 300px; }
.empty { text-align: center; padding: 40px 0; color: var(--muted); }
.empty-icon { font-size: 44px; margin-bottom: 10px; }
.empty-sub { font-size: 12px; margin-top: 6px; opacity: .75; }
.emotion-head { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; }
.emoji {
  width: 72px; height: 72px; border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
  font-size: 38px; border: 2px solid;
}
.emotion-name { font-size: 26px; font-weight: 800; }
.conf-row { display: flex; align-items: baseline; gap: 6px; margin-top: 2px; }
.conf-num { font-size: 18px; font-weight: 700; color: var(--accent2); }
.conf-label { font-size: 12px; color: var(--muted); }
.source-chip { margin-top: 6px; font-size: 12px; color: var(--muted); }
.dist { display: flex; flex-direction: column; gap: 7px; }
.dist-row { display: grid; grid-template-columns: 44px 1fr 52px; align-items: center; gap: 8px; font-size: 13px; }
.dist-name { color: var(--muted); }
.dist-bar { height: 8px; background: rgba(255,255,255,.06); border-radius: 999px; overflow: hidden; }
.dist-fill { height: 100%; border-radius: 999px; transition: width .35s ease; }
.dist-val { text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
.strategy-card {
  margin-top: 14px; padding: 12px 14px;
  background: linear-gradient(135deg, rgba(139,92,246,.14), rgba(34,211,238,.08));
  border: 1px solid rgba(139,92,246,.35); border-radius: 12px;
}
.strategy-name { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
.strategy-desc { font-size: 13px; color: var(--muted); line-height: 1.7; }
</style>
