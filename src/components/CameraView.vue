<template>
  <div class="camera-view">
    <div class="video-wrap">
      <video ref="video" playsinline muted class="mirror"></video>
      <canvas ref="overlay" class="overlay"></canvas>
      <div v-if="!active" class="mask">点击下方按钮开启摄像头</div>
      <div v-else-if="live" class="live-badge">● LIVE 实时识别中</div>
    </div>
    <div class="actions">
      <button v-if="!active" class="primary" @click="start">📷 开启摄像头</button>
      <template v-else>
        <button class="primary" @click="toggleLive()">{{ live ? '⏸ 暂停实时识别' : '▶ 开始实时识别' }}</button>
        <button @click="shoot">📸 拍照识别</button>
        <button class="ghost" @click="stop">关闭摄像头</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { detectEmotion, EMOTION_LABELS, EMOTION_COLORS } from '../core/emotion'

const emit = defineEmits(['emotion', 'status'])
const video = ref(null)
const overlay = ref(null)
const active = ref(false)
const live = ref(false)
let stream = null
let timer = null

async function start() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false
    })
    video.value.srcObject = stream
    await video.value.play()
    active.value = true
    emit('status', '摄像头已开启，可开始实时识别或拍照')
  } catch (e) {
    emit('status', '无法开启摄像头：' + (e.message || e))
  }
}

function stop() {
  toggleLive(false)
  if (stream) stream.getTracks().forEach(t => t.stop())
  stream = null
  active.value = false
  const c = overlay.value
  if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height)
  emit('status', '摄像头已关闭')
}

async function loop() {
  if (!live.value || !video.value) return
  const v = video.value
  if (v.readyState < 2) return
  try {
    const r = await detectEmotion(v)
    if (r) {
      drawBox(r.box, r.top)
      emit('emotion', { expressions: r.expressions, top: r.top, confidence: r.confidence, box: r.box, source: '摄像头 · 实时', live: true })
    }
  } catch (e) { /* 单帧失败忽略 */ }
}

function toggleLive(force) {
  const next = typeof force === 'boolean' ? force : !live.value
  live.value = next
  if (timer) { clearInterval(timer); timer = null }
  if (next) {
    timer = setInterval(loop, 300)
    emit('status', '实时识别已开启')
  }
}

async function shoot() {
  if (!video.value || !active.value) return
  const r = await detectEmotion(video.value)
  if (!r) { emit('status', '拍照未检测到人脸，请正对摄像头'); return }
  drawBox(r.box, r.top)
  emit('emotion', { expressions: r.expressions, top: r.top, confidence: r.confidence, box: r.box, source: '摄像头 · 拍照', live: false })
}

function drawBox(box, label) {
  const c = overlay.value
  const v = video.value
  if (!c || !v) return
  c.width = v.videoWidth
  c.height = v.videoHeight
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, c.width, c.height)
  const color = EMOTION_COLORS[label] || '#22d3ee'
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.strokeRect(box.x, box.y, box.width, box.height)
  ctx.fillStyle = color
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(EMOTION_LABELS[label] || label, box.x, Math.max(24, box.y - 10))
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (stream) stream.getTracks().forEach(t => t.stop())
})
</script>

<style scoped>
.video-wrap {
  position: relative;
  aspect-ratio: 4 / 3;
  background: #05070d;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--line);
}
.video-wrap video { width: 100%; height: 100%; object-fit: cover; }
.video-wrap video.mirror { transform: scaleX(-1); }
.overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
.mask {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--muted); font-size: 14px;
}
.live-badge {
  position: absolute; top: 10px; left: 10px;
  background: rgba(239, 91, 91, .85); color: #fff;
  padding: 3px 10px; border-radius: 999px; font-size: 12px;
}
.actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
</style>
