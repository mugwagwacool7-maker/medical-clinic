import styles from './VisitInfo.module.css';

export default function VisitInfo() {
  return (
    <section id="visit">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">Find us</div>
          <h2>Visit Rhodes Dental</h2>
        </div>
        <div className={styles.grid}>
          <div className={styles.card}>
            <h3>Hours</h3>
            <div className={styles.row}><span className={styles.d}>Monday – Friday</span><span>8:00 AM – 6:00 PM</span></div>
            <div className={styles.row}><span className={styles.d}>Saturday</span><span>9:00 AM – 1:00 PM</span></div>
            <div className={styles.row}><span className={styles.d}>Sunday</span><span>Closed</span></div>
          </div>
          <div className={styles.card}>
            <h3>Location &amp; contact</h3>
            <div className={styles.row}><span className={styles.d}>Address</span><span>306 Parkway Rd, Victoria Falls</span></div>
            <div className={styles.row}><span className={styles.d}>Phone</span><span>+263 77 200 1144</span></div>
            <div className={styles.row}><span className={styles.d}>Email</span><span>hello@rhodesdental.example</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
