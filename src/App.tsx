import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowRight, Bell, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Flower2, Globe2, Heart, Home, Images, Leaf, LockKeyhole, Menu, MessageCircle, Plus, Search, Settings2, Sparkles, Star, Users, X } from 'lucide-react';
import type { Album, AppState, Audience, Circle, Photo, User } from './lib/model';
import { effectiveAudience, visiblePhotos } from './lib/model';
import { USERS } from './lib/seed';
import { loadState, saveState, StorageConflictError } from './lib/store';
import AlbumEditor from './components/AlbumEditor';
import Modal from './components/Modal';

type Page = 'home' | 'albums' | 'circles' | 'yearbook' | 'saved';
const pageLabels: Record<Page, string> = { home: 'Your people', albums: 'My albums', circles: 'My circles', yearbook: 'Year in review', saved: 'Saved albums' };
const audienceLabels: Record<Audience, string> = { family: 'Family', besties: 'Besties', friends: 'Friends', public: 'Everyone', private: 'Only me' };
const audienceIcons: Record<Audience, typeof Users> = { family: Heart, besties: Sparkles, friends: Users, public: Globe2, private: LockKeyhole };
const dateLabel = (period: string) => new Date(`${period}-02T12:00:00`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
const userFor = (id: string) => USERS.find(user => user.id === id) ?? USERS[0];
const initial = (name: string) => name.split(' ').map(word => word[0]).slice(0, 2).join('');

function Avatar({ user, small = false }: { user: User; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <span className={`avatar ${small ? 'avatar-small' : ''}`} style={{ background: user.color }}>{user.avatar && !failed ? <img src={user.avatar} alt="" onError={() => setFailed(true)} /> : initial(user.name)}</span>;
}
function AudienceBadge({ audience }: { audience: Audience }) {
  const Icon = audienceIcons[audience];
  return <span className={`audience-badge audience-${audience}`}><Icon size={12} />{audienceLabels[audience]}</span>;
}
function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h2>{title}</h2><p>{children}</p>{action}</div>;
}
function Bloom({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g fill="currentColor">{[0, 45, 90, 135].map(angle => <rect key={angle} x="45" y="5" width="10" height="90" rx="5" transform={`rotate(${angle} 50 50)`} />)}</g></svg>;
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState<Page>('home');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('latest');
  const [editing, setEditing] = useState<Album | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [circleId, setCircleId] = useState<Circle['id'] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [saveError, setSaveError] = useState<'storage' | 'conflict' | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const hydratedState = useRef<AppState | null>(null);

  useEffect(() => {
    let active = true;
    loadState().then(data => { if (active) { hydratedState.current = data; setState(data); } }).catch(() => { if (active) setLoadError('Your albums could not be opened. Enable browser storage and refresh to try again.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!state || state === hydratedState.current) return;
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveState(state)).then(() => setSaveError(null)).catch(error => setSaveError(error instanceof StorageConflictError ? 'conflict' : 'storage'));
  }, [state]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  function update(fn: (state: AppState) => AppState) { setState(current => current ? fn(current) : current); }
  function navigate(next: Page) { setPage(next); setQuery(''); setFilter('all'); setSidebarOpen(false); setNotificationsOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function toggleSaved(id: string) {
    if (!state) return;
    const saved = state.savedAlbumIds.includes(id);
    update(s => ({ ...s, savedAlbumIds: saved ? s.savedAlbumIds.filter(a => a !== id) : [...s.savedAlbumIds, id] }));
    setToast(saved ? 'Album removed from your saved collection' : 'A good one, kept for later');
  }
  function toggleHighlight(albumId: string, photoId: string) {
    update(s => ({ ...s, albums: s.albums.map(a => a.id === albumId ? { ...a, photos: a.photos.map(p => p.id === photoId ? { ...p, highlight: !p.highlight } : p) } : a) }));
  }
  function saveAlbum(album: Album) {
    update(s => ({ ...s, albums: s.albums.some(a => a.id === album.id) ? s.albums.map(a => a.id === album.id ? album : a) : [album, ...s.albums] }));
    setEditing(null); setOpenId(album.id); setToast('Your little moments, kept together');
  }
  if (!state) return <div className="loading-screen"><Flower2 size={48} strokeWidth={1.4} /><h1>gather<span>®</span></h1><p>{loadError || 'Making a little room for your memories…'}</p>{loadError && <button className="button button-primary" onClick={() => location.reload()}>Try again</button>}</div>;

  const ownAlbums = state.albums.filter(a => a.authorId === 'you');
  const friendAlbums = state.albums.filter(a => a.authorId !== 'you');
  let albums = page === 'albums' ? ownAlbums : page === 'saved' ? state.albums.filter(a => state.savedAlbumIds.includes(a.id)) : friendAlbums;
  if (filter !== 'all') {
    const circle = state.circles.find(c => c.id === filter);
    albums = page === 'albums' ? albums.filter(a => a.audience === filter) : albums.filter(a => circle?.members.some(m => m.id === a.authorId));
  }
  albums = albums.filter(a => `${a.title} ${a.caption} ${userFor(a.authorId).name} ${dateLabel(a.period)}`.toLowerCase().includes(query.toLowerCase()));
  albums = [...albums].sort((a, b) => sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : sort === 'title' ? a.title.localeCompare(b.title) : b.createdAt.localeCompare(a.createdAt));
  const openAlbum = state.albums.find(a => a.id === openId);
  const activeCircle = state.circles.find(c => c.id === circleId);
  const navItems: { id: Page; icon: typeof Home; label: string }[] = [{ id: 'home', icon: Home, label: 'Your people' }, { id: 'albums', icon: Images, label: 'My albums' }, { id: 'circles', icon: Users, label: 'My circles' }, { id: 'yearbook', icon: Sparkles, label: 'Year in review' }, { id: 'saved', icon: Bookmark, label: 'Saved albums' }];
  return <div className="app-shell">
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => navigate('home')} aria-label="Gather home"><Flower2 className="brand-flower" size={38} strokeWidth={1.8} /><span>gather<span className="brand-dot">.</span></span></button>
      <div className="brand-tagline">A little closer.</div>
      <div className="nav-label">YOUR LITTLE CORNER</div>
      <nav aria-label="Main navigation">{navItems.map(({ id, icon: Icon, label }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{id === 'yearbook' && <span className="nav-new">NEW</span>}</button>)}</nav>
      <div className="sidebar-note"><Bloom className="note-flower" /><p>Less scrolling.<br /><em>More remembering.</em></p><span>A space for the good stuff.</span></div>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setSettingsOpen(true)}><Settings2 size={18} strokeWidth={1.7} />Your preferences</button><button className="nav-item" onClick={() => setAboutOpen(true)}><CircleHelp size={18} strokeWidth={1.7} />A little about Gather</button><button className="profile" onClick={() => setSettingsOpen(true)}><Avatar user={USERS[0]} /><span><strong>{USERS[0].name}</strong><small>Your personal space</small></span><ChevronDown size={16} /></button></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button><span>My corner</span><ChevronRight size={13} /><strong>{pageLabels[page]}</strong></div><div className="topbar-actions"><span className="local-label"><span />Personal preview</span><button className={`icon-button notification-button ${notificationsOpen ? 'is-active' : ''}`} aria-label="Open updates" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={19} strokeWidth={1.6} /><span className="notification-dot" /></button></div>
        {notificationsOpen && <div className="notifications-panel"><span className="eyebrow">A LITTLE HELLO</span><h3>Room for something good.</h3><p>{state.settings.reminders ? `Your ${state.settings.cadence.toLowerCase()} album is a chance to pause and look back.` : 'Your people have shared a few moments. Take your time catching up.'}</p><button className="text-button" onClick={() => { setNotificationsOpen(false); setEditing('new'); }}>Make your next album <ArrowRight size={15} /></button><small>Sample updates · saved on this device</small></div>}
      </header>
      <main>
        {saveError && <div className="storage-warning" role="alert">{saveError === 'conflict' ? <>Gather changed in another tab. This tab’s latest changes haven’t been saved. <button onClick={() => location.reload()}>Reload the saved version</button> before making more changes.</> : <>Your latest changes couldn’t be saved on this device. Keep this tab open and free some browser storage, then <button onClick={() => setState({ ...state })}>try again</button>.</>}</div>}
        {page === 'home' && <>
          <div className="page-heading"><div><div className="eyebrow greeting"><span className="tiny-sun">☼</span> THE LITTLE THINGS ADD UP</div><h1>Life lately<span className="heading-dot">.</span></h1><p>A few moments from the people who make your world.</p></div><button className="button button-primary" onClick={() => setEditing('new')}><Plus size={18} />Make an album</button></div>
          <YearBanner photos={ownAlbums.flatMap(a => a.photos)} onOpen={() => navigate('yearbook')} />
        </>}
        {page === 'albums' && <div className="page-heading"><div><span className="eyebrow">YOUR LIFE, IN CHAPTERS</span><h1>My albums<span className="heading-dot">.</span></h1><p>Big days, ordinary days, and everything in between.</p></div><button className="button button-primary" onClick={() => setEditing('new')}><Plus size={18} />Make an album</button></div>}
        {page === 'saved' && <div className="page-heading"><div><span className="eyebrow">WORTH ANOTHER LOOK</span><h1>The ones you kept<span className="heading-dot">.</span></h1><p>A little collection of moments to come back to.</p></div><Bookmark className="heading-decoration" size={40} strokeWidth={1} /></div>}
        {['home', 'albums', 'saved'].includes(page) && <>
          <div className="section-title"><h2>{page === 'home' ? 'Fresh from your people' : page === 'albums' ? 'Your collection' : 'Saved for a slow moment'}<span className="count-badge">{albums.length}</span></h2><span className="quiet-caption">No rush. You’re right on time.</span></div>
          <div className="feed-toolbar"><div className="filter-pills" aria-label="Filter albums"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All {page === 'home' ? 'updates' : 'albums'}</button>{state.circles.map(c => { const Icon = audienceIcons[c.id]; return <button key={c.id} className={filter === c.id ? 'selected' : ''} onClick={() => setFilter(c.id)}><Icon size={14} />{c.name}</button>; })}</div><div className="feed-controls"><label className="search-field"><Search size={15} /><input aria-label="Search albums" placeholder="Find a moment…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={13} /></button>}</label><label className="sort-field"><ArrowDown size={13} /><select aria-label="Sort albums" value={sort} onChange={e => setSort(e.target.value)}><option value="latest">Latest first</option><option value="oldest">Oldest first</option><option value="title">By title</option></select></label></div></div>
          {albums.length ? <div className="album-grid">{albums.map(album => <AlbumCard key={album.id} album={album} saved={state.savedAlbumIds.includes(album.id)} onOpen={() => setOpenId(album.id)} onSave={() => toggleSaved(album.id)} />)}{page !== 'saved' && !query && filter === 'all' && <button className="new-album-card" onClick={() => setEditing('new')}><span className="new-album-icon"><Plus size={25} strokeWidth={1.3} /></span><h3>How’s your little world?</h3><p>It doesn’t have to be a big adventure.<br />The everyday is worth keeping, too.</p><span className="text-button">Put an album together <ArrowRight size={15} /></span></button>}</div> : <EmptyState icon={query ? <Search /> : <Images />} title={query ? 'No moments found' : page === 'saved' ? 'Keep the ones you love.' : filter !== 'all' ? 'A quiet little corner.' : 'Your first chapter starts here.'}>{query ? 'Try another name, album title, or month.' : page === 'saved' ? 'Tap the bookmark on any album to find it here later.' : filter !== 'all' ? 'No albums in this circle yet. Try another circle, or share a little update of your own.' : 'A few photos and a little story. That’s all it takes.'}{!query && <button className="button button-secondary" onClick={() => page === 'saved' ? navigate('home') : setEditing('new')}>{page === 'saved' ? 'See your people' : 'Make an album'}<ArrowRight size={15} /></button>}</EmptyState>}
          {!!albums.length && <div className="caught-up"><span><Check size={15} /></span><h3>All caught up. Go make a memory.</h3><p>The good stuff will be here when you get back.</p><Flower2 size={23} strokeWidth={1} /></div>}
        </>}
        {page === 'circles' && <><div className="page-heading"><div><span className="eyebrow">CLOSER TO YOUR PEOPLE</span><h1>Good company<span className="heading-dot">.</span></h1><p>Different moments. Different people. Always your choice.</p></div><Users size={48} className="heading-decoration" strokeWidth={1} /></div><div className="circles-explainer"><LockKeyhole size={21} /><div><strong>A little circle for every part of your life.</strong><p>Choose who an album is for. Keep individual photos even closer when you want to.</p></div></div><div className="circle-grid">{state.circles.map(c => { const Icon = audienceIcons[c.id]; return <article className={`circle-card circle-${c.id}`} key={c.id}><span className="circle-icon"><Icon size={26} strokeWidth={1.4} /></span><h2>{c.name}</h2><p>{c.description}</p><div className="avatar-stack">{c.members.slice(0, 5).map(u => <Avatar user={u} key={u.id} />)}{!c.members.length && <span className="no-members">Room for your people</span>}</div><span className="circle-count">{c.members.length} {c.members.length === 1 ? 'person' : 'people'} in your circle</span><button className="button button-secondary" onClick={() => setCircleId(c.id)}>Manage circle<ArrowRight size={16} /></button></article>; })}</div><p className="local-footnote"><Leaf size={14} />This is your personal preview. Circle changes stay on this device; invitations and real sharing come next.</p></>}
        {page === 'yearbook' && <Yearbook albums={ownAlbums} onToggle={toggleHighlight} onOpen={setOpenId} onNotify={setToast} onCreate={() => setEditing('new')} />}
        <footer className="main-footer"><span><Flower2 size={15} strokeWidth={1.4} />Made for moments, not metrics.</span><button onClick={() => setAboutOpen(true)}>A slower kind of social <ArrowUpRightIcon /></button></footer>
      </main>
    </div>
    {editing && <AlbumEditor album={editing === 'new' ? undefined : editing} onSave={saveAlbum} onClose={() => setEditing(null)} />}
    {openAlbum && !editing && <AlbumViewer album={openAlbum} state={state} onClose={() => setOpenId(null)} onEdit={() => setEditing(openAlbum)} onSave={() => toggleSaved(openAlbum.id)} onLike={() => update(s => ({ ...s, likedAlbumIds: s.likedAlbumIds.includes(openAlbum.id) ? s.likedAlbumIds.filter(id => id !== openAlbum.id) : [...s.likedAlbumIds, openAlbum.id] }))} onHighlight={id => toggleHighlight(openAlbum.id, id)} onNote={text => { update(s => ({ ...s, notes: { ...s.notes, [openAlbum.id]: [...(s.notes[openAlbum.id] ?? []), { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }] } })); setToast('Your personal note is saved'); }} onDelete={() => { update(s => { const notes = { ...s.notes }; delete notes[openAlbum.id]; return { ...s, notes, albums: s.albums.filter(a => a.id !== openAlbum.id), savedAlbumIds: s.savedAlbumIds.filter(id => id !== openAlbum.id), likedAlbumIds: s.likedAlbumIds.filter(id => id !== openAlbum.id) }; }); setOpenId(null); setToast('Album deleted from this device'); }} />}
    {activeCircle && <CircleEditor circle={activeCircle} onClose={() => setCircleId(null)} onSave={circle => { update(s => ({ ...s, circles: s.circles.map(c => c.id === circle.id ? circle : c) })); setCircleId(null); setToast(`${circle.name} circle updated`); }} />}
    {settingsOpen && <Modal title="Your own rhythm." subtitle="A little less pressure. A little more you." onClose={() => setSettingsOpen(false)}><div className="modal-body preferences"><div className="preference-profile"><Avatar user={USERS[0]} /><div><strong>{USERS[0].name}</strong><p>Your personal preview</p></div></div><label className="field">When do you like to look back?<select className="select" value={state.settings.cadence} onChange={e => update(s => ({ ...s, settings: { ...s.settings, cadence: e.target.value } }))}><option>Monthly</option><option>Fortnightly</option><option>Seasonally</option><option>Whenever I feel like it</option></select></label><div className="toggle-row"><div><strong>A gentle nudge</strong><p>Show an album prompt in your Gather updates.<br />No emails or push notifications.</p></div><button className={`toggle ${state.settings.reminders ? 'on' : ''}`} role="switch" aria-checked={state.settings.reminders} aria-label="Album reminders" onClick={() => update(s => ({ ...s, settings: { ...s.settings, reminders: !s.settings.reminders } }))}><span /></button></div><div className="info-note"><LockKeyhole size={18} /><p>Your albums are stored in this browser. Export your yearbook to keep a copy. Clearing site data removes your albums.</p></div><button className="button button-primary" onClick={() => { setSettingsOpen(false); setToast('Your rhythm, remembered'); }}>All done<Check size={16} /></button></div></Modal>}
    {aboutOpen && <Modal title="A little closer." subtitle="Welcome to Gather." onClose={() => setAboutOpen(false)}><div className="modal-body about-content"><Flower2 size={48} strokeWidth={1.2} /><p className="about-lead">Life doesn’t need an audience.<br />Just a few good people.</p><p>Gather is a quieter place to share your life in photo albums. A month, a weekend, an ordinary Tuesday. Keep your people close and your little moments closer.</p><div className="info-note"><Leaf size={19} /><p>You’re exploring a working local preview with sample people and albums. Uploads, notes, circles and favourites stay in this browser. There are no real accounts or online sharing yet.</p></div><button className="button button-primary" onClick={() => setAboutOpen(false)}>Make yourself at home<ArrowRight size={16} /></button></div></Modal>}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}<button aria-label="Dismiss message" onClick={() => setToast('')}><X size={14} /></button></div>}
  </div>;
}

function ArrowUpRightIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 18 18 6M6 6h12v12" /></svg>; }
function YearBanner({ photos, onOpen }: { photos: Photo[]; onOpen: () => void }) {
  return <section className="year-banner"><div className="banner-copy"><span className="eyebrow"><Sparkles size={13} /> A YEAR WORTH KEEPING</span><h2>Little moments. <em>A whole year.</em></h2><p>Your favourite memories, gathered into one beautiful story.</p><button className="banner-link" onClick={onOpen}>Meet your year in review<ArrowRight size={16} /></button></div><div className="banner-art" aria-hidden="true"><span className="banner-year">2026</span><div className="polaroid polaroid-one"><img src={photos[0]?.src} alt="" /><span>the places we went</span></div><div className="polaroid polaroid-two"><img src={photos[2]?.src} alt="" /><span>the little things ♡</span></div><Bloom className="banner-sparkle" /></div></section>;
}
function AlbumCard({ album, saved, onOpen, onSave }: { album: Album; saved: boolean; onOpen: () => void; onSave: () => void }) {
  const user = userFor(album.authorId);
  return <article className="album-card"><div className="card-author"><Avatar user={user} small /><div><strong>{album.authorId === 'you' ? 'You' : user.name}</strong><span>{dateLabel(album.period)}</span></div><button className={`icon-button bookmark-button ${saved ? 'saved' : ''}`} aria-label={`${saved ? 'Unsave' : 'Save'} ${album.title}`} aria-pressed={saved} onClick={onSave}><Bookmark size={17} strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} /></button></div><button className="card-cover" onClick={onOpen} aria-label={`Open album: ${album.title}`}><div className={`photo-collage photos-${Math.min(album.photos.length, 3)}`}>{album.photos.slice(0, 3).map((photo, i) => <img key={photo.id} className={`collage-photo collage-${i}`} src={photo.src} alt={photo.caption || `${album.title}, photo ${i + 1}`} loading="lazy" />)}</div><span className="photo-count"><Images size={12} />{album.photos.length} photos</span><span className="cover-open"><ArrowRight size={20} /></span></button><div className="card-body"><button className="card-title" onClick={onOpen}><h3>{album.title}</h3></button><p>{album.caption}</p><div className="card-footer"><AudienceBadge audience={album.audience} /><button className="open-album" onClick={onOpen}>Take a look<ArrowRight size={14} /></button></div></div></article>;
}

function AlbumViewer({ album, state, onClose, onEdit, onSave, onLike, onHighlight, onNote, onDelete }: { album: Album; state: AppState; onClose: () => void; onEdit: () => void; onSave: () => void; onLike: () => void; onHighlight: (id: string) => void; onNote: (text: string) => void; onDelete: () => void }) {
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<Audience>('private');
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const own = album.authorId === 'you';
  const photos = own ? visiblePhotos(album, viewer) : album.photos;
  const currentIndex = Math.min(index, Math.max(0, photos.length - 1));
  const photo = photos[currentIndex];
  const user = userFor(album.authorId);
  return <Modal title={album.title} subtitle={dateLabel(album.period)} onClose={onClose} wide><div className="album-viewer"><div className="viewer-main">{own && <label className="preview-control"><LockKeyhole size={14} />Preview as<select aria-label="Preview album as" value={viewer} onChange={e => { setViewer(e.target.value as Audience); setIndex(0); }}><option value="private">Only me (owner)</option><option value="family">Family</option><option value="besties">Besties</option><option value="friends">Friends</option><option value="public">Everyone</option></select></label>}{photo ? <><div className="viewer-image"><img src={photo.src} alt={photo.caption || album.title} />{photos.length > 1 && <><button className="viewer-arrow prev" aria-label="Previous photo" onClick={() => setIndex((currentIndex - 1 + photos.length) % photos.length)}><ChevronLeft /></button><button className="viewer-arrow next" aria-label="Next photo" onClick={() => setIndex((currentIndex + 1) % photos.length)}><ChevronRight /></button></>}<span className="viewer-counter">{currentIndex + 1} / {photos.length}</span>{own && <button className={`highlight-button ${photo.highlight ? 'is-highlight' : ''}`} aria-label={photo.highlight ? 'Remove from yearbook' : 'Add to yearbook'} aria-pressed={photo.highlight} onClick={() => onHighlight(photo.id)}><Star size={17} fill={photo.highlight ? 'currentColor' : 'none'} />{photo.highlight ? 'Yearbook moment' : 'Keep for your yearbook'}</button>}</div><div className="photo-caption"><p>{photo.caption || 'A little moment worth keeping.'}</p>{own && <AudienceBadge audience={effectiveAudience(photo.audience, album.audience)} />}</div><div className="viewer-thumbnails">{photos.map((p, i) => <button key={p.id} className={currentIndex === i ? 'selected' : ''} onClick={() => setIndex(i)} aria-label={`View photo ${i + 1}`}><img src={p.src} alt="" /></button>)}</div></> : <EmptyState icon={<LockKeyhole />} title="Kept a little closer.">No photos in this album are visible to this audience.</EmptyState>}{own && viewer !== 'private' && <p className="form-hint">Audience preview · {album.photos.length - photos.length} of {album.photos.length} photos hidden. This preview does not publish your album.</p>}</div><aside className="viewer-aside"><div className="viewer-author"><Avatar user={user} /><div><strong>{own ? 'Your album' : user.name}</strong><AudienceBadge audience={album.audience} /></div></div><p className="album-story">{album.caption}</p><div className="viewer-actions"><button className={`button button-secondary ${state.likedAlbumIds.includes(album.id) ? 'liked' : ''}`} onClick={onLike} aria-pressed={state.likedAlbumIds.includes(album.id)}><Heart size={16} fill={state.likedAlbumIds.includes(album.id) ? 'currentColor' : 'none'} />{state.likedAlbumIds.includes(album.id) ? 'A little love' : 'Leave a little love'}</button><button className="icon-button" aria-label={state.savedAlbumIds.includes(album.id) ? 'Unsave album' : 'Save album'} onClick={onSave}><Bookmark size={20} fill={state.savedAlbumIds.includes(album.id) ? 'currentColor' : 'none'} /></button></div><div className="notes-section"><h3><MessageCircle size={16} />A note to remember</h3><p>Just for you. A little thought to keep with this album.</p>{(state.notes[album.id] ?? []).map(n => <div className="personal-note" key={n.id}><p>{n.text}</p><small>Saved by you · {new Date(n.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</small></div>)}<form onSubmit={e => { e.preventDefault(); if (note.trim()) { onNote(note.trim()); setNote(''); } }}><textarea className="textarea" aria-label="Personal note" placeholder="This reminds me of…" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={3} /><button className="text-button" disabled={!note.trim()} type="submit">Keep this note<ArrowRight size={14} /></button></form></div>{own && <div className="owner-actions"><button className="button button-secondary" onClick={onEdit}>Edit album<Settings2 size={15} /></button>{confirmDelete ? <div className="delete-confirm"><p>Delete this album and its photos from this device?</p><button className="danger-button" onClick={onDelete}>Yes, delete album</button><button className="text-button" onClick={() => setConfirmDelete(false)}>Keep it</button></div> : <button className="text-button muted-danger" onClick={() => setConfirmDelete(true)}>Delete album</button>}</div>}</aside></div></Modal>;
}

function CircleEditor({ circle, onClose, onSave }: { circle: Circle; onClose: () => void; onSave: (circle: Circle) => void }) {
  const [members, setMembers] = useState(circle.members.map(m => m.id));
  return <Modal title={`Your ${circle.name.toLowerCase()} circle`} subtitle="A little space for the people you choose." onClose={onClose}><div className="modal-body"><p className="circle-editor-intro">Choose from the sample people below. One person can belong to more than one circle.</p><div className="member-list">{USERS.filter(u => u.id !== 'you').map(u => <label className="member-row" key={u.id}><Avatar user={u} /><span><strong>{u.name}</strong><small>@{u.handle}</small></span><input type="checkbox" checked={members.includes(u.id)} onChange={() => setMembers(current => current.includes(u.id) ? current.filter(id => id !== u.id) : [...current, u.id])} /></label>)}</div><div className="modal-footer"><span className="form-hint">{members.length} people · saved on this device</span><button className="button button-primary" onClick={() => onSave({ ...circle, members: USERS.filter(u => members.includes(u.id)) })}>Save circle<Check size={15} /></button></div></div></Modal>;
}

function Yearbook({ albums, onToggle, onOpen, onNotify, onCreate }: { albums: Album[]; onToggle: (albumId: string, photoId: string) => void; onOpen: (id: string) => void; onNotify: (text: string) => void; onCreate: () => void }) {
  const currentYear = new Date().getFullYear().toString();
  const years = [...new Set([currentYear, ...albums.map(a => a.period.slice(0, 4))])].sort().reverse();
  const [year, setYear] = useState(years[0]);
  const [audience, setAudience] = useState<Audience>('private');
  const [exporting, setExporting] = useState(false);
  const yearAlbums = albums.filter(a => a.period.startsWith(year)).sort((a, b) => a.period.localeCompare(b.period));
  const allHighlights = yearAlbums.flatMap(album => album.photos.filter(p => p.highlight).map(photo => ({ album, photo })));
  const highlights = allHighlights.filter(({ album, photo }) => visiblePhotos(album, audience).some(p => p.id === photo.id));
  async function exportBook() {
    setExporting(true);
    const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
    try {
      const sections = await Promise.all(highlights.map(async ({ album, photo }) => {
        let src = photo.src;
        if (!src.startsWith('data:')) {
          const response = await fetch(src);
          if (!response.ok) throw new Error('Image unavailable');
          const blob = await response.blob();
          src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
        }
        return `<figure><img src="${escape(src)}" alt="${escape(photo.caption)}"><figcaption><small>${escape(dateLabel(album.period))}</small><p>${escape(photo.caption || album.title)}</p></figcaption></figure>`;
      }));
      const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>My ${year} — Gather</title><style>body{background:#f8f7f2;color:#343b2c;max-width:900px;margin:60px auto;padding:24px;font:17px Georgia,serif}header{text-align:center;margin-bottom:60px}h1{font-size:70px;font-weight:400;margin:10px}h2{font-weight:400}figure{margin:0 0 50px;break-inside:avoid}img{width:100%;max-height:700px;object-fit:contain;background:#e8e9df}figcaption{padding:16px 0}small,footer{font:12px Arial,sans-serif;color:#73786b}footer{text-align:center;margin:70px 0}@media print{body{margin:0;max-width:100%}figure{page-break-inside:avoid}img{max-height:75vh}}</style><header><small>GATHER · A YEAR WORTH KEEPING</small><h1>${year}</h1><h2>My year, in little moments.</h2><p>${highlights.length} memories · ${escape(audienceLabels[audience])} edition</p></header>${sections.join('')}<footer>Little moments. A whole year. Made with Gather.</footer></html>`;
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      const link = document.createElement('a'); link.href = url; link.download = `gather-${year}-${audience}-yearbook.html`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      onNotify(`Your ${year} yearbook is ready to keep`);
    } catch { onNotify('A photo could not be exported. Please try again.'); } finally { setExporting(false); }
  }
  return <><div className="page-heading"><div><span className="eyebrow"><Sparkles size={14} /> THE DAYS BECOME A STORY</span><h1>Your year, gathered<span className="heading-dot">.</span></h1><p>A collection of the little things that turned out to be the big things.</p></div><button className="button button-primary" disabled={!highlights.length || exporting} onClick={exportBook}><ArrowDownToLine size={17} />{exporting ? 'Gathering your photos…' : 'Export yearbook'}</button></div><div className="yearbook-hero"><Bloom className="yearbook-flower" /><div><span className="eyebrow">THIS WAS YOUR</span><h2>{year}</h2><p>A little adventure. A little ordinary. All yours.</p></div><div className="yearbook-stats"><span><strong>{yearAlbums.length}</strong>albums</span><span><strong>{new Set(yearAlbums.map(a => a.period)).size}</strong>chapters</span><span><strong>{allHighlights.length}</strong>little highlights</span></div></div><div className="yearbook-toolbar"><label className="year-select"><select aria-label="Yearbook year" value={year} onChange={e => setYear(e.target.value)}>{years.map(y => <option key={y}>{y}</option>)}</select><ChevronDown size={16} /></label><label className="yearbook-audience"><LockKeyhole size={14} />An edition for<select aria-label="Yearbook audience" value={audience} onChange={e => setAudience(e.target.value as Audience)}><option value="private">Only me</option><option value="family">Family</option><option value="besties">Besties</option><option value="friends">Friends</option><option value="public">Everyone</option></select></label></div><div className="yearbook-help"><Star size={17} /><p>Made from your starred photos. Open any of your albums to add a moment.<br /><span>{audience === 'private' ? 'Your personal edition includes all your highlights.' : `${allHighlights.length - highlights.length} private moments excluded from this edition. Exports keep the original photo audiences.`} Your yearbook is yours to edit, anytime.</span></p></div>{highlights.length ? <div className="yearbook-grid">{highlights.map(({ album, photo }, i) => <article className={`yearbook-memory memory-${i % 3}`} key={photo.id}><button className="memory-image" onClick={() => onOpen(album.id)} aria-label={`Open ${album.title}`}><img src={photo.src} alt={photo.caption || album.title} /></button><div><span className="eyebrow">{dateLabel(album.period)}</span><button className="icon-button" aria-label={`Remove highlight: ${photo.caption}`} onClick={() => onToggle(album.id, photo.id)}><Star size={17} fill="currentColor" /></button><h3>{photo.caption || album.title}</h3><AudienceBadge audience={effectiveAudience(photo.audience, album.audience)} /></div></article>)}</div> : <EmptyState icon={<Star />} title="Every year starts with a moment.">{allHighlights.length ? 'Your highlights are kept closer than this audience. Choose your personal edition to see them.' : 'Star a photo in one of your albums and it will find a home here.'}<button className="button button-secondary" onClick={onCreate}>Make an album<Plus size={15} /></button></EmptyState>}<div className="yearbook-ending"><Flower2 size={32} strokeWidth={1} /><h2>And there’s still more to come.</h2><p>Keep living. We’ll keep a little space for it.</p></div></>;
}
