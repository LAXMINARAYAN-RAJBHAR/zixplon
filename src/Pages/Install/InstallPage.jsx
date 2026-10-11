import { useEffect } from "react";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";

export default function InstallPage() {
  const { canInstall, isInstalled, installedInBrowser, ready, isIOS, install } =
    useInstallPrompt();

  useEffect(() => {
    document.title = "Install ZIXPLON";
  }, []);

  const showChecking = !isInstalled && !canInstall && !installedInBrowser && !ready;
  const showAlreadyInstalled = !isInstalled && !canInstall && installedInBrowser;
  const showIOS = !isInstalled && !canInstall && !installedInBrowser && ready && isIOS;
  const showFallback = !isInstalled && !canInstall && !installedInBrowser && ready && !isIOS;

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
        <h1 style={{ marginBottom: 12 }}>Install ZIXPLON</h1>

        {isInstalled && <p>ZIXPLON is already installed on this device. 🎉</p>}

        {canInstall && !isInstalled && (
          <>
            <p style={{ marginBottom: 20 }}>
              Get the full app experience. Tap below to install.
            </p>
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

        {showChecking && <p>Checking install status…</p>}

        {showAlreadyInstalled && (
          <p>
            ZIXPLON looks like it's already installed on this device. Open it
            from your home screen or app list, or use the <b>Open in app</b>{" "}
            icon in your browser's address bar.
          </p>
        )}

        {showIOS && (
          <p>
            On iPhone/iPad: open this page in <b>Safari</b>, tap the <b>Share</b>{" "}
            icon, then choose <b>Add to Home Screen</b>.
          </p>
        )}

        {showFallback && (
          <p>
            Open this link in Chrome, Edge or Samsung Internet. If you don't see
            the install button, use the browser menu (⋮) and choose{" "}
            <b>Install app</b> or <b>Add to Home screen</b>. If ZIXPLON is
            already installed, open it from your app list instead.
          </p>
        )}
      </div>
    </div>
  );
}