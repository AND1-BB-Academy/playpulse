export default function Contact() {
  return (
    <div className="legal-page">
      <h1>お問い合わせ</h1>

      <p>
        PlayPulseに関するご質問、ご要望、不具合報告は、
        YouTubeチャンネルのコメント欄よりご連絡ください。
      </p>

      <div
        style={{
          marginTop: '24px',
          padding: '16px',
          border: '1px solid #c8912d',
          borderRadius: '12px',
        }}
      >
        <strong>YouTubeチャンネル</strong>

        <p style={{ marginTop: '8px' }}>
          <a
            href="https://www.youtube.com/channel/UC9eZZ9QcYR0rtALqXH7_3SQ"
            target="_blank"
            rel="noreferrer"
          >
            AND1 バスケアカデミー
          </a>
        </p>
      </div>

      <p style={{ marginTop: '24px' }}>
        不具合報告の際は、
        ご利用環境（PC・Mac・ブラウザ等）や
        発生手順を記載いただけると助かります。
      </p>
    </div>
  )
}