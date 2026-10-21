import { Link } from 'react-router-dom';

export function NotFoundScreen() {
  return (
    <div className="empty-page">
      <h1>Page not found</h1>
      <p className="muted">That link doesn’t match anything in Reel Studio.</p>
      <Link to="/" className="btn btn-secondary">
        Go to the board
      </Link>
    </div>
  );
}
