import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at top, #fffaf3 0%, #f5e8d4 42%, #ead4b3 100%)",
          color: "#111827",
          padding: "48px 56px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(145deg, #7c2d12 0%, #b45309 60%, #f59e0b 100%)",
              color: "#fffaf3",
              fontSize: 46,
              fontWeight: 800,
              letterSpacing: 1,
              boxShadow: "0 18px 32px rgba(124, 45, 18, 0.18)",
            }}
          >
            RC
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#0f766e",
                textTransform: "uppercase",
                letterSpacing: 3,
              }}
            >
              RoleCraft AI
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "#57534e",
              }}
            >
              Career Studio + Trusted Referral Network
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 920,
          }}
        >
          <div
            style={{
              fontSize: 72,
              lineHeight: 1.04,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            Resume building, interview prep, and private referral support.
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.35,
              color: "#44403c",
            }}
          >
            RoleCraft AI helps professionals tailor applications, prepare faster, and request trusted introductions through a moderated career network.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#57534e",
            borderTop: "1px solid rgba(146, 64, 14, 0.16)",
            paddingTop: 22,
          }}
        >
          <div>rolecraftai.duckdns.org</div>
          <div style={{ color: "#0f766e", fontWeight: 700 }}>Career Network • Status Tracking • Privacy First</div>
        </div>
      </div>
    ),
    size,
  );
}
