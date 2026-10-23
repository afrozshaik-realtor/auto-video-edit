import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { workflow } from '../config/workflow';
import { AiEditPanel, aiStatusLine, CaptionPanel, ReviewPanel, ThumbnailPanel } from '../components/AiPanels';
import { BusinessChip } from '../components/BusinessChip';
import { shortName } from '../components/ClipCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icon';
import { SaveOnBlurField } from '../components/SaveOnBlurField';
import { StepItem } from '../components/StepItem';
import { DRIVE_FOLDER_NAMES } from '../config/defaults';
import { completionBlockers, firstOpenStep, previousStage, requiredProgress, STAGE_LABELS } from '../data/stage';
import type { Stage } from '../data/types';
import { folderUrl } from '../services/google/drive';
import { useData } from '../state/data';
import { useToast } from '../state/toast';

export function ReelScreen() {
  const { id = '' } = useParams();
  const { data, loading, setStepDone, saveStepNote, updateReel, completeReel, moveReelBack, queueAiEdit, queueThumbnail } =
    useData();
  const { notify } = useToast();
  const reel = data?.reels.find((r) => r.id === id);
  const checklist = data?.checklists.get(id);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'complete' | 'back' | null>(null);
  const initialised = useRef(false);

  // Open the first unfinished step once the reel has loaded.
  useEffect(() => {
    if (!reel || initialised.current) return;
    initialised.current = true;
    const first = firstOpenStep(workflow, checklist);
    setOpenStep(first?.id ?? null);
    // On a phone the open step can be far below the fold, so bring it into view.
    if (first && first.id !== workflow.steps[0].id && matchMedia('(max-width: 699px)').matches) {
      requestAnimationFrame(() => document.getElementById(`step-${first.id}`)?.scrollIntoView({ block: 'start' }));
    }
  }, [reel, checklist]);

  if (!data) return <p className="loading">{loading ? 'Loading reel…' : 'Couldn’t load the reel.'}</p>;
  if (!reel)
    return (
      <div className="empty-page">
        <h1>Reel not found</h1>
        <p className="muted">It may have been removed from the Reel Tracker sheet.</p>
        <Link to="/" className="btn btn-secondary">
          Go to the board
        </Link>
      </div>
    );

  const business = data.businesses.find((b) => b.id === reel.business);
  const progress = requiredProgress(workflow, checklist);
  const blockers = completionBlockers(workflow, reel, checklist);
  const back = previousStage(reel.stage);
  const promptContext = {
    businessName: business?.name ?? '',
    styleRules: business?.styleRulesMd ?? '',
    reelTitle: reel.title,
    tags: reel.tags,
  };

  function openNext(fromIndex: number) {
    const next = workflow.steps[fromIndex + 1];
    if (!next) return;
    setOpenStep(next.id);
    // Bring the next step into view once it renders.
    requestAnimationFrame(() => {
      const el = document.getElementById(`step-${next.id}`);
      el?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el?.querySelector<HTMLElement>('.step-toggle')?.focus({ preventScroll: true });
    });
  }

  function setDone(stepId: string, done: boolean) {
    // Failures show as a toast from the data layer.
    setStepDone(reel!, stepId, done).catch(() => {});
  }
  const aiLine = aiStatusLine(reel);

  const stageFolder: Record<Stage, string> = {
    raw: DRIVE_FOLDER_NAMES.raw,
    working: DRIVE_FOLDER_NAMES.working,
    completed: DRIVE_FOLDER_NAMES.completed,
  };

  return (
    <div className="reel-page">
      <Link to="/" className="back-link">
        <Icon name="back" size={16} />
        Board
      </Link>

      <header className="reel-head" style={{ ['--biz' as string]: business?.accentColor }}>
        <div className="reel-head-meta">
          <BusinessChip business={business} full />
          <span className={`stage-badge stage-${reel.stage}`}>{STAGE_LABELS[reel.stage]}</span>
          {reel.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <h1 className="reel-title">{reel.title}</h1>
        <div className="reel-head-actions">
          {reel.driveFolderId && (
            <a className="btn btn-secondary btn-small" href={folderUrl(reel.driveFolderId)} target="_blank" rel="noopener noreferrer">
              <Icon name="folder" size={16} />
              Open in Drive
            </a>
          )}
          <span className="muted small">
            {reel.assignee ? `Assigned to ${shortName(reel.assignee)}` : 'Unassigned'}
          </span>
          {aiLine && (
            <span className={`ai-chip${reel.aiStatus === 'failed' ? ' is-failed' : ''}`}>
              {reel.aiStatus === 'running' && <span className="ai-dot" aria-hidden="true" />}
              {aiLine}
            </span>
          )}
        </div>
      </header>

      <div className="reel-grid">
        <section className="steps" aria-labelledby="steps-title">
          <div className="steps-head">
            <h2 id="steps-title" className="section-title">
              Steps
            </h2>
            <span className="steps-progress">
              <span className="mono">
                {progress.done}/{progress.total}
              </span>{' '}
              required steps done
            </span>
          </div>
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <ol className="step-list">
            {workflow.steps.map((step, i) => (
                <StepItem
                  key={step.id}
                  step={step}
                  index={i}
                  reel={reel}
                  entry={checklist?.get(step.id)}
                  open={openStep === step.id}
                  isLast={i === workflow.steps.length - 1}
                  promptContext={promptContext}
                  onToggleOpen={() => setOpenStep((o) => (o === step.id ? null : step.id))}
                  onSetDone={(done) => setDone(step.id, done)}
                  onNext={() => openNext(i)}
                  onSaveNote={(note) => saveStepNote(reel.id, step.id, note)}
                  onSaveField={(field, value) => updateReel(reel.id, { [field]: value })}
                  onBlocked={(msg) => {
                    notify(msg, 'error');
                    setOpenStep(step.id);
                  }}
                  panel={
                    step.panel === 'ai-edit' ? (
                      <AiEditPanel reel={reel} onQueue={(notes) => queueAiEdit(reel, notes)} />
                    ) : step.panel === 'ai-caption' ? (
                      <CaptionPanel reel={reel} />
                    ) : step.panel === 'ai-thumbnail' ? (
                      <ThumbnailPanel
                        reel={reel}
                        onQueue={async (notes) => {
                          await queueThumbnail(reel, notes);
                          notify('New thumbnail queued. It usually takes a few minutes.');
                        }}
                      />
                    ) : step.panel === 'review' ? (
                      <ReviewPanel
                        reel={reel}
                        step={step}
                        promptContext={promptContext}
                        onRerun={async (notes) => {
                          await queueAiEdit(reel, notes);
                          notify('Re-run queued. The AI editor picks it up within about 10 minutes.');
                        }}
                      />
                    ) : undefined
                  }
                />
            ))}
          </ol>
        </section>

        <aside className="reel-side" aria-label="Reel details">
          <section className="side-card">
            <h2 className="section-title">Details</h2>
            <SaveOnBlurField
              label="Assignee"
              type="email"
              value={reel.assignee}
              onSave={(v) => updateReel(reel.id, { assignee: v })}
            />
            <SaveOnBlurField
              label="Final video link"
              type="url"
              placeholder="https://"
              openLabel="Open video"
              value={reel.finalVideoLink}
              onSave={(v) => updateReel(reel.id, { finalVideoLink: v })}
            />
            <SaveOnBlurField
              label="Posted URL"
              type="url"
              placeholder="https://"
              openLabel="Open post"
              value={reel.postedUrl}
              onSave={(v) => updateReel(reel.id, { postedUrl: v })}
            />
            <SaveOnBlurField label="Notes" multiline value={reel.notes} onSave={(v) => updateReel(reel.id, { notes: v })} />
            <p className="muted small">
              Folder: <span className="mono">{stageFolder[reel.stage]}</span>
              {reel.postDate && <> · Posted {reel.postDate}</>}
            </p>
          </section>

          <section className="side-card">
            <h2 className="section-title">Finish</h2>
            {reel.stage === 'completed' ? (
              <p className="success-line">This reel is complete.</p>
            ) : blockers.length > 0 ? (
              <ul className="blockers">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Everything required is done.</p>
            )}
            {reel.stage !== 'completed' && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={blockers.length > 0}
                onClick={() => setDialog('complete')}
              >
                Mark reel complete
              </button>
            )}
            {back && (
              <button type="button" className="btn btn-quiet btn-block" onClick={() => setDialog('back')}>
                Move back to {STAGE_LABELS[back]}
              </button>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={dialog === 'complete'}
        title="Mark this reel complete?"
        confirmLabel="Mark reel complete"
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await completeReel(reel);
          notify(`Reel complete. The folder moved to ${DRIVE_FOLDER_NAMES.completed}.`);
        }}
      >
        <p>
          The reel’s folder moves to <strong>{DRIVE_FOLDER_NAMES.completed}</strong> and it leaves the Working track.
        </p>
      </ConfirmDialog>

      {back && (
        <ConfirmDialog
          open={dialog === 'back'}
          title={`Move back to ${STAGE_LABELS[back]}?`}
          confirmLabel={`Move back to ${STAGE_LABELS[back]}`}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await moveReelBack(reel, back);
            notify(`Moved back. The folder is in ${stageFolder[back]} again.`);
          }}
        >
          <p>
            The reel’s folder moves back to <strong>{stageFolder[back]}</strong>. Use this when a reel needs a re-edit.
            Ticked steps stay ticked.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
