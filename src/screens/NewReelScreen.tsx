import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TagInput } from '../components/TagInput';
import { reelFolderName } from '../data/naming';
import { useData } from '../state/data';

export function NewReelScreen() {
  const { data, user, createReel } = useData();
  const navigate = useNavigate();
  const businesses = useMemo(() => data?.businesses.filter((b) => b.active) ?? [], [data]);
  const [title, setTitle] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [assignee, setAssignee] = useState(user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knownAssignees = useMemo(
    () => [...new Set([user, ...(data?.reels ?? []).map((r) => r.assignee)].filter(Boolean))].sort(),
    [data, user],
  );
  const tagSuggestions = useMemo(
    () => [...new Set([...(data?.tags ?? []).map((t) => t.tag), ...(data?.reels ?? []).flatMap((r) => r.tags)])].sort(),
    [data],
  );

  if (!data) return <p className="loading">Loading…</p>;

  const business = businesses.find((b) => b.id === businessId);
  const preview = business && title.trim() ? reelFolderName(new Date(), business.shortCode, title) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Give the reel a title.');
    if (!business) return setError('Choose a business.');
    setError(null);
    setBusy(true);
    try {
      const reel = await createReel({ title, business, tags, assignee });
      navigate(`/reel/${encodeURIComponent(reel.id)}`, { replace: true });
    } catch {
      setBusy(false); // The error is shown as a toast.
    }
  }

  return (
    <div className="narrow">
      <h1 className="page-title">New reel</h1>
      <p className="muted">This creates the reel’s folder in 01 Raw Videos and adds it to the Reel Tracker.</p>

      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="First-time buyer mistakes"
            required
            autoFocus
          />
        </div>

        <fieldset className="field">
          <legend className="field-label">Business</legend>
          <div className="choice-list">
            {businesses.map((b) => (
              <label key={b.id} className="choice" style={{ ['--biz' as string]: b.accentColor }}>
                <input
                  type="radio"
                  name="business"
                  value={b.id}
                  checked={businessId === b.id}
                  onChange={() => setBusinessId(b.id)}
                />
                <span className="biz-dot" aria-hidden="true" />
                <span>{b.name}</span>
                <span className="choice-code">{b.shortCode}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="field-label" htmlFor="tags">
            Tags <span className="optional">optional</span>
          </label>
          <TagInput id="tags" value={tags} onChange={setTags} suggestions={tagSuggestions} />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="assignee">
            Assignee
          </label>
          <input
            id="assignee"
            className="input"
            type="email"
            list="assignees"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="name@example.com"
          />
          <datalist id="assignees">
            {knownAssignees.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>

        {preview && (
          <p className="hint">
            Drive folder: <code>{preview}</code>
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating folder…' : 'Create reel'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => navigate(-1)} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
