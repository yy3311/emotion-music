<template>
  <div class="image-input">
    <div
      class="drop-zone"
      :class="{ dragover }"
      @click="$refs.file.click()"
      @dragover.prevent="dragover = true"
      @dragleave="dragover = false"
      @drop.prevent="onDrop"
    >
      <input ref="file" type="file" accept="image/*" hidden @change="onFile" />
      <div v-if="!fileUrl" class="dz-text">
        <div class="dz-icon">🖼️</div>
        <div>点击选择或拖入人脸照片</div>
        <div class="dz-sub">支持 JPG / PNG / WebP</div>
      </div>
      <img v-else ref="img" :src="fileUrl" class="preview" alt="待识别照片" />
      <div v-if="result" class="box-overlay" :style="boxStyle">
        <span class="box-tag">{{ labelText }}</span>
      </div>
    </div>
    <div class="actions">
      <button class="primary" :disabled="!fileUrl || busy" @click="run">
        {{ busy ? '识别中…' : '🔍 开始识别' }}
      </button>
      <button v-if="fileUrl" class="ghost" @click="clear">清除</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { detectEmotion, EMOTION_LABELS } from '../core/emotion'

const emit = defineEmits(['emotion', 'status'])
const file = ref(null)
const img = ref(null)
const fileUrl = ref('')
const result = ref(null)
const busy = ref(false)
const dragover = ref(false)

function onFile(e) {
  const f = e.target.files?.[0]
  if (!f) return
  if (!f.type.startsWith('image/')) { emit('status', '请选择图片文件'); return }
  fileUrl.value = URL.createObjectURL(f)
  result.value = null
}
function onDrop(e) {
  dragover.value = false
  const f = e.dataTransfer.files?.[0]
  if (f && f.type.startsWith('image/')) {
    fileUrl.value = URL.createObjectURL(f)
    result.value = null
  } else {
    emit('status', '请拖入图片文件')
  }
}
function clear() { fileUrl.value = ''; result.value = null; if (file.value) file.value.value = '' }

async function run() {
  if (!img.value) { emit('status', '请先选择一张照片'); return }
  busy.value = true
  try {
    const r = await detectEmotion(img.value)
    if (!r) {
      result.value = null
      emit('status', '未检测到人脸，请换一张正脸清晰的照片')
      return
    }
    result.value = r
    emit('emotion', { expressions: r.expressions, top: r.top, confidence: r.confidence, box: r.box, source: '上传图片', live: false })
  } catch (e) {
    emit('status', '识别失败：' + (e.message || e))
  } finally {
    busy.value = false
  }
}

const labelText = computed(() => (result.value ? EMOTION_LABELS[result.value.top] : ''))

const boxStyle = computed(() => {
  const r = result.value
  const el = img.value
  if (!r || !el) return {}
  const nw = el.naturalWidth || 1
  const nh = el.naturalHeight || 1
  const b = r.box
  return {
    left: (b.x / nw * 100) + '%',
    top: (b.y / nh * 100) + '%',
    width: (b.width / nw * 100) + '%',
    height: (b.height / nh * 100) + '%'
  }
})
</script>

<style scoped>
.drop-zone {
  position: relative;
  border: 2px dashed var(--line);
  border-radius: 12px;
  min-height: 260px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: border-color .2s;
  background: rgba(10, 13, 24, .5);
}
.drop-zone:hover, .drop-zone.dragover { border-color: var(--accent); }
.dz-text { text-align: center; color: var(--muted); }
.dz-icon { font-size: 40px; margin-bottom: 8px; }
.dz-sub { font-size: 12px; margin-top: 6px; opacity: .7; }
.preview { width: 100%; display: block; }
.box-overlay {
  position: absolute;
  border: 3px solid var(--accent2);
  border-radius: 4px;
  pointer-events: none;
}
.box-tag {
  position: absolute; top: -26px; left: -3px;
  background: var(--accent2); color: #06222b;
  font-size: 12px; font-weight: 700;
  padding: 2px 8px; border-radius: 6px;
  white-space: nowrap;
}
.actions { display: flex; gap: 8px; margin-top: 12px; }
</style>
