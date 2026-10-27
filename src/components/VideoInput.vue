<template>
  <div class="video-input">
    <div class="video-wrap">
      <video ref="video" playsinline controls></video>
      <div v-if="!fileUrl" class="mask">选择本地视频文件（如录制的表情视频）</div>
      <div v-else-if="lastTop" class="live-badge" :style="{ background: color }">
        当前帧：{{ lastLabel }}（{{ lastConf }}%）
      </div>
    </div>
    <input ref="file" type="file" accept="video/*" hidden @change="onFile" />
    <div class="actions">
      <button class="primary" @click="$refs.file.click()">🎬 选择视频</button>
      <button :disabled="!fileUrl || busy" @click="capture">📸 识别当前帧</button>
      <label class="auto-toggle" v-if="fileUrl">
        <input type="checkbox" v-model="auto" :disabled="busy" />
        自动识别（播放时每 0.8s）
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { detectEmotion, EMOTION_LABELS, EMOTION_COLORS } from '../core/emotion'

const emit = defineEmits(['emotion', 'status'])
const video = ref(null)
const file = ref(null)
const fileUrl = ref('')
const busy = ref(false)
const auto = ref(false)
const lastTop = ref('')
const lastLabel = ref('')
const lastConf = ref(0)
const color = ref('#8b5cf6')
let timer = null

function onFile(e) {
  const f = e.target.files?.[0]
  if (!f) return
  if (!f.type.startsWith('video/')) { emit('status', '请选择视频文件'); return }
  fileUrl.value = URL.createObjectURL(f)
  emit('status', '视频已加载，可识别当前帧或开启自动识别')
}

async function detectOnce() {
  const v = video.value
  if (!v || v.readyState < 2) return
  const r = await detectEmotion(v)
  if (!r) { emit('status', '当前帧未检测到人脸'); return }
  lastTop.value = r.top
  lastLabel.value = EMOTION_LABELS[r.top]
  lastConf.value = Math.round(r.confidence * 100)
  color.value = EMOTION_COLORS[r.top] || '#8b5cf6'
  emit('emotion', { expressions: r.expressions, top: r.top, confidence: r.confidence, box: r.box, source: '视频文件', live: false })
}

async function capture() {
  busy.value = true
  try { await detectOnce() } catch (e) { emit('status', '识别失败：' + (e.message || e)) }
  finally { busy.value = false }
}

watch(auto, (v) => {
  if (timer) { clearInterval(timer); timer = null }
  if (v) {
    timer = setInterval(() => { detectOnce().catch(() => {}) }, 800)
    emit('status', '自动识别已开启')
  }
})

onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.video-wrap {
  position: relative;
  background: #05070d;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--line);
  min-height: 240px;
  display: flex; align-items: center; justify-content: center;
}
.video-wrap video { width: 100%; max-height: 420px; display: block; }
.mask { position: absolute; color: var(--muted); font-size: 14px; }
.live-badge {
  position: absolute; top: 10px; left: 10px;
  color: #fff; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 600;
}
.actions { display: flex; gap: 10px; margin-top: 12px; align-items: center; flex-wrap: wrap; }
.auto-toggle { font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 6px; cursor: pointer; }
</style>
