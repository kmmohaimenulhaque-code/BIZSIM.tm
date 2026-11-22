// Settings → Storage locations (desktop apps only): choose where BIZSIM keeps
// its data and where downloaded files (backups, exports) are saved.
import { useEffect, useState } from 'react';
import { FolderOpen, HardDrive, Download, RotateCcw } from 'lucide-react';
import { Button, Callout, toast } from './ui.jsx';
import { useTranslation, Trans } from '../i18n/index.js';

export function StoragePanel() {
  const { t } = useTranslation();
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
    if (!window.confirm(t('storage.confirmMove'))) return;
    setMoving(true);
    try {
      const r = await api.chooseDataFolder();
      if (r?.changed) {
        toast(t('storage.copied'));
        setTimeout(() => api.relaunch(), 900);
      } else setMoving(false);
    } catch (e) {
      toast(e.message, 'error');
      setMoving(false);
    }
  };
  const resetData = async () => {
    if (!window.confirm(t('storage.confirmReset'))) return;
    await api.resetDataFolder();
    toast(t('storage.restarting'));
    setTimeout(() => api.relaunch(), 900);
  };
  const isDefault = paths.dataFolder === paths.defaultDataFolder;

  return (
    <section className="panel panel-pad stack gap-4" aria-labelledby="st-h">
      <h2 id="st-h" className="section-title row gap-2">
        <HardDrive size={16} aria-hidden="true" /> {t('storage.title')}
      </h2>

      <div className="stack gap-2">
        <div style={{ fontWeight: 500, fontSize: 'var(--t-13)' }}>{t('storage.dataFolder')}</div>
        <p className="meta">{t('storage.dataHint')}</p>
        <code className="meta" dir="ltr" style={{ overflowWrap: 'anywhere' }}>{paths.dataFolder}</code>
        <div className="row wrap gap-2">
          <Button size="sm" icon={FolderOpen} onClick={() => api.openFolder(paths.dataFolder)}>
            {t('storage.open')}
          </Button>
          <Button size="sm" icon={HardDrive} loading={moving} onClick={moveData}>
            {t('storage.change')}
          </Button>
          {!isDefault && (
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetData}>
              {t('storage.useDefault')}
            </Button>
          )}
        </div>
      </div>

      <div className="stack gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--s4)' }}>
        <div style={{ fontWeight: 500, fontSize: 'var(--t-13)' }}>{t('storage.downloads')}</div>
        <p className="meta">{t('storage.downloadsHint')}</p>
        <div className="stack gap-2" role="radiogroup" aria-label={t('storage.downloadLocation')}>
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
            <span>{t('storage.ask')}</span>
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
            <span>{t('storage.always')}</span>
          </label>
        </div>
        {paths.downloadFolder && (
          <div className="row wrap gap-2" style={{ alignItems: 'center' }}>
            <code className="meta" dir="ltr" style={{ overflowWrap: 'anywhere' }}>{paths.downloadFolder}</code>
            <Button
              size="sm"
              icon={Download}
              onClick={async () => {
                if (await api.chooseDownloadFolder()) load();
              }}
            >
              {t('storage.change')}
            </Button>
          </div>
        )}
      </div>
      <Callout>
        <Trans i18nKey="storage.appLocation" components={{ em: <em /> }} />
      </Callout>
    </section>
  );
}
