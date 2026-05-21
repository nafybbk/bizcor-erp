export default function Slide04Comparison() {
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
          Cloud vs LAN — Feature Comparison
        </h2>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.9vw", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          bizcor erp
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "5vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "0",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr",
            padding: "1.5vh 0",
            borderBottom: "0.25vh solid #1C2541",
            fontFamily: "'DM Mono', monospace",
            fontSize: "0.85vw",
            color: "#888888",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          <div>Feature</div>
          <div style={{ color: "#1C2541", fontWeight: 600 }}>Cloud</div>
          <div style={{ color: "#E05C2A", fontWeight: 600 }}>LAN Desktop</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "2vh 0", borderBottom: "0.1vh solid #E0E0E0", alignItems: "center" }}>
            <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#1C2541" }}>Internet</div>
            <div style={{ fontSize: "1.1vw", color: "#555555" }}>Zaroori</div>
            <div style={{ fontSize: "1.1vw", color: "#E05C2A", fontWeight: 600 }}>Nahi chahiye</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "2vh 0", borderBottom: "0.1vh solid #E0E0E0", alignItems: "center" }}>
            <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#1C2541" }}>Data Location</div>
            <div style={{ fontSize: "1.1vw", color: "#555555" }}>Cloud Server</div>
            <div style={{ fontSize: "1.1vw", color: "#E05C2A", fontWeight: 600 }}>Aapka PC</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "2vh 0", borderBottom: "0.1vh solid #E0E0E0", alignItems: "center" }}>
            <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#1C2541" }}>Multi-device</div>
            <div style={{ fontSize: "1.1vw", color: "#555555" }}>Haan</div>
            <div style={{ fontSize: "1.1vw", color: "#555555" }}>Haan (LAN)</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "2vh 0", borderBottom: "0.1vh solid #E0E0E0", alignItems: "center" }}>
            <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#1C2541" }}>Auto Backup</div>
            <div style={{ fontSize: "1.1vw", color: "#555555" }}>Cloud mein</div>
            <div style={{ fontSize: "1.1vw", color: "#555555" }}>Daily ZIP (7 din)</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "2vh 0", borderBottom: "0.1vh solid #E0E0E0", alignItems: "center" }}>
            <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#1C2541" }}>Setup</div>
            <div style={{ fontSize: "1.1vw", color: "#555555" }}>Browser — seedha</div>
            <div style={{ fontSize: "1.1vw", color: "#555555" }}>EXE installer</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "2vh 0", borderBottom: "0.1vh solid #E0E0E0", alignItems: "center" }}>
            <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#1C2541" }}>Speed</div>
            <div style={{ fontSize: "1.1vw", color: "#555555" }}>Net speed</div>
            <div style={{ fontSize: "1.1vw", color: "#E05C2A", fontWeight: 600 }}>LAN speed (bahut fast)</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "2vh 0", borderBottom: "0.1vh solid #E0E0E0", alignItems: "center" }}>
            <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#1C2541" }}>Offline Mode</div>
            <div style={{ fontSize: "1.1vw", color: "#888888" }}>—</div>
            <div style={{ fontSize: "1.1vw", color: "#E05C2A", fontWeight: 600 }}>Full offline</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "2vh 0", alignItems: "center" }}>
            <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#1C2541" }}>Pricing</div>
            <div style={{ fontSize: "1.1vw", color: "#555555" }}>Subscription</div>
            <div style={{ fontSize: "1.1vw", color: "#555555" }}>Voucher validity</div>
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
        <span>04</span>
      </div>
    </div>
  );
}
