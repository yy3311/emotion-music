<template>
  <header class="app-header">
    <div class="logo">🎵 心频 EmotionTune</div>
    <div class="subtitle">人脸情绪识别 · 智能歌曲推荐系统</div>
    <div class="header-right">
      <span class="model-status" :class="{ ok: modelsReady }">{{ modelMsg }}</span>
      <button @click="showAlgo = true">📘 算法说明</button>
    </div>
  </header>

  <main class="layout">
    <!-- 左列：人脸输入 -->
    <section>
      <div class="panel">
        <div class="tabs">
          <button
            v-for="t in tabs"
            :key="t.key"
            :class="{ active: tab === t.key }"
            @click="tab = t.key"
          >{{ t.icon }} {{ t.label }}</button>
        </div>

        <CameraView v-if="tab === 'camera'" @emotion="onEmotion" @status="onStatus" />
        <ImageInput v-else-if="tab === 'upload'" @emotion="onEmotion" @status="onStatus" />
        <VideoInput v-else-if="tab === 'video'" @emotion="onEmotion" @status="onStatus" />
        <SampleGallery v-else :samples="samples" :active-file="activeSample" @pick="onSamplePick" />

        <div class="tips">
          💡 提示：情绪识别完全在浏览器本地运行；实时摄像头模式下每 300ms 推理一帧并做时序平滑，结果更稳定。
        </div>
      </div>
    </section>

    <!-- 右列：识别结果 + 推荐 -->
    <section>
      <EmotionPanel :detection="detection" :strategy="strategyInfo?.strategy || null" />
      <RecommendPanel
        :rec="strategyInfo"
        :library="library"
        :local-count="localSongs.length"
        :online-loading="onlineLoading"
        :online-error="onlineError"
        :index="current"
        @play="playAt"
        @refresh="refreshRecommend"
        @switch="switchLibrary"
      />
    </section>
  </main>

  <PlayerBar
    ref="player"
    :song="currentSong"
    :playing="playing"
    :library="library"
    :index="current"
    :total="playlist.length"
    @toggle="togglePlay"
    @next="next"
    @prev="prev"
    @ended="onEnded"
  />

  <AlgorithmDoc v-if="showAlgo" @close="showAlgo = false" />
  <div v-if="toast" class="toast">{{ toast }}</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import CameraView from './components/CameraView.vue'
import ImageInput from './components/ImageInput.vue'
import VideoInput from './components/VideoInput.vue'
import SampleGallery from './components/SampleGallery.vue'
import EmotionPanel from './components/EmotionPanel.vue'
import RecommendPanel from './components/RecommendPanel.vue'
import PlayerBar from './components/PlayerBar.vue'
import AlgorithmDoc from './components/AlgorithmDoc.vue'
import { initModels, EmotionSmoother, detectEmotion, EMOTION_EMOJIS, EMOTION_COLORS } from './core/emotion'
import { recommend, EMOTION_KEYWORDS } from './core/recommend'
import { loadLocalSongs, onlineSearch, resolveOnlineUrl } from './core/music'

const tabs = [
  { key: 'camera', icon: '📷', label: '实时摄像头' },
  { key: 'upload', icon: '🖼️', label: '上传图片' },
  { key: 'video', icon: '🎬', label: '视频文件' },
  { key: 'sample', icon: '👥', label: '示例照片' }
]
const tab = ref('sample')
const modelsReady = ref(false)
const modelMsg = ref('正在加载本地模型…')
const samples = ref([])
const localSongs = ref([])
const onlineSongs = ref([])
const library = ref('local')
const detection = ref(null)
const strategyInfo = ref(null)
const playlist = ref([])
const current = ref(0)
const playing = ref(false)
const onlineLoading = ref(false)
const onlineError = ref('')
const showAlgo = ref(false)
const toast = ref('')
const activeSample = ref('')
const player = ref(null)

let smoother = new EmotionSmoother(0.35)
let toastTimer = null

const currentSong = computed(() => playlist.value[current.value] || null)

function toastMsg(m) {
  toast.value = m
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2800)
}

onMounted(async () => {
  try {
    await initModels(m => (modelMsg.value = m))
    modelsReady.value = true
    modelMsg.value = '本地模型就绪 ✓'
  } catch (e) {
    modelMsg.value = '模型加载失败'
    toastMsg('模型加载失败：' + e.message)
  }
  try {
    localSongs.value = await loadLocalSongs()
  } catch (e) {
    toastMsg('本地曲库加载失败')
  }
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}samples/manifest.json`)
    const data = await r.json()
    samples.value = data.samples.map(s => ({
      ...s,
      url: `${import.meta.env.BASE_URL}samples/${s.file}`,
      color: EMOTION_COLORS[s.emotion],
      emoji: EMOTION_EMOJIS[s.emotion]
    }))
  } catch (e) { /* 无示例照片时忽略 */ }
})

/** 统一情绪入口：时序平滑 → 更新结果 → 重新推荐 */
function onEmotion(r) {
  if (!r || !r.expressions) return
  if (!r.live) smoother.reset()
  const sm = smoother.push(r.expressions)
  detection.value = {
    expressions: sm.expressions,
    top: sm.top,
    confidence: sm.confidence,
    source: r.source || '未知来源',
    box: r.box
  }
  refreshRecommend()
}

/** 示例照片：加载图片 → 本地识别 → 推荐 */
async function onSamplePick(s) {
  activeSample.value = s.file
  if (!modelsReady.value) { toastMsg('模型仍在加载中，请稍候…'); return }
  try {
    const img = new Image()
    img.src = s.url
    await img.decode()
    const r = await detectEmotion(img)
    if (!r) { toastMsg('该照片未检测到人脸，请换一张'); return }
    onEmotion({ ...r, source: `示例照片 · ${s.label}`, live: false })
  } catch (e) {
    toastMsg('识别失败：' + (e.message || e))
  }
}

/** 重新生成情绪旅程歌单 */
function refreshRecommend() {
  if (!detection.value) return
  const pool = library.value === 'online' && onlineSongs.value.length ? onlineSongs.value : localSongs.value
  if (!pool.length) return
  strategyInfo.value = recommend(pool, detection.value.top, { size: 5, seed: Date.now() % 100000 })
  playlist.value = strategyInfo.value.songs
  current.value = 0
}

/** 切换曲库（本地 / 在线） */
async function switchLibrary(mode) {
  if (mode === library.value) return
  library.value = mode
  if (mode === 'online') {
    if (!detection.value) {
      toastMsg('请先完成一次情绪识别')
      library.value = 'local'
      return
    }
    onlineLoading.value = true
    onlineError.value = ''
    try {
      const kw = EMOTION_KEYWORDS[detection.value.top] || '热歌'
      onlineSongs.value = await onlineSearch(kw)
      toastMsg('在线曲库就绪（网易云）')
    } catch (e) {
      onlineError.value = e.message
      library.value = 'local'
      toastMsg('在线曲库不可用，已回退本地曲库')
    } finally {
      onlineLoading.value = false
    }
  }
  refreshRecommend()
}

async function playAt(i) {
  if (!playlist.value.length) return
  current.value = i
  const song = playlist.value[i]
  if (!song) return
  if (song.source === 'online' && !song._url) {
    toastMsg('正在解析在线播放地址…')
    try {
      song._url = await resolveOnlineUrl(song)
    } catch (e) {
      toastMsg(e.message)
      playing.value = false
      return
    }
  }
  player.value?.playSong({ ...song, url: song._url || song.url })
  playing.value = true
}

function togglePlay() { playing.value = !playing.value }
function next() { playAt((current.value + 1) % playlist.value.length) }
function prev() { playAt((current.value - 1 + playlist.value.length) % playlist.value.length) }
function onEnded() { next() }
function onStatus(msg) { if (msg) toastMsg(msg) }
</script>
