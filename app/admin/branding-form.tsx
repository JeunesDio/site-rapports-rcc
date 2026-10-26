'use client';

/* eslint-disable @next/next/no-img-element -- Uploaded previews use storage URLs that admins can replace immediately. */

import { useState, useTransition } from 'react';
import AssetInput from './asset-input';
import { saveSiteSettings } from './branding-actions';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { colorPresets, getAssetUrl, isSiteAssetPath, type SiteAssetKey, type SiteSettings } from '@/lib/site-settings';

function pathsFrom(settings: SiteSettings) {
  return Object.values(settings).filter((value): value is string => isSiteAssetPath(value));
}

export default function BrandingForm({ initial }: { initial: SiteSettings }) {
  const [settings, setSettings] = useState(initial);
  const [newPaths, setNewPaths] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const setText = (key: keyof SiteSettings, value: string) => setSettings(current => ({ ...current, [key]: value }));
  const setAsset = (key: SiteAssetKey, value: string | null) => {
    setSettings(current => ({ ...current, [key]: value }));
    if (value && !initial[key]) setNewPaths(current => [...new Set([...current, value])]);
  };

  function save() {
    setMessage('');
    startTransition(async () => {
      const result = await saveSiteSettings(settings);
      setMessage(result.message);
      if (result.ok) {
        const active = new Set(pathsFrom(settings));
        const unused = newPaths.filter(path => !active.has(path));
        if (unused.length) await createBrowserSupabaseClient().storage.from('site-assets').remove(unused);
        setNewPaths([]);
      }
    });
  }

  const img = (path: string | null, alt: string) => {
    const url = getAssetUrl(path);
    return url ? <img src={url} alt={alt}/> : null;
  };

  return <div className="stack branding-editor">
    <section className="settings-section">
      <div className="section-heading"><span className="section-index">01</span><div><h2>Identité du site</h2><p>Les informations affichées dans l’en-tête et le pied de page.</p></div></div>
      <div className="settings-grid">
        <label>Nom de l’organisation<input maxLength={160} value={settings.organizationName} onChange={event => setText('organizationName', event.target.value)}/></label>
        <label>Titre du site<input maxLength={160} value={settings.siteTitle} onChange={event => setText('siteTitle', event.target.value)}/></label>
        <label className="full-field">Signature courte<input maxLength={160} value={settings.tagline} onChange={event => setText('tagline', event.target.value)} placeholder="Ex. Renouveau Charismatique Catholique · Cotonou"/></label>
        <label className="full-field">Coordonnées et liens officiels<textarea rows={3} maxLength={500} value={settings.footerContact} onChange={event => setText('footerContact', event.target.value)} placeholder="Laissez vide si aucune coordonnée officielle n’est disponible."/></label>
      </div>
      <fieldset className="theme-options"><legend>Palette de couleurs</legend>{Object.entries(colorPresets).map(([value, preset])=><label className="theme-option" key={value}><input type="radio" name="colorPreset" checked={settings.colorPreset===value} onChange={()=>setSettings(current=>({...current,colorPreset:value as SiteSettings['colorPreset']}))}/><span className="theme-swatches"><i style={{background:preset.primary}}/><i style={{background:preset.gold}}/><i style={{background:preset.pale}}/></span><span>{preset.label}</span></label>)}</fieldset>
    </section>

    <section className="settings-section">
      <div className="section-heading"><span className="section-index">02</span><div><h2>Logo et favicon</h2><p>Ces fichiers sont destinés à l’affichage public. Aucun logo officiel n’est fourni par défaut.</p></div></div>
      <div className="settings-grid image-settings">
        <AssetInput label="Logo principal" folder="site/logos" value={settings.primaryLogoPath} onChange={path=>setAsset('primaryLogoPath',path)} pdfSafe compact/>
        <AssetInput label="Logo secondaire (facultatif)" folder="site/logos" value={settings.secondaryLogoPath} onChange={path=>setAsset('secondaryLogoPath',path)} compact/>
        <AssetInput label="Icône du site" folder="site/favicon" value={settings.faviconPath} onChange={path=>setAsset('faviconPath',path)} compact/>
      </div>
    </section>

    <section className="settings-section">
      <div className="section-heading"><span className="section-index">03</span><div><h2>Couverture de la page d’accueil</h2><p>Cette image illustre l’accueil. Sans image, le site affiche un fond graphique sobre.</p></div></div>
      <AssetInput label="Image de couverture principale" folder="site/home" value={settings.homeCoverPath} onChange={path=>setAsset('homeCoverPath',path)}/>
    </section>

    <section className="settings-section">
      <div className="section-heading"><span className="section-index">04</span><div><h2>Images des activités et médias</h2><p>Visuels d’illustration pour les sections Activités, Galerie et Vidéos.</p></div></div>
      <div className="settings-grid image-settings">
        <AssetInput label="Section Activités" folder="site/sections" value={settings.activitiesImagePath} onChange={path=>setAsset('activitiesImagePath',path)} compact/>
        <AssetInput label="Couverture de la galerie photos" folder="site/sections" value={settings.galleryImagePath} onChange={path=>setAsset('galleryImagePath',path)} compact/>
        <AssetInput label="Couverture de la section vidéos" folder="site/sections" value={settings.videosImagePath} onChange={path=>setAsset('videosImagePath',path)} compact/>
      </div>
    </section>

    <section className="settings-section">
      <div className="section-heading"><span className="section-index">05</span><div><h2>Modèle des rapports PDF</h2><p>Les images PDF acceptent JPG ou PNG. La couverture d’un rapport individuel reste prioritaire.</p></div></div>
      <div className="settings-grid">
        <label>Nom d’organisation dans le PDF<input maxLength={160} value={settings.reportOrganizationName} onChange={event => setText('reportOrganizationName', event.target.value)}/></label>
        <label>Titre du modèle<input maxLength={160} value={settings.reportTitle} onChange={event => setText('reportTitle', event.target.value)}/></label>
        <label className="full-field">Pied de page PDF<textarea rows={2} maxLength={500} value={settings.reportFooter} onChange={event => setText('reportFooter', event.target.value)} placeholder="Texte facultatif"/></label>
      </div>
      <div className="settings-grid image-settings">
        <AssetInput label="Logo du PDF" folder="site/pdf" value={settings.reportLogoPath} onChange={path=>setAsset('reportLogoPath',path)} pdfSafe compact/>
        <AssetInput label="Image d’en-tête PDF" folder="site/pdf" value={settings.reportHeaderPath} onChange={path=>setAsset('reportHeaderPath',path)} pdfSafe compact/>
        <AssetInput label="Couverture PDF par défaut" folder="site/pdf" value={settings.defaultReportCoverPath} onChange={path=>setAsset('defaultReportCoverPath',path)} pdfSafe compact/>
      </div>
    </section>

    <section className="settings-section settings-preview">
      <div className="section-heading"><span className="section-index">06</span><div><h2>Aperçu et enregistrement</h2><p>Vérifiez l’identité et la couverture avant d’appliquer les changements.</p></div></div>
      <div className="brand-preview" style={{'--preview-primary':colorPresets[settings.colorPreset].primary,'--preview-gold':colorPresets[settings.colorPreset].gold} as React.CSSProperties}>
        <div className="brand-preview-top">{img(settings.primaryLogoPath, 'Logo principal')}<strong>{settings.organizationName}</strong><span>{settings.tagline}</span></div>
        <div className="brand-preview-hero">{img(settings.homeCoverPath, 'Couverture de la page d’accueil')}<div><small>{settings.siteTitle}</small><h3>Activités et rapports</h3><p>Les contenus publiés par le diocèse.</p></div></div>
      </div>
      <div className="pdf-preview"><div className="pdf-preview-header">{img(settings.reportLogoPath??settings.primaryLogoPath,'Logo du rapport PDF')}<strong>{settings.reportOrganizationName}</strong>{img(settings.reportHeaderPath,'Image d’en-tête du rapport')}</div>{img(settings.defaultReportCoverPath,'Couverture PDF par défaut')??<div className="pdf-cover-placeholder">Couverture PDF par défaut</div>}<small>{settings.reportTitle}</small><h3>Titre du rapport</h3><p>Les informations et le contenu propres à chaque rapport s’afficheront ici.</p><footer>{settings.reportFooter||settings.reportOrganizationName}</footer></div>
      {message&&<p className={message.startsWith('Paramètres enregistrés')?'form-success':'form-error'} role={message.startsWith('Paramètres enregistrés')?'status':'alert'}>{message}</p>}
      <button type="button" disabled={isPending} onClick={save}>{isPending?'Enregistrement…':'Enregistrer les paramètres'}</button>
    </section>
  </div>;
}
