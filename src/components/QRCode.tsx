/**
 * Client-side QR code generator using the `qrcode` library.
 * Renders as an <img> tag with a data URL for easy right-click copy.
 */

import { useState, useEffect } from 'react'
import QRCodeLib from 'qrcode'

// ─── Component ───────────────────────────────────────────────────────

interface QRCodeProps {
  /** Data to encode (typically a URL) */
  value: string
  /** Image size in pixels */
  size?: number
  /** CSS class name */
  className?: string
}

/**
 * Renders a scannable QR code as an <img> element.
 * Uses the `qrcode` library for standards-compliant encoding with
 * proper error correction, quiet zone, and non-inverted colors.
 */
export function QRCode({ value, size = 200, className = '' }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('')

  useEffect(() => {
    QRCodeLib.toDataURL(value, {
      width: size,
      margin: 4,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(''))
  }, [value, size])

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        role="img"
        aria-label={`QR Code for ${value}`}
      />
    )
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      alt={`QR Code for ${value}`}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
