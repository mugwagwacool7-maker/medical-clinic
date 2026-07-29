import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer>
      <div className={`wrap ${styles.row}`}>
        <span>© 2026 Rhodes Dental &amp; Family Care</span>
        <span>This is a demo booking flow — data is stored in a local SQLite database.</span>
      </div>
    </footer>
  );
}
