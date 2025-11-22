// You can override this by setting window.__API_ENDPOINT__ before the app loads.
// Ensure the API allows CORS from your dev origin (http://localhost:5173).

// apiurl = 'https://9fad54828c15.ngrok-free.app/'

// const API_ENDPOINT = window.__API_ENDPOINT__ || 'https://21e5329a1d62.ngrok-free.app/'  // This is the real API URL
const API_ENDPOINT = window.__API_ENDPOINT__ || 'https://tricklingly-panatrophic-florencia.ngrok-free.dev'

export async function sendImageToApi(imageBlob) {
  const form = new FormData()
  // Flask endpoint expects the field named 'photo'
  form.append('photo', imageBlob, 'photo.jpg')

  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    body: form,
    headers: {
      'X-Return-Audio': '1'
    },
  })

  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch (e) { /* ignore */ }
    throw new Error(`API request failed: ${res.status} ${res.statusText} - ${body}`)
  }
  // If the server streamed audio back in the POST, also read metadata headers we expose
  const contentType = res.headers.get('content-type') || ''
  if (contentType.startsWith('audio/') || contentType === 'application/octet-stream') {
    const blob = await res.blob()
    const metadata = {
      title: res.headers.get('X-Track-Title') || '',
      artist: res.headers.get('X-Track-Artist') || '',
      album: res.headers.get('X-Track-Album') || '',
      cover: res.headers.get('X-Track-Cover') || ''
    }
    return { blob, metadata }
  }

  // Otherwise return the raw response so caller can parse JSON
  return res
}

export default { sendImageToApi }

export async function requestTrack(artist, title) {
  const payload = { artist: artist || '', title: title || '' }

  const base = (API_ENDPOINT || '').replace(/\/+$/, '')
  const url = `${base}/request_song`

  // First, request JSON metadata from /request_song. Prefer a returned `file_url`.
  const metaRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!metaRes.ok) {
    let body = ''
    try { body = await metaRes.text() } catch (e) { /* ignore */ }
    throw new Error(`API metadata request failed: ${metaRes.status} ${metaRes.statusText} - ${body}`)
  }

  const contentType = (metaRes.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('application/json')) {
    const json = await metaRes.json()
    if (json.error) throw new Error(`API error: ${json.error}`)
    const fileUrl = json.file_url || json.url
    if (fileUrl) {
      const metadata = {
          title: json.track?.name || json.title || title || '',
          artist: json.track?.artist || json.artist || artist || '',
          album: json.track?.album || json.album || '',
          cover: json.cover || json.artwork || json.album_art || (json.track && json.track.album && json.track.album.images && json.track.album.images[0] ? json.track.album.images[0].url : '')
        }
      return { type: 'file', url: fileUrl, metadata }
    }
    // otherwise fall through to attempt streaming in POST response
  }

  // Fallback: ask the server to stream audio in the POST response
  const streamRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Return-Audio': '1' },
    body: JSON.stringify(payload)
  })

  if (!streamRes.ok) {
    let body = ''
    try { body = await streamRes.text() } catch (e) { /* ignore */ }
    throw new Error(`API stream request failed: ${streamRes.status} ${streamRes.statusText} - ${body}`)
  }

  const streamCt = (streamRes.headers.get('content-type') || '').toLowerCase()
  if (streamCt.startsWith('audio/') || streamCt === 'application/octet-stream') {
    const blob = await streamRes.blob()
    const metadata = {
      title: streamRes.headers.get('X-Track-Title') || title || '',
      artist: streamRes.headers.get('X-Track-Artist') || artist || '',
      album: streamRes.headers.get('X-Track-Album') || '',
      cover: streamRes.headers.get('X-Track-Cover') || ''
    }
    return { type: 'stream', blob, metadata }
  }

  let body = ''
  try { body = await streamRes.text() } catch (e) { /* ignore */ }
  throw new Error(`API stream response was not audio: ${streamCt} - ${body}`)
  }

