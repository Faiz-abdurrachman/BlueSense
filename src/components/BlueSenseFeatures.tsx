import { useEffect } from 'react'

/* ============================================================
   HOW IT WORKS SECTION
   ============================================================ */
function HowItWorksSection() {
  return (
    <section className="how-it-works" id="how">
      <div className="container">
        <div className="how-content animate-on-scroll">
          <span className="section-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            How it works
          </span>
          <h2 className="section-title">How BlueSense works</h2>
          <p className="section-subtitle">Deposit ADA once. Let the oracle and vault handle the rest.</p>
        </div>

        <div className="how-showcase animate-on-scroll">
          <div className="how-cards-grid">
            {/* Income Card */}
            <div className="how-card how-card-income">
              <div className="how-card-header">
                <span>Vault TVL</span>
                <span>Past 30 days →</span>
              </div>
              <div className="how-card-value">12,847 ADA</div>
              <div className="how-card-trend">▲ 24.8%</div>
              <div className="how-card-chart">
                <svg viewBox="0 0 200 60" fill="none">
                  <path
                    d="M0 55 C30 50, 50 45, 70 30 C90 15, 110 10, 130 15 C150 20, 170 8, 200 5"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="2"
                    fill="none"
                  />
                  <circle cx="130" cy="15" r="4" fill="white" />
                  <rect x="118" y="2" rx="4" width="28" height="14" fill="white" opacity="0.9" />
                  <text x="132" y="12" textAnchor="middle" fontSize="7" fill="#0033AD" fontWeight="600">Epoch 5</text>
                </svg>
              </div>
            </div>

            {/* Growth Card */}
            <div className="how-card how-card-growth">
              <div className="how-card-header">
                <span>Current APY</span>
              </div>
              <div className="how-card-value">12.4%</div>
              <div className="how-card-desc">Optimized via Charli3 Oracle</div>
            </div>

            {/* Strategies Card */}
            <div className="how-card how-card-profile">
              <div className="profile-header">
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>Yield Strategies</span>
                <span>Active</span>
              </div>
              <div className="profile-setting">
                <span>Strategy Router</span>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                Available protocols
              </div>
              <div className="profile-setting">
                <div className="profile-avatar">S</div>
                <span>Native Staking (3-5%)</span>
              </div>
              <div className="profile-setting">
                <div className="profile-avatar" style={{ background: '#10B981' }}>L</div>
                <span>Liqwid Lending (8-15%)</span>
              </div>
              <div className="profile-setting" style={{ borderBottom: 'none', color: 'rgba(255,255,255,0.6)' }}>
                Rebalance threshold: 5% delta
              </div>
            </div>

            {/* Allocation Card */}
            <div className="how-card how-card-balance">
              <div className="balance-donut">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#E5E7EB" strokeWidth="12" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#0033AD" strokeWidth="12"
                    strokeDasharray="200 314" strokeLinecap="round" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#10B981" strokeWidth="12"
                    strokeDasharray="80 314" strokeDashoffset="-200" strokeLinecap="round" />
                </svg>
                <div className="balance-donut-center">
                  <div className="balance-donut-value">102.5</div>
                  <div className="balance-donut-label">ssADA</div>
                </div>
              </div>
              <div className="balance-legend">
                <span><span className="balance-legend-dot" style={{ background: '#0033AD' }} /> Liqwid</span>
                <span><span className="balance-legend-dot" style={{ background: '#10B981' }} /> Staking</span>
                <span><span className="balance-legend-dot" style={{ background: '#E5E7EB' }} /> Reserve</span>
              </div>
            </div>

            {/* Phone Mockups */}
            <div className="how-card how-card-phones">
              <div className="phone-mockup purple" />
              <div className="phone-mockup" />
            </div>

            {/* Oracle Feed Card */}
            <div className="how-card how-card-income-bottom">
              <div className="income-bottom-header">
                <span>Oracle Feed</span>
                <span>Charli3 Pull →</span>
              </div>
              <div className="income-bottom-value">$0.387</div>
              <div className="income-bottom-chart">
                <svg viewBox="0 0 200 50" fill="none">
                  <path
                    d="M0 40 C40 38, 60 35, 80 25 C100 15, 130 12, 160 10 C180 8, 190 5, 200 3"
                    stroke="#0033AD"
                    strokeWidth="2"
                    fill="none"
                  />
                  <circle cx="180" cy="8" r="3" fill="#0033AD" />
                  <text x="180" y="22" textAnchor="middle" fontSize="7" fill="#6B7280">ADA/USD</text>
                </svg>
              </div>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '12px', color: '#10B981', fontWeight: '600' }}>▲ 3.2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   WHY CHOOSE US SECTION
   ============================================================ */
interface WhyCard {
  icon: string
  title: string
  desc: string
}

function WhyChooseUsSection() {
  const cards: WhyCard[] = [
    { icon: '↑', title: 'Oracle-Powered Routing', desc: 'Charli3 Pull Oracle fetches real-time ADA/USD prices on-demand to determine the highest-yielding strategy.' },
    { icon: '⟳', title: 'Auto-Rebalancing', desc: 'When APY delta exceeds 5%, the vault automatically migrates your ADA to the better-performing protocol.' },
    { icon: '◇', title: 'ssADA Share Token', desc: 'Your ssADA represents proportional vault ownership. Its value grows as yield compounds automatically.' },
  ]

  return (
    <section className="why-choose-us" id="features">
      <div className="container">
        <div className="why-header animate-on-scroll">
          <h2 className="section-title">Why choose BlueSense</h2>
        </div>

        <div className="why-grid">
          {cards.map((card: WhyCard, i: number) => (
            <div key={i} className={`why-card animate-on-scroll stagger-${i + 1}`}>
              <div className="why-card-icon">{card.icon}</div>
              <h3 className="why-card-title">{card.title}</h3>
              <p className="why-card-desc">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   TESTIMONIALS SECTION
   ============================================================ */
function TestimonialsSection() {
  return (
    <section className="testimonials" id="stories">
      <div className="container">
        <div className="testimonials-header animate-on-scroll">
          <span className="section-badge">
            <span>☆</span> Real experiences
          </span>
          <h2 className="section-title">Stories from our<br />users</h2>
        </div>

        <div className="testimonials-carousel animate-on-scroll">
          {/* Left card */}
          <div className="testimonial-side-card testimonial-left">
            <div className="testimonial-avatar">
              <div style={{ width: '100%', height: '100%', background: '#0033AD', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px', fontWeight: '700' }}>A</div>
            </div>
            <div className="testimonial-name">Alex Ramos</div>
            <div className="testimonial-role">SPO Operator, Epoch Pool</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
              <div className="testimonial-stars">
                {[...Array(5)].map((_, i: number) => (
                  <span key={i} className="testimonial-star">★</span>
                ))}
              </div>
              <span className="testimonial-rating">5.0</span>
            </div>
            <p className="testimonial-quote">
              &ldquo;BlueSense routed my ADA to Liqwid when lending rates spiked. I earned 3x more than basic staking that epoch.&rdquo;
            </p>
          </div>

          {/* Center card (featured) */}
          <div className="testimonial-card-stack">
            <div className="testimonial-bg-card" />
            <div className="testimonial-bg-card" />
            <div className="testimonial-main">
              <div className="testimonial-avatar">
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #0033AD, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '28px', fontWeight: '700' }}>D</div>
              </div>
              <div className="testimonial-name">Diana Chen</div>
              <div className="testimonial-role">DeFi researcher, CardanoSphere</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>
                <div className="testimonial-stars">
                  {[...Array(5)].map((_, i: number) => (
                    <span key={i} className="testimonial-star">★</span>
                  ))}
                </div>
                <span className="testimonial-rating">5.0</span>
              </div>
              <p className="testimonial-quote">
                &ldquo;Finally a vault that uses real oracle data instead of guessing. The Charli3 integration makes this trustworthy.&rdquo;
              </p>
            </div>
          </div>

          {/* Right card */}
          <div className="testimonial-side-card testimonial-right">
            <div className="testimonial-avatar">
              <div style={{ width: '100%', height: '100%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px', fontWeight: '700' }}>M</div>
            </div>
            <div className="testimonial-name">Marco Vitale</div>
            <div className="testimonial-role">Cardano whale, early adopter</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
              <div className="testimonial-stars">
                {[...Array(5)].map((_, i: number) => (
                  <span key={i} className="testimonial-star">★</span>
                ))}
              </div>
              <span className="testimonial-rating">5.0</span>
            </div>
            <p className="testimonial-quote">
              &ldquo;Deposit and forget. My ssADA value has been steadily climbing every epoch. The emergency fallback gives me peace of mind.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   FINAL CTA SECTION
   ============================================================ */
function FinalCTASection() {
  return (
    <section className="final-cta">
      <div className="container">
        <div className="final-cta-inner animate-on-scroll">
          {/* Center content */}
          <div className="final-cta-logo">
            <img src="/images/onramper-hero-orb.svg" alt="BlueSense" className="w-10 h-10 object-contain drop-shadow-lg" />
          </div>

          <h2 className="final-cta-title">Your funds. Your control. Always.</h2>
          <button className="final-cta-btn">Launch App</button>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   FOOTER
   ============================================================ */
function Footer() {
  const links: string[] = ['Protocol', 'Features', 'Docs', 'Ecosystem', 'Community', 'GitHub']

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-links">
            {links.map((link: string) => (
              <a key={link} href="#" className="footer-link">{link}</a>
            ))}
          </div>
        </div>

        <div className="footer-social">
          <a href="#" className="footer-social-icon" aria-label="Instagram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <circle cx="12" cy="12" r="5" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </a>
          <a href="#" className="footer-social-icon" aria-label="LinkedIn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
              <rect x="2" y="9" width="4" height="12" />
              <circle cx="4" cy="4" r="2" />
            </svg>
          </a>
          <a href="#" className="footer-social-icon" aria-label="YouTube">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
              <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
            </svg>
          </a>
          <a href="#" className="footer-social-icon" aria-label="Facebook">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
          </a>
        </div>

        <div className="footer-watermark">
          <div className="footer-watermark-text flex items-center justify-center gap-4">
            <img src="/images/onramper-hero-orb.svg" alt="BlueSense" className="w-[72px] h-[72px] opacity-20 object-contain" />
            BlueSense
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ============================================================
   SCROLL ANIMATION OBSERVER
   ============================================================ */
function useScrollAnimations() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        entries.forEach((entry: IntersectionObserverEntry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '-80px' }
    )

    const elements = document.querySelectorAll('.animate-on-scroll')
    elements.forEach((el: Element) => observer.observe(el))

    return () => observer.disconnect()
  }, [])
}

/* ============================================================
   MAIN COMPONENT EXPORT
   ============================================================ */
export function BlueSenseFeatures() {
  useScrollAnimations()

  return (
    <div className="bluesense-wrapper">
      <HowItWorksSection />
      <WhyChooseUsSection />
      <TestimonialsSection />
      <FinalCTASection />
      <Footer />
    </div>
  )
}
