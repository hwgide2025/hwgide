export { default } from './WebcamCaptureFixed'
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'

const WebcamCapture = forwardRef(function WebcamCapture({ onCapture, disabled, mood }, ref) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
        if (!mounted) return
        if (videoRef.current) videoRef.current.srcObject = s
        setStream(s)
      } catch (e) {
        console.error(e)
        setError('Camera access denied or not available')
      }
    }
    start()
    return () => {
      mounted = false
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (disabled) {
      try { v.pause() } catch (e) { /* ignore */ }
    } else {
      try { v.play().catch(() => {}) } catch (e) { /* ignore */ }
    }
  }, [disabled])

  async function capture() {
    if (!videoRef.current || !canvasRef.current) return null
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/jpeg', 0.9)
    })
  }

  useImperativeHandle(ref, () => ({
    async takePhoto() {
      if (disabled) return null
      try {
        const b = await capture()
        return b
      } catch (e) {
        console.error('takePhoto failed', e)
        return null
      }
    }
  }))

  async function handleClick() {
    if (disabled) return
    setError(null)
    try {
      const blob = await capture()
      if (blob && onCapture) onCapture(blob)
    } catch (e) {
      console.error(e)
      setError('Failed to capture photo')
    }
  }

  return (
    <div className="webcam-capture">
      import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'

      const WebcamCapture = forwardRef(function WebcamCapture({ onCapture, disabled, mood }, ref) {
        const videoRef = useRef(null)
        const canvasRef = useRef(null)
        const [stream, setStream] = useState(null)
        const [error, setError] = useState(null)

        useEffect(() => {
          let mounted = true
          async function start() {
            try {
              const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
              if (!mounted) return
              if (videoRef.current) videoRef.current.srcObject = s
              setStream(s)
            } catch (e) {
              console.error(e)
              setError('Camera access denied or not available')
            }
          }
          start()
          return () => {
            mounted = false
            if (stream) {
              stream.getTracks().forEach(t => t.stop())
            }
          }
        }, [])

        useEffect(() => {
          const v = videoRef.current
          if (!v) return
          if (disabled) {
            try { v.pause() } catch (e) { /* ignore */ }
          } else {
            try { v.play().catch(() => {}) } catch (e) { /* ignore */ }
          }
        }, [disabled])

        async function capture() {
          if (!videoRef.current || !canvasRef.current) return null
          const video = videoRef.current
          const canvas = canvasRef.current
          canvas.width = video.videoWidth || 640
          canvas.height = video.videoHeight || 480
          const ctx = canvas.getContext('2d')
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          return new Promise((resolve) => {
            canvas.toBlob((blob) => {
              resolve(blob)
            }, 'image/jpeg', 0.9)
          })
        }

        useImperativeHandle(ref, () => ({
          async takePhoto() {
            if (disabled) return null
            try {
              const b = await capture()
              return b
            } catch (e) {
              console.error('takePhoto failed', e)
              return null
            }
          }
        }))

        async function handleClick() {
          if (disabled) return
          setError(null)
          try {
            const blob = await capture()
            if (blob && onCapture) onCapture(blob)
          } catch (e) {
            console.error(e)
            setError('Failed to capture photo')
          }
        }

        return (
          <div className="webcam-capture">
            {error && <div className="error">{error}</div>}
            <video ref={videoRef} autoPlay playsInline muted className="webcam-video" />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div className="controls">
              <button onClick={handleClick} disabled={disabled} className="capture-btn">Take Photo</button>
            </div>
            {mood && (
              <div className="mood-badges" aria-live="polite">
                {renderMood(mood)}
              </div>
            )}
          </div>
        )
      })

      function renderMood(mood) {
        if (typeof mood === 'string') return <div className="mood-badge">{mood}</div>

        if (Array.isArray(mood)) {
          return mood.map((m, i) => <div key={i} className="mood-badge">{typeof m === 'string' ? m : JSON.stringify(m)}</div>)
        }

        if (typeof mood === 'object' && mood !== null) {
          const candidates = ['emotions', 'scores', 'predictions', 'labels']
          for (const c of candidates) {
            if (mood[c] && typeof mood[c] === 'object') {
              return renderMoodObject(mood[c])
            }
          }

          if (mood.label && typeof mood.label === 'string') {
            return <div className="mood-badge">{mood.label}</div>
          }

          return renderMoodObject(mood)
        }

        return <div className="mood-badge">{String(mood)}</div>
      }

      function renderMoodObject(obj) {
        try {
          const entries = Object.entries(obj).map(([k, v]) => ({ k, v: typeof v === 'number' ? v : parseFloat(v) || 0 }))
          entries.sort((a, b) => b.v - a.v)
          return entries.slice(0, 3).map((e) => {
            const pct = isFinite(e.v) ? Math.round(e.v * 100) : ''
            return <div key={e.k} className="mood-badge">{e.k}{pct ? ` · ${pct}%` : ''}</div>
          })
        } catch (e) {
          return <div className="mood-badge">{JSON.stringify(obj)}</div>
        }
      }

      export default WebcamCapture

      {error && <div className="error">{error}</div>}
      <video ref={videoRef} autoPlay playsInline muted className="webcam-video" />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div className="controls">
        <button onClick={handleClick} disabled={disabled} className="capture-btn">Take Photo</button>
      </div>
      {mood && (
        <div className="mood-badges" aria-live="polite">
          {renderMood(mood)}
        </div>
      )}
    </div>
  )
})

function renderMood(mood) {
  // string
  if (typeof mood === 'string') return <div className="mood-badge">{mood}</div>

  // array of labels
  if (Array.isArray(mood)) {
    return mood.map((m, i) => <div key={i} className="mood-badge">{typeof m === 'string' ? m : JSON.stringify(m)}</div>)
  }

  // object mapping label->score or nested shape
  if (typeof mood === 'object' && mood !== null) {
    // If the object has a top-level property that's an object of emotions, use that
    const candidates = ['emotions', 'scores', 'predictions', 'labels']
    for (const c of candidates) {
      if (mood[c] && typeof mood[c] === 'object') {
        return renderMoodObject(mood[c])
      }
    }

    // If object looks like {label: 'happy'}
    if (mood.label && typeof mood.label === 'string') {
      return <div className="mood-badge">{mood.label}</div>
    }

    // Otherwise treat object as mapping label->score
    return renderMoodObject(mood)
  }

  // fallback
  return <div className="mood-badge">{String(mood)}</div>
}

function renderMoodObject(obj) {
  try {
    const entries = Object.entries(obj).map(([k, v]) => ({ k, v: typeof v === 'number' ? v : parseFloat(v) || 0 }))
    entries.sort((a, b) => b.v - a.v)
    // show top 3
    return entries.slice(0, 3).map((e) => {
      const pct = isFinite(e.v) ? Math.round(e.v * 100) : ''
      return <div key={e.k} className="mood-badge">{e.k}{pct ? ` · ${pct}%` : ''}</div>
    })
  } catch (e) {
    return <div className="mood-badge">{JSON.stringify(obj)}</div>
  }
}

export default WebcamCapture
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'

const WebcamCapture = forwardRef(function WebcamCapture({ onCapture, disabled, mood }, ref) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
        if (!mounted) return
        videoRef.current.srcObject = s
        setStream(s)
      } catch (e) {
        console.error(e)
        setError('Camera access denied or not available')
      }
    }
    start()
    return () => {
      mounted = false
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // Freeze/unfreeze the live video when `disabled` changes (used for loading overlay)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (disabled) {
      try { v.pause() } catch (e) { /* ignore */ }
    } else {
      try { v.play().catch(() => {}) } catch (e) { /* ignore */ }
    }
  }, [disabled])

  async function capture() {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/jpeg', 0.9)
    })
  }

  useImperativeHandle(ref, () => ({
    async takePhoto() {
      if (disabled) return null
      try {
        const b = await capture()
        return b
      } catch (e) {
        console.error('takePhoto failed', e)
        return null
      }
    }
  }))

  async function handleClick() {
    if (disabled) return
    setError(null)
            {mood && (
              <div className="mood-badges" aria-live="polite">
                {renderMood(mood)}
              </div>
            )}
    } catch (e) {
      console.error(e)
      setError('Failed to capture photo')

      function renderMood(mood) {
        // string
        if (typeof mood === 'string') return <div className="mood-badge">{mood}</div>

        // array of labels
        if (Array.isArray(mood)) {
          return mood.map((m, i) => <div key={i} className="mood-badge">{typeof m === 'string' ? m : JSON.stringify(m)}</div>)
        }

        // object mapping label->score or nested shape
        if (typeof mood === 'object' && mood !== null) {
          // If the object has a top-level property that's an object of emotions, use that
          const candidates = ['emotions', 'scores', 'predictions', 'labels']
          for (const c of candidates) {
            if (mood[c] && typeof mood[c] === 'object') {
              return renderMoodObject(mood[c])
            }
          }

          // If object looks like {label: 'happy'}
          if (mood.label && typeof mood.label === 'string') {
            return <div className="mood-badge">{mood.label}</div>
          }

          // Otherwise treat object as mapping label->score
          return renderMoodObject(mood)
        }

        // fallback
        return <div className="mood-badge">{String(mood)}</div>
      }

      function renderMoodObject(obj) {
        try {
          const entries = Object.entries(obj).map(([k, v]) => ({ k, v: typeof v === 'number' ? v : parseFloat(v) || 0 }))
          entries.sort((a, b) => b.v - a.v)
          // show top 3
          return entries.slice(0, 3).map((e) => {
            const pct = isFinite(e.v) ? Math.round(e.v * 100) : ''
            return <div key={e.k} className="mood-badge">{e.k}{pct ? ` · ${pct}%` : ''}</div>
          })
        } catch (e) {
          return <div className="mood-badge">{JSON.stringify(obj)}</div>
        }
      }
    }
  }

  return (
    <div className="webcam-capture">
      {error && <div className="error">{error}</div>}
      <video ref={videoRef} autoPlay playsInline muted className="webcam-video" />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div className="controls">
        <button onClick={handleClick} disabled={disabled} className="capture-btn">Take Photo</button>
      </div>
      {mood && (
        <div className="mood-badge" aria-live="polite">{typeof mood === 'string' ? mood : JSON.stringify(mood)}</div>
      )}
    </div>
  )
})

export default WebcamCapture
