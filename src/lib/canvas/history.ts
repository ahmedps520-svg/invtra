import type { CanvasDoc } from "./schema";

/**
 * The Studio's state: the document, what's selected, and undo / redo. A gesture (dragging,
 * resizing, rotating) is one step: a checkpoint is taken when it starts and its moves update the
 * document live without new steps. Typing and slider drags with the same key within a second
 * merge into one step too.
 */

export interface HistoryEntry {
  doc: CanvasDoc;
  selection: string[];
}

export interface StudioState {
  doc: CanvasDoc;
  selection: string[];
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Merging: the key and time of the last change. */
  lastKey: string | null;
  lastAt: number;
  /** Bumped whenever the document changes (autosave watches it). */
  version: number;
}

export type StudioAction =
  /** A change that is its own step (or merges with the last one when `key` matches within a second). */
  | { type: "commit"; doc: CanvasDoc; selection?: string[]; key?: string; at?: number }
  /** The same, computed from the current document (so several changes in a row build on each other). */
  | { type: "apply"; fn: (doc: CanvasDoc, selection: string[]) => { doc: CanvasDoc; selection?: string[] }; key?: string; at?: number }
  /** A move during a gesture (no new step). */
  | { type: "live"; doc: CanvasDoc; selection?: string[] }
  /** The step a gesture starts from. */
  | { type: "checkpoint"; doc?: CanvasDoc; selection?: string[] }
  | { type: "select"; ids: string[] }
  | { type: "undo" }
  | { type: "redo" }
  /** Start over from another document (a template) as a step, or without history (loading). */
  | { type: "load"; doc: CanvasDoc; history?: boolean };

export const HISTORY_LIMIT = 150;
const MERGE_MS = 1000;

export function initialState(doc: CanvasDoc): StudioState {
  return { doc, selection: [], past: [], future: [], lastKey: null, lastAt: 0, version: 0 };
}

function existing(doc: CanvasDoc, ids: string[]): string[] {
  const set = new Set(doc.elements.map((e) => e.id));
  return ids.filter((id) => set.has(id));
}

function push(past: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const out = [...past, entry];
  return out.length > HISTORY_LIMIT ? out.slice(out.length - HISTORY_LIMIT) : out;
}

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "apply": {
      const r = action.fn(state.doc, state.selection);
      return studioReducer(state, { type: "commit", doc: r.doc, selection: r.selection, key: action.key, at: action.at });
    }
    case "commit": {
      if (action.doc === state.doc && !action.selection) return state;
      const at = action.at ?? Date.now();
      const merge = Boolean(action.key) && action.key === state.lastKey && at - state.lastAt < MERGE_MS;
      const changed = action.doc !== state.doc;
      return {
        ...state,
        doc: action.doc,
        selection: existing(action.doc, action.selection ?? state.selection),
        past: changed && !merge ? push(state.past, { doc: state.doc, selection: state.selection }) : state.past,
        future: changed ? [] : state.future,
        lastKey: action.key ?? null,
        lastAt: at,
        version: changed ? state.version + 1 : state.version,
      };
    }
    case "live": {
      if (action.doc === state.doc && !action.selection) return state;
      return {
        ...state,
        doc: action.doc,
        selection: action.selection ? existing(action.doc, action.selection) : state.selection,
        version: action.doc === state.doc ? state.version : state.version + 1,
      };
    }
    case "checkpoint":
      return {
        ...state,
        past: push(state.past, { doc: action.doc ?? state.doc, selection: action.selection ?? state.selection }),
        future: [],
        lastKey: null,
      };
    case "select": {
      const ids = existing(state.doc, action.ids);
      if (ids.length === state.selection.length && ids.every((id, i) => id === state.selection[i])) return state;
      return { ...state, selection: ids, lastKey: null };
    }
    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return {
        ...state,
        doc: prev.doc,
        selection: existing(prev.doc, prev.selection),
        past: state.past.slice(0, -1),
        future: [{ doc: state.doc, selection: state.selection }, ...state.future],
        lastKey: null,
        version: state.version + 1,
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        doc: next.doc,
        selection: existing(next.doc, next.selection),
        past: push(state.past, { doc: state.doc, selection: state.selection }),
        future: state.future.slice(1),
        lastKey: null,
        version: state.version + 1,
      };
    }
    case "load":
      return {
        ...state,
        doc: action.doc,
        selection: [],
        past: action.history ? push(state.past, { doc: state.doc, selection: state.selection }) : state.past,
        future: action.history ? [] : state.future,
        lastKey: null,
        // Opening a document isn't a change to save; starting over from a template is.
        version: action.history ? state.version + 1 : state.version,
      };
  }
}
