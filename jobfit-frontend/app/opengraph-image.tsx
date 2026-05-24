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
          padding: "56px 64px",
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
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#92400e",
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              RoleCraft AI
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#57534e",
              }}
            >
              Kuldeep Sharma
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
              lineHeight: 1.02,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            AI Career Platform for resumes, interviews, and job discovery.
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.35,
              color: "#44403c",
            }}
          >
            Tailor resumes to job descriptions, generate interview prep, and find relevant roles from one polished workflow.
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
          <div>jobfitcareer.vercel.app</div>
          <div style={{ color: "#92400e", fontWeight: 700 }}>RoleCraft AI</div>
        </div>
      </div>
    ),
    size,
  );
}
