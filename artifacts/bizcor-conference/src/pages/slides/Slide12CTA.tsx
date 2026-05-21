export default function Slide12CTA() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#1C2541",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: "#FFFFFF",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "0",
          left: "0",
          right: "0",
          bottom: "0",
          background: "radial-gradient(ellipse at 75% 50%, rgba(224,92,42,0.08) 0%, transparent 60%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: "-8vw",
          left: "-4vw",
          width: "20vw",
          height: "20vw",
          borderRadius: "50%",
          border: "0.15vw solid rgba(255,255,255,0.06)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-6vw",
          right: "-3vw",
          width: "16vw",
          height: "16vw",
          borderRadius: "50%",
          border: "0.15vw solid rgba(255,255,255,0.05)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4vh",
          maxWidth: "65vw",
        }}
      >
        <div style={{ fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.85vw", textTransform: "uppercase", letterSpacing: "0.15em" }}>
          Shuru Karein Aaj Se
        </div>

        <h2
          style={{
            fontSize: "5vw",
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: "#FFFFFF",
          }}
        >
          BizCor ERP
        </h2>

        <p style={{ fontSize: "1.6vw", color: "rgba(255,255,255,0.65)", margin: 0, lineHeight: 1.5 }}>
          30 din FREE trial — koi card nahi chahiye
        </p>

        <div style={{ width: "4vw", height: "0.3vh", backgroundColor: "#E05C2A" }} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "3vh 6vw",
            fontFamily: "'DM Mono', monospace",
            fontSize: "1vw",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Cloud Version</span>
            <span style={{ fontWeight: 500, color: "#FFFFFF" }}>erp.naewtgroup.com</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Support</span>
            <span style={{ fontWeight: 500, color: "#FFFFFF" }}>WhatsApp + Call</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>LAN EXE</span>
            <span style={{ fontWeight: 500, color: "#FFFFFF" }}>Download from portal</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Email</span>
            <span style={{ fontWeight: 500, color: "#FFFFFF" }}>support@naewtgroup.com</span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "8vh",
          padding: "0 8vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "0.1vh solid rgba(255,255,255,0.1)",
          fontFamily: "'DM Mono', monospace",
          fontSize: "0.8vw",
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <span>Powered by NAEWTGROUP.COM</span>
        <span>12</span>
      </div>
    </div>
  );
}
