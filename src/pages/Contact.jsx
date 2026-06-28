export default function Contact() {
  return (
    <div className="legal-page">
      <h1>お問い合わせ</h1>

      <p>
        PlayPulseに関するご質問、ご要望、不具合報告、有料プラン・解約・返金に関する
        お問い合わせは、以下のメールアドレスまたはYouTubeチャンネルよりご連絡ください。
      </p>

      <div
        style={{
          marginTop: '24px',
          padding: '16px',
          border: '1px solid #c8912d',
          borderRadius: '12px',
        }}
      >
        <strong>メールでのお問い合わせ</strong>

        <p style={{ marginTop: '8px' }}>
          <a href="mailto:AND1BBAcademy@gmail.com">
            AND1BBAcademy@gmail.com
          </a>
        </p>

        <p style={{ marginTop: '8px' }}>
          有料プランに関するお問い合わせの際は、Googleログインで使用したメールアドレス、
          発生日時、状況を記載してください。クレジットカード番号、パスワード、
          セキュリティコード等は送信しないでください。
        </p>
      </div>

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

      <h2 style={{ marginTop: '32px' }}>不具合報告について</h2>
      <p>
        不具合報告の際は、以下の情報を記載いただけると確認がスムーズです。
      </p>
      <ul>
        <li>ご利用環境（PC・Mac・iPad・スマートフォン等）</li>
        <li>ブラウザ名（Chrome、Safari、Edge等）</li>
        <li>無料プランまたは有料プランのどちらを利用中か</li>
        <li>発生した操作手順</li>
        <li>エラー表示や画面の状態</li>
      </ul>

      <h2>返信について</h2>
      <p>
        すべてのお問い合わせに返信を保証するものではありませんが、
        有料プラン、決済、不具合に関する内容は優先して確認します。
      </p>
    </div>
  )
}
