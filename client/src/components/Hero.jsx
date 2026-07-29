import styles from './Hero.module.css';

export default function Hero() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className={styles.hero}>
      <div className={`wrap ${styles.heroGrid}`}>
        <div>
          <div className="eyebrow">Now accepting new patients</div>
          <h1>Dental care that fits <em>your</em> calendar, not the other way around.</h1>
          <p>Pick a service, see real open slots, and confirm your visit in under two minutes — no phone tag, no waiting on hold.</p>
          <div className={styles.heroActions}>
            <button className="btn-primary" onClick={() => scrollTo('book')}>Book an appointment</button>
            <button className="btn-ghost" onClick={() => scrollTo('services')}>View services</button>
          </div>
          <div className={styles.heroStats}>
            <div><div className={styles.num}>4.9★</div><div className={styles.lbl}>412 patient reviews</div></div>
            <div><div className={styles.num}>12 min</div><div className={styles.lbl}>avg. wait time</div></div>
            <div><div className={styles.num}>6</div><div className={styles.lbl}>dentists on staff</div></div>
          </div>
        </div>

        <div className="ticket">
          <div className="ticket-top">
            <div className={styles.row1}>
              <span className={styles.clinicTag}>RHODES · APPT SLIP</span>
              <span className={styles.statusDot}>NEXT OPENING TODAY</span>
            </div>
            <h3 className={styles.ticketTitle}>Routine Cleaning &amp; Exam</h3>
            <p className={styles.ticketDoctor}>with Dr. Finity · 30 min</p>
          </div>
          <div className="perf"></div>
          <div className="ticket-bottom">
            <div className="summary-row"><span className="k">Earliest slot</span><span className="v mono">Tomorrow, 9:40 AM</span></div>
            <div className="summary-row"><span className="k">Location</span><span className="v">Victoria falls township</span></div>
            <div className="summary-row"><span className="k">Est. duration</span><span className="v">30 minutes</span></div>
            <button className="btn-primary" style={{width:'100%',marginTop:18}} onClick={() => scrollTo('book')}>Claim this slot</button>
          </div>
        </div>
      </div>
    </section>
  );
}
