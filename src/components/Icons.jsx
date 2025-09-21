import React from 'react'

export function PlayIcon({ size = 24, color = '#022' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" fill={color} />
    </svg>
  )
}

export function PauseIcon({ size = 18, color = '#022' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="6" y="5" width="4" height="14" fill={color} rx="1" />
      <rect x="14" y="5" width="4" height="14" fill={color} rx="1" />
    </svg>
  )
}

export function VolumeIcon({ size = 20, color = '#eaeaea', level = 1 }) {
  // level: 0..1 (0 = muted/no arcs, 1 = full 3 arcs)
  const arcs = Math.max(0, Math.min(3, Math.ceil(level * 3)))
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* speaker */}
      {/* <path d="M3 10v4h4l5 4V6L7 10H3z" fill={color} /> */}
      {/* arcs — drawn as stroked paths that are added/removed based on `arcs` */}
      {arcs == 0 && <path d="M16.93,4.1a1,1,0,0,0-1,.12L11.15,8H7.5a1,1,0,0,0-1,1v6a1,1,0,0,0,1,1h3.65l4.73,3.78a1,1,0,0,0,.62.22.91.91,0,0,0,.43-.1,1,1,0,0,0,.57-.9V5A1,1,0,0,0,16.93,4.1ZM15.5,16.92l-3.38-2.7A1,1,0,0,0,11.5,14h-3V10h3a1,1,0,0,0,.62-.22l3.38-2.7Z" stroke={color} fill={color}/>}
      {arcs == 1 && <path d="M18.83,9.17a1,1,0,1,0-1.42,1.42A2,2,0,0,1,18,12a2,2,0,0,1-.71,1.53,1,1,0,0,0-.13,1.41,1,1,0,0,0,1.41.12A4,4,0,0,0,20,12,4.06,4.06,0,0,0,18.83,9.17ZM14.43,4.1a1,1,0,0,0-1,.12L8.65,8H5A1,1,0,0,0,4,9v6a1,1,0,0,0,1,1H8.65l4.73,3.78A1,1,0,0,0,14,20a.91.91,0,0,0,.43-.1A1,1,0,0,0,15,19V5A1,1,0,0,0,14.43,4.1ZM13,16.92l-3.38-2.7A1,1,0,0,0,9,14H6V10H9a1,1,0,0,0,.62-.22L13,7.08Z" stroke={color} fill={color}/>}
      {arcs == 2 && <path d="M12.43,4.1a1,1,0,0,0-1,.12L6.65,8H3A1,1,0,0,0,2,9v6a1,1,0,0,0,1,1H6.65l4.73,3.78A1,1,0,0,0,12,20a.91.91,0,0,0,.43-.1A1,1,0,0,0,13,19V5A1,1,0,0,0,12.43,4.1ZM11,16.92l-3.38-2.7A1,1,0,0,0,7,14H4V10H7a1,1,0,0,0,.62-.22L11,7.08ZM19.66,6.34a1,1,0,0,0-1.42,1.42,6,6,0,0,1-.38,8.84,1,1,0,0,0,.64,1.76,1,1,0,0,0,.64-.23,8,8,0,0,0,.52-11.79ZM16.83,9.17a1,1,0,1,0-1.42,1.42A2,2,0,0,1,16,12a2,2,0,0,1-.71,1.53,1,1,0,0,0-.13,1.41,1,1,0,0,0,1.41.12A4,4,0,0,0,18,12,4.06,4.06,0,0,0,16.83,9.17Z" stroke={color} fill={color}/>}
      {arcs == 3 && <path d="M12.43,4.1a1,1,0,0,0-1,.12L6.65,8H3A1,1,0,0,0,2,9v6a1,1,0,0,0,1,1H6.65l4.73,3.78A1,1,0,0,0,12,20a.91.91,0,0,0,.43-.1A1,1,0,0,0,13,19V5A1,1,0,0,0,12.43,4.1ZM11,16.92l-3.38-2.7A1,1,0,0,0,7,14H4V10H7a1,1,0,0,0,.62-.22L11,7.08ZM15.14,4.09a1,1,0,1,0-.28,2,6,6,0,0,1,0,11.86,1,1,0,0,0,.14,2h.14a8,8,0,0,0,0-15.82Zm-.46,9.78a1,1,0,0,0,.32,2,1.13,1.13,0,0,0,.32-.05,4,4,0,0,0,0-7.54,1,1,0,0,0-.64,1.9,2,2,0,0,1,0,3.74Z" stroke={color} fill={color}/>}
    </svg>
  )
}

export function MuteIcon({ size = 18, color = '#eaeaea' }) {
  return ( 
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* <path d="M3 10v4h4l5 4V6L7 10H3z" fill={color} />
      <path d="M19 5L5 19" stroke={color} strokeWidth="2" strokeLinecap="round" /> */}
      <path d="M12.43,4.1a1,1,0,0,0-1,.12L6.65,8H3A1,1,0,0,0,2,9v6a1,1,0,0,0,1,1H6.65l4.73,3.78A1,1,0,0,0,12,20a.91.91,0,0,0,.43-.1A1,1,0,0,0,13,19V5A1,1,0,0,0,12.43,4.1ZM11,16.92l-3.38-2.7A1,1,0,0,0,7,14H4V10H7a1,1,0,0,0,.62-.22L11,7.08ZM19.91,12l1.8-1.79a1,1,0,0,0-1.42-1.42l-1.79,1.8-1.79-1.8a1,1,0,0,0-1.42,1.42L17.09,12l-1.8,1.79a1,1,0,0,0,0,1.42,1,1,0,0,0,1.42,0l1.79-1.8,1.79,1.8a1,1,0,0,0,1.42,0,1,1,0,0,0,0-1.42Z" stroke={color} fill={color}/>
    </svg>
  )
}

export function PrevIcon({ size = 18, color = '#eaeaea' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M20 6v12l-8.5-6L20 6zM11 6v12L2.5 12 11 6z" fill={color} />
    </svg>
  )
}

export function NextIcon({ size = 18, color = '#eaeaea' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M4 18l8.5-6L4 6v12zm9 0l8.5-6L13 6v12z" fill={color} />
    </svg>
  )
}

export function RemoveIcon({ size = 16, color = '#eaeaea' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M6 6 L18 18 M6 18 L18 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export default { PlayIcon, PauseIcon, VolumeIcon, MuteIcon, RemoveIcon }
