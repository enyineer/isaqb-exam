/**
 * Generate OG image for social sharing.
 * Uses Satori (JSX → SVG) + @resvg/resvg-js (SVG → PNG).
 *
 * Run: bun run scripts/generateOGImage.ts
 */
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { join } from 'path'

const WIDTH = 1200
const HEIGHT = 630

/**
 * Fetch a Google Font as TTF ArrayBuffer.
 * Uses the Google Fonts static CDN directly for TTF files
 * (Satori's opentype.js requires TTF/woff — does not support woff2).
 */
async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`
  const cssRes = await fetch(url, {
    // Use a legacy User-Agent to get TTF format from Google Fonts
    headers: { 'User-Agent': 'Mozilla/4.0' },
  })
  const css = await cssRes.text()

  const match = css.match(/src:\s*url\(([^)]+)\)/)
  if (!match) throw new Error(`Could not find font URL for ${family}@${weight}`)
  const fontRes = await fetch(match[1])
  return fontRes.arrayBuffer()
}

async function main() {
  console.log('Loading fonts...')
  const [outfitBold, outfitMedium] = await Promise.all([
    loadFont('Outfit', 700),
    loadFont('Outfit', 500),
  ])

  console.log('Rendering OG image via Satori...')
  const svg = await satori(
    // Satori accepts plain objects at runtime, but its types expect ReactNode
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1E40AF 0%, #0F172A 100%)',
          fontFamily: 'Outfit',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          // Top-left decorative glow
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: '-120px',
                left: '-120px',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
              },
            },
          },
          // Bottom-right decorative glow
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: '-100px',
                right: '-100px',
                width: '350px',
                height: '350px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(14,165,233,0.25) 0%, transparent 70%)',
              },
            },
          },
          // Content container
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              },
              children: [
                // Icon container
                {
                  type: 'div',
                  props: {
                    style: {
                      width: '88px',
                      height: '88px',
                      borderRadius: '20px',
                      background: 'linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '32px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                    },
                    children: [
                      // Graduation cap SVG
                      {
                        type: 'svg',
                        props: {
                          width: '44',
                          height: '44',
                          viewBox: '0 0 24 24',
                          fill: 'none',
                          stroke: 'white',
                          'stroke-width': '2',
                          'stroke-linecap': 'round',
                          'stroke-linejoin': 'round',
                          children: [
                            { type: 'path', props: { d: 'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z' } },
                            { type: 'path', props: { d: 'M22 10v6' } },
                            { type: 'path', props: { d: 'M6 12.5V16a6 3 0 0 0 12 0v-3.5' } },
                          ],
                        },
                      },
                    ],
                  },
                },
                // Title
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '64px',
                      fontWeight: 700,
                      color: 'white',
                      lineHeight: 1.1,
                      textAlign: 'center',
                      letterSpacing: '-0.02em',
                    },
                    children: 'iSAQB CPSA-F',
                  },
                },
                // Subtitle
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '52px',
                      fontWeight: 700,
                      background: 'linear-gradient(90deg, #7DD3FC 0%, #0EA5E9 100%)',
                      backgroundClip: 'text',
                      color: 'transparent',
                      lineHeight: 1.2,
                      textAlign: 'center',
                      marginTop: '4px',
                    },
                    children: 'Mock Exam',
                  },
                },
                // Divider
                {
                  type: 'div',
                  props: {
                    style: {
                      width: '80px',
                      height: '3px',
                      background: 'linear-gradient(90deg, transparent, #3B82F6, transparent)',
                      borderRadius: '2px',
                      margin: '28px 0',
                    },
                  },
                },
                // Tagline
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '22px',
                      fontWeight: 500,
                      color: 'rgba(203, 213, 225, 0.9)',
                      textAlign: 'center',
                      lineHeight: 1.5,
                      maxWidth: '650px',
                    },
                    children: 'Practice for the Certified Professional for Software Architecture — Foundation Level',
                  },
                },
              ],
            },
          },
          // Bottom subtle border
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, transparent, #3B82F6, #0EA5E9, transparent)',
              },
            },
          },
        ],
      },
    } as any,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: 'Outfit', data: outfitBold, weight: 700, style: 'normal' as const },
        { name: 'Outfit', data: outfitMedium, weight: 500, style: 'normal' as const },
      ],
    },
  )

  console.log('Converting SVG → PNG...')
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
  })
  const png = resvg.render().asPng()

  const outPath = join(import.meta.dir, '..', 'public', 'og-image.png')
  await Bun.write(outPath, png)
  console.log(`✅ OG image generated → ${outPath} (${(png.byteLength / 1024).toFixed(1)} KB)`)
}

main().catch(console.error)
