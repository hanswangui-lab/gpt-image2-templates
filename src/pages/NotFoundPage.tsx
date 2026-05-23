import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="section-panel" style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div className="section-heading">
        <span className="eyebrow">404</span>
        <h2>页面不存在</h2>
        <p>你访问的页面可能已被删除或移动。</p>
      </div>
      <div style={{ marginTop: 32 }}>
        <Link className="button primary" to="/">返回首页</Link>
      </div>
    </section>
  )
}
