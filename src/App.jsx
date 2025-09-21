import React, { useState, useRef, useEffect } from 'react'
import './App.css'
import Player from './components/Player'
import { PlayIcon, RemoveIcon } from './components/Icons'
import WebcamCapture from './components/WebcamCapture'
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
  const playerRef = useRef()
  const prevObjectUrl = useRef(null)
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

  const loaderMessages = [
    'Uploading photo…',
    'Analyzing image…',
    'Calculating optimal song…',
    'Composing melody…',
    'Loading song…',
  ]
  // Refs to keep timers so we can clear them reliably
  const typingIntervalRef = useRef(null)
  const messageTimeoutRef = useRef(null)

  // Typewriter effect: progressively reveal characters for the current loader message,
  // then pause and advance to the next message while `loading` is true.
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

    // Configuration: pause after fully typed message
    const pauseAfterTyped = 1200

    let active = true

    // compute next index with simple wrap (include index 0 in rotation)
    const computeNext = (idx) => {
      const L = loaderMessages.length
      if (L <= 1) return 0
      return (idx + 1) % L
    }

    const typeMessage = (idx) => {
      if (!active) return
      clearTimers()
      const msg = loaderMessages[idx] || ''
      // slower typing: ms per char (longer = slower). Increased base to slow down animation.
      const speed = Math.max(60, Math.floor(140 - Math.min(80, msg.length)))

      let pos = 0
      setTypedText('')
      typingIntervalRef.current = setInterval(() => {
        if (!active) return
        pos += 1
        setTypedText(msg.slice(0, pos))
        if (pos >= msg.length) {
          clearTimers()
          // keep the fully typed message visible for a moment, then advance to next and type it
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

    // Start typing from the current loaderIndex (default 0) and cycle normally including index 0
    typeMessage(loaderIndex || 0)

    return () => {
      active = false
      clearTimers()
    }
  }, [loading])

  // When the cover changes, compute an average color and apply it as a CSS variable
  useEffect(() => {
    let cancelled = false
    async function computeAndSet() {
      const url = trackInfo?.cover
      if (!url) {
        // default tint (soft green)
        try {
          const root = document.getElementById('app-root')
          root?.style.setProperty('--tint-rgb', '29,185,84')
          // compute luminance and choose readable text color
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

        // draw into small canvas to sample pixels quickly
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
          // set readable header text color based on luminance
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
          root?.style.setProperty('--tint-text', lum > 150 ? '#0b0b0b' : '#ffffff')
        }
      } catch (e) {
        // If anything fails (CORS, decode), fallback to default tint
        try {
          const root = document.getElementById('app-root')
          root?.style.setProperty('--tint-rgb', '29,185,84')
          const r0 = 29, g0 = 185, b0 = 84
          const lum0 = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0
          root?.style.setProperty('--tint-text', lum0 > 150 ? '#0b0b0b' : '#ffffff')
        } catch (e) {}
      }
    }
    computeAndSet()
    return () => { cancelled = true }
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
    setLoading(true)
    try {
      const res = await sendImageToApi(blob)

      // If sendImageToApi returned a blob+metadata (audio streamed in POST), handle it here
      if (res && res.blob && res.metadata) {
        const audioBlob = res.blob
        const md = res.metadata || {}
        setLastApiResponse({ type: 'audio-blob', metadata: md })
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
            return
          }
          setTrackInfo({ title: json.title || 'Generated track', artist: json.artist || '', album: json.album || '', cover: json.cover || json.artwork || json.album_art || null })
        } else if (contentType.startsWith('audio/') || contentType === 'application/octet-stream') {
          audioBlob = await res.blob()
          setLastApiResponse({ type: 'audio-blob' })
          setTrackInfo({ title: 'Generated track', artist: '', album: '', cover: null })
        } else {
          // fallback — try to parse json
          try {
            const json = await res.json()
            setLastApiResponse(json)
            if (json.url) {
              const fetched = await fetch(json.url)
              audioBlob = await fetched.blob()
              setTrackInfo({ title: json.title || 'Generated track', artist: json.artist || '', album: json.album || '', cover: json.cover || json.artwork || json.album_art || null })
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

  return (
    <div id="app-root" className="app-root">
      <main className="main">
        <header className="main-header">
          <h1>EchoFrame</h1>
          <p>Take a photo, get a song</p>
        </header>

        <section className="content-grid">
          <div className="capture-card">
            <WebcamCapture onCapture={handleCapture} disabled={loading} />
            {loading && (
              <div className="overlay upload-overlay">
                <div className="spinner" />
                <div className={`upload-text typewriter`}>{typedText || ''}</div>
              </div>
            )}
            {error && <div className="error">{error}</div>}
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
