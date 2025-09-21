import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import { PlayIcon, PauseIcon, VolumeIcon, MuteIcon, PrevIcon, NextIcon } from './Icons'

const Player = forwardRef(function Player({ src, title, artist, album, cover, loading = false, onCanPlay, onError, onPlay, onPause, onEnded, history = [], onPlayPrevious, onPlayNext }, ref) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const progressRef = useRef(null)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const dragging = useRef(false)

  useImperativeHandle(ref, () => ({
    play: () => audioRef.current?.play(),
    pause: () => audioRef.current?.pause(),
    seek: (t) => { if (audioRef.current) audioRef.current.currentTime = t },
    isPlaying: () => !!playing,
    getCurrentTime: () => audioRef.current ? (audioRef.current.currentTime || 0) : 0,
    getDuration: () => audioRef.current ? (audioRef.current.duration || 0) : 0
  }))

  useEffect(() => {
    setPlaying(false)
    setDuration(0)
    setCurrentTime(0)
    setBufferedEnd(0)
  }, [src])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = volume
    a.muted = muted
  }, [volume, muted])

  function handleLoadedMetadata() {
    const a = audioRef.current
    if (!a) return
    setDuration(a.duration || 0)
    updateBuffered(a)
  }

  function updateBuffered(a = audioRef.current) {
    if (!a || !a.buffered || a.buffered.length === 0) return setBufferedEnd(0)
    try {
      const end = a.buffered.end(a.buffered.length - 1)
      setBufferedEnd(end)
    } catch (e) {
      // ignore
    }
  }

  function handleTimeUpdate() {
    const a = audioRef.current
    if (!a) return
    setCurrentTime(a.currentTime || 0)
    updateBuffered(a)
  }

  function handleProgressClick(e) {
    const bar = progressRef.current
    const a = audioRef.current
    if (!bar || !a || !duration) return
    const rect = bar.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, clickX / rect.width))
    const seekTime = pct * duration
    a.currentTime = seekTime
    setCurrentTime(seekTime)
  }

  function handleThumbDown(e) {
    dragging.current = true
    e.target.setPointerCapture?.(e.pointerId)
    document.addEventListener('pointermove', handleThumbMove)
    document.addEventListener('pointerup', handleThumbUp)
    e.preventDefault()
  }

  function handleThumbMove(e) {
    if (!dragging.current) return
    const bar = progressRef.current
    const a = audioRef.current
    if (!bar || !a || !duration) return
    const rect = bar.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    const t = pct * duration
    setCurrentTime(t)
  }

  function handleThumbUp(e) {
    if (!dragging.current) return
    dragging.current = false
    document.removeEventListener('pointermove', handleThumbMove)
    document.removeEventListener('pointerup', handleThumbUp)
    const bar = progressRef.current
    const a = audioRef.current
    if (!bar || !a || !duration) return
    const rect = bar.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    const t = pct * duration
    a.currentTime = t
    setCurrentTime(t)
  }

  function handleThumbKeyDown(e) {
    if (!duration) return
    const step = Math.max(1, Math.floor(duration / 30))
    const a = audioRef.current
    if (!a) return
    if (e.key === 'ArrowLeft') {
      a.currentTime = Math.max(0, a.currentTime - step)
      setCurrentTime(a.currentTime)
      e.preventDefault()
    } else if (e.key === 'ArrowRight') {
      a.currentTime = Math.min(duration, a.currentTime + step)
      setCurrentTime(a.currentTime)
      e.preventDefault()
    } else if (e.key === 'Home') {
      a.currentTime = 0; setCurrentTime(0); e.preventDefault()
    } else if (e.key === 'End') {
      a.currentTime = duration; setCurrentTime(duration); e.preventDefault()
    }
  }

  return (
    <div className="player player-ref">
      <div className={`player-blur ${playing ? 'playing' : ''}`} style={{ backgroundImage: cover ? `url(${cover})` : undefined }} />
        <div className="player-overlay" />
      <div className="player-inner">
      <div className="player-top">
        <div className="player-art" style={{ backgroundImage: cover ? `url(${cover})` : undefined }} />
        <div className="player-meta">
          <div className="player-title">{title}</div>
          <div className="player-artist">{artist}</div>
          {album && <div className="player-album">{album}</div>}
        </div>
      </div>

      <div className="player-center">
        <div className="center-controls">
          <button className="small-btn prev-btn" aria-label="Previous" onClick={() => onPlayPrevious && onPlayPrevious()} disabled={!onPlayPrevious}>
            <PrevIcon size={28} color="#ffffff" />
          </button>

          <button
            className={`play-btn large ${playing ? 'playing' : ''}`}
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => {
              const a = audioRef.current
              if (!a) return
              if (playing) { a.pause(); setPlaying(false) }
              else { a.play().catch(()=>{}); setPlaying(true) }
            }}
          >
            {playing ? <PauseIcon size={32} color="#022" /> : <PlayIcon size={32} color="#022" />}
          </button>

          <button className="small-btn next-btn" aria-label="Next" onClick={() => onPlayNext && onPlayNext()} disabled={!onPlayNext}>
            <NextIcon size={28} color="#ffffff" />
          </button>
        </div>
      </div>

      <div className="player-bottom">
        <div className="progress-row">
          <div className="time-left">{formatTime(currentTime)}</div>
          <div className="progress-wrapper">
            <div className="progress-bar" ref={progressRef} onClick={handleProgressClick}>
              <div className="buffered-fill" style={{ width: duration ? `${Math.min(100, (bufferedEnd / duration) * 100)}%` : '0%' }} />
              <div className="played-fill" style={{ width: duration ? `${Math.min(100, (currentTime / duration) * 100)}%` : '0%' }} />
              <div
                className="seek-thumb"
                role="slider"
                tabIndex={0}
                aria-valuemin={0}
                aria-valuemax={duration || 0}
                aria-valuenow={currentTime}
                style={{ left: duration ? `${Math.min(100, (currentTime / duration) * 100)}%` : '0%' }}
                onPointerDown={handleThumbDown}
                onKeyDown={handleThumbKeyDown}
              />
            </div>
          </div>
          <div className="time-right">{duration ? formatTime(duration) : '--:--'}</div>
        </div>

        <div className="bottom-controls">
          <div className="volume-block">
              <button className="mute-btn" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted ? <MuteIcon size={18} color="#eaeaea" /> : <VolumeIcon size={20} color="#eaeaea" level={muted ? 0 : volume} />}
              </button>
              <input
                className="volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={muted ? 0 : volume}
                onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false) }}
                aria-label="Volume"
                style={{
                  background: `linear-gradient(90deg, #1db954 0%, #61dafb ${Math.round((muted ? 0 : volume) * 100)}%, rgba(255,255,255,0.06) ${Math.round((muted ? 0 : volume) * 100)}%)`
                }}
              />
            </div>
        </div>

      <audio
        ref={audioRef}
        src={src}
        style={{ display: 'none' }}
        onPlay={() => { setPlaying(true); onPlay && onPlay() }}
        onPause={() => { setPlaying(false); onPause && onPause() }}
        onEnded={() => { setPlaying(false); onEnded && onEnded() }}
        onCanPlay={() => onCanPlay && onCanPlay()}
        onLoadedMetadata={handleLoadedMetadata}
        onProgress={() => updateBuffered()}
        onTimeUpdate={handleTimeUpdate}
        onError={(e) => {
          const a = audioRef.current
          let msg = 'Unknown audio error'
          try {
            const code = a?.error?.code
            if (code === 1) msg = 'Aborted'
            else if (code === 2) msg = 'Network error'
            else if (code === 3) msg = 'Decoding error'
            else if (code === 4) msg = 'Unsupported format'
          } catch (err) {}
          onError && onError(msg)
        }}
      />
      </div>
      </div>
    </div>
  )
})

export default Player

function formatTime(s) {
  if (!s || !isFinite(s)) return '0:00'
  const mins = Math.floor(s / 60)
  const secs = Math.floor(s % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}
