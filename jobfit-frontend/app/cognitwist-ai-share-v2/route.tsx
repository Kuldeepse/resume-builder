import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #fffaf0 0%, #f8f1df 55%, #e3f1ec 100%)',
          color: '#062f32',
          fontFamily: 'Arial, sans-serif',
          padding: '58px 64px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: '-150px',
            bottom: '-210px',
            width: '720px',
            height: '720px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #0f766e 0%, #064e4a 72%, #032f31 100%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '-60px',
            top: '40px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            border: '4px solid rgba(217,119,6,0.65)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '86px',
            bottom: '84px',
            width: '210px',
            height: '210px',
            borderRadius: '50%',
            background: '#fff4d6',
            boxShadow: '0 0 70px rgba(245,158,11,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '13px', height: '95px' }}>
            <div style={{ width: '25px', height: '38px', borderRadius: '7px 7px 0 0', background: '#0f766e' }} />
            <div style={{ width: '25px', height: '58px', borderRadius: '7px 7px 0 0', background: '#0f766e' }} />
            <div style={{ width: '25px', height: '82px', borderRadius: '7px 7px 0 0', background: '#0f766e' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', width: '820px', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <div
              style={{
                width: '122px',
                height: '122px',
                borderRadius: '30px',
                background: 'linear-gradient(145deg, #0f766e 0%, #064e4a 100%)',
                boxShadow: '0 18px 35px rgba(6,78,74,0.20)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '50px',
                fontWeight: 800,
                color: '#ffffff',
              }}
            >
              <span>CT</span>
            </div>
            <div style={{ display: 'flex', fontSize: '70px', fontWeight: 800, letterSpacing: '-3px' }}>
              CogniTwist AI
            </div>
          </div>

          <div style={{ width: '90px', height: '5px', borderRadius: '999px', background: '#d97706', marginTop: '18px', marginLeft: '158px' }} />

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '32px' }}>
            <div style={{ display: 'flex', fontSize: '47px', lineHeight: 1.08, fontWeight: 800, color: '#0f766e' }}>
              Career Intelligence and
            </div>
            <div style={{ display: 'flex', fontSize: '47px', lineHeight: 1.08, fontWeight: 800, color: '#0f766e' }}>
              Trusted Connections
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '31px', gap: '8px', color: '#334155', fontSize: '25px' }}>
            <div style={{ display: 'flex' }}>Build stronger applications • Prepare for interviews •</div>
            <div style={{ display: 'flex' }}>Join a private referral network</div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginTop: '34px' }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '2px solid #9cc9c1', background: 'rgba(238,249,246,0.92)', borderRadius: '999px', padding: '16px 28px', fontSize: '23px', fontWeight: 700, color: '#064e4a' }}>
              Career Studio
            </div>
            <div style={{ display: 'flex', alignItems: 'center', border: '2px solid #9cc9c1', background: 'rgba(238,249,246,0.92)', borderRadius: '999px', padding: '16px 28px', fontSize: '23px', fontWeight: 700, color: '#064e4a' }}>
              Career Network
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
}
