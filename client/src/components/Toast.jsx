import styles from './Toast.module.css';

export default function Toast({ message, show }) {
  return (
    <div className={`${styles.toast} ${show ? styles.show : ''}`}>
      {message}
    </div>
  );
}
