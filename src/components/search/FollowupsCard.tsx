import styles from "./FollowupsCard.module.css";

const followups = [
  "Only options under £500",
  "Pizza van + dessert for under £1200",
  "Vegan-friendly options for 80 guests",
  "Who can do a wedding in Hackney?",
  "Something that works indoors in winter",
];

export default function FollowupsCard() {
  return (
    <div className={styles.card}>
      <div className={styles.title}>Ask Patch</div>
      {followups.map((f) => (
        <button key={f} className={styles.followup}>
          <span className={styles.arrow}>→</span>{f}
        </button>
      ))}
    </div>
  );
}
