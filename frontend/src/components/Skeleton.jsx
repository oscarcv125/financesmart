import "../styles/skeleton.css";

export default function PageLoader() {
  return (
    <main className="page-body">
      <div className="sk-header" />
      <div className="sk-row">
        <div className="sk-card" />
        <div className="sk-card" />
        <div className="sk-card" />
      </div>
      <div className="sk-block" />
      <div className="sk-block sk-block--short" />
      <div className="sk-block sk-block--short" />
      <div className="sk-block sk-block--short" />
    </main>
  );
}
