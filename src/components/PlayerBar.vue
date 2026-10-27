<template>
  <div class="player-bar">
    <div class="p-left">
      <div class="cover">
        <img v-if="song && song.source === 'online' && song.cover" :src="song.cover" alt="" />
        <span v-else>🎵</span>
      </div>
      <div class="p-meta" v-if="song">
        <div class="p-title">{{ song.title }}</div>
        <div class="p-artist">
          {{ song.artist }}
          <span class="p-src" :class="library">{{ library === 'online' ? '☁️ 在线 · 网易云' : '💾 本地曲库' }}</span>
        </div>
      </div>
      <div class="p-meta" v-else>
        <div class="p-title muted">尚未播放歌曲</div>
        <div class="p-artist">识别情绪后将自动生成歌单</div>
      </div>
    </div>

    <div class="p-center">
      <div class="p-controls">
        <button class="ghost" @click="$emit('prev')">⏮</button>
        <button class="play-btn" @click="$emit('toggle')">{{ playing ? '⏸' : '▶' }}</button>
        <button class="ghost" @click="$emit('next')">⏭</button>
      </div>
      <div class="p-progress">
        <span class="p-time">{{ fmt(progress) }}</span>
        <input type="range" min="0" max="100" :value="pct" @input="seek" />
        <span class="p-time">{{ fmt(duration) }}</span>
      </div>
      <div v-if="errorMsg" class="p-error">{{ errorMsg }}</div>
    </div>

    <div class="p-right">
      <span class="p-index" v-if="total">{{ index + 1 }} / {{ total }}</span>
      <span class="p-index" v-else>0 / 0</span>
      <span class="vol-icon">🔊</span>
      <input type="range" class="vol" min="0" max="100" v-model.number="vol" @input="setVol" />
    </div>

    <audio ref="audio" @timeupdate="onTime" @loadedmetadata="onTime" @ended="$emit('ended')"></audio>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  song: { type: Object, default: null },
  playing: { type: Boolean, default: false },
  library: { type: String, default: 'local' },
  index: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
})
defineEmits(['toggle', 'next', 'prev', 'ended'])

const audio = ref(null)
const progress = ref(0)
const duration = ref(0)
const vol = ref(80)
const errorMsg = ref('')

defineExpose({
  playSong(s) {
    const a = audio.value
    if (!a || !s || !s.url) return
    errorMsg.value = ''
    a.src = s.url
    a.volume = vol.value / 100
    a.play().catch(e => { errorMsg.value = '播放失败：' + (e.message || e) })
  }
})

// 播放/暂停状态联动
watch(() => props.playing, (v) => {
  const a = audio.value
  if (!a || !a.src) return
  if (v) a.play().catch(() => {})
  else a.pause()
})

function onTime() {
  const a = audio.value
  if (!a) return
  progress.value = a.currentTime || 0
  duration.value = Number.isFinite(a.duration) ? a.duration : 0
}
const pct = computed(() => (duration.value ? (progress.value / duration.value) * 100 : 0))
function seek(e) {
  const a = audio.value
  if (a && duration.value) a.currentTime = (e.target.value / 100) * duration.value
}
function setVol() {
  if (audio.value) audio.value.volume = vol.value / 100
}
function fmt(t) {
  if (!t || !Number.isFinite(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<style scoped>
.player-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
  display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; gap: 16px;
  padding: 10px 26px;
  background: rgba(13, 17, 30, .92);
  border-top: 1px solid var(--line);
  backdrop-filter: blur(10px);
}
.p-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.cover {
  width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0;
  background: linear-gradient(135deg, #3b2f6e, #1c2238);
  display: flex; align-items: center; justify-content: center; font-size: 20px; overflow: hidden;
}
.cover img { width: 100%; height: 100%; object-fit: cover; }
.p-meta { min-width: 0; }
.p-title { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.p-title.muted { color: var(--muted); font-weight: 500; }
.p-artist { font-size: 12px; color: var(--muted); margin-top: 2px; }
.p-src { margin-left: 6px; font-size: 11px; }
.p-center { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.p-controls { display: flex; align-items: center; gap: 12px; }
.play-btn {
  width: 42px; height: 42px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), #6d28d9);
  border: none; font-size: 16px;
}
.p-progress { display: flex; align-items: center; gap: 10px; width: 100%; max-width: 460px; }
.p-time { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
input[type='range'] {
  -webkit-appearance: none; appearance: none; flex: 1; height: 4px;
  background: #2a3352; border-radius: 999px; outline: none; cursor: pointer;
}
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--accent2); border: none;
}
.p-error { font-size: 12px; color: var(--red); }
.p-right { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.p-index { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.vol { max-width: 90px; }
.vol-icon { font-size: 13px; }
@media (max-width: 760px) {
  .player-bar { grid-template-columns: 1fr; gap: 6px; padding: 8px 14px; }
  .p-right { display: none; }
}
</style>
