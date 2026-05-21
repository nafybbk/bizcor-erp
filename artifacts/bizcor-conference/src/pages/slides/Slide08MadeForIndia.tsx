export default function Slide08MadeForIndia() {
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
          Made for India — Sirf India Ke Liye
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
          gap: "6vw",
        }}
      >
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3vh 4vw" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>GST Structure</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1C2541" }}>0% to 28%</div>
              <div style={{ fontSize: "1vw", color: "#555555", lineHeight: 1.4 }}>Indian GST slabs built-in</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Language</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1C2541" }}>Hindi + English</div>
              <div style={{ fontSize: "1vw", color: "#555555", lineHeight: 1.4 }}>Interface dono mein</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Financial Year</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1C2541" }}>April — March</div>
              <div style={{ fontSize: "1vw", color: "#555555", lineHeight: 1.4 }}>Indian FY standard</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>GSTIN</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1C2541" }}>State-wise validation</div>
              <div style={{ fontSize: "1vw", color: "#555555", lineHeight: 1.4 }}>Auto party state detection</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1vh" }}>Banaya gaya in businesses ke liye</div>
          <div
            style={{
              backgroundColor: "#F5F7FA",
              padding: "3vh 2.5vw",
              borderLeft: "0.4vw solid #1C2541",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
            }}
          >
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1C2541" }}>Kapda merchants</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1C2541" }}>Traders aur distributors</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1C2541" }}>Manufacturers</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1C2541" }}>Service providers</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1C2541" }}>Retail shops</div>
          </div>
          <div
            style={{
              backgroundColor: "#1C2541",
              padding: "2.5vh 2.5vw",
            }}
          >
            <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#FFFFFF" }}>Support in Hindi</div>
            <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.65)", marginTop: "0.5vh" }}>WhatsApp + call — apni bhasha mein madad</div>
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
        <span>08</span>
      </div>
    </div>
  );
}
