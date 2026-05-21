export default function Slide07DataSafety() {
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
          Data Safety — Zero Tension
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
          flexDirection: "row",
          gap: "6vw",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", color: "#1C2541", fontSize: "0.85vw", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
            Cloud Version
          </div>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "0.4vw", backgroundColor: "#1C2541", flexShrink: 0, marginTop: "0.3vh", alignSelf: "stretch" }} />
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.6vh" }}>Automatic Cloud Backup</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.5 }}>Data hamesha secure — koi PC kharab ho, data safe rahega</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "0.4vw", backgroundColor: "#1C2541", flexShrink: 0, marginTop: "0.3vh", alignSelf: "stretch" }} />
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.6vh" }}>HTTPS Secure</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.5 }}>Encrypted connection — data kabhi leak nahi hoga</div>
            </div>
          </div>

          <div
            style={{
              marginTop: "2vh",
              backgroundColor: "#F5F7FA",
              padding: "3vh 2.5vw",
              borderLeft: "0.4vw solid #1C2541",
            }}
          >
            <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#1C2541" }}>JSON Backup bhi available</div>
            <div style={{ fontSize: "1vw", color: "#555555", marginTop: "0.8vh", lineHeight: 1.5 }}>Parties, items, vouchers — ek click download</div>
          </div>
        </div>

        <div style={{ width: "0.1vw", backgroundColor: "#E0E0E0" }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "0.85vw", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
            LAN Desktop Version
          </div>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "0.4vw", backgroundColor: "#E05C2A", flexShrink: 0, marginTop: "0.3vh", alignSelf: "stretch" }} />
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.6vh" }}>Daily Auto ZIP Backup</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.5 }}>Date-time stamp ke saath — last 7 backups auto-save</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "0.4vw", backgroundColor: "#E05C2A", flexShrink: 0, marginTop: "0.3vh", alignSelf: "stretch" }} />
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.6vh" }}>Login Se Pehle Restore</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.5 }}>ZIP file choose karo — kisi bhi PC pe exact data wapas</div>
            </div>
          </div>

          <div
            style={{
              marginTop: "2vh",
              backgroundColor: "#1C2541",
              padding: "3vh 2.5vw",
            }}
          >
            <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#FFFFFF" }}>Email ya pendrive pe bhi bhejo</div>
            <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.65)", marginTop: "0.8vh", lineHeight: 1.5 }}>Data aapka — aap decide karo kahan rakhna hai</div>
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
        <span>07</span>
      </div>
    </div>
  );
}
