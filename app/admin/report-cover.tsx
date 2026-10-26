'use client';

import { useState, useTransition } from 'react';
import AssetInput from './asset-input';
import { saveReportCover } from './branding-actions';

export default function ReportCover({ reportId, initialPath }: { reportId: string; initialPath: string | null }) {
  const [path, setPath] = useState(initialPath);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  function save() {
    startTransition(async () => {
      const result = await saveReportCover(reportId, path);
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }
  return <section className="report-cover-editor"><div><h3>Couverture de cette activité</h3><p>Une image personnalisée remplace la couverture PDF par défaut pour ce rapport. JPG ou PNG, 5 Mo maximum.</p></div>
    <AssetInput label="Image de couverture du rapport" folder={`reports/${reportId}`} value={path} onChange={setPath} pdfSafe bucket="report-covers"/>
    {message&&<p role="status" className="form-success">{message}</p>}
    <button type="button" disabled={pending||path===initialPath} onClick={save}>{pending?'Enregistrement…':'Enregistrer la couverture'}</button>
  </section>;
}
