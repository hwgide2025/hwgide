// You can override this by setting window.__API_ENDPOINT__ before the app loads.
// Ensure the API allows CORS from your dev origin (http://localhost:5173).

// apiurl = 'https://9fad54828c15.ngrok-free.app/'

const API_ENDPOINT = window.__API_ENDPOINT__ || 'https://85fb7c1c5850.ngrok-free.app/'

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
