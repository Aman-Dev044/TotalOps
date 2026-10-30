import { ImageResponse } from 'next/og';

export const alt = 'TotalOps — Window Tinting CRM with 3D Tint Visualizer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg,#0b0b1a 0%,#1e1b4b 55%,#4a044e 100%)', color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 84, height: 84, borderRadius: 22, background: 'linear-gradient(135deg,#5b5bf7,#c026d3,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, fontWeight: 800 }}>T</div>
          <div style={{ fontSize: 56, fontWeight: 800 }}>TotalOps</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 64, fontWeight: 800, lineHeight: 1.1, maxWidth: 1000 }}>The window tinting CRM with a 3D tint visualizer</div>
        <div style={{ marginTop: 28, fontSize: 30, color: '#c7c9ff' }}>Quotes · Bookings · Bays · Invoices · Film stock · Dealer portal · AI film advisor</div>
      </div>
    ),
    size,
  );
}
