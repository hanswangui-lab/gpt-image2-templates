export default function TermsPage() {
  return (
    <section className="section-panel" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="section-heading">
        <span className="eyebrow">Terms</span>
        <h2>服务条款</h2>
      </div>

      <div style={{ padding: '0 32px 32px', lineHeight: 1.8 }}>
        <h3>1. 服务说明</h3>
        <p>GPT Image 2 是一个 AI 图片生成平台，用户可以通过消耗积分使用 AI 生图服务。积分属于数字服务，已使用部分不支持退款。</p>

        <h3>2. 积分规则</h3>
        <p>积分通过充值获得，不同清晰度的图片消耗不同积分。积分长期有效，平台保留调整积分消耗规则的权利，调整前将提前公告。</p>

        <h3>3. 退款政策</h3>
        <p>重复扣款、积分未到账等系统问题会处理退款或补发积分。已使用积分不支持退款。</p>

        <h3>4. 用户行为</h3>
        <p>用户不得利用平台生成违法、违规内容。平台有权对违规账号采取限制措施，包括但不限于封禁账号、清除数据。</p>

        <h3>5. 数据与隐私</h3>
        <p>生成的图片在平台保留 48 小时，请及时下载。平台不会将用户生成的图片用于其他用途。</p>

        <h3>6. 服务变更</h3>
        <p>平台保留随时修改或中断服务的权利，无需对用户或第三方负责。如有疑问，请联系客服。</p>
      </div>
    </section>
  )
}
