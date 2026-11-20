// Settings → Storage locations (desktop apps only): choose where BIZSIM keeps
// its data and where downloaded files (backups, exports) are saved.
import { useEffect, useState } from 'react';
import { FolderOpen, HardDrive, Download, RotateCcw } from 'lucide-react';
import { Button, Callout, toast } from './ui.jsx';

export function StoragePanel() {
  const api = typeof window !== 'undefined' ? window.bizsimDesktop : null;
  const [paths, setPaths] = useState(null);
  const [moving, setMoving] = useState(false);
  const load = () => api?.getPaths().then(setPaths);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!api || !paths) return null;

  const moveData = async () => {
    if (!window.confirm('BIZSIM will copy your progress, keys and saved seasons to the folder you choose, then restart. Continue?')) return;
    setMoving(true);
    try {
      const r = await api.chooseDataFolder();
      if (r?.changed) {
        toast('Data copied, restarting BIZSIM');
        setTimeout(() => api.relaunch(), 900);
      } else setMoving(false);
    } catch (e) {
      toast(e.message, 'error');
      setMoving(false);
    }
  };
  const resetData = async () => {
    if (!window.confirm('Copy your data back to the default folder and restart?')) return;
    await api.resetDataFolder();
    toast('Restarting BIZSIM');
    setTimeout(() => api.relaunch(), 900);
  };
  const isDefault = paths.dataFolder === paths.defaultDataFolder;

  return (
    <section className="panel panel-pad stack gap-4" aria-labelledby="st-h">
      <h2 id="st-h" className="section-title row gap-2">
        <HardDrive size={16} aria-hidden="true" /> Storage locations
      </h2>

      <div className="stack gap-2">
        <div style={{ fontWeight: 500, fontSize: 'var(--t-13)' }}>Data folder</div>
        <p className="meta">Your progress, AI keys, saved seasons and generated images.</p>
        <code className="meta" style={{ overflowWrap: 'anywhere' }}>{paths.dataFolder}</code>
        <div className="row wrap gap-2">
          <Button size="sm" icon={FolderOpen} onClick={() => api.openFolder(paths.dataFolder)}>
            Open
          </Button>
          <Button size="sm" icon={HardDrive} loading={moving} onClick={moveData}>
            Change…
          </Button>
          {!isDefault && (
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetData}>
              Use default folder
            </Button>
          )}
        </div>
      </div>

      <div className="stack gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--s4)' }}>
        <div style={{ fontWeight: 500, fontSize: 'var(--t-13)' }}>Downloads</div>
        <p className="meta">Where backups and other files from BIZSIM are saved.</p>
        <div className="stack gap-2" role="radiogroup" aria-label="Download location">
          <label className="row gap-3" style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="dl"
              checked={!paths.downloadFolder}
              onChange={async () => {
                await api.resetDownloadFolder();
                load();
              }}
            />
            <span>Ask where to save each file</span>
          </label>
          <label className="row gap-3" style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="dl"
              checked={Boolean(paths.downloadFolder)}
              onChange={async () => {
                if (await api.chooseDownloadFolder()) load();
              }}
            />
            <span>Always save to a folder I choose</span>
          </label>
        </div>
        {paths.downloadFolder && (
          <div className="row wrap gap-2" style={{ alignItems: 'center' }}>
            <code className="meta" style={{ overflowWrap: 'anywhere' }}>{paths.downloadFolder}</code>
            <Button
              size="sm"
              icon={Download}
              onClick={async () => {
                if (await api.chooseDownloadFolder()) load();
              }}
            >
              Change…
            </Button>
          </div>
        )}
      </div>
      <Callout>The app’s own location is chosen when you install it: Windows: <em>Browse…</em> in the installer; macOS and Linux: wherever you put the app. Moving or reinstalling the app never touches this data folder.</Callout>
    </section>
  );
}
