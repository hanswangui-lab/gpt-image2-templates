import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { generateImage, pollTask, type TaskStatus } from '../services/imageApi'
import { getPendingGeneration } from '../services/imageApi'
import { useAuthContext } from './AuthContext'
import { config } from '../lib/config'

export type GenerateState = {
  prompt: string
  setPrompt: (v: string) => void
  ratio: string
  setRatio: (v: string) => void
  resIndex: number
  setResIndex: (v: number) => void
  generating: boolean
  result: { imageUrl: string } | null
  error: string
  handleGenerate: () => Promise<void>
  clearResult: () => void
}

const STORAGE_KEY = 'generate_state'
const POLL_INTERVAL = 5000
const POLL_TIMEOUT = 300_000 // 5 minutes max polling

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function persistState(state: { prompt: string; ratio: string; resIndex: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

const GenerateContext = createContext<GenerateState | null>(null)

export function GenerateProvider({ children }: { children: ReactNode }) {
  const { user, credits, setShowAuth, setAuthMode, refreshCredits } = useAuthContext()
  const persisted = loadPersistedState()
  const [prompt, setPrompt] = useState(persisted.prompt || '')
  const [ratio, setRatio] = useState(persisted.ratio || '1:1')
  const [resIndex, setResIndex] = useState(persisted.resIndex ?? 0)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ imageUrl: string } | null>(null)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollStartRef = useRef<number>(0)

  // Persist prompt/ratio/resIndex to localStorage
  useEffect(() => {
    persistState({ prompt, ratio, resIndex })
  }, [prompt, ratio, resIndex])

  function clearPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function stopPollingWithError(msg: string) {
    clearPoll()
    setGenerating(false)
    setError(msg)
    refreshCredits()
  }

  function startPolling(taskId: string) {
    clearPoll()
    pollStartRef.current = Date.now()

    pollRef.current = setInterval(async () => {
      // Timeout check
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT) {
        stopPollingWithError('生成超时，请稍后重试')
        return
      }

      try {
        const status: TaskStatus = await pollTask(taskId)

        if (status.status === 'completed' && status.imageUrl) {
          clearPoll()
          setGenerating(false)
          setResult({ imageUrl: status.imageUrl })
          refreshCredits()
        } else if (status.status === 'failed') {
          stopPollingWithError(status.error || '生成失败')
        }
      } catch {
        // Network error during poll — keep polling
      }
    }, POLL_INTERVAL)
  }

  // On mount, check for in-progress generation (refresh persistence)
  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function check() {
      const pending = await getPendingGeneration()
      if (cancelled) return

      if (pending.status === 'pending' || pending.status === 'processing') {
        setGenerating(true)
        startPolling(pending.imageId!)
      } else if (pending.status === 'completed' && pending.imageUrl) {
        setResult({ imageUrl: pending.imageUrl })
      } else if (pending.status === 'failed') {
        setError(pending.error || '生成失败')
      }
    }

    check()

    return () => {
      cancelled = true
      clearPoll()
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = useCallback(async () => {
    setError('')
    setResult(null)

    if (!prompt.trim() || prompt.trim().length < 5) {
      setError('请输入至少 5 个字的提示词')
      return
    }

    if (!user) {
      setAuthMode('login')
      setShowAuth(true)
      return
    }

    const resolution = config.resolutions[resIndex]
    if (credits < resolution.cost) {
      setError('积分不足，请先充值')
      return
    }

    setGenerating(true)
    try {
      const { taskId } = await generateImage({ prompt: prompt.trim(), model: resolution.model, aspectRatio: ratio, cost: resolution.cost })
      startPolling(taskId)
    } catch (err: any) {
      setGenerating(false)
      setError(err.message || '生成失败')
    }
  }, [prompt, user, resIndex, credits, refreshCredits, setShowAuth, setAuthMode])

  const clearResult = useCallback(() => setResult(null), [])

  return (
    <GenerateContext.Provider value={{ prompt, setPrompt, ratio, setRatio, resIndex, setResIndex, generating, result, error, handleGenerate, clearResult }}>
      {children}
    </GenerateContext.Provider>
  )
}

export function useGenerateContext() {
  const ctx = useContext(GenerateContext)
  if (!ctx) throw new Error('useGenerateContext must be used within GenerateProvider')
  return ctx
}
