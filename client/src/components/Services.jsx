import styles from './Services.module.css';

export default function Services({ services, onBookService }) {
  return (
    <section id="services">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">What we treat</div>
          <h2>Common visits, clearly priced</h2>
          <p>Every service below can be booked directly — select one to jump straight into scheduling.</p>
        </div>
        <div className={styles.grid}>
          {services.map((s) => (
            <div key={s.id} className={styles.card}>
              <div className={styles.tag}>{s.tag}</div>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
              <div className={styles.meta}>
                <span>{s.duration}</span>
                <span>{s.price}</span>
              </div>
              <button className="btn-ghost" style={{ width: '100%', marginTop: 14 }} onClick={() => onBookService(s.id)}>
                Book this
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
