import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Star, Trash2, Upload } from 'lucide-react';
import type { Album, Photo, Audience } from '../lib/model';
import { effectiveAudience, photoAudienceOptions } from '../lib/model';
import Modal from './Modal';

interface AlbumEditorProps {
  album?: Album;
  onSave: (album: Album) => void;
  onClose: () => void;
}

const AUDIENCE_LABELS: Record<Audience, string> = {
  family: 'Family', besties: 'Besties', friends: 'Friends', public: 'Public', private: 'Only me',
};
const MAX_PHOTOS = 30;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function prepareImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('This image could not be opened. Try a JPEG, PNG, WebP, or AVIF photo.'));
      img.src = url;
    });
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this photo. Please try again.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AlbumEditor({ album, onSave, onClose }: AlbumEditorProps) {
  const [title, setTitle] = useState(album?.title ?? '');
  const [caption, setCaption] = useState(album?.caption ?? '');
  const [period, setPeriod] = useState(album?.period ?? currentMonth());
  const [audience, setAudience] = useState<Audience>(album?.audience ?? 'friends');
  const [photos, setPhotos] = useState<Photo[]>(album?.photos.map(photo => ({ ...photo })) ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadInProgress = useRef(false);
  const options = photoAudienceOptions(audience);

  const changeAudience = (next: Audience) => {
    setAudience(next);
    const allowed = photoAudienceOptions(next);
    setPhotos(previous => previous.map(photo => allowed.includes(photo.audience) ? photo : { ...photo, audience: effectiveAudience(photo.audience, next) }));
  };

  const upload = async (files: FileList | File[]) => {
    if (uploadInProgress.current) return;
    uploadInProgress.current = true;
    setUploading(true);
    setErrors([]);
    const incoming = Array.from(files);
    const slots = Math.max(0, MAX_PHOTOS - photos.length);
    const messages: string[] = [];
    if (incoming.length > slots) messages.push(`Albums can hold up to ${MAX_PHOTOS} photos. Only the first ${slots} selected files were checked.`);
    const next: Photo[] = [];
    for (const file of incoming.slice(0, slots)) {
      if (!FILE_TYPES.includes(file.type) && !(file.type === '' && /\.(jpe?g|png|webp|avif)$/i.test(file.name))) {
        messages.push(`${file.name}: please choose a JPEG, PNG, WebP, or AVIF image.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        messages.push(`${file.name}: this photo is larger than 15 MB.`);
        continue;
      }
      try {
        const src = await prepareImage(file);
        next.push({ id: crypto.randomUUID(), src, caption: '', audience, highlight: photos.length === 0 && next.length === 0 });
      } catch (error) {
        messages.push(`${file.name}: ${error instanceof Error ? error.message : 'Could not prepare this photo.'}`);
      }
    }
    setPhotos(previous => [...previous, ...next.map(photo => ({ ...photo, audience }))].slice(0, MAX_PHOTOS));
    setErrors(messages);
    setUploading(false);
    uploadInProgress.current = false;
    if (fileInput.current) fileInput.current.value = '';
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer.files);
  };

  const updatePhoto = (id: string, patch: Partial<Photo>) => {
    setPhotos(previous => previous.map(photo => photo.id === id ? { ...photo, ...patch } : photo));
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    setPhotos(previous => {
      const next = [...previous];
      const target = index + direction;
      if (target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || photos.length === 0 || uploading) return;
    onSave({
      id: album?.id ?? crypto.randomUUID(),
      title: title.trim(), caption: caption.trim(), period,
      authorId: 'you', createdAt: album?.createdAt ?? new Date().toISOString(), audience,
      photos: photos.map(photo => ({ ...photo, audience: options.includes(photo.audience) ? photo.audience : effectiveAudience(photo.audience, audience) })),
    });
  };

  return (
    <Modal title={album ? 'A little more to the story.' : 'Make room for a memory.'} subtitle="Big adventures. Ordinary Tuesdays. They all belong here." onClose={onClose} wide>
      <form onSubmit={submit}>
        <label className="field">Album title<input className="input" data-autofocus required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="A little of life lately…" /></label>
        <div className="field-row">
          <label className="field">A moment in time<input className="input" type="month" required value={period} onChange={event => setPeriod(event.target.value)} /></label>
          <label className="field">Who’s this for?<select className="select" value={audience} onChange={event => changeAudience(event.target.value as Audience)} disabled={uploading}>
            {(['friends', 'family', 'besties', 'public', 'private'] as Audience[]).map(option => <option value={option} key={option}>{AUDIENCE_LABELS[option]}</option>)}
          </select></label>
        </div>
        <label className="field">A few words <span className="optional">(optional)</span><textarea className="textarea" maxLength={1000} rows={3} value={caption} onChange={event => setCaption(event.target.value)} placeholder="What made this chapter yours?" /></label>
        <input ref={fileInput} className="visually-hidden" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={uploading || photos.length >= MAX_PHOTOS} onChange={event => { if (event.target.files) void upload(event.target.files); }} aria-label="Choose album photos" />
        <button type="button" className={`upload-zone${dragging ? ' is-dragging' : ''}`} onClick={() => fileInput.current?.click()} disabled={uploading || photos.length >= MAX_PHOTOS} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          {uploading ? <LoaderCircle size={27} className="spin" /> : <ImagePlus size={29} strokeWidth={1.4} />}
          <strong>{uploading ? 'Preparing your photos…' : photos.length >= MAX_PHOTOS ? 'Your album is full' : photos.length ? 'Add a few more moments' : 'Drop your photos here'}</strong>
          <span>{uploading ? 'Keeping them beautiful, making them lighter.' : `or choose from your device · ${photos.length}/${MAX_PHOTOS} photos · up to 15 MB each`}</span>
          {!uploading && photos.length < MAX_PHOTOS && <span className="upload-link"><Upload size={14} /> Choose photos</span>}
        </button>
        {errors.length > 0 && <div className="form-error" role="alert">{errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
        {photos.length > 0 && <>
          <p className="form-hint">Your cover starts as a yearbook highlight. Star or unstar any moment. Each photo can have a smaller audience.</p>
          <div className="editor-photos">
            {photos.map((photo, index) => <div className="editor-photo" key={photo.id}>
              <div className="editor-photo-image"><img src={photo.src} alt={photo.caption || `Album photo ${index + 1}`} />{index === 0 && <span className="cover-label">Cover photo</span>}</div>
              <div className="photo-tools">
                <button type="button" className={`icon-button${photo.highlight ? ' is-highlight' : ''}`} aria-label={`${photo.highlight ? 'Remove' : 'Add'} photo ${index + 1} ${photo.highlight ? 'from' : 'to'} yearbook highlights`} aria-pressed={photo.highlight} onClick={() => updatePhoto(photo.id, { highlight: !photo.highlight })}><Star size={17} fill={photo.highlight ? 'currentColor' : 'none'} /></button>
                <button type="button" className="icon-button" aria-label={`Move photo ${index + 1} earlier`} disabled={index === 0} onClick={() => movePhoto(index, -1)}><ArrowLeft size={16} /></button>
                <button type="button" className="icon-button" aria-label={`Move photo ${index + 1} later`} disabled={index === photos.length - 1} onClick={() => movePhoto(index, 1)}><ArrowRight size={16} /></button>
                <button type="button" className="icon-button danger" aria-label={`Remove photo ${index + 1}`} onClick={() => setPhotos(previous => previous.filter(item => item.id !== photo.id))}><Trash2 size={16} /></button>
              </div>
              <label className="field"><span className="visually-hidden">Caption for photo {index + 1}</span><input className="input" maxLength={200} value={photo.caption} onChange={event => updatePhoto(photo.id, { caption: event.target.value })} placeholder="A little caption…" /></label>
              <label className="field"><span className="visually-hidden">Audience for photo {index + 1}</span><select className="select" value={photo.audience} onChange={event => updatePhoto(photo.id, { audience: event.target.value as Audience })}>{options.map(option => <option value={option} key={option}>{AUDIENCE_LABELS[option]}</option>)}</select></label>
            </div>)}
          </div>
        </>}
        <footer className="modal-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={!title.trim() || photos.length === 0 || uploading}>{album ? 'Save changes' : 'Create album'}</button>
        </footer>
        <p className="form-hint local-save-hint">Saved on this device. Sharing with real people is coming next.</p>
      </form>
    </Modal>
  );
}
