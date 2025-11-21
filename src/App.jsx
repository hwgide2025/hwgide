import React, { useState, useRef, useEffect } from 'react'
import pkg from '../package.json'
import './App.css'
import Player from './components/Player'
import { PlayIcon, RemoveIcon } from './components/Icons'
import WebcamCapture from './components/WebcamCapture'
import buildInfo from './buildInfo'
import { sendImageToApi } from './api'

function App() {
  const [audioSrc, setAudioSrc] = useState(null)
  const [trackInfo, setTrackInfo] = useState({ title: 'No track', artist: '', album: '', cover: null })
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaderIndex, setLoaderIndex] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [simLoading, setSimLoading] = useState(false)
  const [lastApiResponse, setLastApiResponse] = useState(null)
  const [audioError, setAudioError] = useState(null)
  const [error, setError] = useState(null)
  const [mood, setMood] = useState(null)
  const playerRef = useRef()
  const prevObjectUrl = useRef(null)
  const webcamRef = useRef()
  const capturedForRef = useRef(new Set())
  const [showBuildTooltip, setShowBuildTooltip] = useState(false)
  // Simple FIFO queue for upcoming tracks (state + ref so UI updates reliably)
  const queueRef = useRef([])
  const [queue, setQueue] = useState([])

  // enqueue a track (object with { src, title, artist, album, cover })
  function enqueueTrack(track) {
    queueRef.current.push(track)
    setQueue([...queueRef.current])
  }

  // play now from queue at index (remove from queue and play)
  function playNowFromQueue(index) {
    const item = queueRef.current.splice(index, 1)[0]
    setQueue([...queueRef.current])
    if (!item) return
    demoQueuedRef.current = false
    setAudioSrc(item.src)
    setTrackInfo({ title: item.title || 'Track', artist: item.artist || '', album: item.album || '', cover: item.cover || null })
    setHistory(h => [{ title: item.title || 'Track', artist: item.artist || '', album: item.album || '', cover: item.cover || null, src: item.src, playedAt: Date.now() }, ...h].slice(0, 20))
    setTimeout(() => playerRef.current?.play(), 120)
  }

  function removeFromQueue(index) {
    queueRef.current.splice(index, 1)
    setQueue([...queueRef.current])
  }

  // Try to play immediately if player is idle; otherwise enqueue
  function playOrQueueTrack(track) {
    try {
      const isPlaying = playerRef.current?.isPlaying?.() || false
      if (!isPlaying) {
        setAudioSrc(track.src)
        setTrackInfo({ title: track.title || 'Track', artist: track.artist || '', album: track.album || '', cover: track.cover || null })
        // mark demoQueuedRef false once a real track is set to play
        demoQueuedRef.current = false
        // record in history because we're playing immediately
        setHistory(h => [{ title: track.title || 'Track', artist: track.artist || '', album: track.album || '', cover: track.cover || null, src: track.src, playedAt: Date.now() }, ...h].slice(0, 20))
      } else {
        enqueueTrack(track)
      }
    } catch (e) {
      // fallback: enqueue
      enqueueTrack(track)
    }
  }

  useEffect(() => {
    // Use raw.githubusercontent URLs so the browser receives the actual file bytes
    const demoUrl = 'https://raw.githubusercontent.com/heszes/storagehwgide/main/Darude_Sandstorm.mp3'
    const demoCover = 'https://raw.githubusercontent.com/heszes/storagehwgide/main/Sandstorm_single.jpg'
    const demoTrack = {
      title: 'Sandstorm',
      artist: 'Darude',
      album: 'Before the Storm',
      cover: demoCover,
      src: demoUrl,
      playedAt: Date.now()
    }
    // Only set if nothing is already queued
  setAudioSrc(s => s || demoUrl)
    setTrackInfo(t => (t && t.title && t.title !== 'No track') ? t : { title: demoTrack.title, artist: demoTrack.artist, album: demoTrack.album, cover: demoTrack.cover })
    setHistory(h => {
      // If history is empty or doesn't already include the demo, prepend it
      if (!h || h.length === 0 || !h.find(it => it.src === demoUrl)) {
        return [demoTrack, ...(h || [])].slice(0, 20)
      }
      return h
    })
  }, [])

  // Track whether the queued demo was added; set false so the default/demo track will autoplay when ready
  const demoQueuedRef = useRef(false)

  function formatBuildTimestamp(ts) {
    if (!ts) return ''
    try {
      // Format the timestamp in the user's local time with timezone abbreviation.
      const d = new Date(ts)
      // Use Intl.DateTimeFormat to obtain localized parts including timezone short name (e.g. EST)
      const parts = new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZoneName: 'short'
      }).formatToParts(d)

      const lookup = {}
      for (const p of parts) {
        if (p.type && p.value) lookup[p.type] = p.value
      }

      // parts provide month/day/year in locale order; ensure we build YYYY-MM-DD
      const year = lookup.year || d.getFullYear()
      const month = lookup.month || String(d.getMonth() + 1).padStart(2, '0')
      const day = lookup.day || String(d.getDate()).padStart(2, '0')
      // hour/minute are already zero-padded due to options
      const hour = lookup.hour || String(d.getHours()).padStart(2, '0')
      const minute = lookup.minute || String(d.getMinutes()).padStart(2, '0')
      const tz = lookup.timeZoneName || ''

      return `${month}-${day}-${year} ${hour}:${minute} ${tz}`.trim()
    } catch (e) {
      return ts
    }
  }

  const loaderMessages = [
    'Uploading photo…',
    'Analyzing image…',
    'Calculating optimal song…',
    'Composing melody…',
    'Loading song…',
  ]

  const typingIntervalRef = useRef(null)
  const messageTimeoutRef = useRef(null)

  useEffect(() => {
    function clearTimers() {
      if (typingIntervalRef.current) { clearInterval(typingIntervalRef.current); typingIntervalRef.current = null }
      if (messageTimeoutRef.current) { clearTimeout(messageTimeoutRef.current); messageTimeoutRef.current = null }
    }

    if (!loading) {
      clearTimers()
      setLoaderIndex(0)
      setTypedText('')
      return
    }

    const pauseAfterTyped = 1200

    let active = true

    const computeNext = (idx) => {
      const L = loaderMessages.length
      if (L <= 1) return 0
      return (idx + 1) % L
    }

    const typeMessage = (idx) => {
      if (!active) return
      clearTimers()
      const msg = loaderMessages[idx] || ''
      const speed = Math.max(60, Math.floor(140 - Math.min(80, msg.length)))

      let pos = 0
      setTypedText('')
      typingIntervalRef.current = setInterval(() => {
        if (!active) return
        pos += 1
        setTypedText(msg.slice(0, pos))
        if (pos >= msg.length) {
          clearTimers()
          messageTimeoutRef.current = setTimeout(() => {
            if (!active) return
            const next = computeNext(idx)
            setLoaderIndex(next)
            setTypedText('')
            typeMessage(next)
          }, pauseAfterTyped)
        }
      }, speed)
    }


    typeMessage(loaderIndex || 0)

    return () => {
      active = false
      clearTimers()
    }
  }, [loading])


  useEffect(() => {
    let cancelled = false
    async function computeAndSet() {
      // Prefer the player's blurred background image if available, otherwise fall back to track cover
      let url = null
      try {
        const playerBlur = document.querySelector('.player-blur')
        if (playerBlur) {
          const bg = window.getComputedStyle(playerBlur).backgroundImage || ''
          // backgroundImage is like: url("https://...")
          const m = bg.match(/url\(["']?(.*?)["']?\)/)
          if (m && m[1]) url = m[1]
        }
      } catch (e) {
        // ignore and fall back
      }
      if (!url) url = trackInfo?.cover

      if (!url) {
        try {
          const root = document.getElementById('app-root')
          root?.style.setProperty('--tint-rgb', '29,185,84')
          // darker variant for header background (default)
          root?.style.setProperty('--tint-rgb-dark', '18,115,50')
          // darker text color derived from the background (default)
          root?.style.setProperty('--text-rgb-dark', '9,65,22')
          root?.style.setProperty('--tint-text-dark', '#092f16')
          // indicate there's no player cover available so CSS falls back to tint-only
          root?.style.setProperty('--player-cover-url', 'none')
          const r0 = 29, g0 = 185, b0 = 84
          const lum0 = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0
          root?.style.setProperty('--tint-text', lum0 > 150 ? '#0b0b0b' : '#ffffff')
        } catch (e) {}
        return
      }
      try {
        const img = new Image()
        img.crossOrigin = 'Anonymous'
        img.src = url
        await new Promise((res, rej) => {
          img.onload = res
          img.onerror = rej
        })

        const canvas = document.createElement('canvas')
        const size = 64
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        let r = 0, g = 0, b = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i+3]
          if (alpha === 0) continue
          r += data[i]
          g += data[i+1]
          b += data[i+2]
          count++
        }
        if (count > 0 && !cancelled) {
          r = Math.round(r / count)
          g = Math.round(g / count)
          b = Math.round(b / count)
          const root = document.getElementById('app-root')
          root?.style.setProperty('--tint-rgb', `${r}, ${g}, ${b}`)
          // set the cover/blur URL as a CSS variable so CSS can use it for header background
          try { root?.style.setProperty('--player-cover-url', `url("${url}")`) } catch (e) {}
          // compute a darker variant for header backgrounds by simulating the player composition
          try {
            // helper: clamp
            const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))

            // get computed styles for player elements
            const blurEl = document.querySelector('.player-blur')
            const overlayEl = document.querySelector('.player-overlay')
            const playerInnerEl = document.querySelector('.player-inner')

            // defaults
            let blurOpacity = 1
            let overlayAlpha = 0.45 // default from CSS
            let overlayIsBlack = true
            let baseR = 0, baseG = 0, baseB = 0

            try {
              if (blurEl) {
                const s = window.getComputedStyle(blurEl)
                blurOpacity = parseFloat(s.opacity || '1') || 1
              }
            } catch (e) {}

            try {
              if (overlayEl) {
                const s = window.getComputedStyle(overlayEl)
                // overlay background may be a gradient; try to parse rgba occurrences
                const bg = s.backgroundImage || s.background || ''
                const rgbaMatches = Array.from(bg.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/g))
                if (rgbaMatches.length > 0) {
                  // take the first match's alpha if present, otherwise 1
                  const m = rgbaMatches[0]
                  overlayAlpha = parseFloat(m[4] || '1') || overlayAlpha
                  overlayIsBlack = (parseInt(m[1]) === 0 && parseInt(m[2]) === 0 && parseInt(m[3]) === 0)
                }
              }
            } catch (e) {}

            try {
              if (playerInnerEl) {
                const s = window.getComputedStyle(playerInnerEl)
                // try read backgroundColor as fallback base; if transparent, leave base as black
                const bc = s.backgroundColor || ''
                const m = bc.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/)
                if (m) {
                  baseR = parseInt(m[1]) || 0
                  baseG = parseInt(m[2]) || 0
                  baseB = parseInt(m[3]) || 0
                }
              }
            } catch (e) {}

            // step 1: composite the blurred image (avg color) over base using blurOpacity
            // image color is r,g,b
            const imgAlpha = blurOpacity
            const comp1R = imgAlpha * r + (1 - imgAlpha) * baseR
            const comp1G = imgAlpha * g + (1 - imgAlpha) * baseG
            const comp1B = imgAlpha * b + (1 - imgAlpha) * baseB

            // step 2: composite overlay (assumed black or rgba) over comp1 using overlayAlpha
            let overR = 0, overG = 0, overB = 0
            if (!overlayIsBlack) {
              // if overlay wasn't black, try to parse a color; otherwise we leave as black
              try {
                const s = window.getComputedStyle(overlayEl)
                const bg = s.backgroundImage || s.background || ''
                const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/)
                if (m) {
                  overR = parseInt(m[1]) || 0
                  overG = parseInt(m[2]) || 0
                  overB = parseInt(m[3]) || 0
                }
              } catch (e) {}
            }

            const comp2R = overlayAlpha * overR + (1 - overlayAlpha) * comp1R
            const comp2G = overlayAlpha * overG + (1 - overlayAlpha) * comp1G
            const comp2B = overlayAlpha * overB + (1 - overlayAlpha) * comp1B

            const finalR = clamp(comp2R)
            const finalG = clamp(comp2G)
            const finalB = clamp(comp2B)

            root?.style.setProperty('--tint-rgb-dark', `${finalR}, ${finalG}, ${finalB}`)
            // also set a darker text color (hex) based on final
            const toHex = (n) => n.toString(16).padStart(2, '0')
            root?.style.setProperty('--tint-text-dark', `#${toHex(finalR)}${toHex(finalG)}${toHex(finalB)}`)
            root?.style.setProperty('--text-rgb-dark', `${finalR}, ${finalG}, ${finalB}`)
          } catch (e) {
            // ignore
          }
          // set readable header text color based on luminance
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
          root?.style.setProperty('--tint-text', lum > 150 ? '#0b0b0b' : '#ffffff')
        }
      } catch (e) {
        // If anything fails (CORS, decode), fallback to default tint
        try {
          const root = document.getElementById('app-root')
          root?.style.setProperty('--tint-rgb', '29,185,84')
          root?.style.setProperty('--tint-rgb-dark', '18,115,50')
          root?.style.setProperty('--text-rgb-dark', '9,65,22')
          root?.style.setProperty('--tint-text-dark', '#092f16')
          const r0 = 29, g0 = 185, b0 = 84
          const lum0 = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0
          root?.style.setProperty('--tint-text', lum0 > 150 ? '#0b0b0b' : '#ffffff')
        } catch (e) {}
      }
    }
    computeAndSet()

    // Observe player blur / overlay for style changes (backgroundImage, opacity) and recompute when they change.
    const obs = new MutationObserver((mutationsList) => {
      // debounce to avoid thrashing
      if (computeAndSet._timer) clearTimeout(computeAndSet._timer)
      computeAndSet._timer = setTimeout(() => { if (!cancelled) computeAndSet() }, 80)
    })
    try {
      const blurEl = document.querySelector('.player-blur')
      const overlayEl = document.querySelector('.player-overlay')
      if (blurEl) obs.observe(blurEl, { attributes: true, attributeFilter: ['style', 'class'] })
      if (overlayEl) obs.observe(overlayEl, { attributes: true, attributeFilter: ['style', 'class', 'background'] })
    } catch (e) {
      // ignore observer errors in some environments
    }

    return () => {
      cancelled = true
      try { obs.disconnect() } catch (e) {}
      if (computeAndSet._timer) clearTimeout(computeAndSet._timer)
    }
  }, [trackInfo && trackInfo.cover])

  async function fetchAndUseBlob(url) {
    if (!url) return
    try {
      setError(null)
      setLoading(true)
      const fetched = await fetch(url, { method: 'GET', mode: 'cors' })
      if (!fetched.ok) throw new Error(`Failed to download audio: ${fetched.status} ${fetched.statusText}`)
      const blob = await fetched.blob()
      const mime = blob.type || ''
      if (!mime.startsWith('audio/') && mime !== 'application/octet-stream') {
        throw new Error(`Downloaded file is not an audio type: ${mime}`)
      }
  const obj = URL.createObjectURL(blob)
  if (prevObjectUrl.current) try { URL.revokeObjectURL(prevObjectUrl.current) } catch (e) {}
  prevObjectUrl.current = obj
  // queue or play
  playOrQueueTrack({ title: trackInfo.title || 'Unknown', artist: trackInfo.artist || '', album: trackInfo.album || '', cover: trackInfo.cover || null, src: obj })
  setSimLoading(true)
    } catch (e) {
      console.error('Fallback fetch failed', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCapture(blob) {
    setError(null)
    setError(null)
    setMood(null)
    setLoading(true)
    try {
      const res = await sendImageToApi(blob)

      // If sendImageToApi returned a blob+metadata (audio streamed in POST), handle it here
      if (res && res.blob && res.metadata) {
        const audioBlob = res.blob
        const md = res.metadata || {}
        setLastApiResponse({ type: 'audio-blob', metadata: md })
        // If the backend included a mood label in metadata, surface it
        setMood(md.mood || md.emotion || md.predicted_mood || null)
        const url = URL.createObjectURL(audioBlob)
        if (prevObjectUrl.current) {
          try { URL.revokeObjectURL(prevObjectUrl.current) } catch (e) {}
        }
        prevObjectUrl.current = url
  // queue or play depending on player state (playOrQueueTrack will set trackInfo if it plays immediately)
  playOrQueueTrack({ title: md.title || 'Generated track', artist: md.artist || '', album: md.album || '', cover: md.cover || null, src: url })
        return
      }

      // Otherwise fall back to previous behavior where res is a fetch Response
      if (res && res.headers) {
        const contentType = res.headers.get('content-type') || ''
        let audioBlob
        if (contentType.includes('application/json')) {
          const json = await res.json()
          setLastApiResponse(json)
          setMood(json.mood || json.emotion || json.predicted_mood || null)
          const fileUrl = json.file_url || json.url
            if (fileUrl) {
            if (prevObjectUrl.current) {
              try { URL.revokeObjectURL(prevObjectUrl.current) } catch (e) {}
              prevObjectUrl.current = null
            }
              // enqueue/play; only update trackInfo if player was idle and playOrQueueTrack started it immediately
              const metadata = { title: (json.track && json.track.name) || json.title || 'Generated track', artist: (json.track && json.track.artist) || json.artist || '', album: (json.track && json.track.album) || json.album || '', cover: json.cover || json.artwork || json.album_art || null }
              playOrQueueTrack({ ...metadata, src: fileUrl })
              // if the player was idle, playOrQueueTrack will have set trackInfo; otherwise leave it alone
              setSimLoading(true)
              setMood(json.mood || json.emotion || json.predicted_mood || null)
            return
          }
          setTrackInfo({ title: json.title || 'Generated track', artist: json.artist || '', album: json.album || '', cover: json.cover || json.artwork || json.album_art || null })
        } else if (contentType.startsWith('audio/') || contentType === 'application/octet-stream') {
          audioBlob = await res.blob()
          setLastApiResponse({ type: 'audio-blob' })
          setTrackInfo({ title: 'Generated track', artist: '', album: '', cover: null })
          // no mood provided in this response path
          setMood(null)
        } else {
          // fallback — try to parse json
          try {
            const json = await res.json()
            setLastApiResponse(json)
            if (json.url) {
              const fetched = await fetch(json.url)
              audioBlob = await fetched.blob()
              setTrackInfo({ title: json.title || 'Generated track', artist: json.artist || '', album: json.album || '', cover: json.cover || json.artwork || json.album_art || null })
              setMood(json.mood || json.emotion || json.predicted_mood || null)
            } else {
              throw new Error('Unexpected API response')
            }
          } catch (e) {
            throw new Error('Unsupported response from API')
          }
        }

        if (audioBlob) {
          const url = URL.createObjectURL(audioBlob)
          if (prevObjectUrl.current) {
            try { URL.revokeObjectURL(prevObjectUrl.current) } catch (e) {}
          }
          prevObjectUrl.current = url
          playOrQueueTrack({ title: 'Generated track', artist: '', album: '', cover: null, src: url })
        }
      }
    } catch (e) {
      console.error(e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function playAtIndex(i) {
    const item = history[i]
    if (!item) return
    setAudioSrc(item.src)
    setTrackInfo({ title: item.title || 'Track', artist: item.artist || '', album: item.album || '', cover: item.cover || null })
    setTimeout(() => playerRef.current?.play(), 100)
  }

  function playPrevious() {
    // find current index in history and play the next older item
    const idx = history.findIndex(h => h.src === audioSrc)
    if (idx === -1) return
    const nextIdx = Math.min(history.length - 1, idx + 1)
    playAtIndex(nextIdx)
  }

  function playNext() {
    const idx = history.findIndex(h => h.src === audioSrc)
    if (idx === -1) return
    const prevIdx = Math.max(0, idx - 1)
    playAtIndex(prevIdx)
  }

  // Auto-capture when time remaining reaches 60 seconds or less.
  useEffect(() => {
    let mounted = true
    const tick = async () => {
      try {
        if (!mounted) return
        const player = playerRef.current
        if (!player) return
        const isPlaying = player.isPlaying?.() || false
        if (!isPlaying) return
        const duration = player.getDuration?.() || 0
        const current = player.getCurrentTime?.() || 0
        if (!isFinite(duration) || duration <= 0) return
        const remaining = duration - current
        if (remaining <= 60) {
          // Only capture once per audio source
          const srcKey = audioSrc || ''
          if (srcKey && !capturedForRef.current.has(srcKey)) {
            // trigger webcam capture
            try {
              const blob = await webcamRef.current?.takePhoto?.()
              if (blob) {
                // mark captured for this src so we don't repeat
                capturedForRef.current.add(srcKey)
                // send to same handler as manual capture
                handleCapture(blob)
              }
            } catch (e) {
              console.error('Auto-capture failed', e)
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
    const id = setInterval(tick, 1000)
    return () => { mounted = false; clearInterval(id) }
  }, [audioSrc])

  // Handler called by Player when its cover changes
  function handlePlayerCoverChange(coverUrl) {
    try {
      if (!coverUrl) return
      setTrackInfo(current => {
        if (current && current.cover === coverUrl) return current
        return { ...(current || {}), cover: coverUrl }
      })
    } catch (e) {
      // ignore
    }
  }

  return (
    <div id="app-root" className="app-root">
      {(() => {
        const hasBuildInfo = buildInfo && buildInfo !== 'dev'
        const formattedBuild = hasBuildInfo ? formatBuildTimestamp(buildInfo) : null
        return (
          <div
            className={`version-badge ${showBuildTooltip ? 'show-tooltip' : ''}`}
            aria-hidden="true"
            role={hasBuildInfo ? 'button' : undefined}
            tabIndex={hasBuildInfo ? 0 : undefined}
            title={hasBuildInfo ? formattedBuild : undefined}
            onClick={hasBuildInfo ? (e) => { e.preventDefault(); setShowBuildTooltip(s => !s) } : undefined}
            onKeyDown={hasBuildInfo ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowBuildTooltip(s => !s) } } : undefined}
          >
            v{pkg.version}
            {hasBuildInfo && (
              <div className="version-tooltip" role="status">
                Built {formattedBuild}
              </div>
            )}
          </div>
        )
      })()}
      <main className="main">
        <section className="content-grid">
          <div className="capture-column">
            <header className="main-header">
              <h1>Módify</h1>
              <p style={{ margin: 0, padding: 0, opacity: 0.4, fontSize: 12 }}>Pronounced Moodify</p>
              <h2 style={{ marginTop: 0 }}>Music from your Mood</h2>
            </header>
            <div className="capture-card">
              <WebcamCapture ref={webcamRef} onCapture={handleCapture} disabled={loading} mood={mood} />
            {loading && (
              <div className="overlay upload-overlay">
                <div className="spinner" />
                <div className={`upload-text typewriter`}>{typedText || ''}</div>
              </div>
            )}
            {error && <div className="error">{error}</div>}
          </div>

          </div>

          <div className="player-card">
            <Player
              ref={playerRef}
              src={audioSrc}
              title={trackInfo.title}
              artist={trackInfo.artist}
              album={trackInfo.album}
              cover={trackInfo.cover}
              history={history}
              onPlayPrevious={playPrevious}
              onPlayNext={playNext}
              loading={simLoading}
              onCanPlay={() => {
                setSimLoading(false);
                setLoading(false);
                // Only auto-play if the audio wasn't the initial queued demo
                try {
                  const currentSrc = audioSrc || ''
                  if (!currentSrc.includes('raw.githubusercontent.com') || !demoQueuedRef.current) {
                    playerRef.current?.play()
                  }
                } catch (e) {
                  // ignore
                }
              }}
              onError={(err) => {
                setAudioError(err); setSimLoading(false); setLoading(false)
                // If unsupported format, try fetching as blob and playing via object URL (may work around some server issues)
                if (err && err.toLowerCase().includes('unsupported')) {
                  fetchAndUseBlob(audioSrc)
                }
              }}
              onPlay={() => {
                // when playback starts, clear demo queued flag
                demoQueuedRef.current = false
              }}
              onEnded={() => {
                // when current track ends, dequeue next track if available
                const next = queueRef.current.shift()
                if (next) {
                  setAudioSrc(next.src)
                  setTrackInfo({ title: next.title || 'Track', artist: next.artist || '', album: next.album || '', cover: next.cover || null })
                  setHistory(h => [{ title: next.title || 'Track', artist: next.artist || '', album: next.album || '', cover: next.cover || null, src: next.src, playedAt: Date.now() }, ...h].slice(0, 20))
                  // small timeout to allow audio element src to settle
                  setTimeout(() => playerRef.current?.play(), 120)
                }
              }}
              onCoverChange={handlePlayerCoverChange}
            />
          </div>

          <aside className="history-card">
            <h3>Previously played</h3>
            {/* Show the track that played immediately before the current one (history[1]) */}
            {(!history || history.length <= 1) ? (
              <div className="history-empty">No previous track</div>
            ) : (
              <ul className="history-list">
                {(() => {
                  const prev = history[1]
                  return (
                    <li key={prev.playedAt || 1} className="history-item" onClick={() => { playAtIndex(1) }}>
                      <div className="history-cover" style={{ backgroundImage: prev.cover ? `url(${prev.cover})` : undefined }} />
                      <div className="history-meta">
                        <div className="history-title">{prev.title}</div>
                        <div className="history-artist">{prev.artist}</div>
                      </div>
                    </li>
                  )
                })()}
              </ul>
            )}

            <div style={{ marginTop: '1rem' }}>
              <h3>Up Next</h3>
              {queue.length === 0 ? (
                <div className="history-empty">No tracks queued</div>
              ) : (
                <ul className="history-list">
                  {queue.slice(0,1).map((item, idx) => (
                    <li key={`${item.src}-${idx}`} className="history-item queue-item" title={`${item.title || 'Track'} — ${item.artist || ''}`} aria-label={`Queued: ${item.title || 'Track'} by ${item.artist || ''}`}>
                      {/* only show cover for queue items; title/artist available via tooltip (title attribute) for accessibility */}
                      <div className="history-cover queue-only-cover" style={{ backgroundImage: item.cover ? `url(${item.cover})` : undefined }} />
                      <div className="action-group">
                          <button className="boxed-btn" title="Play now" onClick={() => playNowFromQueue(idx)} aria-label="Play now"><PlayIcon size={22} color="#ffffff" /></button>
                          <button className="boxed-btn" title="Remove from queue" onClick={() => removeFromQueue(idx)} aria-label="Remove"><RemoveIcon size={20} color="#ffffff" /></button>
                        </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* <div className="debug-card">
            <h3>Debug</h3>
            <div><strong>API response:</strong></div>
            <pre className="debug-pre">{lastApiResponse ? JSON.stringify(lastApiResponse, null, 2) : '—'}</pre>
            <div><strong>Audio src:</strong> {audioSrc ? (<a href={audioSrc} target="_blank" rel="noreferrer">{audioSrc}</a>) : '—'}</div>
            <div><strong>Audio error:</strong> {audioError || '—'}</div>
          </div> */}
        </section>
      </main>
    </div>
  )
}

export default App
