// Keeps the local data and one Drive file in step. No DOM, no Google code: `api` is injected (see drive.js), so it can be tested.
//
// The file is the whole state as JSON. Drive gives every change a new `version` number. We remember the version we last
// saw; if the file's version moved while we have unsaved changes, someone else edited it (a conflict) and the user picks a side.
const KEY = 'platoon.sync';

export function createSync({ api, getState, applyRemote, onStatus = () => {}, storage = globalThis.localStorage }) {
  const load = () => { try { return JSON.parse(storage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = () => { try { storage.setItem(KEY, JSON.stringify(meta)); } catch { /* ignore */ } };

  let meta = load();                       // { fileId, name, version, lastSync, dirty }
  let status = meta.fileId ? 'idle' : 'off', error = '', conflict = null, busy = false, applying = false, timer = null;

  const snapshot = () => ({ status, error, conflict: !!conflict, connected: !!meta.fileId, name: meta.name || '', lastSync: meta.lastSync || 0, dirty: !!meta.dirty });
  const set = (s, e = '') => { status = s; error = e; onStatus(snapshot()); };

  function fail(e) {
    if (e && e.message === 'auth') set('auth');
    else if (e && (e instanceof TypeError || e.message === 'offline')) set('offline');
    else if (e && (e.status === 403 || e.status === 404)) set('error', 'אין גישה לקובץ ב-Drive');
    else set('error', (e && e.message) || 'שגיאה');
  }

  async function run(fn) {
    if (!meta.fileId || busy) return;
    busy = true; set('syncing');
    try { await fn(); } catch (e) { fail(e); } finally { busy = false; }
  }

  const done = (remote) => { meta.version = remote.version; meta.lastSync = Date.now(); save(); set(meta.dirty ? 'dirty' : 'idle'); };

  async function takeRemote(remote) {
    const data = await api.read(meta.fileId);
    applying = true; try { applyRemote(data); } finally { applying = false; }
    meta.dirty = false; conflict = null; done(remote);
  }

  // Upload local changes (unless the file changed under us).
  const push = () => run(async () => {
    const remote = await api.meta(meta.fileId);
    if (String(remote.version) !== String(meta.version)) { conflict = { remote }; return set('conflict'); }
    const res = await api.write(meta.fileId, getState());
    meta.dirty = false; done(res);
  });

  // Fetch remote changes (unless we have unsaved ones).
  const pull = () => run(async () => {
    const remote = await api.meta(meta.fileId);
    if (String(remote.version) === String(meta.version)) return set(meta.dirty ? 'dirty' : 'idle');
    if (meta.dirty) { conflict = { remote }; return set('conflict'); }
    await takeRemote(remote);
  });

  // Local → remote when dirty, otherwise remote → local.
  const syncNow = () => (meta.dirty ? push() : pull());

  return {
    snapshot,
    isApplying: () => applying,
    needAuth() { if (meta.fileId) set('auth'); },
    isConnected: () => !!meta.fileId,
    syncNow,
    pull,
    push,

    // The state changed locally.
    markDirty() {
      if (!meta.fileId) return;
      meta.dirty = true; save(); set('dirty');
      clearTimeout(timer); timer = setTimeout(push, 2000);
    },

    // First device: create the file from the current data.
    async connectCreate(createFile) {
      const f = await createFile(getState());
      meta = { fileId: f.id, name: f.name, version: f.version, lastSync: Date.now(), dirty: false }; save(); set('idle');
    },

    // Another device: attach to an existing file and load its data.
    async attach(fileId) {
      const remote = await api.meta(fileId);
      meta = { fileId, name: remote.name, version: remote.version, lastSync: 0, dirty: false };
      await takeRemote(remote);
    },

    // The user chose a side after a conflict.
    resolve(choice) {
      const c = conflict;
      if (!c) return Promise.resolve();
      return run(async () => {
        if (choice === 'theirs') await takeRemote(c.remote);
        else { const res = await api.write(meta.fileId, getState()); meta.dirty = false; conflict = null; done(res); }
      });
    },

    disconnect() { clearTimeout(timer); meta = {}; conflict = null; try { storage.removeItem(KEY); } catch { /* ignore */ } set('off'); },
  };
}
