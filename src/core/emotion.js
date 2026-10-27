/**
 * 本地情绪识别服务（core/emotion.js）
 * 算法：TinyFaceDetector（轻量人脸检测 CNN） + FaceExpressionNet（7 类情绪 CNN）
 * 模型与算法库全部本地加载，推理在浏览器端完成，无需任何服务端。
 */

// 通过 BASE_URL 拼接，兼容 GitHub Pages 子路径部署（如 /emotion-music/）
const MODELS_URL = `${import.meta.env.BASE_URL}models`

export const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised']

export const EMOTION_LABELS = {
  neutral: '中性', happy: '开心', sad: '悲伤', angry: '愤怒',
  fearful: '恐惧', disgusted: '厌恶', surprised: '惊讶'
}
export const EMOTION_EMOJIS = {
  neutral: '😐', happy: '😄', sad: '😢', angry: '😠',
  fearful: '😨', disgusted: '🤢', surprised: '😲'
}
export const EMOTION_COLORS = {
  neutral: '#8b93a7', happy: '#f5b942', sad: '#5b8def', angry: '#ef5b5b',
  fearful: '#9b6ef3', disgusted: '#4fbf8b', surprised: '#f57ec0'
}

let ready = false

/** 加载本地模型（public/models） */
export async function initModels(onProgress) {
  if (ready) return true
  if (!window.faceapi) throw new Error('face-api.js 算法库未加载，请检查 /vendor/face-api.min.js')
  const steps = [
    ['TinyFaceDetector 人脸检测模型', () => window.faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL)],
    ['FaceExpressionNet 情绪识别模型', () => window.faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL)]
  ]
  for (const [name, fn] of steps) {
    if (onProgress) onProgress(`正在加载 ${name} …`)
    await fn()
  }
  try { await window.faceapi.tf.setBackend('webgl') } catch (e) { await window.faceapi.tf.setBackend('cpu') }
  ready = true
  return true
}

export function modelsReady() { return ready }

/** 检测器参数：输入 320px、置信度阈值 0.45 */
export function detectorOptions() {
  return new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 })
}

/**
 * 单帧情绪检测
 * @param input HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
 * @returns { box, score, expressions, top, confidence } | null（未检测到人脸）
 */
export async function detectEmotion(input, options) {
  const det = await window.faceapi
    .detectSingleFace(input, options || detectorOptions())
    .withFaceExpressions()
  if (!det) return null
  const expressions = {}
  for (const k of EMOTIONS) expressions[k] = det.expressions[k] || 0
  const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1])
  return {
    box: det.detection.box,
    score: det.detection.score,
    expressions,
    top: sorted[0][0],
    confidence: sorted[0][1]
  }
}

/**
 * 时序平滑器：指数滑动平均(EMA) + 迟滞切换
 * 解决摄像头实时识别时情绪标签抖动的问题。
 */
export class EmotionSmoother {
  constructor(alpha = 0.35) {
    this.alpha = alpha
    this.state = null
    this.top = null
    this.margin = 0.08 // 迟滞阈值：新情绪需领先 8% 才切换
  }
  push(expressions) {
    if (!this.state) {
      this.state = { ...expressions }
    } else {
      for (const k of EMOTIONS) {
        this.state[k] = this.alpha * (expressions[k] || 0) + (1 - this.alpha) * this.state[k]
      }
    }
    const sorted = Object.entries(this.state).sort((a, b) => b[1] - a[1])
    const [k1, v1] = sorted[0]
    const v2 = sorted[1][1]
    if (this.top === null || (k1 !== this.top && v1 - v2 > this.margin)) this.top = k1
    return { expressions: { ...this.state }, top: this.top, confidence: this.state[this.top] }
  }
  reset() { this.state = null; this.top = null }
}
