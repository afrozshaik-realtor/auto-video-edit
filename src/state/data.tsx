import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppIds } from '../config/app.config';
import { runMigrations } from '../data/migrations';
import * as repo from '../data/repo';
import { SCHEMA_VERSION } from '../data/schema';
import type { ChecklistEntry, Reel, ReelChecklist } from '../data/types';
import { useAuth } from './auth';
import { useToast } from './toast';

interface DataState {
  ids: AppIds;
  data: repo.AppData | null;
  loading: boolean;
  loadError: string | null;
  user: string;
  refresh: () => Promise<void>;
  createReel: (input: repo.NewReelInput) => Promise<Reel>;
  setStepDone: (reel: Reel, stepId: string, done: boolean) => Promise<void>;
  saveStepNote: (reelId: string, stepId: string, note: string) => Promise<void>;
  updateReel: (reelId: string, patch: repo.ReelPatch) => Promise<void>;
  completeReel: (reel: Reel) => Promise<void>;
  moveReelBack: (reel: Reel, to: Reel['stage']) => Promise<void>;
  /** Start (or re-run) the automated AI edit, with optional notes. */
  queueAiEdit: (reel: Reel, notes: string) => Promise<void>;
  /** Ask for a new AI thumbnail only, with optional notes. */
  queueThumbnail: (reel: Reel, notes: string) => Promise<void>;
}

const DataContext = createContext<DataState | null>(null);

const REFRESH_ON_FOCUS_MS = 15_000;
/** How often to re-read the sheet while an AI edit is queued or running. */
const AI_POLL_MS = 60_000;

export function DataProvider({ ids: baseIds, children }: { ids: AppIds; children: ReactNode }) {
  const { session, expired } = useAuth();
  const { fail } = useToast();
  const user = session?.email ?? '';
  const [data, setData] = useState<repo.AppData | null>(null);
  // Folder IDs that live in the sheet's Meta tab (the Trimmed folder) are filled in once loaded.
  const trimmedFromMeta = data?.meta[repo.TRIMMED_FOLDER_KEY] ?? '';
  const ids = useMemo(
    () => repo.withMetaIds(baseIds, { [repo.TRIMMED_FOLDER_KEY]: trimmedFromMeta }),
    [baseIds, trimmedFromMeta],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // While a write is in flight, background refreshes are ignored so they can't undo optimistic updates.
  const inFlight = useRef(0);
  const lastLoad = useRef(0);
  const migrating = useRef(false);

  const refresh = useCallback(async () => {
    lastLoad.current = Date.now();
    try {
      let fresh = await repo.loadAll(baseIds);
      if (fresh.schemaVersion < SCHEMA_VERSION && !migrating.current) {
        // First person with edit access to load the new version upgrades the sheet.
        migrating.current = true;
        try {
          await runMigrations(baseIds, fresh.schemaVersion);
          fresh = await repo.loadAll(baseIds);
        } catch (e) {
          console.warn('Sheet migration failed', e);
        }
      }
      if (inFlight.current === 0) setData(fresh);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [baseIds]);

  useEffect(() => {
    if (!expired) void refresh();
    // Re-load after signing in again.
  }, [refresh, expired]);

  // Pick up teammates' changes when the app comes back into view.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > REFRESH_ON_FOCUS_MS) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);

  // Keep AI progress fresh without anyone reloading.
  const busy = (s: Reel['aiStatus']) => s === 'queued' || s === 'running';
  const aiActive = data?.reels.some((r) => busy(r.aiStatus) || busy(r.thumbStatus)) ?? false;
  useEffect(() => {
    if (!aiActive || expired) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, AI_POLL_MS);
    return () => window.clearInterval(t);
  }, [aiActive, expired, refresh]);

  const patchReelLocal = useCallback((reel: Reel) => {
    setData((d) => (d ? { ...d, reels: d.reels.map((r) => (r.id === reel.id ? reel : r)) } : d));
  }, []);

  const patchEntryLocal = useCallback((entry: ChecklistEntry) => {
    setData((d) => {
      if (!d) return d;
      const checklists = new Map(d.checklists);
      const m: ReelChecklist = new Map(checklists.get(entry.reelId));
      m.set(entry.stepId, entry);
      checklists.set(entry.reelId, m);
      return { ...d, checklists };
    });
  }, []);

  /** Run a write with an optimistic update; roll back and show the error on failure. */
  const run = useCallback(
    async <T,>(optimistic: (() => void) | null, op: () => Promise<T>): Promise<T> => {
      const snapshot = data;
      inFlight.current++;
      optimistic?.();
      try {
        return await op();
      } catch (e) {
        if (snapshot) setData(snapshot);
        fail(e);
        throw e;
      } finally {
        inFlight.current--;
        if (inFlight.current === 0) void refresh();
      }
    },
    [data, fail, refresh],
  );

  const value = useMemo<DataState>(
    () => ({
      ids,
      data,
      loading,
      loadError,
      user,
      refresh,
      createReel: (input) =>
        run(null, async () => {
          const reel = await repo.createReel(ids, user, input, data?.tags ?? []);
          setData((d) => (d ? { ...d, reels: [...d.reels, reel] } : d));
          return reel;
        }),
      setStepDone: (reel, stepId, done) => {
        const prev = data?.checklists.get(reel.id)?.get(stepId);
        return run(
          () =>
            patchEntryLocal({
              reelId: reel.id,
              stepId,
              done,
              doneBy: done ? user : '',
              doneAt: done ? new Date().toISOString() : '',
              note: prev?.note ?? '',
            }),
          async () => {
            const res = await repo.setStepDone(ids, user, reel, stepId, done);
            patchEntryLocal(res.entry);
            patchReelLocal(res.reel);
          },
        );
      },
      saveStepNote: (reelId, stepId, note) => {
        const prev = data?.checklists.get(reelId)?.get(stepId);
        return run(
          () => patchEntryLocal({ reelId, stepId, done: false, doneBy: '', doneAt: '', ...prev, note }),
          async () => {
            patchEntryLocal(await repo.saveStep(ids, reelId, stepId, { note }, user));
          },
        );
      },
      updateReel: (reelId, patch) => {
        const current = data?.reels.find((r) => r.id === reelId);
        return run(
          () => current && patchReelLocal({ ...current, ...patch }),
          async () => {
            patchReelLocal(await repo.updateReel(ids, reelId, patch));
          },
        );
      },
      completeReel: (reel) =>
        run(null, async () => {
          patchReelLocal(await repo.completeReel(ids, user, reel));
        }),
      moveReelBack: (reel, to) =>
        run(null, async () => {
          patchReelLocal(await repo.moveReel(ids, user, reel, to));
        }),
      queueAiEdit: (reel, notes) =>
        run(
          () => patchReelLocal({ ...reel, aiStatus: 'queued', aiNotes: notes, aiDetail: 'Waiting for the AI editor to start' }),
          async () => {
            patchReelLocal(await repo.queueAiEdit(ids, user, reel, notes));
          },
        ),
      queueThumbnail: (reel, notes) =>
        run(
          () => patchReelLocal({ ...reel, thumbStatus: 'queued', thumbNotes: notes, thumbDetail: 'Waiting for the AI editor to start' }),
          async () => {
            patchReelLocal(await repo.queueThumbnail(ids, user, reel, notes));
          },
        ),
    }),
    [ids, data, loading, loadError, user, refresh, run, patchEntryLocal, patchReelLocal],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData outside DataProvider');
  return ctx;
}
