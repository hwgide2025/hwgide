import React, { useRef, useEffect, useState } from 'react'

export default function WebcamCapture({ onCapture, disabled }) {
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
    </div>
  )
}
