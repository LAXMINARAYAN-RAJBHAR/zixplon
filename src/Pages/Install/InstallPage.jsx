import { useEffect } from "react";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";

export default function InstallPage() {
  const { canInstall, isInstalled, isIOS, install } = useInstallPrompt();

  useEffect(() => {
    document.title = "Install ZIXPLON";
  }, []);

  return (
    <div
      style={{
        minHeight: "calc(100vh - 56px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        paddingTop: 80,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <h1>Install ZIXPLON</h1>

        {isInstalled && <p>ZIXPLON is already installed on this device. 🎉</p>}

        {!isInstalled && canInstall && (
          <>
            <p>Get the full app experience. Tap below to install.</p>
            <button
              onClick={install}
              style={{
                padding: "14px 28px",
                fontSize: 18,
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                background: "#CC0000",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              Install App
            </button>
          </>
        )}

        {!isInstalled && !canInstall && isIOS && (
          <p>
            On iPhone/iPad: open this page in <b>Safari</b>, tap the <b>Share</b>{" "}
            icon, then choose <b>Add to Home Screen</b>.
          </p>
        )}

        {!isInstalled && !canInstall && !isIOS && (
          <p>
            Open this link in Chrome, Edge or Samsung Internet. If you don't see
            the install button, use the browser menu (⋮) and choose{" "}
            <b>Install app</b> or <b>Add to Home screen</b>.
          </p>
        )}
      </div>
    </div>
  );
}