export default function Slide05GST() {
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
          GST — 100% Ready
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
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "0.4vw", height: "4vh", backgroundColor: "#E05C2A", flexShrink: 0, marginTop: "0.3vh" }} />
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.5vh" }}>GSTR-1 Auto Generate</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.5 }}>B2B aur B2C breakdown — ek click mein ready</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "0.4vw", height: "4vh", backgroundColor: "#E05C2A", flexShrink: 0, marginTop: "0.3vh" }} />
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.5vh" }}>GSTR-3B — Net Payable</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.5 }}>Output tax vs ITC, net GST payable auto calculate</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "0.4vw", height: "4vh", backgroundColor: "#E05C2A", flexShrink: 0, marginTop: "0.3vh" }} />
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.5vh" }}>JSON Export</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.5 }}>Seedha GST portal pe upload — manual entry zero</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "0.4vw", height: "4vh", backgroundColor: "#1C2541", flexShrink: 0, marginTop: "0.3vh" }} />
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.5vh" }}>Intra + Inter State Auto</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.5 }}>CGST+SGST ya IGST — party ki state se auto decide</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <div
            style={{
              backgroundColor: "#F5F7FA",
              padding: "3.5vh 3vw",
              borderTop: "0.4vh solid #1C2541",
            }}
          >
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2vh" }}>GST Rates Supported</div>
            <div style={{ display: "flex", gap: "1.5vw", flexWrap: "wrap" }}>
              <div style={{ fontSize: "2vw", fontWeight: 800, color: "#1C2541" }}>0%</div>
              <div style={{ fontSize: "2vw", fontWeight: 800, color: "#1C2541" }}>5%</div>
              <div style={{ fontSize: "2vw", fontWeight: 800, color: "#1C2541" }}>12%</div>
              <div style={{ fontSize: "2vw", fontWeight: 800, color: "#E05C2A" }}>18%</div>
              <div style={{ fontSize: "2vw", fontWeight: 800, color: "#1C2541" }}>28%</div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#F5F7FA",
              padding: "3.5vh 3vw",
              borderTop: "0.4vh solid #E05C2A",
            }}
          >
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>CA ko dena?</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", lineHeight: 1.4 }}>
              Ek click — report ready.
            </div>
            <div style={{ fontSize: "1vw", color: "#555555", marginTop: "1vh", lineHeight: 1.5 }}>HSN/SAC codes, GSTIN validation, GST-inclusive toggle</div>
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
        <span>05</span>
      </div>
    </div>
  );
}
