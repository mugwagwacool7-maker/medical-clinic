import styles from './Header.module.css';

export default function Header() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header>
      <div className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>W</span>Rhodes Dental
        </div>
        <nav className={styles.navlinks}>
          <a href="#services" onClick={(e) => { e.preventDefault(); scrollTo('services'); }}>Services</a>
          <a href="#book" onClick={(e) => { e.preventDefault(); scrollTo('book'); }}>Book</a>
          <a href="#my-appointments" onClick={(e) => { e.preventDefault(); scrollTo('my-appointments'); }}>My appointments</a>
          <a href="#visit" onClick={(e) => { e.preventDefault(); scrollTo('visit'); }}>Visit us</a>
        </nav>
        <button className={styles.navCta} onClick={() => scrollTo('book')}>Book appointment</button>
      </div>
    </header>
  );
}
