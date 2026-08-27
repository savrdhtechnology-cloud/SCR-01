import Link from "next/link";

const APK_URL = "/api/download-apk";

export default function DownloadsPage() {
  return (
    <main className="download-page">
      <section className="download-card">
        <div className="download-logo" aria-hidden="true">S</div>
        <small>SAVRDH CREDIT RESOLUTION</small>
        <h1>Download Android App</h1>
        <p>Install the official customer application to access your credit report, raise requests, upload documents and connect with your advisor.</p>
        <div className="download-meta"><span>Android APK</span><span>Version 1.0.11</span><span>66.7 MB</span></div>
        <a className="download-primary" href={APK_URL}>Download APK ↓</a>
        <p className="download-note">पहले पुराना version uninstall करें। Download के बाद “Install unknown apps” permission allow करके नया APK install करें।</p>
        <Link className="download-back" href="/">← Back to Savrdh Credit Resolution</Link>
      </section>
    </main>
  );
}
