export default function Slide03TwoVersions() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#FFFFFF",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: "#333333",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: "15vh",
          backgroundColor: "#1C2541",
          color: "#FFFFFF",
          padding: "4vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ fontSize: "2.5vw", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
          Do Versions, Ek Solution
        </h2>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.9vw", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          bizcor erp
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "6vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "row",
          gap: "4vw",
        }}
      >
        <div
          style={{
            flex: 1,
            backgroundColor: "#F5F7FA",
            padding: "5vh 4vw",
            borderTop: "0.5vh solid #1C2541",
            display: "flex",
            flexDirection: "column",
            gap: "3vh",
          }}
        >
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.85vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>Version 01</div>
            <div style={{ fontSize: "2.8vw", fontWeight: 800, color: "#1C2541", lineHeight: 1.1, marginBottom: "1vh" }}>Cloud Version</div>
            <div style={{ fontSize: "1.3vw", fontWeight: 500, color: "#555555" }}>Internet se kaam karo — kahin bhi, kabhi bhi</div>
          </div>

          <div style={{ width: "100%", height: "0.1vh", backgroundColor: "#E0E0E0" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "1.8vh" }}>
            <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#1C2541", borderRadius: "50%", marginTop: "0.8vh", flexShrink: 0 }} />
              <span style={{ fontSize: "1.2vw", color: "#333333", lineHeight: 1.5 }}>Phone, tablet, laptop — koi bhi device</span>
            </div>
            <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#1C2541", borderRadius: "50%", marginTop: "0.8vh", flexShrink: 0 }} />
              <span style={{ fontSize: "1.2vw", color: "#333333", lineHeight: 1.5 }}>Real-time multi-user — staff kahin se bhi</span>
            </div>
            <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#1C2541", borderRadius: "50%", marginTop: "0.8vh", flexShrink: 0 }} />
              <span style={{ fontSize: "1.2vw", color: "#333333", lineHeight: 1.5 }}>Automatic backup, HTTPS secure</span>
            </div>
            <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#1C2541", borderRadius: "50%", marginTop: "0.8vh", flexShrink: 0 }} />
              <span style={{ fontSize: "1.2vw", color: "#333333", lineHeight: 1.5 }}>Koi installation nahi — browser se</span>
            </div>
          </div>

          <div style={{ marginTop: "auto", fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#888888", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Best for: Multiple locations, internet users
          </div>
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: "#1C2541",
            padding: "5vh 4vw",
            borderTop: "0.5vh solid #E05C2A",
            display: "flex",
            flexDirection: "column",
            gap: "3vh",
            color: "#FFFFFF",
          }}
        >
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.5)", fontSize: "0.85vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>Version 02</div>
            <div style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", lineHeight: 1.1, marginBottom: "1vh" }}>LAN Version</div>
            <div style={{ fontSize: "1.3vw", fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>Apna server, apna data — internet ki zaroorat nahi</div>
          </div>

          <div style={{ width: "100%", height: "0.1vh", backgroundColor: "rgba(255,255,255,0.15)" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "1.8vh" }}>
            <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#E05C2A", borderRadius: "50%", marginTop: "0.8vh", flexShrink: 0 }} />
              <span style={{ fontSize: "1.2vw", color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>Internet ki zaroorat NAHI — sirf WiFi</span>
            </div>
            <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#E05C2A", borderRadius: "50%", marginTop: "0.8vh", flexShrink: 0 }} />
              <span style={{ fontSize: "1.2vw", color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>EXE installer — ek click setup</span>
            </div>
            <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#E05C2A", borderRadius: "50%", marginTop: "0.8vh", flexShrink: 0 }} />
              <span style={{ fontSize: "1.2vw", color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>Data aapke paas — cloud pe kabhi nahi</span>
            </div>
            <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#E05C2A", borderRadius: "50%", marginTop: "0.8vh", flexShrink: 0 }} />
              <span style={{ fontSize: "1.2vw", color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>10+ devices ek saath same network pe</span>
            </div>
          </div>

          <div style={{ marginTop: "auto", fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Best for: Shops, factories, godowns
          </div>
        </div>
      </div>

      <div
        style={{
          height: "8vh",
          padding: "0 8vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "0.1vh solid #E0E0E0",
          fontFamily: "'DM Mono', monospace",
          fontSize: "0.8vw",
          color: "#888888",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <span>NAEWTGROUP.COM</span>
        <span>03</span>
      </div>
    </div>
  );
}
